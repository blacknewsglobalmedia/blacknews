/**
 * BLACKNEWS — Redacción asistida: OpenRouter + búsqueda web (Cloudflare Workers).
 *
 *   POST /api/ai/generate  { text, categories, countries }
 *   → { success: true, data: { content, tweetBody, model, searched, sources, note } }
 *
 * El usuario escribe el tema o el texto de partida en el generador. Aquí se
 * busca información relacionada en la web (Tavily, opcional), se le pasa ese
 * material al modelo y se devuelven dos cosas:
 *
 *   - `content`: titular, bajada, sección, pie y países. El cliente lo fusiona
 *     con su configuración actual y obtiene el JSON completo listo para APLICAR.
 *   - `tweetBody`: SOLO el cuerpo del tweet. El corchete con las banderas, el
 *     «» y la firma «■ #BlackNews» los monta el navegador a partir de los
 *     países elegidos, para que las banderas siempre coincidan con las del post.
 *
 * Claves: `OPENROUTER_API_KEY` (modelo) y `TAVILY_API_KEY` (búsqueda), ambas
 * secretos de Wrangler con `npx wrangler secret put`; ninguna llega al bundle,
 * igual que las de PayPal. Sin clave de Tavily la llamada sigue funcionando,
 * sólo que sin fuentes, y el cliente lo avisa.
 *
 * El cliente es quien valida la respuesta contra sus catálogos (sección que
 * exista, países con código del catálogo). Aquí sólo se comprueba forma y
 * longitud, para que un modelo enfático no devuelva campos infinitos.
 */

export interface AiEnv {
  /** Binding nativo 100% GRATUITO de Cloudflare Workers AI (10.000 neuronas/día sin clave ni tarjeta) */
  AI?: any;
  /** Clave opcional de Google AI Studio (100% gratis, 1.500 peticiones/día sin tarjeta): `npx wrangler secret put GEMINI_API_KEY` */
  GEMINI_API_KEY?: string;
  /** Clave opcional de Groq Cloud (100% gratis, 14.400 peticiones/día sin tarjeta): `npx wrangler secret put GROQ_API_KEY` */
  GROQ_API_KEY?: string;
  /** Clave de OpenRouter: `npx wrangler secret put OPENROUTER_API_KEY` */
  OPENROUTER_API_KEY?: string;
  /** Modelo (wrangler.jsonc → vars.OPENROUTER_MODEL). */
  OPENROUTER_MODEL?: string;
  /** SOLO pruebas locales: apunta a un OpenRouter simulado */
  OPENROUTER_API_BASE?: string;
  /** Búsqueda web opcional: `npx wrangler secret put TAVILY_API_KEY` */
  TAVILY_API_KEY?: string;
  /** SOLO pruebas locales: apunta a un Tavily simulado */
  TAVILY_API_BASE?: string;
}

const DEFAULT_FREE_MODELS = [
  "nvidia/nemotron-3-super-120b-a12b:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "deepseek/deepseek-r1:free",
  "qwen/qwen-2.5-72b-instruct:free",
  "google/gemma-2-9b-it:free",
  "mistralai/mistral-7b-instruct:free",
  "meta-llama/llama-3.1-8b-instruct:free",
  "deepseek/deepseek-chat",
  "google/gemini-2.5-flash",
  "openai/gpt-4o-mini",
];

const DEFAULT_MODEL = DEFAULT_FREE_MODELS[0];
// Cuántos modelos de la cadena se prueban en una misma llamada. Cada uno se
// salta al siguiente si el anterior está saturado (429), caído (5xx), se queda
// sin contenido o devuelve el JSON roto. El tope evita encadenar fallos
// lentos (timeouts de 90 s) durante demasiado tiempo.
const MAX_MODEL_TRIES = 4;
const OPENROUTER_API = "https://openrouter.ai/api/v1";
const TAVILY_API = "https://api.tavily.com";

function parseModelChain(envModel?: string): string[] {
  if (!envModel || !envModel.trim()) {
    return DEFAULT_FREE_MODELS;
  }
  const custom = envModel
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (custom.length === 0) return DEFAULT_FREE_MODELS;
  const chain = [...custom];
  for (const fallback of DEFAULT_FREE_MODELS) {
    if (!chain.includes(fallback)) {
      chain.push(fallback);
    }
  }
  return chain;
}

const LIMITS = {
  categories: 80, // nº de secciones habilitadas
  categoryLen: 60,
  countries: 220, // nº de países del catálogo
  countryLen: 60,
  title: 400,
  description: 420,
  photoCaption: 120,
  topic: 4000, // texto de partida que escribe el usuario
  sources: 5, // resultados de búsqueda que se mandan al modelo
  snippet: 900, // recorte de cada resultado
  systemChars: 6000,
  userChars: 24000,
  maxTokens: 4000,
  // Los modelos gratuitos van despacio: 90 s antes de rendirse.
  timeoutMs: 90000,
  searchTimeoutMs: 20000,
};

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

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
  const cf = request.headers.get("cf-connecting-ip");
  if (cf) return cf;
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return "anon";
}

function timedOut(err: unknown): boolean {
  return err instanceof Error && /timeout|abort/i.test(err.name + err.message);
}

// ── Normalización de la petición ────────────────────────────────────────

interface AiCountry {
  code: string;
  name: string;
}

