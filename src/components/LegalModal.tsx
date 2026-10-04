import React, { useState } from "react";
import {
  X,
  ShieldCheck,
  Scale,
  Cookie,
  FileText,
  Newspaper,
  Copyright,
  Megaphone,
  Gavel,
} from "lucide-react";
import { APP_VERSION, BUILD_STAMP } from "../version";
import {
  LegalTab,
  LegalBlock,
  LEGAL_META,
  LEGAL_TABS_CONTENT,
} from "../data/legalDocs";

export type { LegalTab };

interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: LegalTab;
}

/** Configuración de pestañas (orden del documento oficial). */
const TABS: Array<{ id: LegalTab; label: string; icon: React.ReactNode }> = [
  { id: "terms", label: "Términos y Condiciones", icon: <Scale className="w-3.5 h-3.5" /> },
  { id: "content", label: "Contenidos", icon: <Newspaper className="w-3.5 h-3.5" /> },
  { id: "ip", label: "Propiedad Intelectual", icon: <Copyright className="w-3.5 h-3.5" /> },
  { id: "ads", label: "Publicidad", icon: <Megaphone className="w-3.5 h-3.5" /> },
  { id: "privacy", label: "Privacidad", icon: <ShieldCheck className="w-3.5 h-3.5" /> },
  { id: "claims", label: "Reclamos", icon: <Gavel className="w-3.5 h-3.5" /> },
  { id: "cookies", label: "Cookies", icon: <Cookie className="w-3.5 h-3.5" /> },
];

/** Negritas con markdown ligero (**texto**). */
const renderText = (text: string): React.ReactNode =>
  text.split(/\*\*(.+?)\*\*/g).map((seg, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="text-white font-medium">
        {seg}
      </strong>
    ) : (
      <React.Fragment key={i}>{seg}</React.Fragment>
    ),
  );

const renderBlock = (block: LegalBlock, i: number): React.ReactNode => {
  if (block.h) {
    return (
      <h4
        key={i}
        className="text-[13px] font-bold text-white uppercase tracking-wider pt-3 pb-0.5"
      >
        {block.h}
      </h4>
    );
  }
  if (block.p) {
    return <p key={i}>{renderText(block.p)}</p>;
  }
  if (block.list) {
    return (
      <ul key={i} className="list-disc pl-5 space-y-1 text-neutral-400">
        {block.list.map((item, j) => (
          <li key={j}>{renderText(item)}</li>
        ))}
      </ul>
    );
  }
  if (block.num) {
    return (
      <ol key={i} className="list-decimal pl-5 space-y-1 text-neutral-400">
        {block.num.map((item, j) => (
          <li key={j}>{renderText(item)}</li>
        ))}
      </ol>
    );
  }
  if (block.note) {
    return (
      <div
        key={i}
        className="p-3 bg-neutral-950 border border-white/10 rounded-lg"
      >
        <p className="text-white font-mono text-xs sm:text-sm break-all">
          {block.note}
        </p>
      </div>
    );
  }
  return null;
};

export const LegalModal: React.FC<LegalModalProps> = ({
  isOpen,
  onClose,
  initialTab = "privacy",
}) => {
  const [activeTab, setActiveTab] = useState<LegalTab>(initialTab);

  if (!isOpen) return null;

  const sections =
    activeTab === "cookies" ? null : LEGAL_TABS_CONTENT[activeTab];
  const activeIcon =
    TABS.find((t) => t.id === activeTab)?.icon ?? (
      <FileText className="w-4 h-4 text-emerald-400" />
    );

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
        <div className="flex border-b border-white/10 gap-1 mt-4 shrink-0 overflow-x-auto no-scrollbar">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2.5 px-3 text-xs font-semibold uppercase tracking-wider transition-colors border-b-2 cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                activeTab === tab.id
                  ? "border-white text-white"
                  : "border-transparent text-neutral-400 hover:text-neutral-200"
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto py-6 space-y-5 text-xs sm:text-sm text-neutral-300 font-light leading-relaxed pr-2">
          {/* Encabezado meta del documento */}
          <div className="p-3.5 bg-neutral-950 border border-white/10 rounded-lg grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-1.5 text-xs">
            {LEGAL_META.map((m) => (
              <div key={m.label} className="flex items-baseline gap-2 min-w-0">
                <span className="text-white font-medium shrink-0">
                  {m.label}:
                </span>
                <span className="text-neutral-400 break-all">{m.value}</span>
              </div>
            ))}
          </div>

          {sections ? (
            sections.map((section) => (
              <section
                key={section.title}
                className="space-y-3 pt-4 border-t border-white/5 first:border-t-0 first:pt-0"
              >
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <span className="text-emerald-400">{activeIcon}</span>
                  <span>{section.title}</span>
                </h3>
                {section.blocks.map(renderBlock)}
              </section>
            ))
          ) : (
            /* Pestaña específica del sitio (no forma parte del documento oficial) */
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Cookie className="w-4 h-4 text-amber-400" />
                <span>Declaración de Cookies y Almacenamiento Local</span>
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
          <span>BLACKNEWS LEGAL · v{APP_VERSION} ({BUILD_STAMP})</span>
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
