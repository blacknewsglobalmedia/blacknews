/**
 * BLACKNEWS OSINT — Pruebas de la lógica pura del módulo.
 *
 * Ejecutar con:  npx tsx test/osint-logic.test.ts
 *
 * Cubre: URLs canónicas, normalización de titulares, detección de
 * duplicados/agrupación de acontecimientos, puntuación editorial con
 * factores explicados, guard SSRF, parser RSS/Atom, la traducción
 * automática al importar (prompt y parser de la respuesta de la IA) y
 * las rutas sin red de la verificación de ID tokens de Google.
 * Son funciones puras (sin red ni KV), así que corren igual en local y CI.
 */
import assert from 'node:assert/strict';
import {
  canonicalUrl,
  clusterItems,
  hashHex,
  normalizeItems,
  normalizeTitle,
  scoreItems,
  sortItems,
  titleSimilarity,
} from '../worker/osint/normalize';
import {
  assertSafeOutboundUrl,
  isDomainAllowlisted,
  SsrfError,
} from '../worker/osint/ssrf';
import { parseFeed } from '../worker/osint/connectors';
import { buildTranslationPrompt, parseTranslationResponse } from '../worker/osint/translate';
import { verifyGoogleIdToken } from '../worker/osint/auth';

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

const DETECTED = '2026-10-21T12:00:00.000Z';
const baseCtx = {
  sourceId: 'gdelt',
  sourceName: 'GDELT',
  sourceKind: 'gdelt' as const,
  detectedAt: DETECTED,
  query: 'ia regulation',
};

/* ------------------------------------------------------------------ */
console.log('\n[1] Hash y URL canónica');
test('hashHex es determinista y hexadecimal', () => {
  assert.equal(hashHex('abc'), hashHex('abc'));
  assert.match(hashHex('abc'), /^[0-9a-f]{8,}$/);
  assert.notEqual(hashHex('abc'), hashHex('abd'));
});

test('canonicalUrl elimina trackers, www, fragmento y barra final', () => {
  const a = canonicalUrl('https://www.example.com/noticia/1/?utm_source=x&utm_medium=y&fbclid=z#seccion');
  const b = canonicalUrl('https://example.com/noticia/1');
  assert.equal(a, b);
});

test('canonicalUrl conserva parámetros meaningful y ordena', () => {
  const a = canonicalUrl('https://example.com/a?id=2&page=1');
  const b = canonicalUrl('https://example.com/a?page=1&id=2');
  assert.equal(a, b);
  assert.ok(a.includes('id=2') && a.includes('page=1'));
});

/* ------------------------------------------------------------------ */
console.log('\n[2] Normalización de titulares y similitud');
test('normalizeTitle quita tildes, puntuación y espacios', () => {
  assert.equal(normalizeTitle('¡Hola,   Mundo! — Época'), 'hola mundo epoca');
});

test('titleSimilarity: idénticos=1, disjointos=0, parcial en medio', () => {
  assert.equal(titleSimilarity('El gobierno anuncia nuevas medidas económicas urgentes', 'El gobierno anuncia nuevas medidas económicas urgentes'), 1);
  assert.equal(titleSimilarity('gato perro', 'puente auto'), 0);
  const mid = titleSimilarity('gobierno anuncia medidas económicas', 'gobierno aprueba medidas económicas');
  assert.ok(mid > 0.4 && mid < 1, `similitud media esperada, obtuve ${mid}`);
});

/* ------------------------------------------------------------------ */
console.log('\n[3] Normalización de ítems');
test('descarta ítems sin titular o sin enlace y deduplica URL en la misma fuente', () => {
  const items = normalizeItems(
    [
      { title: '', url: 'https://a.com/1' },
      { title: 'Sin enlace', url: '' },
      { title: 'Titular válido', url: 'https://a.com/1?utm_source=rss' },
      { title: 'Otro titular', url: 'https://a.com/1' },
    ],
    baseCtx,
  );
  // Los dos últimos comparten canónica → queda sólo el primero.
  assert.equal(items.length, 1);
  assert.equal(items[0].title, 'Titular válido');
  assert.equal(items[0].canonicalUrl, 'https://a.com/1');
});

test('conserva fecha original, detecta en detectedAt y normaliza idioma/país', () => {
  const items = normalizeItems(
    [
      {
        title: 'Titular con datos',
        url: 'https://a.com/2',
        publishedAt: '2026-10-20T08:00:00.000Z',
        language: 'EN',
        country: 'uy',
      },
    ],
    baseCtx,
  );
  assert.equal(items[0].publishedAt, '2026-10-20T08:00:00.000Z');
  assert.equal(items[0].detectedAt, DETECTED);
  assert.equal(items[0].language, 'en');
  assert.equal(items[0].country, 'UY');
});

