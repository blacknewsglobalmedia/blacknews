/**
 * BLACKNEWS OSINT — Verificación de administración en el BACKEND.
 *
 * El módulo OSINT es privado: además del control de rol en el frontend
 * (peña sólo para ADMIN), el Worker exige una de estas dos pruebas:
 *
 * 1. **Google ID token** (ruta principal): el frontend envía el ID token de
 *    Firebase Auth (`auth.currentUser.getIdToken()`); el Worker verifica la
 *    firma RS256 contra las claves públicas de Firebase
 *    (https://www.googleapis.com/identitytoolkit/v3/relyingparty/publicKeys,
 *    el mismo endpoint que usa firebase-admin), comprueba exp/iss y
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
  pem: string;
}

/**
 * Claves públicas con las que Firebase firma sus ID tokens. Es el MISMO
 * endpoint que usan los SDKs de firebase-admin para verificar ID tokens
 * (formato JSON {kid: PEM x509}): lo documenta Firebase de forma literal
 * ("kid must correspond to one of the public keys listed at .../robot/v1/
 * metadata/x509/securetoken@system.gserviceaccount.com"). Verificado
 * 2026-10-21: HTTP 200, 4 claves (kids hex), Cache-Control ~6 h.
 *
 * Ojo con las dos trampas en las que ya se cayó aquí: el JWKS del mismo
 * service account sirve (mismos kids), pero `identitytoolkit/v3/relyingparty/
 * publicKeys` NO: ese juego de claves firma session cookies
 * (iss session.firebase.google.com), y su kid nunca coincide con el de un
 * ID token.
 */
const CERTS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
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
  const body = (await res.json()) as Record<string, unknown>;
  const keys: CertEntry[] = [];
  for (const [kid, pem] of Object.entries(body)) {
    if (typeof pem === 'string' && pem.includes('BEGIN CERTIFICATE')) keys.push({ kid, pem });
  }
  if (keys.length === 0) throw new Error('Google certs vacíos');
  certCache = { certs: keys, fetchedAt: Date.now() };
  return keys;
}

/** PEM x509 → DER (bytes del certificado completo). */
function pemToDer(pem: string): Uint8Array {
  return b64urlToBytes(
    pem
      .replace(/-----(BEGIN|END) CERTIFICATE-----/g, '')
      .replace(/\s+/g, ''),
  );
}

/* ASN.1 DER mínimo (sólo lectura de TLV) para recortar la SubjectPublicKey
 * Info de un certificado X509: WebCrypto importa 'spki' (la clave desnuda),
 * no el certificado entero. */
function tlvContentStart(buf: Uint8Array, pos: number): number {
  const b = buf[pos + 1];
  return b < 0x80 ? pos + 2 : pos + 2 + (b & 0x7f);
}

function tlvEnd(buf: Uint8Array, pos: number): number {
  const start = tlvContentStart(buf, pos);
  const b = buf[pos + 1];
  if (b < 0x80) return start + b;
  let len = 0;
  for (let i = 0; i < (b & 0x7f); i++) len = len * 256 + buf[pos + 2 + i];
  return start + len;
}

function x509ToSpki(der: Uint8Array): Uint8Array {
  // Certificate → tbsCertificate → (version?) serial, sigAlg, issuer,
  // validity, subject → subjectPublicKeyInfo.
  let pos = tlvContentStart(der, 0);
  pos = tlvContentStart(der, pos);
  if (der[pos] === 0xa0) pos = tlvEnd(der, pos); // [0] version (opcional)
  for (let i = 0; i < 5; i++) pos = tlvEnd(der, pos);
  return der.subarray(pos, tlvEnd(der, pos));
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

/** Resultado de la verificación: distingue token inválido de red caída. */
export type VerifyOutcome =
  | { ok: true; payload: TokenPayload }
  | { ok: false; reason: 'invalid' | 'unreachable' };

/**
 * Verifica la firma y los campos básicos de un ID token de Firebase.
 * Distingue `invalid` (el token no es válido: no culpar al servidor) de
 * `unreachable` (el servidor de claves de Google no respondió: no culpar
 * al usuario). No lanza.
 */
export async function verifyGoogleIdToken(
  token: string,
  expectedAudience?: string,
): Promise<VerifyOutcome> {
  const parts = token.split('.');
  if (parts.length !== 3) return { ok: false, reason: 'invalid' };
  let header: { alg?: string; kid?: string };
  let payload: TokenPayload;
  try {
    header = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[0])));
    payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[1])));
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  if (header.alg !== 'RS256') return { ok: false, reason: 'invalid' };
  // Issuer: sólo ID tokens de Firebase Auth (securetoken.google.com/<proyecto>),
  // que es exactamente lo que envía el frontend con getIdToken(). Un token
  // OAuth crudo (accounts.google.com) no está soportado: lo firma otro
  // juego de claves distinto.
  const iss = payload.iss || '';
  if (!iss.startsWith('https://securetoken.google.com/')) {
    return { ok: false, reason: 'invalid' };
  }
  const nowSec = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number' || payload.exp <= nowSec) {
    return { ok: false, reason: 'invalid' };
  }
  if (expectedAudience && payload.aud && payload.aud !== expectedAudience) {
    return { ok: false, reason: 'invalid' };
  }
  if (payload.email_verified === false) return { ok: false, reason: 'invalid' };

  try {
    const certs = await getGoogleCerts();
    const candidates = header.kid ? certs.filter((c) => c.kid === header.kid) : certs;
    const data = b64urlToBytes(parts[2]);
    for (const cert of candidates) {
      try {
        const key = await crypto.subtle.importKey(
          'spki',
          x509ToSpki(pemToDer(cert.pem)) as unknown as ArrayBuffer,
          { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
          false,
          ['verify'],
        );
        const ok = await crypto.subtle.verify(
          { name: 'RSASSA-PKCS1-v1_5' },
          key,
          data as unknown as ArrayBuffer,
          // Los bytes firmados son el texto "header.payload" tal cual
          // (UTF-8/ASCII); NO hay que decodificarlos de base64 (el punto
          // haría fallar a atob y la firma nunca verificaría).
          new TextEncoder().encode(`${parts[0]}.${parts[1]}`) as unknown as ArrayBuffer,
        );
        if (ok) return { ok: true, payload };
      } catch {
        // cert inutilizable → probamos el siguiente
      }
    }
  } catch {
    // Fallo al traer/procesar las claves de Google (red, HTTP, JSON):
    // problema del servidor, no del token.
    return { ok: false, reason: 'unreachable' };
  }
  return { ok: false, reason: 'invalid' };
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
  const outcome = await verifyGoogleIdToken(match[1]);
  if (outcome.ok === false) {
    return outcome.reason === 'unreachable'
      ? denied(
          'No se pudo verificar la firma de Google en este momento (servidor de claves no disponible); inténtalo de nuevo en unos segundos.',
          503,
        )
      : denied('Token de Google inválido o expirado.', 401);
  }
  const payload = outcome.payload;
  const email = (payload.email || '').toLowerCase();
  if (!email || !allowlist.includes(email)) {
    return denied('Esta cuenta no está autorizada para OSINT.', 403);
  }
  return { ok: true, auth: { via: 'google', email } };
}
