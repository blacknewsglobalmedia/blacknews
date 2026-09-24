import React from 'react';
import { Share2, Bookmark, ArrowRight, Sparkles, TrendingUp } from 'lucide-react';
import { Report } from '../types/news';

interface LeadStoryProps {
  report: Report;
  onRead: (report: Report) => void;
  onShare: (report: Report) => void;
  isBookmarked: boolean;
  onToggleBookmark: (report: Report) => void;
}

export const LeadStory: React.FC<LeadStoryProps> = ({
  report,
  onRead,
  onShare,
  isBookmarked,
  onToggleBookmark,
}) => {
  return (
    <section className="w-full bg-black pb-12 sm:pb-16 pt-6 sm:pt-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        
        {/* Folio Header Line */}
        <div className="flex flex-wrap items-center justify-between pb-3 mb-6 text-xs font-mono uppercase tracking-wider text-neutral-400 gap-2 border-b border-white/5">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-white"></span>
            <span className="text-white font-medium">PRIMERA PLANA · APERTURA EDITORIAL</span>
          </div>
          <div className="flex items-center gap-3">
            <span>{report.author.bureau}</span>
            <span>·</span>
            <span>{report.publishedAt}</span>
            <span>·</span>
            <span className="text-white font-medium">{report.readTime}</span>
          </div>
        </div>

        {/* Gran Titular Inicial Centrado */}
        <div className="pb-10 mb-10 text-center flex flex-col items-center">
          <div className="text-xs font-mono uppercase tracking-widest text-neutral-400 mb-3 flex items-center justify-center gap-2">
            <span className="w-1 h-1 bg-white inline-block"></span>
            <span>INFORME DE APERTURA GLOBAL</span>
            <span className="w-1 h-1 bg-white inline-block"></span>
          </div>
          <h1
            onClick={() => onRead(report)}
            className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-medium text-white tracking-tight leading-[1.08] hover:text-neutral-300 transition-colors cursor-pointer text-balance max-w-5xl mx-auto"
          >
            {report.title}
          </h1>
          <p className="text-base sm:text-lg lg:text-xl text-neutral-300 font-normal leading-relaxed mt-5 max-w-4xl mx-auto text-balance">
            {report.subtitle}
          </p>
        </div>

        {/* Bloques de Periódico Ultra-Minimalistas (Sin cajas grises, sin marcos gruesos) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
          
          {/* Columna Izquierda: Análisis de Contexto */}
          <div className="lg:col-span-3 flex flex-col justify-between space-y-6">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-white font-medium pb-2 mb-4 border-b border-white/5">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>CONTEXTO & MERCADOS</span>
              </div>

              <div className="text-xs sm:text-sm text-neutral-300 leading-relaxed space-y-4 font-sans">
                <p>
                  <strong className="text-white font-mono uppercase text-xs tracking-wider mr-1">
                    {report.author.bureau.split('/')[0].trim()} —
                  </strong>
                  Los comités de inversión internacional han dejado de considerar los títulos de deuda con tasas reales negativas como activos libres de riesgo. La evidencia empírica señala que sólo los marcos institucionales con estricta seguridad jurídica retienen el valor acumulado de los ahorradores.
                </p>
              </div>

              {/* Stat callout ultra minimalista (sin caja gris, solo tipografía pura) */}
              <div className="my-6 pt-4 border-t border-white/5">
                <div className="text-3xl sm:text-4xl font-mono font-medium text-white tracking-tight">
                  +340%
                </div>
                <div className="text-xs text-neutral-400 mt-1.5 leading-snug">
                  Crecimiento del flujo de inversión directa hacia jurisdicciones con régimen fiscal predecible y propiedad privada protegida.
                </div>
              </div>

              <div className="text-xs text-neutral-400 font-mono pt-2">
                <span className="text-white font-medium block">{report.author.name}</span>
                <span>{report.author.role}</span>
              </div>
            </div>

            <div className="pt-4">
              <button
                onClick={() => onRead(report)}
                className="text-xs font-medium uppercase tracking-wider text-white hover:text-neutral-300 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span>LEER ANÁLISIS ECONÓMICO</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Columna Central: Fotografía a Todo Color & Crónica */}
          <div className="lg:col-span-6 flex flex-col justify-between space-y-6">
            <div>
              {/* Imagen sin bordes recargados */}
              <div
                className="w-full aspect-[16/9] bg-neutral-950 overflow-hidden relative cursor-pointer group"
                onClick={() => onRead(report)}
              >
                <img
                  src={report.image}
                  alt={report.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-[1.012] transition-transform duration-500 ease-out"
                />
                <div className="absolute top-2.5 left-2.5 bg-black/90 text-white px-2.5 py-1 text-xs font-mono uppercase tracking-wider">
                  {report.category}
                </div>
              </div>

              <p className="mt-2 text-xs font-mono text-neutral-400">
                {report.imageCaption}
              </p>

              {/* Texto principal */}
              <div className="mt-6">
                <p className="text-sm sm:text-base text-neutral-200 leading-relaxed font-normal editorial-drop-cap">
                  {report.lead}
                </p>
                <p className="mt-4 text-xs sm:text-sm text-neutral-400 leading-relaxed">
                  El comercio voluntario entre particulares y la libre concurrencia en la producción demuestran ser la salvaguarda más efectiva frente a las distorsiones de la planificación central.
                </p>
              </div>
            </div>

            {/* Read CTA button minimalista */}
            <div className="pt-4 border-t border-white/5 flex items-center justify-between">
              <button
                onClick={() => onRead(report)}
                className="px-5 py-2.5 bg-white text-black font-medium text-xs sm:text-sm uppercase tracking-wider hover:bg-neutral-200 transition-colors flex items-center gap-2 cursor-pointer"
              >
                <span>LEER INFORME COMPLETO</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <span className="text-xs font-mono text-neutral-400">
                DESPACHO VERIFICADO
              </span>
            </div>
          </div>

          {/* Columna Derecha: Claves Editoriales & Acciones */}
          <div className="lg:col-span-3 flex flex-col justify-between space-y-6">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-white font-medium pb-2 mb-4 border-b border-white/5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>CLAVES EDITORIALES</span>
              </div>

              {/* Bullet list sin marcos */}
              <ul className="space-y-4">
                {report.keyTakeaways.map((takeaway, idx) => (
                  <li key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm text-neutral-300">
                    <span className="font-mono text-xs font-semibold text-white mt-0.5 shrink-0">
                      0{idx + 1}.
                    </span>
                    <span className="leading-relaxed">{takeaway}</span>
                  </li>
                ))}
              </ul>

              {/* Quote sutil sin fondos grises */}
              <div className="mt-8 pt-4 border-t border-white/5">
                <div className="text-xs sm:text-sm italic text-neutral-300 leading-relaxed">
                  "El derecho de propiedad y la libertad de intercambio son la base moral y material de toda civilización libre."
                </div>
                <div className="mt-2 text-xs font-mono text-neutral-400 uppercase">
                  — Archivo Editorial BLACKNEWS
                </div>
              </div>
            </div>

            {/* Acciones */}
            <div className="pt-4 border-t border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onToggleBookmark(report)}
                  className={`p-2 transition-colors cursor-pointer ${
                    isBookmarked
                      ? 'bg-white text-black'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                  title={isBookmarked ? 'Guardado en lecturas' : 'Guardar informe'}
                  aria-label="Guardar informe"
                >
                  <Bookmark className="w-4 h-4" />
                </button>
                <span className="text-xs font-mono text-neutral-400">
                  {isBookmarked ? 'GUARDADO' : 'GUARDAR'}
                </span>
              </div>

              <button
                onClick={() => onShare(report)}
                className="px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-neutral-300 hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer"
                title="Compartir informe en redes"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>COMPARTIR</span>
              </button>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
};