function stringList(
  value: unknown,
  maxItems: number,
  maxLen: number,
): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
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
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const code =
      typeof rec.code === "string"
        ? rec.code.trim().toUpperCase().slice(0, 8)
        : "";
    const name =
      typeof rec.name === "string"
        ? rec.name.trim().slice(0, LIMITS.countryLen)
        : "";
    if (!code || !name || seen.has(code)) continue;
    seen.add(code);
    out.push({ code, name });
    if (out.length >= LIMITS.countries) break;
  }
  return out;
}

function readTopic(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/\r\n/g, "\n").trim().slice(0, LIMITS.topic);
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
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const text = (key: string, max: number): string =>
    typeof rec[key] === "string"
      ? (rec[key] as string).trim().slice(0, max)
      : "";
  return {
    title: text("title", LIMITS.title),
    description: text("description", LIMITS.description),
    category: text("category", LIMITS.categoryLen),
    photoCaption: text("photoCaption", LIMITS.photoCaption),
    selectedCountries: countryList(rec.selectedCountries),
  };
}

// ── Búsqueda web (Tavily, opcional) ─────────────────────────────────────
// Se hace aquí y no con las herramientas de búsqueda del propio OpenRouter
// porque (a) los modelos gratuitos soportan mal las herramientas de servidor,
// (b) el resultado se puede enseñar al redactor, y (c) así el coste de la
// búsqueda es el de la capa gratuita de Tavily (1.000/mes) y no por uso.

interface AiSource {
  title: string;
  url: string;
  snippet: string;
}

interface SearchOutcome {
  sources: AiSource[];
  searched: boolean;
  note?: string;
}

async function webSearch(topic: string, env: AiEnv): Promise<SearchOutcome> {
  const key = (env.TAVILY_API_KEY || "").trim();
  if (!key) {
    return {
      sources: [],
      searched: false,
      note: "Sin búsqueda web (falta la clave TAVILY_API_KEY): la IA redacta sólo con tu texto.",
    };
  }

  const base = (env.TAVILY_API_BASE || TAVILY_API).replace(/\/+$/, "");
  let res: Response;
  try {
    res = await fetch(`${base}/search`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        query: topic.replace(/\s+/g, " ").trim().slice(0, 300),
        max_results: LIMITS.sources,
        include_answer: false,
        include_raw_content: false,
      }),
      signal: AbortSignal.timeout(LIMITS.searchTimeoutMs),
    });
  } catch (err) {
    return {
      sources: [],
      searched: false,
      note: timedOut(err)
        ? "La búsqueda web no respondió a tiempo: se redacta sólo con tu texto."
        : "No se pudo conectar con la búsqueda web: se redacta sólo con tu texto.",
    };
  }

  const raw = await res.text();
  if (!res.ok) {
    console.error("[BLACKNEWS WORKER] tavily:", res.status, raw.slice(0, 200));
    return {
      sources: [],
      searched: false,
      note: `La búsqueda web falló (Tavily ${res.status}): se redacta sólo con tu texto.`,
    };
  }

  let payload: { results?: unknown };
  try {
    payload = JSON.parse(raw);
  } catch {
    return {
      sources: [],
      searched: false,
      note: "La búsqueda web devolvió una respuesta ilegible.",
    };
  }

  const list = Array.isArray(payload.results) ? payload.results : [];
  const sources: AiSource[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const url = typeof rec.url === "string" ? rec.url.trim().slice(0, 300) : "";
    if (!url) continue;
    sources.push({
      title:
        typeof rec.title === "string" ? rec.title.trim().slice(0, 200) : url,
      url,
      snippet:
        typeof rec.content === "string"
          ? rec.content.replace(/\s+/g, " ").trim().slice(0, LIMITS.snippet)
          : "",
    });
    if (sources.length >= LIMITS.sources) break;
  }

  if (sources.length === 0) {
    return {
      sources: [],
      searched: true,
      note: "La búsqueda no encontró resultados relacionados: se redacta sólo con tu texto.",
    };
  }
  return { sources, searched: true };
}

// ── Prompts ─────────────────────────────────────────────────────────────
// Las listas se meten en cada llamada: son la fuente de verdad del medio y
// cambian sin desplegar nada nuevo.

