/**
 * BLACKNEWS OSINT — Cliente HTTP del módulo (navegador → Worker).
 *
 * Seguridad: el navegador NUNCA ve claves de fuentes. Todas las
 * consultas salen del Worker (/api/osint/*), que exige administración:
 * - Google ID token de Firebase Auth (cabecera Authorization), verificado
 *   en el Worker contra los certs de Google + allowlist de correos, o
 * - token administrativo (modo asistente/CI): si existe
 *   `sessionStorage.BN_OSINT_TOKEN` se envía como `x-bn-admin-token`.
 *   Sólo lo usa quien ya posee un token válido; no expone nada.
 */
import { auth } from '../firebase';
import type {
  OsintSearchRequest,
  OsintSearchResponse,
  OsintSourceConfig,
  OsintStatusResponse,
} from '../types/osint';

const BASE = '/api/osint';

async function adminHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  try {
    const user = auth.currentUser;
    if (user) {
      headers.authorization = `Bearer ${await user.getIdToken()}`;
      return headers;
    }
  } catch {
    // sin sesión de Google → seguimos con el modo asistente si existe
  }
  const assistant = sessionStorage.getItem('BN_OSINT_TOKEN');
  if (assistant) headers['x-bn-admin-token'] = assistant;
  return headers;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { ...(await adminHeaders()), ...(init?.headers || {}) },
  });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(body?.error || `Error ${res.status} en el módulo OSINT.`);
  }
  return body;
}

export const osintApi = {
  status: () => request<OsintStatusResponse>('/status'),

  search: (body: OsintSearchRequest) =>
    request<OsintSearchResponse>('/search', { method: 'POST', body: JSON.stringify(body) }),

  sources: () => request<{ sources: Array<OsintSourceConfig & { runtime: OsintStatusResponse['sources'][number]['runtime'] }> }>('/sources'),

  updateSource: (id: string, patch: { enabled?: boolean; internalDailyLimit?: number }) =>
    request<{ ok: boolean }>('/sources', { method: 'PUT', body: JSON.stringify({ id, ...patch }) }),

  createSource: (body: { name: string; url: string; languages?: string[]; internalDailyLimit?: number }) =>
    request<{ ok: boolean; source: OsintSourceConfig }>('/sources', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  deleteSource: (id: string) =>
    request<{ ok: boolean }>(`/sources?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),

  testSource: (url: string) =>
    request<{ ok: boolean; preview?: Array<{ title: string; url: string; publishedAt?: string }>; total?: number; error?: string }>(
      '/sources/test',
      { method: 'POST', body: JSON.stringify({ url }) },
    ),

  /** Traducción automática al español con la IA gratuita del Worker. */
  translate: (title: string, snippet?: string) =>
    request<{ ok: boolean; title?: string; snippet?: string; provider?: string; error?: string }>(
      '/translate',
      { method: 'POST', body: JSON.stringify({ title, snippet }) },
    ),
};
