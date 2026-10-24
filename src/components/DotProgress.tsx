import React from 'react';

/** Puntos sin marcar: el mismo gris de la tierra del atlas (#2e2e2e). */
export const DOT_IDLE = '#2e2e2e';
/** Constelación del progreso (legible también en móvil). */
export const PROGRESS_DOTS = 40;

/** Paleta de los puntos encendidos: reproduce/avanza, cabeza y su halo. */
export interface DotTone {
  lit: string;
  head: string;
  halo: string;
}

/** Esmeralda: progreso de reproducción del podcast (como siempre). */
export const DOT_TONE_EMERALD: DotTone = {
  lit: 'w-1 h-1 bg-emerald-400/75',
  head: 'w-[5px] h-[5px] bg-emerald-400',
  halo: 'bg-emerald-400/40',
};
/** Blanco: progreso de lectura (mismo blanco del lector). */
export const DOT_TONE_WHITE: DotTone = {
  lit: 'w-1 h-1 bg-white/70',
  head: 'w-[5px] h-[5px] bg-white',
  halo: 'bg-white/35',
};

interface DotProgressProps {
  ratio: number;
  /** Muestra el halo pulsante en la cabeza (p. ej. reproduciendo). */
  active?: boolean;
  /** Si se omite, la tira es solo indicadora (progressbar con aria). */
  onSeek?: (fraction: number) => void;
  dots?: number;
  tone?: DotTone;
  idle?: string;
  label?: string;
}

/**
 * Constelación de puntos al estilo del mapa de cobertura: los reproducidos
 * se encienden, el punto de cabeza puede latir con el halo pulsante del
 * atlas y el resto espera en gris tierra. Si hay `onSeek`, el control real
 * es un range nativo invisible encima (arrastrar, clic y teclado funcionan);
 * sin `onSeek` es decorativa con `role="progressbar"`.
 */
export const DotProgress: React.FC<DotProgressProps> = ({
  ratio,
  active = false,
  onSeek,
  dots = PROGRESS_DOTS,
  tone = DOT_TONE_EMERALD,
  idle = DOT_IDLE,
  label = 'Progreso',
}) => {
  const clamped = Math.min(1, Math.max(0, ratio));
  const step = 1 / (dots - 1);
  const strip = (
    <div aria-hidden className="flex w-full items-center justify-between">
      {Array.from({ length: dots }).map((_, i) => {
        const frac = i * step;
        const played = frac <= clamped + step / 2;
        const isHead = played && frac + step > clamped + step / 2;
        return (
          <span key={i} className="relative flex items-center justify-center shrink-0">
            {isHead && active && (
              <span className={`absolute w-3 h-3 rounded-full ${tone.halo} map-pulse`} />
            )}
            <span
              className={`rounded-full ${isHead ? tone.head : played ? tone.lit : 'w-1 h-1'}`}
              style={played ? undefined : { background: idle }}
            />
          </span>
        );
      })}
    </div>
  );

  if (!onSeek) {
    return (
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(clamped * 100)}
        className="relative w-full flex items-center"
      >
        {strip}
      </div>
    );
  }

  const seek = onSeek;
  return (
    <div className="relative flex-1 h-6 flex items-center min-w-0">
      {strip}
      <input
        type="range"
        min={0}
        max={1000}
        step={1}
        value={Math.round(clamped * 1000)}
        onChange={(e) => seek(Number(e.target.value) / 1000)}
        aria-label={label}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
    </div>
  );
};
