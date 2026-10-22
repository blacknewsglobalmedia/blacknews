/**
 * BLACKNEWS OSINT — Orquestación de búsquedas en el backend.
 *
 * Reglas del módulo:
 * - Las búsquedas corren SIEMPRE en el Worker (el navegador nunca toca
 *   las APIs ni ve claves).
 * - Una fuente que falle no bloquea a las demás: se devuelven los
 *   resultados disponibles y se informa qué conectores tuvieron error.
 * - Cuotas: se distingue cuota oficial documentada / cabeceras HTTP /
 *   contadores internos / desconocido. Los contadores internos JAMÁS se
 *   presentan como cuota del proveedor.
 * - Cortacircuito: al agotar el límite interno o recibir 429, la fuente
 *   se salta durante una ventana (15 min) sin tumbar la búsqueda.
 */
import type {
  OsintItem,
  OsintSearchRequest,
  OsintSearchResponse,
  OsintSourceConfig,
  OsintSourceResult,
  OsintSourceRuntime,
} from '../../src/types/osint';
import {
  ConnectorError,
  runConnector,
  SUBREQUEST_BUDGET,
  type ConnectorContext,
  type OsintEnvLike,
} from './connectors';
import { clusterItems, normalizeItems, scoreItems, sortItems } from './normalize';
import { isDomainAllowlisted, hostnameOf, SsrfError } from './ssrf';
import { loadSources, markSearch, saveRuntime, type KvLike } from './store';

export interface OsintSearchEnv extends OsintEnvLike {
  PAYPAL_KV: KvLike;
}

const RATE_LIMIT_COOLDOWN_MS = 15 * 60_000;

function periodRange(period: OsintSearchRequest['period'], customFrom?: string, customTo?: string) {
  const to = customTo ? new Date(customTo) : new Date();
  let from: Date;
  switch (period) {
    case '6h':
      from = new Date(to.getTime() - 6 * 3_600_000);
      break;
    case '24h':
      from = new Date(to.getTime() - 24 * 3_600_000);
      break;
    case '7d':
      from = new Date(to.getTime() - 7 * 24 * 3_600_000);
      break;
    default:
      from = customFrom ? new Date(customFrom) : new Date(to.getTime() - 24 * 3_600_000);
  }
  if (Number.isNaN(from.getTime())) from = new Date(Date.now() - 24 * 3_600_000);
  if (Number.isNaN(to.getTime()) || to.getTime() > Date.now()) return { from, to: new Date() };
  return { from, to };
}

/** ¿La fuente debe saltarse en esta ejecución? Devuelve el motivo o null. */
function skipReason(
  config: OsintSourceConfig,
  runtime: OsintSourceRuntime,
  env: OsintSearchEnv,
): string | null {
  if (!config.enabled) return 'Fuente deshabilitada por el administrador.';
  if (runtime.blockedUntil && Date.parse(runtime.blockedUntil) > Date.now()) {
    return `En espera por límite interno hasta ${new Date(runtime.blockedUntil).toLocaleTimeString('es-UY')}.`;
  }
  const limit = config.internalDailyLimit;
  if (limit !== undefined && limit > 0 && runtime.requestsToday >= limit) {
    return `Límite interno diario alcanzado (${runtime.requestsToday}/${limit}). Sube el límite en Fuentes si corresponde.`;
  }
  if (config.custom && config.kind === 'rss') {
    const host = hostnameOf(config.url || '');
    if (!host || !isDomainAllowlisted(host, env.OSINT_RSS_ALLOWLIST)) {
      return 'Dominio del feed no incluido en la allowlist del Worker (OSINT_RSS_ALLOWLIST).';
    }
  }
  return null;
}

