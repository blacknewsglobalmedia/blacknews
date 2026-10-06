import React from 'react';
import { 
  Send, 
  Bookmark, 
  BookmarkCheck, 
  Eye, 
  Edit3,
  Check
} from 'lucide-react';

interface RedactorFloatingBarProps {
  onPublish: () => void;
  onSaveDraft: () => void;
  onOpenDrafts: () => void;
  onTogglePreview: () => void;
  previewMode: boolean;
  draftsCount: number;
  maxDrafts?: number;
  isEditing: boolean;
  canWrite: boolean;
  lastSavedAt?: string | null;
}

export const RedactorFloatingBar: React.FC<RedactorFloatingBarProps> = ({
  onPublish,
  onSaveDraft,
  onOpenDrafts,
  onTogglePreview,
  previewMode,
  draftsCount,
  maxDrafts = 100,
  isEditing,
  canWrite,
  lastSavedAt
}) => {
  if (!canWrite) return null;

  return (
    <aside 
      aria-label="Barra de acciones del redactor"
      className="fixed left-1/2 -translate-x-1/2 z-40 bottom-[calc(var(--bn-nav-h)_+_2.25rem)] sm:bottom-[calc(var(--bn-nav-h)_+_1.5rem)] lg:bottom-9 max-w-xl w-[94vw] sm:w-auto animate-in slide-in-from-bottom-5 duration-300 pointer-events-auto"
    >
      <div className="bg-neutral-950/90 backdrop-blur-xl border border-white/10 rounded-2xl p-2 sm:p-2.5 flex items-center justify-between sm:justify-center gap-2 sm:gap-3 shadow-2xl shadow-black font-sans">
        {/* Status / Saved Indicator for Desktop */}
        {lastSavedAt && (
          <div className="hidden lg:flex items-center gap-1.5 px-2 text-xs text-neutral-400 font-light border-r border-white/10 pr-3">
            <Check className="w-3.5 h-3.5 text-emerald-400" />
            <span className="truncate max-w-[120px]">Guardado {lastSavedAt}</span>
          </div>
        )}

        {/* Borradores list button */}
        <button
          type="button"
          onClick={onOpenDrafts}
          className="px-3 py-2 rounded-xl text-neutral-300 hover:text-white hover:bg-white/10 text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
          title={`Ver tus borradores (${draftsCount}/${maxDrafts})`}
        >
          <Bookmark className="w-4 h-4 text-neutral-400" />
          <span>Borradores</span>
          <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium ${
            draftsCount >= maxDrafts 
              ? 'bg-red-950 text-red-300 border border-red-500/30' 
              : 'bg-white/10 text-white'
          }`}>
            {draftsCount}/{maxDrafts}
          </span>
        </button>

        {/* Guardar en Borradores button */}
        <button
          type="button"
          onClick={onSaveDraft}
          disabled={draftsCount >= maxDrafts}
          className={`px-3 sm:px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
            draftsCount >= maxDrafts
              ? 'bg-neutral-900 text-neutral-500 cursor-not-allowed'
              : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-200 hover:text-white border border-white/10 hover:border-white/25'
          }`}
          title="Guardar borrador actual (hasta 100 por redactor)"
        >
          <BookmarkCheck className="w-4 h-4 text-amber-400" />
          <span className="hidden sm:inline">Guardar</span>
          <span>Borrador</span>
        </button>

        {/* Separator */}
        <div className="h-5 w-px bg-white/10 hidden sm:block" />

        {/* Vista previa toggle */}
        <button
          type="button"
          onClick={onTogglePreview}
          className="px-3 py-2 rounded-xl text-neutral-300 hover:text-white hover:bg-white/10 text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
          title={previewMode ? 'Regresar al editor' : 'Previsualizar despacho'}
        >
          {previewMode ? (
            <>
              <Edit3 className="w-4 h-4 text-white" />
              <span>Editor</span>
            </>
          ) : (
            <>
              <Eye className="w-4 h-4 text-neutral-400" />
              <span>Vista Previa</span>
            </>
          )}
        </button>

        {/* Boton PUBLICAR / GUARDAR CAMBIOS */}
        {/* Notice: "no digamos publicar en portada porque eso lo elegirá el admin de las noticias que estén creadas" */}
        <button
          type="button"
          onClick={onPublish}
          className="px-4 sm:px-5 py-2 rounded-xl bg-white text-black hover:bg-neutral-200 text-xs sm:text-sm font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shadow-md whitespace-nowrap"
        >
          <Send className="w-3.5 h-3.5" />
          <span>{isEditing ? 'GUARDAR CAMBIOS' : 'PUBLICAR'}</span>
        </button>
      </div>
    </aside>
  );
};
