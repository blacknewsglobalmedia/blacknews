import { dateIn, timeIn, REFERENCE_TZ } from './utils/clock';

/**
 * Versión base de la aplicación (incremento manual, semántica).
 */
export const APP_VERSION = '2.4.0';

/**
 * Sello de build inyectado por el plugin `bn-build-stamp` de vite.config.ts
 * como `<meta name="build-stamp">` en el <head> de index.html. Cambia en cada
 * compilación, por lo que el footer permite verificar en cada despliegue que
 * la producción ejecuta el último build.
 *
 * Se lee del HTML —cuya URL «/» es estable— y no del bundle: una marca de
 * tiempo embebida en el JS alteraría su hash en cada build, renombraría
 * assets/index-*.js sin que el código cambie y desincronizaría el service
 * worker de los visitantes.
 *
 * El módulo se evalúa tras parsearse el HTML (el script es `type="module"`,
 * diferido), así que la meta ya existe. En tiempo de desarrollo el plugin no
 * inyecta nada y cae a "dev".
 */
export const BUILD_STAMP: string =
  (typeof document !== 'undefined'
    ? document
        .querySelector<HTMLMetaElement>('meta[name="build-stamp"]')
        ?.content.trim()
    : undefined) || 'dev';

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
