import React, { useState } from 'react';
import { X, Copy, Check, Share2, MessageSquare, Send, Globe, Sparkles } from 'lucide-react';
import { Report } from '../types/news';

interface ShareModalProps {
  report: Report | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  report,
  isOpen,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const [quoteCardCopied, setQuoteCardCopied] = useState(false);

  if (!isOpen) return null;

  const baseUrl = window.location.origin + window.location.pathname;
  const shareUrl = report
    ? `${baseUrl}?informe=${encodeURIComponent(report.id)}`
    : baseUrl;

  const titleText = report
    ? `${report.title} — BLACKNEWS`
    : 'BLACKNEWS — Periodismo Independiente de Mercados y Libertad';

  const summaryText = report
    ? `"${report.subtitle}"\n\nLee el informe completo en BLACKNEWS:`
    : 'Medio digital de análisis económico, geopolítica y tecnología en Super AMOLED black:';

  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedTitle = encodeURIComponent(titleText);
  const encodedFullMessage = encodeURIComponent(`${titleText}\n\n${summaryText}\n${shareUrl}`);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    } catch {}
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: titleText,
          text: report ? report.subtitle : 'BLACKNEWS Digital Media',
          url: shareUrl,
        });
        onClose();
      } catch {}
    }
  };

  const handleCopyQuoteCard = async () => {
    if (!report) return;
    const cardText = `BLACKNEWS · ${report.category}\n«${report.title}»\n\n${report.lead}\n\n— ${report.author.name} (${report.author.bureau})\n\n${shareUrl}`;
    try {
      await navigator.clipboard.writeText(cardText);
      setQuoteCardCopied(true);
      setTimeout(() => setQuoteCardCopied(false), 2400);
    } catch {}
  };

  const shareNetworks = [
    {
      name: 'X (Twitter)',
      icon: (
        <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      ),
      url: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}&hashtags=BLACKNEWS,Economia,Libertad`,
    },
    {
      name: 'WhatsApp',
      icon: <MessageSquare className="w-4 h-4" />,
      url: `https://api.whatsapp.com/send?text=${encodedFullMessage}`,
    },
    {
      name: 'Telegram',
      icon: <Send className="w-4 h-4" />,
      url: `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`,
    },
    {
      name: 'LinkedIn',
      icon: (
        <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
          <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
        </svg>
      ),
      url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    },
    {
      name: 'Threads',
      icon: <span className="font-semibold text-xs tracking-tighter">@</span>,
      url: `https://threads.net/intent/post?text=${encodedFullMessage}`,
    },
    {
      name: 'Facebook',
      icon: (
        <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
          <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c5.05-.5 9-4.76 9-9.95z" />
        </svg>
      ),
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-black border border-white/10 p-6 sm:p-8 shadow-2xl relative">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/5 mb-6">
          <div className="flex items-center gap-2">
            <Share2 className="w-4 h-4 text-white" />
            <h2 className="text-xs sm:text-sm font-medium uppercase tracking-wider text-white">
              COMPARTIR EN REDES SOCIALES
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white transition-colors cursor-pointer"
            aria-label="Cerrar ventana"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Report Preview Header */}
        {report ? (
          <div className="mb-6 pb-4 border-b border-white/5">
            <div className="text-xs font-mono tracking-wider text-neutral-400 uppercase mb-1.5">
              {report.category} · {report.readTime}
            </div>
            <h3 className="text-sm sm:text-base font-medium text-white line-clamp-2 leading-snug">
              {report.title}
            </h3>
            <p className="text-xs sm:text-sm text-neutral-400 mt-1 line-clamp-2">
              {report.subtitle}
            </p>
          </div>
        ) : (
          <div className="mb-6 pb-4 border-b border-white/5">
            <h3 className="text-sm sm:text-base font-medium text-white leading-snug">
              BLACKNEWS — Periodismo Independiente
            </h3>
            <p className="text-xs sm:text-sm text-neutral-400 mt-1">
              Análisis económico, derecho de propiedad y tecnología en Super AMOLED Black.
            </p>
          </div>
        )}

        {/* Social Networks Grid without bulky boxes */}
        <div className="grid grid-cols-3 gap-2 mb-6">
          {shareNetworks.map((net) => (
            <a
              key={net.name}
              href={net.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2.5 hover:bg-white hover:text-black transition-colors text-xs font-medium text-neutral-300 border border-white/5"
            >
              {net.icon}
              <span className="truncate">{net.name}</span>
            </a>
          ))}
        </div>

        {/* Direct Link Copy Input */}
        <div className="mb-6">
          <label className="block text-xs font-mono uppercase tracking-wider text-neutral-400 mb-2">
            ENLACE DIRECTO
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="w-full bg-black border border-white/10 px-3 py-2 text-xs font-mono text-neutral-300 select-all focus:outline-none focus:border-white"
            />
            <button
              onClick={handleCopyLink}
              className={`px-4 py-2 text-xs font-medium tracking-wider uppercase transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer ${
                copied
                  ? 'bg-white text-black'
                  : 'bg-white text-black hover:bg-neutral-200'
              }`}
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'COPIADO' : 'COPIAR'}</span>
            </button>
          </div>
        </div>

        {/* Native Web Share */}
        {typeof navigator !== 'undefined' && 'share' in navigator && (
          <button
            onClick={handleNativeShare}
            className="w-full mb-6 py-2.5 px-4 border border-white/20 text-white hover:bg-white hover:text-black font-medium text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Globe className="w-4 h-4" />
            <span>COMPARTIR VÍA SISTEMA</span>
          </button>
        )}

        {/* Quote Card */}
        {report && (
          <div className="pt-4 border-t border-white/5 flex items-center justify-between text-xs font-mono">
            <span className="text-neutral-500 uppercase flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-white" />
              FICHA DE TEXTO
            </span>
            <button
              onClick={handleCopyQuoteCard}
              className="text-white hover:text-neutral-300 transition-colors cursor-pointer"
            >
              {quoteCardCopied ? '¡COPIADO!' : 'COPIAR CITA PARA REDES'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
