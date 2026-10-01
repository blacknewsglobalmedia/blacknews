import React, { useState } from 'react';
import { X, Check, LogOut, PenTool } from 'lucide-react';
import { RedactorProfile, ROLE_PERMISSIONS } from '../types/auth';
import { auth, googleProvider } from '../firebase';
import { signInWithPopup } from 'firebase/auth';

interface GoogleAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: RedactorProfile;
  onLoginWithGoogle: (email: string, name: string, bureau?: string, title?: string, verified?: boolean) => void;
  onLogout: () => void;
  onOpenStudio?: () => void;
}

export const GoogleAuthModal: React.FC<GoogleAuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onLoginWithGoogle,
  onLogout,
  onOpenStudio,
}) => {
  const [customEmail, setCustomEmail] = useState('');
  const [customName, setCustomName] = useState('');
  const [isCustomFormOpen, setIsCustomFormOpen] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  if (!isOpen) return null;

  const permissions = ROLE_PERMISSIONS[currentUser.role];

  // Real Google Sign-in with Firebase
  const handleRealFirebaseGoogleSignIn = async () => {
    setIsConnecting(true);
    setAuthError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      const email = user.email || 'usuario.google@gmail.com';
      const name = user.displayName || 'Usuario Google';
      const isOwner = email.trim().toLowerCase() === 'blacknewsglobalmedia@gmail.com';

      // Verified identity: only the owner email gets ADMIN, everyone else enters as LECTOR.
      onLoginWithGoogle(
        email,
        name,
        isOwner ? 'Zúrich / Central' : 'Lector Registrado',
        isOwner ? 'Administrador' : 'Usuario Básico',
        true
      );
      onClose();
    } catch (err: any) {
      console.warn('[Firebase Auth]:', err);
      if (err.code === 'auth/popup-blocked' || err.code === 'auth/cancelled-popup-request') {
        setAuthError('La ventana emergente fue bloqueada por el navegador. Permítela e inténtalo de nuevo con el botón "Acceder con cuenta Google".');
      } else {
        setAuthError(`Aviso: ${err.message || 'No se pudo abrir la ventana de Google'}. Verifica que el proveedor de Google esté habilitado en la consola de Firebase e inténtalo de nuevo.`);
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const handleCustomGoogleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customEmail.trim() || !customName.trim()) return;

    // Manual registration never grants editorial permissions: it always creates a LECTOR
    // account. ADMIN is only reachable through the verified Google sign-in above.
    onLoginWithGoogle(
      customEmail.trim(),
      customName.trim(),
      'Lector Registrado',
      'Usuario Básico',
      false
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
                    ? 'border-emerald-500/50 bg-emerald-950/30 text-emerald-400 font-semibold'
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
          <div className="mt-4 pt-3 border-t border-white/5 space-y-2 text-xs font-sans text-neutral-400">
            {currentUser.role === 'LECTOR' ? (
              <div className="p-3 bg-neutral-950 border border-white/10 text-neutral-300 rounded-lg">
                <p className="text-xs text-neutral-400 leading-relaxed font-light">
                  Cuenta de <strong className="text-white font-medium">Lector Básico</strong>: puedes guardar artículos y compartir sin restricciones. Para ver el panel interno con permisos editoriales es necesario iniciar sesión con la cuenta de Google del editor, verificada por Firebase.
                </p>
              </div>
            ) : (
              <div>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="flex items-center gap-1.5">
                    <span className={permissions.canWritePosts ? 'text-white' : 'text-neutral-600'}>●</span>
                    <span>Redactar: {permissions.canWritePosts ? 'SÍ' : 'NO'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={permissions.canEditOwnPosts ? 'text-white' : 'text-neutral-600'}>●</span>
                    <span>Editar artículos: {permissions.canEditOwnPosts ? 'SÍ' : 'NO'}</span>
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

                {/* Direct button to open internal panel right from the modal */}
                {onOpenStudio && (
                  <button
                    onClick={() => {
                      onClose();
                      onOpenStudio();
                    }}
                    className="w-full py-2.5 px-4 bg-white text-black font-semibold text-xs uppercase tracking-wider rounded-md hover:bg-neutral-200 transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                  >
                    <PenTool className="w-3.5 h-3.5" />
                    <span>IR AL PANEL INTERNO DE REDACCIÓN</span>
                  </button>
                )}
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
          <div className="text-xs font-sans uppercase tracking-wider text-neutral-400 mb-2 font-medium">
            INICIAR SESIÓN CON GOOGLE (FIREBASE)
          </div>
          <button
            onClick={handleRealFirebaseGoogleSignIn}
            disabled={isConnecting}
            className="w-full py-3.5 bg-neutral-900 border border-white/20 text-white font-semibold text-xs uppercase tracking-wider hover:bg-white hover:text-black transition-colors cursor-pointer flex items-center justify-center gap-2.5 shadow-md rounded-md"
          >
            {googleIconSvg}
            <span>{isConnecting ? 'CONECTANDO CON GOOGLE...' : 'ACCEDER CON CUENTA GOOGLE'}</span>
          </button>
          <p className="text-[11px] font-sans text-neutral-400 text-center mt-2 font-light">
            Al iniciar con la cuenta <strong className="text-neutral-300">blacknewsglobalmedia@gmail.com</strong> se activa automáticamente el rol de Administrador.
          </p>
        </div>

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
              REGISTRO DE USUARIO
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
              * El registro manual siempre crea una cuenta <strong className="text-neutral-400">Lector</strong> sin permisos de edición. El rol de <strong className="text-neutral-400">Administrador</strong> solo se asigna al iniciar sesión con Google desde <strong className="text-neutral-400">blacknewsglobalmedia@gmail.com</strong>.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                className="flex-1 py-2 bg-white text-black font-semibold text-xs uppercase tracking-wider hover:bg-neutral-200 transition-colors cursor-pointer rounded-md"
              >
                INGRESAR / REGISTRAR
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
            <span>CERRAR SESIÓN (MODO LECTOR)</span>
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

