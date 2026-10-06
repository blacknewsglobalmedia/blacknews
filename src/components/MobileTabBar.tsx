import React from "react";
import { Bookmark, Gem, Home, Menu, Search, X } from "lucide-react";

/**
 * Navegación inferior estilo aplicación (solo móvil/tablet, <lg).
 * Espejo del encabezado en el pulgar: Portada · Buscar · Guardados · Menú · Suscribirse.
 * Todos los estados viven en App, así que esta barra solo dispara callbacks.
 */
interface MobileTabBarProps {
  onGoHome: () => void;
  isPortada: boolean;
  isMenuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
  isSearchOpen: boolean;
  onOpenSearch: () => void;
  isBookmarksOpen: boolean;
  onOpenBookmarks: () => void;
  bookmarksCount: number;
  isSubscribeOpen: boolean;
  onOpenSubscribe: () => void;
}

interface TabButtonProps {
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  accent?: boolean;
  badge?: number;
  onClick: () => void;
  children?: never;
}

const TabButton: React.FC<TabButtonProps> = ({
  label,
  icon,
  active = false,
  accent = false,
  badge,
  onClick,
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-current={active ? "page" : undefined}
    className={`relative flex flex-col items-center justify-center gap-1 h-14 px-0.5 transition-colors cursor-pointer ${
      accent
        ? active
          ? "text-emerald-300"
          : "text-emerald-400 hover:text-emerald-300"
        : active
          ? "text-white"
          : "text-neutral-500 hover:text-neutral-300"
    }`}
  >
    {/* Indicador de pestaña activa (estilo app) */}
    <span
      aria-hidden="true"
      className={`absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-7 rounded-full transition-colors ${
        active ? (accent ? "bg-emerald-400" : "bg-white") : "bg-transparent"
      }`}
    />
    <span className="relative">
      {icon}
      {badge !== undefined && badge > 0 && (
        <span className="absolute -top-1.5 -right-2.5 min-w-4 h-4 px-1 rounded-full bg-emerald-500 text-black text-[9px] leading-none font-bold flex items-center justify-center">
          {badge > 9 ? "9+" : badge}
        </span>
      )}
    </span>
    <span className="text-[10px] leading-none font-sans font-medium tracking-wide">
      {label}
    </span>
  </button>
);

export const MobileTabBar: React.FC<MobileTabBarProps> = ({
  onGoHome,
  isPortada,
  isMenuOpen,
  onMenuOpenChange,
  isSearchOpen,
  onOpenSearch,
  isBookmarksOpen,
  onOpenBookmarks,
  bookmarksCount,
  isSubscribeOpen,
  onOpenSubscribe,
}) => {
  const goSearch = () => {
    onMenuOpenChange(false);
    onOpenSearch();
  };
  const goBookmarks = () => {
    onMenuOpenChange(false);
    onOpenBookmarks();
  };
  const goSubscribe = () => {
    onMenuOpenChange(false);
    onOpenSubscribe();
  };
  const toggleMenu = () => onMenuOpenChange(!isMenuOpen);

  // Una sola pestaña activa a la vez (prioridad: capa abierta > vista actual)
  const activeTab = isMenuOpen
    ? "menu"
    : isSearchOpen
      ? "search"
      : isBookmarksOpen
        ? "bookmarks"
        : isSubscribeOpen
          ? "subscribe"
          : isPortada
            ? "portada"
            : "";

  return (
    <nav
      aria-label="Navegación principal"
      className="bn-safe-bottom fixed inset-x-0 bottom-0 z-40 bg-black/95 backdrop-blur-md border-t border-white/10 select-none lg:hidden"
    >
      <div className="grid grid-cols-5 h-14">
        <TabButton
          label="PORTADA"
          icon={<Home className="w-5 h-5" strokeWidth={1.8} />}
          active={activeTab === "portada"}
          onClick={() => {
            onMenuOpenChange(false);
            onGoHome();
          }}
        />
        <TabButton
          label="BUSCAR"
          icon={<Search className="w-5 h-5" strokeWidth={1.8} />}
          active={activeTab === "search"}
          onClick={goSearch}
        />
        <TabButton
          label="GUARDADOS"
          icon={<Bookmark className="w-5 h-5" strokeWidth={1.8} />}
          active={activeTab === "bookmarks"}
          badge={bookmarksCount}
          onClick={goBookmarks}
        />
        <TabButton
          label={isMenuOpen ? "CERRAR" : "MENÚ"}
          icon={
            isMenuOpen ? (
              <X className="w-5 h-5" strokeWidth={1.8} />
            ) : (
              <Menu className="w-5 h-5" strokeWidth={1.8} />
            )
          }
          active={activeTab === "menu"}
          onClick={toggleMenu}
        />
        <TabButton
          label="SUSCRIBIRSE"
          icon={<Gem className="w-5 h-5" strokeWidth={1.8} />}
          accent
          active={activeTab === "subscribe"}
          onClick={goSubscribe}
        />
      </div>
    </nav>
  );
};
