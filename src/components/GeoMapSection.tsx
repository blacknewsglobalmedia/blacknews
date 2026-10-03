import React, { useMemo, useState } from "react";
import { Report } from "../types/news";
import { WORLD_DOTS_PATH } from "../data/worldDots";

/** Coordenadas del centroide de los países donde ocurren noticias de la portada. */
const COUNTRY_COORDS: Record<string, [number, number]> = {
  Suiza: [8.2, 46.8],
  Noruega: [10.0, 61.0],
  Chile: [-71.0, -35.0],
  Bolivia: [-64.5, -16.5],
};

/** Cubo de informes sin país (alcance global). */
const INTERNATIONAL = "Internacional";

/** Límite diario de lecturas en el mapa para usuarios sin suscripción. */
const MAP_READ_KEY = "blacknews_map_reads";
const MAX_FREE_MAP_READS = 3;

const todayKey = (): string => {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
};

/** Lecturas usadas hoy en el mapa (se reinicia cada día; falla hacia 0 si no hay storage). */
const readMapUsage = (): { date: string; count: number } => {
  const today = todayKey();
  try {
    const raw = localStorage.getItem(MAP_READ_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data && data.date === today && typeof data.count === "number") {
        return { date: today, count: data.count };
      }
    }
  } catch {
    /* modo privado: se contará solo si el storage vuelve a estar disponible */
  }
  return { date: today, count: 0 };
};

interface GeoMapSectionProps {
  reports: Report[];
  /** Reservado: categorías del portafolio (hoy solo se acepta, sin uso). */
  categories?: string[];
  /** Abre el informe elegido desde el mapa. */
  onOpenReport?: (report: Report) => void;
  /** Se invoca al agotar las lecturas free del mapa. */
  onOpenSubscriptionModal?: () => void;
  /** Suscriptor activo: lecturas ilimitadas en el mapa. */
  isSubscribed?: boolean;
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
 * cada noticia abierta cuenta para el límite free de 3 al día (la 4ª pide
 * suscripción).
 */
export const GeoMapSection: React.FC<GeoMapSectionProps> = ({
  reports,
  onOpenReport,
  onOpenSubscriptionModal,
  isSubscribed,
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
  const usage = isSubscribed ? null : readMapUsage();
  const exhausted =
    !isSubscribed && usage !== null && usage.count >= MAX_FREE_MAP_READS;

  const openNews = (report: Report) => {
    if (!onOpenReport) return;
    if (!isSubscribed) {
      const u = readMapUsage();
      if (u.count >= MAX_FREE_MAP_READS) {
        onOpenSubscriptionModal?.();
        return;
      }
      try {
        localStorage.setItem(
          MAP_READ_KEY,
          JSON.stringify({ date: u.date, count: u.count + 1 }),
        );
      } catch {
        /* sin storage la lectura sigue adelante sin contarse */
      }
    }
    onOpenReport(report);
  };

  const toggleCountry = (name: string) =>
    setSelected((s) => (s === name ? null : name));

  return (
    <section className="border-t border-white/10 bg-black font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="flex flex-col lg:flex-row">
          {/* Mapa de puntos (sin fondo: la tierra son puntos sobre negro) */}
          <div className="lg:flex-1 min-w-0 flex items-center justify-center py-2 lg:py-0 lg:pr-8">
            <svg
              viewBox="-180 -90 360 180"
              className="w-full h-auto max-w-[640px] mx-auto"
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

            {/* Cuenta de lecturas free / estado de suscripción */}
            {!isSubscribed && usage && (
              <>
                {exhausted && onOpenSubscriptionModal ? (
                  <button
                    type="button"
                    onClick={onOpenSubscriptionModal}
                    className="mt-4 w-full text-left text-[10px] leading-relaxed text-neutral-500 hover:text-white transition-colors cursor-pointer"
                  >
                    Viste tus {MAX_FREE_MAP_READS} noticias de hoy ·
                    Suscríbete para seguir leyendo →
                  </button>
                ) : (
                  <div className="mt-4 text-[10px] text-neutral-600">
                    Lecturas gratuitas hoy: {usage.count} de{" "}
                    {MAX_FREE_MAP_READS}
                  </div>
                )}
              </>
            )}
            {isSubscribed && (
              <div className="mt-4 text-[10px] text-neutral-600">
                Suscriptor · lecturas ilimitadas
              </div>
            )}
          </aside>
        </div>
      </div>
    </section>
  );
};
