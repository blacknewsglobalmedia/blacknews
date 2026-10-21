/**
 * BLACKNEWS OSINT — Conectores de fuentes.
 *
 * Un conector por tipo de proveedor. Todos salen por el guard SSRF y
 * sólo devuelven datos ORIGINALES de la fuente (titular, enlace, fecha,
 * fragmento tal cual lo publica el proveedor). No se inventa nada: si un
 * campo no viene, queda undefined.
 */
import type { OsintSourceConfig } from '../../src/types/osint';
import { assertSafeOutboundUrl } from './ssrf';

export interface OsintEnvLike {
  TAVILY_API_KEY?: string;
  OSINT_RSS_ALLOWLIST?: string;
}

export interface ConnectorContext {
  env: OsintEnvLike;
  config: OsintSourceConfig;
  query: string;
  from: Date;
  to: Date;
  max: number;
  languages?: string[];
}

export interface RawFetch {
  items: Array<{
    title: string;
    url: string;
    snippet?: string;
    author?: string;
    publishedAt?: string;
    language?: string;
    country?: string;
    imageUrl?: string;
  }>;
  /** Cuota leída de cabeceras HTTP (sólo si el proveedor la devuelve). */
  quotaHeaders?: { remaining?: number; limit?: number };
}

export class ConnectorError extends Error {
  constructor(
    message: string,
    readonly kind: 'rate_limit' | 'network' | 'http' | 'parse' | 'setup' = 'http',
  ) {
    super(message);
  }
}

// ASCII estricto: un valor no-ASCII en una cabecera lanza TypeError en el
// runtime de producción (Workers sigue la spec de fetch del navegador).
const UA = 'BlackNews-OSINT/1.0 (redaction desk; contact: blacknewsglobalmedia@gmail.com)';
const TIMEOUT_MS = 12_000;

async function fetchText(url: string, init?: RequestInit): Promise<{ res: Response; text: string }> {
  assertSafeOutboundUrl(url); // guard SSRF en TODA salida
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: { 'user-agent': UA, ...(init?.headers || {}) },
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    const timedOut = err instanceof Error && /timeout|abort/i.test(err.name + err.message);
    throw new ConnectorError(
      timedOut ? 'Tiempo de espera agotado al consultar la fuente.' : 'No se pudo conectar con la fuente.',
      'network',
    );
  }
  if (res.status === 429) {
    const retry = res.headers.get('retry-after');
    throw new ConnectorError(
      `La fuente respondió límite de tasa (429)${retry ? `, reintento sugerido en ${retry} s` : ''}.`,
      'rate_limit',
    );
  }
  if (!res.ok) {
    throw new ConnectorError(`La fuente respondió HTTP ${res.status}.`, 'http');
  }
  return { res, text: await res.text() };
}

function readQuotaHeaders(res: Response): { remaining?: number; limit?: number } {
  const num = (h: string) => {
    const v = res.headers.get(h);
    const n = v ? Number(v) : NaN;
    return Number.isFinite(n) ? n : undefined;
  };
  return { remaining: num('x-ratelimit-remaining'), limit: num('x-ratelimit-limit') };
}

const GDELT_API = 'https://api.gdeltproject.org/api/v2/doc/doc';
const GDELT_LANG: Record<string, string> = {
  en: 'english', es: 'spanish', fr: 'french', de: 'german',
  pt: 'portuguese', ar: 'arabic', ru: 'russian', zh: 'chinese',
};
const LANG_NAME_TO_ISO: Record<string, string> = {
  english: 'en', spanish: 'es', french: 'fr', german: 'de',
  portuguese: 'pt', arabic: 'ar', russian: 'ru', chinese: 'zh',
};

function gdeltDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`;
}

/** `20261014T121530Z` → ISO 8601. */
function parseGdeltDate(s: string | undefined): string | undefined {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(s || '');
  if (!m) return undefined;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6])).toISOString();
}

export async function searchGdelt(ctx: ConnectorContext): Promise<RawFetch> {
  // GDELT admite un solo sourcelang por consulta; con varios idiomas se
  // pide sin filtro y se filtra después por el campo `language` real.
  const langIso = ctx.languages && ctx.languages.length === 1 ? ctx.languages[0] : undefined;
  const gdeltLang = langIso ? GDELT_LANG[langIso] : undefined;
  const query = `${ctx.query}${gdeltLang ? ` sourcelang:${gdeltLang}` : ''}`;
  const url =
    `${GDELT_API}?query=${encodeURIComponent(query)}` +
    `&mode=artlist&format=json&maxrecords=${Math.min(75, ctx.max)}` +
    `&startdatetime=${gdeltDate(ctx.from)}&enddatetime=${gdeltDate(ctx.to)}`;
  const { res, text } = await fetchText(url, { headers: { accept: 'application/json' } });
  let body: { articles?: Array<Record<string, string>> };
  try {
    body = JSON.parse(text);
  } catch {
    throw new ConnectorError('GDELT devolvió una respuesta ilegible.', 'parse');
  }
  const articles = (body.articles || []).filter((a) => a.url && a.title);
  return {
    items: articles.map((a) => ({
      title: a.title,
      url: a.url,
      publishedAt: parseGdeltDate(a.seendate),
      language: LANG_NAME_TO_ISO[(a.language || '').toLowerCase()],
      country: undefined, // sourcecountry viene como nombre, no ISO: no se inventa
      imageUrl: a.socialimage || undefined,
    })),
    quotaHeaders: readQuotaHeaders(res),
  };
}

/* ------------------------------------------------------------------ */
/* RSS / Atom                                                          */
/* ------------------------------------------------------------------ */

/** Feeds built-in: medios y organismos oficiales con URL pública estable. */
export const BUILTIN_RSS_FEEDS: Array<{ id: string; name: string; url: string; language: string }> = [
  { id: 'bbc-world', name: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', language: 'en' },
  { id: 'bbc-mundo', name: 'BBC Mundo', url: 'https://feeds.bbci.co.uk/mundo/rss.xml', language: 'es' },
  { id: 'dw-world', name: 'DW World', url: 'https://rss.dw.com/rdf/rss-en-all', language: 'en' },
  { id: 'france24-en', name: 'France 24 (EN)', url: 'https://www.france24.com/en/rss', language: 'en' },
  { id: 'un-news', name: 'UN News (ONU)', url: 'https://news.un.org/feed/', language: 'en' },
];

function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function firstTag(block: string, tag: string): string | undefined {
  const m = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i').exec(block);
  return m ? decodeEntities(m[1]).trim() : undefined;
}

function firstAttr(block: string, tag: string, attr: string): string | undefined {
  const m = new RegExp(`<${tag}[^>]*\\s${attr}=["']([^"']+)["']`, 'i').exec(block);
  return m ? decodeEntities(m[1]).trim() : undefined;
}

export function parseFeed(xml: string, feedLanguage: string, max: number, query: string): RawFetch['items'] {
  const blocks = xml.match(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi) || [];
  const qTokens = query
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/\s+/)
    .filter((t) => t.length > 2);
  const out: RawFetch['items'] = [];
  for (const block of blocks) {
    if (out.length >= max) break;
    const title = firstTag(block, 'title');
    const link = firstTag(block, 'link') || firstAttr(block, 'link', 'href');
    if (!title || !link || !/^https?:\/\//i.test(link)) continue; // nada sin enlace verificable
    const dateStr =
      firstTag(block, 'pubDate') || firstTag(block, 'published') || firstTag(block, 'updated');
    const publishedAt = dateStr ? new Date(dateStr).toISOString() : undefined;
    const snippet =
      firstTag(block, 'description') || firstTag(block, 'summary') || firstTag(block, 'content');
    const authorRaw =
      firstTag(block, 'dc:creator') || firstTag(block, 'author') || firstTag(block, 'name');
    // Atom envuelve el autor en <author><name>…</name></author>: se quitan
    // las etiquetas anidadas para quedarse con el nombre legible.
    const author = authorRaw?.replace(/<[^>]+>/g, '').trim() || undefined;
    const imageUrl =
      firstAttr(block, 'media:content', 'url') ||
      firstAttr(block, 'media:thumbnail', 'url') ||
      firstAttr(block, 'enclosure', 'url');
    // Filtro del buscador: coincidencia textual en el titular (o sin
    // consulta explícita se devuelven los últimos artículos del feed).
    if (qTokens.length > 0) {
      const haystack = `${title} ${snippet || ''}`
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      if (!qTokens.some((t) => haystack.includes(t))) continue;
    }
    out.push({ title, url: link, snippet, author, publishedAt, language: feedLanguage, imageUrl });
  }
  return out;
}

export async function searchRssFeed(
  feed: { name: string; url: string; language: string },
  ctx: ConnectorContext,
): Promise<RawFetch> {
  const { res, text } = await fetchText(feed.url, { headers: { accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml' } });
  const items = parseFeed(text, feed.language, ctx.max, ctx.query).filter((it) => {
    if (!it.publishedAt) return true; // sin fecha confiable no se descarta
    const t = Date.parse(it.publishedAt);
    return t >= ctx.from.getTime() && t <= ctx.to.getTime();
  });
  return { items, quotaHeaders: readQuotaHeaders(res) };
}

/* ------------------------------------------------------------------ */
/* OpenAlex (académico)                                                */
/* ------------------------------------------------------------------ */

function rebuildAbstract(inverted: Record<string, number[]> | undefined, limit = 600): string | undefined {
  if (!inverted) return undefined;
  const pairs: Array<[number, string]> = [];
  for (const [word, positions] of Object.entries(inverted)) {
    for (const p of positions) pairs.push([p, word]);
  }
  pairs.sort((a, b) => a[0] - b[0]);
  const text = pairs.map(([, w]) => w).join(' ');
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

export async function searchOpenAlex(ctx: ConnectorContext): Promise<RawFetch> {
  const from = ctx.from.toISOString().slice(0, 10);
  const to = ctx.to.toISOString().slice(0, 10);
  const url =
    `https://api.openalex.org/works?search=${encodeURIComponent(ctx.query)}` +
    `&filter=from_publication_date:${from},to_publication_date:${to}` +
    `&per-page=${Math.min(25, ctx.max)}`;
  const { res, text } = await fetchText(url, { headers: { accept: 'application/json' } });
  let body: { results?: Array<Record<string, unknown>> };
  try {
    body = JSON.parse(text);
  } catch {
    throw new ConnectorError('OpenAlex devolvió una respuesta ilegible.', 'parse');
  }
  const items: RawFetch['items'] = [];
  for (const w of body.results || []) {
    const title = (w.display_name as string) || '';
    const primary = w.primary_location as { landing_page_url?: string; source?: { display_name?: string } } | null;
    const oa = w.open_access as { oa_url?: string } | null;
    const url = (w.doi as string) || primary?.landing_page_url || oa?.oa_url;
    if (!title || !url) continue;
    const authors = (w.authorships as Array<{ author?: { display_name?: string } }> | undefined) || [];
    items.push({
      title,
      url,
      snippet: rebuildAbstract(w.abstract_inverted_index as Record<string, number[]> | undefined),
      author: authors.slice(0, 3).map((a) => a.author?.display_name).filter(Boolean).join('; ') || undefined,
      publishedAt: w.publication_date ? new Date(`${w.publication_date}T00:00:00Z`).toISOString() : undefined,
      language: (w.language as string) || undefined,
    });
  }
  return { items, quotaHeaders: readQuotaHeaders(res) };
}

