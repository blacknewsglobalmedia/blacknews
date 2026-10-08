/**
 * BLACKNEWS — Redacción asistida con OpenRouter (Cloudflare Workers).
 *
 *   POST /api/ai/generate  { categories, countries, content }
 *   → { success: true, data: { content, tweet } }
 *
 * El navegador manda el contenido editorial actual y los catálogos VIGENTES
 * del medio (secciones y países), así que si mañana se añade o se quita una
 * sección en «Gestión de Categorías» el modelo la ve sin tocar código. La
 * llamada a OpenRouter sale de aquí con `OPENROUTER_API_KEY` (secreto de
 * Wrangler con `npx wrangler secret put`); la clave nunca llega al bundle,
 * igual que las de PayPal.
 *
 * El cliente es quien valida la respuesta contra sus catálogos (sección que
 * exista, países con código del catálogo) y quien fusiona `content` con su
 * configuración actual para obtener el JSON completo. Aquí sólo se comprueba
 * forma y longitud, para que un modelo enfático no devuelva campos infinitos.
 */

export interface AiEnv {
  /** Obligatoria en producción: `npx wrangler secret put OPENROUTER_API_KEY` */
  OPENROUTER_API_KEY?: string;
  /** Modelo (wrangler.jsonc → vars.OPENROUTER_MODEL) */
  OPENROUTER_MODEL?: string;
  /** SOLO pruebas locales: apunta a un OpenRouter simulado */
  OPENROUTER_API_BASE?: string;
}

const DEFAULT_MODEL = 'openai/gpt-4o-mini';
const OPENROUTER_API = 'https://openrouter.ai/api/v1';
const TWEET_LIMIT = 250;

const LIMITS = {
  categories: 80, // nº de secciones habilitadas
  categoryLen: 60,
  countries: 220, // nº de países del catálogo
  countryLen: 60,
  title: 400,
  description: 420,
  photoCaption: 120,
  systemChars: 4000,
  userChars: 12000,
  maxTokens: 1400,
  timeoutMs: 45000,
};

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

// ── Límite por IP (por aislamiento) ─────────────────────────────────────
// /api/ai/* cuesta dinero en cada llamada: sin techo, cualquiera con la URL
// podría vaciarle la recarga de crédito a OpenRouter. 14 peticiones/min por
// IP dejan sobrado el uso normal del generador.
const RATE = { windowMs: 60_000, max: 14 };
const hits = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < RATE.windowMs);
  if (recent.length >= RATE.max) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  // Evita que el Map crezca sin límite dentro del aislamiento.
  if (hits.size > 400) {
    for (const [key, times] of hits) {
      if (times.every((t) => now - t >= RATE.windowMs)) hits.delete(key);
    }
  }
  return false;
}

function clientIp(request: Request): string {
  const cf = request.headers.get('cf-connecting-ip');
  if (cf) return cf;
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return 'anon';
}

// ── Normalización de la petición ────────────────────────────────────────

interface AiCountry {
  code: string;
  name: string;
}

function stringList(value: unknown, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const text = item.trim().slice(0, maxLen);
    if (!text || out.includes(text)) continue;
    out.push(text);
    if (out.length >= maxItems) break;
  }
  return out;
}

function countryList(value: unknown): AiCountry[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: AiCountry[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const code =
      typeof rec.code === 'string' ? rec.code.trim().toUpperCase().slice(0, 8) : '';
    const name =
      typeof rec.name === 'string' ? rec.name.trim().slice(0, LIMITS.countryLen) : '';
    if (!code || !name || seen.has(code)) continue;
    seen.add(code);
    out.push({ code, name });
    if (out.length >= LIMITS.countries) break;
  }
  return out;
}

interface AiContent {
  title: string;
  description: string;
  category: string;
  photoCaption: string;
  selectedCountries: AiCountry[];
}

function readContent(value: unknown): AiContent {
  const rec =
    value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const text = (key: string, max: number): string =>
    typeof rec[key] === 'string' ? (rec[key] as string).trim().slice(0, max) : '';
  return {
    title: text('title', LIMITS.title),
    description: text('description', LIMITS.description),
    category: text('category', LIMITS.categoryLen),
    photoCaption: text('photoCaption', LIMITS.photoCaption),
    selectedCountries: countryList(rec.selectedCountries),
  };
}

// ── Prompts ─────────────────────────────────────────────────────────────
// Las listas se meten en cada llamada: son la fuente de verdad del medio y
// cambian sin desplegar nada nuevo.

