import React, { useEffect, useState } from "react";
import {
  AD_PLACEMENTS_INFO,
  AdPlacement,
  IN_ARTICLE_AD_EVERY,
} from "../types/ads";

/**
 * Maqueta en miniatura de BlackNews para el paso «Dónde» del asistente de
 * publicidad: DOS maquetas en pestañas, para no tenerlo todo en una.
 *  · «Portada»: el orden real de la página principal (barra → teletipo →
 *    billboard → apertura → secciones intermedias → Edición Visual →
 *    leaderboard → cuadernos), con los 3 huecos de portada dibujados.
 *  · «Publicación»: el despacho abierto con sus3 huecos (rectángulo en el
 *    cuerpo, cada N párrafos y pie).
 * El hueco seleccionado enciende en esmeralda; tocar un hueco cambia la
 * ubicación y la pestaña sigue a la ubicación elegida (también cuando se
 * elige desde las cards de la lista). Es un esqueleto dibujado, no una
 * captura: no se rompe si cambia el layout del sitio.
 */
interface AdPlacementMapProps {
  selected: AdPlacement;
  onSelect: (placement: AdPlacement) => void;
}

/** En qué maqueta vive cada hueco. */
type MapView = "portada" | "publicacion";

const VIEW_OF: Record<AdPlacement, MapView> = {
  TOP_BILLBOARD: "portada",
  IN_FEED_LEADERBOARD: "portada",
  GRID_CARD: "portada",
  ARTICLE_SIDEBAR: "publicacion",
  IN_ARTICLE_PARAGRAPHS: "publicacion",
  ARTICLE_FOOTER: "publicacion",
};