export async function searchAll(
  env: OsintSearchEnv,
  body: OsintSearchRequest,
): Promise<OsintSearchResponse> {
  const started = Date.now();
  const query = (body.query || '').replace(/\s+/g, ' ').trim();
  if (query.length < 2) throw new Error('La búsqueda requiere al menos 2 caracteres.');

  const { from, to } = periodRange(body.period, body.customFrom, body.customTo);
  const maxPerSource = Math.min(50, Math.max(5, body.maxPerSource || 20));
  const exclude = new Set(body.excludeIds || []);
  const detectedAt = new Date().toISOString();

  const sources = await loadSources(env.PAYPAL_KV);
  const wanted = body.sources && body.sources.length > 0 ? new Set(body.sources) : null;
  const targets = sources.filter((s) => (wanted ? wanted.has(s.id) : true));

  const results: OsintSourceResult[] = [];
  const allRaw: Array<{ config: OsintSourceConfig; raws: Awaited<ReturnType<typeof runConnector>>['items'] }> = [];
  // Presupuesto de subpeticiones COMPARTIDO por todas las fuentes de esta
  // búsqueda (plan gratuito: 50 por request; verificado en producción).
  const budget = { remaining: SUBREQUEST_BUDGET };

  await Promise.all(
    targets.map(async (entry) => {
      const { runtime, ...config } = entry;
      const t0 = Date.now();
      const quotaNote = config.quotaNote;

      const blocked = skipReason(config, runtime, env);
      if (blocked) {
        results.push({
          sourceId: config.id,
          sourceName: config.name,
          ok: false,
          skipped: true,
          itemCount: 0,
          error: blocked,
          durationMs: 0,
          quota: {
            kind: runtime.quotaKind || 'unknown',
            remaining: runtime.quotaHeaderRemaining,
            limit: runtime.quotaHeaderLimit,
            note: quotaNote,
          },
        });
        return;
      }

      // Filtro de idioma post-normalización se hace en el conector o aquí.
      const ctx: ConnectorContext = {
        env,
        config,
        query,
        from,
        to,
        max: maxPerSource,
        languages: body.languages && body.languages.length > 0 ? body.languages : undefined,
        subrequests: budget,
      };

      const rt: OsintSourceRuntime = { ...runtime };
      rt.requestsTotal += 1;
      rt.requestsToday += 1;
      rt.requestsThisMonth += 1;
      rt.lastQueryAt = detectedAt;
      rt.quotaOfficialNote = quotaNote;

      try {
        const out = await runConnector(config.kind, ctx);
        const items = out.items.filter((it) => {
          if (body.languages && body.languages.length > 0 && it.language) {
            if (!body.languages.includes(it.language)) return false;
          }
          return true;
        });
        allRaw.push({ config, raws: items });
        rt.lastOkAt = detectedAt;
        if (rt.status !== 'pending_setup') rt.status = 'active';
        // Cuota por cabeceras: SÓLO si la API la informó explícitamente.
        if (out.quotaHeaders?.remaining !== undefined) {
          rt.quotaKind = 'headers';
          rt.quotaHeaderRemaining = out.quotaHeaders.remaining;
          rt.quotaHeaderLimit = out.quotaHeaders.limit;
        } else {
          // Sin cabeceras no hay saldo verificable: se limpia cualquier valor
          // previo (podría estar desactualizado) y se informa la categoría
          // documentada de la fuente o, en su defecto, sólo lo interno.
          rt.quotaKind = config.quotaKind || 'internal';
          rt.quotaHeaderRemaining = undefined;
          rt.quotaHeaderLimit = undefined;
        }
        results.push({
          sourceId: config.id,
          sourceName: config.name,
          ok: true,
          itemCount: items.length,
          durationMs: Date.now() - t0,
          quota: {
            kind: rt.quotaKind,
            remaining: rt.quotaHeaderRemaining,
            limit: rt.quotaHeaderLimit,
            note: quotaNote,
          },
        });
        await saveRuntime(env.PAYPAL_KV, rt);
      } catch (err) {
        const isRateLimit = err instanceof ConnectorError && err.kind === 'rate_limit';
        const isSetup = err instanceof ConnectorError && err.kind === 'setup';
        const isBudget = err instanceof ConnectorError && err.kind === 'budget';
        const message =
          err instanceof ConnectorError
            ? err.message
            : err instanceof SsrfError
              ? `URL bloqueada por seguridad: ${err.message}`
              : 'Error inesperado al consultar la fuente.';
        // Un tope de presupuesto NO es un error de la fuente: se informa en
        // la fila, pero no se castiga su estado (sigue activa y sana).
        if (!isBudget) {
          rt.lastError = message;
          rt.lastErrorAt = detectedAt;
        }
        if (isRateLimit) {
          rt.status = 'rate_limited';
          rt.lastLimitAt = detectedAt;
          rt.blockedUntil = new Date(Date.now() + RATE_LIMIT_COOLDOWN_MS).toISOString();
        } else if (isSetup) {
          rt.status = 'pending_setup';
        } else if (!isBudget) {
          rt.status = 'error';
        }
        results.push({
          sourceId: config.id,
          sourceName: config.name,
          ok: false,
          itemCount: 0,
          error: message,
          durationMs: Date.now() - t0,
          quota: {
            kind: rt.quotaKind,
            remaining: rt.quotaHeaderRemaining,
            limit: rt.quotaHeaderLimit,
            note: quotaNote,
          },
        });
        await saveRuntime(env.PAYPAL_KV, rt);
      }
    }),
  );

  // Normalizar → dedupe global → puntuar → ordenar.
  const normalized: Array<Omit<OsintItem, 'clusterId' | 'score' | 'scoreFactors'>> = [];
  for (const { config, raws } of allRaw) {
    normalized.push(
      ...normalizeItems(raws, {
        sourceId: config.id,
        sourceName: config.name,
        sourceKind: config.kind,
        detectedAt,
        query,
      }),
    );
  }
  const { items, clusters, duplicateCount } = clusterItems(normalized);
  scoreItems(items, clusters, query);

  let visible = items.filter((it) => !exclude.has(it.id));
  visible = sortItems(visible, body.sort || 'score');

  // Sólo las fuentes que aportaron ítems o informaron de su estado.
  await markSearch(env.PAYPAL_KV, detectedAt);

  const newCount = visible.length;
  return {
    items: visible,
    clusters,
    results,
    took: Date.now() - started,
    newCount,
    duplicateCount,
  };
}