/* ------------------------------------------------------------------ */
console.log('\n[4] Duplicados y agrupación de acontecimientos');
const raw = (title: string, url: string, publishedAt?: string) => ({ title, url, publishedAt });

test('misma URL canónica en dos fuentes → un acontecimiento con ambas fuentes', () => {
  // Cada fuente normaliza por separado (como en el flujo real) y luego se
  // agrupa el conjunto global.
  const norm = [
    ...normalizeItems([raw('Titular largo y suficientemente detallado para agrupar', 'https://news.com/a?utm_source=feed', '2026-10-21T10:00:00.000Z')], { ...baseCtx, sourceId: 'bbc', sourceName: 'BBC' }),
    ...normalizeItems([raw('Titular largo y suficientemente detallado para agrupar', 'https://news.com/a', '2026-10-21T10:30:00.000Z')], { ...baseCtx, sourceId: 'f24', sourceName: 'F24' }),
  ];
  const { clusters, duplicateCount } = clusterItems(norm);
  assert.equal(clusters.length, 1);
  assert.equal(clusters[0].itemCount, 2);
  assert.equal(duplicateCount, 1);
  assert.deepEqual(clusters[0].sourceIds.sort(), ['bbc', 'f24']);
});

test('titulares idénticos largos con fechas cercanas en fuentes DIFERENTES → agrupados', () => {
  const title = 'Rusia dice que está lista para reanudar las conversaciones con Ucrania y Estados Unidos';
  const norm = [
    ...normalizeItems([raw(title, 'https://bbc.co.uk/x', '2026-10-21T10:00:00.000Z')], { ...baseCtx, sourceId: 'bbc', sourceName: 'BBC' }),
    ...normalizeItems([raw(title, 'https://france24.com/y', '2026-10-21T10:30:00.000Z')], { ...baseCtx, sourceId: 'f24', sourceName: 'F24' }),
  ];
  const { clusters, duplicateCount } = clusterItems(norm);
  assert.equal(clusters.length, 1, 'debería agrupar');
  assert.equal(duplicateCount, 1);
  assert.deepEqual(clusters[0].sourceIds.sort(), ['bbc', 'f24']);
});

test('mismo titular pero fechas separadas (24 h) → NO se confunden acontecimientos', () => {
  const title = 'Elecciones parlamentarias en el país vecino celebradas este domingo';
  const norm = [
    ...normalizeItems([raw(title, 'https://a.com/e1', '2026-10-20T10:00:00.000Z')], { ...baseCtx, sourceId: 'a' }),
    ...normalizeItems([raw(title, 'https://b.com/e2', '2026-10-21T10:00:00.000Z')], { ...baseCtx, sourceId: 'b' }),
  ];
  const { clusters } = clusterItems(norm);
  assert.equal(clusters.length, 2, 'acontecimientos distintos por fecha');
});

test('titular corto que comparte palabras NO agrupa', () => {
  const norm = [
    ...normalizeItems([raw('Congreso aprueba presupuesto', 'https://a.com/p1', '2026-10-21T10:00:00.000Z')], { ...baseCtx, sourceId: 'a' }),
    ...normalizeItems([raw('Congreso aprueba impuestos', 'https://b.com/p2', '2026-10-21T10:10:00.000Z')], { ...baseCtx, sourceId: 'b' }),
  ];
  const { clusters } = clusterItems(norm);
  assert.equal(clusters.length, 2, 'los titulares cortos no agrupan por palabras clave');
});

/* ------------------------------------------------------------------ */
console.log('\n[5] Puntuación editorial (con factores explicados)');
test('recencia, multi-fuente y coincidencia con la búsqueda suman factores', () => {
  const recient = new Date(Date.now() - 3_600_000).toISOString(); // hace 1 h
  const norm = normalizeItems(
    [
      raw('Nueva regulación de la inteligencia artificial en Europa entra en vigor', 'https://a.com/r1', recient),
    ],
    { ...baseCtx, sourceId: 'a', sourceName: 'A' },
  );
  // segunda fuente con URLs distintas → dos clusters por URL; forzamos la
  // agrupación por título idéntico + fechas cercanas:
  const { items, clusters } = clusterItems([
    ...norm,
    ...normalizeItems([raw('Nueva regulación de la inteligencia artificial en Europa entra en vigor', 'https://b.com/r2', new Date(Date.now() - 1_800_000).toISOString())], { ...baseCtx, sourceId: 'b', sourceName: 'B' }),
  ]);
  scoreItems(items, clusters, 'inteligencia artificial');
  const it = items[0];
  assert.ok(it.score > 40, `score esperado alto, obtuve ${it.score}`);
  assert.ok(it.score <= 100);
  assert.ok(it.scoreFactors.some((f) => /reciente/i.test(f)), 'factor de recencia');
  assert.ok(it.scoreFactors.some((f) => /fuentes independientes/i.test(f)), 'factor multifuente');
  assert.ok(it.scoreFactors.some((f) => /relacionado con la b\xfasqueda/i.test(f)), 'factor de relevancia');
});