function buildSystemPrompt(): string {
  return [
    'Eres el redactor jefe de BLACKNEWS, una agencia de noticias internacional en español.',
    'Te encargan reescribir el contenido editorial de una publicación para redes y devolver también su tuit.',
    'Respondes SIEMPRE en español neutro, sobrio y rotundo, con tono de agencia: sin relleno y sin adjetivos de más.',
    '',
    'Devuelve EXCLUSIVAMENTE un objeto JSON válido. Nada de markdown, ni bloques "```", ni texto antes o después.',
    'La forma es exactamente esta:',
    '{"content":{"title":"...","description":"...","category":"...","photoCaption":"...","selectedCountries":[{"code":"ES","name":"España"}]},"tweet":"..."}',
    '',
    'REGLAS DEL CONTENIDO',
    '- "title": titular del post. De 3 a 6 líneas cortas separadas por \\n, para que el texto encaje en el lienzo. Conserva el ángulo y la longitud del titular actual.',
    '- "description": bajada de 1 o 2 frases en UNA sola línea, máximo 220 caracteres.',
    '- "category": EXACTAMENTE una de las secciones de la lista que te doy, copiada carácter a carácter, con sus acentos y su "&". Nunca inventes una sección ni le cambies el formato.',
    '- "photoCaption": pie o crédito de foto de máximo 60 caracteres, o "" si no procede.',
    '- "selectedCountries": de 0 a 4 países tomados EXCLUSIVEMENTE del catálogo que te doy, con el mismo "code" y el mismo "name". Ordénalos por relevancia de la noticia. Si no procede, devuelve [].',
    '',
    `REGLAS DEL TWEET (plantilla fija, 5 líneas, máximo ${TWEET_LIMIT} caracteres en total contando los saltos de línea)`,
    'L1: el titular en MAYÚSCULAS y en UNA sola línea',
    'L2: línea vacía',
    'L3: la bajada en UNA sola línea',
    'L4: línea vacía',
    'L5: los países en minúscula normal separados por " · " y, si hay países, seguidos de " · " y de la SECCIÓN EDITORIAL en MAYÚSCULAS. Si no hay países, L5 es sólo la SECCIÓN en MAYÚSCULAS.',
    `Si te pasas de ${TWEET_LIMIT} caracteres, acorta en este orden: primero L3 (bajada), después L5 (países) y sólo al final L1 (titular). Nunca cambies el orden de las líneas ni añadas nada fuera de la plantilla.`,
    'Sin emojis, sin hashtags, sin enlaces, sin comillas y sin caracteres decorativos.',
  ].join('\n');
}

function buildUserPrompt(
  categories: string[],
  countries: AiCountry[],
  content: AiContent,
  selection: AiCountry[],
): string {
  const countryListText =
    countries.length > 0
      ? countries.map((c) => `${c.code}=${c.name}`).join(', ')
      : '(vacío)';
  return [
    'SECCIONES HABILITADAS (elige exactamente una para "category"):',
    categories.map((c) => `- ${c}`).join('\n'),
    '',
    'CATÁLOGO DE PAÍSES PERMITIDO (sólo puedes usar estos code y name):',
    countryListText,
    '',
    'CONTENIDO EDITORIAL ACTUAL DEL GENERADOR:',
    `- titular: ${content.title || '(vacío)'}`,
    `- bajada: ${content.description || '(vacía)'}`,
    `- sección: ${content.category || '(sin asignar)'}`,
    `- pie de foto: ${content.photoCaption || '(sin pie)'}`,
    `- países seleccionados: ${
      selection.length ? selection.map((c) => c.name).join(', ') : '(ninguno)'
    }`,
    '',
    'Reescribe el contenido con criterio editorial. Mantén los hechos, las entidades, las cifras y los topónimos tal como están y no añadas datos que no estén en el texto.',
  ].join('\n');
}

// ── Respuesta del modelo ────────────────────────────────────────────────

function parseModelJson(raw: string): { content: AiContent; tweet: string } {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const text = fenced ? fenced[1] : raw;
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) {
    throw new Error('La IA no devolvió JSON.');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new Error('La IA devolvió un JSON que no se puede leer.');
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('La IA devolvió una respuesta inesperada.');
  }
  const rec = parsed as Record<string, unknown>;
  if (!rec.content || typeof rec.content !== 'object') {
    throw new Error('La IA no devolvió el bloque "content".');
  }
  return {
    content: readContent(rec.content),
    tweet: typeof rec.tweet === 'string' ? rec.tweet : '',
  };
}

