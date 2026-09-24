import React from 'react';
import { Share2, Bookmark, ArrowUpRight, Newspaper } from 'lucide-react';
import { Report, CategoryId } from '../types/news';

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
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 mb-10 gap-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Newspaper className="w-4 h-4 text-white" />
            <h2 className="text-lg sm:text-xl font-medium text-white tracking-tight uppercase">
              {selectedCategory === 'TODAS'
                ? 'SECCIONES & CUADERNOS DE REDACCIÓN'
                : `CUADERNO: ${selectedCategory}`}
            </h2>
          </div>

          {/* Minimal Category Selector: purely typographical */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            {categories.map((cat) => {
              const active = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => onSelectCategory(cat)}
                  className={`px-3 py-1 text-xs font-medium uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap ${
                    active
                      ? 'text-white border-b border-white pb-0.5'
                      : 'text-neutral-500 hover:text-white'
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
            <p className="text-sm font-mono text-neutral-400 uppercase tracking-wider">
              No hay despachos registrados en esta sección para la edición actual.
            </p>
            <button
              onClick={() => onSelectCategory('TODAS')}
              className="mt-4 px-4 py-2 text-xs font-medium bg-white text-black uppercase cursor-pointer hover:bg-neutral-200 transition-colors"
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
                <div className="flex items-center justify-between pb-3 mb-8 border-b border-white/5">
                  <span className="text-xs font-mono uppercase tracking-widest text-neutral-400">
                    BLOQUE I · DESPACHOS DE FONDO & ESTADO DE DERECHO
                  </span>
                  <span className="text-xs font-mono text-neutral-500">
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
                          {/* Image in FULL COLOR without heavy frames */}
                          <div
                            className="w-full aspect-[16/9] bg-neutral-950 overflow-hidden relative cursor-pointer mb-5"
                            onClick={() => onReadReport(report)}
                          >
                            <img
                              src={report.image}
                              alt={report.title}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover group-hover:scale-[1.012] transition-transform duration-500 ease-out"
                              loading="lazy"
                            />
                            <div className="absolute top-2.5 left-2.5 bg-black/90 text-white px-2.5 py-1 text-xs font-mono uppercase tracking-wider">
                              {report.category}
                            </div>
                          </div>

                          {/* Metadata */}
                          <div className="flex items-center gap-2 text-xs font-mono tracking-wider text-neutral-400 uppercase mb-2">
                            <span>{report.publishedAt}</span>
                            <span>·</span>
                            <span>{report.readTime}</span>
                          </div>

                          {/* Title in font-medium */}
                          <h3
                            onClick={() => onReadReport(report)}
                            className="text-xl sm:text-2xl font-medium text-white tracking-tight leading-snug hover:text-neutral-300 transition-colors cursor-pointer mb-3"
                          >
                            {report.title}
                          </h3>

                          {/* Summary with dateline */}
                          <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed mb-4">
                            <strong className="text-white font-mono uppercase text-xs mr-1 tracking-wider">
                              {city} —
                            </strong>
                            {report.subtitle}
                          </p>
                        </div>

                        {/* Author & Action Bar */}
                        <div className="pt-4 mt-4 border-t border-white/5 flex items-center justify-between">
                          <div className="text-xs font-mono text-neutral-400">
                            <span className="text-white font-medium block">{report.author.name}</span>
                            <span className="text-neutral-500">{report.author.bureau}</span>
                          </div>

                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => onToggleBookmark(report)}
                              className={`p-1.5 transition-colors cursor-pointer ${
                                isBookmarked
                                  ? 'text-white'
                                  : 'text-neutral-500 hover:text-white'
                              }`}
                              title={isBookmarked ? 'Guardado' : 'Guardar informe'}
                              aria-label="Guardar informe"
                            >
                              <Bookmark className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => onShareReport(report)}
                              className="text-xs font-medium uppercase tracking-wider text-neutral-400 hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer"
                            >
                              <Share2 className="w-3.5 h-3.5" />
                              <span>COMPARTIR</span>
                            </button>

                            <button
                              onClick={() => onReadReport(report)}
                              className="p-1.5 text-neutral-400 hover:text-white transition-colors cursor-pointer"
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
                <div className="flex items-center justify-between pb-3 mb-8 border-b border-white/5">
                  <span className="text-xs font-mono uppercase tracking-widest text-neutral-400">
                    BLOQUE II · INFRAESTRUCTURA, INNOVACIÓN Y MERCADOS DE CAPITAL
                  </span>
                  <span className="text-xs font-mono text-neutral-500">
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
                          {/* Image in FULL COLOR */}
                          <div
                            className="w-full aspect-[16/9] bg-neutral-950 overflow-hidden relative cursor-pointer mb-4"
                            onClick={() => onReadReport(report)}
                          >
                            <img
                              src={report.image}
                              alt={report.title}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover group-hover:scale-[1.012] transition-transform duration-500 ease-out"
                              loading="lazy"
                            />
                            <div className="absolute top-2 left-2 bg-black/90 text-white px-2 py-0.5 text-xs font-mono uppercase tracking-wider">
                              {report.category}
                            </div>
                          </div>

                          {/* Metadata */}
                          <div className="text-xs font-mono text-neutral-400 uppercase mb-2">
                            {report.readTime} · {report.publishedAt}
                          </div>

                          {/* Title */}
                          <h3
                            onClick={() => onReadReport(report)}
                            className="text-base sm:text-lg font-medium text-white tracking-tight leading-snug hover:text-neutral-300 transition-colors cursor-pointer mb-2"
                          >
                            {report.title}
                          </h3>

                          {/* Summary */}
                          <p className="text-xs sm:text-sm text-neutral-300 line-clamp-3 leading-relaxed mb-4">
                            <strong className="text-white font-mono uppercase text-xs mr-1 tracking-wider">
                              {city} —
                            </strong>
                            {report.subtitle}
                          </p>
                        </div>

                        {/* Footer */}
                        <div className="pt-3 border-t border-white/5 flex items-center justify-between mt-auto">
                          <div className="text-xs font-mono text-neutral-400 truncate max-w-[140px]">
                            <span className="text-white block truncate">{report.author.name}</span>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => onToggleBookmark(report)}
                              className={`p-1.5 transition-colors cursor-pointer ${
                                isBookmarked
                                  ? 'text-white'
                                  : 'text-neutral-500 hover:text-white'
                              }`}
                              title={isBookmarked ? 'Guardado' : 'Guardar'}
                              aria-label="Guardar"
                            >
                              <Bookmark className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => onShareReport(report)}
                              className="text-xs font-medium uppercase tracking-wider text-neutral-400 hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
                              title="Compartir en redes sociales"
                            >
                              <Share2 className="w-3 h-3" />
                              <span className="hidden xl:inline">COMPARTIR</span>
                            </button>

                            <button
                              onClick={() => onReadReport(report)}
                              className="p-1.5 text-neutral-400 hover:text-white transition-colors cursor-pointer"
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
            <div className="pt-10 border-t border-white/5">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="max-w-3xl">
                  <div className="text-xs font-mono uppercase tracking-widest text-neutral-400 mb-2 font-medium">
                    DOSSIER EDITORIAL DESTACADO · {configuredDossier ? configuredDossier.category : 'SOBERANÍA Y PROPIEDAD'}
                  </div>
                  <h3 
                    onClick={() => configuredDossier && onReadReport(configuredDossier)}
                    className="text-xl sm:text-2xl font-medium text-white tracking-tight leading-snug mb-2 hover:text-neutral-300 transition-colors cursor-pointer"
                  >
                    {configuredDossier 
                      ? configuredDossier.title 
                      : 'La defensa irrestricta de la iniciativa privada frente al intervencionismo estatal'}
                  </h3>
                  <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
                    {configuredDossier 
                      ? configuredDossier.subtitle 
                      : 'Nuestra redacción audita continuamente las políticas públicas y su impacto sobre el cálculo económico, la inflación, la seguridad jurídica y los derechos inalienables de los ciudadanos.'}
                  </p>
                </div>

                <div className="shrink-0 flex items-center gap-3">
                  {configuredDossier && (
                    <button
                      onClick={() => onReadReport(configuredDossier)}
                      className="px-5 py-2.5 bg-white text-black font-medium text-xs uppercase tracking-wider hover:bg-neutral-200 transition-colors cursor-pointer"
                    >
                      LEER ESTE DOSSIER
                    </button>
                  )}
                  <button
                    onClick={() => onSelectCategory('DOSSIERS')}
                    className="px-4 py-2.5 border border-white/20 text-neutral-300 hover:text-white font-medium text-xs uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    EXPLORAR TODOS
                  </button>
                </div>
              </div>
            </div>

            {/* ADDITIONAL REPORTS IF ANY */}
            {additionalReports.length > 0 && (
              <div className="pt-10 border-t border-white/5">
                <div className="flex items-center justify-between pb-3 mb-6 border-b border-white/5">
                  <span className="text-xs font-mono uppercase tracking-widest text-neutral-400">
                    DESPACHOS ADICIONALES DE LA EDICIÓN
                  </span>
                  <span className="text-xs font-mono text-neutral-500">
                    ARCHIVO RECIENTE
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {additionalReports.map((report) => (
                    <div 
                      key={report.id} 
                      onClick={() => onReadReport(report)}
                      className="p-4 border border-white/10 hover:border-white/40 transition-colors cursor-pointer group flex flex-col justify-between"
                    >
                      <div>
                        <div className="text-xs font-mono text-neutral-400 uppercase mb-1">
                          {report.category} · {report.readTime}
                        </div>
                        <h4 className="text-sm font-medium text-white group-hover:text-neutral-300 transition-colors line-clamp-2">
                          {report.title}
                        </h4>
                      </div>
                      <div className="mt-3 text-xs font-mono text-neutral-500 flex items-center justify-between">
                        <span>{report.author.name}</span>
                        <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
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
