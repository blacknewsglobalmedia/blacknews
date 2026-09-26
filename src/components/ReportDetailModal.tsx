import React, { useState, useEffect } from 'react';
import { 
  X, 
  Share2, 
  Bookmark, 
  Volume2, 
  VolumeX, 
  ArrowLeft, 
  ChevronRight,
  Sparkles,
  Check
} from 'lucide-react';
import { Report } from '../types/news';
import { OptimizedPicture } from './OptimizedPicture';

interface ReportDetailModalProps {
  report: Report | null;
  isOpen: boolean;
  onClose: () => void;
  onShare: (report: Report) => void;
  isBookmarked: boolean;
  onToggleBookmark: (report: Report) => void;
  onSelectReport: (report: Report) => void;
  allReports: Report[];
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
}) => {
  const [fontSizeScale, setFontSizeScale] = useState<'normal' | 'large' | 'huge'>('normal');
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setIsPlayingAudio(false);
    }
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

  const relatedReports = allReports
    .filter((r) => r.id !== report.id)
    .slice(0, 3);

  const fontSizeClass = {
    normal: 'text-base sm:text-[1.08rem] leading-[1.8]',
    large: 'text-lg sm:text-[1.22rem] leading-[1.85]',
    huge: 'text-xl sm:text-[1.38rem] leading-[1.9]',
  }[fontSizeScale];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black flex flex-col justify-start font-['Lexend',sans-serif]">
      {/* Top Reader Bar: Minimalist & Refined */}
      <div className="sticky top-0 z-30 w-full bg-black/95 backdrop-blur-md border-b border-white/10 px-4 sm:px-6 py-2.5 flex items-center justify-between">
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

      {/* Main Article Container */}
      <article className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-16 w-full">
        {/* Unboxed Metadata */}
        <div className="flex flex-wrap items-center gap-2.5 text-xs sm:text-sm font-sans tracking-wide text-neutral-400 uppercase mb-4 font-medium">
          <span className="text-white font-semibold">{report.category}</span>
          <span>·</span>
          <span>{report.publishedAt}</span>
          <span>·</span>
          <span>{report.readTime}</span>
          {report.exclusive && (
            <>
              <span>·</span>
              <span className="text-white font-semibold">EXCLUSIVO BLACKNEWS</span>
            </>
          )}
        </div>

        {/* Big Headline in Lexend */}
        <h1 className="font-headline text-3xl sm:text-4xl md:text-5xl lg:text-[3.6rem] font-normal text-white tracking-tight leading-[1.12] mb-6 text-balance">
          {report.title}
        </h1>

        {/* Subtitle / Deck */}
        <p className="font-sans text-lg sm:text-xl lg:text-2xl text-neutral-300 font-light leading-relaxed mb-8">
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
            {report.lead}
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
                  <span className="font-light">{point}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

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
                {sec.text}
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
