/**
 * BLACKNEWS OSINT — Persistencia en el binding KV existente (`PAYPAL_KV`).
 *
 * Todo con prefijo `osint:` para no invadir las claves de pagos:
 * - `osint:sources`        → configuración (built-in mergeadas + custom)
 * - `osint:runtime:<id>`   → contadores, errores y cortacircuitos por fuente
 * - `osint:lastsearch`     → marca de la última búsqueda ejecutada
 */
import type { OsintSourceConfig, OsintSourceRuntime } from '../../src/types/osint';
import { BUILTIN_SOURCES } from './sources';

export interface KvLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}

const KEY_SOURCES = 'osint:sources';
const KEY_LAST_SEARCH = 'osint:lastsearch';
const runtimeKey = (id: string) => `osint:runtime:${id}`;

export async function loadLastSearchAt(kv: KvLike): Promise<string | undefined> {
  return (await kv.get(KEY_LAST_SEARCH)) || undefined;
}

export async function markSearch(kv: KvLike, at: string): Promise<void> {
  await kv.put(KEY_LAST_SEARCH, at);
}

/** Runtime por defecto de una fuente sin consumo registrado. */
export function defaultRuntime(id: string): OsintSourceRuntime {
  const now = new Date();
  const tomorrow = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return {
    id,
    status: 'active',
    requestsTotal: 0,
    requestsToday: 0,
    requestsThisMonth: 0,
    periodResetsAt: new Date(tomorrow).toISOString(),
    quotaKind: 'unknown',
  };
}

/**
 * Fuentes disponibles: las built-in fusionadas con la configuración
 * persistida (toggles, límites internos, feeds personalizados).
 */
export async function loadSources(
  kv: KvLike,
): Promise<Array<OsintSourceConfig & { runtime: OsintSourceRuntime }>> {
  let stored: OsintSourceConfig[] = [];
  try {
    const raw = await kv.get(KEY_SOURCES);
    if (raw) stored = JSON.parse(raw) as OsintSourceConfig[];
  } catch {
    stored = [];
  }
  const storedById = new Map(stored.map((s) => [s.id, s]));

  const merged: Array<OsintSourceConfig & { runtime: OsintSourceRuntime }> = [];
  for (const builtin of BUILTIN_SOURCES) {
    const over = storedById.get(builtin.id);
    const config: OsintSourceConfig = over
      ? { ...builtin, ...over, id: builtin.id, kind: builtin.kind, custom: false }
      : { ...builtin };
    merged.push({ ...config, runtime: await effectiveRuntime(kv, config) });
  }
  // Personalizadas persistidas por el administrador.
  for (const custom of stored.filter((s) => s.custom)) {
    if (merged.some((m) => m.id === custom.id)) continue;
    merged.push({ ...custom, runtime: await effectiveRuntime(kv, custom) });
  }
  return merged;
}

/**
 * Runtime con la categoría de cuota CORRECTA para la UI:
 * - 'headers' sólo si la API informó saldo explícitamente;
 * - si no, la categoría documentada por la fuente (fuente personalizada o
 *   sin dato → 'internal', sólo contadores propios; sin nota → 'unknown').
 * Recalculada en cada lectura para no heredar etiquetas obsoletas de KV.
 */
async function effectiveRuntime(
  kv: KvLike,
  config: OsintSourceConfig,
): Promise<OsintSourceRuntime> {
  const rt = await loadRuntime(kv, config.id);
  rt.quotaKind =
    rt.quotaHeaderRemaining !== undefined ? 'headers' : config.quotaKind || 'internal';
  return rt;
}

/** Guarda sólo lo editable: enabled, internalDailyLimit y las custom. */
export async function saveSources(
  kv: KvLike,
  sources: OsintSourceConfig[],
): Promise<void> {
  const editable = sources
    .filter((s) => s.custom || s.internalDailyLimit !== undefined || s.enabled !== undefined)
    .map((s) => ({
      id: s.id,
      name: s.name,
      kind: s.kind,
      enabled: s.enabled,
      internalDailyLimit: s.internalDailyLimit,
      ...(s.custom ? s : {}),
    }));
  await kv.put(KEY_SOURCES, JSON.stringify(editable));
}

export async function loadRuntime(kv: KvLike, id: string): Promise<OsintSourceRuntime> {
  try {
    const raw = await kv.get(runtimeKey(id));
    if (raw) {
      const rt = JSON.parse(raw) as OsintSourceRuntime;
      // Ventana diaria vencida → reiniciar el contador interno del día.
      if (rt.periodResetsAt && Date.parse(rt.periodResetsAt) <= Date.now()) {
        const now = new Date();
        const tomorrow = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
        rt.requestsToday = 0;
        rt.periodResetsAt = new Date(tomorrow).toISOString();
      }
      if (rt.status === 'rate_limited' && rt.blockedUntil && Date.parse(rt.blockedUntil) <= Date.now()) {
        rt.status = 'active';
        rt.blockedUntil = undefined;
      }
      return rt;
    }
  } catch {
    // KV corrupto → empezar de cero, nunca tumbar la búsqueda
  }
  return defaultRuntime(id);
}

export async function saveRuntime(kv: KvLike, runtime: OsintSourceRuntime): Promise<void> {
  await kv.put(runtimeKey(runtime.id), JSON.stringify(runtime));
}
