import React, { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { isFenomenos } from "../data/newsData";
import { CategoryId } from "../types/news";

/**
 * Tira horizontal de secciones (escritorio y móvil/tablet).
 *
 * El catálogo crece con las categorías que se creen en el panel, así que la tira
 * nunca debe dejar categorías inalcanzables. Para ello:
 *  - el contenedor desplaza en horizontal (sin barra visible) con arrastre ratón,
 *    swipe táctil y `Mayús + rueda`;
 *  - las flechas ◄ ► saltan de golpe y solo aparecen si queda algo oculto;
 *  - los difuminados en los bordes avisan de que hay más secciones al lado;
 *  - la sección activa se centra sola para que nunca quede cortada.
 *
 * Nota de centrado: `justify-content: center` sobre un flex desbordado recorta
 * el primer ítem fuera del área de scroll (scrollLeft no puede ser negativo), y
 * entonces lo primero del menú sería inalcanzable. Por eso se centra con un hijo
 * `w-max min-w-full justify-center`: centra cuando cabe y, cuando desborda, el
 * hijo pasa a max-content y todo queda desde el borde izquierdo, scrolleable.
 */

/** Píxeles que avanza cada pulsación de flecha. */
const ARROW_STEP = 260;
/** Tolerancia en px para dar por cerrado un borde. */
const EDGE_EPS = 4;
/** Distancia mínima de arrastre antes de considerar que hubo drag. */
const DRAG_THRESHOLD = 5;

export interface CategoryStripProps {
  categories: { id: CategoryId; label: string }[];
  selectedCategory: CategoryId;
  isStudioOpen: boolean;
  onSelect: (catId: CategoryId) => void;
  /** Cabecera plegada: la tira baja de alto (h-8 en vez de h-10). */
  compact: boolean;
  /** `desktop`: nav oculta bajo lg · `mobile`: nav oculta desde lg. */
  variant: "desktop" | "mobile";
}

export const CategoryStrip: React.FC<CategoryStripProps> = ({
  categories,
  selectedCategory,
  isStudioOpen,
  onSelect,
  compact,
  variant,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({
    active: false,
    startX: 0,
    startLeft: 0,
    moved: false,
  });
  const [edge, setEdge] = useState({ start: false, end: false });

  /** ¿Queda algo oculto a izquierda / derecha? */
  const syncEdges = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const start = el.scrollLeft > EDGE_EPS;
    const end = el.scrollLeft + el.clientWidth < el.scrollWidth - EDGE_EPS;
    setEdge((prev) =>
      prev.start === start && prev.end === end ? prev : { start, end },
    );
  }, []);

  // Re-mide en scroll, resize, cambio de catálogo y al plegar la cabecera.
  const catalogKey = categories.map((c) => c.id).join("|");
  useEffect(() => {
    syncEdges();
    window.addEventListener("resize", syncEdges);
    // Primer pintado: hay que medir tras el layout, no en el mismo commit.
    const raf = requestAnimationFrame(syncEdges);
    return () => {
      window.removeEventListener("resize", syncEdges);
      cancelAnimationFrame(raf);
    };
  }, [syncEdges, catalogKey, compact, variant]);

  // La sección activa se centra sola: recién cargada, renombrada o añadida,
  // nunca queda fuera de pantalla ni cortada en un borde. Al montar sólo se
  // garantiza visibilidad (`nearest`) para no arrancar con la tira movida:
  // centrar «PORTADA» a media pantalla la sacaría por la izquierda.
  const mountedRef = useRef(false);
  useEffect(() => {
    const active = scrollRef.current?.querySelector<HTMLElement>(
      '[data-active="true"]',
    );
    if (!active) return;
    const firstRun = !mountedRef.current;
    mountedRef.current = true;
    active.scrollIntoView({
      behavior: firstRun ? "auto" : "smooth",
      inline: firstRun ? "nearest" : "center",
      block: "nearest",
    });
  }, [selectedCategory, catalogKey]);

  const nudge = (dir: 1 | -1) => {
    scrollRef.current?.scrollBy({
      left: dir * ARROW_STEP,
      behavior: "smooth",
    });
  };

  /* ---------- Arrastre con ratón (táctil usa el scroll nativo) ---------- */
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    const el = scrollRef.current;
    if (!el || el.scrollWidth <= el.clientWidth) return;
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startLeft: el.scrollLeft,
      moved: false,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    const el = scrollRef.current;
    if (!d.active || !el) return;
    const dx = e.clientX - d.startX;
    if (!d.moved) {
      if (Math.abs(dx) < DRAG_THRESHOLD) return;
      d.moved = true;
      el.style.cursor = "grabbing";
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* sin captura el arrastre sigue funcionando bajo el puntero */
      }
    }
    el.scrollLeft = d.startLeft - dx;
  };

  const endDrag = () => {
    if (!dragRef.current.active) return;
    dragRef.current.active = false;
    if (scrollRef.current) scrollRef.current.style.cursor = "";
  };

  // Un arrastre no debe disparar el click del ítem bajo el puntero.
  const handleClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!dragRef.current.moved) return;
    e.preventDefault();
    e.stopPropagation();
    dragRef.current.moved = false;
  };

  const isDesktop = variant === "desktop";
  const heightClass = compact ? "h-8" : "h-10";

  const arrowButton = (dir: 1 | -1) => {
    const isLeft = dir === -1;
    return (
      <button
        type="button"
        onClick={() => nudge(dir)}
        aria-label={
          isLeft ? "Ver categorías anteriores" : "Ver categorías siguientes"
        }
        title={isLeft ? "Categorías anteriores" : "Categorías siguientes"}
        className={`absolute top-1/2 z-20 -translate-y-1/2 ${
          isLeft ? "left-0" : "right-0"
        } flex h-6 w-6 items-center justify-center rounded-full border border-white/20 bg-black/85 text-neutral-300 transition-colors hover:border-white/50 hover:text-white cursor-pointer`}
      >
        <ChevronLeft className={`h-4 w-4 ${isLeft ? "" : "rotate-180"}`} />
      </button>
    );
  };

  return (
    <div className="relative w-full">
      {/* Difuminado + flecha izquierda: solo si hay categorías ocultas antes */}
      {edge.start && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-black via-black/90 to-transparent"
        />
      )}
      {edge.start && arrowButton(-1)}

      {/* Difuminado + flecha derecha: solo si hay categorías ocultas después */}
      {edge.end && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-black via-black/90 to-transparent"
        />
      )}
      {edge.end && arrowButton(1)}

      <div
        ref={scrollRef}
        onScroll={syncEdges}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={handleClickCapture}
        className={`w-full overflow-x-auto no-scrollbar transition-[height] duration-200 ${heightClass}`}
      >
        <div
          className={`flex h-full w-max min-w-full items-center ${
            isDesktop
              ? "justify-start xl:justify-center gap-5 xl:gap-7 text-xs font-sans font-medium tracking-wide"
              : "justify-start gap-4 px-4"
          }`}
        >
          {categories.map((cat) => {
            const isActive = selectedCategory === cat.id && !isStudioOpen;
            const isFen = isFenomenos(cat.id);
            return (
              <button
                key={cat.id}
                data-active={isActive}
                onClick={() => onSelect(cat.id)}
                className={[
                  "h-full flex items-center shrink-0 whitespace-nowrap transition-colors cursor-pointer relative",
                  // En móvil el tamaño va en el ítem; en escritorio lo hereda de la tira
                  isDesktop ? "" : "text-[11px] font-medium uppercase",
                  isFen ? "font-mono tracking-wider" : "",
                  !isFen && !isDesktop ? "font-sans tracking-wider" : "",
                  isActive
                    ? "text-white font-semibold"
                    : "text-neutral-400 hover:text-white",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {isFen && <span className="bn-redact" aria-hidden="true"></span>}
                {cat.label}
                {isActive && (
                  <span
                    className={`absolute bottom-0 left-0 w-full h-[1.5px] rounded-full ${
                      isFen ? "bn-file-underline" : "bg-white"
                    }`}
                  ></span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
