/**
 * BLACKNEWS OSINT — Verificación de administración en el BACKEND.
 *
 * El módulo OSINT es privado: además del control de rol en el frontend
 * (peña sólo para ADMIN), el Worker exige una de estas dos pruebas:
 *
 * 1. **Google ID token** (ruta principal): el frontend envía el ID token de
 *    Firebase Auth (`auth.currentUser.getIdToken()`); el Worker verifica la
 *    firma RS256 contra los certs públicos de Google
 *    (https://www.googleapis.com/identity/v1/certs), comprueba exp/iss y
 *    que el email del token esté en `OSINT_ADMIN_EMAILS` (allowlist).
 *    Sin esta variable configurada el módulo queda CERRADO (fail-closed).
 *
 * 2. **Token administrativo compartido** (CI/scripts/desarrollo local):
 *    cabecera `x-bn-admin-token` que debe coincidir con el secreto
 *    `OSINT_ADMIN_TOKEN` (`wrangler secret put OSINT_ADMIN_TOKEN`).
 *    Si el secreto no está definido, esta vía no existe.
 *
 * Ninguna de las dos expone secretos al navegador: la primera verifica un
 * token firmado por Google, la segunda exige un secreto que vive en el
 * Worker. Los mensajes de error no filtran configuración.
 */

interface EnvLike {
  OSINT_ADMIN_EMAILS?: string;
  OSINT_ADMIN_TOKEN?: string;
}

export interface OsintAuthInfo {
  via: 'google' | 'token';
  email?: string;
}

interface CertEntry {
  kid: string;
  n: string;
  e: string;
  kty: string;
  alg?: string;
  use?: string;
}

const CERTS_URL = 'https://www.googleapis.com/identity/v1/certs';
/** Caché por aislamiento del Worker (1 h). */
let certCache: { certs: CertEntry[]; fetchedAt: number } | null = null;

function b64urlToBytes(input: string): Uint8Array {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function getGoogleCerts(): Promise<CertEntry[]> {
  if (certCache && Date.now() - certCache.fetchedAt < 3_600_000) return certCache.certs;
  const res = await fetch(CERTS_URL, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Google certs HTTP ${res.status}`);
  const body = (await res.json()) as { keys?: CertEntry[] };
  const keys = (body.keys || []).filter((k) => k.kty === 'RSA');
  if (keys.length === 0) throw new Error('Google certs vacíos');
  certCache = { certs: keys, fetchedAt: Date.now() };
  return keys;
}

interface TokenPayload {
  iss?: string;
  aud?: string;
  sub?: string;
  email?: string;
  email_verified?: boolean;
  exp?: number;
  iat?: number;
  [k: string]: unknown;
}

/**
 * Verifica la firma y los campos básicos de un Google/Firebase ID token.
 * Devuelve el payload o null si no es válido. No lanza.
 */
export async function verifyGoogleIdToken(
  token: string,
  expectedAudience?: string,
): Promise<TokenPayload | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  let header: { alg?: string; kid?: string };
  let payload: TokenPayload;
  try {
    header = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[0])));
    payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[1])));
  } catch {
    return null;
  }
  if (header.alg !== 'RS256') return null;
  // Issuer: Firebase Auth (securetoken.google.com/<proyecto>) o Google Accounts.
  const iss = payload.iss || '';
  const issOk =
    iss.startsWith('https://securetoken.google.com/') ||
    iss === 'https://accounts.google.com' ||
    iss === 'accounts.google.com';
  if (!issOk) return null;
  const nowSec = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number' || payload.exp <= nowSec) return null;
  if (expectedAudience && payload.aud && payload.aud !== expectedAudience) return null;
  if (payload.email_verified === false) return null;

  try {
    const certs = await getGoogleCerts();
    const candidates = header.kid ? certs.filter((c) => c.kid === header.kid) : certs;
    const data = b64urlToBytes(parts[2]);
    for (const cert of candidates) {
      try {
        const key = await crypto.subtle.importKey(
          'jwk',
          { kty: 'RSA', n: cert.n, e: cert.e, alg: 'RS256', ext: true },
          { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
          false,
          ['verify'],
        );
        const ok = await crypto.subtle.verify(
          { name: 'RSASSA-PKCS1-v1_5' },
          key,
          data as unknown as ArrayBuffer,
          b64urlToBytes(parts[0] + '.' + parts[1]) as unknown as ArrayBuffer,
        );
        if (ok) return payload;
      } catch {
        // cert inutilizable → probamos el siguiente
      }
    }
  } catch {
    return null;
  }
  return null;
}

/** `OSINT_ADMIN_EMAILS` en minúsculas, sin vacíos. */
export function adminEmailAllowlist(env: EnvLike): string[] {
  return (env.OSINT_ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Middleware de acceso a /api/osint/*. Devuelve null si el acceso está
 * concedido; una Response 401/403 en caso contrario.
 */
export async function requireOsintAdmin(
  request: Request,
  env: EnvLike,
): Promise<{ ok: true; auth: OsintAuthInfo } | { ok: false; response: Response }> {
  const denied = (msg: string, status: number) =>
    ({
      ok: false as const,
      response: new Response(JSON.stringify({ error: msg }), {
        status,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      }),
    });

  // Vía 2: token administrativo compartido (secreto del Worker).
  const shared = (env.OSINT_ADMIN_TOKEN || '').trim();
  const providedToken = (request.headers.get('x-bn-admin-token') || '').trim();
  if (shared && providedToken && providedToken === shared) {
    return { ok: true, auth: { via: 'token' } };
  }

  // Vía 1: Google ID token + allowlist de administradores.
  const auth = request.headers.get('authorization') || '';
  const match = /^Bearer\s+(.+)$/i.exec(auth);
  if (!match) {
    return denied(
      'Acceso OSINT no autorizado: inicia sesión con Google en el panel o envía un token administrativo.',
      401,
    );
  }
  const allowlist = adminEmailAllowlist(env);
  if (allowlist.length === 0 && !shared) {
    return denied(
      'Módulo OSINT sin configurar: define OSINT_ADMIN_EMAILS (y/u OSINT_ADMIN_TOKEN) en el Worker.',
      403,
    );
  }
  const payload = await verifyGoogleIdToken(match[1]);
  if (!payload) {
    return denied('Token de Google inválido o expirado.', 401);
  }
  const email = (payload.email || '').toLowerCase();
  if (!email || !allowlist.includes(email)) {
    return denied('Esta cuenta no está autorizada para OSINT.', 403);
  }
  return { ok: true, auth: { via: 'google', email } };
}
