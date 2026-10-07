import { useEffect, useMemo, useState } from "react";
import { ChevronUp, Clock } from "lucide-react";
import {
  CLOCK_CITIES,
  ClockCity,
  REFERENCE_TZ,
  timeIn,
  visitorClockCity,
} from "../utils/clock";
import { CountryFlag, codeFromFlagEmoji } from "./CountryFlag";

/**
 * Barra inferior tipo marquee, pegada al borde de la ventana (baja con el
 * scroll): fondo AMOLED puro con la hora en Montevideo como referencia y, a
 * su lado, la de los principales países más la zona del visitante.
 *
 * Al pulsar el reloj se despliega un panel con todos los relojes en vivo.
 */
export function WorldClockBar() {
  const [now, setNow] = useState(() => new Date());
  const [open, setOpen] = useState(false);

  // Los relojes se refrescan cada segundo (el texto solo cambia al minuto).
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Escape cierra el panel.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const cities = useMemo<ClockCity[]>(() => {
    const visitor = visitorClockCity();
    if (!visitor) return CLOCK_CITIES;
    // La hora del visitante, justo detrás de la hora oficial de referencia.
    return [CLOCK_CITIES[0], visitor, ...CLOCK_CITIES.slice(1)];
  }, []);

  const strip = (
    <span className="flex items-center shrink-0">
      {cities.map((city) => {
        const isReference = city.tz === REFERENCE_TZ;
        const isVisitor = !isReference && city.flag === "🌐";
        return (
          <span
            key={city.tz}
            className={`inline-flex items-center gap-1.5 px-3 whitespace-nowrap ${
              isReference || isVisitor ? "text-white font-semibold" : "text-neutral-400"
            }`}
          >
            {isReference && (
              <span className="text-neutral-500 font-normal">HORA OFICIAL</span>
            )}
            {/* Banderas por imagen: los emoji de bandera Windows los pinta
                como dos letras en vez de bandera. */}
            <span aria-hidden="true" className="inline-flex shrink-0">
              <CountryFlag
                code={codeFromFlagEmoji(city.flag) ?? ""}
                fallback={city.flag}
                className="w-3.5 h-2.5 object-cover rounded-[1px] inline-block"
              />
            </span>
            <span>{city.name}</span>
            <span className="tabular-nums">{timeIn(city.tz, now)}</span>
            <span className="text-neutral-700 font-normal">·</span>
          </span>
        );
      })}
    </span>
  );

  return (
    <>
      {/* Clic fuera cierra el panel (z-40 = por encima de la cabecera, que así también lo cierra) */}
      {open && (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-40 bg-black/30"
          onClick={() => setOpen(false)}
        />
      )}

      <div className="fixed inset-x-0 bottom-[var(--bn-nav-h)] z-40 font-sans select-none">
        {/* Panel con todos los relojes */}
        {open && (
          <div className="bg-black border-t border-white/10 max-h-[65dvh] overflow-y-auto overscroll-contain">
            <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-2.5 pb-3">
              <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-neutral-500 mb-2">
                <span>Hora en el mundo</span>
                <span className="text-neutral-400 normal-case tracking-normal flex items-center gap-1.5">
                  Referencia: Uruguay
                  <CountryFlag
                    code="UY"
                    className="w-3.5 h-2.5 object-cover rounded-[1px] inline-block"
                  />
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-5 gap-y-0.5">
                {cities.map((city) => {
                  const isReference = city.tz === REFERENCE_TZ;
                  const isVisitor = !isReference && city.flag === "🌐";
                  const highlight = isReference || isVisitor;
                  return (
                    <div
                      key={city.tz}
                      className={`flex items-center justify-between gap-2 border-b border-white/5 py-1 text-[11px] ${
                        highlight ? "text-white" : "text-neutral-400"
                      }`}
                    >
                      <span className="flex items-center gap-1.5 min-w-0">
                        <span aria-hidden="true" className="inline-flex shrink-0">
                          <CountryFlag
                            code={codeFromFlagEmoji(city.flag) ?? ""}
                            fallback={city.flag}
                            className="w-3.5 h-2.5 object-cover rounded-[1px] inline-block"
                          />
                        </span>
                        <span className="truncate">{city.name}</span>
                        {isReference && (
                          <span className="text-[9px] uppercase tracking-widest text-neutral-500 shrink-0">
                            oficial
                          </span>
                        )}
                      </span>
                      <span className="tabular-nums font-medium shrink-0">
                        {timeIn(city.tz, now)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Barra marquee compacta (36 px en móvil para poder tocarla) */}
        <div className="h-9 sm:h-6 flex items-stretch bg-black border-t border-white/10 text-[10px] tracking-wide">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={
              open
                ? "Ocultar la hora en los principales países"
                : "Ver la hora en los principales países"
            }
            className="shrink-0 px-3 sm:px-2 flex items-center gap-1.5 border-r border-white/10 text-neutral-500 hover:text-white transition-colors cursor-pointer"
          >
            <Clock className="w-3 h-3" />
            <ChevronUp
              className={`w-3 h-3 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            />
          </button>

          <div className="relative flex-1 overflow-hidden">
            <div className="bn-marquee absolute inset-y-0 left-0 flex items-center w-max">
              {strip}
              {strip}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
