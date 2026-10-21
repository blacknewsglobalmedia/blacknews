/**
 * BLACKNEWS OSINT — Rutas /api/osint/* del Worker.
 *
 * TODAS pasan por `requireOsintAdmin` (Google ID token verificado contra
 * los certs de Google + allowlist, o token administrativo secreto). Los
 * errores nunca incluyen claves ni secretos; los mensajes son para el
 * administrador del módulo.
 *
 *   GET    /api/osint/status        → estado del sistema + fuentes + cuotas
 *   POST   /api/osint/search       → búsqueda multi-fuente (errores parciales)
 *   GET    /api/osint/sources      → configuración + runtime por fuente
 *   PUT    /api/osint/sources      → activar/desactivar o ajustar límite interno
 *   POST   /api/osint/sources      → añadir feed RSS personalizado (allowlist)
 *   DELETE /api/osint/sources?id=  → eliminar una fuente personalizada
 *   POST   /api/osint/sources/test → probar conexión + vista previa de datos
 *   POST   /api/osint/translate   → traducir hallazgo al español (IA gratuita
 *                                   del proyecto; el original nunca se toca)
 */
import type {
  OsintSearchRequest,
  OsintSourceConfig,
  OsintStatusResponse,
} from '../../src/types/osint';
import type { Env } from '../index';
import { requireOsintAdmin } from './auth';
import { searchRssFeed } from './connectors';
import { searchAll } from './search';
import { translateFinding } from './translate';
import { assertSafeOutboundUrl, hostnameOf, isDomainAllowlisted, SsrfError } from './ssrf';
import { hashHex } from './normalize';
import { defaultRuntime, loadLastSearchAt, loadSources, saveSources } from './store';

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function error(message: string, status = 400): Response {
  return json({ error: message }, status);
}

