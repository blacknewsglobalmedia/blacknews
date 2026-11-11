import React from "react";
import { AD_PLACEMENTS_INFO, AdPlacement } from "../types/ads";

/**
 * Maqueta en miniatura de BlackNews para el paso «Dónde» del asistente de
 * publicidad: los 5 espacios dibujados en su contexto real (portada y
 * artículo), con el seleccionado encendido en esmeralda. Tocar un hueco
 * cambia la ubicación; tocar una card de la lista enciende su hueco aquí.
 * Es un esqueleto dibujado, no una captura: no se rompe si cambia el
 * layout del sitio y cada hueco se puede resaltar por separado.
 */
interface AdPlacementMapProps {
  selected: AdPlacement;
  onSelect: (placement: AdPlacement) => void;
}

/** Nombre corto de cada hueco: tiene que caber dentro del hueco a 8 px. */
const SLOT_LABEL: Record<AdPlacement, string> = {
  TOP_BILLBOARD: "Billboard superior",
  IN_FEED_LEADERBOARD: "Entre secciones",
  ARTICLE_SIDEBAR: "En el artículo",
  ARTICLE_FOOTER: "Pie del artículo",
  GRID_CARD: "Card 4:5",
};

/** Línea de contenido del esqueleto (titular o bajada simulados). */
const Line: React.FC<{ className?: string; bright?: boolean }> = ({
  className = "",
  bright = false,
}) => (
  <span
    className={`block h-1 rounded-full ${bright ? "bg-white/25" : "bg-white/15"} ${className}`}
  />
);

/** Post de la parrilla «Edición Visual»: mismo4:5 que la card patrocinada. */
const PostTile: React.FC = () => (
  <div className="aspect-[4/5] space-y-1.5 rounded-sm bg-white/[0.07] p-2">
    <Line bright className="w-4/5" />
    <Line bright className="w-3/5" />
  </div>
);

/** Hueco publicitario: botón seleccionable con su proporción real. */
const Slot: React.FC<{
  id: AdPlacement;
  selected: AdPlacement;
  onSelect: (placement: AdPlacement) => void;
}> = ({ id, selected, onSelect }) => {
  const info = AD_PLACEMENTS_INFO[id];
  const on = id === selected;
  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      aria-pressed={on}
      aria-label={`${info.name} — ${SLOT_LABEL[id]}`}
      title={info.description}
      className={`relative block w-full cursor-pointer rounded-[3px] border transition-colors ${
        on
          ? "border-emerald-500 bg-emerald-500/15"
          : "border-dashed border-white/25 bg-white/[0.05] hover:border-white/50 hover:bg-white/[0.08]"
      }`}
      style={{ aspectRatio: info.ratio }}
    >
      <span
        className={`absolute inset-0 flex items-center justify-center px-1 text-center font-mono uppercase leading-tight ${
          on
            ? "text-[9px] font-bold tracking-[0.12em] text-emerald-300"
            : "text-[8px] tracking-[0.14em] text-neutral-500"
        }`}
      >
        {on ? "Tu anuncio" : SLOT_LABEL[id]}
      </span>
    </button>
  );
};

export const AdPlacementMap: React.FC<AdPlacementMapProps> = ({
  selected,
  onSelect,
}) => (
  <div className="overflow-hidden rounded-xl border border-white/10 bg-neutral-950">
    {/* Chrome del navegador: da el contexto de «esto es el sitio» */}
    <div className="flex items-center gap-2 border-b border-white/10 bg-neutral-900/70 px-3 py-2">
      <span aria-hidden className="flex gap-1">
        <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
        <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
        <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
      </span>
      <span className="flex-1 truncate rounded bg-black/60 px-2 py-0.5 text-center font-mono text-[9px] tracking-wider text-neutral-500">
        blacknews.com
      </span>
    </div>

    <div className="space-y-3 bg-black p-3">
      {/* ── PORTADA ─────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <p className="font-mono text-[8px] uppercase tracking-[0.22em] text-neutral-600">
          Portada
        </p>

        {/* Barra del sitio */}
        <div className="flex items-center gap-2 rounded-sm bg-white/[0.06] px-2 py-1.5">
          <span className="font-mono text-[7px] font-bold tracking-tight text-white">
            BLACKNEWS.
          </span>
          <span aria-hidden className="ml-auto flex gap-1.5">
            <Line className="w-4" />
            <Line className="w-4" />
            <Line className="w-4" />
          </span>
        </div>

        {/* Teletipo */}
        <div className="flex items-center gap-2 rounded-sm bg-white/[0.06] px-2 py-1">
          <span className="shrink-0 rounded-[2px] bg-red-600/80 px-1 py-px font-mono text-[7px] font-bold uppercase tracking-wider text-white">
            Última hora
          </span>
          <Line className="flex-1" />
        </div>

        {/* Hueco 1 · Billboard (arriba del todo, entre teletipo y noticia) */}
        <Slot id="TOP_BILLBOARD" selected={selected} onSelect={onSelect} />

        {/* Noticia de apertura */}
        <div className="flex gap-2">
          <div className="aspect-[16/9] w-2/5 shrink-0 rounded-sm bg-white/[0.07]" />
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
            <Line className="w-full" />
            <Line className="w-4/5" />
            <Line className="w-1/2" />
          </div>
        </div>

        {/* Parrilla «Edición Visual»: la card patrocinada va entre posts
            4:5, con la misma proporción que ellos */}
        <div className="grid grid-cols-3 gap-2">
          <PostTile />
          <PostTile />
          <Slot id="GRID_CARD" selected={selected} onSelect={onSelect} />
        </div>

        {/* Hueco 2 · Leaderboard (transición a los cuadernos) */}
        <Slot id="IN_FEED_LEADERBOARD" selected={selected} onSelect={onSelect} />
      </div>

      {/* ── ARTÍCULO ────────────────────────────────────────────────── */}
      <div className="space-y-2 border-t border-white/10 pt-3">
        <p className="font-mono text-[8px] uppercase tracking-[0.22em] text-neutral-600">
          Al abrir un artículo
        </p>

        <div className="flex gap-2.5">
          {/* Cuerpo del despacho */}
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Line className="w-11/12" />
            <Line className="w-full" />
            <Line className="w-10/12" />
            <Line className="w-full" />
            <Line className="w-9/12" />
            <Line className="w-full" />
          </div>
          {/* Hueco 3 · Rectángulo en el cuerpo del artículo */}
          <div className="w-[84px] shrink-0">
            <Slot id="ARTICLE_SIDEBAR" selected={selected} onSelect={onSelect} />
          </div>
        </div>

        {/* Hueco 4 · Pie del artículo (antes de las claves ejecutivas) */}
        <Slot id="ARTICLE_FOOTER" selected={selected} onSelect={onSelect} />
      </div>
    </div>
  </div>
);
