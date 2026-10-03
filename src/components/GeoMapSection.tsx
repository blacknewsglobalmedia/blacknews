import React, { useMemo, useState } from "react";
import { Report } from "../types/news";
import { WORLD_LAND_PATH } from "../data/worldLand";

/** Coordenadas reales de las ciudades citadas en las corresponsalías de los informes. */
const CITY_COORDS: Record<string, [number, number]> = {
  "Zúrich": [8.54, 47.37],
  "Berlín": [13.4, 52.52],
  "Madrid": [-3.7, 40.42],
  "Oslo": [10.75, 59.91],
  "Ginebra": [6.14, 46.2],
  "Santiago": [-70.65, -33.45],
  "Antofagasta": [-70.4, -23.65],
  "La Paz": [-68.15, -16.5],
};

/** Límite diario de lecturas en el mapa para usuarios sin suscripción. */
const MAP_READ_KEY = "blacknews_map_reads";
const MAX_FREE_MAP_READS = 3;

const todayKey = (): string => {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
};

/** Lecturas usadas hoy en el mapa (se reinicia cada día; falla hacia0 si no hay storage). */
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
  /** Abre el informe elegido de una corresponsalía. */
  onOpenReport?: (report: Report) => void;
  /** Se invoca al agotar las lecturas free del mapa. */
  onOpenSubscriptionModal?: () => void;
  /** Suscriptor activo: lecturas ilimitadas en el mapa. */
  isSubscribed?: boolean;
}

/**
 * Mapa de cobertura compacto: silueta mundial + panel lateral con las
 * corresponsalías reales declaradas en los informes (sin datos simulados).
 * Clic en punto o fila → informe más reciente de esa corresponsalía;
 * usuarios free con3 lecturas diarias en el mapa y después, modal de suscripción.
 */
