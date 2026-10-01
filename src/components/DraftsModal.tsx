import React from 'react';
import { 
  X, 
  Trash2, 
  FileText, 
  Clock, 
  ArrowRight, 
  Bookmark, 
  AlertCircle,
  Plus
} from 'lucide-react';
import { ReportSection, CategoryId } from '../types/news';

export interface ArticleDraft {
  id: string;
  userId: string;
  userEmail: string;
  title: string;
  subtitle: string;
  category: CategoryId;
  selectedImage: string;
  imageCaption: string;
  customImageUrl: string;
  readTime: string;
  exclusive: boolean;
  lead: string;
  takeawayInputs: string[];
  sections: ReportSection[];
  tagString: string;
  savedAt: string;
  updatedAt: number;
}

interface DraftsModalProps {
  isOpen: boolean;
  onClose: () => void;
  drafts: ArticleDraft[];
  onLoadDraft: (draft: ArticleDraft) => void;
  onDeleteDraft: (draftId: string) => void;
  onNewBlankArticle: () => void;
  maxDrafts?: number;
}

export const DraftsModal: React.FC<DraftsModalProps> = ({
  isOpen,
  onClose,
  drafts,
  onLoadDraft,
  onDeleteDraft,
  onNewBlankArticle,
  maxDrafts = 100
}) => {
  if (!isOpen) return null;

  const isFull = drafts.length >= maxDrafts;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="bg-neutral-950 border border-white/15 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden font-sans"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-white/10 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-white/10 rounded-lg text-white">
                <Bookmark className="w-5 h-5" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white uppercase">
                Borradores del Redactor
              </h2>
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                isFull 
                  ? 'bg-red-950 text-red-300 border border-red-500/40' 
                  : 'bg-white/10 text-white'
              }`}>
                {drafts.length}/{maxDrafts}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-neutral-400 font-light">
              Tus noticias en preparación. Límite máximo de {maxDrafts} borradores por redactor.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer shrink-0"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Warning if draft capacity is close or reached */}
        {isFull && (
          <div className="mx-5 sm:mx-6 mt-4 p-3.5 bg-red-950/40 border border-red-500/30 rounded-xl flex items-center gap-2.5 text-red-200 text-xs sm:text-sm">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>Has alcanzado el límite de {maxDrafts} borradores. Publica o elimina borradores para guardar nuevos.</span>
          </div>
        )}

        {/* Body list */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-3 flex-1">
          {drafts.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center mx-auto text-neutral-500">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-base font-semibold text-white">No tienes borradores guardados</h3>
              <p className="text-xs sm:text-sm text-neutral-400 max-w-sm mx-auto font-light">
                Puedes guardar el artículo en el que estés trabajando pulsando en "Guardar Borrador" en la barra inferior flotante.
              </p>
            </div>
          ) : (
            drafts.map((draft) => (
              <div
                key={draft.id}
                className="p-4 bg-neutral-900/60 hover:bg-neutral-900 rounded-xl transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group border border-white/5 hover:border-white/15"
              >
                <div className="space-y-1 max-w-lg">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-semibold text-neutral-300 uppercase tracking-wider text-[11px]">
                      {draft.category}
                    </span>
                    <span className="text-neutral-600">·</span>
                    <span className="text-neutral-400 flex items-center gap-1 font-light">
                      <Clock className="w-3 h-3" />
                      {draft.savedAt}
                    </span>
                    {draft.exclusive && (
                      <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-white font-medium">
                        EXCLUSIVA
                      </span>
                    )}
                  </div>
                  <h4 className="text-sm sm:text-base font-bold text-white group-hover:text-neutral-200 transition-colors line-clamp-1">
                    {draft.title.trim() ? draft.title : '(Borrador sin título)'}
                  </h4>
                  <p className="text-xs text-neutral-400 line-clamp-1 font-light">
                    {draft.subtitle || draft.lead || `${draft.sections.length} bloques redactados`}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() => {
                      onLoadDraft(draft);
                      onClose();
                    }}
                    className="px-3.5 py-2 bg-white text-black hover:bg-neutral-200 font-bold text-xs uppercase tracking-wider rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
                  >
                    <span>Cargar</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteDraft(draft.id)}
                    className="p-2 text-neutral-400 hover:text-red-400 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
                    title="Eliminar borrador"
                    aria-label="Eliminar borrador"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-white/10 flex items-center justify-between gap-3 bg-neutral-950">
          <button
            type="button"
            onClick={() => {
              onNewBlankArticle();
              onClose();
            }}
            className="px-4 py-2 rounded-xl text-neutral-300 hover:text-white hover:bg-neutral-900 text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Limpiar y nuevo artículo</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
