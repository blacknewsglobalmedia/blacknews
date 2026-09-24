export type RedactorRole = 'ADMIN' | 'MODERADOR' | 'REDACTOR' | 'LECTOR';

export interface UserPermissions {
  canManageLayout: boolean;
  canPublishDirectly: boolean;
  canManageUsers: boolean;
  canDeleteAnyReport: boolean;
  canManageBreakingTicker: boolean;
  canWritePosts: boolean;
  canEditOwnPosts: boolean;
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
    canManageLayout: true,
    canPublishDirectly: true,
    canManageUsers: true,
    canDeleteAnyReport: true,
    canManageBreakingTicker: true,
    canWritePosts: true,
    canEditOwnPosts: true,
  },
  MODERADOR: {
    canManageLayout: true,
    canPublishDirectly: true,
    canManageUsers: true,
    canDeleteAnyReport: false,
    canManageBreakingTicker: true,
    canWritePosts: true,
    canEditOwnPosts: true,
  },
  REDACTOR: {
    canManageLayout: false,
    canPublishDirectly: true,
    canManageUsers: false,
    canDeleteAnyReport: false,
    canManageBreakingTicker: false,
    canWritePosts: true,
    canEditOwnPosts: true, // Solo sus propios artículos
  },
  LECTOR: {
    canManageLayout: false,
    canPublishDirectly: false,
    canManageUsers: false,
    canDeleteAnyReport: false,
    canManageBreakingTicker: false,
    canWritePosts: false,
    canEditOwnPosts: false,
  },
};
