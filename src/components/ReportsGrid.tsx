import React from 'react';
import { Share2, Bookmark, ArrowUpRight, Newspaper } from 'lucide-react';
import { Report, CategoryId } from '../types/news';
import { OptimizedPicture } from './OptimizedPicture';

interface ReportsGridProps {
  reports: Report[];
  categories: readonly CategoryId[];
  selectedCategory: CategoryId;
  onSelectCategory: (cat: CategoryId) => void;
  onReadReport: (report: Report) => void;
  onShareReport: (report: Report) => void;
  bookmarkedIds: Set<string>;
  onToggleBookmark: (report: Report) => void;
  configuredBlock1?: Report[];
  configuredBlock2?: Report[];
  configuredDossier?: Report;
}

export const ReportsGrid: React.FC<ReportsGridProps> = ({
  reports,
  categories,
  selectedCategory,
  onSelectCategory,
  onReadReport,
  onShareReport,
  bookmarkedIds,
  onToggleBookmark,
  configuredBlock1,
  configuredBlock2,
  configuredDossier,
}) => {
  const getCity = (bureau: string) => {
    return bureau.split('/')[0].trim().toUpperCase();
  };

  const isAll = selectedCategory === 'TODAS';
  const block1Items = isAll && configuredBlock1 && configuredBlock1.length > 0
    ? configuredBlock1
    : reports.slice(0, 2);

  const block2Items = isAll && configuredBlock2 && configuredBlock2.length > 0
    ? configuredBlock2
    : reports.slice(2, 5);

  // Extra reports not in lead/block1/block2
  const displayedIds = new Set([
    ...block1Items.map((r) => r.id),
    ...block2Items.map((r) => r.id),
    ...(configuredDossier ? [configuredDossier.id] : []),
  ]);
  const additionalReports = isAll ? reports.filter((r) => !displayedIds.has(r.id)) : [];

  return (
    <section className="w-full bg-black py-10 sm:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        
        {/* Newspaper Section Ribbon & Category Selector */}
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 mb-10 gap-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <Newspaper className="w-4 h-4 text-white" />
            <h2 className="font-sans text-base sm:text-lg font-semibold text-white tracking-wide uppercase">
              {selectedCategory === 'TODAS'
                ? 'SECCIONES & CUADERNOS DE REDACCIÓN'
                : `CUADERNO: ${selectedCategory}`}
            </h2>
          </div>

          {/* Minimal Category Selector: purely typographical with pill-less design */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
            {categories.map((cat) => {
              const active = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => onSelectCategory(cat)}
                  className={`px-3 py-1.5 text-xs font-sans font-medium uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap rounded-md ${
                    active
                      ? 'text-white bg-white/10 font-semibold'
                      : 'text-neutral-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* Empty state */}
        {reports.length === 0 ? (
          <div className="py-20 text-center p-8">
            <p className="text-sm font-sans text-neutral-400">
              No hay despachos registrados en esta sección para la edición actual.
            </p>
            <button
              onClick={() => onSelectCategory('TODAS')}
              className="mt-4 px-4 py-2 text-xs font-sans font-semibold bg-white text-black uppercase rounded-md cursor-pointer hover:bg-neutral-200 transition-colors"
            >
              VOLVER A TODAS LAS SECCIONES
            </button>
          </div>
        ) : (
          /* Newspaper Broadsheet Modular Blocks (Ultra-Minimalist & Borderless) */
          <div className="space-y-16">
            
            {/* BLOQUE I: GRANDES DESPACHOS EN 2 COLUMNAS ABIERTAS */}
            {block1Items.length > 0 && (
              <div>
                <div className="flex items-center justify-between pb-3 mb-8 border-b border-white/10">
                  <span className="text-xs font-sans uppercase tracking-widest text-neutral-400 font-semibold">
                    BLOQUE I · DESPACHOS DE FONDO & ESTADO DE DERECHO
                  </span>
                  <span className="text-xs font-sans text-neutral-500 font-medium">
                    VERIFICACIÓN DIRECTA
                  </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14">
                  {block1Items.map((report) => {
                    const isBookmarked = bookmarkedIds.has(report.id);
                    const city = getCity(report.author.bureau);

                    return (
                      <article
                        key={report.id}
                        className="flex flex-col justify-between group"
                      >
                        <div>
                          {/* Image in FULL COLOR with OptimizedPicture */}
                          <div
                            className="w-full aspect-[16/9] rounded-lg overflow-hidden relative cursor-pointer mb-5 shadow-lg"
                            onClick={() => onReadReport(report)}
                          >
                            <OptimizedPicture
                              image={report.optimizedImage || report.image}
                              alt={report.title}
                              priority={false}
                              aspectRatio="16/9"
                              className="w-full h-full rounded-lg"
                              imgClassName="group-hover:scale-[1.015] transition-transform duration-500 ease-out"
                            />
                            <div className="absolute top-2.5 left-2.5 bg-black/85 backdrop-blur-sm text-white px-2.5 py-1 text-[11px] font-sans font-medium uppercase tracking-wider rounded-md border border-white/15">
                              {report.category}
                            </div>
                          </div>

                          {/* Metadata */}
                          <div className="flex items-center gap-2 text-xs font-sans text-neutral-400 font-medium mb-2.5">
                            <span>{report.publishedAt}</span>
                            <span>·</span>
                            <span>{report.readTime}</span>
                          </div>

                          {/* Title with Editorial Serif */}
                          <h3
                            onClick={() => onReadReport(report)}
                            className="font-headline text-2xl sm:text-[1.7rem] font-normal text-white tracking-tight leading-snug hover:text-neutral-200 transition-colors cursor-pointer mb-3"
                          >
                            {report.title}
                          </h3>

                          {/* Summary with dateline */}
                          <p className="font-sans text-xs sm:text-sm text-neutral-300 leading-relaxed font-light mb-4">
                            <strong className="text-white font-sans font-semibold text-xs mr-1.5 tracking-wide">
                              {city} —
                            </strong>
                            {report.subtitle}
                          </p>
                        </div>

                        {/* Author & Action Bar */}
                        <div className="pt-4 mt-4 border-t border-white/10 flex items-center justify-between">
                          <div className="text-xs font-sans text-neutral-400">
                            <span className="text-white font-medium block text-sm">{report.author.name}</span>
                            <span className="text-neutral-500">{report.author.bureau}</span>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => onToggleBookmark(report)}
                              className={`p-2 rounded-md transition-colors cursor-pointer ${
                                isBookmarked
                                  ? 'text-white bg-white/10'
                                  : 'text-neutral-400 hover:text-white hover:bg-white/5'
                              }`}
                              title={isBookmarked ? 'Guardado' : 'Guardar informe'}
                              aria-label="Guardar informe"
                            >
                              <Bookmark className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => onShareReport(report)}
                              className="text-xs font-sans font-medium uppercase tracking-wider text-neutral-400 hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer py-1 px-2.5 rounded-md hover:bg-white/5"
                            >
                              <Share2 className="w-3.5 h-3.5" />
                              <span>COMPARTIR</span>
                            </button>

                            <button
                              onClick={() => onReadReport(report)}
                              className="p-2 rounded-md text-neutral-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                              title="Leer informe completo"
                              aria-label="Leer informe"
                            >
                              <ArrowUpRight className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            )}

            {/* BLOQUE II: COLUMNAS EN 3 COLUMNAS ABIERTAS */}
            {block2Items.length > 0 && (
              <div>
                <div className="flex items-center justify-between pb-3 mb-8 border-b border-white/10">
                  <span className="text-xs font-sans uppercase tracking-widest text-neutral-400 font-semibold">
                    BLOQUE II · INFRAESTRUCTURA, INNOVACIÓN Y MERCADOS DE CAPITAL
                  </span>
                  <span className="text-xs font-sans text-neutral-500 font-medium">
                    EDICIÓN DIARIA
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 sm:gap-10">
                  {block2Items.map((report) => {
                    const isBookmarked = bookmarkedIds.has(report.id);
                    const city = getCity(report.author.bureau);

                    return (
                      <article
                        key={report.id}
                        className="flex flex-col justify-between group"
                      >
                        <div>
                          {/* Image with OptimizedPicture */}
                          <div
                            className="w-full aspect-[16/9] rounded-lg overflow-hidden relative cursor-pointer mb-4 shadow-sm"
                            onClick={() => onReadReport(report)}
                          >
                            <OptimizedPicture
                              image={report.optimizedImage || report.image}
                              alt={report.title}
                              priority={false}
                              aspectRatio="16/9"
                              className="w-full h-full rounded-lg"
                              imgClassName="group-hover:scale-[1.015] transition-transform duration-500 ease-out"
                            />
                            <div className="absolute top-2 left-2 bg-black/85 backdrop-blur-sm text-white px-2 py-0.5 text-[10px] font-sans font-medium uppercase tracking-wider rounded-md border border-white/15">
                              {report.category}
                            </div>
                          </div>

                          {/* Metadata */}
                          <div className="text-xs font-sans text-neutral-400 font-medium mb-2">
                            {report.readTime} · {report.publishedAt}
                          </div>

                          {/* Title with Editorial Serif */}
                          <h3
                            onClick={() => onReadReport(report)}
                            className="font-headline text-lg sm:text-[1.28rem] font-normal text-white tracking-tight leading-snug hover:text-neutral-200 transition-colors cursor-pointer mb-2"
                          >
                            {report.title}
                          </h3>

                          {/* Summary */}
                          <p className="font-sans text-xs sm:text-sm text-neutral-300 line-clamp-3 leading-relaxed font-light mb-4">
                            <strong className="text-white font-sans font-semibold text-xs mr-1.5 tracking-wide">
                              {city} —
                            </strong>
                            {report.subtitle}
                          </p>
                        </div>

                        {/* Footer */}
                        <div className="pt-3 border-t border-white/10 flex items-center justify-between mt-auto">
                          <div className="text-xs font-sans text-neutral-400 truncate max-w-[140px]">
                            <span className="text-white block truncate font-medium">{report.author.name}</span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => onToggleBookmark(report)}
                              className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                                isBookmarked
                                  ? 'text-white bg-white/10'
                                  : 'text-neutral-400 hover:text-white hover:bg-white/5'
                              }`}
                              title={isBookmarked ? 'Guardado' : 'Guardar'}
                              aria-label="Guardar"
                            >
                              <Bookmark className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => onShareReport(report)}
                              className="text-xs font-sans font-medium uppercase tracking-wider text-neutral-400 hover:text-white transition-colors flex items-center gap-1 cursor-pointer py-1 px-2 rounded-md hover:bg-white/5"
                              title="Compartir en redes sociales"
                            >
                              <Share2 className="w-3 h-3" />
                              <span className="hidden xl:inline">COMPARTIR</span>
                            </button>

                            <button
                              onClick={() => onReadReport(report)}
                              className="p-1.5 rounded-md text-neutral-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                              title="Leer informe"
                              aria-label="Leer informe"
                            >
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            )}

            {/* BLOQUE III: DOSSIER DESTACADO */}
            <div className="pt-10 border-t border-white/10">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-neutral-950/60 border border-white/10 rounded-xl p-6 sm:p-8">
                <div className="max-w-3xl">
                  <div className="text-xs font-sans uppercase tracking-widest text-neutral-400 mb-2 font-semibold">
                    DOSSIER EDITORIAL DESTACADO · {configuredDossier ? configuredDossier.category : 'SOBERANÍA Y PROPIEDAD'}
                  </div>
                  <h3 
                    onClick={() => configuredDossier && onReadReport(configuredDossier)}
                    className="font-headline text-2xl sm:text-3xl font-normal text-white tracking-tight leading-snug mb-2.5 hover:text-neutral-200 transition-colors cursor-pointer"
                  >
                    {configuredDossier 
                      ? configuredDossier.title 
                      : 'La defensa irrestricta de la iniciativa privada frente al intervencionismo estatal'}
                  </h3>
                  <p className="font-sans text-xs sm:text-sm text-neutral-300 leading-relaxed font-light">
                    {configuredDossier 
                      ? configuredDossier.subtitle 
                      : 'Nuestra redacción audita continuamente las políticas públicas y su impacto sobre el cálculo económico, la inflación, la seguridad jurídica y los derechos inalienables de los ciudadanos.'}
                  </p>
                </div>

                <div className="shrink-0 flex items-center gap-3">
                  {configuredDossier && (
                    <button
                      onClick={() => onReadReport(configuredDossier)}
                      className="px-5 py-2.5 bg-white text-black font-semibold text-xs uppercase tracking-wider rounded-md hover:bg-neutral-200 transition-colors cursor-pointer shadow-sm"
                    >
                      LEER ESTE DOSSIER
                    </button>
                  )}
                  <button
                    onClick={() => onSelectCategory('DOSSIERS')}
                    className="px-4 py-2.5 border border-white/20 text-neutral-200 hover:text-white font-medium text-xs uppercase tracking-wider rounded-md hover:border-white transition-colors cursor-pointer"
                  >
                    EXPLORAR TODOS
                  </button>
                </div>
              </div>
            </div>

            {/* ADDITIONAL REPORTS IF ANY */}
            {additionalReports.length > 0 && (
              <div className="pt-10 border-t border-white/10">
                <div className="flex items-center justify-between pb-3 mb-6 border-b border-white/10">
                  <span className="text-xs font-sans uppercase tracking-widest text-neutral-400 font-semibold">
                    DESPACHOS ADICIONALES DE LA EDICIÓN
                  </span>
                  <span className="text-xs font-sans text-neutral-500 font-medium">
                    ARCHIVO RECIENTE
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {additionalReports.map((report) => (
                    <div 
                      key={report.id} 
                      onClick={() => onReadReport(report)}
                      className="p-5 border border-white/10 rounded-lg hover:border-white/30 hover:bg-white/[0.02] transition-colors cursor-pointer group flex flex-col justify-between"
                    >
                      <div>
                        <div className="text-xs font-sans text-neutral-400 font-medium mb-1.5">
                          {report.category} · {report.readTime}
                        </div>
                        <h4 className="font-headline text-base font-normal text-white group-hover:text-neutral-200 transition-colors line-clamp-2 leading-snug">
                          {report.title}
                        </h4>
                      </div>
                      <div className="mt-4 text-xs font-sans text-neutral-400 flex items-center justify-between">
                        <span>{report.author.name}</span>
                        <ArrowUpRight className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}

      </div>
    </section>
  );
};
