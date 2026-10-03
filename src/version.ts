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