test('orden por fecha y por puntuación', () => {
  const norm = normalizeItems(
    [
      raw('Titular viejo de un acontecimiento internacional ampliamente cubierto', 'https://a.com/old', '2026-10-14T10:00:00.000Z'),
      raw('Titular reciente de un acontecimiento internacional ampliamente cubierto', 'https://a.com/new', '2026-10-21T11:00:00.000Z'),
    ],
    baseCtx,
  );
  const { items, clusters } = clusterItems(norm);
  scoreItems(items, clusters, 'acontecimiento internacional');
  const byDate = sortItems(items, 'date');
  assert.ok(byDate[0].url.endsWith('/new'), 'por fecha: el nuevo primero');
  const byScore = sortItems(items, 'score');
  assert.ok(byScore[0].score >= byScore[1].score);
});

/* ------------------------------------------------------------------ */
console.log('\n[6] Guard SSRF');
test('permite URLs públicas http(s)', () => {
  assert.ok(assertSafeOutboundUrl('https://api.gdeltproject.org/api/v2/doc/doc?query=x'));
  assert.ok(assertSafeOutboundUrl('http://example.org/feed.xml'));
});

test('bloquea metadata de cloud, privadas, localhost, .internal, ftp y credenciales', () => {
  const blocked = [
    'http://169.254.169.254/latest/meta-data/',
    'http://10.0.0.8/x',
    'http://192.168.1.1/x',
    'http://127.0.0.1:8787/',
    'https://localhost/feed',
    'http://servidor.internal/feed',
    'ftp://example.org/file',
    'https://user:pass@example.org/feed',
    'https://[::1]/feed',
  ];
  for (const url of blocked) {
    assert.throws(() => assertSafeOutboundUrl(url), SsrfError, `debería bloquear ${url}`);
  }
});

test('allowlist de dominios: exacta, subdominio, lista vacía y ajenos', () => {
  const list = 'bbc.co.uk, un.org';
  assert.ok(isDomainAllowlisted('bbc.co.uk', list));
  assert.ok(isDomainAllowlisted('feeds.bbci.co.uk', list) === false, 'bbci.co.uk no está listado');
  assert.ok(isDomainAllowlisted('news.un.org', list), 'subdominio de un.org');
  assert.equal(isDomainAllowlisted('evil.com', list), false);
  assert.equal(isDomainAllowlisted('bbc.co.uk', ''), false, 'lista vacía = todo cerrado');
  assert.equal(isDomainAllowlisted('bbc.co.uk', undefined), false);
});

/* ------------------------------------------------------------------ */
console.log('\n[7] Parser RSS/Atom');
const RSS_SAMPLE = `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <item>
    <title><![CDATA[Titular RSS con & ampersand]]></title>
    <link>https://medio.org/noticia/1?utm_source=rss</link>
    <pubDate>Tue, 21 Oct 2026 10:00:00 GMT</pubDate>
    <description><![CDATA[<p>Fragmento original del medio</p>]]></description>
    <dc:creator>Redacción</dc:creator>
    <media:thumbnail url="https://medio.org/foto.jpg"/>
  </item>
</channel></rss>`;

const ATOM_SAMPLE = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>Atom entry title</title>
    <link rel="alternate" href="https://org.int/entry/9"/>
    <published>2026-10-21T09:00:00Z</published>
    <summary>Resumen del entry</summary>
    <author><name>Agencia ONU</name></author>
  </entry>
