import React, { useState } from "react";
import { X, ShieldCheck, Scale, Cookie, FileText } from "lucide-react";

export type LegalTab = "terms" | "privacy" | "cookies";

interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: LegalTab;
}

export const LegalModal: React.FC<LegalModalProps> = ({
  isOpen,
  onClose,
  initialTab = "privacy",
}) => {
  const [activeTab, setActiveTab] = useState<LegalTab>(initialTab);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 animate-in fade-in duration-150 font-sans">
      <div className="w-full max-w-2xl bg-black border border-white/10 p-6 sm:p-8 shadow-2xl relative max-h-[85vh] flex flex-col rounded-xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <h2 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-white">
              POLÍTICAS Y NORMATIVA LEGAL · BLACKNEWS
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

        {/* Navigation Tabs */}
        <div className="flex border-b border-white/10 gap-2 mt-4 shrink-0 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab("privacy")}
            className={`py-2.5 px-4 text-xs font-semibold uppercase tracking-wider transition-colors border-b-2 cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === "privacy"
                ? "border-white text-white"
                : "border-transparent text-neutral-400 hover:text-neutral-200"
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Políticas de Privacidad</span>
          </button>

          <button
            onClick={() => setActiveTab("terms")}
            className={`py-2.5 px-4 text-xs font-semibold uppercase tracking-wider transition-colors border-b-2 cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === "terms"
                ? "border-white text-white"
                : "border-transparent text-neutral-400 hover:text-neutral-200"
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            <span>Términos y Condiciones</span>
          </button>

          <button
            onClick={() => setActiveTab("cookies")}
            className={`py-2.5 px-4 text-xs font-semibold uppercase tracking-wider transition-colors border-b-2 cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === "cookies"
                ? "border-white text-white"
                : "border-transparent text-neutral-400 hover:text-neutral-200"
            }`}
          >
            <Cookie className="w-3.5 h-3.5" />
            <span>Política de Cookies</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto py-6 space-y-4 text-xs sm:text-sm text-neutral-300 font-light leading-relaxed pr-2">
          {activeTab === "privacy" && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-400" />
                <span>1. Protección de Datos y Privacidad de Usuarios</span>
              </h3>
              <p>
                En <strong className="text-white font-medium">BLACKNEWS</strong>{" "}
                asumimos un compromiso absoluto con la privacidad, la
                certidumbre jurídica y la protección de los datos de nuestros
                lectores y miembros del equipo editorial.
              </p>
              <div className="p-3.5 bg-neutral-950 border border-white/10 rounded-lg space-y-2 text-xs">
                <p className="font-medium text-white">
                  ● Cero rastreo invasivo:
                </p>
                <p className="text-neutral-400">
                  No comercializamos, cedemos ni compartimos datos personales
                  con redes de publicidad ni intermediarios de análisis masivo.
                </p>
                <p className="font-medium text-white pt-2">
                  ● Autenticación Segura (Firebase Google Auth):
                </p>
                <p className="text-neutral-400">
                  El inicio de sesión mediante Google utiliza protocolos de
                  seguridad cifrados (OAuth 2.0 y JWT) gestionados directamente
                  por Firebase Identity. Unicamente almacenamos tu correo y
                  nombre para la asignación de roles editoriales.
                </p>
              </div>
              <p className="text-xs text-neutral-400 font-mono">
                Última revisión: Octubre 2026 · Cumplimiento de estándares RGPD
                / Ley de Protección de Datos.
              </p>
            </div>
          )}

          {activeTab === "terms" && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Scale className="w-4 h-4 text-white" />
                <span>2. Términos de Uso y Certidumbre Jurídica</span>
              </h3>
              <p>
                Los contenidos analíticos, despachos informativos e informes
                publicados en{" "}
                <strong className="text-white font-medium">BLACKNEWS</strong>{" "}
                defienden rigurosamente la libertad de expresión, la economía de
                mercado y el estado de derecho.
              </p>
              <div className="p-3.5 bg-neutral-950 border border-white/10 rounded-lg space-y-2 text-xs">
                <p className="font-medium text-white">
                  ● Licencia de Difusión Abierta:
                </p>
                <p className="text-neutral-400">
                  Se autoriza la reproducción libre de extractos y citas citando
                  explícitamente a BLACKNEWS e incluyendo enlace a la
                  publicación original.
                </p>
                <p className="font-medium text-white pt-2">
                  ● Reserva de Responsabilidad Editorial:
                </p>
                <p className="text-neutral-400">
                  Los informes y artículos de opinión reflejan el análisis
                  técnico de sus autores y no constituyen asesoramiento
                  financiero ni recomendaciones de inversión individualizadas.
                </p>
              </div>
            </div>
          )}

          {activeTab === "cookies" && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Cookie className="w-4 h-4 text-amber-400" />
                <span>3. Declaración de Cookies y Almacenamiento Local</span>
              </h3>
              <p>
                Este sitio web utiliza únicamente almacenadores esenciales
                locales en el navegador del usuario (
                <code className="text-amber-400 font-mono bg-amber-950/40 px-1 py-0.5 rounded">
                  localStorage
                </code>
                ) para mantener la sesión de usuario activa y guardar lecturas
                marcadas.
              </p>
              <div className="p-3.5 bg-neutral-950 border border-white/10 rounded-lg space-y-2 text-xs">
                <p className="font-medium text-white">
                  ● Cookies Estrictamente Necesarias:
                </p>
                <ul className="list-disc pl-4 space-y-1 text-neutral-400">
                  <li>
                    <strong className="text-white">
                      blacknews_active_user
                    </strong>
                    : Mantiene tu sesión de lectura / redactor abierta al pulsar
                    F5.
                  </li>
                  <li>
                    <strong className="text-white">blacknews_bookmarks</strong>:
                    Guarda tus artículos y lecturas destacadas.
                  </li>
                  <li>
                    <strong className="text-white">Firebase Auth Tokens</strong>
                    : Autenticación segura para miembros autorizados.
                  </li>
                </ul>
              </div>
              <p className="text-xs text-neutral-400">
                No se instalan cookies de rastreo publicitario de terceros.
                Puedes limpiar estos datos en cualquier momento borrando el
                historial de tu navegador.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-white/10 flex items-center justify-between shrink-0 text-xs font-mono text-neutral-400">
          <span>BLACKNEWS LEGAL · v2.4.0</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white text-black font-semibold uppercase tracking-wider text-xs rounded-md hover:bg-neutral-200 transition-colors cursor-pointer"
          >
            ENTENDIDO
          </button>
        </div>
      </div>
    </div>
  );
};
