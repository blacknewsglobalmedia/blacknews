import React, { useEffect, useState } from 'react';
import { Share2, Bookmark, ArrowRight, Sparkles, TrendingUp } from 'lucide-react';
import { Report } from '../types/news';
import { OptimizedPicture } from './OptimizedPicture';
import { readTimeOf } from '../utils/readTime';
import { ResumeBadge } from './ResumeBadge';
import { useDecodeText } from '../lib/decode';
import { useAssemble } from '../lib/assemble';
import { TerminalBar, BAR_TOTAL_MS } from './TerminalBar';

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
  // Escritura tipo código (░▒▌) del titular y la bajada: cada uno empieza
  // cuando su pieza recibe `.in` en la cascada del bloque de apertura.
  const asmOn = useAssemble();
  const [booting, setBooting] = useState(
    () => asmOn && !matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const [barDone, setBarDone] = useState(false);
  // Duración real de la escritura del titular (misma fórmula que decode.ts):
  // la bajada espera además ese tiempo, de modo que su escritura comienza
  // cuando el título ya está completo.
  const titleDurMs = Math.min(1400, 450 + report.title.length * 3);
  // El titular espera a que la barra de carga termine (mismo reloj: ambos
  // arrancan al recibir `.in`). Las constantes —nunca condicionales— evitan
  // re-ejecutar el efecto del decode en mitad de la escritura.
  const titleDec = useDecodeText<HTMLHeadingElement>(report.title, {
    startDelayMs: BAR_TOTAL_MS,
  });
  const leadDec = useDecodeText<HTMLParagraphElement>(report.subtitle, {
    startDelayMs: BAR_TOTAL_MS + titleDurMs,
  });
  // Secuencia estricta por estado, no por tiempos: la bajada no existe en
  // pantalla hasta que el titular termina de escribirse (`view === null` tras
  // armarse). Cubre también el apagado del EFECTO y el fallo de seguridad.
  const deckBlocked = booting || (titleDec.armed && titleDec.view !== null);
  // La barra se retira cuando COMPLETE coincide con el turno del titular
  // (`armed`), o al instante si se apaga el EFECTO. La red de seguridad cubre
  // el caso de que el turno nunca llegue: entonces el titular sale plano.
  useEffect(() => {
    if (!booting) return;
    if (!asmOn || (barDone && titleDec.armed)) {
      setBooting(false);
      return;
    }
    const fail = window.setTimeout(() => setBooting(false), 3000);
    return () => clearTimeout(fail);
  }, [booting, asmOn, barDone, titleDec.armed]);
  // Datos reales del artículo para las columnas laterales de la imagen.
  // Cada bloque se oculta si el informe no trae ese dato (nada de muestra).
  const sections = report.sections || [];
  const contextSection = sections.find(
    (s) =>
      (s.type === 'paragraph' || s.type === 'highlight') &&
      (s.text || '').trim().length > 0,
  );
  const statSection = sections.find(
    (s) => s.type === 'stat' && (s.value || '').trim().length > 0,
  );
  const quoteSection = sections.find(
    (s) => s.type === 'quote' && (s.text || '').trim().length > 0,
  );
  const takeaways = report.keyTakeaways || [];
  const hasContext = Boolean(contextSection || statSection);

  return (
    <section className="w-full bg-black pb-12 sm:pb-16 pt-6 sm:pt-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6" data-assemble data-step="150">
        
        {/* Folio Header Line: Elegant & Natural Editorial */}
        <div data-piece className="flex flex-wrap items-center justify-between pb-3 mb-8 text-xs font-sans uppercase tracking-wider text-neutral-400 gap-2 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
            <span className="text-white font-semibold tracking-widest">PRIMERA PLANA · APERTURA EDITORIAL</span>
          </div>
          <div className="flex items-center gap-2.5 text-neutral-400 font-medium">
            <span>{report.author.bureau}</span>
            <span>·</span>
            <span>{report.publishedAt}</span>
            <span>·</span>
            <span className="text-white font-medium">{readTimeOf(report)}</span>
            <ResumeBadge reportId={report.id} />
          </div>
        </div>

        {/* Gran Titular de Portada con Serif Editorial High-End */}
        <div className="relative isolate pb-10 mb-10 text-center flex flex-col items-center">
          {/* Pared LED: malla de puntos fija tras el titular (decorativa). */}
          <span aria-hidden="true" className="bn-led-wall" />
          <div data-piece className="text-xs font-sans uppercase tracking-widest text-neutral-400 mb-3.5 flex items-center justify-center gap-2 font-medium">
            <span className="w-1 h-1 rounded-full bg-neutral-400 inline-block"></span>
            <span>INFORME DE APERTURA GLOBAL</span>
            <span className="w-1 h-1 rounded-full bg-neutral-400 inline-block"></span>
          </div>
          <h1
            data-piece
            ref={titleDec.ref}
            onClick={() => onRead(report)}
            className={`font-headline text-3xl sm:text-5xl md:text-6xl lg:text-[4.2rem] font-normal text-white tracking-tight leading-[1.08] hover:text-neutral-200 transition-colors cursor-pointer text-balance max-w-5xl mx-auto${
              booting ? ' relative' : ''
            }`}
          >
            {booting ? (
              <>
                {/* Reserva el alto final del titular sin mostrar texto: la
                    barra se solapa encima y no hay salto de layout al escribir. */}
                <span aria-hidden="true" className="invisible">
                  {report.title}
                </span>
                <span className="sr-only">{report.title}</span>
                {titleDec.armed && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <TerminalBar
                      run
                      onSettled={() => setBarDone(true)}
                      className="text-xs sm:text-sm"
                    />
                  </span>
                )}
              </>
            ) : titleDec.view ? (
              <>
                <span aria-hidden="true">
                  {titleDec.view.done}
                  <span className="asm-cursor asm-hot font-mono">{titleDec.view.cursor}</span>
                  <span className="asm-hot font-mono">{titleDec.view.active}</span>
                  <span className="text-neutral-700 font-mono">{titleDec.view.quiet}</span>
                </span>
                <span className="sr-only">{report.title}</span>
              </>
            ) : (
              report.title
            )}
          </h1>
          <p
            data-piece
            ref={leadDec.ref}
            className="font-sans text-base sm:text-lg lg:text-xl text-neutral-300 font-light leading-relaxed mt-5 max-w-3xl mx-auto text-balance"
          >
            {deckBlocked ? (
              <>
                {/* Reserva su alto sin mostrar nada (clon invisible): su
                    sombra codificada solo aparece cuando el título termina. */}
                <span aria-hidden="true" className="invisible">
                  {report.subtitle}
                </span>
                <span className="sr-only">{report.subtitle}</span>
              </>
            ) : leadDec.view ? (
              <>
                <span aria-hidden="true">
                  {leadDec.view.done}
                  <span className="asm-cursor asm-hot font-mono">{leadDec.view.cursor}</span>
                  <span className="asm-hot font-mono">{leadDec.view.active}</span>
                  <span className="text-neutral-700 font-mono">{leadDec.view.quiet}</span>
                </span>
                <span className="sr-only">{report.subtitle}</span>
              </>
            ) : (
              report.subtitle
            )}
          </p>
        </div>

        {/* Bloques de Periódico Modernos & Equilibrados */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
          
          {/* Columna Izquierda: Análisis de Contexto */}
          <div className="lg:col-span-3 flex flex-col justify-between space-y-6">
            <div>
              {hasContext && (
                <div className="flex items-center gap-2 text-xs font-sans uppercase tracking-wider text-white font-semibold pb-2 mb-4 border-b border-white/10">
                  <TrendingUp className="w-3.5 h-3.5 text-neutral-300" />
                  <span>CONTEXTO & MERCADOS</span>
                </div>
              )}

              {contextSection && (
                <div className="text-xs sm:text-sm text-neutral-300 leading-relaxed space-y-4 font-sans font-normal">
                  <p>
                    <strong className="text-white font-semibold text-xs tracking-wide mr-1.5 font-sans">
                      {(report.author.bureau || report.author.name || '').split('/')[0].trim()} —
                    </strong>
                    {contextSection.text}
                  </p>
                </div>
              )}

              {/* Cifra destacada: primera sección tipo 'cifra' del artículo */}
              {statSection && (
                <div
                  className={`font-sans ${
                    contextSection
                      ? 'my-6 pt-4 border-t border-white/10'
                      : 'pt-2'
                  }`}
                >
                  {/* Marcador LED: la cifra sobre malla de puntos con halo */}
                  <div className="bn-led-panel rounded-sm border border-white/10 px-4 py-3.5">
                    <div className="relative text-3xl sm:text-4xl font-mono font-light text-white tracking-tight tabular-nums bn-led-glow">
                      {statSection.value}
                    </div>
                    {statSection.label && (
                      <div className="relative text-xs text-neutral-400 mt-1.5 leading-snug">
                        {statSection.label}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div data-piece className="text-xs text-neutral-400 font-sans pt-2">
                <span className="text-white font-medium block text-sm">{report.author.name}</span>
                <span className="text-neutral-500">{report.author.role}</span>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => onRead(report)}
                className="text-xs font-sans font-medium uppercase tracking-wider text-white hover:text-neutral-300 transition-colors flex items-center gap-1.5 cursor-pointer py-2.5 -my-1"
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
                data-piece
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
              </div>
            </div>

            {/* Read CTA button con esquinas sutilmente suavizadas */}
            <div className="pt-4 border-t border-white/10 flex flex-col items-start gap-2.5 sm:flex-row sm:items-center sm:justify-between">
              <button
                onClick={() => onRead(report)}
                className="px-5 py-2.5 bg-white text-black font-semibold text-xs sm:text-sm uppercase tracking-wider rounded-md hover:bg-neutral-200 transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
              >
                <span>LEER INFORME COMPLETO</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <span className="text-xs font-sans text-neutral-400 font-medium tracking-wide hidden sm:inline">
                DESPACHO VERIFICADO
              </span>
            </div>
          </div>

          {/* Columna Derecha: Claves Editoriales & Acciones */}
          <div className="lg:col-span-3 flex flex-col justify-between space-y-6">
            <div>
              {takeaways.length > 0 && (
                <>
                  <div className="flex items-center gap-2 text-xs font-sans uppercase tracking-wider text-white font-semibold pb-2 mb-4 border-b border-white/10">
                    <Sparkles className="w-3.5 h-3.5 text-neutral-300" />
                    <span>CLAVES EDITORIALES</span>
                  </div>

                  {/* Bullet list limpia y legible */}
                  <ul className="space-y-4">
                    {takeaways.map((takeaway, idx) => (
                      <li key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm text-neutral-300 font-sans">
                        <span className="font-mono text-xs font-medium text-neutral-400 mt-0.5 shrink-0 tabular-nums">
                          0{idx + 1}.
                        </span>
                        <span className="leading-relaxed">{takeaway}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {/* Cita destacada: primera sección tipo 'cita' del artículo */}
              {quoteSection && (
                <div
                  className={`${
                    takeaways.length > 0
                      ? 'mt-8 pt-4 border-t border-white/10'
                      : 'pt-2'
                  }`}
                >
                  <div className="font-headline italic text-base sm:text-lg text-neutral-200 leading-relaxed">
                    "{quoteSection.text}"
                  </div>
                  {quoteSection.cite && (
                    <div className="mt-2 text-xs font-sans text-neutral-400 font-medium tracking-wide">
                      — {quoteSection.cite}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Acciones de lectura */}
            <div className="pt-4 border-t border-white/10 flex items-center justify-between">
              <button
                onClick={() => onToggleBookmark(report)}
                className={`flex items-center gap-1.5 text-xs font-sans uppercase tracking-wider py-2.5 px-3 rounded-md border transition-colors cursor-pointer ${
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
                className="flex items-center gap-1.5 text-xs font-sans uppercase tracking-wider py-2.5 px-3 text-neutral-400 hover:text-white transition-colors cursor-pointer"
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
