import React, { useState, useRef } from 'react';
import { 
  X, 
  Upload, 
  FileText, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  FileCode,
  ArrowRight
} from 'lucide-react';
import { 
  parseAndValidateArticleJson, 
  ParsedArticleImport, 
  SAMPLE_ARTICLE_JSON, 
  downloadArticleTemplateJson 
} from '../utils/articleTemplate';

interface ImportArticleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (article: ParsedArticleImport) => void;
}

export const ImportArticleModal: React.FC<ImportArticleModalProps> = ({
  isOpen,
  onClose,
  onImport
}) => {
  const [activeTab, setActiveTab] = useState<'paste' | 'file'>('paste');
  const [jsonText, setJsonText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [parsedPreview, setParsedPreview] = useState<ParsedArticleImport | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleValidateAndPreview = (text: string) => {
    setError(null);
    setParsedPreview(null);
    if (!text.trim()) {
      return;
    }
    const res = parseAndValidateArticleJson(text);
    if (res.success && res.data) {
      setParsedPreview(res.data);
    } else {
      setError(res.error || 'Formato JSON inválido.');
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setJsonText(val);
    if (val.trim().length > 10) {
      handleValidateAndPreview(val);
    } else {
      setParsedPreview(null);
      setError(null);
    }
  };

  const handleFileSelected = (file: File) => {
    if (!file.name.endsWith('.json') && file.type !== 'application/json') {
      setError('Por favor selecciona un archivo con extensión .json');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setJsonText(content);
      handleValidateAndPreview(content);
      setActiveTab('paste');
    };
    reader.onerror = () => {
      setError('Error al leer el archivo seleccionado.');
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleLoadSample = () => {
    const sampleStr = JSON.stringify(SAMPLE_ARTICLE_JSON, null, 2);
    setJsonText(sampleStr);
    handleValidateAndPreview(sampleStr);
  };

  const handleConfirmImport = () => {
    if (!parsedPreview) {
      const res = parseAndValidateArticleJson(jsonText);
      if (!res.success || !res.data) {
        setError(res.error || 'El JSON no es válido.');
        return;
      }
      onImport(res.data);
      onClose();
      return;
    }
    onImport(parsedPreview);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="bg-neutral-950 border border-white/20 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden font-sans"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-white/10 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-white">
              <div className="p-1.5 bg-white/10 rounded-lg">
                <FileCode className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white uppercase">
                Importar Artículo desde JSON
              </h2>
            </div>
            <p className="text-sm text-neutral-400 font-light">
              Pega el JSON generado por tu IA o sube un archivo <code className="text-white bg-white/10 px-1.5 py-0.5 rounded text-xs">.json</code> para rellenar todo el artículo automáticamente.
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

        {/* Tab switcher & quick helpers */}
        <div className="px-5 sm:px-6 pt-4 pb-2 border-b border-white/5 flex flex-wrap items-center justify-between gap-3 bg-neutral-900/40">
          <div className="flex items-center gap-1 bg-black/60 p-1 rounded-xl border border-white/10">
            <button
              onClick={() => setActiveTab('paste')}
              className={`px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-colors cursor-pointer ${
                activeTab === 'paste' 
                  ? 'bg-white text-black shadow-sm' 
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Pegar Texto JSON
            </button>
            <button
              onClick={() => setActiveTab('file')}
              className={`px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-colors cursor-pointer ${
                activeTab === 'file' 
                  ? 'bg-white text-black shadow-sm' 
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Subir Archivo .json
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleLoadSample}
              className="text-xs font-medium text-neutral-300 hover:text-white flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/10 hover:border-white/30 bg-neutral-900 transition-colors cursor-pointer"
              title="Cargar el artículo cuántico de ejemplo para probar la importación"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Cargar Ejemplo de Prueba</span>
            </button>
            <button
              type="button"
              onClick={() => downloadArticleTemplateJson()}
              className="text-xs font-medium text-neutral-300 hover:text-white flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/10 hover:border-white/30 bg-neutral-900 transition-colors cursor-pointer"
              title="Descargar la plantilla oficial .json"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Bajar Plantilla</span>
            </button>
          </div>
        </div>

        {/* Body content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {activeTab === 'file' ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                dragOver 
                  ? 'border-white bg-white/10 scale-[1.01]' 
                  : 'border-white/20 bg-neutral-900/30 hover:border-white/40 hover:bg-neutral-900/60'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileSelected(e.target.files[0]);
                  }
                }}
              />
              <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-3 text-white">
                <Upload className="w-6 h-6" />
              </div>
              <h3 className="text-base font-semibold text-white mb-1">
                Haz clic o arrastra aquí tu archivo .json
              </h3>
              <p className="text-xs sm:text-sm text-neutral-400 font-light max-w-sm mx-auto">
                El archivo debe ser un JSON válido que contenga la estructura del artículo o el formato oficial de BLACKNEWS.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-neutral-400 font-medium">
                <span>Pega el contenido JSON a continuación:</span>
                {jsonText && (
                  <span>{jsonText.length.toLocaleString()} caracteres</span>
                )}
              </div>
              <textarea
                rows={9}
                value={jsonText}
                onChange={handleTextChange}
                placeholder='{
  "articulo": {
    "title": "Titular de investigación...",
    "subtitle": "Bajada explicativa...",
    "category": "ECONOMÍA & MERCADOS",
    "lead": "Párrafo principal de entrada...",
    "sections": [
      { "type": "paragraph", "text": "Texto del párrafo..." }
    ]
  }
}'
                className="w-full bg-neutral-900/90 border border-white/15 rounded-xl p-3.5 text-xs sm:text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-white resize-y font-mono"
              />
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="p-3.5 bg-red-950/40 border border-red-500/40 rounded-xl text-red-200 text-xs sm:text-sm flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="leading-snug">{error}</div>
            </div>
          )}

          {/* Validation & Preview Card */}
          {parsedPreview && (
            <div className="p-4 bg-emerald-950/30 border border-emerald-500/40 rounded-xl space-y-2.5 text-emerald-200 text-xs sm:text-sm animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="font-semibold flex items-center gap-1.5 text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Estructura validada correctamente
                </span>
                <span className="text-[11px] bg-emerald-900/60 px-2 py-0.5 rounded font-mono text-white">
                  {parsedPreview.category}
                </span>
              </div>
              <div className="text-white font-medium text-sm line-clamp-1">
                "{parsedPreview.title}"
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs text-neutral-300 font-light border-t border-emerald-500/20">
                <div>
                  <span className="text-neutral-500 block">Bloques:</span>
                  <span className="text-white font-medium">{parsedPreview.sections.length}</span>
                </div>
                <div>
                  <span className="text-neutral-500 block">Claves:</span>
                  <span className="text-white font-medium">{parsedPreview.keyTakeaways.length}</span>
                </div>
                <div>
                  <span className="text-neutral-500 block">Etiquetas:</span>
                  <span className="text-white font-medium">{parsedPreview.tags.length}</span>
                </div>
                <div>
                  <span className="text-neutral-500 block">Lectura:</span>
                  <span className="text-white font-medium">{parsedPreview.readTime}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-white/10 flex items-center justify-between gap-3 bg-neutral-950">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-white/15 text-neutral-300 hover:text-white hover:border-white/30 text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!jsonText.trim() || !!error}
            onClick={handleConfirmImport}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-md ${
              !jsonText.trim() || !!error
                ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-700'
                : 'bg-white text-black hover:bg-neutral-200'
            }`}
          >
            <span>Cargar en el Creador</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