export async function handleOsintRequest(
  request: Request,
  env: Env,
  pathname: string,
): Promise<Response> {
  const auth = await requireOsintAdmin(request, env);
  if (auth.ok === false) return auth.response;

  const kv = env.PAYPAL_KV;

  /* -------------------------------------------------------------- */
  /* Estado del sistema                                              */
  /* -------------------------------------------------------------- */
  if (pathname === '/api/osint/status' && request.method === 'GET') {
    const sources = await loadSources(kv);
    const warnings: string[] = [];
    let requestsTotal = 0;
    let requestsToday = 0;
    for (const s of sources) {
      requestsTotal += s.runtime.requestsTotal;
      requestsToday += s.runtime.requestsToday;
      const secretMissing =
        s.secretVar &&
        !String((env as unknown as Record<string, unknown>)[s.secretVar] || '').trim();
      if (s.enabled && (s.runtime.status === 'pending_setup' || secretMissing)) {
        warnings.push(
          s.secretVar
            ? `${s.name}: falta el secreto ${s.secretVar} (wrangler secret put ${s.secretVar}).`
            : `${s.name}: pendiente de configuración.`,
        );
      }
      if (s.runtime.status === 'rate_limited') {
        warnings.push(`${s.name}: en espera por límite de tasa del proveedor.`);
      }
      if (s.enabled && s.runtime.status === 'error' && s.runtime.lastError) {
        warnings.push(`${s.name}: ${s.runtime.lastError}`);
      }
      if (s.enabled && s.runtime.status === 'active' && s.internalDailyLimit && s.runtime.requestsToday >= s.internalDailyLimit) {
        warnings.push(`${s.name}: límite interno diario alcanzado (${s.runtime.requestsToday}/${s.internalDailyLimit}).`);
      }
    }
    const body: OsintStatusResponse = {
      sources,
      lastSearchAt: await loadLastSearchAt(kv),
      totals: { requestsTotal, requestsToday },
      warnings,
    };
    return json(body);
  }

  /* -------------------------------------------------------------- */
  /* Búsqueda                                                        */
  /* -------------------------------------------------------------- */
  if (pathname === '/api/osint/search' && request.method === 'POST') {
    let body: OsintSearchRequest;
    try {
      body = (await request.json()) as OsintSearchRequest;
    } catch {
      return error('Cuerpo JSON inválido.');
    }
    try {
      const result = await searchAll(env, body);
      return json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error en la búsqueda OSINT.';
      console.error('[BLACKNEWS WORKER] osint search:', message);
      return error(message, 400);
    }
  }

  /* -------------------------------------------------------------- */
  /* Fuentes                                                         */
  /* -------------------------------------------------------------- */
  if (pathname === '/api/osint/sources' && request.method === 'GET') {
    const sources = await loadSources(kv);
    return json({ sources });
  }

  if (pathname === '/api/osint/sources' && request.method === 'PUT') {
    let body: { id: string; enabled?: boolean; internalDailyLimit?: number };
    try {
      body = await request.json();
    } catch {
      return error('Cuerpo JSON inválido.');
    }
    if (!body.id) return error('Falta el id de la fuente.');
    const sources = await loadSources(kv);
    const target = sources.find((s) => s.id === body.id);
    if (!target) return error('Fuente no encontrada.', 404);
    if (body.enabled !== undefined) target.enabled = Boolean(body.enabled);
    if (body.internalDailyLimit !== undefined) {
      const n = Math.floor(Number(body.internalDailyLimit));
      if (!Number.isFinite(n) || n < 0 || n > 100000) {
        return error('Límite interno inválido (0–100000 por día).');
      }
      target.internalDailyLimit = n === 0 ? undefined : n;
    }
    await saveSources(kv, sources);
    return json({ ok: true, source: { ...target } });
  }

  if (pathname === '/api/osint/sources' && request.method === 'POST') {
    let body: { name?: string; url?: string; languages?: string[]; internalDailyLimit?: number };
    try {
      body = await request.json();
    } catch {
      return error('Cuerpo JSON inválido.');
    }
    const name = (body.name || '').trim();
    const url = (body.url || '').trim();
    if (name.length < 2) return error('La fuente necesita un nombre (mín. 2 caracteres).');
    let parsed: URL;
    try {
      parsed = assertSafeOutboundUrl(url);
    } catch (err) {
      return error(err instanceof SsrfError ? err.message : 'URL inválida.');
    }
    if (!isDomainAllowlisted(parsed.hostname, env.OSINT_RSS_ALLOWLIST)) {
      return error(
        `El dominio ${parsed.hostname} no está en la allowlist del Worker. Añádelo a OSINT_RSS_ALLOWLIST (wrangler.jsonc o wrangler secret) y vuelve a intentarlo.`,
      );
    }
    const sources = await loadSources(kv);
    const id = `rss-custom-${hashHex(parsed.hostname + parsed.pathname)}`;
    if (sources.some((s) => s.id === id)) return error('Ese feed ya está registrado.', 409);
    const custom: OsintSourceConfig = {
      id,
      name,
      kind: 'rss',
      enabled: true,
      url: parsed.toString(),
      docs: parsed.origin,
      description: `Feed RSS personalizado (${parsed.hostname}).`,
      categories: ['*'],
      languages: (body.languages || []).map((l) => l.toLowerCase()).filter(Boolean).length
        ? (body.languages || []).map((l) => l.toLowerCase())
        : ['*'],
      regions: ['*'],
      authMethod: 'none',
      internalDailyLimit: body.internalDailyLimit || 60,
      custom: true,
    };
    sources.push({ ...custom, runtime: defaultRuntime(custom.id) });
    await saveSources(kv, sources);
    return json({ ok: true, source: custom }, 201);
  }

  if (pathname === '/api/osint/sources' && request.method === 'DELETE') {
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return error('Falta el id de la fuente.');
    const sources = await loadSources(kv);
    const target = sources.find((s) => s.id === id);
    if (!target) return error('Fuente no encontrada.', 404);
    if (!target.custom) return error('Sólo se pueden eliminar fuentes personalizadas.');
    await saveSources(kv, sources.filter((s) => s.id !== id));
    return json({ ok: true });
  }

  /* -------------------------------------------------------------- */
  /* Prueba de conexión (SSRF + vista previa de datos reales)        */
  /* -------------------------------------------------------------- */
  if (pathname === '/api/osint/sources/test' && request.method === 'POST') {
    let body: { url?: string };
    try {
      body = await request.json();
    } catch {
      return error('Cuerpo JSON inválido.');
    }
    const url = (body.url || '').trim();
    let parsed: URL;
    try {
      parsed = assertSafeOutboundUrl(url);
    } catch (err) {
      return error(err instanceof SsrfError ? err.message : 'URL inválida.');
    }
    if (!isDomainAllowlisted(parsed.hostname, env.OSINT_RSS_ALLOWLIST)) {
      return error(`El dominio ${parsed.hostname} no está en la allowlist (OSINT_RSS_ALLOWLIST).`);
    }
    const now = new Date();
    try {
      const out = await searchRssFeed(
        { name: 'prueba', url: parsed.toString(), language: '*' },
        {
          env,
          config: { id: 'test', name: 'prueba', kind: 'rss', enabled: true, description: '', categories: ['*'], languages: ['*'], regions: ['*'], authMethod: 'none', url: parsed.toString() },
          query: '',
          from: new Date(now.getTime() - 30 * 24 * 3_600_000),
          to: now,
          max: 5,
        },
      );
      return json({
        ok: true,
        preview: out.items.slice(0, 5).map((i) => ({ title: i.title, url: i.url, publishedAt: i.publishedAt })),
        total: out.items.length,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo leer el feed.';
      return json({ ok: false, error: message }, 502);
    }
  }

  /* -------------------------------------------------------------- */
  /* Traducción automática al español (al importar; IA del proyecto)  */
  /* -------------------------------------------------------------- */
  if (pathname === '/api/osint/translate' && request.method === 'POST') {
    let body: { title?: string; snippet?: string };
    try {
      body = await request.json();
    } catch {
      return error('Cuerpo JSON inválido.');
    }
    const title = (body.title || '').trim();
    if (title.length < 2 || title.length > 2000) {
      return error('El titular a traducir debe tener entre 2 y 2000 caracteres.');
    }
    const snippet = (body.snippet || '').trim().slice(0, 1500) || undefined;
    const out = await translateFinding(env, { title, snippet });
    // ok:false es una respuesta legítima (sin proveedor o ilegible): el
    // importador usará el original. Sólo los fallos de formulario son 4xx.
    return json(out);
  }

  return error('Ruta OSINT no encontrada.', 404);
}
