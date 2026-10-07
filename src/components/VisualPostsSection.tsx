import React, { useState } from 'react';
import { 
  ArrowUpRight, 
  Share2, 
  Bookmark, 
  ChevronLeft, 
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { Report, CategoryId } from '../types/news';
import { CountryFlag } from './SocialPostGenerator';
import { findCountryByName, matchCountryInText } from '../data/countries';
import { OptimizedPicture } from './OptimizedPicture';

interface VisualPostsSectionProps {
  reports: Report[];
  categories: readonly CategoryId[];
  onReadReport: (report: Report) => void;
  onShareReport: (report: Report) => void;
  bookmarkedIds: Set<string>;
  onToggleBookmark: (report: Report) => void;
  onOpenInStudio?: (report: Report) => void;
}

// País que se muestra en las tarjetas de portada, por orden de prioridad:
//  1) la lista real elegida en el creador de artículos (report.countries);
//  2) etiquetas y titular contrastados con el catálogo de países;
//  3) ciudades y alias de los informes antiguos;
//  4) sin datos → alcance internacional (🌐).
// El «bureau» del autor a propósito NO se usa: es la sede de la redacción
// (p. ej. «Zúrich / Central») y atribuía Suiza a todos los despachos.
export const resolveReportCountry = (report: Report): { name: string; code: string } => {
  const assigned = (report.countries ?? [])
    .map((c) => (c || '').trim())
    .find((c) => c.length > 0);
  if (assigned) {
    const item = findCountryByName(assigned);
    if (item) return { name: item.name.toUpperCase(), code: item.code };
    // Personalizado fuera del catálogo: nombre visible, sin bandera conocida.
    return { name: assigned.toUpperCase(), code: 'GLOBAL' };
  }

  const tagsText = report.tags.join(' ');
  const fromTags = matchCountryInText(tagsText);
  if (fromTags) return { name: fromTags.name.toUpperCase(), code: fromTags.code };
  const fromTitle = matchCountryInText(report.title);
  if (fromTitle) return { name: fromTitle.name.toUpperCase(), code: fromTitle.code };

  const textToSearch = `${tagsText} ${report.title}`.toLowerCase();

  if (textToSearch.includes('zúrich') || textToSearch.includes('ginebra') || textToSearch.includes('suiza')) {
    return { name: 'SUIZA', code: 'CH' };
  }
  if (textToSearch.includes('washington') || textToSearch.includes('estados unidos') || textToSearch.includes('ee.uu') || textToSearch.includes('nueva york')) {
    return { name: 'ESTADOS UNIDOS', code: 'US' };
  }
  if (textToSearch.includes('taiwán') || textToSearch.includes('taiwan')) {
    return { name: 'TAIWÁN', code: 'TW' };
  }
  if (textToSearch.includes('londres') || textToSearch.includes('reino unido') || textToSearch.includes('británico')) {
    return { name: 'REINO UNIDO', code: 'GB' };
  }
  if (textToSearch.includes('berlín') || textToSearch.includes('alemania')) {
    return { name: 'ALEMANIA', code: 'DE' };
  }
  if (textToSearch.includes('tokio') || textToSearch.includes('japón')) {
    return { name: 'JAPÓN', code: 'JP' };
  }
  if (textToSearch.includes('singapur')) {
    return { name: 'SINGAPUR', code: 'SG' };
  }
  if (textToSearch.includes('israel') || textToSearch.includes('oriente medio')) {
    return { name: 'ISRAEL', code: 'IL' };
  }
  if (textToSearch.includes('ucrania')) {
    return { name: 'UCRANIA', code: 'UA' };
  }
  if (textToSearch.includes('bruselas') || textToSearch.includes('unión europea')) {
    return { name: 'UNIÓN EUROPEA', code: 'EU' };
  }
  return { name: 'INTERNACIONAL', code: 'GLOBAL' };
};

export const VisualPostsSection: React.FC<VisualPostsSectionProps> = ({
  reports,
  categories,
  onReadReport,
  onShareReport,
  bookmarkedIds,
  onToggleBookmark,
}) => {
  const [filterCategory, setFilterCategory] = useState<CategoryId>('TODAS');
  const [currentPage, setCurrentPage] = useState(0);

  const filteredReports = filterCategory === 'TODAS'
    ? reports
    : reports.filter((r) => r.category === filterCategory);

  const itemsPerPage = 6;
  const totalPages = Math.ceil(filteredReports.length / itemsPerPage);
  const displayedReports = filteredReports.slice(
    currentPage * itemsPerPage,
    (currentPage + 1) * itemsPerPage
  );

  const handlePrev = () => {
    setCurrentPage((prev) => (prev > 0 ? prev - 1 : totalPages - 1));
  };

  const handleNext = () => {
    setCurrentPage((prev) => (prev < totalPages - 1 ? prev + 1 : 0));
  };

  // Sin despachos publicados la sección no aporta nada: se omite por completo.
  if (reports.length === 0) return null;

  return (
    <section className="w-full bg-black py-10 sm:py-14 border-b border-white/10 relative overflow-hidden">
      {/* Subtle background ambient light */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[350px] bg-neutral-900/40 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10 space-y-6 sm:space-y-8">
        
        {/* Newspaper Section Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-4 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2 text-xs font-sans uppercase tracking-widest text-neutral-400 font-semibold mb-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-white inline-block" />
              <span>EDICIÓN VISUAL</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-['Lexend']">
              Despachos de Portada
            </h2>
            <p className="text-xs sm:text-sm text-neutral-400 font-light mt-0.5 max-w-2xl leading-relaxed">
              Cobertura gráfica, análisis geopolítico y seguimiento de mercados en tiempo real.
            </p>
          </div>

          {/* Navigation Controls */}
          {totalPages > 1 && (
            <div className="flex items-center gap-1.5 self-start lg:self-auto bg-neutral-950 p-1 rounded-xl border border-white/10">
              <button
                type="button"
                onClick={handlePrev}
                className="p-2.5 text-neutral-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                title="Página anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-[11px] font-mono text-neutral-400 px-2 font-medium">
                {currentPage + 1} / {totalPages}
              </span>
              <button
                type="button"
                onClick={handleNext}
                className="p-2.5 text-neutral-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                title="Página siguiente"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {categories.map((cat) => {
            const active = filterCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => {
                  setFilterCategory(cat);
                  setCurrentPage(0);
                }}
                className={`px-3 py-2.5 text-xs font-sans font-medium uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap rounded-lg border ${
                  active
                    ? 'text-black bg-white font-bold border-white shadow-md'
                    : 'text-neutral-400 hover:text-white bg-neutral-950/60 border-white/10 hover:border-white/20'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* Cards Grid: Pure 4:5 Vertical Aspect Ratio */}
        {displayedReports.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 items-stretch">
            {displayedReports.map((report) => {
              const country = resolveReportCountry(report);
              const isBookmarked = bookmarkedIds.has(report.id);

              return (
                <article
                  key={report.id}
                  onClick={() => onReadReport(report)}
                  className="group relative bg-black rounded-2xl overflow-hidden border border-white/15 hover:border-white/40 transition-all duration-300 shadow-2xl flex flex-col justify-between cursor-pointer aspect-[4/5]"
                  style={{ backgroundColor: '#000000' }}
                >
                  {/* Subtle Top-Right Quick Actions: Bookmark & Share */}
                  <div 
                    className="absolute top-4 right-4 z-30 flex items-center gap-1.5 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => onShareReport(report)}
                      className="p-2.5 bg-black/60 hover:bg-black/90 text-neutral-300 hover:text-white rounded-full backdrop-blur-md border border-white/10 transition-colors cursor-pointer"
                      title="Compartir despacho"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onToggleBookmark(report)}
                      className={`p-2.5 rounded-full backdrop-blur-md border transition-colors cursor-pointer ${
                        isBookmarked 
                          ? 'bg-white text-black border-white' 
                          : 'bg-black/60 hover:bg-black/90 text-neutral-300 hover:text-white border-white/10'
                      }`}
                      title={isBookmarked ? 'Guardado' : 'Guardar'}
                    >
                      <Bookmark className="w-3.5 h-3.5" fill={isBookmarked ? 'currentColor' : 'none'} />
                    </button>
                  </div>

                  {/* Top Text Content Area */}
                  <div className="p-5 sm:p-6 z-20 relative select-none">
                    
                    {/* Header Row: Category · Flag + Country · Line */}
                    <div className="flex items-center gap-2 overflow-hidden whitespace-nowrap">
                      <span className="text-[10px] sm:text-[11px] font-bold tracking-[0.14em] uppercase text-white font-['Lexend'] shrink-0">
                        {report.category}
                      </span>

                      <span className="text-neutral-500 text-[10px] shrink-0">·</span>

                      {/* Country Flag & Name (se trunca en móvil para no expulsar la línea) */}
                      <div className="flex items-center gap-1.5 min-w-0">
                        <CountryFlag code={country.code} className="w-4 h-2.5 object-cover rounded-[1px] shadow-xs shrink-0" />
                        <span className="text-[10px] sm:text-[11px] font-semibold tracking-wide text-neutral-300 uppercase truncate">
                          {country.name}
                        </span>
                      </div>

                      {/* Elegant white accent line */}
                      <span className="flex-1 max-w-[40px] min-w-[12px] h-[1.5px] bg-white inline-block shrink-0 ml-1" />
                    </div>

                    {/* Headline in Lexend */}
                    <h3 className="mt-3 text-sm sm:text-base md:text-lg font-bold text-white font-['Lexend'] leading-tight tracking-tight drop-shadow-sm line-clamp-3 group-hover:text-neutral-200 transition-colors">
                      {report.title}
                    </h3>

                    {/* Subtitle / Bajada */}
                    {report.subtitle && (
                      <p className="mt-2 text-xs sm:text-sm text-neutral-300 font-normal font-['Lexend'] leading-relaxed line-clamp-3">
                        {report.subtitle}
                      </p>
                    )}
                  </div>

                  {/* Media Container: Occupies bottom half with smooth gradient fade into black */}
                  <div className="absolute inset-0 top-[44%] overflow-hidden z-0">
                    <OptimizedPicture
                      image={report.optimizedImage || report.image}
                      alt={report.title}
                      className="w-full h-full"
                      imgClassName="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />

                    {/* Smooth Gradient Fade from black on top of media */}
                    <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black via-black/75 to-transparent pointer-events-none" />

                    {/* Bottom vignette */}
                    <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/90 to-transparent pointer-events-none" />
                  </div>

                  {/* Bottom Bar: BlackNews Watermark + Right-Aligned Caption / Personaje (at same height) */}
                  <div className="p-4 sm:p-5 z-20 flex items-center justify-between gap-3 relative mt-auto border-t border-white/5 bg-gradient-to-t from-black via-black/85 to-transparent">
                    {/* Watermark Logo: "■ BlackNews" */}
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="w-3.5 h-3.5 bg-white rounded-none" />
                      <span className="text-xs sm:text-sm font-bold text-white tracking-tight font-['Lexend']">
                        BlackNews
                      </span>
                    </div>

                    {/* Right Side: Compact Photo Caption / Personaje (ONLY IF THERE IS ONE, at the same height) */}
                    {report.imageCaption && report.imageCaption.trim() ? (
                      <div 
                        className="flex items-center justify-end min-w-0 flex-1 pl-3" 
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span 
                          className="text-[10px] sm:text-[11px] font-normal text-neutral-300 font-['Lexend'] tracking-wide truncate text-right drop-shadow-md select-none max-w-[200px] sm:max-w-[280px] block"
                          title={report.imageCaption.trim()}
                        >
                          {report.imageCaption.trim()}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="p-6 sm:p-12 text-center border border-white/10 rounded-2xl bg-neutral-950/40">
            <p className="text-sm text-neutral-400 font-light">
              No hay publicaciones de estudio con estos filtros por ahora.
              No hay despachos disponibles en esta sección.
            </p>
          </div>
        )}

      </div>
    </section>
  );
};
