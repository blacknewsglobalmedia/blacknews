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
    normal: 'text-base sm:text-lg leading-relaxed',
    large: 'text-lg sm:text-xl leading-relaxed',
    huge: 'text-xl sm:text-2xl leading-loose',
  }[fontSizeScale];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black flex flex-col justify-start">
      {/* Top Reader Bar: Minimalist */}
      <div className="sticky top-0 z-30 w-full bg-black/95 backdrop-blur-md border-b border-white/5 px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex items-center gap-2 text-xs sm:text-sm font-medium uppercase tracking-wider text-neutral-400 hover:text-white transition-colors cursor-pointer py-1"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">VOLVER A LA PORTADA</span>
          </button>
          <span className="text-neutral-700 hidden sm:inline">|</span>
          <span className="text-xs font-mono uppercase tracking-wider text-neutral-400 hidden md:inline truncate max-w-xs">
            {report.category}
          </span>
        </div>

        {/* Reader Controls */}
        <div className="flex items-center gap-3">
          {/* Audio read-aloud */}
          <button
            onClick={toggleSpeech}
            className={`px-3 py-1.5 text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer ${
              isPlayingAudio
                ? 'bg-white text-black font-semibold'
                : 'text-neutral-400 hover:text-white'
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
          <div className="hidden sm:flex items-center text-xs font-mono gap-1">
            <button
              onClick={() => setFontSizeScale('normal')}
              className={`px-2 py-1 transition-colors ${
                fontSizeScale === 'normal' ? 'text-white font-semibold underline' : 'text-neutral-500 hover:text-white'
              }`}
              title="Texto normal"
            >
              A
            </button>
            <button
              onClick={() => setFontSizeScale('large')}
              className={`px-2 py-1 transition-colors ${
                fontSizeScale === 'large' ? 'text-white font-semibold underline' : 'text-neutral-500 hover:text-white'
              }`}
              title="Texto grande"
            >
              A+
            </button>
            <button
              onClick={() => setFontSizeScale('huge')}
              className={`px-2 py-1 transition-colors ${
                fontSizeScale === 'huge' ? 'text-white font-semibold underline' : 'text-neutral-500 hover:text-white'
              }`}
              title="Texto extra grande"
            >
              A++
            </button>
          </div>

          {/* Quick Copy Link */}
          <button
            onClick={handleQuickCopyLink}
            className="p-1.5 text-neutral-400 hover:text-white transition-colors cursor-pointer"
            title="Copiar enlace directo"
          >
            {copiedLink ? <Check className="w-4 h-4 text-white" /> : <Share2 className="w-4 h-4" />}
          </button>

          {/* Bookmark */}
          <button
            onClick={() => onToggleBookmark(report)}
            className={`p-1.5 transition-colors cursor-pointer ${
              isBookmarked
                ? 'text-white'
                : 'text-neutral-400 hover:text-white'
            }`}
            title={isBookmarked ? 'Guardado en lecturas' : 'Guardar en lecturas'}
          >
            <Bookmark className="w-4 h-4" />
          </button>

          {/* Share button */}
          <button
            onClick={() => onShare(report)}
            className="px-3.5 py-1.5 text-xs sm:text-sm font-medium bg-white text-black hover:bg-neutral-200 transition-colors uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>COMPARTIR</span>
          </button>

          {/* Close */}
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white transition-colors ml-1 cursor-pointer"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Article Container */}
      <article className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-16 w-full">
        {/* Unboxed Metadata */}
        <div className="flex flex-wrap items-center gap-2.5 text-xs sm:text-sm font-mono tracking-wider text-neutral-400 uppercase mb-4">
          <span className="text-white font-medium">{report.category}</span>
          <span>·</span>
          <span>{report.publishedAt}</span>
          <span>·</span>
          <span>{report.readTime}</span>
          {report.exclusive && (
            <>
              <span>·</span>
              <span className="text-white">EXCLUSIVO BLACKNEWS</span>
            </>
          )}
        </div>

        {/* Big Headline in font-medium */}
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-medium text-white tracking-tight leading-[1.15] mb-6 text-balance">
          {report.title}
        </h1>

        {/* Subtitle / Deck */}
        <p className="text-lg sm:text-xl text-neutral-300 font-normal leading-relaxed mb-8">
          {report.subtitle}
        </p>

        {/* Byline */}
        <div className="py-4 border-y border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs sm:text-sm mb-10">
          <div>
            <div className="font-medium text-white uppercase tracking-wide">
              {report.author.name}
            </div>
            <div className="text-neutral-400 font-mono text-xs">
              {report.author.role} · {report.author.bureau}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onShare(report)}
              className="text-xs font-medium text-neutral-400 hover:text-white transition-colors uppercase tracking-wider cursor-pointer"
            >
              COMPARTIR EN REDES SOCIALES →
            </button>
          </div>
        </div>

        {/* Featured Image in FULL COLOR without heavy border */}
        <figure className="mb-12">
          <div className="w-full aspect-[16/9] bg-neutral-950 overflow-hidden relative">
            <img
              src={report.image}
              alt={report.title}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
          <figcaption className="mt-2.5 text-xs sm:text-sm font-mono text-neutral-400">
            {report.imageCaption}
          </figcaption>
        </figure>

        {/* Lead with drop cap */}
        <div className="mb-10">
          <p className={`${fontSizeClass} text-neutral-100 font-normal editorial-drop-cap`}>
            {report.lead}
          </p>
        </div>

        {/* Key Takeaways: Pure minimal typographic block without grey card */}
        {report.keyTakeaways && report.keyTakeaways.length > 0 && (
          <div className="my-12 py-6 border-y border-white/5">
            <div className="flex items-center gap-2 text-xs sm:text-sm font-mono tracking-wider text-white uppercase mb-5 font-medium">
              <Sparkles className="w-4 h-4" />
              CLAVES DEL INFORME ESTRATÉGICO
            </div>
            <ul className="space-y-4">
              {report.keyTakeaways.map((point, idx) => (
                <li key={idx} className="flex items-start gap-3 text-sm sm:text-base text-neutral-300">
                  <span className="font-mono text-xs sm:text-sm font-semibold text-white mt-0.5">
                    0{idx + 1}.
                  </span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Dynamic Sections */}
        <div className="space-y-8 my-10 text-neutral-300">
          {report.sections.map((sec, idx) => {
            if (sec.type === 'heading') {
              return (
                <h2
                  key={idx}
                  className="text-xl sm:text-2xl font-medium text-white tracking-tight pt-6 border-t border-white/5"
                >
                  {sec.text}
                </h2>
              );
            }
            if (sec.type === 'quote') {
              return (
                <blockquote
                  key={idx}
                  className="my-10 pl-6 border-l-2 border-white text-white font-normal text-lg sm:text-xl italic leading-relaxed"
                >
                  <p>"{sec.text}"</p>
                  {sec.cite && (
                    <footer className="mt-3 text-xs sm:text-sm font-mono text-neutral-400 not-italic uppercase tracking-wide">
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
                  className="my-10 py-6 border-y border-white/5 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8"
                >
                  <div className="text-4xl sm:text-5xl font-medium font-mono tracking-tight text-white shrink-0">
                    {sec.value}
                  </div>
                  <div className="text-xs sm:text-sm text-neutral-300 leading-relaxed font-sans">
                    {sec.label}
                  </div>
                </div>
              );
            }
            return (
              <p key={idx} className={fontSizeClass}>
                {sec.text}
              </p>
            );
          })}
        </div>

        {/* Tags / Topics */}
        <div className="pt-8 border-t border-white/5 mt-14">
          <div className="text-xs font-mono uppercase tracking-wider text-neutral-400 mb-3">
            TEMAS Y CORREDORES ANALIZADOS
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {report.tags.map((tag) => (
              <span
                key={tag}
                className="px-3 py-1 text-xs font-mono text-neutral-400"
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>

        {/* Share CTA Footer Ribbon */}
        <div className="my-14 py-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-base sm:text-lg font-medium uppercase tracking-tight text-white">
              ¿CONSIDERA VITAL ESTE INFORME?
            </h3>
            <p className="text-xs sm:text-sm font-normal text-neutral-400 mt-1">
              Comparta el periodismo independiente de BLACKNEWS con sus redes y contactos.
            </p>
          </div>
          <button
            onClick={() => onShare(report)}
            className="w-full sm:w-auto px-6 py-3 bg-white text-black hover:bg-neutral-200 transition-colors font-medium text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shrink-0"
          >
            <Share2 className="w-4 h-4" />
            <span>COMPARTIR INFORME</span>
          </button>
        </div>

        {/* Related Reports */}
        <div className="pt-8 border-t border-white/5">
          <h3 className="text-xs font-mono uppercase tracking-wider text-neutral-400 mb-6">
            INFORMES RELACIONADOS DE LA REDACCIÓN
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {relatedReports.map((rel) => (
              <div
                key={rel.id}
                onClick={() => onSelectReport(rel)}
                className="group cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="text-xs font-mono text-neutral-400 uppercase tracking-wider mb-2">
                    {rel.category}
                  </div>
                  <h4 className="text-sm sm:text-base font-medium text-white group-hover:text-neutral-300 transition-colors line-clamp-2 leading-snug">
                    {rel.title}
                  </h4>
                </div>
                <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-neutral-400">
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