function buildSystemPrompt(hasSources: boolean): string {
  return [
    "Eres el redactor jefe de BLACKNEWS, una agencia de noticias internacional en español.",
    "Te pasan un tema de partida y, si los hay, resultados de búsqueda en la web; redactas la publicación y el cuerpo de su tweet.",
    "Respondes SIEMPRE en español neutro, sobrio y rotundo, con tono de agencia: sin relleno y sin adjetivos de más.",
    "",
    'Devuelve EXCLUSIVAMENTE un objeto JSON válido. Nada de markdown, ni bloques "```", ni texto antes o después.',
    "La forma es exactamente esta:",
    '{"content":{"title":"...","description":"...","category":"...","photoCaption":"...","selectedCountries":[{"code":"ES","name":"España"}]},"tweetBody":"..."}',
    "",
    "REGLAS DEL CONTENIDO",
    '- Los tres textos ("title", "description" y "tweetBody") van juntos en la misma publicación y la persona los lee los tres: son COMPLEMENTARIOS, no tres versiones de la misma noticia.',
    '- Reparto obligatorio: "title" = QUÉ pasa (el hecho nuclear). "description" = DATOS Y CONTEXTO (fecha, cifras, quién, por qué, consecuencia inmediata). "tweetBody" = ÁNGULO COMPLEMENTARIO (reacción, implicación, lo que viene ahora o un dato que no aparece en los otros dos).',
    "- PROHIBIDO repetir: ninguna secuencia de 5 palabras seguidas puede aparecer en dos campos distintos, ni el mismo dato contado con sinónimos. Si el titular ya lo dijo, la bajada y el tweet no lo vuelven a decir: aportan otro dato. Si algo no cabe, córtalo antes que repetirlo.",
    "- Los tres textos tratan el MISMO hecho: si el titular es del cierre de Ormuz, la bajada y el tweet son también de ese cierre, no de otra noticia del mismo tema.",
    '- "title": titular con su grafía normal: primera letra de cada frase en mayúscula y el resto en minúscula. NUNCA en mayúsculas completas. EXACTAMENTE 3 líneas separadas por \\n (nunca 1, nunca 4), cada una de 4 o 5 palabras y unos 25 caracteres, entre 55 y 75 en total. Ejemplo: "Irán cierra el estrecho\\nde Ormuz tras los ataques\\nde Israel y EE.UU.". Mal ejemplo: una sola línea o dos de 32 caracteres: la columna es estrecha y el texto se parte y se sale encima de la foto. El titular dice el hecho; no lo desarrolles, eso va en la bajada.',
    '- "description": bajada de 1 o 2 frases EN UNA sola línea, sin \\n, entre 120 y 170 caracteres: vienen a ser 3 líneas pintadas. Datos concretos que NO estén ya en el titular (cifras, fecha, consecuencia) y grafía normal. No la acortes: una sola línea de 60 caracteres desperdicia el sitio.',
    '- "category": EXACTAMENTE una de las secciones de la lista que te doy, copiada carácter a carácter, con sus acentos y su "&". Nunca inventes una sección ni le cambies el formato.',
    '- "photoCaption": pie o crédito de foto de máximo 60 caracteres con su grafía normal, o "" si no procede.',
    '- "selectedCountries": de 0 a 4 países tomados EXCLUSIVAMENTE del catálogo que te doy, con el mismo "code" y el mismo "name", ordenados por relevancia. Si no procede, [].',
    "",
    'REGLAS DE "tweetBody" (sólo el cuerpo del tweet)',
    '- NO escribas el corchete con las banderas, ni el símbolo "»", ni la firma "#BlackNews": la web los añade alrededor del cuerpo cuando monta el tweet.',
    "- UNA sola línea: ni saltos de línea ni puntos y aparte.",
    '- El tweet montado no puede pasar de 250 caracteres: la firma "■ #BlackNews" con su línea en blanco ocupa 14 y el corchete "[banderas]" ocupa 5 más 4 por bandera (habrá como mucho 4). Así que el cuerpo debe quedar POR DEBAJO de 205 caracteres, empezando por lo esencial.',
    "- Es sobre el MISMO hecho que el titular, no sobre otra noticia del mismo tema. Aporta un dato o un ángulo que NO estén ni en el titular ni en la bajada (reacción, implicación, qué viene ahora): quien lo lee acaba de ver los otros dos, repetirlos desperdicia el tweet.",
    "- Hechos, cifras, nombres propios y, si los hay, fechas. Sin relleno, sin opinión, sin adjetivos de más.",
    '- Sin emojis, sin hashtags, sin comillas, sin enlaces y sin "lee más".',
    "",
    "FUENTES Y VERACIDAD",
    hasSources
      ? "- Usa el material de las fuentes: hechos, cifras, fechas y nombres propios reales. Si una fuente da un año o una cifra, respétala."
      : "- No hay material externo: trabaja sólo con el texto de partida y no inventes cifras, fechas, nombres ni organismos que no estén en él.",
    "- No cites enlaces ni nombres de medio dentro de los textos.",
    "- Si las fuentes se contradicen, prevalece la versión más reciente.",
    "- No prometas ni sentencies: informa.",
  ].join("\n");
}

function buildUserPrompt(
  categories: string[],
  topic: string,
  countries: AiCountry[],
  sources: AiSource[],
): string {
  const countryListText =
    countries.length > 0
      ? countries.map((c) => `${c.code}=${c.name}`).join(", ")
      : "(vacío)";
  const parts = [
    'SECCIONES HABILITADAS (elige exactamente una para "category"):',
    categories.map((c) => "  - " + c).join("\n"),
    "",
    "CATÁLOGO DE PAÍSES PERMITIDO (sólo puedes usar estos code y name):",
    countryListText,
    "",
    "TEXTO DE PARTIDA (lo que escribe la persona de la redacción):",
    topic,
  ];
  if (sources.length > 0) {
    parts.push("", "INFORMACIÓN ENCONTRADA EN LA WEB:");
    sources.forEach((source, index) => {
      parts.push(`${index + 1}. ${source.title || source.url}`);
      parts.push(`   ${source.url}`);
      if (source.snippet) parts.push(`   ${source.snippet}`);
    });
    parts.push(
      "",
      "Redacta la publicación y el cuerpo del tweet a partir del texto de partida y de esta información.",
    );
  } else {
    parts.push(
      "",
      "Redacta la publicación y el cuerpo del tweet a partir sólo del texto de partida.",
    );
  }
  return parts.join("\n");
}

// ── Respuesta del modelo ────────────────────────────────────────────────

/** Si el modelo insiste en montar el tweet entero (corchete, «» o firma),
 *  se lo quitamos aquí: el cliente vuelve a montarlo a partir de los países
 *  que haya elegido, así que el formato no depende del humor del modelo. */
function cleanTweetBody(value: string): string {
  let body = value.replace(/\r\n?/g, "\n").trim();
  body = body.replace(/^\[[^\]\n]{0,40}\]\s*(?:[»\-–—:]\s*)?/u, "");
  body = body.replace(/(?:^|\s)(?:■\s*)?#BlackNews\b/giu, "");
  return body.replace(/\s+/g, " ").trim();
}

