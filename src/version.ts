import { dateIn, timeIn, REFERENCE_TZ } from './utils/clock';

/**
 * Versión base de la aplicación (incremento manual, semántica).
 */
export const APP_VERSION = '2.4.0';

/**
 * Sello de build inyectado por Vite (`define` en vite.config.ts).
 * Cambia automáticamente en cada compilación, por lo que el footer permite
 * verificar en cada despliegue que la producción ejecuta el último build.
 * En tiempo de desarrollo (sin inyección) cae a "dev".
 */
declare const __BUILD_STAMP__: string;

export const BUILD_STAMP: string =
  typeof __BUILD_STAMP__ === 'string' ? __BUILD_STAMP__ : 'dev';

/**
 * Sello legible a partir de `BUILD_STAMP` (que llega en UTC, YYYYMMDD-
 * HHMMSS): «04 oct 2026, 02:59 (hora Uruguay)». Se muestra en la zona de
 * referencia del sitio para que el pie se lea de un vistazo y siga sirviendo
 * para comprobar en cada despliegue qué build está en producción.
 * En desarrollo (sin inyección) devuelve el propio sello, p. ej. «dev».
 */
export const BUILD_STAMP_LABEL: string = (() => {
  const m = /^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})$/.exec(BUILD_STAMP);
  if (!m) return BUILD_STAMP;
  const utc = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]));
  return `${dateIn(REFERENCE_TZ, utc)}, ${timeIn(REFERENCE_TZ, utc)} (hora Uruguay)`;
})();
