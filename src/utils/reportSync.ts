/**
 * Sincronización de la portada con Firestore.
 *
 * Contexto (07/10/2026): publicar hacía `localStorage.setItem` + `setDoc`
 * dentro del mismo try/catch silencioso. Cuando las reglas rechazaban la
 * escritura (sesión sin permisos), el toast de éxito salía igual, el post
 * solo quedaba en `blacknews_reports` del navegador y la siguiente
 * sincronización al arrancar lo pisaba con la lista remota: el post "se
 * borraba" al actualizar.
 *
 * Ahora cada operación remota queda registrada:
 *  - escritura fallida → el id se marca "sin sincronizar": el post se
 *    conserva al fusionar con la nube y se vuelve a subir al arrancar;
 *  - borrado fallido → el id queda en cola: la fusión lo retira de la
 *    portada local y reintenta el deleteDoc (evita que resucite).
 */

import { db, doc, setDoc, deleteDoc } from "../firebase";
import { Report } from "../types/news";

const UNSYNCED_KEY = "blacknews_unsynced_report_ids";
const PENDING_DELETES_KEY = "blacknews_pending_report_deletes";
const REPORTS_KEY = "blacknews_reports";

function readIdList(key: string): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string" && v.length > 0);
  } catch {
    return [];
  }
}

function writeIdList(key: string, ids: string[]): void {
  try {
    if (ids.length === 0) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(ids));
  } catch {}
}

/** El post existe solo en este dispositivo: conservarlo y reintentar subirlo. */
export function markReportUnsynced(id: string): void {
  const ids = readIdList(UNSYNCED_KEY);
  if (!ids.includes(id)) writeIdList(UNSYNCED_KEY, [...ids, id]);
}

/** Subida (o edición) confirmada por Firestore: ya no hay nada pendiente. */
export function markReportSynced(id: string): void {
  writeIdList(
    UNSYNCED_KEY,
    readIdList(UNSYNCED_KEY).filter((x) => x !== id),
  );
}

export function listUnsyncedReportIds(): string[] {
  return readIdList(UNSYNCED_KEY);
}

/** Borrado local hecho pero rechazado por la nube: reintentar el deleteDoc. */
export function markReportDeletePending(id: string): void {
  const ids = readIdList(PENDING_DELETES_KEY);
  if (!ids.includes(id)) writeIdList(PENDING_DELETES_KEY, [...ids, id]);
}

export function clearPendingReportDelete(id: string): void {
  writeIdList(
    PENDING_DELETES_KEY,
    readIdList(PENDING_DELETES_KEY).filter((x) => x !== id),
  );
}

export function listPendingReportDeletes(): string[] {
  return readIdList(PENDING_DELETES_KEY);
}

/** Copia local de la portada (misma clave que usa el arranque de App). */
export function readLocalReports(): Report[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(REPORTS_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((r): r is Report => Boolean(r && typeof r.id === "string"));
  } catch {
    return [];
  }
}

/**
 * Reintenta las operaciones remotas pendientes con la copia local.
 *
 * Cada intento se gestiona por separado: si uno falla, el resto se sigue
 * intentando y los ids siguen marcados como pendientes para la próxima.
 * Nunca lanza: es seguro llamarla en segundo plano.
 */
export async function retryPendingReportSync(): Promise<void> {
  const local = readLocalReports();

  for (const id of listUnsyncedReportIds()) {
    const report = local.find((r) => r.id === id);
    // El post ya no está en este dispositivo: nada que subir.
    if (!report) {
      markReportSynced(id);
      continue;
    }
    try {
      await setDoc(doc(db, "reports", id), report);
      markReportSynced(id);
      console.info(`[BLACKNEWS] Informe ${id} sincronizado con la nube`);
    } catch (err) {
      console.warn(`[BLACKNEWS] Informe ${id} sigue sin subir`, err);
    }
  }

  for (const id of listPendingReportDeletes()) {
    try {
      await deleteDoc(doc(db, "reports", id));
      clearPendingReportDelete(id);
      console.info(`[BLACKNEWS] Informe ${id} borrado de la nube`);
    } catch (err) {
      console.warn(`[BLACKNEWS] Borrado pendiente de ${id}`, err);
    }
  }
}

/**
 * Combina lo remoto con lo local pendiente de subir y retira lo pendiente
 * de borrar.
 *
 * Reglas:
 *  - lo que está en la nube se toma de la nube (manda entre dispositivos);
 *  - un id marcado "sin sincronizar" gana con la copia local: es lo último
 *    que se intentó escribir aquí y aún no está confirmado arriba;
 *  - los ids en cola de borrado no aparecen aunque estén en la nube.
 *
 * Orden: ids con marca de tiempo decrecientes, como en la sync normal.
 */
export function mergeReports(
  remote: Report[],
  unsyncedIds: string[],
  pendingDeletes: string[],
): Report[] {
  const merged = new Map<string, Report>();
  for (const report of remote) merged.set(report.id, report);

  const localById = new Map(readLocalReports().map((r) => [r.id, r]));
  for (const id of unsyncedIds) {
    const local = localById.get(id);
    if (local) merged.set(id, local);
  }

  const deleting = new Set(pendingDeletes);
  return [...merged.values()]
    .filter((r) => !deleting.has(r.id))
    .sort((a, b) => b.id.localeCompare(a.id));
}