/** Los modelos escriben a veces saltos de línea REALES dentro de las cadenas
 *  JSON (el titular va con \n) o dejan una coma al final: JSON.parse se niega
 *  y el intento entero se pierde. Recorre el texto escapando lo que toca
 *  dentro de comillas y quitando comas finales, sin tocar el resto. */
function repairJson(text: string): string {
  let out = "";
  let inString = false;
  let escaped = false;
  for (const ch of text) {
    if (inString) {
      if (escaped) {
        out += ch;
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        out += ch;
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = false;
        out += ch;
        continue;
      }
      if (ch === "\n") {
        out += "\\n";
        continue;
      }
      if (ch === "\r") {
        out += "\\r";
        continue;
      }
      if (ch === "\t") {
        out += "\\t";
        continue;
      }
      if (ch < " ") {
        out += " ";
        continue;
      }
      out += ch;
      continue;
    }
    if (ch === '"') {
      inString = true;
    }
    out += ch;
  }

  // Coma final antes de cerrar un objeto o un array: válida en JS, no en JSON.
  let cleaned = "";
  inString = false;
  escaped = false;
  for (let i = 0; i < out.length; i++) {
    const ch = out[i];
    if (inString) {
      cleaned += ch;
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      cleaned += ch;
      continue;
    }
    if (ch === ",") {
      let j = i + 1;
      while (j < out.length && /\s/.test(out[j])) j++;
      if (out[j] === "}" || out[j] === "]") {
        i = j - 1;
        continue;
      }
    }
    cleaned += ch;
  }
  return cleaned;
}

function parseModelJson(raw: string): {
  content: AiContent;
  tweetBody: string;
} {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const text = fenced ? fenced[1] : raw;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0) {
    throw new Error("La IA no devolvió JSON.");
  }
  if (end <= start) {
    throw new Error(
      "La IA devolvió una respuesta truncada: vuelve a intentarlo.",
    );
  }
  const slice = text.slice(start, end + 1);
  let parsed: unknown;
  try {
    parsed = JSON.parse(slice);
  } catch {
    try {
      parsed = JSON.parse(repairJson(slice));
    } catch {
      throw new Error("La IA devolvió un JSON que no se puede leer.");
    }
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("La IA devolvió una respuesta inesperada.");
  }
  const rec = parsed as Record<string, unknown>;
  // Acepta también el formato plano, por si el modelo se salta el "content".
  const contentValue =
    rec.content && typeof rec.content === "object"
      ? rec.content
      : typeof rec.title === "string" || typeof rec.description === "string"
        ? rec
        : null;
  if (!contentValue) {
    throw new Error('La IA no devolvió el bloque "content".');
  }
  const inside = (contentValue ?? {}) as Record<string, unknown>;
  // A veces el modelo mete el tweet DENTRO de "content": se busca en ambos
  // sitios antes de rendirse.
  const body = [rec.tweetBody, inside.tweetBody, rec.tweet, inside.tweet].find(
    (value): value is string => typeof value === "string",
  );
  if (body === undefined) {
    throw new Error("La IA no devolvió el cuerpo del tweet.");
  }
  const tweetBody = cleanTweetBody(body);
  if (!tweetBody) {
    throw new Error("La IA no devolvió el cuerpo del tweet.");
  }
  return { content: readContent(contentValue), tweetBody };
}

// ── Plantilla: complementariedad y huecos ─────────────────────────────────
// Los tres textos se publican juntos y deben sumar información en lugar de
// repetirla. Aquí sólo se pide una segunda pasada por lo que SÓLO el modelo
// puede arreglar: repetirse entre campos o quedarse corto. Lo que sobra de
// largo lo recorta el cliente con su aviso (es determinista y no merece otra
// llamada al modelo, que además no cuenta bien los caracteres).
const LAYOUT = {
  titleLinesMin: 2,
  titleMin: 50,
  titleMax: 75,
  descMin: 110,
  descMax: 170,
  /** Palabras seguidas que hacen que dos campos estén diciendo lo mismo. */
  sharedWords: 5,
};

interface Draft {
  content: AiContent;
  tweetBody: string;
}

/** Palabras de un texto: tal y como se escriben y normalizadas (minúsculas,
 *  sin acentos ni puntuación) para poder compararlas sin ruido. Se descartan
 *  los signos sueltos para que ambas listas mantengan la misma posición. */
function wordsOf(text: string): { words: string[]; norm: string[] } {
  const words: string[] = [];
  const norm: string[] = [];
  for (const word of text.replace(/\n/g, " ").split(/\s+/)) {
    const bare = word
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\p{L}\p{N}]/gu, "");
    if (!bare) continue;
    words.push(word.replace(/[^\p{L}\p{N}]+$/gu, ""));
    norm.push(bare);
  }
  return { words, norm };
}

/** Primera frase de `n` palabras seguidas que comparten los dos textos, o
 *  cadena vacía si no comparten ninguna. Se devuelve tal como escribe el
 *  primer texto, para poder citarla en el aviso. */
function sharedPhrase(a: string, b: string, n = LAYOUT.sharedWords): string {
  const first = wordsOf(a);
  const second = wordsOf(b);
  if (first.norm.length < n || second.norm.length < n) return "";
  const seen = new Map<string, string>();
  for (let i = 0; i + n <= first.norm.length; i++) {
    seen.set(
      first.norm.slice(i, i + n).join(" "),
      first.words.slice(i, i + n).join(" "),
    );
  }
  for (let j = 0; j + n <= second.norm.length; j++) {
    const hit = seen.get(second.norm.slice(j, j + n).join(" "));
    if (hit) return hit;
  }
  return "";
}

