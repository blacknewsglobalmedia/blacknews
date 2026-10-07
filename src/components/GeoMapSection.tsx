import React, { useMemo, useState } from "react";
import { Report } from "../types/news";
import { WORLD_DOTS_PATH } from "../data/worldDots";
import { ReadMeter } from "../utils/readMeter";
import { coordsForCountry } from "../data/countries";

/** Cubo de informes sin país (alcance global). */
const INTERNATIONAL = "Internacional";

interface GeoMapSectionProps {
  reports: Report[];
  /** Reservado: categorías del portafolio (hoy solo se acepta, sin uso). */
  categories?: string[];
  /** Abre el informe elegido desde el mapa. */
  onOpenReport?: (report: Report) => void;
  /** Abre el modal de suscripciones (CTA al agotar la cuota). */
  onOpenSubscriptionModal?: () => void;
  /** Cuota diaria compartida con el resto del sitio (se registra al abrir). */
  meter?: ReadMeter;
}

interface CountryGroup {
  name: string;
  reports: Report[];
  count: number;
  coords?: [number, number];
}

/**
 * Mapa de cobertura por puntos (cuadrícula de 2.5° sobre Natural Earth 110m),
 * sin fondo: solo puntos sobre negro puro. Cada marcador muestra cuántas
 * noticias ocurren en ese país; tocar país o marcador entra a sus titulares y
 * cada noticia abierta suma a la cuota diaria compartida con el resto del
 * sitio (2/día de invitado, 3/día registrado, sin límite para suscriptores
 * y redacción; al agotarse la lectura sigue con un aviso).
 */
