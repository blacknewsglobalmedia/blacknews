import React from 'react';
import { Search, Bookmark, Share2, Radio, PenTool, User, ShieldCheck } from 'lucide-react';
import { CategoryId } from '../types/news';
import { RedactorProfile } from '../types/auth';

interface TopBarProps {
  selectedCategory: CategoryId;
  onSelectCategory: (category: CategoryId) => void;
  onOpenSearch: () => void;
  onOpenBookmarks: () => void;
  bookmarksCount: number;
  onShareSite: () => void;
  liveTickerActive: boolean;
  onToggleLiveTicker: () => void;
  onOpenStudio: () => void;
  isStudioOpen: boolean;
  currentUser?: RedactorProfile;
  onOpenGoogleAuth?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  selectedCategory,
  onSelectCategory,
  onOpenSearch,
  onOpenBookmarks,
  bookmarksCount,
  onShareSite,
  liveTickerActive,
  onToggleLiveTicker,
  onOpenStudio,
  isStudioOpen,
  currentUser,
  onOpenGoogleAuth,
}) => {
  const categories: { id: CategoryId; label: string }[] = [
    { id: 'TODAS', label: 'PORTADA' },
    { id: 'ECONOMÍA & MERCADOS', label: 'ECONOMÍA' },
    { id: 'GEOPOLÍTICA', label: 'GEOPOLÍTICA' },
    { id: 'TECNOLOGÍA & INNOVACIÓN', label: 'TECNOLOGÍA' },
    { id: 'DERECHO & PROPIEDAD', label: 'PROPIEDAD' },
    { id: 'ENERGÍA & INDUSTRIA', label: 'ENERGÍA' },
    { id: 'DOSSIERS', label: 'DOSSIERS' },
  ];

  const googleIconSvg = (
    <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.15C3.29 21.43 7.35 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.26C.46 8.16 0 9.97 0 12s.46 3.84 1.26 5.42l4.02-3.15z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.29 2.57 1.26 6.58l4.02 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
      />
    </svg>
  );

  return (
    <header className="w-full bg-black border-b border-white/5 sticky top-0 z-40">
      {/* Top utility sub-strip: minimal hairline */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-8 flex items-center justify-between text-xs font-normal tracking-wider text-neutral-400 border-b border-white/5 uppercase">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-2 text-white font-medium">
            <span className="w-1.5 h-1.5 bg-white animate-pulse"></span>
            EN DIRECTO
          </span>
          <span className="text-neutral-700">/</span>
          <span className="hidden sm:inline text-neutral-400">INFORMES & ANÁLISIS INDEPENDIENTES</span>
          <span className="text-neutral-700 hidden sm:inline">/</span>
          <span className="text-neutral-500">SUPER AMOLED</span>
        </div>
        <div className="flex items-center gap-4 text-neutral-400 text-xs font-mono">
          <button
            onClick={onToggleLiveTicker}
            className={`hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer ${
              liveTickerActive ? 'text-white' : 'text-neutral-600'
            }`}
            title="Alternar teletipo de última hora"
          >
            <Radio className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">TELETIPO</span>
          </button>
          <span>24 SEP 2026</span>
        </div>
      </div>

      {/* Main Header Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand wordmark */}
        <div className="flex items-center">
          <button
            onClick={() => onSelectCategory('TODAS')}
            className="text-2xl sm:text-3xl font-medium tracking-tight text-white hover:text-neutral-300 transition-colors flex items-baseline cursor-pointer"
          >
            BLACKNEWS
            <span className="w-1.5 h-1.5 bg-white ml-1 inline-block"></span>
          </button>
        </div>

        {/* Text navigation links without boxes */}
        <nav className="hidden lg:flex items-center gap-6 xl:gap-8 text-xs sm:text-sm font-medium tracking-wide">
          {categories.map((cat) => {
            const isActive = selectedCategory === cat.id && !isStudioOpen;
            return (
              <button
                key={cat.id}
                onClick={() => onSelectCategory(cat.id)}
                className={`transition-colors py-1 cursor-pointer relative whitespace-nowrap ${
                  isActive
                    ? 'text-white font-semibold'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                {cat.label}
                {isActive && (
                  <span className="absolute bottom-0 left-0 w-full h-[1.5px] bg-white"></span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Action icons & buttons: minimal, borderless */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Google Account Profile Trigger */}
          {onOpenGoogleAuth && (
            <button
              onClick={onOpenGoogleAuth}
              className="flex items-center gap-2 py-1 px-2 border border-white/10 hover:border-white text-neutral-300 hover:text-white text-xs font-mono transition-colors cursor-pointer"
              title="Autenticación con Google y Permisos"
            >
              {googleIconSvg}
              {currentUser ? (
                <div className="flex items-center gap-1.5">
                  <span className="hidden md:inline max-w-[120px] truncate">{currentUser.name}</span>
                  <span className={`text-[10px] px-1 py-0.2 border ${
                    currentUser.role === 'ADMIN'
                      ? 'border-white text-white font-semibold'
                      : currentUser.role === 'MODERADOR'
                      ? 'border-neutral-400 text-neutral-200'
                      : currentUser.role === 'REDACTOR'
                      ? 'border-neutral-600 text-neutral-300'
                      : 'border-amber-500 text-amber-300'
                  }`}>
                    {currentUser.role}
                  </span>
                </div>
              ) : (
                <span className="hidden sm:inline">ACCESO GOOGLE</span>
              )}
            </button>
          )}

          {/* Constructor de Artículos & Redacción Button */}
          <button
            onClick={onOpenStudio}
            className={`px-3 py-1.5 text-xs font-medium uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer border ${
              isStudioOpen
                ? 'bg-white text-black border-white font-semibold'
                : 'border-white/15 text-neutral-300 hover:text-white hover:border-white'
            }`}
            title="Constructor de Artículos & Sala de Redacción"
          >
            <PenTool className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">REDACCIÓN</span>
          </button>

          <button
            onClick={onOpenSearch}
            className="p-1.5 text-neutral-400 hover:text-white transition-colors cursor-pointer"
            aria-label="Buscar informes"
            title="Buscar informes y titulares"
          >
            <Search className="w-4 h-4" />
          </button>

          <button
            onClick={onOpenBookmarks}
            className="p-1.5 text-neutral-400 hover:text-white transition-colors relative cursor-pointer"
            aria-label="Informes guardados"
            title="Informes guardados"
          >
            <Bookmark className="w-4 h-4" />
            {bookmarksCount > 0 && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-white text-black font-mono text-[10px] font-semibold flex items-center justify-center">
                {bookmarksCount}
              </span>
            )}
          </button>

          <button
            onClick={onShareSite}
            className="p-1.5 text-neutral-400 hover:text-white transition-colors cursor-pointer"
            aria-label="Compartir BLACKNEWS"
            title="Compartir BLACKNEWS"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
