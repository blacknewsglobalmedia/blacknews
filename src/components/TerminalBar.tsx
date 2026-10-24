import React, { useEffect, useRef, useState } from 'react';
import { useAssemble } from '../lib/assemble';

const TICK_MS = 60;
const RAMP = ['░', '▒', '▓'];

/**
 * Duración de la secuencia `run` (intro + relleno + sostenido COMPLETE).
 * El padre la usa como `startDelayMs` del decode para que la escritura del
 * titular comience exactamente cuando la barra se retira.
 */
export const BAR_INTRO_MS = 100;
export const BAR_FILL_MS = 520;
export const BAR_HOLD_MS = 380;
export const BAR_TOTAL_MS = BAR_INTRO_MS + BAR_FILL_MS + BAR_HOLD_MS;

type Phase = 'intro' | 'wait' | 'fill' | 'hold';

export interface TerminalBarProps {
  /** Secuencia automática desde el montaje (arranque del titular). */
  run?: boolean;
  /** Modo espera: bucle LOADING... hasta que pase a true; luego relleno final. */
  ready?: boolean;
  /** Celdas del corchete (la muestra del ejemplo usa 12). */
  cells?: number;
  introMs?: number;
  fillMs?: number;
  holdMs?: number;
  /** COMPLETE sostenido: el padre decide cuándo retirar la barra. */
  onSettled?: () => void;
  className?: string;
}

/**
 * Barra de carga tipo terminal: `[▓▓▒▒░░░░░░░░] 50%` → `[▓▓▓▓▓▓▓▓▓▓▓▓] COMPLETE`.
 *
 * Decorativa y accesible por omisión: se monta siempre dentro de un
 * `aria-hidden` del padre, solo con `useTerminalGate()` en true (efecto
 * ensamblado activo y movimiento permitido). Nunca contiene contenido real.
 */
export const TerminalBar: React.FC<TerminalBarProps> = ({
  run = false,
  ready = false,
  cells = 12,
  introMs = BAR_INTRO_MS,
  fillMs = BAR_FILL_MS,
  holdMs = BAR_HOLD_MS,
  onSettled,
  className = '',
}) => {
  const [snap, setSnap] = useState(() => ({
    phase: (run ? 'intro' : 'wait') as Phase,
    p: 0,
    marquee: 0,
    label: 'LOADING...',
  }));

  const readyRef = useRef(ready);
  const settleRef = useRef(onSettled);
  useEffect(() => {
    readyRef.current = ready;
  }, [ready]);
  useEffect(() => {
    settleRef.current = onSettled;
  });

  useEffect(() => {
    let phase: Phase = run ? 'intro' : 'wait';
    let t = 0; // ms en la fase actual
    let total = 0; // ms desde el montaje (desplaza el marquee)
    let settled = false;

    const id = window.setInterval(() => {
      t += TICK_MS;
      total += TICK_MS;

      if (phase === 'intro' && t >= introMs) {
        phase = 'fill';
        t = 0;
      } else if (phase === 'wait' && readyRef.current) {
        phase = 'fill';
        t = 0;
      } else if (phase === 'fill' && t >= fillMs) {
        phase = 'hold';
        t = 0;
      } else if (phase === 'hold' && t >= holdMs && !settled) {
        settled = true;
        settleRef.current?.();
        window.clearInterval(id);
      }

      const p = phase === 'fill' ? Math.min(1, t / fillMs) : phase === 'hold' ? 1 : 0;
      const label =
        phase === 'hold' ? 'COMPLETE' : phase === 'fill' ? `${Math.round(p * 100)}%` : 'LOADING...';
      setSnap({ phase, p, marquee: total, label });
    }, TICK_MS);

    return () => window.clearInterval(id);
  }, [run, introMs, fillMs, holdMs]);

  // Celdas: marquee ░▒▓ desplazándose en espera; ▓ sólidos + ▒ borde + ░ vacío
  // al relleno (el 100 % queda ▓▓▓▓▓▓▓▓▓▓▓▓ con halo, como en la muestra).
  const filled =
    snap.phase === 'fill' || snap.phase === 'hold' ? Math.floor(snap.p * cells) : -1;
  const cellsRender =
    filled >= 0
      ? Array.from({ length: cells }, (_, i) =>
          i < filled
            ? ['▓', snap.phase === 'hold' ? 'asm-hot' : 'text-neutral-100']
            : i < filled + 2
              ? ['▒', 'text-neutral-500']
              : ['░', 'text-neutral-700'],
        )
      : Array.from({ length: cells }, (_, i) => [
          RAMP[(((i - Math.floor(snap.marquee / 100)) % 3) + 3) % 3],
          'text-neutral-400',
        ]);

  return (
    <span
      aria-hidden="true"
      className={`font-mono tracking-[0.12em] whitespace-nowrap tabular-nums ${className}`}
    >
      <span className="text-neutral-600">[</span>
      {cellsRender.map(([ch, cls], i) => (
        <span key={i} className={cls}>
          {ch}
        </span>
      ))}
      <span className="text-neutral-600">]</span>{' '}
      {snap.phase === 'hold' ? (
        <span className="asm-hot font-semibold">{snap.label}</span>
      ) : (
        <span className="text-neutral-200">{snap.label}</span>
      )}
    </span>
  );
};

/**
 * Gate de las barras: solo con el interruptor EFECTO activo y sin
 * `prefers-reduced-motion`. Apagado → nunca se montan (contenido normal).
 */
export const useTerminalGate = (): boolean => {
  const on = useAssemble();
  const [reducedMotion, setReducedMotion] = useState(
    () => matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReducedMotion(mq.matches);
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  return on && !reducedMotion;
};
