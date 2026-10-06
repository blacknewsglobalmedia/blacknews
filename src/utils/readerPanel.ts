/**
 * Panel del lector: historial de lecturas y límites del plan gratuito.
 *
 * - Historial: últimas HISTORY_LIMIT lecturas del dispositivo (la más
 *   reciente primero). Releer un artículo lo mueve al frente; no duplica.
 * - Guardados: el plan gratuito admite hasta FREE_BOOKMARK_LIMIT artículos;
 *   suscriptores y redacción, sin límite.
 *
 * Todo vive en localStorage, igual que el resto de datos del lector
 * (marcadores, cuota diaria): es una ayuda personal de este dispositivo.
 */

const KEY = "blacknews_read_history";

/** Artículos que recuerda el historial. */
export const HISTORY_LIMIT = 50;

/** Guardados que incluye el plan gratuito (registrado sin suscripción). */
export const FREE_BOOKMARK_LIMIT = 10;

export interface HistoryEntry {
  /** id del artículo leído. */
  id: string;
  /** Epoch ms de la última lectura. */
  ts: number;
}

export function loadReadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data
      .filter(
        (e): e is HistoryEntry =>
          !!e && typeof e.id === "string" && typeof e.ts === "number",
      )
      .slice(0, HISTORY_LIMIT);
  } catch {
    /* modo privado o storage corrupto: el historial empieza vacío */
    return [];
  }
}

/** Devuelve el historial con la lectura anotada al frente (sin duplicar). */
export function recordHistoryEntry(
  current: HistoryEntry[],
  reportId: string,
): HistoryEntry[] {
  const next = [
    { id: reportId, ts: Date.now() },
    ...current.filter((e) => e.id !== reportId),
  ].slice(0, HISTORY_LIMIT);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* sin storage el historial vive solo en memoria de esta sesión */
  }
  return next;
}
