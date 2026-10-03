import React, { useMemo } from "react";
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

interface GeoMapSectionProps {
  reports: Report[];
}

/**
 * Mapa de cobertura: silueta mundial + puntos en las corresponsalías
 * reales declaradas en los informes (sin datos simulados).
 */
export const GeoMapSection: React.FC<GeoMapSectionProps> = ({ reports }) => {
  const bureaus = useMemo(() => {
    const seen = new Map<string, string[]>();
    reports.forEach((r) => {
      const b = r.author?.bureau;
      if (!b || seen.has(b)) return;
      const cats = reports
        .filter((x) => x.author?.bureau === b)
        .map((x) => x.category)
        .filter((c, i, arr) => arr.indexOf(c) === i);
      seen.set(b, cats);
    });
    return Array.from(seen, ([bureau, cats]) => ({ bureau, cats }));
  }, [reports]);

  const points = useMemo(() => {
    const pts: { city: string; lon: number; lat: number; bureau: string }[] = [];
    const done = new Set<string>();
    bureaus.forEach(({ bureau }) => {
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

  if (bureaus.length === 0) return null;

  return (
    <section className="border-t border-white/10 bg-black">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-[1.7fr_1fr] gap-8 lg:gap-12 items-center">
          {/* Mapa */}
          <div className="rounded-xl border border-white/10 bg-neutral-950 overflow-hidden p-3 sm:p-5">
            <svg
              viewBox="-180 -90 360 180"
              className="w-full h-auto"
              role="img"
              aria-label="Mapa de cobertura de BLACKNEWS"
            >
              <path
                d={WORLD_LAND_PATH}
                fill="#18181b"
                stroke="#3f3f46"
                strokeWidth={0.4}
                fillRule="evenodd"
                strokeLinejoin="round"
              />
              {points.map((p) => (
                <g key={p.city}>
                  <circle
                    cx={p.lon}
                    cy={-p.lat}
                    r={4.2}
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth={0.5}
                    className="map-pulse"
                  />
                  <circle cx={p.lon} cy={-p.lat} r={1.6} fill="#ffffff" />
                  <title>{`${p.city} · ${p.bureau}`}</title>
                </g>
              ))}
            </svg>
          </div>

          {/* Lista de corresponsalías */}
          <div className="font-sans">
            <div className="text-[11px] uppercase tracking-[0.2em] text-neutral-500 font-semibold mb-3">
              MAPA DE COBERTURA
            </div>
            <h2 className="font-headline text-2xl sm:text-3xl text-white tracking-tight leading-snug mb-4">
              Las corresponsalías que firman lo que publicamos
            </h2>
            <p className="text-sm text-neutral-400 font-light leading-relaxed text-neutral-400 mb-6">
              Cada punto del mapa es una sede real de nuestra red: las ciudades
              desde las que se elabora cada informe.
            </p>
            <ul className="space-y-3">
              {bureaus.map(({ bureau, cats }) => (
                <li
                  key={bureau}
                  className="flex items-start justify-between gap-3 border-b border-white/5 pb-2.5"
                >
                  <span className="text-sm text-neutral-200 font-medium">
                    {bureau}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider text-neutral-500 shrink-0 pt-0.5 text-right">
                    {cats.join(" · ")}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
};
