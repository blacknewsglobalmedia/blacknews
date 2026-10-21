/**
 * BLACKNEWS OSINT — Protección SSRF para las salidas del Worker.
 *
 * El módulo sólo permite que el servidor salga a la red hacia:
 * - los endpoints built-in autorizados (GDELT, OpenAlex, Wikidata, feeds
 *   públicos predefinidos), y
 * - feeds RSS personalizados CUYO DOMINIO esté en la allowlist
 *   `OSINT_RSS_ALLOWLIST` (variable del Worker, vacía por defecto → los
 *   feeds personalizados quedan deshabilitados).
 *
 * Se bloquean: esquemas no http(s), credenciales en la URL, localhost,
 * nombres `.local`/`.internal`, direcciones IP literales privadas y la
 * metadata de cloud (169.254.169.254). Límite conocido: en Workers no
 * existe un hook de resolución DNS previa, así que un host de la allowlist
 * que apunte a una IP privada no podría detectarse antes del fetch; por eso
 * la allowlist es restrictiva por diseño (ver docs/osint.md).
 */

/** Hosts SIEMPRE bloqueados, pase lo que pase. */
const BLOCKED_HOSTS = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata',
  'instance-data',
]);

const BLOCKED_HOST_SUFFIXES = ['.localhost', '.local', '.internal', '.home.arpa'];

export class SsrfError extends Error {}

function isIpv4(host: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
}

function isBlockedIpv4(host: string): boolean {
  const parts = host.split('.').map(Number);
  const [a, b] = parts;
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local / cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 192 && b === 0) return true; // 192.0.0.0/24 (incluye 192.0.2.x TEST-NET)
  if (a >= 224) return true; // multicast + reservado
  return false;
}

function isBlockedIpv6(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, '').toLowerCase();
  if (h === '::1' || h === '::') return true;
  if (h.startsWith('fe80')) return true; // link-local
  if (h.startsWith('fc') || h.startsWith('fd')) return true; // unique local
  if (h.startsWith('::ffff:')) return isBlockedIpv4(h.slice(7)); // mapeadas
  return false;
}

/**
 * Valida una URL de salida y devuelve el objeto URL normalizado.
 * Lanza `SsrfError` con mensaje apto para el administrador.
 */
export function assertSafeOutboundUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new SsrfError(`URL inválida: ${raw.slice(0, 120)}`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new SsrfError(`Esquema no permitido: ${url.protocol}`);
  }
  if (url.username || url.password) {
    throw new SsrfError('La URL no puede contener credenciales.');
  }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (BLOCKED_HOSTS.has(host)) throw new SsrfError(`Host bloqueado: ${host}`);
  for (const suffix of BLOCKED_HOST_SUFFIXES) {
    if (host.endsWith(suffix)) throw new SsrfError(`Host bloqueado: ${host}`);
  }
  if (isIpv4(host) && isBlockedIpv4(host)) {
    throw new SsrfError(`Dirección privada bloqueada: ${host}`);
  }
  if (host.includes(':') && isBlockedIpv6(host)) {
    throw new SsrfError(`Dirección privada bloqueada: ${host}`);
  }
  return url;
}

/** Extrae el hostname en minúsculas sin lanzar (para allowlists). */
export function hostnameOf(raw: string): string | null {
  try {
    return new URL(raw).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * ¿El hostname pertenece a la allowlist de RSS personalizado?
 * `OSINT_RSS_ALLOWLIST` = lista separada por comas de dominios exactos
 * (ej. "un.org,bbc.co.uk"). Vacía → ningún feed personalizado permitido.
 */
export function isDomainAllowlisted(hostname: string, allowlistCsv: string | undefined): boolean {
  const list = (allowlistCsv || '')
    .split(',')
    .map((d) => d.trim().toLowerCase().replace(/^\.|\/+$/g, ''))
    .filter(Boolean);
  if (list.length === 0) return false;
  const host = hostname.toLowerCase();
  // Coincidencia exacta o subdominio del dominio listado (bbc.co.uk cubre
  // feeds.bbci.co.uk sólo si se lista bbci.co.uk; se decide explícito).
  return list.some((d) => host === d || host.endsWith(`.${d}`));
}
