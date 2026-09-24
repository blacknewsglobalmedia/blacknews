import React, { useState, useEffect, useRef } from 'react';
import { Search, X, ChevronRight } from 'lucide-react';
import { Report } from '../types/news';

interface SearchBarModalProps {
  isOpen: boolean;
  onClose: () => void;
  reports: Report[];
  onSelectReport: (report: Report) => void;
}

export const SearchBarModal: React.FC<SearchBarModalProps> = ({
  isOpen,
  onClose,
  reports,
  onSelectReport,
}) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filtered = query.trim() === ''
    ? []
    : reports.filter((r) => {
        const text = `${r.title} ${r.subtitle} ${r.category} ${r.author.name} ${r.tags.join(' ')}`.toLowerCase();
        return text.includes(query.toLowerCase());
      });

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/90 p-4 sm:p-6 pt-16 sm:pt-24 animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-black border border-white/10 shadow-2xl">
        {/* Search Input Bar */}
        <div className="p-4 border-b border-white/5 flex items-center gap-3">
          <Search className="w-5 h-5 text-neutral-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por titular, mercado, sector, autor o palabra clave..."
            className="flex-1 bg-transparent text-sm sm:text-base text-white placeholder-neutral-500 focus:outline-none font-sans"
          />
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white transition-colors cursor-pointer"
            aria-label="Cerrar búsqueda"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Results / Suggestions without borders */}
        <div className="max-h-[60vh] overflow-y-auto p-4 space-y-2">
          {query.trim() === '' ? (
            <div className="py-8 text-center text-xs font-mono text-neutral-500 uppercase tracking-wider">
              Escribe para buscar entre todos los informes y coberturas de BLACKNEWS
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-8 text-center text-xs font-mono text-neutral-500 uppercase tracking-wider">
              No se encontraron informes coincidentes con "{query}"
            </div>
          ) : (
            filtered.map((rep) => (
              <div
                key={rep.id}
                onClick={() => {
                  onSelectReport(rep);
                  onClose();
                }}
                className="py-3 px-3 hover:bg-white/5 transition-colors cursor-pointer group flex items-start justify-between gap-4"
              >
                <div>
                  <div className="text-xs font-mono uppercase tracking-wider text-neutral-400 mb-1">
                    {rep.category} · {rep.publishedAt}
                  </div>
                  <h4 className="text-sm sm:text-base font-medium text-white group-hover:text-neutral-300 transition-colors leading-snug">
                    {rep.title}
                  </h4>
                  <p className="text-xs sm:text-sm text-neutral-400 line-clamp-1 mt-1">
                    {rep.subtitle}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-neutral-500 group-hover:text-white shrink-0 mt-1 transition-colors" />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
