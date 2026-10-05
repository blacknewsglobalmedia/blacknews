import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Megaphone } from "lucide-react";
import { AdCampaign, AdPlacement, AD_PLACEMENTS_INFO } from "../types/ads";

interface AdBannerProps {
  placement: AdPlacement;
  campaigns: AdCampaign[];
  selectedCategory?: string;
  onTrackImpression?: (campaignId: string) => void;
  onTrackClick?: (campaignId: string) => void;
  onOpenInquiry?: (placement: AdPlacement) => void;
  className?: string;
}

/** Intervalo de rotación del carrusel de anuncios (ms). */
const ROTATE_MS = 6000;

/** Contenedores externos por slot (márgenes y ancho). */
const SLOT_WRAPPER: Record<AdPlacement, string> = {
  TOP_BILLBOARD: "w-full max-w-7xl mx-auto px-4 sm:px-6 my-4",
  IN_FEED_LEADERBOARD: "w-full max-w-7xl mx-auto px-4 sm:px-6 my-6 sm:my-8",
  ARTICLE_SIDEBAR: "w-full",
  ARTICLE_FOOTER: "w-full my-6",
  GRID_CARD: "w-full",
};

export const AdBanner: React.FC<AdBannerProps> = ({
  placement,
  campaigns,
  selectedCategory = "TODAS",
  onTrackImpression,
  onTrackClick,
  onOpenInquiry,
  className = "",
}) => {
  const placementInfo = AD_PLACEMENTS_INFO[placement];

  // Campañas elegibles: mismo placement, activas, en vigencia y por categoría
  const eligibleCampaigns = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return campaigns.filter((c) => {
      if (c.placement !== placement) return false;
      if (c.status !== "ACTIVE") return false;
      if (c.startDate && c.startDate > today) return false;
      if (c.endDate && c.endDate < today) return false;
      if (
        c.targetCategory &&
        c.targetCategory !== "TODAS" &&
        selectedCategory !== "TODAS" &&
        c.targetCategory !== selectedCategory
      ) {
        return false;
      }
      return true;
    });
  }, [campaigns, placement, selectedCategory]);

  const idsKey = eligibleCampaigns.map((c) => c.id).join("|");

  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  // Índice activo siempre dentro de rango cuando cambia la lista
  const activeIndex = eligibleCampaigns.length
    ? active % eligibleCampaigns.length
    : 0;
  const activeCampaign = eligibleCampaigns[activeIndex] || null;

  // prefers-reduced-motion: sin autoplay ni transiciones
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduceMotion(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Nueva lista de campañas → reinicia el carrusel
  useEffect(() => {
    setActive(0);
  }, [idsKey]);

  // Impresión: una por campaña por cada carga de página (evita reescribir
  // localStorage cada rotación). Así consta en docs/publicidad.md.
  const trackedImpressions = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!onTrackImpression) return;
    for (const c of eligibleCampaigns) {
      if (!trackedImpressions.current.has(c.id)) {
        trackedImpressions.current.add(c.id);
        onTrackImpression(c.id);
      }
    }
  }, [idsKey]);

  // Autoplay del carrusel
  useEffect(() => {
    if (eligibleCampaigns.length < 2 || paused || reduceMotion) return;
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      setActive((i) => (i + 1) % eligibleCampaigns.length);
    }, ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [eligibleCampaigns.length, paused, reduceMotion, idsKey]);

  const handleClick = (campaignId: string) => {
    onTrackClick?.(campaignId);
  };

  const pauseProps = {
    onMouseEnter: () => setPaused(true),
    onMouseLeave: () => setPaused(false),
    onFocus: () => setPaused(true),
    onBlur: () => setPaused(false),
  };

  // Sin campaña activa y sin gestor de consulta: no se pinta nada (evita huecos muertos).
  if (eligibleCampaigns.length === 0 && !onOpenInquiry) {
    return null;
  }

  // Sin campaña activa: invitación patrocinada discreta (solo si hay gestor).
  if (eligibleCampaigns.length === 0) {
    return (
      <div
        onClick={() => onOpenInquiry?.(placement)}
        className={`w-full border border-dashed border-white/15 hover:border-white/40 rounded-xl bg-neutral-950/40 p-4 transition-all duration-300 cursor-pointer text-center group ${className}`}
      >
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 max-w-4xl mx-auto">
          <div className="flex items-center gap-2.5 text-left">
            <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-neutral-400 group-hover:text-white group-hover:border-white/30 transition-colors shrink-0">
              <Megaphone className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-semibold">
                  ESPACIO PATROCINADO DISPONIBLE
                </span>
                <span className="text-[9px] font-mono text-neutral-500">
                  [{placementInfo?.name || placement}]
                </span>
              </div>
              <p className="text-xs text-neutral-300 mt-0.5">
                Posicione su marca frente a una audiencia global de inversores,
                juristas y líderes de opinión.
              </p>
            </div>
          </div>

          <button
            type="button"
            className="px-3.5 py-1.5 bg-white/10 group-hover:bg-white group-hover:text-black text-white text-xs font-semibold uppercase tracking-wider rounded-lg transition-all shrink-0 border border-white/15"
          >
            Anúnciate Aquí
          </button>
        </div>
      </div>
    );
  }

  const showControls = eligibleCampaigns.length > 1;
  const isContain = placementInfo.fit !== "cover";

  return (
    <aside
      aria-label={`Espacio publicitario: ${eligibleCampaigns
        .map((c) => c.advertiser)
        .join(", ")}`}
      className={`${SLOT_WRAPPER[placement]} ${className}`}
    >
      <div
        className={`group relative w-full overflow-hidden rounded-xl border border-white/10 bg-black transition-colors hover:border-white/25 ${
          placementInfo.containerClass || ""
        }`}
        style={
          placementInfo.aspect
            ? { aspectRatio: placementInfo.aspect }
            : undefined
        }
        {...pauseProps}
      >
        {eligibleCampaigns.map((c, i) => {
          const isActive = i === activeIndex;
          return (
            <a
              key={c.id}
              href={c.advertiserUrl}
              target="_blank"
              rel="sponsored noopener noreferrer"
              onClick={() => handleClick(c.id)}
              tabIndex={isActive ? 0 : -1}
              aria-hidden={!isActive}
              className={`absolute inset-0 block transition-opacity ${
                reduceMotion ? "" : "duration-500 ease-out"
              } ${
                isActive
                  ? "z-10 opacity-100"
                  : "z-0 opacity-0 pointer-events-none"
              }`}
            >
              <img
                src={c.imageUrl}
                alt={c.imageAlt || `${c.advertiser} – ${c.title}`}
                loading="lazy"
                draggable={false}
                onError={() =>
                  setBrokenImages((prev) => ({ ...prev, [c.id]: true }))
                }
                className={`h-full w-full select-none ${
                  isContain ? "object-contain" : "object-cover"
                } ${brokenImages[c.id] ? "hidden" : ""}`}
              />
              {brokenImages[c.id] && (
                <div className="flex h-full w-full flex-col items-center justify-center gap-0.5 bg-gradient-to-r from-neutral-950 to-black px-4 text-center">
                  <span className="text-[8px] font-mono uppercase tracking-[0.2em] text-neutral-500">
                    {c.badgeText || "Patrocinio"}
                  </span>
                  <span className="line-clamp-1 text-xs font-semibold text-white">
                    {c.title}
                  </span>
                  <span className="text-[10px] text-neutral-400">
                    {c.advertiser}
                  </span>
                </div>
              )}
            </a>
          );
        })}

        {/* Etiqueta de transparencia publicitaria */}
        <span className="pointer-events-none absolute left-2 top-1.5 z-20 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.2em] text-neutral-500">
          Publicidad
        </span>

        {/* Anunciante (micro) */}
        <span className="pointer-events-none absolute bottom-1.5 left-2 z-20 max-w-[55%] truncate font-mono text-[8px] uppercase tracking-widest text-neutral-600">
          {activeCampaign?.advertiser}
        </span>

        {/* Controles del carrusel: puntos siempre, flechas al hover/foco */}
        {showControls && (
          <div className="absolute bottom-1.5 right-2 z-20 flex items-center gap-1">
            <button
              type="button"
              aria-label="Anuncio anterior"
              onClick={() =>
                setActive((i) => (i - 1 + eligibleCampaigns.length) % eligibleCampaigns.length)
              }
              className="hidden rounded-full border border-white/10 bg-black/60 p-0.5 text-neutral-400 opacity-0 transition-opacity hover:text-white focus-visible:opacity-100 group-hover:opacity-100 sm:block"
            >
              <ChevronLeft className="h-3 w-3" />
            </button>
            <div className="flex items-center gap-1 px-1">
              {eligibleCampaigns.map((c, i) => (
                <button
                  key={c.id}
                  type="button"
                  aria-label={`Ir al anuncio ${i + 1} de ${eligibleCampaigns.length}`}
                  aria-current={i === activeIndex}
                  onClick={() => setActive(i)}
                  className={`h-1.5 w-1.5 rounded-full transition-colors ${
                    i === activeIndex
                      ? "bg-white/90"
                      : "bg-white/25 hover:bg-white/50"
                  }`}
                />
              ))}
            </div>
            <button
              type="button"
              aria-label="Siguiente anuncio"
              onClick={() => setActive((i) => (i + 1) % eligibleCampaigns.length)}
              className="hidden rounded-full border border-white/10 bg-black/60 p-0.5 text-neutral-400 opacity-0 transition-opacity hover:text-white focus-visible:opacity-100 group-hover:opacity-100 sm:block"
            >
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};
