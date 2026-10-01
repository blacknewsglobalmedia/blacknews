import React, { useEffect, useRef } from 'react';
import { ExternalLink, Sparkles, Megaphone, ShieldCheck } from 'lucide-react';
import { AdCampaign, AdPlacement, AD_PLACEMENTS_INFO } from '../types/ads';

interface AdBannerProps {
  placement: AdPlacement;
  campaigns: AdCampaign[];
  selectedCategory?: string;
  onTrackImpression?: (campaignId: string) => void;
  onTrackClick?: (campaignId: string) => void;
  onOpenInquiry?: (placement: AdPlacement) => void;
  className?: string;
}

export const AdBanner: React.FC<AdBannerProps> = ({
  placement,
  campaigns,
  selectedCategory = 'TODAS',
  onTrackImpression,
  onTrackClick,
  onOpenInquiry,
  className = '',
}) => {
  const placementInfo = AD_PLACEMENTS_INFO[placement];
  const hasTrackedImpression = useRef(false);

  // Filter candidates matching placement and active timeframe
  const today = new Date().toISOString().slice(0, 10);
  const eligibleCampaigns = campaigns.filter((c) => {
    if (c.placement !== placement) return false;
    if (c.status !== 'ACTIVE') return false;
    if (c.startDate && c.startDate > today) return false;
    if (c.endDate && c.endDate < today) return false;
    if (c.targetCategory && c.targetCategory !== 'TODAS' && selectedCategory !== 'TODAS' && c.targetCategory !== selectedCategory) {
      return false;
    }
    return true;
  });

  // Pick first matching campaign (or random if multiple)
  const activeCampaign = eligibleCampaigns.length > 0 ? eligibleCampaigns[0] : null;

  useEffect(() => {
    if (activeCampaign && onTrackImpression && !hasTrackedImpression.current) {
      hasTrackedImpression.current = true;
      onTrackImpression(activeCampaign.id);
    }
  }, [activeCampaign?.id, onTrackImpression]);

  const handleClick = (e: React.MouseEvent) => {
    if (!activeCampaign) {
      if (onOpenInquiry) {
        e.preventDefault();
        onOpenInquiry(placement);
      }
      return;
    }

    if (onTrackClick) {
      onTrackClick(activeCampaign.id);
    }
  };

  // If no active campaign, show tasteful sponsor invitation placeholder
  if (!activeCampaign) {
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
                Posicione su marca frente a una audiencia global de inversores, juristas y líderes de opinión.
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

  // Active Campaign Layouts
  if (placement === 'TOP_BILLBOARD') {
    return (
      <aside 
        aria-label={`Publicidad patrocinada por ${activeCampaign.advertiser}`}
        className={`w-full max-w-7xl mx-auto px-4 sm:px-6 my-4 ${className}`}
      >
        <a
          href={activeCampaign.advertiserUrl}
          target="_blank"
          rel="sponsored noopener noreferrer"
          onClick={handleClick}
          className="group block relative rounded-2xl overflow-hidden border border-white/15 hover:border-white/40 transition-all duration-300 shadow-2xl bg-neutral-950"
        >
          <div className="relative min-h-[90px] sm:min-h-[110px] md:min-h-[130px] flex flex-col md:flex-row md:items-center justify-between p-4 sm:p-5 gap-4 overflow-hidden">
            {/* Background image with rich gradient overlay */}
            <img
              src={activeCampaign.imageUrl}
              alt={activeCampaign.imageAlt || activeCampaign.title}
              className="absolute inset-0 w-full h-full object-cover opacity-25 group-hover:opacity-35 transition-opacity duration-700"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black via-black/85 to-black/60 pointer-events-none" />

            {/* Left Content */}
            <div className="relative z-10 max-w-3xl space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[9px] sm:text-[10px] font-mono font-bold uppercase tracking-widest text-black bg-white px-2 py-0.5 rounded-[3px]">
                  {activeCampaign.badgeText || 'PATROCINIO'}
                </span>
                <span className="text-neutral-500 text-[10px]">·</span>
                <span className="text-xs font-semibold text-neutral-300 uppercase tracking-wide">
                  {activeCampaign.advertiser}
                </span>
              </div>

              <h4 className="text-sm sm:text-base md:text-lg font-bold text-white tracking-tight leading-snug group-hover:text-neutral-200 transition-colors font-['Lexend'] line-clamp-2">
                {activeCampaign.title}
              </h4>
            </div>

            {/* Right Action Pill */}
            <div className="relative z-10 shrink-0 self-end md:self-center">
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white text-black font-semibold text-xs rounded-xl shadow-md group-hover:bg-neutral-200 transition-colors">
                <span>Más información</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
        </a>
      </aside>
    );
  }

  if (placement === 'IN_FEED_LEADERBOARD') {
    return (
      <aside 
        aria-label={`Publicidad patrocinada por ${activeCampaign.advertiser}`}
        className={`w-full max-w-7xl mx-auto px-4 sm:px-6 my-6 sm:my-8 ${className}`}
      >
        <a
          href={activeCampaign.advertiserUrl}
          target="_blank"
          rel="sponsored noopener noreferrer"
          onClick={handleClick}
          className="group block relative rounded-2xl overflow-hidden border border-white/15 hover:border-white/40 transition-all duration-300 shadow-xl bg-neutral-950"
        >
          <div className="relative min-h-[85px] sm:min-h-[105px] flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 gap-3">
            <img
              src={activeCampaign.imageUrl}
              alt={activeCampaign.imageAlt || activeCampaign.title}
              className="absolute inset-0 w-full h-full object-cover opacity-20 group-hover:opacity-30 transition-opacity duration-700"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black via-black/90 to-black/70 pointer-events-none" />

            <div className="relative z-10 max-w-2xl space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-black bg-white px-1.5 py-0.5 rounded-[2px]">
                  {activeCampaign.badgeText || 'PARTNER'}
                </span>
                <span className="text-xs text-neutral-300 font-semibold">
                  {activeCampaign.advertiser}
                </span>
              </div>
              <h4 className="text-xs sm:text-sm md:text-base font-bold text-white tracking-tight leading-snug line-clamp-2">
                {activeCampaign.title}
              </h4>
            </div>

            <div className="relative z-10 shrink-0 self-end sm:self-center">
              <span className="inline-flex items-center gap-1 text-xs text-neutral-300 group-hover:text-white font-semibold transition-colors">
                <span>Visitar sitio</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
        </a>
      </aside>
    );
  }

  if (placement === 'ARTICLE_SIDEBAR') {
    return (
      <aside 
        aria-label={`Publicidad patrocinada por ${activeCampaign.advertiser}`}
        className={`w-full rounded-2xl overflow-hidden border border-white/15 hover:border-white/40 transition-all duration-300 bg-neutral-950 shadow-xl group ${className}`}
      >
        <a
          href={activeCampaign.advertiserUrl}
          target="_blank"
          rel="sponsored noopener noreferrer"
          onClick={handleClick}
          className="block"
        >
          {/* Top Banner Media */}
          <div className="relative aspect-[16/10] overflow-hidden">
            <img
              src={activeCampaign.imageUrl}
              alt={activeCampaign.imageAlt || activeCampaign.title}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-transparent to-black/40" />
            <span className="absolute top-2.5 left-2.5 text-[9px] font-mono font-bold uppercase tracking-wider text-black bg-white px-2 py-0.5 rounded-[2px] shadow-sm">
              {activeCampaign.badgeText || 'PATROCINIO'}
            </span>
          </div>

          {/* Text Content */}
          <div className="p-4 space-y-2">
            <div className="text-[10px] font-mono uppercase text-neutral-400 font-semibold tracking-wider">
              {activeCampaign.advertiser}
            </div>
            <h4 className="text-xs sm:text-sm font-bold text-white group-hover:text-neutral-200 transition-colors leading-snug">
              {activeCampaign.title}
            </h4>

            <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs text-neutral-400 group-hover:text-white transition-colors">
              <span className="font-semibold text-[11px]">Acceder a la propuesta</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </div>
          </div>
        </a>
      </aside>
    );
  }

  if (placement === 'ARTICLE_FOOTER') {
    return (
      <aside 
        aria-label={`Publicidad patrocinada por ${activeCampaign.advertiser}`}
        className={`w-full my-6 ${className}`}
      >
        <a
          href={activeCampaign.advertiserUrl}
          target="_blank"
          rel="sponsored noopener noreferrer"
          onClick={handleClick}
          className="group block relative rounded-2xl overflow-hidden border border-white/15 hover:border-white/40 transition-all duration-300 p-4 sm:p-5 bg-neutral-950 shadow-lg"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-black bg-white px-1.5 py-0.5 rounded-[2px]">
                  {activeCampaign.badgeText || 'SPONSORED'}
                </span>
                <span className="text-xs text-neutral-400 font-semibold">
                  {activeCampaign.advertiser}
                </span>
              </div>
              <h4 className="text-xs sm:text-sm font-bold text-white leading-snug">
                {activeCampaign.title}
              </h4>
            </div>

            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/10 group-hover:bg-white group-hover:text-black text-white text-xs font-semibold rounded-xl transition-all shrink-0 border border-white/15">
              <span>Saber más</span>
              <ExternalLink className="w-3 h-3" />
            </span>
          </div>
        </a>
      </aside>
    );
  }

  // Default / GRID_CARD (Format 4:5 native post card)
  return (
    <article
      className={`group relative bg-black rounded-2xl overflow-hidden border border-white/15 hover:border-white/40 transition-all duration-300 shadow-2xl flex flex-col justify-between cursor-pointer aspect-[4/5] ${className}`}
      style={{ backgroundColor: '#000000' }}
    >
      <a
        href={activeCampaign.advertiserUrl}
        target="_blank"
        rel="sponsored noopener noreferrer"
        onClick={handleClick}
        className="flex flex-col h-full justify-between"
      >
        {/* Top Text Content Area */}
        <div className="p-5 sm:p-6 z-20 relative select-none">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold tracking-[0.14em] uppercase text-black bg-white px-2 py-0.5 rounded-[2px] font-['Lexend']">
              {activeCampaign.badgeText || 'PATROCINIO'}
            </span>
            <span className="text-neutral-500 text-[10px]">·</span>
            <span className="text-[10px] sm:text-[11px] font-semibold tracking-wide text-neutral-300 uppercase">
              {activeCampaign.advertiser}
            </span>
            <span className="flex-1 max-w-[40px] min-w-[12px] h-[1.5px] bg-white inline-block shrink-0 ml-1" />
          </div>

          <h3 className="mt-3 text-sm sm:text-base md:text-lg font-bold text-white font-['Lexend'] leading-tight tracking-tight drop-shadow-sm line-clamp-3 group-hover:text-neutral-200 transition-colors">
            {activeCampaign.title}
          </h3>

          <p className="mt-2 text-xs sm:text-sm text-neutral-300 font-normal font-['Lexend'] leading-relaxed line-clamp-2">
            Contenido patrocinado exclusivo para lectores e inversores de BlackNews.
          </p>
        </div>

        {/* Media Container */}
        <div className="absolute inset-0 top-[44%] overflow-hidden z-0">
          <img
            src={activeCampaign.imageUrl}
            alt={activeCampaign.imageAlt || activeCampaign.title}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            loading="lazy"
          />
          <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black via-black/75 to-transparent pointer-events-none" />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/90 to-transparent pointer-events-none" />
        </div>

        {/* Bottom Bar */}
        <div className="p-4 sm:p-5 z-20 flex items-center justify-between relative mt-auto border-t border-white/5 bg-gradient-to-t from-black via-black/80 to-transparent">
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 bg-white rounded-none" />
            <span className="text-xs sm:text-sm font-bold text-white tracking-tight font-['Lexend']">
              BlackNews Partner
            </span>
          </div>

          <span className="p-1 text-white/90 hover:text-white group-hover:translate-x-0.5 transition-transform flex items-center gap-1 text-xs font-semibold">
            <span>Visitar</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </span>
        </div>
      </a>
    </article>
  );
};