/** Todo lo que el modelo tiene que corregir en una segunda pasada: huecos
 *  (texto demasiado corto para el sitio que ocupa en la plantilla) y
 *  repeticiones entre campos. Lista vacía = respuesta válida, se devuelve tal
 *  cual. Los excesos de largo los recorta el cliente con su aviso. */
function templateIssues(draft: Draft): string[] {
  const issues: string[] = [];
  const lines = draft.content.title
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const total = lines.join("").length;
  if (lines.length < LAYOUT.titleLinesMin) {
    issues.push(
      `el titular ocupa ${lines.length} línea(s): tiene que ocupar 3 líneas separadas por \\n, entre ${LAYOUT.titleMin} y ${LAYOUT.titleMax} caracteres en total`,
    );
  } else if (total < LAYOUT.titleMin) {
    issues.push(
      `el titular suma ${total} caracteres: amplíalo a ${LAYOUT.titleMin}-${LAYOUT.titleMax} en 3 líneas con el dato que falta (quién, qué, dónde)`,
    );
  }
  const desc = draft.content.description.replace(/\s+/g, " ").trim();
  if (desc.length < LAYOUT.descMin) {
    issues.push(
      `la bajada tiene ${desc.length} caracteres: debe ocupar ${LAYOUT.descMin}-${LAYOUT.descMax}, con la cifra, la fecha o la consecuencia`,
    );
  }
  const tweet = draft.tweetBody;
  // La frase se quita SIEMPRE de la bajada o del tweet, nunca del titular:
  // es el campo más ajustado (3 líneas cortas) y conviene dejarlo quieto.
  const overlaps: Array<[string, string, string, string]> = [
    [
      "el titular",
      "la bajada",
      sharedPhrase(draft.content.title, draft.content.description),
      "de la bajada",
    ],
    [
      "la bajada",
      "el tweet",
      sharedPhrase(draft.content.description, tweet),
      "del tweet",
    ],
    [
      "el titular",
      "el tweet",
      sharedPhrase(draft.content.title, tweet),
      "del tweet",
    ],
  ];
  for (const [a, b, phrase, quitar] of overlaps) {
    if (!phrase) continue;
    issues.push(
      `la frase «${phrase}» aparece igual en ${a} y en ${b}: quítala ${quitar} y escribe en su lugar otro dato del mismo hecho`,
    );
  }
  return issues;
}

function buildRevisionPrompt(issues: string[]): string {
  return [
    "Tu anterior respuesta tiene los problemas de abajo. Devuelve EXCLUSIVAMENTE el mismo objeto JSON, corregido, sin nada alrededor y sin cambiar lo que ya está bien.",
    "Problemas concretos que tienes que resolver:",
    ...issues.map((issue) => `  - ${issue}`),
    "Los tres textos siguen tratando el mismo hecho y siendo complementarios: titular = QUÉ pasa (3 líneas de 4 o 5 palabras), bajada = DATOS Y CONTEXTO, cuerpo del tweet = ÁNGULO COMPLEMENTARIO.",
    "Para corregir sólo tienes dos maneras: AÑADIR información que falte o MOVER un dato de un campo a otro. NUNCA cortes ni resumas: si algo no cabe, quita una idea entera de otro campo en su lugar.",
  ].join("\n");
}

function openrouterError(status: number, body: string, model: string): string {
  const free = model.includes(":free");
  if (status === 401)
    return "Clave de OpenRouter inválida (OPENROUTER_API_KEY).";
  if (status === 402) {
    return free
      ? "Ese modelo gratuito no está disponible para esta cuenta: revisa OPENROUTER_MODEL."
      : "Sin crédito en OpenRouter: revisa el saldo de tu cuenta.";
  }
  if (status === 404)
    return "Modelo no encontrado en OpenRouter. Revisa OPENROUTER_MODEL.";
  if (status === 413)
    return "El contenido enviado es demasiado largo para el modelo.";
  if (status === 429) {
    const hint = body.match(/"message"\s*:\s*"([^"]{1,180})"/);
    const isFreePerDay = body.includes("free-models-per-day");
    const base = isFreePerDay
      ? "Límite diario de cuenta sin saldo en OpenRouter alcanzado. Añade $5 o $10 de saldo a tu cuenta en openrouter.ai para desbloquear 1.000 peticiones GRATUITAS al día con modelos :free."
      : free
        ? "Límite de peticiones de modelos gratuitos alcanzado temporalmente. Espera un par de minutos o añade saldo a tu cuenta de OpenRouter."
        : "Límite de peticiones alcanzado: espera unos segundos y reintenta.";
    return hint ? `${base} [${hint[1]}]` : base;
  }
  if (status >= 500)
    return "OpenRouter está caído o devolvió un error interno.";
  const match = body.match(/"message"\s*:\s*"([^"]{1,180})"/);
  return match ? `OpenRouter: ${match[1]}` : `OpenRouter respondió ${status}.`;
}

// ── Proveedores 100% Gratuitos (Cloudflare Workers AI, Groq, Gemini) ────