/* ------------------------------------------------------------------ */
/* Wikidata SPARQL (entidades estructuradas)                           */
/* ------------------------------------------------------------------ */

export async function searchWikidata(ctx: ConnectorContext): Promise<RawFetch> {
  const safe = ctx.query.replace(/["\\]/g, ' ').slice(0, 120);
  const sparql = `
    SELECT ?item ?itemLabel ?itemDescription ?article ?articleLang WHERE {
      ?item rdfs:label ?itemLabel.
      FILTER(CONTAINS(LCASE(?itemLabel), "${safe.toLowerCase()}"))
      FILTER(LANG(?itemLabel) = "en")
      OPTIONAL {
        ?article schema:about ?item.
        ?article schema:inLanguage ?articleLang.
        ?article schema:isPartOf <https://en.wikipedia.org/>.
      }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en,es". }
    } LIMIT ${Math.min(25, ctx.max)}
  `;
  const { res, text } = await fetchText('https://query.wikidata.org/sparql', {
    method: 'POST',
    headers: {
      accept: 'application/sparql-results+json',
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: `query=${encodeURIComponent(sparql)}`,
  });
  let body: {
    results?: {
      bindings?: Array<Record<string, { value: string; 'xml:lang'?: string }>>;
    };
  };
  try {
    body = JSON.parse(text);
  } catch {
    throw new ConnectorError('Wikidata devolvió una respuesta ilegible.', 'parse');
  }
  const items: RawFetch['items'] = [];
  for (const b of body.results?.bindings || []) {
    const label = b.itemLabel?.value;
    const article = b.article?.value;
    if (!label) continue;
    const desc = b.itemDescription?.value;
    items.push({
      title: desc ? `${label} — ${desc}` : label,
      url: article || `https://www.wikidata.org/wiki/${(b.item?.value || '').split('/').pop()}`,
      snippet: desc
        ? `Entidad estructurada de Wikidata. Descripción original: ${desc}`
        : 'Entidad estructurada de Wikidata.',
      language: b.articleLang?.value || undefined,
    });
  }
  return { items, quotaHeaders: readQuotaHeaders(res) };
}

/* ------------------------------------------------------------------ */
/* Tavily (búsqueda web ya contratada por el proyecto)                 */
/* ------------------------------------------------------------------ */

export async function searchTavily(ctx: ConnectorContext): Promise<RawFetch> {
  const key = (ctx.env.TAVILY_API_KEY || '').trim();
  if (!key) {
    throw new ConnectorError('Falta el secreto TAVILY_API_KEY en el Worker.', 'setup');
  }
  const days =
    ctx.from.getTime() >= Date.now() - 24 * 3_600_000 ? 1 : ctx.from.getTime() >= Date.now() - 7 * 24 * 3_600_000 ? 7 : 30;
  const { res, text } = await fetchText('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({
      query: ctx.query.slice(0, 300),
      topic: 'news',
      time_range: days <= 1 ? 'd' : days <= 7 ? 'w' : 'm',
      max_results: Math.min(10, ctx.max),
      include_answer: false,
      include_raw_content: false,
    }),
  });
  let body: {
    results?: Array<{
      title?: string;
      url?: string;
      content?: string;
      published_date?: string;
    }>;
  };
  try {
    body = JSON.parse(text);
  } catch {
    throw new ConnectorError('Tavily devolvió una respuesta ilegible.', 'parse');
  }
  const items: RawFetch['items'] = [];
  for (const r of body.results || []) {
    if (!r.title || !r.url) continue;
    items.push({
      title: r.title,
      url: r.url,
      snippet: r.content || undefined,
      publishedAt: r.published_date ? new Date(r.published_date).toISOString() : undefined,
    });
  }
  return { items, quotaHeaders: readQuotaHeaders(res) };
}

