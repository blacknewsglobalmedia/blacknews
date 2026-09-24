import React, { useState } from 'react';
import { 
  Search, 
  Bookmark, 
  Share2, 
  Radio, 
  PenTool, 
  Menu, 
  X, 
  User, 
  ChevronRight 
} from 'lucide-react';
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const categories: { id: CategoryId; label: string }[] = [
    { id: 'TODAS', label: 'PORTADA' },
    { id: 'ECONOMÍA & MERCADOS', label: 'ECONOMÍA' },
    { id: 'GEOPOLÍTICA', label: 'GEOPOLÍTICA' },
    { id: 'TECNOLOGÍA & INNOVACIÓN', label: 'TECNOLOGÍA' },
    { id: 'DERECHO & PROPIEDAD', label: 'PROPIEDAD' },
    { id: 'ENERGÍA & INDUSTRIA', label: 'ENERGÍA' },
    { id: 'DOSSIERS', label: 'DOSSIERS' },
  ];

  const handleCategoryClick = (catId: CategoryId) => {
    onSelectCategory(catId);
    setIsMobileMenuOpen(false);
  };

  // Basic readers (LECTOR) and visitors must NOT see the redacción button or internal tools
  const canAccessEditorialStudio = Boolean(currentUser && currentUser.role !== 'LECTOR');

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
    <header className="w-full bg-black border-b border-white/10 sticky top-0 z-40 select-none">
      {/* Top micro-strip: clean & uncrowded */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-7 flex items-center justify-between text-[11px] font-mono tracking-wider text-neutral-400 border-b border-white/5 uppercase">
        <div className="flex items-center gap-2.5">
          <span className="flex items-center gap-1.5 text-white font-medium">
            <span className="w-1.5 h-1.5 bg-white animate-pulse"></span>
            EN DIRECTO
          </span>
          <span className="text-neutral-800">/</span>
          <span className="text-neutral-500">24 SEP 2026</span>
        </div>

        <div className="flex items-center gap-3 text-neutral-400">
          <button
            onClick={onToggleLiveTicker}
            className={`hover:text-white transition-colors flex items-center gap-1 cursor-pointer ${
              liveTickerActive ? 'text-white font-medium' : 'text-neutral-600'
            }`}
            title="Alternar teletipo"
          >
            <Radio className="w-3 h-3" />
            <span className="hidden sm:inline">TELETIPO</span>
          </button>
          <span className="text-neutral-800">/</span>
          <button
            onClick={onShareSite}
            className="hover:text-white transition-colors cursor-pointer hidden sm:inline"
            title="Compartir medio"
          >
            COMPARTIR
          </button>
        </div>
      </div>

      {/* Main Bar: resilient single row with zero horizontal collapse */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3">
        {/* Left: Brand */}
        <div className="flex items-center shrink-0">
          <button
            onClick={() => handleCategoryClick('TODAS')}
            className="text-xl sm:text-2xl font-medium tracking-tight text-white hover:text-neutral-300 transition-colors flex items-baseline cursor-pointer"
          >
            BLACKNEWS
            <span className="w-1.5 h-1.5 bg-white ml-1 inline-block"></span>
          </button>
        </div>

        {/* Center: Desktop Navigation Links (Only on larger screens) */}
        <nav className="hidden xl:flex items-center gap-5 2xl:gap-7 text-xs font-medium tracking-wide">
          {categories.map((cat) => {
            const isActive = selectedCategory === cat.id && !isStudioOpen;
            return (
              <button
                key={cat.id}
                onClick={() => handleCategoryClick(cat.id)}
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

        {/* Right: Streamlined Action Cluster */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Studio Toggle (Compact) - Strictly hidden from basic LECTOR and unauthenticated users */}
          {canAccessEditorialStudio && (
            <button
              onClick={onOpenStudio}
              className={`px-2.5 py-1.5 text-xs font-medium uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer border ${
                isStudioOpen
                  ? 'bg-white text-black border-white font-semibold'
                  : 'border-white/15 text-neutral-300 hover:text-white hover:border-white'
              }`}
              title="Sala de Redacción y Constructor"
            >
              <PenTool className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">REDACCIÓN</span>
            </button>
          )}

          {/* User Account / Google Chip (Compact) */}
          {onOpenGoogleAuth && (
            <button
              onClick={onOpenGoogleAuth}
              className="flex items-center gap-1.5 py-1 px-2 border border-white/15 hover:border-white text-neutral-300 hover:text-white text-xs font-mono transition-colors cursor-pointer"
              title={currentUser ? `Cuenta: ${currentUser.name} (${currentUser.role})` : 'Acceso de usuarios'}
            >
              {googleIconSvg}
              {currentUser ? (
                <span className="text-[10px] font-semibold text-neutral-300">
                  [{currentUser.role}]
                </span>
              ) : (
                <span className="text-[10px]">ACCESO</span>
              )}
            </button>
          )}

          {/* Search Button */}
          <button
            onClick={onOpenSearch}
            className="p-1.5 text-neutral-400 hover:text-white transition-colors cursor-pointer"
            aria-label="Buscar"
            title="Buscar informes"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Bookmarks Button */}
          <button
            onClick={onOpenBookmarks}
            className="p-1.5 text-neutral-400 hover:text-white transition-colors relative cursor-pointer"
            aria-label="Guardados"
            title="Lecturas guardadas"
          >
            <Bookmark className="w-4 h-4" />
            {bookmarksCount > 0 && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-white text-black font-mono text-[10px] font-bold flex items-center justify-center">
                {bookmarksCount}
              </span>
            )}
          </button>

          {/* Mobile Menu Hamburger Toggle (Visible on screens below xl) */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="xl:hidden p-1.5 text-neutral-300 hover:text-white transition-colors cursor-pointer ml-1"
            aria-label="Menú"
            title="Menú de secciones"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Slide-out / Dropdown Mobile & Tablet Menu */}
      {isMobileMenuOpen && (
        <div className="xl:hidden bg-black border-t border-white/10 px-4 sm:px-6 py-6 space-y-6 animate-in slide-in-from-top duration-150">
          {/* Category Links List */}
          <div>
            <div className="text-[11px] font-mono text-neutral-500 uppercase tracking-widest mb-3">
              SECCIONES EDITORIALES
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {categories.map((cat) => {
                const isActive = selectedCategory === cat.id && !isStudioOpen;
                return (
                  <button
                    key={cat.id}
                    onClick={() => handleCategoryClick(cat.id)}
                    className={`py-2 px-3 text-left text-xs font-medium uppercase tracking-wider transition-colors flex items-center justify-between cursor-pointer border ${
                      isActive
                        ? 'border-white bg-white text-black font-semibold'
                        : 'border-white/5 text-neutral-300 hover:border-white/30 hover:text-white'
                    }`}
                  >
                    <span>{cat.label}</span>
                    <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* User Status & Direct Action Buttons */}
          <div className="pt-4 border-t border-white/10 space-y-3">
            <div className="flex items-center justify-between text-xs font-mono text-neutral-400">
              <span>USUARIO ACTIVO:</span>
              <span className="text-white font-medium">
                {currentUser ? `${currentUser.name} [${currentUser.role}]` : 'NO CONECTADO'}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              {canAccessEditorialStudio && (
                <button
                  onClick={() => {
                    onOpenStudio();
                    setIsMobileMenuOpen(false);
                  }}
                  className="flex-1 py-2.5 px-3 border border-white/20 hover:border-white text-xs font-medium uppercase tracking-wider text-white flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <PenTool className="w-3.5 h-3.5" />
                  <span>SALA DE REDACCIÓN</span>
                </button>
              )}

              {onOpenGoogleAuth && (
                <button
                  onClick={() => {
                    onOpenGoogleAuth();
                    setIsMobileMenuOpen(false);
                  }}
                  className="flex-1 py-2.5 px-3 bg-white text-black text-xs font-medium uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer hover:bg-neutral-200 transition-colors"
                >
                  {googleIconSvg}
                  <span>{currentUser ? 'MI CUENTA & PERMISOS' : 'ACCESO CON GOOGLE'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