async function callWorkersAi(
  env: AiEnv,
  systemContent: string,
  userContent: string,
  followUp?: { assistant: string; user: string },
): Promise<string | null> {
  if (!env.AI) return null;
  const models = [
    "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    "@cf/meta/llama-3.1-8b-instruct",
    "@cf/mistral/mistral-7b-instruct-v0.2",
  ];
  for (const model of models) {
    try {
      const res = await env.AI.run(model, {
        messages: [
          { role: "system", content: systemContent },
          { role: "user", content: userContent },
          ...(followUp
            ? [
                { role: "assistant", content: followUp.assistant },
                { role: "user", content: followUp.user },
              ]
            : []),
        ],
        max_tokens: 2048,
      });
      const text =
        typeof res?.response === "string"
          ? res.response
          : typeof res === "string"
            ? res
            : null;
      if (text && text.trim()) return text;
    } catch (err) {
      console.warn("[BLACKNEWS WORKER] Workers AI warn:", err);
    }
  }
  return null;
}

async function callGroqAi(
  env: AiEnv,
  systemContent: string,
  userContent: string,
  followUp?: { assistant: string; user: string },
): Promise<string | null> {
  const key = (env.GROQ_API_KEY || "").trim();
  if (!key) return null;
  const models = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"];
  for (const model of models) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model,
          temperature: followUp ? 0.2 : 0.7,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemContent },
            { role: "user", content: userContent },
            ...(followUp
              ? [
                  { role: "assistant", content: followUp.assistant },
                  { role: "user", content: followUp.user },
                ]
              : []),
          ],
        }),
        signal: AbortSignal.timeout(LIMITS.timeoutMs),
      });
      if (!res.ok) continue;
      const data = (await res.json().catch(() => null)) as {
        choices?: Array<{ message?: { content?: string } }>;
      } | null;
      const text = data?.choices?.[0]?.message?.content;
      if (typeof text === "string" && text.trim()) return text;
    } catch (err) {
      console.warn("[BLACKNEWS WORKER] Groq AI warn:", err);
    }
  }
  return null;
}

async function callGeminiAi(
  env: AiEnv,
  systemContent: string,
  userContent: string,
  followUp?: { assistant: string; user: string },
): Promise<string | null> {
  const key = (env.GEMINI_API_KEY || "").trim();
  if (!key) return null;
  const models = ["gemini-2.5-flash", "gemini-1.5-flash"];
  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
      const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [
        { role: "user", parts: [{ text: userContent }] },
      ];
      if (followUp) {
        contents.push({ role: "model", parts: [{ text: followUp.assistant }] });
        contents.push({ role: "user", parts: [{ text: followUp.user }] });
      }
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemContent }] },
          contents,
          generationConfig: {
            response_mime_type: "application/json",
            temperature: followUp ? 0.2 : 0.7,
          },
        }),
        signal: AbortSignal.timeout(LIMITS.timeoutMs),
      });
      if (!res.ok) continue;
      const data = (await res.json().catch(() => null)) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      } | null;
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (typeof text === "string" && text.trim()) return text;
    } catch (err) {
      console.warn("[BLACKNEWS WORKER] Gemini AI warn:", err);
    }
  }
  return null;
}

// Lee la respuesta de un modelo sin lanzar: si el JSON no sirve, el error se
// devuelve junto al texto para que quien llama pueda pasar al siguiente modelo.
function tryParsePost(raw: string): {
  parsed?: Draft;
  text: string;
  error?: string;
} {
  try {
    return { parsed: parseModelJson(raw), text: raw };
  } catch (err) {
    const error =
      err instanceof Error ? err.message : "Respuesta de la IA ilegible.";
    console.warn("[BLACKNEWS WORKER] ai: JSON no aprovechable:", error);
    return { text: raw, error };
  }
}

// Los tres proveedores 100% gratuitos, en orden de prioridad: el primero que
// responde manda. Si no hay ninguno configurado (o todos fallan) devuelve
// null; cada proveedor ya salta por su cuenta a su siguiente modelo.
async function callFreeModel(
  env: AiEnv,
  systemContent: string,
  userContent: string,
  followUp?: { assistant: string; user: string },
): Promise<{ text: string; name: string } | null> {
  if (env.AI) {
    const text = await callWorkersAi(env, systemContent, userContent, followUp);
    if (text) return { text, name: "Cloudflare Workers AI (Llama 3.3 Free)" };
  }
  if (env.GROQ_API_KEY) {
    const text = await callGroqAi(env, systemContent, userContent, followUp);
    if (text) return { text, name: "Groq Cloud (Llama 3.3 Free)" };
  }
  if (env.GEMINI_API_KEY) {
    const text = await callGeminiAi(env, systemContent, userContent, followUp);
    if (text) return { text, name: "Google Gemini 2.5 Flash (Free)" };
  }
  return null;
}

// ── Handler ─────────────────────────────────────────────────────────────