/** Nombre corto de cada hueco: tiene que caber dentro del hueco a 8 px. */
const SLOT_LABEL: Record<AdPlacement, string> = {
  TOP_BILLBOARD: "Billboard superior",
  IN_FEED_LEADERBOARD: "Entre secciones",
  ARTICLE_SIDEBAR: "En el artículo",
  IN_ARTICLE_PARAGRAPHS: `Cada ${IN_ARTICLE_AD_EVERY} párrafos`,
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

/**
 * Sección real de la portada que no lleva anuncio (sala de situación,
 * mapa, Intelligence…): fantasma discreto con su nombre, para que el
 * orden del esquema coincida con el orden de la página principal.
 */
const Section: React.FC<{ label: string; center?: boolean }> = ({
  label,
  center = false,
}) => (
  <div
    className={`flex items-center gap-2 rounded-sm bg-white/[0.04] px-2 py-1.5 ${center ? "justify-center" : ""}`}
  >
    <span className="shrink-0 font-mono text-[7px] uppercase tracking-[0.18em] text-neutral-600">
      {label}
    </span>
    {!center && <Line className="flex-1" />}
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

/** Chrome del navegador: da el contexto de «esto es el sitio». */
const BrowserChrome: React.FC = () => (
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
);

/** Maqueta 1 · Portada: el mismo orden que la página principal real. */
const PortadaView: React.FC<{
  selected: AdPlacement;
  onSelect: (placement: AdPlacement) => void;
}> = ({ selected, onSelect }) => (
  <div className="space-y-2">
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

    {/* Secciones intermedias reales: en la página principal van entre la
        apertura y la parrilla (la maqueta las refleja en ese orden) */}
    <Section label="Sala de situación" />
    <Section label="Mapa geopolítico" />
    <Section label="Frase del día" />
    <Section label="Intelligence" />

    {/* Parrilla «Edición Visual»: 6 despachos por página y la card
        patrocinada tras los dos primeros, con su misma proporción 4:5 */}
    <p className="font-mono text-[7px] uppercase tracking-[0.2em] text-neutral-600">
      Edición visual
    </p>
    <div className="grid grid-cols-3 gap-2">
      <PostTile />
      <PostTile />
      <Slot id="GRID_CARD" selected={selected} onSelect={onSelect} />
    </div>
    <div className="grid grid-cols-3 gap-2">
      <PostTile />
      <PostTile />
      <PostTile />
    </div>

    {/* Y más abajo, antes del leaderboard, van éstas */}
    <Section label="Fenómenos & anomalías" />
    <Section label="Personal briefing" />
    <Section label="Podcasts" />

    {/* Hueco 2 · Leaderboard (transición a los cuadernos) */}
    <Slot id="IN_FEED_LEADERBOARD" selected={selected} onSelect={onSelect} />

    <Section label="Cuadernos" />
  </div>
);

/** Maqueta 2 · Publicación: el despacho abierto con sus3 huecos. */
const PublicacionView: React.FC<{
  selected: AdPlacement;
  onSelect: (placement: AdPlacement) => void;
}> = ({ selected, onSelect }) => (
  <div className="space-y-2">
    {/* Cabecera del despacho: titular, bajada y firma */}
    <div className="space-y-1.5 pb-1">
      <Line bright className="w-11/12" />
      <Line bright className="w-3/5" />
      <div className="flex items-center gap-2 pt-0.5">
        <Line className="w-12" />
        <Line className="w-16" />
      </div>
    </div>

    {/* Cuerpo del despacho: el rectangle va DENTRO del texto (tras las
        claves del informe) y el in-feed se repite tras cada N párrafos */}
    <div className="space-y-2">
      <div className="space-y-1.5">
        <Line className="w-11/12" />
        <Line className="w-full" />
        <Line className="w-10/12" />
      </div>

      {/* Hueco 3 · Rectangle dentro del cuerpo del artículo */}
      <div className="mx-auto w-[58%]">
        <Slot id="ARTICLE_SIDEBAR" selected={selected} onSelect={onSelect} />
      </div>

      <div className="space-y-1.5">
        <Line className="w-full" />
        <Line className="w-9/12" />
        <Line className="w-full" />
      </div>

      {/* Hueco 4 · In-feed dentro del cuerpo: cada N párrafos */}
      <Slot
        id="IN_ARTICLE_PARAGRAPHS"
        selected={selected}
        onSelect={onSelect}
      />

      <div className="space-y-1.5">
        <Line className="w-11/12" />
        <Line className="w-full" />
      </div>

      {/* Y otra vez más abajo en los artículos largos */}
      <Slot
        id="IN_ARTICLE_PARAGRAPHS"
        selected={selected}
        onSelect={onSelect}
      />
    </div>

    {/* Hueco 5 · Pie del artículo (al final de la lectura) */}
    <Slot id="ARTICLE_FOOTER" selected={selected} onSelect={onSelect} />
  </div>
);

const TABS: Array<{ id: MapView; label: string }> = [
  { id: "portada", label: "Portada" },
  { id: "publicacion", label: "Publicación" },
];

export const AdPlacementMap: React.FC<AdPlacementMapProps> = ({
  selected,
  onSelect,
}) => {
  const [view, setView] = useState<MapView>(VIEW_OF[selected]);

  // La pestaña sigue a la ubicación elegida (desde las cards de la lista
  // o desde una maqueta). Cambiar de pestaña a mano sobrevive mientras no
  // cambie la selección.
  useEffect(() => {
    setView(VIEW_OF[selected]);
  }, [selected]);

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-neutral-950">
      <BrowserChrome />

      {/* Pestañas: una maqueta por vista, sin amontonar todo en una */}
      <div
        role="tablist"
        aria-label="Maquetas"
        className="flex gap-1.5 border-b border-white/10 bg-neutral-900/40 px-3 py-2"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={view === t.id}
            onClick={() => setView(t.id)}
            className={`flex-1 rounded-md border px-2 py-1 font-mono text-[9px] uppercase tracking-[0.16em] transition-colors ${
              view === t.id
                ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                : "border-transparent text-neutral-500 hover:text-neutral-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-3 bg-black p-3">
        {view === "portada" ? (
          <PortadaView selected={selected} onSelect={onSelect} />
        ) : (
          <PublicacionView selected={selected} onSelect={onSelect} />
        )}
      </div>
    </div>
  );
};
