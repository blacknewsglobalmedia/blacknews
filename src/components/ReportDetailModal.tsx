import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Share2, 
  Bookmark, 
  Volume2, 
  VolumeX, 
  ArrowLeft, 
  ChevronRight,
  Sparkles,
  Check,
  Highlighter,
  Trash2,
  Copy,
  Lock
} from 'lucide-react';
import { Report } from '../types/news';
import { AdCampaign } from '../types/ads';
import { AdBanner } from './AdBanner';
import { OptimizedPicture } from './OptimizedPicture';
import { RichText } from './RichText';
import { readTimeOf } from '../utils/readTime';
import { getReadPct, setReadPct } from '../utils/readProgress';
import { Highlight, getHighlights, addHighlight, removeHighlight } from '../utils/highlights';

interface ReportDetailModalProps {
  report: Report | null;
  isOpen: boolean;
  onClose: () => void;
  onShare: (report: Report) => void;
  isBookmarked: boolean;
  onToggleBookmark: (report: Report) => void;
  onSelectReport: (report: Report) => void;
  allReports: Report[];
  adCampaigns?: AdCampaign[];
  onTrackImpression?: (campaignId: string) => void;
  onTrackClick?: (campaignId: string) => void;
  /** Cuota diaria agotada: aviso de suscripción al final del texto. */
  readExhausted?: boolean;
  /** Cuota de lecturas del día (para redactar el aviso). */
  readLimit?: number;
  /** Abre el modal de suscripciones desde el aviso de cuota. */
  onOpenSubscription?: () => void;
}

