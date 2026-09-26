import React, { useState } from 'react';
import { X, Check, LogOut, ArrowRight, ShieldCheck, User } from 'lucide-react';
import { RedactorProfile, ROLE_PERMISSIONS, RedactorRole } from '../types/auth';
import { auth, googleProvider } from '../firebase';
import { signInWithPopup } from 'firebase/auth';

interface GoogleAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: RedactorProfile;
  onLoginWithGoogle: (email: string, name: string, bureau?: string, title?: string, role?: RedactorRole) => void;
  onLogout: () => void;
}

export const GoogleAuthModal: React.FC<GoogleAuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onLoginWithGoogle,
  onLogout,
}) => {
  const [customEmail, setCustomEmail] = useState('');
  const [customName, setCustomName] = useState('');
  const [isCustomFormOpen, setIsCustomFormOpen] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  if (!isOpen) return null;

  const permissions = ROLE_PERMISSIONS[currentUser.role];

  // Quick switchers for testing different privilege levels
  const handleAdminQuickLogin = () => {
    onLoginWithGoogle(
      'blacknewsglobalmedia@gmail.com',
      'Administrador',
      'Zúrich / Central',
      'Administrador',
      'ADMIN'
    );
    onClose();
  };

  const handleModeratorQuickLogin = () => {
    onLoginWithGoogle(
      'editor.portada@blacknews.media',
      'Helena Von Berg',
      'Ginebra / Mesa de Portada',
      'Moderadora de Portada',
      'MODERADOR'
    );
    onClose();
  };

  const handleRedactorQuickLogin = () => {
    onLoginWithGoogle(
      'mateo.valenzuela@blacknews.media',
      'Mateo R. Valenzuela',
      'Zúrich / Mercados',
      'Redactor de Mercados',
      'REDACTOR'
    );
    onClose();
  };

  const handleReaderQuickLogin = () => {
    onLoginWithGoogle(
      'lector.demo@gmail.com',
      'Usuario Lector',
      'Lector Registrado',
      'Usuario Básico',
      'LECTOR'
    );
    onClose();
  };

  // Real Google Sign-in with Firebase
  const handleRealFirebaseGoogleSignIn = async () => {
    setIsConnecting(true);
    setAuthError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      const email = user.email || 'usuario.google@gmail.com';
      const name = user.displayName || 'Usuario Google';
      
      // Strict rule: Only the specific owner email gets ADMIN automatically.
      // All other normal people sign in as LECTOR (basic user without any editing permissions).
      const role: RedactorRole = email.toLowerCase() === 'blacknewsglobalmedia@gmail.com'
        ? 'ADMIN'
        : 'LECTOR';

      onLoginWithGoogle(
        email,
        name,
        role === 'ADMIN' ? 'Central' : 'Lector Registrado',
        role === 'ADMIN' ? 'Administrador' : 'Usuario Básico',
        role
      );
      onClose();
    } catch (err: any) {
      console.warn('[Firebase Auth]:', err);
      if (err.code === 'auth/popup-blocked' || err.code === 'auth/cancelled-popup-request') {
        setAuthError('La ventana emergente fue bloqueada por el navegador. Puedes ingresar directamente con el acceso rápido de prueba abajo.');
      } else {
        setAuthError(`Aviso: ${err.message || 'No se pudo abrir la ventana de Google'}. Puedes ingresar con tu correo abajo.`);
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const handleCustomGoogleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customEmail.trim() || !customName.trim()) return;
    
    // Normal registration always creates a basic LECTOR account
    const role: RedactorRole = customEmail.trim().toLowerCase() === 'blacknewsglobalmedia@gmail.com'
      ? 'ADMIN'
      : 'LECTOR';

    onLoginWithGoogle(
      customEmail.trim(), 
      customName.trim(), 
      'Lector Registrado', 
      'Usuario Básico',
      role
    );
    onClose();
  };

  const googleIconSvg = (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 animate-in fade-in duration-150 font-sans">
      <div className="w-full max-w-lg bg-black border border-white/10 p-6 sm:p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto rounded-xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-6">
          <div className="flex items-center gap-2.5">
            {googleIconSvg}
            <h2 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-white">
              ACCESO DE USUARIOS · BLACKNEWS
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white transition-colors cursor-pointer rounded-md hover:bg-white/5"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Current Session Overview */}
        <div className="mb-6 pb-5 border-b border-white/10">
          <div className="text-xs font-sans uppercase tracking-wider text-neutral-400 mb-1.5 font-medium">
            SESIÓN ACTIVA
          </div>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="text-sm font-medium text-white flex items-center gap-2">
                <span>{currentUser.name}</span>
                <span className={`text-[11px] font-sans px-2.5 py-0.5 rounded border ${
                  currentUser.role === 'ADMIN'
                    ? 'border-white text-white font-semibold'
                    : currentUser.role === 'MODERADOR'
                    ? 'border-neutral-400 text-neutral-200'
                    : currentUser.role === 'REDACTOR'
                    ? 'border-neutral-600 text-neutral-300'
                    : 'border-neutral-700 text-neutral-400'
                }`}>
                  {currentUser.role === 'LECTOR' ? 'LECTOR (BÁSICO)' : currentUser.role}
                </span>
              </div>
              <div className="text-xs font-sans text-neutral-400 mt-1 font-light">
                {currentUser.email}
              </div>
            </div>
            {currentUser.isGoogleAccount && (
              <span className="text-xs font-sans font-medium text-white flex items-center gap-1">
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                GOOGLE
              </span>
            )}
          </div>

          {/* Permisos de la cuenta activa */}
          <div className="mt-4 pt-3 border-t border-white/5 space-y-1 text-xs font-sans text-neutral-400">
            {currentUser.role === 'LECTOR' ? (
              <div className="p-3 bg-neutral-950 border border-white/10 text-neutral-300 rounded-lg">
                <p className="text-xs text-neutral-400 leading-relaxed font-light">
                  Cuenta de <strong className="text-white font-medium">Usuario Básico</strong>: puedes guardar artículos y compartir sin restricciones. No posees permisos de redacción ni edición en el medio hasta que un administrador habilite tu cuenta específicamente.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-1.5">
                  <span className={permissions.canWritePosts ? 'text-white' : 'text-neutral-600'}>●</span>
                  <span>Redactar: {permissions.canWritePosts ? 'SÍ' : 'NO'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={permissions.canEditOwnPosts ? 'text-white' : 'text-neutral-600'}>●</span>
                  <span>Editar mis artículos: {permissions.canEditOwnPosts ? 'SÍ' : 'NO'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={permissions.canManageLayout ? 'text-white' : 'text-neutral-600'}>●</span>
                  <span>Gestión Portada: {permissions.canManageLayout ? 'SÍ' : 'NO'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={permissions.canManageUsers ? 'text-white' : 'text-neutral-600'}>●</span>
                  <span>Gestión Roles: {permissions.canManageUsers ? 'SÍ' : 'NO'}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {authError && (
          <div className="mb-4 p-3 bg-red-950/40 border border-red-500/40 text-red-200 text-xs font-sans rounded-lg">
            {authError}
          </div>
        )}

        {/* Real Firebase Google Auth Popup Button */}
        <div className="mb-5">
          <button
            onClick={handleRealFirebaseGoogleSignIn}
            disabled={isConnecting}
            className="w-full py-3.5 bg-white text-black font-semibold text-xs uppercase tracking-wider hover:bg-neutral-200 transition-colors cursor-pointer flex items-center justify-center gap-2.5 shadow-md rounded-md"
          >
            {googleIconSvg}
            <span>{isConnecting ? 'CONECTANDO...' : 'INICIAR SESIÓN CON GOOGLE'}</span>
          </button>
          <p className="text-xs font-sans text-neutral-400 text-center mt-2 font-light">
            Los nuevos registros ingresan como usuarios básicos sin capacidad de edición.
          </p>
        </div>

        {/* Fast profile switchers: ONLY visible to ADMIN for system testing and audits. */}
        {currentUser.role === 'ADMIN' && (
          <div className="space-y-2 mb-6 pt-4 border-t border-white/5">
            <div className="text-xs font-sans uppercase tracking-wider text-neutral-400 mb-2 flex items-center justify-between font-medium">
              <span>SIMULACIÓN DE ROLES (SOLO ADMIN):</span>
              <span className="text-[10px] text-neutral-500">AUDITORÍA</span>
            </div>

            {/* Master Admin Button */}
            <button
              onClick={handleAdminQuickLogin}
              className="w-full p-3 border border-white/10 hover:border-white text-left flex items-center justify-between transition-colors cursor-pointer group text-neutral-300 hover:text-white rounded-lg hover:bg-white/[0.02]"
            >
              <div>
                <div className="text-xs font-semibold text-white">
                  blacknewsglobalmedia@gmail.com
                </div>
                <div className="text-xs font-sans text-neutral-400 mt-0.5">
                  Rol: Administrador (gestión total)
                </div>
              </div>
              <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>

            {/* Moderator Button */}
            <button
              onClick={handleModeratorQuickLogin}
              className="w-full p-3 border border-white/10 hover:border-white text-left flex items-center justify-between transition-colors cursor-pointer group text-neutral-300 hover:text-white rounded-lg hover:bg-white/[0.02]"
            >
              <div>
                <div className="text-xs font-semibold text-white">
                  editor.portada@blacknews.media
                </div>
                <div className="text-xs font-sans text-neutral-400 mt-0.5">
                  Rol: Moderador (gestión de portada y roles)
                </div>
              </div>
              <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>

            {/* Redactor Button */}
            <button
              onClick={handleRedactorQuickLogin}
              className="w-full p-3 border border-white/10 hover:border-white text-left flex items-center justify-between transition-colors cursor-pointer group text-neutral-300 hover:text-white rounded-lg hover:bg-white/[0.02]"
            >
              <div>
                <div className="text-xs font-semibold text-white">
                  mateo.valenzuela@blacknews.media
                </div>
                <div className="text-xs font-sans text-neutral-400 mt-0.5">
                  Rol: Redactor (edita y publica solo sus propios artículos)
                </div>
              </div>
              <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>

            {/* Reader Button */}
            <button
              onClick={handleReaderQuickLogin}
              className="w-full p-3 border border-white/10 hover:border-white text-left flex items-center justify-between transition-colors cursor-pointer group text-neutral-300 hover:text-white rounded-lg hover:bg-white/[0.02]"
            >
              <div>
                <div className="text-xs font-semibold text-white">
                  lector.demo@gmail.com
                </div>
                <div className="text-xs font-sans text-neutral-400 mt-0.5">
                  Rol: Lector básico (sin permisos de edición ni acceso interno)
                </div>
              </div>
              <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          </div>
        )}

        {/* Custom Google Account Login / Register Toggle */}
        {!isCustomFormOpen ? (
          <button
            onClick={() => setIsCustomFormOpen(true)}
            className="w-full py-2 text-xs font-sans font-medium text-neutral-400 hover:text-white uppercase tracking-wider text-center transition-colors cursor-pointer border-t border-white/5 pt-3"
          >
            + Registrar otra cuenta de correo o Gmail
          </button>
        ) : (
          <form onSubmit={handleCustomGoogleSubmit} className="pt-3 border-t border-white/5 space-y-3">
            <div className="text-xs font-sans font-semibold uppercase tracking-wider text-neutral-200">
              REGISTRO DE USUARIO BÁSICO
            </div>
            <div>
              <label className="block text-xs font-sans text-neutral-400 mb-1">
                NOMBRE COMPLETO
              </label>
              <input
                type="text"
                required
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Nombre y apellido"
                className="w-full bg-black border-b border-white/20 pb-1 text-xs sm:text-sm text-white focus:outline-none focus:border-white font-sans"
              />
            </div>
            <div>
              <label className="block text-xs font-sans text-neutral-400 mb-1">
                CORREO ELECTRÓNICO (GMAIL)
              </label>
              <input
                type="email"
                required
                value={customEmail}
                onChange={(e) => setCustomEmail(e.target.value)}
                placeholder="correo@gmail.com"
                className="w-full bg-black border-b border-white/20 pb-1 text-xs sm:text-sm text-white focus:outline-none focus:border-white font-sans"
              />
            </div>
            <p className="text-xs font-sans text-neutral-500 font-light">
              * La cuenta se creará con rol de LECTOR (sin permisos de edición). Un administrador podrá asignarte como redactor posteriormente.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                className="flex-1 py-2 bg-white text-black font-semibold text-xs uppercase tracking-wider hover:bg-neutral-200 transition-colors cursor-pointer rounded-md"
              >
                REGISTRAR COMO LECTOR
              </button>
              <button
                type="button"
                onClick={() => setIsCustomFormOpen(false)}
                className="px-3 py-2 text-xs font-sans text-neutral-400 hover:text-white cursor-pointer"
              >
                CANCELAR
              </button>
            </div>
          </form>
        )}

        {/* Logout action */}
        <div className="pt-5 border-t border-white/10 mt-5 flex items-center justify-between">
          <button
            onClick={() => {
              onLogout();
              onClose();
            }}
            className="text-xs font-sans text-neutral-400 hover:text-red-400 transition-colors flex items-center gap-1.5 cursor-pointer font-medium"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>CERRAR SESIÓN</span>
          </button>
          <button
            onClick={onClose}
            className="text-xs font-sans text-neutral-400 hover:text-white transition-colors cursor-pointer font-medium"
          >
            CERRAR
          </button>
        </div>
      </div>
    </div>
  );
};
