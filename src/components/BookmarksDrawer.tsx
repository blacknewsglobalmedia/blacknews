import React from 'react';
import { X, Trash2, ArrowUpRight, Bookmark } from 'lucide-react';
import { Report } from '../types/news';

interface BookmarksDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  savedReports: Report[];
  onSelectReport: (report: Report) => void;
  onRemoveBookmark: (reportId: string) => void;
  onClearAll: () => void;
}

export const BookmarksDrawer: React.FC<BookmarksDrawerProps> = ({
  isOpen,
  onClose,
  savedReports,
  onSelectReport,
  onRemoveBookmark,
  onClearAll,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/85 animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-black border-l border-white/10 h-full flex flex-col justify-between p-6 sm:p-8 shadow-2xl">
        {/* Header */}
        <div>
          <div className="flex items-center justify-between pb-4 border-b border-white/5 mb-6">
            <div className="flex items-center gap-2">
              <Bookmark className="w-4 h-4 text-white" />
              <h2 className="text-xs sm:text-sm font-medium uppercase tracking-wider text-white">
                LECTURAS GUARDADAS ({savedReports.length})
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-white transition-colors cursor-pointer"
              aria-label="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* List of saved reports */}
          <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-1">
            {savedReports.length === 0 ? (
              <div className="py-16 text-center text-xs font-mono text-neutral-500 uppercase tracking-wider leading-relaxed">
                No tienes informes guardados. Haz clic en el icono de marcador en cualquier informe para guardarlo y leerlo más tarde.
              </div>
            ) : (
              savedReports.map((rep) => (
                <div
                  key={rep.id}
                  className="pb-5 border-b border-white/5 flex flex-col justify-between gap-2 group"
                >
                  <div
                    className="cursor-pointer"
                    onClick={() => {
                      onSelectReport(rep);
                      onClose();
                    }}
                  >
                    <div className="text-xs font-mono uppercase tracking-wider text-neutral-400 mb-1">
                      {rep.category} · {rep.readTime}
                    </div>
                    <h3 className="text-sm sm:text-base font-medium text-white group-hover:text-neutral-300 transition-colors leading-snug">
                      {rep.title}
                    </h3>
                  </div>

                  <div className="pt-2 flex items-center justify-between">
                    <button
                      onClick={() => onRemoveBookmark(rep.id)}
                      className="text-xs font-mono text-neutral-500 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>ELIMINAR</span>
                    </button>

                    <button
                      onClick={() => {
                        onSelectReport(rep);
                        onClose();
                      }}
                      className="text-xs font-medium text-white flex items-center gap-1 hover:text-neutral-300 transition-colors cursor-pointer uppercase tracking-wider"
                    >
                      <span>LEER INFORME</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer actions */}
        {savedReports.length > 0 && (
          <div className="pt-4 border-t border-white/5 flex items-center justify-between">
            <button
              onClick={onClearAll}
              className="text-xs font-mono text-neutral-500 hover:text-white uppercase tracking-wider transition-colors cursor-pointer"
            >
              VACIAR LISTA
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white text-black font-medium text-xs uppercase tracking-wider hover:bg-neutral-200 transition-colors cursor-pointer"
            >
              CERRAR
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
