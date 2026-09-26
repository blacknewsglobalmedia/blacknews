import React from 'react';
import { Share2, Bookmark, ArrowRight, Sparkles, TrendingUp } from 'lucide-react';
import { Report } from '../types/news';
import { OptimizedPicture } from './OptimizedPicture';

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
        
        {/* Folio Header Line: Elegant & Natural Editorial */}
        <div className="flex flex-wrap items-center justify-between pb-3 mb-8 text-xs font-sans uppercase tracking-wider text-neutral-400 gap-2 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
            <span className="text-white font-semibold tracking-widest">PRIMERA PLANA · APERTURA EDITORIAL</span>
          </div>
          <div className="flex items-center gap-2.5 text-neutral-400 font-medium">
            <span>{report.author.bureau}</span>
            <span>·</span>
            <span>{report.publishedAt}</span>
            <span>·</span>
            <span className="text-white font-medium">{report.readTime}</span>
          </div>
        </div>

        {/* Gran Titular de Portada con Serif Editorial High-End */}
        <div className="pb-10 mb-10 text-center flex flex-col items-center">
          <div className="text-xs font-sans uppercase tracking-widest text-neutral-400 mb-3.5 flex items-center justify-center gap-2 font-medium">
            <span className="w-1 h-1 rounded-full bg-neutral-400 inline-block"></span>
            <span>INFORME DE APERTURA GLOBAL</span>
            <span className="w-1 h-1 rounded-full bg-neutral-400 inline-block"></span>
          </div>
          <h1
            onClick={() => onRead(report)}
            className="font-headline text-3xl sm:text-5xl md:text-6xl lg:text-[4.2rem] font-normal text-white tracking-tight leading-[1.08] hover:text-neutral-200 transition-colors cursor-pointer text-balance max-w-5xl mx-auto"
          >
            {report.title}
          </h1>
          <p className="font-sans text-base sm:text-lg lg:text-xl text-neutral-300 font-light leading-relaxed mt-5 max-w-3xl mx-auto text-balance">
            {report.subtitle}
          </p>
        </div>

        {/* Bloques de Periódico Modernos & Equilibrados */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
          
          {/* Columna Izquierda: Análisis de Contexto */}
          <div className="lg:col-span-3 flex flex-col justify-between space-y-6">
            <div>
              <div className="flex items-center gap-2 text-xs font-sans uppercase tracking-wider text-white font-semibold pb-2 mb-4 border-b border-white/10">
                <TrendingUp className="w-3.5 h-3.5 text-neutral-300" />
                <span>CONTEXTO & MERCADOS</span>
              </div>

              <div className="text-xs sm:text-sm text-neutral-300 leading-relaxed space-y-4 font-sans font-normal">
                <p>
                  <strong className="text-white font-semibold text-xs tracking-wide mr-1.5 font-sans">
                    {report.author.bureau.split('/')[0].trim()} —
                  </strong>
                  Los comités de inversión internacional han dejado de considerar los títulos de deuda con tasas reales negativas como activos libres de riesgo. La evidencia empírica señala que sólo los marcos institucionales con estricta seguridad jurídica retienen el valor acumulado de los ahorradores.
                </p>
              </div>

              {/* Stat callout con números tabulares refinados */}
              <div className="my-6 pt-4 border-t border-white/10">
                <div className="text-3xl sm:text-4xl font-mono font-light text-white tracking-tight tabular-nums">
                  +340%
                </div>
                <div className="text-xs font-sans text-neutral-400 mt-1.5 leading-snug">
                  Crecimiento del flujo de inversión directa hacia jurisdicciones con régimen fiscal predecible y propiedad privada protegida.
                </div>
              </div>

              <div className="text-xs text-neutral-400 font-sans pt-2">
                <span className="text-white font-medium block text-sm">{report.author.name}</span>
                <span className="text-neutral-500">{report.author.role}</span>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => onRead(report)}
                className="text-xs font-sans font-medium uppercase tracking-wider text-white hover:text-neutral-300 transition-colors flex items-center gap-1.5 cursor-pointer py-1"
              >
                <span>LEER ANÁLISIS ECONÓMICO</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Columna Central: Fotografía a Todo Color & Crónica con OptimizedPicture */}
          <div className="lg:col-span-6 flex flex-col justify-between space-y-6">
            <div>
              {/* Imagen Responsiva AVIF/WebP con bordes sutilmente redondeados */}
              <div
                className="w-full aspect-[16/9] rounded-lg overflow-hidden relative cursor-pointer group shadow-2xl"
                onClick={() => onRead(report)}
              >
                <OptimizedPicture
                  image={report.optimizedImage || report.image}
                  alt={report.title}
                  priority={true}
                  aspectRatio="16/9"
                  className="rounded-lg w-full h-full"
                  imgClassName="group-hover:scale-[1.015] transition-transform duration-500 ease-out"
                />
                <div className="absolute top-3 left-3 bg-black/85 backdrop-blur-sm text-white px-2.5 py-1 text-[11px] font-sans font-medium uppercase tracking-wider rounded-md border border-white/15">
                  {report.category}
                </div>
              </div>

              <p className="mt-2.5 text-xs font-sans text-neutral-400 font-normal">
                {report.imageCaption}
              </p>

              {/* Texto principal con drop cap editorial */}
              <div className="mt-6">
                <p className="text-sm sm:text-base text-neutral-200 leading-relaxed font-normal editorial-drop-cap font-sans">
                  {report.lead}
                </p>
                <p className="mt-4 text-xs sm:text-sm text-neutral-400 leading-relaxed font-sans">
                  El comercio voluntario entre particulares y la libre concurrencia en la producción demuestran ser la salvaguarda más efectiva frente a las distorsiones de la planificación central.
                </p>
              </div>
            </div>

            {/* Read CTA button con esquinas sutilmente suavizadas */}
            <div className="pt-4 border-t border-white/10 flex items-center justify-between">
              <button
                onClick={() => onRead(report)}
                className="px-5 py-2.5 bg-white text-black font-semibold text-xs sm:text-sm uppercase tracking-wider rounded-md hover:bg-neutral-200 transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
              >
                <span>LEER INFORME COMPLETO</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <span className="text-xs font-sans text-neutral-400 font-medium tracking-wide">
                DESPACHO VERIFICADO
              </span>
            </div>
          </div>

          {/* Columna Derecha: Claves Editoriales & Acciones */}
          <div className="lg:col-span-3 flex flex-col justify-between space-y-6">
            <div>
              <div className="flex items-center gap-2 text-xs font-sans uppercase tracking-wider text-white font-semibold pb-2 mb-4 border-b border-white/10">
                <Sparkles className="w-3.5 h-3.5 text-neutral-300" />
                <span>CLAVES EDITORIALES</span>
              </div>

              {/* Bullet list limpia y legible */}
              <ul className="space-y-4">
                {report.keyTakeaways.map((takeaway, idx) => (
                  <li key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm text-neutral-300 font-sans">
                    <span className="font-mono text-xs font-medium text-neutral-400 mt-0.5 shrink-0 tabular-nums">
                      0{idx + 1}.
                    </span>
                    <span className="leading-relaxed">{takeaway}</span>
                  </li>
                ))}
              </ul>

              {/* Cita editorial */}
              <div className="mt-8 pt-4 border-t border-white/10">
                <div className="font-headline italic text-base sm:text-lg text-neutral-200 leading-relaxed">
                  "El derecho de propiedad y la libertad de intercambio son la base moral y material de toda civilización libre."
                </div>
                <div className="mt-2 text-xs font-sans text-neutral-400 font-medium tracking-wide">
                  — Archivo Editorial BLACKNEWS
                </div>
              </div>
            </div>

            {/* Acciones de lectura */}
            <div className="pt-4 border-t border-white/10 flex items-center justify-between">
              <button
                onClick={() => onToggleBookmark(report)}
                className={`flex items-center gap-1.5 text-xs font-sans uppercase tracking-wider py-1.5 px-3 rounded-md border transition-colors cursor-pointer ${
                  isBookmarked
                    ? 'bg-white text-black border-white font-semibold'
                    : 'border-white/15 text-neutral-400 hover:text-white hover:border-white'
                }`}
              >
                <Bookmark className="w-3.5 h-3.5" />
                <span>{isBookmarked ? 'GUARDADO' : 'GUARDAR'}</span>
              </button>

              <button
                onClick={() => onShare(report)}
                className="flex items-center gap-1.5 text-xs font-sans uppercase tracking-wider py-1.5 px-3 text-neutral-400 hover:text-white transition-colors cursor-pointer"
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
