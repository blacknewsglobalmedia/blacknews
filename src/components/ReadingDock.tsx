import React from "react";
import { ArrowUp, BookOpen, Lock } from "lucide-react";
import { ReadMeter } from "../utils/readMeter";
import { scrollToTop } from "../utils/scroll";

interface ReadingDockProps {
  meter: ReadMeter;
  onOpenSubscription: () => void;
}

/**
 * Barra flotante inferior con el botón de volver arriba (antes solo existía
 * en el pie) y un aviso discreto de cuota: el contador de lecturas y el
 * acceso a suscripciones solo aparecen cuando quedan 0 o 1 lecturas
 * gratuitas del día; con holgura o sin límite la barra es solo el botón ↑.
 * No se muestra en la sala de redacción y queda por debajo de los modales (z-50).
 */
export const ReadingDock: React.FC<ReadingDockProps> = ({
  meter,
  onOpenSubscription,
}) => {
  const nearLimit = !meter.unlimited && meter.remaining <= 1;
  const exhausted = nearLimit && meter.exhausted;

  return (
    <div className="fixed bottom-9 right-3 z-40 flex justify-end pointer-events-none">
      <div
        className={`pointer-events-auto flex items-center gap-2 sm:gap-3 bg-neutral-950/95 backdrop-blur-md border border-white/15 rounded-full py-1.5 pr-1.5 shadow-2xl font-sans ${
          nearLimit ? "pl-3" : "pl-1.5"
        }`}
      >
        {/* Cuota del día: solo cuando queda 1 o ninguna lectura */}
        {nearLimit && (
          <>
            <span
              className={`flex items-center gap-2 text-[11px] font-semibold whitespace-nowrap ${
                exhausted ? "text-amber-400" : "text-neutral-300"
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">
                {exhausted
                  ? "Lecturas de hoy agotadas"
                  : `${meter.used} de ${meter.limit} lecturas hoy`}
              </span>
              {/* Puntos de cuota: rellenos = usados */}
              <span className="flex items-center gap-1" aria-hidden="true">
                {Array.from({ length: meter.limit }).map((_, i) => (
                  <span
                    key={i}
                    className={`w-1.5 h-1.5 rounded-full ${
                      i < meter.used
                        ? exhausted
                          ? "bg-amber-400"
                          : "bg-white"
                        : "bg-white/25"
                    }`}
                  />
                ))}
              </span>
            </span>

            <button
              type="button"
              onClick={onOpenSubscription}
              aria-label="Ver suscripciones"
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap ${
                exhausted
                  ? "bg-amber-500 text-black hover:bg-amber-400"
                  : "border border-white/20 text-neutral-200 hover:bg-white/10"
              }`}
            >
              <Lock className="w-3 h-3" />
              <span>Suscribirse</span>
            </button>
          </>
        )}

        {/* Volver arriba: siempre visible */}
        <button
          type="button"
          onClick={scrollToTop}
          aria-label="Volver arriba"
          title="Volver arriba"
          className="p-2 rounded-full bg-white/10 hover:bg-white text-black transition-colors cursor-pointer shrink-0"
        >
          <ArrowUp className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
