import { RedactorRole, ROLE_PERMISSIONS } from './auth';

/**
 * Pestañas del panel interno (RedactionStudio).
 * Compartida entre App, TopBar y RedactionStudio para que el menú móvil
 * pueda abrir directamente la sección que corresponde al rol.
 */
export type StudioTab =
  | 'overview'
  | 'layout'
  | 'builder'
  | 'images'
  | 'categories'
  | 'post-generator'
  | 'calendar'
  | 'ads'
  | 'users'
  | 'my-articles'
  | 'register'
  | 'policies'
  | 'history'
  | 'saved'
  | 'profile';

/** Alcance de cada rol en una línea (menú móvil y cabecera del panel). */
export const ROLE_SCOPE: Record<RedactorRole, string> = {
  ADMIN: 'Portada · Categorías · Equipo · Políticas',
  MODERADOR: 'Portada · Equipo y roles',
  REDACTOR: 'Redacción, multimedia y agenda',
  LECTOR: 'Lecturas, guardados y publicidad',
};

/**
 * Chip de rol con la misma paleta en todos los menús.
 * AMOLED: fondo apenas insinuado, borde suave, sin dureza.
 */
export const ROLE_CHIP_CLASS: Record<RedactorRole, string> = {
  ADMIN: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10',
  MODERADOR: 'text-sky-400 border-sky-500/40 bg-sky-500/10',
  REDACTOR: 'text-amber-400 border-amber-500/40 bg-amber-500/10',
  LECTOR: 'text-neutral-300 border-white/15 bg-white/5',
};

/** Pestaña por defecto de cada rol al entrar al panel. */
export const DEFAULT_STUDIO_TAB: Record<RedactorRole, StudioTab> = {
  ADMIN: 'overview',
  MODERADOR: 'overview',
  REDACTOR: 'overview',
  LECTOR: 'history',
};

/**
 * Misma tabla que decide qué pestañas renderiza el panel: si un enlace del
 * menú apunta a una sección que el rol no puede ver, no se abre.
 */
export const canOpenStudioTab = (
  role: RedactorRole,
  tab: StudioTab,
): boolean => {
  const p = ROLE_PERMISSIONS[role];
  switch (tab) {
    case 'overview':
    case 'builder':
    case 'my-articles':
    case 'post-generator':
    case 'images':
      return p.canWritePosts;
    case 'layout':
      return p.canManageLayout;
    case 'categories':
      return p.canManageCategories;
    case 'users':
      return p.canManageUsers;
    case 'policies':
      return p.canManagePolicies;
    case 'calendar':
      return p.canAccessInternalMedia;
    case 'register':
      return role === 'LECTOR';
    default:
      // profile · history · saved · ads: espacio personal de cualquier rol
      return true;
  }
};
