import { useCallback, useEffect, useRef, useState } from "react";
import { useAssemble } from "./assemble";

/**
 * Escritura tipo código para titulares y descripciones.
 *
 * El texto se revela de izquierda a derecha con tres zonas: lo ya escrito en
 * su color natural; una banda estrecha junto al cursor (▍) donde unos pocos
 * glifos de terminal OSINT (░ ▓ / : > _ × + 0 1) parpadean; y el resto en una
 * sombra tenue de glifos estable que no titila — la lectura es sutil y rápida,
 * no un muro de bloques.
 *
 * Arranque: con `startDelayMs` la sombra aparece en cuanto llega el turno
 * (`.in`) pero el progreso espera, cediendo el sitio a la barra de carga del
 * titular (`TerminalBar`) sin que se vea el texto plano.
 *
 * Reglas de integración con `assemble.ts`:
 *  - el primer carácter se escribe cuando la pieza recibe `.in` (su turno en
 *    la cascada del bloque), así coincide con la entrada del elemento;
 *  - si el bloque no es ensamblable (o el efecto está apagado), el texto se
 *    muestra plano y listo: nunca hay contenido oculto a la espera;
 *  - si el titular cambia (nueva noticia principal) la secuencia se repite;
 *  - `prefers-reduced-motion` o el interruptor EFECTO apagado finalizan la
 *    secuencia al instante.
 *
 * Accesibilidad/SEO: mientras escribe, lo visible va con `aria-hidden` y el
 * texto real se mantiene en un `sr-only`; al terminar se renderiza el texto
 * final tal cual, sin duplicados.
 */

const TICK_MS = 40;
/**
 * Vocabulario OSINT de UNA sola celda: ruido digital ░▒▓, separadores // :,
 * prompt > _, señal × +, datos 0 1. Todo monoespaciado y de ancho fijo para
 * que la zona activa no provoque saltos de línea al parpadear.
 */
const ACTIVE_GLYPHS = ["░", "▒", "▓", "▮", "/", ":", "_", "×", "+", ">", "·", "0", "1"];
/** Sombra tenue del resto: determinista por índice (no titila). */
const QUIET_GLYPHS = ["░", "▒", "▮", ".", ":", "_", "/"];
/** Espacios y puntuación se mantienen: la frase conserva su forma. */
const KEEPS_SHAPE = /[\s.,;:·—¿?¡!«»()…]/;

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

export interface DecodeView {
  /** Prefijo ya escrito, en su tipografía y color finales. */
  done: string;
  /** Cursor de bloque (▍) que parpadea en el punto de escritura. */
  cursor: string;
  /** Banda activa junto al cursor. */
  active: string;
  /** Resto aún sin escribir, en sombra tenue y estable. */
  quiet: string;
}

interface UseDecodeTextResult<T extends HTMLElement> {
  /** Ref de callback: el hook reacciona si React remonta el nodo. */
  ref: (node: T | null) => void;
  /** null → texto plano (inactivo, movimiento reducido o ya terminado). */
  view: DecodeView | null;
  /** true cuando llegó su turno (`.in` o bloque no ensamblable): la secuencia
   *  está en marcha, también durante la espera de `startDelayMs`. */
  armed: boolean;
}

export function useDecodeText<T extends HTMLElement>(
  text: string,
  opts?: {
    /** Duración propia de la escritura (por defecto, ~3 ms por carácter). */
    durationMs?: number;
    /** Espera desde que se arma hasta empezar a progresar: el titular puede
     *  ceder el sitio a la barra de carga sin que se vea texto plano. Durante
     *  la espera ya se muestra la sombra completa con el cursor. */
    startDelayMs?: number;
  },
): UseDecodeTextResult<T> {
  const { durationMs, startDelayMs = 0 } = opts ?? {};
  const on = useAssemble();
  const [reducedMotion, setReducedMotion] = useState(reduced);
  const [el, setEl] = useState<T | null>(null);
  const [view, setView] = useState<DecodeView | null>(null);
  const [armed, setArmed] = useState(false);
  const timer = useRef<number | null>(null);

  const ref = useCallback((node: T | null) => setEl(node), []);

  // Cambios del sistema en caliente (activar/desactivar reduced-motion)
  useEffect(() => {
    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const active = on && !reducedMotion && text.length > 0;

  useEffect(() => {
    let startTimer: number | null = null;
    const stop = () => {
      if (timer.current !== null) {
        clearInterval(timer.current);
        timer.current = null;
      }
      if (startTimer !== null) {
        window.clearTimeout(startTimer);
        startTimer = null;
      }
    };

    if (!active || !el) {
      stop();
      setView(null);
      return;
    }

    let progress = 0; // glifos resueltos (fracción, para textos cortos)
    let started = false;
    // Ágil: ~0,45 s base + 3 ms por carácter, con techo de 1,4 s
    const target = durationMs ?? Math.min(1400, 450 + text.length * 3);
    const perTick = text.length / Math.max(1, target / TICK_MS);
    // La banda de brillo siempre cubre lo que avanza en un tick
    const band = Math.max(6, Math.ceil(perTick) + 2);

    const glyphAt = (i: number) => QUIET_GLYPHS[(((i * 2654435761) >>> 0) % QUIET_GLYPHS.length)];

    const render = () => {
      const head = text.slice(0, Math.floor(progress));
      if (head.length >= text.length) {
        stop();
        setView(null); // final: el texto queda plano, sin spans
        return;
      }
      const bandEnd = Math.min(text.length, head.length + band);
      let active = "";
      for (let i = head.length; i < bandEnd; i++) {
        const ch = text[i];
        active += KEEPS_SHAPE.test(ch) ? ch : ACTIVE_GLYPHS[(Math.random() * ACTIVE_GLYPHS.length) | 0];
      }
      let quiet = "";
      for (let i = bandEnd; i < text.length; i++) {
        const ch = text[i];
        quiet += KEEPS_SHAPE.test(ch) ? ch : glyphAt(i);
      }
      setView({ done: head, cursor: "▍", active, quiet });
    };

    const begin = () => {
      progress = 0;
      render();
      timer.current = window.setInterval(() => {
        progress = Math.min(text.length, progress + perTick);
        render();
      }, TICK_MS);
    };

    const start = () => {
      if (started) return;
      started = true;
      setArmed(true);
      // Desde su turno ya se ve la sombra completa con cursor (nunca texto
      // plano a medias): la espera `startDelayMs` solo retrasa el progreso.
      render();
      if (startDelayMs > 0) startTimer = window.setTimeout(begin, startDelayMs);
      else begin();
    };

    // Su turno en la cascada del bloque = su turno de escribirse
    const mo = new MutationObserver(() => {
      if (el.classList.contains("in")) start();
    });
    mo.observe(el, { attributes: true, attributeFilter: ["class"] });
    if (el.classList.contains("in")) start();
    // Sin bloque ensamblable no habrá `.in`: se escribe igual (nunca oculto)
    if (!el.closest("[data-assemble]")) start();

    return () => {
      mo.disconnect();
      stop();
    };
  }, [active, el, text, durationMs, startDelayMs]);

  return { ref, view, armed };
}
