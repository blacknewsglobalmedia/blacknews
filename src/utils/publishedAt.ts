import { Report } from "../types/news";

/**
 * Fecha que se muestra en las tarjetas y en la cabecera del artículo.
 *
 * El editor escribía siempre el mismo texto fijo («24 Sep 2026 · Despacho
 * Reciente»), así que todas las noticias publicadas enseñaban la misma
 * fecha. `formatPublishedAt` genera la fecha real y `healPublishedAt`
 * corrige los reportes antiguos derivándola del id (`rep-custom-<ms>`),
 * con la de hoy como último recurso.
 */

export const LEGACY_PUBLISHED_AT = "24 Sep 2026 · Despacho Reciente";

/** Texto de fecha tipo «04 oct 2026 · Despacho Reciente». */
export function formatPublishedAt(date: Date = new Date()): string {
  const day = date.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  return `${day} · Despacho Reciente`;
}

/** Devuelve el reporte con la fecha corregida si aún guarda el valor fijo. */
export function healPublishedAt(report: Report): Report {
  if (report.publishedAt !== LEGACY_PUBLISHED_AT) return report;
  const ts = /^rep-custom-(\d{13})$/.exec(report.id)?.[1];
  const date = ts ? new Date(Number(ts)) : new Date();
  return { ...report, publishedAt: formatPublishedAt(date) };
}
