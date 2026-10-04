export type RedactorRole = 'ADMIN' | 'MODERADOR' | 'REDACTOR' | 'LECTOR';

/** Sentinel id of the unauthenticated visitor session ("Lector Invitado"). */
export const GUEST_USER_ID = 'usr-guest';

export interface UserPermissions {
  canAccessInternalMedia: boolean;
  canManageLayout: boolean;
  canPublishDirectly: boolean;
  canManageUsers: boolean;
  canManageCategories: boolean;
  canDeleteAnyReport: boolean;
  canManageBreakingTicker: boolean;
  canWritePosts: boolean;
  canEditOwnPosts: boolean;
  /** Publicar cambios en las políticas legales (solo cuenta propietaria). */
  canManagePolicies: boolean;
}

export interface RedactorProfile {
  id: string;
  name: string;
  email: string;
  role: RedactorRole;
  bureau: string;
  title: string;
  avatarUrl?: string;
  avatarInitials: string;
  requestedAt: string;
  approvedAt?: string;
  bio?: string;
  isGoogleAccount?: boolean;
}

export const ROLE_PERMISSIONS: Record<RedactorRole, UserPermissions> = {
  ADMIN: {
    canAccessInternalMedia: true,
    canManageLayout: true,
    canPublishDirectly: true,
    canManageUsers: true,
    canManageCategories: true,
    canDeleteAnyReport: true,
    canManageBreakingTicker: true,
    canWritePosts: true,
    canEditOwnPosts: true,
    canManagePolicies: true,
  },
  MODERADOR: {
    canAccessInternalMedia: true,
    canManageLayout: true,
    canPublishDirectly: true,
    canManageUsers: true,
    canManageCategories: false,
    canDeleteAnyReport: false,
    canManageBreakingTicker: true,
    canWritePosts: true,
    canEditOwnPosts: true,
    canManagePolicies: false,
  },
  REDACTOR: {
    canAccessInternalMedia: true,
    canManageLayout: false,
    canPublishDirectly: true,
    canManageUsers: false,
    canManageCategories: false,
    canDeleteAnyReport: false,
    canManageBreakingTicker: false,
    canWritePosts: true,
    canEditOwnPosts: true, // Solo sus propios artículos
    canManagePolicies: false,
  },
  LECTOR: {
    canAccessInternalMedia: false,
    canManageLayout: false,
    canPublishDirectly: false,
    canManageUsers: false,
    canManageCategories: false,
    canDeleteAnyReport: false,
    canManageBreakingTicker: false,
    canWritePosts: false,
    canEditOwnPosts: false,
    canManagePolicies: false,
  },
};
