import React, { useState, useRef } from 'react';
import { 
  Tag, 
  Plus, 
  Trash2, 
  Edit2, 
  Check, 
  X, 
  Upload, 
  Download, 
  ArrowUp, 
  ArrowDown, 
  Layers, 
  AlertCircle, 
  CheckCircle2, 
  RotateCcw, 
  FileJson,
  FileText,
  FolderPlus,
  HelpCircle
} from 'lucide-react';
import { Report } from '../types/news';

interface CategoryManagerProps {
  categories: string[];
  onUpdateCategories: (newCategories: string[]) => void;
  reports: Report[];
}

export const CategoryManager: React.FC<CategoryManagerProps> = ({
  categories,
  onUpdateCategories,
  reports,
}) => {
  // New Category Input
  const [newCatName, setNewCatName] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Inline Editing
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');

  // JSON Import Modal / Panel
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [jsonInput, setJsonInput] = useState('');
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [parsedPreview, setParsedPreview] = useState<string[] | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete confirmation modal
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  // Count articles per category
  const getArticleCount = (catName: string) => {
    if (catName === 'TODAS') return reports.length;
    return reports.filter((r) => r.category === catName).length;
  };

  // Add new category
  const handleAddCategory = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg(null);
    const trimmed = newCatName.trim().toUpperCase();

    if (!trimmed) {
      setErrorMsg('Escribe el nombre de la nueva categoría.');
      return;
    }

    if (categories.some((c) => c.toUpperCase() === trimmed)) {
      setErrorMsg(`La categoría "${trimmed}" ya existe en el catálogo.`);
      return;
    }

    const updated = [...categories, trimmed];
    onUpdateCategories(updated);
    setNewCatName('');
    showSuccess(`Categoría "${trimmed}" creada y añadida a la navegación.`);
  };

  // Start inline editing
  const handleStartEdit = (index: number) => {
    if (categories[index] === 'TODAS') return; // Cannot rename TODAS
    setEditingIndex(index);
    setEditValue(categories[index]);
  };

  // Save inline edit
  const handleSaveEdit = (index: number) => {
    const trimmed = editValue.trim().toUpperCase();
    if (!trimmed) {
      setEditingIndex(null);
      return;
    }

    if (trimmed !== categories[index] && categories.some((c) => c.toUpperCase() === trimmed)) {
      setErrorMsg(`La categoría "${trimmed}" ya existe.`);
      return;
    }

    const oldName = categories[index];
    const updated = [...categories];
    updated[index] = trimmed;
    onUpdateCategories(updated);
    setEditingIndex(null);
    showSuccess(`Categoría "${oldName}" renombrada a "${trimmed}".`);
  };

  // Reorder up
  const handleMoveUp = (index: number) => {
    if (index <= 1) return; // Index 0 is TODAS
    const updated = [...categories];
    const temp = updated[index];
    updated[index] = updated[index - 1];
    updated[index - 1] = temp;
    onUpdateCategories(updated);
  };

  // Reorder down
  const handleMoveDown = (index: number) => {
    if (index === 0 || index >= categories.length - 1) return;
    const updated = [...categories];
    const temp = updated[index];
    updated[index] = updated[index + 1];
    updated[index + 1] = temp;
    onUpdateCategories(updated);
  };

  // Delete category
  const handleConfirmDelete = () => {
    if (!categoryToDelete || categoryToDelete === 'TODAS') {
      setCategoryToDelete(null);
      return;
    }

    const updated = categories.filter((c) => c !== categoryToDelete);
    onUpdateCategories(updated);
    showSuccess(`Categoría "${categoryToDelete}" eliminada de la portada.`);
    setCategoryToDelete(null);
  };

  // Reset to default categories
  const handleResetDefaults = () => {
    if (window.confirm('¿Deseas restablecer las categorías predeterminadas de BLACKNEWS?')) {
      const defaults = [
        'TODAS',
        'ECONOMÍA & MERCADOS',
        'GEOPOLÍTICA',
        'TECNOLOGÍA & INNOVACIÓN',
        'DERECHO & PROPIEDAD',
        'ENERGÍA & INDUSTRIA',
        'DOSSIERS',
      ];
      onUpdateCategories(defaults);
      showSuccess('Catálogo de categorías restablecido a los valores oficiales.');
    }
  };

  // Export categories to JSON
  const handleExportJson = () => {
    const exportData = {
      media: 'BLACKNEWS',
      exportedAt: new Date().toISOString(),
      categories: categories.filter((c) => c !== 'TODAS'),
      metadata: {
        total: categories.length - 1,
        system: 'Editorial Category Management'
      }
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `blacknews-categorias-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showSuccess('Archivo JSON de categorías descargado con éxito.');
  };

  // Parse and validate JSON input
  const parseCategoriesFromJson = (text: string): string[] | null => {
    try {
      const data = JSON.parse(text);
      let items: any[] = [];

      if (Array.isArray(data)) {
        items = data;
      } else if (data && typeof data === 'object') {
        if (Array.isArray(data.categories)) {
          items = data.categories;
        } else if (Array.isArray(data.items)) {
          items = data.items;
        } else if (Array.isArray(data.secciones)) {
          items = data.secciones;
        }
      }

      if (items.length === 0) return null;

      // Extract string names
      const extracted: string[] = [];
      for (const item of items) {
        if (typeof item === 'string' && item.trim()) {
          const upper = item.trim().toUpperCase();
          if (upper !== 'TODAS' && !extracted.includes(upper)) {
            extracted.push(upper);
          }
        } else if (item && typeof item === 'object') {
          const name = item.name || item.title || item.label || item.categoria;
          if (typeof name === 'string' && name.trim()) {
            const upper = name.trim().toUpperCase();
            if (upper !== 'TODAS' && !extracted.includes(upper)) {
              extracted.push(upper);
            }
          }
        }
      }

      return extracted.length > 0 ? extracted : null;
    } catch {
      return null;
    }
  };

  const handleJsonInputChange = (val: string) => {
    setJsonInput(val);
    setImportError(null);
    if (!val.trim()) {
      setParsedPreview(null);
      return;
    }

    const parsed = parseCategoriesFromJson(val);
    if (parsed) {
      setParsedPreview(parsed);
    } else {
      setParsedPreview(null);
      setImportError('El formato JSON debe contener un arreglo de cadenas ["CAT1", "CAT2"] o un objeto con propiedad "categories".');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      handleJsonInputChange(content);
    };
    reader.readAsText(file);
  };

  const handleApplyImport = () => {
    if (!parsedPreview || parsedPreview.length === 0) return;

    let finalCategories: string[];
    if (importMode === 'replace') {
      finalCategories = ['TODAS', ...parsedPreview];
    } else {
      // Merge mode: preserve existing, add unique new ones
      const currentWithoutTodas = categories.filter((c) => c !== 'TODAS');
      const merged = [...currentWithoutTodas];
      for (const cat of parsedPreview) {
        if (!merged.includes(cat)) {
          merged.push(cat);
        }
      }
      finalCategories = ['TODAS', ...merged];
    }

    onUpdateCategories(finalCategories);
    setIsImportModalOpen(false);
    setJsonInput('');
    setParsedPreview(null);
    showSuccess(`Importación completada: ${parsedPreview.length} categorías procesadas.`);
  };

  const loadExampleJson = () => {
    const example = JSON.stringify(
      {
        categories: [
          'ECONOMÍA & MERCADOS',
          'GEOPOLÍTICA',
          'TECNOLOGÍA & INNOVACIÓN',
          'DERECHO & PROPIEDAD',
          'ENERGÍA & INDUSTRIA',
          'CRIPTOACTIVOS & SOBERANÍA',
          'DOSSIERS'
        ]
      },
      null,
      2
    );
    handleJsonInputChange(example);
  };

  return (
    <div className="space-y-8 font-['Lexend',sans-serif]">
      {/* Header & Quick Stats */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-6 border-b border-white/10 gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-sans uppercase tracking-widest text-neutral-400 font-semibold mb-1">
            <Tag className="w-3.5 h-3.5 text-white" />
            <span>SISTEMA DE TAXONOMÍA & SECCIONES EDITORIALES</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Gestión de Categorías
          </h2>
          <p className="text-xs sm:text-sm text-neutral-400 mt-1 font-light max-w-2xl leading-relaxed">
            Elige qué secciones existen en la portada, crea nuevas categorías para los redactores o importa un catálogo estructurado mediante JSON.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            className="px-4 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white font-semibold text-xs uppercase tracking-wider rounded-xl transition-colors cursor-pointer border border-white/10 flex items-center gap-2 shadow-sm"
          >
            <Upload className="w-4 h-4 text-neutral-300" />
            <span>Importar JSON</span>
          </button>

          <button
            type="button"
            onClick={handleExportJson}
            className="px-4 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white font-semibold text-xs uppercase tracking-wider rounded-xl transition-colors cursor-pointer border border-white/10 flex items-center gap-2 shadow-sm"
          >
            <Download className="w-4 h-4 text-neutral-300" />
            <span>Exportar JSON</span>
          </button>

          <button
            type="button"
            onClick={handleResetDefaults}
            className="px-3.5 py-2.5 bg-neutral-900/60 hover:bg-neutral-850 text-neutral-400 hover:text-white text-xs rounded-xl transition-colors cursor-pointer border border-white/5 flex items-center gap-1.5"
            title="Restablecer categorías oficiales"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Predeterminadas</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-950/60 border border-emerald-500/30 text-emerald-200 text-xs sm:text-sm flex items-center gap-2.5 shadow-md animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-red-950/60 border border-red-500/30 text-red-200 text-xs sm:text-sm flex items-center gap-2.5 shadow-md animate-in fade-in">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Create New Category Card */}
      <div className="p-5 sm:p-6 bg-neutral-950/70 border border-white/10 rounded-2xl space-y-4">
        <div className="flex items-center gap-2">
          <FolderPlus className="w-4 h-4 text-white" />
          <h3 className="text-sm font-bold uppercase tracking-wider text-white">
            Crear Nueva Categoría
          </h3>
        </div>

        <form onSubmit={handleAddCategory} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <input
            type="text"
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            placeholder="Ej: CRIPTO & SOBERANÍA, DEFENSA, BIOTECNOLOGÍA..."
            className="flex-1 bg-neutral-900 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-white/40 uppercase tracking-wide font-medium"
          />

          <button
            type="submit"
            className="px-6 py-3 bg-white text-black font-bold text-xs uppercase tracking-wider rounded-xl hover:bg-neutral-200 transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-md shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Añadir Categoría</span>
          </button>
        </form>

        <p className="text-xs text-neutral-400 font-light">
          La nueva categoría estará disponible inmediatamente en el menú superior, el pie de página y para clasificar nuevos despachos en la redacción.
        </p>
      </div>

      {/* Categories List */}
      <div className="p-5 sm:p-6 bg-neutral-950/70 border border-white/10 rounded-2xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-white" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">
              Catálogo de Secciones ({categories.length - 1} activas)
            </h3>
          </div>
          <span className="text-xs text-neutral-400 font-light">
            Usa las flechas para ordenar su aparición en la barra superior
          </span>
        </div>

        <div className="divide-y divide-white/5">
          {categories.map((cat, index) => {
            const isTodas = cat === 'TODAS';
            const count = getArticleCount(cat);
            const isEditing = editingIndex === index;

            return (
              <div
                key={cat}
                className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group hover:bg-white/[0.02] px-2 rounded-xl transition-colors"
              >
                {/* Left: Position & Name */}
                <div className="flex items-center gap-3 flex-1">
                  <span className="w-6 text-center text-xs font-mono text-neutral-500 font-medium">
                    {isTodas ? '★' : `${index}.`}
                  </span>

                  {isEditing ? (
                    <div className="flex items-center gap-2 flex-1 max-w-md">
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveEdit(index);
                          if (e.key === 'Escape') setEditingIndex(null);
                        }}
                        autoFocus
                        className="bg-neutral-900 border border-white/30 rounded-lg px-3 py-1.5 text-xs sm:text-sm text-white font-semibold uppercase flex-1 focus:outline-none focus:ring-1 focus:ring-white"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(index)}
                        className="p-1.5 bg-white text-black rounded-lg hover:bg-neutral-200 transition-colors cursor-pointer"
                        title="Guardar nombre"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingIndex(null)}
                        className="p-1.5 bg-neutral-900 text-neutral-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                        title="Cancelar"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2.5">
                      <span className={`text-xs sm:text-sm font-semibold tracking-wide ${isTodas ? 'text-white' : 'text-neutral-200'}`}>
                        {cat}
                      </span>
                      {isTodas && (
                        <span className="text-[10px] bg-white/10 text-neutral-300 uppercase px-2 py-0.5 rounded font-mono font-medium">
                          Fija / Portada General
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Right: Articles Count & Controls */}
                <div className="flex items-center gap-3 sm:gap-4 shrink-0">
                  <span className="text-xs font-mono text-neutral-400 tabular-nums">
                    {count} {count === 1 ? 'despacho' : 'despachos'}
                  </span>

                  {/* Ordering arrows (only for non-TODAS) */}
                  {!isTodas && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={index <= 1}
                        onClick={() => handleMoveUp(index)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          index <= 1
                            ? 'text-neutral-700 cursor-not-allowed'
                            : 'text-neutral-400 hover:text-white hover:bg-white/10 cursor-pointer'
                        }`}
                        title="Mover hacia arriba"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={index >= categories.length - 1}
                        onClick={() => handleMoveDown(index)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          index >= categories.length - 1
                            ? 'text-neutral-700 cursor-not-allowed'
                            : 'text-neutral-400 hover:text-white hover:bg-white/10 cursor-pointer'
                        }`}
                        title="Mover hacia abajo"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Edit and Delete actions */}
                  {!isTodas && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(index)}
                        className="p-1.5 text-neutral-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                        title="Renombrar categoría"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setCategoryToDelete(cat)}
                        className="p-1.5 text-neutral-400 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-colors cursor-pointer"
                        title="Eliminar categoría"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {categoryToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-950 border border-white/15 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-amber-400">
              <AlertCircle className="w-6 h-6" />
              <h3 className="text-base font-bold text-white uppercase tracking-wider">
                Confirmar Eliminación
              </h3>
            </div>

            <p className="text-xs sm:text-sm text-neutral-300 font-light leading-relaxed">
              ¿Estás seguro de que deseas eliminar la sección <strong>"{categoryToDelete}"</strong>?
              {getArticleCount(categoryToDelete) > 0 && (
                <span className="block mt-2 text-amber-300 text-xs">
                  Aviso: Existen <strong>{getArticleCount(categoryToDelete)} despachos</strong> clasificados bajo esta categoría. Permanecerán visibles en la portada general ("TODAS").
                </span>
              )}
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setCategoryToDelete(null)}
                className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 rounded-xl text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer shadow-lg"
              >
                Eliminar Sección
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Categories Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-950 border border-white/15 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl animate-in fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/10 rounded-xl">
                  <FileJson className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white uppercase tracking-wider">
                    Importar Categorías mediante JSON
                  </h3>
                  <p className="text-xs text-neutral-400 font-light">
                    Sube un archivo .json o pega el contenido en el cuadro de texto.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsImportModalOpen(false);
                  setJsonInput('');
                  setParsedPreview(null);
                  setImportError(null);
                }}
                className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode Selector */}
            <div className="flex items-center gap-4 text-xs">
              <span className="text-neutral-400 font-semibold uppercase tracking-wider">Modo de Importación:</span>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="importMode"
                  checked={importMode === 'merge'}
                  onChange={() => setImportMode('merge')}
                  className="accent-white"
                />
                <span className="text-neutral-200">Fusionar (Añadir sin borrar actuales)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="importMode"
                  checked={importMode === 'replace'}
                  onChange={() => setImportMode('replace')}
                  className="accent-white"
                />
                <span className="text-neutral-200">Reemplazar catálogo completo</span>
              </label>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center justify-between gap-2 text-xs">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl font-medium border border-white/10 flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Upload className="w-3.5 h-3.5 text-neutral-300" />
                <span>Subir archivo .JSON</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={handleFileUpload}
              />

              <button
                type="button"
                onClick={loadExampleJson}
                className="text-xs text-neutral-400 hover:text-white underline cursor-pointer"
              >
                Cargar plantilla de ejemplo
              </button>
            </div>

            {/* Textarea */}
            <div className="space-y-1.5">
              <textarea
                rows={6}
                value={jsonInput}
                onChange={(e) => handleJsonInputChange(e.target.value)}
                placeholder='["ECONOMÍA & MERCADOS", "GEOPOLÍTICA", "CRIPTO & WEB3", "DEFENSA"]'
                className="w-full bg-neutral-900 border border-white/10 rounded-xl p-3.5 text-xs font-mono text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-white/30 resize-y leading-relaxed"
              />
            </div>

            {importError && (
              <div className="p-3 bg-red-950/40 border border-red-500/30 text-red-200 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{importError}</span>
              </div>
            )}

            {/* Preview of detected categories */}
            {parsedPreview && (
              <div className="p-4 bg-emerald-950/20 border border-emerald-500/30 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Se detectaron {parsedPreview.length} categorías válidas:</span>
                  </span>
                  <span className="text-[11px] text-neutral-400 font-mono">
                    Modo: {importMode === 'merge' ? 'Fusión' : 'Reemplazo'}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                  {parsedPreview.map((c) => (
                    <span
                      key={c}
                      className="px-2 py-0.5 bg-neutral-900 border border-emerald-500/30 text-emerald-200 text-xs rounded-lg font-mono font-medium"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Modal Footer Actions */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => {
                  setIsImportModalOpen(false);
                  setJsonInput('');
                  setParsedPreview(null);
                  setImportError(null);
                }}
                className="px-4 py-2 bg-neutral-900 hover:bg-neutral-850 text-neutral-300 rounded-xl text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={!parsedPreview || parsedPreview.length === 0}
                onClick={handleApplyImport}
                className={`px-5 py-2 font-bold text-xs uppercase tracking-wider rounded-xl transition-colors flex items-center gap-1.5 shadow-lg ${
                  !parsedPreview || parsedPreview.length === 0
                    ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                    : 'bg-white text-black hover:bg-neutral-200 cursor-pointer'
                }`}
              >
                <Check className="w-4 h-4" />
                <span>Confirmar e Importar</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