export const GeoMapSection: React.FC<GeoMapSectionProps> = ({
  reports,
  onOpenReport,
  onOpenSubscriptionModal,
  meter,
}) => {
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const groups = useMemo(() => {
    const map = new Map<string, Report[]>();
    reports.forEach((r) => {
      const list =
        r.countries && r.countries.length > 0 ? r.countries : [INTERNATIONAL];
      list.forEach((c) => {
        const arr = map.get(c);
        if (arr) arr.push(r);
        else map.set(c, [r]);
      });
    });
    const arr: CountryGroup[] = Array.from(map.entries()).map(
      ([name, rs]) => ({
        name,
        reports: rs,
        count: rs.length,
        coords: coordsForCountry(name),
      }),
    );
    arr.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "es"));
    const rest = arr.filter((g) => g.name !== INTERNATIONAL);
    const intl = arr.find((g) => g.name === INTERNATIONAL);
    return intl ? [...rest, intl] : rest;
  }, [reports]);

  if (groups.length === 0) return null;

  const active = groups.find((g) => g.name === selected) || null;
  const exhausted = Boolean(meter && !meter.unlimited && meter.exhausted);

  const openNews = (report: Report) => {
    // La cuota la registra App al abrir (misma contabilidad que la portada)
    onOpenReport?.(report);
  };

  const toggleCountry = (name: string) =>
    setSelected((s) => (s === name ? null : name));

  return (
    <section className="border-t border-white/10 bg-black font-sans">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-10 sm:py-12">
        <div className="flex flex-col lg:flex-row">
          {/* Mapa de puntos (sin fondo: la tierra son puntos sobre negro) */}
          <div className="lg:flex-1 min-w-0 flex items-center justify-center py-2 lg:py-0 lg:pr-8">
            <svg
              viewBox="-180 -90 360 180"
              className="w-full h-auto"
              role="img"
              aria-label="Mapa de cobertura de BLACKNEWS"
            >
              <path d={WORLD_DOTS_PATH} fill="#2e2e2e" />
              {groups
                .filter((g) => g.coords)
                .map((g) => {
                  const [lon, lat] = g.coords as [number, number];
                  const cy = -lat;
                  const on = hovered === g.name || selected === g.name;
                  return (
                    <g
                      key={g.name}
                      role="button"
                      tabIndex={0}
                      aria-label={`${g.name}: ${g.count} noticias`}
                      className="cursor-pointer focus:outline-none"
                      onMouseEnter={() => setHovered(g.name)}
                      onMouseLeave={() => setHovered(null)}
                      onFocus={() => setHovered(g.name)}
                      onBlur={() => setHovered(null)}
                      onClick={() => toggleCountry(g.name)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggleCountry(g.name);
                        }
                      }}
                    >
                      {/* Zona táctil ampliada (~24 px en móvil): el círculo visible es diminuto */}
                      <circle cx={lon} cy={cy} r={12} fill="transparent" />
                      <circle
                        cx={lon}
                        cy={cy}
                        r={5}
                        fill="none"
                        stroke="#ffffff"
                        strokeWidth={0.5}
                        className="map-pulse"
                      />
                      {on && (
                        <circle
                          cx={lon}
                          cy={cy}
                          r={7.5}
                          fill="none"
                          stroke="#ffffff"
                          strokeWidth={0.5}
                          opacity={0.5}
                        />
                      )}
                      <circle
                        cx={lon}
                        cy={cy}
                        r={on ? 2.4 : 1.8}
                        fill="#ffffff"
                      />
                      <text
                        x={lon}
                        y={cy + 13.5}
                        textAnchor="middle"
                        fontSize={6.5}
                        fontWeight={600}
                        fill={on ? "#ffffff" : "#a1a1aa"}
                        pointerEvents="none"
                        style={{ userSelect: "none" }}
                      >
                        {g.count}
                      </text>
                    </g>
                  );
                })}
            </svg>
          </div>

          {/* Panel lateral: noticias por país */}
          <aside className="w-full lg:w-80 shrink-0 border-t lg:border-t-0 lg:border-l border-white/10 lg:pl-7 pt-6 lg:pt-0">
            <div className="text-[10px] uppercase tracking-[0.25em] text-neutral-600 font-semibold">
              MAPA DE COBERTURA
            </div>
            {active ? (
              <>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="mt-2 text-[11px] text-neutral-500 hover:text-white transition-colors cursor-pointer"
                >
                  ← Todos los países
                </button>
                <h2 className="font-headline text-lg text-white tracking-tight leading-snug mt-1">
                  {active.name}
                </h2>
                <p className="text-[11px] text-neutral-500 font-light mt-1 mb-3">
                  {active.count} {active.count === 1 ? "noticia" : "noticias"}{" "}
                  en curso · toca una para leerla
                </p>
                <ul className="divide-y divide-white/5">
                  {active.reports.map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => openNews(r)}
                        className="w-full text-left py-2.5 -mx-2 px-2 rounded transition-colors hover:bg-white/5 cursor-pointer"
                      >
                        <span className="block text-[13px] text-neutral-200 leading-snug line-clamp-2">
                          {r.title}
                        </span>
                        <span className="block text-[10px] text-neutral-600 mt-1">
                          {r.publishedAt}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <>
                <h2 className="font-headline text-lg text-white tracking-tight leading-snug mt-2">
                  Noticias por país
                </h2>
                <p className="text-[11px] text-neutral-500 font-light leading-relaxed mt-1 mb-3">
                  Toca un país y mira qué está pasando ahora mismo.
                </p>
                <ul className="divide-y divide-white/5">
                  {groups.map((g) => {
                    const on = hovered === g.name;
                    return (
                      <li key={g.name}>
                        <button
                          type="button"
                          onClick={() => setSelected(g.name)}
                          onMouseEnter={() => setHovered(g.name)}
                          onMouseLeave={() => setHovered(null)}
                          className={`w-full text-left flex items-baseline justify-between gap-3 py-2.5 -mx-2 px-2 rounded transition-colors hover:bg-white/5 cursor-pointer${
                            on ? " bg-white/5" : ""
                          }`}
                        >
                          <span
                            className={`text-[13px] font-medium truncate min-w-0 ${
                              on ? "text-white" : "text-neutral-300"
                            }`}
                          >
                            {g.name}
                          </span>
                          <span className="shrink-0 text-[10px] leading-none min-w-[20px] text-center px-1.5 py-1 rounded-full bg-white/5 text-neutral-400 tabular-nums">
                            {g.count}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}

            {/* Cuota diaria compartida / estado de suscripción */}
            {meter && !meter.unlimited && (
              <>
                {exhausted && onOpenSubscriptionModal ? (
                  <button
                    type="button"
                    onClick={onOpenSubscriptionModal}
                    className="mt-4 w-full text-left text-[10px] leading-relaxed text-neutral-500 hover:text-white transition-colors cursor-pointer"
                  >
                    Viste tus {meter.limit} lecturas de hoy ·
                    Suscríbete para seguir leyendo →
                  </button>
                ) : (
                  <div className="mt-4 text-[10px] text-neutral-600">
                    Lecturas gratuitas hoy: {meter.used} de {meter.limit}
                  </div>
                )}
              </>
            )}
            {meter?.unlimited && (
              <div className="mt-4 text-[10px] text-neutral-600">
                {meter.kind === "subscriber" ? (
                  onOpenSubscriptionModal ? (
                    <button
                      type="button"
                      onClick={onOpenSubscriptionModal}
                      className="text-neutral-500 transition-colors hover:text-white cursor-pointer"
                    >
                      Suscriptor · lecturas ilimitadas · gestionar →
                    </button>
                  ) : (
                    "Suscriptor · lecturas ilimitadas"
                  )
                ) : (
                  "Redacción · sin límite"
                )}
              </div>
            )}
          </aside>
        </div>
      </div>
    </section>
  );
};
