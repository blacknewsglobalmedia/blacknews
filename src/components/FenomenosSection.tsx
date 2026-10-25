import React from "react";
import { ArrowUpRight } from "lucide-react";
import { Report } from "../types/news";
import { FENOMENOS_SECTION } from "../data/newsData";
import { OptimizedPicture } from "./OptimizedPicture";
import { readTimeOf } from "../utils/readTime";
import { useDecodeText } from "../lib/decode";

interface FenomenosSectionProps {
  reports: Report[];
  onReadReport: (report: Report) => void;
  onSelectCategory: (category: string) => void;
}

/**
 * Bloque fijo de portada «FENÓMENOS & ANOMALÍAS».
 *
 * Se muestra SIEMPRE en la portada para que la sección sea visible sin
 * buscarla en los chips. Identidad de expediente con aire tétrico de sala de
 * archivo: monoespaciada, bordes punteados, sello, marcas de censura
 * DECORATIVAS y fichas por caso — nada de contenido oculto de verdad.
 *
 * Animación (solo dentro del sistema assemble, así respeta
 * prefers-reduced-motion y el interruptor EFECTO):
 *  - el bloque se arma al entrar en pantalla: piezas escalonadas con los
 *    contornos punteados del ensamblado;
 *  - el título se escribe con decode (glifos de terminal, cursor parpadeante)
 *    cuando le toca su turno; si el efecto está apagado, sale plano.
 * Todo lo demás es estático: ni keyframes ni transiciones nuevas.
 */
export const FenomenosSection: React.FC<FenomenosSectionProps> = ({
  reports,
  onReadReport,
  onSelectCategory,
}) => {
  const items = reports
    .filter((r) => r.category === FENOMENOS_SECTION)
    .slice(0, 3);

  // Escritura del titular: arranca cuando la pieza recibe su turno (.in).
  const titleDec = useDecodeText<HTMLHeadingElement>(FENOMENOS_SECTION, {
    startDelayMs: 320,
  });

  const totalMin = items.reduce(
    (sum, r) => sum + (parseInt(readTimeOf(r), 10) || 0),
    0,
  );

  return (
    <section className="relative border-t border-white/10 bg-black font-sans">
      {/* Viñeta estática de sala de archivo: sin movimiento, solo atmósfera */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(110%_75%_at_50%_-10%,rgba(255,255,255,0.05),transparent_55%)]"
      />

      <div
        className="relative max-w-[1400px] mx-auto px-4 sm:px-6 py-10 sm:py-12"
        data-assemble
        data-step="100"
      >
        {/* 1 · Cabecera: marcas de censura + titular que se escribe solo */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pb-4 border-b border-dashed border-white/20">
          <h2
            data-piece
            ref={titleDec.ref}
            className="font-mono text-lg sm:text-xl font-semibold uppercase tracking-[0.18em] text-white min-w-0 flex items-center"
          >
            <span className="bn-redact" aria-hidden="true"></span>
            {titleDec.view ? (
              <>
                <span aria-hidden="true">
                  {titleDec.view.done}
                  <span className="asm-cursor asm-hot font-mono">
                    {titleDec.view.cursor}
                  </span>
                  <span className="asm-hot font-mono">
                    {titleDec.view.active}
                  </span>
                  <span className="text-neutral-700 font-mono">
                    {titleDec.view.quiet}
                  </span>
                </span>
                <span className="sr-only">{FENOMENOS_SECTION}</span>
              </>
            ) : (
              FENOMENOS_SECTION
            )}
          </h2>
          <span data-piece className="bn-file-stamp" aria-hidden="true">
            Expediente abierto
          </span>
        </div>

        {/* 2 · Tira de lectura del expediente (retórica de archivo público) */}
        <div
          data-piece
          className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-500"
        >
          <span>
            Estado: <span className="text-neutral-300">abierto</span>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            Acceso: <span className="text-neutral-300">público</span>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            Clasificación: <span className="text-neutral-300">sin tachar</span>
          </span>
          <span aria-hidden="true">·</span>
          <span className="text-neutral-600">exp-2026/fen</span>
        </div>

        {/* 3 · Bajada */}
        <p
          data-piece
          className="mt-5 mb-6 text-sm text-neutral-400 max-w-2xl leading-relaxed"
        >
          Avistamientos, señales y fenómenos documentados. Aquí caben las
          preguntas sin respuesta — pero solo si cada respuesta trae su fuente.
        </p>

        {items.length === 0 ? (
          <div className="border border-dashed border-white/20 rounded-lg p-8 sm:p-10 text-center">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-neutral-500">
              La carpeta está vacía. Todavía.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {items.map((report, i) => {
              const folio = String(i + 1).padStart(3, "0");
              return (
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
                    {/* Número de expediente con redacción simulada delante:
                        el número es legible; la barra es decorativa. */}
                    <div className="absolute top-3 left-3 flex items-center bg-black/85 backdrop-blur-sm text-neutral-300 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.18em] rounded-sm border border-dashed border-white/50">
                      <span className="bn-redact" aria-hidden="true"></span>
                      EXP·2026·{folio}
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col gap-2 p-4">
                    <div className="flex items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-500">
                      <span className="truncate">
                        Archivo: {report.publishedAt}
                      </span>
                      <span className="text-neutral-600 shrink-0">
                        folio {folio}
                      </span>
                    </div>

                    <h3 className="font-headline text-base sm:text-lg text-white leading-snug group-hover:text-neutral-200 transition-colors line-clamp-2">
                      {report.title}
                    </h3>

                    {report.subtitle && (
                      <p className="text-xs text-neutral-400 leading-relaxed line-clamp-2">
                        {report.subtitle}
                      </p>
                    )}

                    <div className="mt-auto pt-3 border-t border-dotted border-white/15 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-500">
                      <span>{readTimeOf(report)}</span>
                      <span className="inline-flex items-center gap-1 text-neutral-300 group-hover:text-white transition-colors">
                        Leer
                        <ArrowUpRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* 4 · Pie del expediente: cifras honestas + nota irónica del archivo
            + acceso al cuaderno completo */}
        <div
          data-piece
          className="mt-6 border-t border-dashed border-white/20 pt-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-500">
              <span>
                Casos en carpeta:{" "}
                <span className="text-neutral-300">{items.length}</span>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Lectura total:{" "}
                <span className="text-neutral-300">{totalMin} min</span>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Tachaduras reales: <span className="text-neutral-300">0</span>
              </span>
            </div>

            <button
              type="button"
              onClick={() => onSelectCategory(FENOMENOS_SECTION)}
              className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-neutral-400 hover:text-white transition-colors cursor-pointer border border-dashed border-white/30 hover:border-white/60 rounded-md px-4 py-2.5"
            >
              Ver el cuaderno completo
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-600 leading-relaxed">
            Nota de archivo: las marcas de censura son decorativas; ningún
            texto del expediente está tachado.
          </p>
        </div>
      </div>
    </section>
  );
};