export const ReportDetailModal: React.FC<ReportDetailModalProps> = ({
  report,
  isOpen,
  onClose,
  onShare,
  isBookmarked,
  onToggleBookmark,
  onSelectReport,
  allReports,
  adCampaigns = [],
  onTrackImpression,
  onTrackClick,
  readExhausted = false,
  readLimit = 0,
  onOpenSubscription,
}) => {
  const [fontSizeScale, setFontSizeScale] = useState<'normal' | 'large' | 'huge'>('normal');
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [progress, setProgress] = useState(0);
  const [resumePct, setResumePct] = useState<number | null>(null);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [selPill, setSelPill] = useState<{ text: string; x: number; y: number; below: boolean } | null>(null);
  const [copiedHl, setCopiedHl] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const articleRef = useRef<HTMLElement>(null);
  const pctRef = useRef(0);
  const reportIdRef = useRef<string | null>(null);
  const lastSaveRef = useRef(0);
  const restoredRef = useRef<string | null>(null);
  const selTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen) {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setIsPlayingAudio(false);
      if (reportIdRef.current) {
        setReadPct(reportIdRef.current, pctRef.current);
      }
      restoredRef.current = null;
      setSelPill(null);
    }
  }, [isOpen, report?.id]);

  // Subrayados guardados del artículo actual
  useEffect(() => {
    if (isOpen && report) {
      reportIdRef.current = report.id;
      setHighlights(getHighlights(report.id));
    }
  }, [isOpen, report?.id]);

  // Retomar la lectura donde se quedó (y arrancar arriba al cambiar de informe)
  useEffect(() => {
    if (!isOpen || !report) return;
    const id = report.id;
    const timer = window.setTimeout(() => {
      if (restoredRef.current === id) return;
      restoredRef.current = id;
      const container = scrollRef.current;
      const art = articleRef.current;
      if (!container || !art) return;
      const pct = getReadPct(id);
      const max = art.offsetTop + art.offsetHeight - container.clientHeight;
      if (pct && max > 0) {
        container.scrollTop = pct * max;
        setProgress(pct);
        pctRef.current = pct;
        setResumePct(pct);
        window.setTimeout(() => setResumePct(null), 3500);
      } else {
        container.scrollTop = 0;
        setProgress(0);
        pctRef.current = 0;
      }
    }, 150);
    return () => window.clearTimeout(timer);
  }, [isOpen, report?.id]);

  if (!isOpen || !report) return null;

  const toggleSpeech = () => {
    if (!('speechSynthesis' in window)) return;

    if (isPlayingAudio) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
    } else {
      window.speechSynthesis.cancel();
      const textToRead = `${report.title}. ${report.lead}.`;
      const utterance = new SpeechSynthesisUtterance(textToRead);
      utterance.lang = 'es-ES';
      utterance.rate = 1.0;
      utterance.onend = () => setIsPlayingAudio(false);
      utterance.onerror = () => setIsPlayingAudio(false);
      window.speechSynthesis.speak(utterance);
      setIsPlayingAudio(true);
    }
  };

  const handleQuickCopyLink = async () => {
    const url = `${window.location.origin}${window.location.pathname}?informe=${encodeURIComponent(report.id)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {}
  };

  const handleScroll = () => {
    const container = scrollRef.current;
    const art = articleRef.current;
    if (!container || !art || !report) return;
    const max = art.offsetTop + art.offsetHeight - container.clientHeight;
    const pct = max > 0 ? Math.min(1, Math.max(0, container.scrollTop / max)) : 0;
    pctRef.current = pct;
    setProgress((prev) => (Math.abs(prev - pct) < 0.004 ? prev : pct));
    const now = Date.now();
    if (now - lastSaveRef.current > 500) {
      lastSaveRef.current = now;
      setReadPct(report.id, pct);
    }
    if (selPill) setSelPill(null);
  };

  const detectSelection = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !report) {
      setSelPill(null);
      return;
    }
    const text = sel.toString().trim();
    const art = articleRef.current;
    if (
      text.length < 4 ||
      text.length > 500 ||
      !art ||
      !sel.anchorNode ||
      !art.contains(sel.anchorNode)
    ) {
      setSelPill(null);
      return;
    }
    const belongs =
      report.lead.includes(text) ||
      report.sections.some((s) => (s.text || '').includes(text));
    if (!belongs) {
      setSelPill(null);
      return;
    }
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    setSelPill({
      text,
      x: rect.left + rect.width / 2,
      y: rect.top,
      below: rect.top < 72,
    });
  };

  const scheduleSelection = (delay: number) => {
    if (selTimerRef.current) window.clearTimeout(selTimerRef.current);
    selTimerRef.current = window.setTimeout(detectSelection, delay);
  };

  const saveSelection = () => {
    if (!selPill || !report) return;
    addHighlight(report.id, selPill.text);
    setHighlights(getHighlights(report.id));
    window.getSelection()?.removeAllRanges();
    setSelPill(null);
  };

  const copyHighlight = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedHl(id);
      window.setTimeout(() => setCopiedHl(null), 1500);
    } catch {}
  };

  // Mejores relacionados: misma categoría y etiquetas compartidas primero
  const relatedReports = allReports
    .filter((r) => r.id !== report.id)
    .map((r) => ({
      r,
      score:
        (r.category === report.category ? 3 : 0) +
        r.tags.filter((t) => report.tags.includes(t)).length * 2 +
        (r.trending ? 0.5 : 0),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((item) => item.r);

  const fontSizeClass = {
    normal: 'text-base sm:text-[1.08rem] leading-[1.8]',
    large: 'text-lg sm:text-[1.22rem] leading-[1.85]',
    huge: 'text-xl sm:text-[1.38rem] leading-[1.9]',
  }[fontSizeScale];

  // Términos del glosario ya resaltados en este render (1ª aparición por informe)
  const seenTerms = new Set<string>();

  return (
    <div ref={scrollRef} onScroll={handleScroll} className="fixed inset-0 z-50 overflow-y-auto bg-black flex flex-col justify-start font-['Lexend',sans-serif]">
      {/* Top Reader Bar: Minimalist & Refined */}
      <div className="sticky top-0 z-30 w-full bg-black/95 backdrop-blur-md border-b border-white/10 px-4 sm:px-6 py-2.5 flex items-center justify-between">
        {/* Barra de progreso de lectura */}
        <div
          className="absolute top-0 left-0 h-[2px] bg-white shadow-[0_0_8px_rgba(255,255,255,0.7)] transition-[width] duration-150 ease-out"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex items-center gap-2 text-xs sm:text-sm font-sans font-medium uppercase tracking-wider text-neutral-400 hover:text-white transition-colors cursor-pointer py-1 px-2.5 rounded-md hover:bg-white/5"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">VOLVER A LA PORTADA</span>
          </button>
          <span className="text-neutral-700 hidden sm:inline">·</span>
          <span className="text-xs font-sans text-neutral-400 font-medium hidden md:inline truncate max-w-xs">
            {report.category}
          </span>
        </div>

        {/* Reader Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Audio read-aloud */}
          <button
            onClick={toggleSpeech}
            className={`px-3 py-1.5 text-xs font-sans font-medium rounded-md flex items-center gap-1.5 transition-colors cursor-pointer ${
              isPlayingAudio
                ? 'bg-white text-black font-semibold shadow-sm'
                : 'text-neutral-400 hover:text-white hover:bg-white/5'
            }`}
            title="Escuchar locución del informe"
          >
            {isPlayingAudio ? (
              <>
                <VolumeX className="w-3.5 h-3.5" />
                <span className="text-xs hidden sm:inline">DETENER</span>
              </>
            ) : (
              <>
                <Volume2 className="w-3.5 h-3.5" />
                <span className="text-xs hidden sm:inline">ESCUCHAR</span>
              </>
            )}
          </button>

          {/* Text scale control */}
          <div className="hidden sm:flex items-center text-xs font-sans gap-0.5 bg-neutral-900/60 p-0.5 rounded-md border border-white/10">
            <button
              onClick={() => setFontSizeScale('normal')}
              className={`px-2 py-1 rounded transition-colors ${
                fontSizeScale === 'normal' ? 'bg-white text-black font-semibold' : 'text-neutral-400 hover:text-white'
              }`}
              title="Texto normal"
            >
              A
            </button>
            <button
              onClick={() => setFontSizeScale('large')}
              className={`px-2 py-1 rounded transition-colors ${
                fontSizeScale === 'large' ? 'bg-white text-black font-semibold' : 'text-neutral-400 hover:text-white'
              }`}
              title="Texto grande"
            >
              A+
            </button>
            <button
              onClick={() => setFontSizeScale('huge')}
              className={`px-2 py-1 rounded transition-colors ${
                fontSizeScale === 'huge' ? 'bg-white text-black font-semibold' : 'text-neutral-400 hover:text-white'
              }`}
              title="Texto extra grande"
            >
              A++
            </button>
          </div>

          {/* Quick Copy Link */}
          <button
            onClick={handleQuickCopyLink}
            className="p-2 rounded-md text-neutral-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            title="Copiar enlace directo"
          >
            {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
          </button>

          {/* Bookmark */}
          <button
            onClick={() => onToggleBookmark(report)}
            className={`p-2 rounded-md transition-colors cursor-pointer ${
              isBookmarked
                ? 'text-white bg-white/10'
                : 'text-neutral-400 hover:text-white hover:bg-white/5'
            }`}
            title={isBookmarked ? 'Guardado en lecturas' : 'Guardar en lecturas'}
          >
            <Bookmark className="w-4 h-4" />
          </button>

          {/* Share button */}
          <button
            onClick={() => onShare(report)}
            className="px-3.5 py-1.5 text-xs sm:text-sm font-semibold bg-white text-black hover:bg-neutral-200 transition-colors uppercase tracking-wider rounded-md flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>COMPARTIR</span>
          </button>

          {/* Close */}
          <button
            onClick={onClose}
            className="p-2 rounded-md text-neutral-400 hover:text-white hover:bg-white/5 transition-colors ml-1 cursor-pointer"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Aviso de reanudación de lectura */}
      {resumePct !== null && (
        <div className="fixed left-1/2 top-16 z-40 bg-white text-black text-[11px] font-semibold uppercase tracking-wider px-3.5 py-2 rounded-md shadow-xl flex items-center gap-2 pointer-events-none"
          style={{ transform: 'translateX(-50%)' }}
        >
          <Bookmark className="w-3.5 h-3.5" />
          Retomamos tu lectura · {Math.round(resumePct * 100)}%
        </div>
      )}

      {/* Menú flotante de subrayado */}
      {selPill && (
        <div
          className="fixed z-[60] flex items-center gap-1 bg-white text-black rounded-md shadow-xl px-1 py-1"
          style={{
            left: selPill.x,
            top: selPill.y,
            transform: `translate(-50%, ${selPill.below ? '14px' : 'calc(-100% - 10px)'})`,
          }}
        >
          <button
            onClick={saveSelection}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider hover:bg-neutral-200 rounded cursor-pointer"
          >
            <Highlighter className="w-3.5 h-3.5" />
            SUBRAYAR
          </button>
          <button
            onClick={() => {
              setSelPill(null);
              window.getSelection()?.removeAllRanges();
            }}
            className="p-1.5 hover:bg-neutral-200 rounded cursor-pointer"
            title="Cancelar selección"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Article Container */}
      <article
        ref={articleRef}
        onMouseDown={() => setSelPill(null)}
        onMouseUp={() => scheduleSelection(10)}
        onKeyUp={() => scheduleSelection(10)}
        onTouchEnd={() => scheduleSelection(400)}
        className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-16 w-full"
      >
        {/* Unboxed Metadata */}
        <div className="flex flex-wrap items-center justify-center gap-2.5 text-xs sm:text-sm font-sans tracking-wide text-neutral-400 uppercase mb-4 font-medium">
          <span className="text-white font-semibold">{report.category}</span>
          <span>·</span>
          <span>{report.publishedAt}</span>
          <span>·</span>
          <span>{readTimeOf(report)}</span>
          {report.exclusive && (
            <>
              <span>·</span>
              <span className="text-white font-semibold">EXCLUSIVO BLACKNEWS</span>
            </>
          )}
        </div>

        {/* Big Headline in Lexend */}
        <h1 className="font-headline text-3xl sm:text-4xl md:text-5xl lg:text-[3.6rem] font-normal text-white tracking-tight leading-[1.12] mb-6 text-balance text-center">
          {report.title}
        </h1>

        {/* Subtitle / Deck */}
        <p className="font-sans text-lg sm:text-xl lg:text-2xl text-neutral-300 font-light leading-relaxed mb-8 text-center">
          {report.subtitle}
        </p>

        {/* Byline */}
        <div className="py-4 border-y border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs sm:text-sm mb-10 font-sans">
          <div>
            <div className="font-semibold text-white tracking-wide">
              {report.author.name}
            </div>
            <div className="text-neutral-400 text-xs mt-0.5">
              {report.author.role} · {report.author.bureau}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onShare(report)}
              className="text-xs font-semibold text-neutral-300 hover:text-white transition-colors uppercase tracking-wider cursor-pointer"
            >
              COMPARTIR EN REDES SOCIALES →
            </button>
          </div>
        </div>

        {/* Featured Image with OptimizedPicture & soft corners */}
        <figure className="mb-12">
          <div className="w-full aspect-[16/9] rounded-xl overflow-hidden relative shadow-2xl">
            <OptimizedPicture
              image={report.optimizedImage || report.image}
              alt={report.title}
              priority={true}
              aspectRatio="16/9"
              className="w-full h-full rounded-xl"
            />
          </div>
          <figcaption className="mt-2.5 text-xs sm:text-sm font-sans text-neutral-400 font-normal">
            {report.imageCaption}
          </figcaption>
        </figure>

        {/* Lead with drop cap */}
        <div className="mb-10">
          <p className={`${fontSizeClass} text-neutral-100 font-light editorial-drop-cap font-sans`}>
            <RichText text={report.lead} seen={seenTerms} highlights={highlights} />
          </p>
        </div>

        {/* Key Takeaways: Pure minimal typographic block */}
        {report.keyTakeaways && report.keyTakeaways.length > 0 && (
          <div className="my-12 py-6 border-y border-white/10 font-sans">
            <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold tracking-wider text-white uppercase mb-5">
              <Sparkles className="w-4 h-4 text-neutral-300" />
              CLAVES DEL INFORME ESTRATÉGICO
            </div>
            <ul className="space-y-4">
              {report.keyTakeaways.map((point, idx) => (
                <li key={idx} className="flex items-start gap-3 text-sm sm:text-base text-neutral-300">
                  <span className="font-mono text-xs sm:text-sm font-medium text-neutral-400 mt-0.5 tabular-nums">
                    0{idx + 1}.
                  </span>
                  <span className="font-light">
                    <RichText text={point} seen={seenTerms} highlights={highlights} />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* In-Article Sponsor Banner */}
        <AdBanner
          placement="ARTICLE_SIDEBAR"
          campaigns={adCampaigns}
          selectedCategory={report.category}
          onTrackImpression={onTrackImpression}
          onTrackClick={onTrackClick}
          className="my-10"
        />

        {/* Dynamic Sections */}
        <div className="space-y-8 my-10 text-neutral-300 font-sans">
          {report.sections.map((sec, idx) => {
            if (sec.type === 'heading') {
              return (
                <h2
                  key={idx}
                  className="font-headline text-2xl sm:text-3xl font-normal text-white tracking-tight pt-8 border-t border-white/10"
                >
                  {sec.text}
                </h2>
              );
            }
            if (sec.type === 'quote') {
              return (
                <blockquote
                  key={idx}
                  className="my-10 pl-6 border-l-2 border-white text-white font-normal font-headline text-xl sm:text-2xl italic leading-relaxed"
                >
                  <p>"{sec.text}"</p>
                  {sec.cite && (
                    <footer className="mt-3 text-xs sm:text-sm font-sans text-neutral-400 not-italic uppercase tracking-wide font-medium">
                      — {sec.cite}
                    </footer>
                  )}
                </blockquote>
              );
            }
            if (sec.type === 'stat') {
              return (
                <div
                  key={idx}
                  className="my-10 py-6 border-y border-white/10 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8"
                >
                  <div className="text-4xl sm:text-5xl font-light font-mono tracking-tight text-white shrink-0 tabular-nums">
                    {sec.value}
                  </div>
                  <div className="text-xs sm:text-sm text-neutral-300 leading-relaxed font-sans font-light">
                    {sec.label}
                  </div>
                </div>
              );
            }
            return (
              <p key={idx} className={`${fontSizeClass} font-light text-neutral-200`}>
                <RichText
                  text={sec.text || ''}
                  seen={seenTerms}
                  highlights={highlights}
                />
              </p>
            );
          })}
        </div>

        {/* Tags / Topics */}
        <div className="pt-8 border-t border-white/10 mt-14 font-sans">
          <div className="text-xs uppercase tracking-wider text-neutral-400 mb-3 font-semibold">
            TEMAS Y CORREDORES ANALIZADOS
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {report.tags.map((tag) => (
              <span
                key={tag}
                className="px-3 py-1 text-xs font-sans font-medium text-neutral-300 bg-white/5 rounded-md border border-white/10"
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>

        {/* Subrayados del lector */}
        {highlights.length > 0 && (
          <div className="mt-10 border border-white/10 rounded-lg p-5 font-sans">
            <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-white uppercase mb-4">
              <Highlighter className="w-4 h-4 text-neutral-300" />
              TUS SUBRAYADOS · {highlights.length}
            </div>
            <ul className="space-y-3">
              {highlights.map((h) => (
                <li
                  key={h.id}
                  className="flex items-start justify-between gap-3 text-sm border-b border-white/5 pb-3 last:border-0 last:pb-0"
                >
                  <span className="bn-mark flex-1 font-light">{h.text}</span>
                  <span className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => copyHighlight(h.text, h.id)}
                      className="p-1.5 rounded text-neutral-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                      title="Copiar subrayado"
                    >
                      {copiedHl === h.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      onClick={() => {
                        removeHighlight(h.id);
                        setHighlights(getHighlights(report.id));
                      }}
                      className="p-1.5 rounded text-neutral-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                      title="Eliminar subrayado"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Sponsor Banner at Article Conclusion */}
        <AdBanner
          placement="ARTICLE_FOOTER"
          campaigns={adCampaigns}
          selectedCategory={report.category}
          onTrackImpression={onTrackImpression}
          onTrackClick={onTrackClick}
        />

        {/* Aviso de cuota diaria agotada (la lectura no se bloquea) */}
        {readExhausted && (
          <div className="my-10 p-4 sm:p-5 rounded-xl border border-amber-500/40 bg-amber-950/40 font-sans">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-amber-300 mb-2">
              <Lock className="w-3.5 h-3.5" />
              <span>Lecturas gratuitas agotadas</span>
            </div>
            <p className="text-xs sm:text-sm text-neutral-300 font-light leading-relaxed">
              Has utilizado tus{" "}
              <span className="text-white font-semibold">
                {readLimit} lecturas gratuitas de hoy
              </span>
              . Puedes seguir navegando con normalidad: la cuota se renueva
              cada día. Con una suscripción tus lecturas son ilimitadas.
            </p>
            {onOpenSubscription && (
              <button
                type="button"
                onClick={onOpenSubscription}
                className="mt-3.5 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase tracking-wider rounded-md transition-colors cursor-pointer"
              >
                Ver suscripciones
              </button>
            )}
          </div>
        )}

        {/* Share CTA Footer Ribbon */}
        <div className="my-14 py-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 font-sans">
          <div>
            <h3 className="text-base sm:text-lg font-semibold tracking-tight text-white">
              ¿CONSIDERA VITAL ESTE INFORME?
            </h3>
            <p className="text-xs sm:text-sm font-light text-neutral-400 mt-1">
              Comparta el periodismo independiente de BLACKNEWS con sus redes y contactos.
            </p>
          </div>
          <button
            onClick={() => onShare(report)}
            className="w-full sm:w-auto px-6 py-3 bg-white text-black hover:bg-neutral-200 transition-colors font-semibold text-xs sm:text-sm uppercase tracking-wider rounded-md flex items-center justify-center gap-2 cursor-pointer shrink-0 shadow-sm"
          >
            <Share2 className="w-4 h-4" />
            <span>COMPARTIR INFORME</span>
          </button>
        </div>

        {/* Related Reports */}
        <div className="pt-8 border-t border-white/10 font-sans">
          <h3 className="text-xs uppercase tracking-widest text-neutral-400 font-semibold mb-6">
            INFORMES RELACIONADOS DE LA REDACCIÓN
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {relatedReports.map((rel) => (
              <div
                key={rel.id}
                onClick={() => onSelectReport(rel)}
                className="group cursor-pointer flex flex-col justify-between p-4 rounded-lg border border-white/10 hover:border-white/30 hover:bg-white/[0.02] transition-colors"
              >
                <div>
                  <div className="text-xs text-neutral-400 font-medium mb-2">
                    {rel.category}
                  </div>
                  <h4 className="font-headline text-base sm:text-lg font-normal text-white group-hover:text-neutral-200 transition-colors line-clamp-2 leading-snug">
                    {rel.title}
                  </h4>
                </div>
                <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-neutral-400 font-medium">
                  <span>{rel.readTime}</span>
                  <ChevronRight className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </article>
    </div>
  );
};