</feed>`;

test('RSS: extrae título, enlace, fecha, fragmento, autor e imagen', () => {
  const items = parseFeed(RSS_SAMPLE, 'es', 10, 'titular');
  assert.equal(items.length, 1);
  const it = items[0];
  assert.equal(it.title, 'Titular RSS con & ampersand');
  assert.equal(it.url, 'https://medio.org/noticia/1?utm_source=rss');
  assert.equal(it.author, 'Redacción');
  assert.equal(it.imageUrl, 'https://medio.org/foto.jpg');
  assert.ok(it.publishedAt?.startsWith('2026-10-21T10:00'));
  assert.ok(it.snippet?.includes('Fragmento original'));
});

test('Atom: usa link href y published', () => {
  const items = parseFeed(ATOM_SAMPLE, 'en', 10, 'atom');
  assert.equal(items.length, 1);
  assert.equal(items[0].url, 'https://org.int/entry/9');
  assert.ok(items[0].publishedAt?.startsWith('2026-10-21T09:00'));
  assert.equal(items[0].author, 'Agencia ONU');
});

test('el filtro de búsqueda del feed es por tokens (sin consulta devuelve todo)', () => {
  assert.equal(parseFeed(RSS_SAMPLE, 'es', 10, 'zzzzsincoincidencia').length, 0);
  assert.equal(parseFeed(RSS_SAMPLE, 'es', 10, '').length, 1);
  assert.equal(parseFeed(RSS_SAMPLE, 'es', 10, 'ampersand').length, 1);
});

/* ------------------------------------------------------------------ */
console.log('\n[8] Traducción automática de hallazgos');

test('el prompt incluye el texto a traducir, la meta JSON y la consigna de fidelidad', () => {
  const { system, user } = buildTranslationPrompt({
    title: 'Government unveils new AI rules',
    snippet: 'The cabinet approved the bill on Tuesday.',
  });
  assert.match(system, /AL ESPAÑOL/i);
  assert.match(system, /SOLO JSON/i);
  assert.match(system, /no resumas/i);
  assert.match(system, /no añadas|no añad/i);
  const sent = JSON.parse(user) as { title: string; snippet: string };
  assert.equal(sent.title, 'Government unveils new AI rules');
  assert.equal(sent.snippet, 'The cabinet approved the bill on Tuesday.');
});

test('parseTranslationResponse acepta JSON limpio y recorta longitudes', () => {
  const long = 'x'.repeat(5000);
  const out = parseTranslationResponse(JSON.stringify({ title: long, snippet: 'ok' }));
  assert.ok(out);
  assert.equal(out.title.length, 300);
  assert.equal(out.snippet, 'ok');
});

test('parseTranslationResponse acepta JSON cercado por markdown o texto', () => {
  const fenced = '```json\n{"title":"Titular traducido","snippet":"Fragmento."}\n```';
  const a = parseTranslationResponse(fenced);
  assert.equal(a?.title, 'Titular traducido');
  const chatty = 'Aquí tienes la traducción: {"title":"Titular","snippet":"Breve"} ¡espero que sirva!';
  const b = parseTranslationResponse(chatty);
  assert.equal(b?.title, 'Titular');
  assert.equal(b?.snippet, 'Breve');
});

test('parseTranslationResponse es tolerante a saltos de línea y devuelve null si no hay titular', () => {
  const out = parseTranslationResponse('{"title":"  Titular\\n  con espacios  ","snippet":""}');
  assert.equal(out?.title, 'Titular con espacios');
  assert.equal(out?.snippet, undefined, 'snippet vacío → undefined');
  assert.equal(parseTranslationResponse('{"snippet":"sin titular"}'), null);
  assert.equal(parseTranslationResponse('{"title":""}'), null);
  assert.equal(parseTranslationResponse('texto sin json'), null);
  assert.equal(parseTranslationResponse('{"title":"sin cerrar"'), null, 'JSON truncado → null');
  assert.equal(parseTranslationResponse(''), null);
});

/* ------------------------------------------------------------------ */
console.log('\n[9] Verificación de ID token de Google (rutas sin red)');

async function atest(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

const b64u = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString('base64url');

await atest('tokens malformados → invalid sin tocar la red', async () => {
  assert.deepEqual(await verifyGoogleIdToken('no-es-jwt'), { ok: false, reason: 'invalid' });
  assert.deepEqual(await verifyGoogleIdToken(''), { ok: false, reason: 'invalid' });
  assert.deepEqual(await verifyGoogleIdToken('a.b.c'), { ok: false, reason: 'invalid' });
});

await atest('alg distinto de RS256 → invalid', async () => {
  const header = b64u({ alg: 'HS256' });
  const payload = b64u({ iss: 'https://securetoken.google.com/p', exp: 9_999_999_999 });
  assert.deepEqual(await verifyGoogleIdToken(`${header}.${payload}.sig`), {
    ok: false,
    reason: 'invalid',
  });
});

await atest('issuer no-firebase → invalid', async () => {
  const header = b64u({ alg: 'RS256' });
  const payload = b64u({ iss: 'https://example.com', exp: 9_999_999_999 });
  assert.deepEqual(await verifyGoogleIdToken(`${header}.${payload}.sig`), {
    ok: false,
    reason: 'invalid',
  });
});

await atest('exp caducado → invalid', async () => {
  const header = b64u({ alg: 'RS256' });
  const payload = b64u({ iss: 'https://securetoken.google.com/p', exp: 1_000_000_000 });
  assert.deepEqual(await verifyGoogleIdToken(`${header}.${payload}.sig`), {
    ok: false,
    reason: 'invalid',
  });
});

/* ------------------------------------------------------------------ */
console.log(`\n${passed} pruebas superadas${process.exitCode ? ' (CON FALLOS)' : ''}.`);
