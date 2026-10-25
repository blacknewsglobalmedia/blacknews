import React from "react";
import { ArrowUpRight } from "lucide-react";
import { Report } from "../types/news";
import { FENOMENOS_SECTION } from "../data/newsData";
import { OptimizedPicture } from "./OptimizedPicture";
import { readTimeOf } from "../utils/readTime";

interface FenomenosSectionProps {
  reports: Report[];
  onReadReport: (report: Report) => void;
  onSelectCategory: (category: string) => void;
}

/**
 * Bloque fijo de portada «FENÓMENOS & ANOMALÍAS».
 *
 * A diferencia del chip de navegación, este bloque se muestra SIEMPRE en la
 * portada para que la sección sea visible sin buscarla. Mantiene la
 * identidad de expediente (monoespaciada, bordes punteados, sello y marcas
 * de censura decorativas): atmósfera de archivo, sin ocultar nada real.
 *
 * Todo es estático (sin animaciones nuevas; solo hover de estado como en el
 * resto de la portada) y fail-open: si no hay despachos publicados se
 * muestra un hueco vacío en vez de la lista.
 */
export const FenomenosSection: React.FC<FenomenosSectionProps> = ({
  reports,
  onReadReport,
  onSelectCategory,
}) => {
  const items = reports
    .filter((r) => r.category === FENOMENOS_SECTION)
    .slice(0, 3);

  return (
    <section className="border-t border-white/10 bg-black font-sans" data-assemble>
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-10 sm:py-12">
        {/* Cabecera de expediente: título mono + sello + contador */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pb-4 mb-3 border-b border-dashed border-white/20">
          <span className="bn-redact" aria-hidden="true"></span>
          <h2 className="font-mono text-lg sm:text-xl font-semibold uppercase tracking-[0.18em] text-white min-w-0">
            {FENOMENOS_SECTION}
          </h2>
          <span className="bn-file-stamp" aria-hidden="true">
            Expediente abierto
          </span>
          <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-500">
            Archivo vivo · {items.length} despacho{items.length === 1 ? "" : "s"}
          </span>
        </div>

        <p className="mb-6 text-sm text-neutral-400 max-w-2xl leading-relaxed">
          Avistamientos, señales y fenómenos documentados. Se publica solo lo
          verificable: coincidencia entre fuentes, datos abiertos y ningún
          salto hacia la especulación.
        </p>

        {items.length === 0 ? (
          <div className="border border-dashed border-white/20 rounded-lg p-8 sm:p-10 text-center">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-neutral-500">
              Sin despachos en el expediente
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {items.map((report) => (
              <article
                key={report.id}
                data-piece
                onClick={() => onReadReport(report)}
                className="group flex flex-col border border-dashed border-white/20 rounded-lg overflow-hidden hover:border-white/40 hover:bg-white/[0.02] transition-colors cursor-pointer"
              >
                <div className="relative w-full aspect-[16/9] overflow-hidden">
                  <OptimizedPicture
                    image={report.optimizedImage || report.image}
                    alt={report.title}
                    priority={false}
                    aspectRatio="16/9"
                    className="w-full h-full"
                    imgClassName="group-hover:scale-[1.015] transition-transform duration-500 ease-out"
                  />
                </div>

                <div className="flex flex-1 flex-col gap-2 p-4">
                  <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-500">
                    <span className="border border-dashed border-white/40 px-1.5 py-0.5 text-neutral-300 rounded-sm">
                      Caso
                    </span>
                    <span className="truncate">{report.publishedAt}</span>
                  </div>

                  <h3 className="font-headline text-base sm:text-lg text-white leading-snug group-hover:text-neutral-200 transition-colors line-clamp-2">
                    {report.title}
                  </h3>

                  {report.subtitle && (
                    <p className="text-xs text-neutral-400 leading-relaxed line-clamp-2">
                      {report.subtitle}
                    </p>
                  )}

                  <div className="mt-auto pt-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-500">
                    <span>{readTimeOf(report)}</span>
                    <span className="inline-flex items-center gap-1 text-neutral-300 group-hover:text-white transition-colors">
                      Leer
                      <ArrowUpRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => onSelectCategory(FENOMENOS_SECTION)}
          className="mt-6 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-neutral-400 hover:text-white transition-colors cursor-pointer border border-dashed border-white/30 hover:border-white/60 rounded-md px-4 py-2.5"
        >
          Ver el cuaderno completo
          <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </section>
  );
};
