import React, { useEffect, useRef, useState } from "react";
import {
  Search,
  Bookmark,
  Share2,
  Radio,
  ImageOff,
  PenTool,
  Menu,
  X,
  User,
  ChevronRight,
  LayoutDashboard,
  Smartphone,
  CalendarDays,
  SlidersHorizontal,
  Users,
  Tag,
  Scale,
  History,
  BookmarkCheck,
  Megaphone,
  UserCheck,
  FileText,
  Image as ImageIcon,
} from "lucide-react";
import { CATEGORIES, isFenomenos } from "../data/newsData";
import { dateIn, REFERENCE_TZ } from "../utils/clock";
import { CategoryId } from "../types/news";
import { RedactorProfile, GUEST_USER_ID, RedactorRole } from "../types/auth";
import {
  StudioTab,
  ROLE_SCOPE,
  ROLE_CHIP_CLASS,
  canOpenStudioTab,
} from "../types/studio";
import { AssembleToggle } from "./AssembleToggle";

/** Atajo del menú móvil hacia una sección concreta del panel. */
interface PanelShortcut {
  tab: StudioTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

/**
 * Accesos directos del panel según el rol: el menú móvil no muestra el mismo
 * contenido a un admin, a un moderador, a un redactor ni a un lector.
 * `canOpenStudioTab` vuelve a filtrar por si la tabla de permisos cambia.
 */
const PANEL_SHORTCUTS: Record<RedactorRole, PanelShortcut[]> = {
  ADMIN: [
    { tab: "overview", label: "Panel general", icon: LayoutDashboard },
    { tab: "builder", label: "Redactar", icon: PenTool },
    { tab: "layout", label: "Portada", icon: SlidersHorizontal },
    { tab: "calendar", label: "Calendario", icon: CalendarDays },
    { tab: "users", label: "Equipo", icon: Users },
    { tab: "categories", label: "Categorías", icon: Tag },
    { tab: "policies", label: "Políticas", icon: Scale },
    { tab: "post-generator", label: "Creador Post", icon: Smartphone },
  ],
  MODERADOR: [
    { tab: "overview", label: "Panel general", icon: LayoutDashboard },
    { tab: "builder", label: "Redactar", icon: PenTool },
    { tab: "layout", label: "Portada", icon: SlidersHorizontal },
    { tab: "calendar", label: "Calendario", icon: CalendarDays },
    { tab: "users", label: "Equipo", icon: Users },
    { tab: "post-generator", label: "Creador Post", icon: Smartphone },
  ],
  REDACTOR: [
    { tab: "overview", label: "Panel general", icon: LayoutDashboard },
    { tab: "builder", label: "Redactar", icon: PenTool },
    { tab: "post-generator", label: "Creador Post", icon: Smartphone },
    { tab: "my-articles", label: "Despachos", icon: FileText },
    { tab: "images", label: "Optimizador", icon: ImageIcon },
    { tab: "calendar", label: "Calendario", icon: CalendarDays },
  ],
  LECTOR: [
    { tab: "history", label: "Historial", icon: History },
    { tab: "saved", label: "Guardados", icon: BookmarkCheck },
    { tab: "profile", label: "Mi perfil", icon: User },
    { tab: "ads", label: "Mi publicidad", icon: Megaphone },
    { tab: "register", label: "Acreditación", icon: UserCheck },
  ],
};

interface TopBarProps {
  categories?: string[];
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
  liteMode: boolean;
  onToggleLite: () => void;
  /** Menú móvil controlado desde App (lo abre también la barra inferior de tabs) */
  isMobileMenuOpen?: boolean;
  onMobileMenuOpenChange?: (open: boolean) => void;
  /** Abre el panel directamente en la sección que corresponde al rol */
  onOpenStudioTab?: (tab: StudioTab) => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  categories: propCategories,
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
  liteMode,
  onToggleLite,
  isMobileMenuOpen: isMobileMenuOpenProp,
  onMobileMenuOpenChange,
  onOpenStudioTab,
}) => {
  const [internalMobileMenuOpen, setInternalMobileMenuOpen] = useState(false);
  const isMobileMenuOpen =
    isMobileMenuOpenProp ?? internalMobileMenuOpen;
  const setIsMobileMenuOpen =
    onMobileMenuOpenChange ?? setInternalMobileMenuOpen;
  const stripRef = useRef<HTMLDivElement>(null);

  // Cabecera compacta al bajar el scroll: se pliega la micro-tira, la barra
  // principal encoge y las categorías bajan de alto — casi la mitad de altura
  // para no estorbar al leer. Histéresis (comprime >96 px, vuelve a <48 px)
  // para no parpadear en el límite.
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const sync = () => {
      const y = window.scrollY;
      setCompact((prev) => (prev ? y > 48 : y > 96));
    };
    sync();
    window.addEventListener("scroll", sync, { passive: true });
    // Respaldo: algunos entornos (tabs en segundo plano, automatización)
    // desplazan sin emitir eventos de scroll; el sondeo — barato y sin
    // re-renders porque setCompact ignora cambios repetidos — lo cubre.
    const poll = window.setInterval(sync, 300);
    return () => {
      window.removeEventListener("scroll", sync);
      window.clearInterval(poll);
    };
  }, []);

  // Tira de categorías (móvil/tablet): la sección activa se centra sola
  useEffect(() => {
    const active = stripRef.current?.querySelector<HTMLElement>(
      '[data-active="true"]',
    );
    if (active) {
      active.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }, [selectedCategory]);

  const rawList =
    propCategories && propCategories.length > 0
      ? propCategories
      : [...CATEGORIES];

  const categories: { id: CategoryId; label: string }[] = rawList.map(
    (cat) => ({
      id: cat,
      label: cat === "TODAS" ? "PORTADA" : cat,
    }),
  );

  const handleCategoryClick = (catId: CategoryId) => {
    onSelectCategory(catId);
    setIsMobileMenuOpen(false);
  };

  // Basic readers (LECTOR) and visitors must NOT see the redacción button or internal tools
  // Cualquier cuenta con sesión abre su panel; el contenido se segmenta por
  // permisos (el lector ve «Mi Espacio», la redacción, sus herramientas).
  const canAccessEditorialStudio = Boolean(
    currentUser && currentUser.id !== GUEST_USER_ID,
  );

  // Account chip: never shows role jargon to readers — guests see "ACCEDER"
  const isSignedIn = Boolean(currentUser && currentUser.id !== GUEST_USER_ID);
  const accountLabel = !isSignedIn
    ? "ACCEDER"
    : currentUser && currentUser.role !== "LECTOR"
      ? currentUser.role
      : "MI CUENTA";
  const accountTitle =
    isSignedIn && currentUser
      ? `Cuenta: ${currentUser.name} (${currentUser.role})`
      : "Acceder con tu cuenta de Google";

  // Accesos del panel filtrados por permisos reales (misma tabla que el panel)
  const shortcuts: PanelShortcut[] =
    isSignedIn && currentUser
      ? PANEL_SHORTCUTS[currentUser.role].filter((s) =>
          canOpenStudioTab(currentUser.role, s.tab),
        )
      : [];

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
    <header data-assemble data-step="150" className="bn-safe-top w-full bg-black border-b border-white/10 sticky top-0 z-40 select-none">
      {/* Top micro-strip: clean & uncrowded (se pliega al compactar) */}
      <div className={`${compact ? "hidden" : ""} max-w-7xl mx-auto px-4 sm:px-6 h-7 flex items-center justify-between text-[11px] font-sans tracking-wide text-neutral-400 border-b border-white/5 uppercase font-medium`}>
        <div className="flex items-center gap-2.5">
          <span className="flex items-center gap-1.5 text-white font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
            EN DIRECTO
          </span>
          <span className="text-neutral-700">·</span>
          <span className="text-neutral-400">{dateIn(REFERENCE_TZ)}</span>
        </div>

        <div className="flex items-center gap-1 sm:gap-3 text-neutral-400">
          <button
            onClick={onToggleLiveTicker}
            className={`hover:text-white transition-colors flex items-center gap-1 cursor-pointer px-1.5 py-1.5 -mx-1.5 -my-1.5 ${
              liveTickerActive ? "text-white font-medium" : "text-neutral-500"
            }`}
            title="Alternar teletipo"
          >
            <Radio className="w-3 h-3" />
            <span className="hidden sm:inline">TELETIPO</span>
          </button>
          <span className="text-neutral-700">·</span>
          <button
            onClick={onToggleLite}
            className={`hover:text-white transition-colors flex items-center gap-1 cursor-pointer px-1.5 py-1.5 -mx-1.5 -my-1.5 ${
              liteMode ? "text-white font-medium" : "text-neutral-500"
            }`}
            title={
              liteMode
                ? "Modo ligero activo: pulsar para volver a mostrar las imágenes"
                : "Modo ligero: leer solo texto (sin imágenes)"
            }
          >
            <ImageOff className="w-3 h-3" />
            <span className="hidden sm:inline">LIGERO</span>
          </button>
          <span className="text-neutral-700">·</span>
          <AssembleToggle />
          <span className="text-neutral-700 hidden sm:inline">·</span>
          <button
            onClick={onShareSite}
            className="hover:text-white transition-colors cursor-pointer hidden sm:inline px-1"
            title="Compartir medio"
          >
            COMPARTIR
          </button>
        </div>
      </div>

      {/* Main Bar: brand + actions. Both sides are shrink-0 and the row matches
          the content container width, so nothing can spill past the side margins */}
      <div className={`max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-3 transition-[height] duration-200 ${compact ? "h-11 sm:h-12" : "h-14 sm:h-16"}`}>
        {/* Left: Brand with Editorial Authority */}
        <div className="flex items-center shrink-0" data-piece>
          <button
            onClick={() => handleCategoryClick("TODAS")}
            className={`font-headline font-semibold tracking-tight text-white hover:text-neutral-200 transition-all flex items-baseline cursor-pointer ${compact ? "text-lg sm:text-xl" : "text-2xl sm:text-[1.85rem]"}`}
          >
            BLACKNEWS
            <span className="w-1.5 h-1.5 rounded-full bg-white ml-1 inline-block"></span>
          </button>
        </div>

        {/* Right: Streamlined Action Cluster */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Panel: en móvil vive en el menú hamburguesa (menos cabecera que saturar) */}
          {canAccessEditorialStudio && (
            <button
              data-piece
              onClick={onOpenStudio}
              className={`hidden sm:flex px-3 py-1.5 text-xs font-sans font-medium uppercase tracking-wider items-center gap-1.5 transition-colors cursor-pointer rounded-md border ${
                isStudioOpen
                  ? "bg-white text-black border-white font-semibold shadow-sm"
                  : "border-white/20 text-white bg-white/5 hover:bg-white hover:text-black hover:border-white"
              }`}
              title={
                currentUser?.role === "LECTOR"
                  ? "Mi panel: historial, guardados y publicidad"
                  : "Panel Interno: Redacción, Portada, Imágenes y Gestión"
              }
            >
              <PenTool className="w-3.5 h-3.5" />
              <span className={compact ? "hidden" : ""}>
                {isStudioOpen
                  ? "VER PORTADA"
                  : currentUser?.role === "LECTOR"
                    ? "MI PANEL"
                    : "PANEL INTERNO"}
              </span>
            </button>
          )}

          {/* User Account / Google Chip (solo ≥sm; en móvil está en el menú) */}
          {onOpenGoogleAuth && (
            <button
              data-piece
              onClick={onOpenGoogleAuth}
              className="hidden sm:flex items-center gap-1.5 py-1.5 px-2.5 rounded-md border border-white/15 hover:border-white text-neutral-300 hover:text-white text-xs font-sans font-medium transition-colors cursor-pointer"
              title={accountTitle}
            >
              {googleIconSvg}
              <span
                className={`text-[11px] font-semibold text-neutral-200 ${compact ? "hidden" : ""}`}
              >
                {accountLabel}
              </span>
            </button>
          )}

          {/* Search Button */}
          <button
            data-piece
            onClick={onOpenSearch}
            className="p-2.5 rounded-md text-neutral-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            aria-label="Buscar"
            title="Buscar informes"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Bookmarks Button */}
          <button
            onClick={onOpenBookmarks}
            className="p-2.5 rounded-md text-neutral-400 hover:text-white hover:bg-white/5 transition-colors relative cursor-pointer"
            aria-label="Guardados"
            title="Lecturas guardadas"
          >
            <Bookmark className="w-4 h-4" />
            {bookmarksCount > 0 && (
              <span className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-white text-black font-mono text-[10px] font-bold flex items-center justify-center tabular-nums shadow-sm">
                {bookmarksCount}
              </span>
            )}
          </button>

          {/* Mobile Menu Hamburger Toggle (Visible on screens below lg) */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden p-2 text-neutral-300 hover:text-white transition-colors cursor-pointer ml-0.5"
            aria-label="Menú"
            aria-expanded={isMobileMenuOpen}
            title="Menú de secciones"
          >
            {isMobileMenuOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {/* Desktop category strip: strictly contained within max-w-7xl width.
          Scrolls horizontally if categories exceed available width without breaking layout. */}
      <nav
        data-piece
        className="hidden lg:block border-t border-white/5 w-full overflow-hidden"
        aria-label="Secciones editoriales"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 relative">
          <div className={`flex items-center gap-5 xl:gap-7 text-xs font-sans font-medium tracking-wide overflow-x-auto no-scrollbar scroll-smooth w-full justify-start xl:justify-center transition-[height] duration-200 ${compact ? "h-8" : "h-10"}`}>
            {categories.map((cat) => {
              const isActive = selectedCategory === cat.id && !isStudioOpen;
              const isFen = isFenomenos(cat.id);
              return (
                <button
                  key={cat.id}
                  onClick={() => handleCategoryClick(cat.id)}
                  className={`h-full flex items-center transition-colors cursor-pointer relative whitespace-nowrap shrink-0 ${
                    isFen ? "font-mono tracking-wider" : ""
                  } ${
                    isActive
                      ? "text-white font-semibold"
                      : "text-neutral-400 hover:text-white"
                  }`}
                >
                  {isFen && <span className="bn-redact" aria-hidden="true"></span>}
                  {cat.label}
                  {isActive && (
                    <span
                      className={`absolute bottom-0 left-0 w-full h-[1.5px] rounded-full ${
                        isFen ? "bn-file-underline" : "bg-white"
                      }`}
                    ></span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Mobile & tablet category strip: always reachable without opening the menu */}
      <nav
        className="lg:hidden border-t border-white/5 w-full overflow-hidden"
        aria-label="Secciones editoriales"
      >
        <div
          ref={stripRef}
          className={`flex items-center gap-4 px-4 overflow-x-auto no-scrollbar scroll-smooth w-full transition-[height] duration-200 ${compact ? "h-8" : "h-10"}`}
        >
          {categories.map((cat) => {
            const isActive = selectedCategory === cat.id && !isStudioOpen;
            const isFen = isFenomenos(cat.id);
            return (
              <button
                key={cat.id}
                data-active={isActive}
                onClick={() => handleCategoryClick(cat.id)}
                className={`h-full flex items-center shrink-0 whitespace-nowrap text-[11px] font-medium uppercase transition-colors cursor-pointer relative ${
                  isFen ? "font-mono tracking-wider" : "font-sans font-medium tracking-wider"
                } ${
                  isActive
                    ? "text-white font-semibold"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                {isFen && <span className="bn-redact" aria-hidden="true"></span>}
                {cat.label}
                {isActive && (
                  <span
                    className={`absolute bottom-0 left-0 w-full h-[1.5px] rounded-full ${
                      isFen ? "bn-file-underline" : "bg-white"
                    }`}
                  ></span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Slide-out / Dropdown Mobile & Tablet Menu */}
      {isMobileMenuOpen && (
        <div className="xl:hidden bg-black border-t border-white/10 px-4 sm:px-6 py-6 max-h-[75dvh] overflow-y-auto overscroll-contain space-y-6 animate-in slide-in-from-top duration-150">
          {/* 1 · Quién está conectado y qué alcance tiene su rol */}
          <div className="flex items-center gap-3">
            {isSignedIn && currentUser ? (
              <>
                {currentUser.avatarUrl ? (
                  <img
                    src={currentUser.avatarUrl}
                    alt={currentUser.name}
                    className="w-10 h-10 rounded-xl object-cover border border-white/10 shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-white text-black font-extrabold flex items-center justify-center text-sm shrink-0">
                    {currentUser.avatarInitials}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-white truncate">
                    {currentUser.name}
                  </div>
                  <div className="text-[11px] text-neutral-500 truncate">
                    {ROLE_SCOPE[currentUser.role]}
                  </div>
                </div>
                <span
                  className={`shrink-0 text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-1 rounded border ${ROLE_CHIP_CLASS[currentUser.role]}`}
                >
                  {currentUser.role}
                </span>
              </>
            ) : (
              <>
                <div className="w-10 h-10 rounded-xl border border-white/10 flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 text-neutral-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-white">
                    Lector invitado
                  </div>
                  <div className="text-[11px] text-neutral-500">
                    Sesión guardada en este dispositivo
                  </div>
                </div>
              </>
            )}
          </div>

          {/* 2 · Accesos directos del panel: cada rol ve los suyos */}
          {shortcuts.length > 0 && (
            <div>
              <div className="text-[11px] font-mono text-neutral-500 uppercase tracking-widest mb-3">
                {currentUser?.role === "LECTOR"
                  ? "Mi Espacio"
                  : `Accesos del panel · ${currentUser?.role}`}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {shortcuts.map(({ tab, label, icon: ShortcutIcon }) => (
                  <button
                    key={tab}
                    onClick={() => {
                      onOpenStudioTab?.(tab);
                      setIsMobileMenuOpen(false);
                    }}
                    className="py-2.5 px-3 text-left text-[11px] font-semibold uppercase tracking-wider text-neutral-300 border border-white/5 hover:border-white/30 hover:text-white transition-colors flex items-center gap-2 cursor-pointer min-w-0"
                  >
                    <ShortcutIcon className="w-3.5 h-3.5 shrink-0 text-neutral-500" />
                    <span className="truncate">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 3 · Category Links List */}
          <div>
            <div className="text-[11px] font-mono text-neutral-500 uppercase tracking-widest mb-3">
              SECCIONES EDITORIALES
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {categories.map((cat) => {
                const isActive = selectedCategory === cat.id && !isStudioOpen;
                const isFen = isFenomenos(cat.id);
                return (
                  <button
                    key={cat.id}
                    onClick={() => handleCategoryClick(cat.id)}
                    className={`py-2 px-3 text-left text-xs uppercase transition-colors flex items-center justify-between cursor-pointer border ${
                      isFen ? "font-mono tracking-wider" : "font-sans tracking-wider"
                    } ${
                      isActive
                        ? isFen
                          ? "border-dashed border-white bg-white/5 text-white font-semibold"
                          : "border-white bg-white text-black font-semibold"
                        : "border-white/5 text-neutral-300 hover:border-white/30 hover:text-white"
                    }`}
                  >
                    <span className="flex items-center min-w-0">
                      {isFen && <span className="bn-redact" aria-hidden="true"></span>}
                      <span className="truncate">{cat.label}</span>
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 opacity-60 shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4 · User Status & Direct Action Buttons */}
          <div className="pt-4 border-t border-white/10 space-y-3">
            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              {canAccessEditorialStudio && (
                <button
                  onClick={() => {
                    onOpenStudio();
                    setIsMobileMenuOpen(false);
                  }}
                  className="flex-1 py-2.5 px-3 border border-white/30 bg-white/5 hover:border-white text-xs font-semibold uppercase tracking-wider text-white flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <PenTool className="w-3.5 h-3.5" />
                  <span>
                    {isStudioOpen
                      ? "VER PORTADA"
                      : currentUser?.role === "LECTOR"
                        ? "MI PANEL"
                        : "PANEL INTERNO (REDACCIÓN)"}
                  </span>
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
                  <span>
                    {currentUser ? "MI CUENTA & PERMISOS" : "ACCESO CON GOOGLE"}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