function openrouterError(status: number, body: string): string {
  if (status === 401) return 'Clave de OpenRouter inválida (OPENROUTER_API_KEY).';
  if (status === 402) return 'Sin crédito en OpenRouter: revisa el saldo de tu cuenta.';
  if (status === 404) return 'Modelo no encontrado en OpenRouter. Revisa OPENROUTER_MODEL.';
  if (status === 413) return 'El contenido enviado es demasiado largo para el modelo.';
  if (status === 429) {
    return 'Límite de peticiones de OpenRouter alcanzado: espera unos segundos y reintenta.';
  }
  if (status >= 500) return 'OpenRouter está caído o devolvió un error interno.';
  const match = body.match(/"message"\s*:\s*"([^"]{1,180})"/);
  return match ? `OpenRouter: ${match[1]}` : `OpenRouter respondió ${status}.`;
}

// ── Handler ─────────────────────────────────────────────────────────────

export async function handleAiGenerate(request: Request, env: AiEnv): Promise<Response> {
  if (!env.OPENROUTER_API_KEY) {
    return json(
      {
        success: false,
        error:
          'Falta la clave de OpenRouter. Ejecuta `npx wrangler secret put OPENROUTER_API_KEY` en el proyecto (en local, OPENROUTER_API_KEY en .env o .dev.vars).',
      },
      503,
    );
  }

  const ip = clientIp(request);
  if (isRateLimited(ip)) {
    return json(
      { success: false, error: 'Demasiadas peticiones: espera un minuto y reintenta.' },
      429,
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, error: 'El cuerpo de la petición no es JSON válido.' }, 400);
  }

  const categories = stringList(body.categories, LIMITS.categories, LIMITS.categoryLen);
  if (categories.length === 0) {
    return json(
      { success: false, error: 'No hay secciones habilitadas en el generador.' },
      400,
    );
  }

  const countries = countryList(body.countries);
  const content = readContent(body.content);

  const base = (env.OPENROUTER_API_BASE || OPENROUTER_API).replace(/\/+$/, '');
  const origin = new URL(request.url).origin;
  const model = (env.OPENROUTER_MODEL || DEFAULT_MODEL).trim() || DEFAULT_MODEL;

  let upstream: Response;
  try {
    upstream = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        'http-referer': origin,
        'x-title': 'BLACKNEWS',
      },
      body: JSON.stringify({
        model,
        temperature: 0.7,
        max_tokens: LIMITS.maxTokens,
        messages: [
          { role: 'system', content: buildSystemPrompt().slice(0, LIMITS.systemChars) },
          {
            role: 'user',
            content: buildUserPrompt(categories, countries, content, content.selectedCountries).slice(
              0,
              LIMITS.userChars,
            ),
          },
        ],
      }),
      signal: AbortSignal.timeout(LIMITS.timeoutMs),
    });
  } catch (err) {
    const timedOut = err instanceof Error && /timeout|abort/i.test(err.name + err.message);
    return json(
      {
        success: false,
        error: timedOut
          ? 'OpenRouter no respondió a tiempo. Reintenta en unos segundos.'
          : 'No se pudo conectar con OpenRouter.',
      },
      504,
    );
  }

  const rawBody = await upstream.text();
  if (!upstream.ok) {
    console.error('[BLACKNEWS WORKER] ai:', upstream.status, rawBody.slice(0, 300));
    return json({ success: false, error: openrouterError(upstream.status, rawBody) }, 502);
  }

  let payload: { choices?: Array<{ message?: { content?: unknown } }> };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json({ success: false, error: 'OpenRouter devolvió una respuesta ilegible.' }, 502);
  }

  const message = payload.choices?.[0]?.message?.content;
  if (typeof message !== 'string' || !message.trim()) {
    return json({ success: false, error: 'El modelo no devolvió contenido.' }, 502);
  }

  try {
    const { content: aiContent, tweet } = parseModelJson(message);
    return json({
      success: true,
      data: {
        content: aiContent,
        // Sin cortar: el largo real lo muestra (y avisa) el cliente, que es
        // quien aplica el tope de 250 caracteres del usuario.
        tweet,
        model,
      },
    });
  } catch (err) {
    const message2 = err instanceof Error ? err.message : 'Respuesta de la IA ilegible.';
    return json({ success: false, error: message2 }, 502);
  }
}
