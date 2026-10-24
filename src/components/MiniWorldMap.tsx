import React from 'react';
import { WORLD_DOTS_PATH } from '../data/worldDots';
import { coordsForCountry } from '../data/countries';

export interface MapPin {
  lon: number;
  lat: number;
  /** true (por defecto) = punto encendido; false = apagado de noche. */
  lit?: boolean;
}

interface MiniWorldMapProps {
  /** Países del informe a encender (coordinadas del catálogo). */
  countries?: string[];
  /** Pines explícitos (p. ej. relojes del mundo); si hay, manda sobre countries. */
  pins?: MapPin[];
  className?: string;
}

/**
 * Miniatura del atlas de cobertura para tarjetas: la misma malla de puntos
 * del mapa grande —trazo de 1px no escalado, así se ve nítida en miniatura—
 * con pines encendidos (halo pulsante + núcleo blanco, el mismo lenguaje de
 * las corresponsalías) o apagados (núcleo gris).
 *
 * Decorativa (aria-hidden): el dato real —bandera y nombre— ya está junto.
 * Sin ningún pin, no pinta nada.
 */
export const MiniWorldMap: React.FC<MiniWorldMapProps> = ({
  countries = [],
  pins,
  className = '',
}) => {
  let finalPins: MapPin[] = [];
  if (pins) {
    finalPins = pins;
  } else {
    const seen = new Set<string>();
    for (const name of countries) {
      if (!name || seen.has(name)) continue;
      seen.add(name);
      const c = coordsForCountry(name);
      if (c) finalPins.push({ lon: c[0], lat: c[1], lit: true });
    }
  }
  if (!finalPins.length) return null;

  return (
    <svg viewBox="-180 -90 360 180" className={className} aria-hidden="true" focusable="false">
      <path
        d={WORLD_DOTS_PATH}
        fill="none"
        stroke="#565656"
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />
      {finalPins.map((p, i) => {
        const lit = p.lit !== false;
        return (
          <g key={`${p.lon}:${p.lat}:${i}`}>
            {lit && (
              <circle
                cx={p.lon}
                cy={-p.lat}
                r={15}
                fill="none"
                stroke="#ffffff"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
                className="map-pulse"
              />
            )}
            <circle cx={p.lon} cy={-p.lat} r={7} fill={lit ? '#ffffff' : '#52525b'} />
          </g>
        );
      })}
    </svg>
  );
};
