import React from 'react';
import { Share2, ArrowUp, Scale, ShieldCheck, Mail } from 'lucide-react';
import { CategoryId } from '../types/news';

interface FooterProps {
  categories: readonly CategoryId[];
  onSelectCategory: (cat: CategoryId) => void;
  onShareSite: () => void;
}

export const Footer: React.FC<FooterProps> = ({
  categories,
  onSelectCategory,
  onShareSite,
}) => {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="w-full bg-black text-neutral-400 text-xs sm:text-sm pt-14 pb-12 border-t border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        
        {/* Editorial Core Principles: Minimal, no gray boxes */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-12 mb-12 border-b border-white/5">
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-white font-medium mb-2.5 flex items-center gap-2">
              <Scale className="w-4 h-4 text-white" />
              LIBERTAD ECONÓMICA Y MERCADOS
            </div>
            <p className="text-neutral-400 text-xs sm:text-sm leading-relaxed">
              El libre mercado, la moneda sana, la libre competencia y la ausencia de privilegios corporativos son el catalizador insustituible de la prosperidad humana.
            </p>
          </div>

          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-white font-medium mb-2.5 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-white" />
              PROPIEDAD PRIVADA Y DERECHO A LA VIDA
            </div>
            <p className="text-neutral-400 text-xs sm:text-sm leading-relaxed">
              La inviolabilidad de la persona física, su vida y los frutos de su trabajo configuran el límite infranqueable frente a cualquier poder coactivo o arbitrario.
            </p>
          </div>

          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-white font-medium mb-2.5 flex items-center gap-2">
              <Mail className="w-4 h-4 text-white" />
              REDACCIÓN Y CANAL SEGURO
            </div>
            <p className="text-neutral-400 text-xs sm:text-sm leading-relaxed mb-2">
              Buzón directo para envíos confidenciales y despachos contrastables:
            </p>
            <a
              href="mailto:blacknewsglobalmedia@gmail.com"
              className="text-white hover:text-neutral-300 font-mono text-xs sm:text-sm block transition-colors"
            >
              blacknewsglobalmedia@gmail.com
            </a>
          </div>
        </div>

        {/* Main Footer Navigation & Brand */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 mb-12">
          {/* Brand Column */}
          <div className="md:col-span-4">
            <div className="text-2xl font-medium text-white tracking-tight mb-3 flex items-baseline">
              BLACKNEWS
              <span className="w-1.5 h-1.5 bg-white ml-1 inline-block"></span>
            </div>
            <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed mb-5 max-w-sm">
              Medio digital de análisis económico, geopolítica monetaria, soberanía tecnológica y defensa del estado de derecho.
            </p>
            <button
              onClick={onShareSite}
              className="px-4 py-2 bg-white text-black font-medium text-xs uppercase tracking-wider hover:bg-neutral-200 transition-colors flex items-center gap-2 cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>COMPARTIR MEDIO</span>
            </button>
          </div>

          {/* Categories Links */}
          <div className="md:col-span-5">
            <div className="text-xs font-mono uppercase tracking-wider text-white font-medium mb-4">
              SECCIONES & CUADERNOS
            </div>
            <div className="grid grid-cols-2 gap-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => onSelectCategory(cat)}
                  className="text-left text-xs sm:text-sm text-neutral-400 hover:text-white transition-colors cursor-pointer py-1 font-mono"
                >
                  → {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Legal & Back to top */}
          <div className="md:col-span-3 flex flex-col justify-between">
            <div>
              <div className="text-xs font-mono uppercase tracking-wider text-white font-medium mb-3">
                DIFUSIÓN ABIERTA
              </div>
              <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed mb-3 font-mono">
                Se autoriza la reproducción de extractos con cita a BLACKNEWS y enlace a la fuente original.
              </p>
            </div>

            <button
              onClick={scrollToTop}
              className="self-start text-neutral-400 hover:text-white transition-colors flex items-center gap-2 text-xs font-mono uppercase tracking-wider cursor-pointer mt-4"
            >
              <span>VOLVER ARRIBA</span>
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Bottom copyright */}
        <div className="pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono text-neutral-500">
          <div>
            © 2026 BLACKNEWS. TODOS LOS DERECHOS RESERVADOS.
          </div>
          <div className="flex items-center gap-4">
            <span>SUPER AMOLED BLACK</span>
            <span>·</span>
            <span>LEXEND MEDIUM</span>
            <span>·</span>
            <span>ULTRA MINIMALISTA</span>
          </div>
        </div>

      </div>
    </footer>
  );
};
