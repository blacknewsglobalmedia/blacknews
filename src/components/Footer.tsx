import React from "react";
import {
  Share2,
  ArrowUp,
  Scale,
  ShieldCheck,
  Mail,
  Megaphone,
} from "lucide-react";
import { CategoryId } from "../types/news";
import { APP_VERSION, BUILD_STAMP_LABEL } from "../version";
import { scrollToTop } from "../utils/scroll";

interface FooterProps {
  categories: readonly CategoryId[];
  onSelectCategory: (cat: CategoryId) => void;
  onShareSite: () => void;
  onOpenAdModal?: () => void;
  /** Abre la página de políticas completa (§1-§10) en la sección indicada. */
  onOpenPolicies?: (section?: number) => void;
}

export const Footer: React.FC<FooterProps> = ({
  categories,
  onSelectCategory,
  onShareSite,
  onOpenAdModal,
  onOpenPolicies,
}) => {
  return (
    <>
      <footer className="w-full bg-black text-neutral-400 text-xs sm:text-sm pt-14 pb-24 border-t border-white/10 font-['Lexend',sans-serif]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          {/* Editorial Core Principles */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-12 mb-12 border-b border-white/10">
            <div>
              <div className="text-xs font-sans uppercase tracking-wider text-white font-semibold mb-2.5 flex items-center gap-2">
                <Scale className="w-4 h-4 text-neutral-300" />
                ANÁLISIS MACROECONÓMICO E INDEPENDENCIA
              </div>
              <p className="text-neutral-400 text-xs sm:text-sm leading-relaxed font-light">
                Investigación periodística rigurosa, modelos cuantitativos y
                datos de primera mano sobre mercados globales sin sesgos
                partidarios ni presiones corporativas.
              </p>
            </div>

            <div>
              <div className="text-xs font-sans uppercase tracking-wider text-white font-semibold mb-2.5 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-neutral-300" />
                INTELIGENCIA GEOPOLÍTICA Y TECNOLOGÍA
              </div>
              <p className="text-neutral-400 text-xs sm:text-sm leading-relaxed font-light">
                Seguimiento continuo de la geopolítica de materias primas,
                tendencias monetarias internacionales, soberanía digital e
                innovación tecnológica de frontera.
              </p>
            </div>

            <div>
              <div className="text-xs font-sans uppercase tracking-wider text-white font-semibold mb-2.5 flex items-center gap-2">
                <Mail className="w-4 h-4 text-neutral-300" />
                REDACCIÓN Y CANAL SEGURO
              </div>
              <p className="text-neutral-400 text-xs sm:text-sm leading-relaxed mb-2 font-light">
                Buzón directo para envíos confidenciales y despachos
                contrastables:
              </p>
              <a
                href="mailto:blacknewsglobalmedia@gmail.com"
                className="text-white hover:text-neutral-300 text-xs sm:text-sm block transition-colors font-medium py-1.5 -my-1"
              >
                blacknewsglobalmedia@gmail.com
              </a>
            </div>
          </div>

          {/* Main Footer Navigation & Brand */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 mb-12">
            {/* Brand Column */}
            <div className="md:col-span-4">
              <div className="font-headline text-2xl sm:text-3xl font-semibold text-white tracking-tight mb-3 flex items-baseline">
                BLACKNEWS
                <span className="w-1.5 h-1.5 rounded-full bg-white ml-1 inline-block"></span>
              </div>
              <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed mb-5 max-w-sm font-light">
                Medio internacional de análisis económico profundo, geopolítica
                monetaria, soberanía tecnológica y rigor periodístico.
              </p>
              <button
                onClick={onShareSite}
                className="px-4 py-2.5 bg-white text-black font-semibold text-xs uppercase tracking-wider rounded-md hover:bg-neutral-200 transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>COMPARTIR MEDIO</span>
              </button>

              {onOpenAdModal && (
                <button
                  onClick={onOpenAdModal}
                  className="mt-3 px-4 py-2.5 border border-white/20 text-white hover:bg-white/10 font-semibold text-xs uppercase tracking-wider rounded-md transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <Megaphone className="w-3.5 h-3.5 text-amber-400" />
                  <span>ANUNCIAR EN BLACKNEWS</span>
                </button>
              )}
            </div>

            {/* Categories Links */}
            <div className="md:col-span-5">
              <div className="text-xs font-sans uppercase tracking-wider text-white font-semibold mb-4">
                SECCIONES & CUADERNOS
              </div>
              <div className="grid grid-cols-2 gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => onSelectCategory(cat)}
                    className="text-left text-xs sm:text-sm text-neutral-400 hover:text-white transition-colors cursor-pointer py-2 font-sans"
                  >
                    → {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Legal & Back to top */}
            <div className="md:col-span-3 flex flex-col justify-between">
              <div>
                <div className="text-xs font-sans uppercase tracking-wider text-white font-semibold mb-3">
                  DIFUSIÓN ABIERTA
                </div>
                <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed mb-3 font-light">
                  Se autoriza la reproducción de extractos con cita a BLACKNEWS
                  y enlace a la fuente original.
                </p>
              </div>

              <button
                onClick={scrollToTop}
                className="self-start text-neutral-400 hover:text-white transition-colors flex items-center gap-2 text-xs font-sans font-semibold uppercase tracking-wider cursor-pointer mt-4 py-2.5 -my-1"
              >
                <span>VOLVER ARRIBA</span>
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Bottom copyright & Legal links */}
          <div className="pt-6 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4 text-xs font-sans text-neutral-400 font-light">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-neutral-300">
                BLACKNEWS v{APP_VERSION} · {BUILD_STAMP_LABEL}
              </span>
              <span>·</span>
              <span>© 2026 TODOS LOS DERECHOS RESERVADOS</span>
            </div>

            <div className="flex items-center flex-wrap justify-center gap-3 sm:gap-4 text-neutral-400 font-medium">
              <button
                onClick={() => onOpenPolicies?.(5)}
                className="hover:text-white transition-colors cursor-pointer py-2 px-1 -my-1"
              >
                Políticas de Privacidad
              </button>
              <span>·</span>
              <button
                onClick={() => onOpenPolicies?.(1)}
                className="hover:text-white transition-colors cursor-pointer py-2 px-1 -my-1"
              >
                Términos y Condiciones
              </button>
              <span>·</span>
              <button
                onClick={() => onOpenPolicies?.(10)}
                className="hover:text-white transition-colors cursor-pointer py-2 px-1 -my-1"
              >
                Política de Cookies
              </button>
              <span>·</span>
              <button
                onClick={() => onOpenPolicies?.()}
                className="hover:text-white transition-colors cursor-pointer py-2 px-1 -my-1"
              >
                Todas las Políticas
              </button>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
};
