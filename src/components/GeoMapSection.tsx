import React, { useMemo, useState } from "react";
import { Report } from "../types/news";
import { WORLD_DOTS_PATH } from "../data/worldDots";
import { ReadMeter } from "../utils/readMeter";

/** Coordenadas del centroide de los países donde ocurren noticias de la portada. */
// Coordenadas [lon, lat] de los países seleccionables en el editor y en el
// generador de posts. Los grupos sin coordenadas se muestran en el panel del
// mapa pero no dibujan pin (p. ej. «Internacional» o países personalizados).
const COUNTRY_COORDS: Record<string, [number, number]> = {
  Suiza: [8.2, 46.8],
  Noruega: [10.0, 61.0],
  Chile: [-71.0, -35.0],
  Bolivia: [-64.5, -16.5],
  Israel: [34.9, 31.4],
  'Irán': [53.7, 32.4],
  'EE.UU.': [-98.6, 39.8],
  China: [104.2, 35.9],
  Rusia: [95.0, 62.0],
  Ucrania: [31.2, 48.4],
  'Arabia Saudí': [45.1, 23.9],
  Líbano: [35.9, 33.9],
  Siria: [38.5, 34.8],
  Yemen: [47.6, 15.6],
  'Taiwán': [121.0, 23.7],
  'Corea del Sur': [127.8, 36.4],
  'Corea del Norte': [127.5, 40.3],
  'España': [-3.7, 40.4],
  'Reino Unido': [-3.4, 55.4],
  Francia: [2.2, 46.6],
  Alemania: [10.4, 51.2],
  Argentina: [-64.2, -34.6],
  Venezuela: [-66.6, 6.4],
  Brasil: [-51.9, -14.2],
  'México': [-102.5, 23.6],
  Colombia: [-74.3, 4.6],
  'Perú': [-75.0, -9.2],
  'Japón': [138.3, 36.2],
  India: [79.0, 20.6],
  'Turquía': [35.2, 38.9],
  Egipto: [30.8, 26.8],
  Qatar: [51.2, 25.3],
  'Unión Europea': [10.0, 50.0],
};

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
        coords: COUNTRY_COORDS[name],
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
                      className="cursor-pointer"
                      onMouseEnter={() => setHovered(g.name)}
                      onMouseLeave={() => setHovered(null)}
                      onClick={() => toggleCountry(g.name)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggleCountry(g.name);
                        }
                      }}
                    >
                      <circle
                        cx={lon}
                        cy={cy}
                        r={4.2}
                        fill="none"
                        stroke="#ffffff"
                        strokeWidth={0.5}
                        className="map-pulse"
                      />
                      {on && (
                        <circle
                          cx={lon}
                          cy={cy}
                          r={6.5}
                          fill="none"
                          stroke="#ffffff"
                          strokeWidth={0.5}
                          opacity={0.5}
                        />
                      )}
                      <circle
                        cx={lon}
                        cy={cy}
                        r={on ? 2.2 : 1.6}
                        fill="#ffffff"
                      />
                      <text
                        x={lon}
                        y={cy + 12.5}
                        textAnchor="middle"
                        fontSize={5}
                        fontWeight={600}
                        fill={on ? "#ffffff" : "#a1a1aa"}
                        pointerEvents="none"
                        style={{ userSelect: "none" }}
                      >
                        {g.count}
                      </text>
                      <title>
                        {`${g.name} · ${g.count} ${g.count === 1 ? "noticia" : "noticias"}`}
                      </title>
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
                        className="w-full text-left py-2 -mx-2 px-2 rounded transition-colors hover:bg-white/5 cursor-pointer"
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
                          className={`w-full text-left flex items-baseline justify-between gap-3 py-2 -mx-2 px-2 rounded transition-colors hover:bg-white/5 cursor-pointer${
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
                {meter.kind === "subscriber"
                  ? "Suscriptor · lecturas ilimitadas"
                  : "Redacción · sin límite"}
              </div>
            )}
          </aside>
        </div>
      </div>
    </section>
  );
};
