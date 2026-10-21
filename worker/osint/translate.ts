/**
 * BLACKNEWS OSINT — Traducción automática de hallazgos al español.
 *
 * Reglas del módulo:
 * - El backend NUNCA reescribe los datos originales: la traducción es una
 *   capa opcional aplicada al IMPORTAR, siempre etiquetada como
 *   «traducción automática» y con el texto original conservado (vista
 *   previa, guardados y franja del generador).
 * - Si no hay proveedor de IA configurado o la respuesta es ilegible, la
 *   importación continúa con el ORIGINAL (nunca bloquea ni inventa).
 * - Reutiliza `callFreeModel` de worker/ai.ts (Workers AI → Groq → Gemini),
 *   la misma cadena gratuita que usa la redacción asistida.
 */
import { callFreeModel, type AiEnv } from '../ai';

export interface TranslationInput {
  title: string;
  snippet?: string;
}

export type TranslationOutcome =
  | { ok: true; title: string; snippet?: string; provider: string; changed: boolean }
  | { ok: false; error: string };

/** Longitudes máximas traducidas (protección contra respuestas infladas). */
const MAX_TITLE = 300;
const MAX_SNIPPET = 600;

/** Prompt de traducción (puro, testeable). */
export function buildTranslationPrompt(
  input: TranslationInput,
): { system: string; user: string } {
  const system =
    'Eres traductor profesional de una agencia de noticias en español. ' +
    'Traduce AL ESPAÑOL el titular y el fragmento de noticia que se te dan. ' +
    'Conserva nombres propios, siglas, cifras y fechas tal cual; no resumas, ' +
    'no adornes, no añadas ni quites información. Devuelve SOLO JSON válido, ' +
    'sin markdown, con esta forma exacta: {"title":"…","snippet":"…"}. ' +
    'Si el fragmento está vacío, devuelve "snippet":"".';
  const user = JSON.stringify({
    title: input.title.slice(0, 1000),
    snippet: (input.snippet || '').slice(0, MAX_SNIPPET * 2),
  });
  return { system, user };
}

/**
 * Parser tolerante de la respuesta del modelo (puro):
 * - admite JSON limpio, JSON rodeado de texto y cercado por ```json …```;
 * - exige un `title` string no vacío;
 * - recorta longitudes excesivas.
 * Devuelve null si no hay nada fiable (la importación usará el original).
 */
export function parseTranslationResponse(raw: string): {
  title: string;
  snippet?: string;
} | null {
  if (!raw) return null;
  let text = raw.trim();
  // Quitar cercado de código tipo markdown.
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(text);
  if (fence) text = fence[1].trim();
  // Primer objeto JSON balanceado del texto.
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let end = -1;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }
    if (ch === '"') inString = !inString;
    else if (!inString && ch === '{') depth++;
    else if (!inString && ch === '}') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end === -1) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const obj = parsed as Record<string, unknown>;
  const title = typeof obj.title === 'string' ? obj.title.replace(/\s+/g, ' ').trim() : '';
  if (!title) return null;
  const snippet =
    typeof obj.snippet === 'string' ? obj.snippet.replace(/\s+/g, ' ').trim() : undefined;
  return {
    title: title.slice(0, MAX_TITLE),
    snippet: snippet ? snippet.slice(0, MAX_SNIPPET) : undefined,
  };
}

/**
 * Traduce un hallazgo con la cadena gratuita de IA del proyecto.
 * Nunca lanza: cualquier fallo vuelve `ok:false` para que el importador
 * use el texto original.
 */
export async function translateFinding(
  env: AiEnv,
  input: TranslationInput,
): Promise<TranslationOutcome> {
  const { system, user } = buildTranslationPrompt(input);
  let text: string | null = null;
  let provider = '';
  try {
    const out = await callFreeModel(env, system, user);
    if (out) {
      text = out.text;
      provider = out.name;
    }
  } catch {
    text = null;
  }
  if (!text) {
    // Distinguimos honestamente: sin NINGÚN proveedor configurado es una
    // cosa; proveedor presente pero sin respuesta (fallo de red/cuota) es
    // otra. En ambos casos la importación usará el original.
    const anyProvider = Boolean(env.AI || env.GROQ_API_KEY || env.GEMINI_API_KEY);
    return {
      ok: false,
      error: anyProvider
        ? 'El proveedor de IA no respondió (fallo de red o cuota); se conserva el original.'
        : 'Sin proveedor de IA disponible para traducir (configura Workers AI, GROQ_API_KEY o GEMINI_API_KEY).',
    };
  }
  const parsed = parseTranslationResponse(text);
  if (!parsed) {
    return { ok: false, error: 'La IA devolvió una traducción ilegible; se conserva el original.' };
  }
  const changed = parsed.title !== input.title || parsed.snippet !== (input.snippet || undefined);
  return { ok: true, ...parsed, provider, changed };
}