/** Despacha al conector que corresponde al tipo de fuente. */
export async function runConnector(
  kind: OsintSourceConfig['kind'],
  ctx: ConnectorContext,
): Promise<RawFetch> {
  switch (kind) {
    case 'gdelt':
      return searchGdelt(ctx);
    case 'openalex':
      return searchOpenAlex(ctx);
    case 'wikidata':
      return searchWikidata(ctx);
    case 'tavily':
      return searchTavily(ctx);
    case 'rss': {
      const feeds = ctx.config.custom
        ? [{ name: ctx.config.name, url: ctx.config.url || '', language: ctx.config.languages[0] || '*' }]
        : BUILTIN_RSS_FEEDS.filter((f) =>
            ctx.config.languages.includes('*') || ctx.config.languages.includes(f.language),
          );
      const perFeed = Math.max(3, Math.ceil(ctx.max / Math.max(1, feeds.length)));
      const settled = await Promise.allSettled(
        feeds.map((feed) => searchRssFeed(feed, { ...ctx, max: perFeed })),
      );
      const merged: RawFetch = { items: [] };
      let failures = 0;
      let lastError: ConnectorError | null = null;
      for (const s of settled) {
        if (s.status === 'fulfilled') {
          merged.items.push(...s.value.items.slice(0, perFeed));
          if (s.value.quotaHeaders?.remaining !== undefined) merged.quotaHeaders = s.value.quotaHeaders;
        } else {
          failures++;
          if (s.reason instanceof ConnectorError) lastError = s.reason;
        }
      }
      // Si TODOS los feeds fallan, la fuente reporta error; si sólo
      // algunos, se devuelven los parciales (regla del módulo).
      if (merged.items.length === 0 && failures > 0 && failures === feeds.length && lastError) {
        throw lastError;
      }
      merged.items = merged.items.slice(0, ctx.max);
      return merged;
    }
    default:
      throw new ConnectorError(`Conector no soportado: ${kind}`, 'setup');
  }
}