export async function handleAiGenerate(
  request: Request,
  env: AiEnv,
): Promise<Response> {
  const hasAnyProvider = Boolean(
    env.AI || env.GROQ_API_KEY || env.GEMINI_API_KEY || env.OPENROUTER_API_KEY,
  );
  if (!hasAnyProvider) {
    return json(
      {
        success: false,
        error:
          "Falta un proveedor de IA. Cloudflare Workers AI es 100% gratuito (enlazado en wrangler.jsonc). También puedes añadir GEMINI_API_KEY (Google AI Studio) o GROQ_API_KEY (Groq) sin tarjeta de crédito.",
      },
      503,
    );
  }

  const ip = clientIp(request);
  if (isRateLimited(ip)) {
    return json(
      {
        success: false,
        error: "Demasiadas peticiones: espera un minuto y reintenta.",
      },
      429,
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json(
      { success: false, error: "El cuerpo de la petición no es JSON válido." },
      400,
    );
  }

  const topic = readTopic(body.text);
  if (!topic) {
    return json(
      {
        success: false,
        error: "Escribe primero el tema o el texto de partida.",
      },
      400,
    );
  }
  if (topic.length >= LIMITS.topic) {
    return json(
      {
        success: false,
        error: `El texto de partida es demasiado largo (máximo ${LIMITS.topic} caracteres).`,
      },
      400,
    );
  }

  const categories = stringList(
    body.categories,
    LIMITS.categories,
    LIMITS.categoryLen,
  );
  if (categories.length === 0) {
    return json(
      {
        success: false,
        error: "No hay secciones habilitadas en el generador.",
      },
      400,
    );
  }

  const countries = countryList(body.countries);

  // 1) Búsqueda web: si no hay clave o falla, se sigue adelante sin fuentes.
  const { sources, searched, note } = await webSearch(topic, env);

  const base = (env.OPENROUTER_API_BASE || OPENROUTER_API).replace(/\/+$/, "");
  const origin = new URL(request.url).origin;
  const modelChain = parseModelChain(env.OPENROUTER_MODEL);
  let usedModelName = modelChain[0] || DEFAULT_MODEL;

  // 2) Modelo. Un solo punto de salida para los fallos de red, de cuota o de
  // forma: si OpenRouter no puede, se devuelve su error; si responde pero con
  // el JSON roto o vacío, el bucle de abajo reintenta una vez.
  const systemContent = buildSystemPrompt(sources.length > 0).slice(
    0,
    LIMITS.systemChars,
  );
  const userContent = buildUserPrompt(
    categories,
    topic,
    countries,
    sources,
  ).slice(0, LIMITS.userChars);

  // Metadatos del último intento: si la forma falla, el registro dice si el
  // modelo se quedó corto (finish_reason) o si el JSON venía ya roto.
  let lastMeta = "";

  // Recorre la cadena de modelos: si uno está saturado (429), caído (5xx), se
  // queda sin contenido o viene con el JSON roto, se pasa AL SIGUIENTE. Sólo se
  // devuelve un error al cliente cuando se agota la cadena, o cuando el fallo
  // es de la cuenta o de la petición (400/401/403), que daría igual probar
  // otro modelo.
  const callModel = async (
    modelList: string[],
    followUp?: { assistant: string; user: string },
  ): Promise<{
    parsed?: Draft;
    text: string;
    error?: string;
    response?: Response;
  }> => {
    lastMeta = "";
    const targetModels = (modelList.length > 0 ? modelList : modelChain).slice(
      0,
      MAX_MODEL_TRIES,
    );
    // Los fallos de red y de timeout son los lentos: sólo se tolera UNO antes
    // de rendirse, para no encadenar esperas de 90 s.
    let networkFails = 0;
    let lastText = "";

    for (let i = 0; i < targetModels.length; i++) {
      const model = targetModels[i];
      const isLast = i === targetModels.length - 1;
      let upstream: Response;
      try {
        upstream = await fetch(`${base}/chat/completions`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
            "http-referer": origin,
            "x-title": "BLACKNEWS",
          },
          body: JSON.stringify({
            model,
            // En la pasada de ajuste baja la temperatura: se pide precisión
            // (quitar una frase, alargar un campo), no creatividad.
            temperature: followUp ? 0.2 : 0.7,
            max_tokens: LIMITS.maxTokens,
            // Sin razonamiento oculto: varios `:free` se gastan los tokens de
            // salida pensando y devuelven content=null con finish_reason "length".
            reasoning: { effort: "none" },
            // El proveedor se encarga de que el contenido sea JSON bien formado:
            // es la mejor garantía contra las respuestas rotas de los `:free`.
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: systemContent },
              { role: "user", content: userContent },
              // Segunda pasada: la conversación conserva la respuesta anterior
              // para que el modelo corrija sólo lo que se le señala.
              ...(followUp
                ? [
                    { role: "assistant", content: followUp.assistant },
                    { role: "user", content: followUp.user },
                  ]
                : []),
            ],
          }),
          signal: AbortSignal.timeout(LIMITS.timeoutMs),
        });
      } catch (err) {
        networkFails += 1;
        console.warn(
          `[BLACKNEWS WORKER] ai: sin respuesta de ${model}` +
            (networkFails > 1 || isLast ? "" : ", siguiente modelo"),
          err instanceof Error ? err.message : err,
        );
        if (networkFails > 1 || isLast) {
          return {
            text: lastText,
            response: json(
              {
                success: false,
                error: timedOut(err)
                  ? "El modelo tardó demasiado en responder. Reintenta en unos segundos."
                  : "No se pudo conectar con OpenRouter.",
              },
              504,
            ),
          };
        }
        continue;
      }

      const rawBody = await upstream.text();
      if (!upstream.ok) {
        console.error(
          "[BLACKNEWS WORKER] ai:",
          model,
          upstream.status,
          rawBody.slice(0, 300),
        );
        const fatal =
          upstream.status === 400 ||
          upstream.status === 401 ||
          upstream.status === 403;
        if (fatal || isLast) {
          return {
            text: lastText,
            response: json(
              {
                success: false,
                error: openrouterError(upstream.status, rawBody, model),
              },
              502,
            ),
          };
        }
        console.warn(
          `[BLACKNEWS WORKER] ai: ${model} respondió ${upstream.status}, siguiente modelo`,
        );
        continue;
      }

      let payload: {
        model?: string;
        choices?: Array<{
          message?: { content?: unknown };
          finish_reason?: string;
        }>;
        usage?: { completion_tokens?: number };
      };
      try {
        payload = JSON.parse(rawBody);
      } catch {
        if (isLast) {
          return {
            text: lastText,
            response: json(
              {
                success: false,
                error: "OpenRouter devolvió una respuesta ilegible.",
              },
              502,
            ),
          };
        }
        console.warn(
          `[BLACKNEWS WORKER] ai: ${model} devolvió una respuesta ilegible, siguiente modelo`,
        );
        continue;
      }

      usedModelName = payload.model || model;
      lastMeta =
        `model=${usedModelName} finish=${payload.choices?.[0]?.finish_reason ?? "?"} ` +
        `out=${payload.usage?.completion_tokens ?? "?"} len=${rawBody.length}`;

      const content = payload.choices?.[0]?.message?.content;
      if (typeof content !== "string") {
        // Caso real: modelos con razonamiento oculto que se comen los tokens de
        // salida sin llegar a escribir. El registro deja ver el finish_reason.
        console.error(
          "[BLACKNEWS WORKER] ai: contenido vacío",
          model,
          "len=" + rawBody.length,
          JSON.stringify(payload).slice(0, 700),
        );
        if (isLast) return { text: lastText };
        console.warn(
          `[BLACKNEWS WORKER] ai: ${model} sin contenido, siguiente modelo`,
        );
        continue;
      }

      const { parsed, text, error } = tryParsePost(content);
      if (parsed) return { parsed, text };
      // JSON roto o forma inesperada: se apunta y se prueba con el siguiente.
      lastText = text;
      if (isLast) return { text: lastText, error };
      console.warn(
        `[BLACKNEWS WORKER] ai: ${model} respondió con el JSON roto, siguiente modelo`,
      );
    }

    return { text: lastText };
  };

  // Los proveedores gratuitos y la cadena de modelos se encargan solos de
  // saltar de modelo cuando el anterior falla; aquí sólo se decide qué
  // respuesta se le devuelve al usuario.
  let result: Draft | null = null;
  let lastRaw = "";
  let lastError = "La IA no devolvió JSON.";

  // 1) Proveedores 100% gratuitos (Workers AI, Groq, Gemini): van primero.
  const free = await callFreeModel(env, systemContent, userContent);
  if (free) {
    lastRaw = free.text;
    usedModelName = free.name;
    const { parsed, error } = tryParsePost(free.text);
    if (parsed) {
      result = parsed;
    } else if (error) {
      lastError = error;
    }
  }

  // 2) OpenRouter: recorre la cadena de OPENROUTER_MODEL y sólo devuelve un
  //    error si la cadena entera se queda sin una respuesta aprovechable.
  if (!result && env.OPENROUTER_API_KEY) {
    const call = await callModel(modelChain);
    if (call.response) return call.response;
    if (call.parsed) {
      result = call.parsed;
      lastRaw = call.text;
    } else {
      if (call.error) lastError = call.error;
      if (call.text) {
        lastRaw = call.text;
        console.error(
          "[BLACKNEWS WORKER] ai: respuesta no aprovechable",
          lastMeta,
          "cabeza=" + call.text.slice(0, 400),
          "cola=" + call.text.slice(-250),
        );
      }
    }
  }

  if (!result) {
    return json({ success: false, error: lastError }, 502);
  }

  // Pasada de ajuste: si el titular o la bajada no encajan en la plantilla, o
  // si dos campos están diciendo lo mismo, se pide UNA revisión concreta con la
  // respuesta anterior delante y la lista de lo que sobra. Si la revisión no
  // llega o sale peor, se conserva la primera: nunca se pierde contenido por
  // intentar mejorar.
  let warnings = templateIssues(result);
  if (warnings.length > 0 && lastRaw) {
    const followUp = {
      assistant: lastRaw.slice(0, 8000),
      user: buildRevisionPrompt(warnings),
    };
    // Con clave de OpenRouter la revisión pasa por la cadena de modelos; sin
    // ella, por los proveedores gratuitos. Nunca hacia un endpoint sin clave.
    let revision: { parsed?: Draft; text: string } = { text: "" };
    if (env.OPENROUTER_API_KEY) {
      revision = await callModel(modelChain, followUp);
    } else {
      const freeRevision = await callFreeModel(
        env,
        systemContent,
        userContent,
        followUp,
      );
      revision = freeRevision ? tryParsePost(freeRevision.text) : { text: "" };
    }
    if (revision.parsed) {
      const candidateIssues = templateIssues(revision.parsed);
      if (candidateIssues.length <= warnings.length) {
        result = revision.parsed;
        warnings = candidateIssues;
      }
    } else if (revision.text) {
      // JSON roto o forma inesperada: se conserva la primera respuesta.
      console.error(
        "[BLACKNEWS WORKER] ai: revisión descartada",
        lastMeta,
        revision.text.slice(0, 300),
      );
    } else {
      // Error de red o de cuota en la revisión: no invalida la primera respuesta.
      console.error("[BLACKNEWS WORKER] ai: revisión sin contenido", lastMeta);
    }
    console.log(
      "[BLACKNEWS WORKER] ai: ajuste",
      JSON.stringify({ issues: warnings }),
    );
  }

  return json({
    success: true,
    data: {
      content: result.content,
      // Sin cortar: el cuerpo se queda como viene y el corchete y la firma
      // los monta el cliente, que es quien aplica el tope de 250 caracteres.
      tweetBody: result.tweetBody,
      model: usedModelName,
      searched,
      sources: sources.map((source) => ({
        title: source.title,
        url: source.url,
      })),
      // Lo que sigue sin encajar (señalado para la redacción, en la tarjeta).
      ...(warnings.length > 0 ? { warnings } : {}),
      ...(note ? { note } : {}),
    },
  });
}