export const GeoMapSection: React.FC<GeoMapSectionProps> = ({
  reports,
  onOpenReport,
  onOpenSubscriptionModal,
  isSubscribed,
}) => {
  const [hovered, setHovered] = useState<string | null>(null);

  const bureaus = useMemo(() => {
    const seen = new Set<string>();
    reports.forEach((r) => {
      const b = r.author?.bureau;
      if (b) seen.add(b);
    });
    return Array.from(seen);
  }, [reports]);

  const points = useMemo(() => {
    const pts: { city: string; lon: number; lat: number; bureau: string }[] = [];
    const done = new Set<string>();
    bureaus.forEach((bureau) => {
      bureau.split("/").forEach((raw) => {
        const city = raw.trim();
        const coords = CITY_COORDS[city];
        if (coords && !done.has(city)) {
          done.add(city);
          pts.push({ city, lon: coords[0], lat: coords[1], bureau });
        }
      });
    });
    return pts;
  }, [bureaus]);

  const latestByBureau = useMemo(() => {
    const map = new Map<string, Report>();
    const ts = (r: Report) => {
      const v = Date.parse(r.publishedAt);
      return Number.isNaN(v) ? 0 : v;
    };
    reports.forEach((r) => {
      const b = r.author?.bureau;
      if (!b) return;
      const prev = map.get(b);
      if (!prev || ts(r) > ts(prev)) map.set(b, r);
    });
    return map;
  }, [reports]);

  const canOpen = Boolean(onOpenReport);

  const openBureauReport = (bureau: string) => {
    if (!onOpenReport) return;
    const report = latestByBureau.get(bureau);
    if (!report) return;
    if (!isSubscribed) {
      const usage = readMapUsage();
      if (usage.count >= MAX_FREE_MAP_READS) {
        onOpenSubscriptionModal?.();
        return;
      }
      try {
        localStorage.setItem(
          MAP_READ_KEY,
          JSON.stringify({ date: usage.date, count: usage.count + 1 }),
        );
      } catch {
        /* sin storage la lectura sigue adelante sin contarse */
      }
    }
    onOpenReport(report);
  };

  if (bureaus.length === 0) return null;

  return (
    <section className="border-t border-white/10 bg-black font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="flex flex-col lg:flex-row">
          {/* Mapa */}
          <div className="lg:flex-1 min-w-0 flex items-center justify-center py-2 lg:py-0 lg:pr-8">
            <svg
              viewBox="-180 -90 360 180"
              className="w-full h-auto max-w-[640px] mx-auto"
              role="img"
              aria-label="Mapa de cobertura de BLACKNEWS"
            >
              <path
                d={WORLD_LAND_PATH}
                fill="#141414"
                stroke="#303035"
                strokeWidth={0.35}
                fillRule="evenodd"
                strokeLinejoin="round"
              />
              {points.map((p) => {
                const hot = hovered === p.bureau;
                return (
                  <g
                    key={p.city}
                    role={canOpen ? "button" : undefined}
                    tabIndex={canOpen ? 0 : undefined}
                    aria-label={canOpen ? `Abrir informe de ${p.city}` : undefined}
                    className={canOpen ? "cursor-pointer" : undefined}
                    onMouseEnter={() => setHovered(p.bureau)}
                    onMouseLeave={() => setHovered(null)}
                    onClick={canOpen ? () => openBureauReport(p.bureau) : undefined}
                    onKeyDown={
                      canOpen
                        ? (e: React.KeyboardEvent<SVGGElement>) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              openBureauReport(p.bureau);
                            }
                          }
                        : undefined
                    }
                  >
                    <circle
                      cx={p.lon}
                      cy={-p.lat}
                      r={4.2}
                      fill="none"
                      stroke="#ffffff"
                      strokeWidth={0.5}
                      className="map-pulse"
                    />
                    {hot && (
                      <circle
                        cx={p.lon}
                        cy={-p.lat}
                        r={6}
                        fill="none"
                        stroke="#ffffff"
                        strokeWidth={0.5}
                        opacity={0.45}
                      />
                    )}
                    <circle
                      cx={p.lon}
                      cy={-p.lat}
                      r={hot ? 2.2 : 1.6}
                      fill="#ffffff"
                    />
                    <title>{`${p.city} · ${p.bureau}`}</title>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Panel lateral */}
          <aside className="w-full lg:w-72 shrink-0 border-t lg:border-t-0 lg:border-l border-white/10 lg:pl-7 pt-6 lg:pt-0">
            <div className="text-[10px] uppercase tracking-[0.25em] text-neutral-600 font-semibold">
              MAPA DE COBERTURA
            </div>
            <h2 className="font-headline text-lg text-white tracking-tight leading-snug mt-2">
              Corresponsalías
            </h2>
            <p className="text-[11px] text-neutral-500 font-light leading-relaxed mt-1 mb-3">
              Cada punto, una sede real de la red.
            </p>
            <ul className="divide-y divide-white/5">
              {bureaus.map((bureau) => {
                const [city, ...rest] = bureau.split("/").map((s) => s.trim());
                const hot = hovered === bureau;
                const inner = (
                  <>
                    <span
                      className={`text-[13px] font-medium truncate min-w-0 ${
                        hot ? "text-white" : "text-neutral-300"
                      }`}
                    >
                      {city}
                    </span>
                    <span className="text-[10px] text-neutral-500 truncate min-w-0 text-right shrink-0">
                      {rest.join(" / ")}
                    </span>
                  </>
                );
                const cls = `w-full text-left flex items-baseline justify-between gap-3 py-2 -mx-2 px-2 rounded transition-colors hover:bg-white/5${
                  canOpen ? " cursor-pointer" : ""
                }${hot ? " bg-white/5" : ""}`;
                return (
                  <li key={bureau}>
                    {canOpen ? (
                      <button
                        type="button"
                        onClick={() => openBureauReport(bureau)}
                        onMouseEnter={() => setHovered(bureau)}
                        onMouseLeave={() => setHovered(null)}
                        className={cls}
                      >
                        {inner}
                      </button>
                    ) : (
                      <div
                        onMouseEnter={() => setHovered(bureau)}
                        onMouseLeave={() => setHovered(null)}
                        className={cls}
                      >
                        {inner}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </aside>
        </div>
      </div>
    </section>
  );
};
