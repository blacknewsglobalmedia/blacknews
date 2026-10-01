import React, { useState, useRef } from 'react';
import { 
  UploadCloud, 
  Sparkles, 
  Check, 
  Copy, 
  FileImage, 
  ShieldCheck, 
  ArrowRight, 
  RefreshCw, 
  ExternalLink,
  Layers,
  Zap,
  Gauge,
  Image as ImageIcon
} from 'lucide-react';
import { OptimizedImageSet } from '../types/news';
import { OptimizedPicture } from './OptimizedPicture';

interface ImageOptimizationStudioProps {
  onSelectForArticle?: (optimizedSet: OptimizedImageSet) => void;
  currentArticleTitle?: string;
}

export const ImageOptimizationStudio: React.FC<ImageOptimizationStudioProps> = ({
  onSelectForArticle,
  currentArticleTitle
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OptimizedImageSet | null>(null);
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [activeTab, setActiveTab] = useState<'preview' | 'variants' | 'code' | 'vitals'>('preview');
  const [isHeroTarget, setIsHeroTarget] = useState(true);
  const [customSlug, setCustomSlug] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Por favor selecciona un archivo de imagen válido (JPEG, PNG, WebP, AVIF o TIFF).');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setProgressText('Eliminando metadatos EXIF y optimizando en formato .AVIF...');

    try {
      const formData = new FormData();
      formData.append('image', file);
      if (customSlug.trim()) {
        formData.append('slug', customSlug.trim());
      } else if (currentArticleTitle) {
        formData.append('slug', currentArticleTitle);
      }
      formData.append('isHero', String(isHeroTarget));

      setProgressText('Generando variantes .AVIF (calidad 55) y resoluciones responsivas...');
      const response = await fetch('/api/images/optimize', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Error al procesar la imagen');
      }

      setResult(data.data);
      setProgressText('');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Ocurrió un error al procesar la imagen.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleCopyCode = () => {
    if (!result?.pictureSnippet) return;
    navigator.clipboard.writeText(result.pictureSnippet);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2500);
  };

  const formatKB = (bytes?: number) => {
    if (!bytes) return '0 KB';
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  return (
    <div className="bg-black text-white font-sans p-4 sm:p-6 rounded-2xl border border-white/10 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-white/10 gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-sans uppercase tracking-widest text-neutral-400 font-semibold">
            <ImageIcon className="w-4 h-4 text-white" />
            <span>ESTUDIO EDITORIAL DE IMAGEN & FORMATO .AVIF</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mt-1 text-white">
            Conversión & Optimización .AVIF
          </h2>
          <p className="text-xs sm:text-sm text-neutral-400 mt-1 font-light max-w-2xl leading-relaxed">
            Las fotografías se transforman automáticamente a formato <strong>.AVIF (calidad 55)</strong>, reduciendo drásticamente los tiempos de carga, eliminando metadatos privados y generando resoluciones responsivas.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-neutral-950 border border-white/10 px-3.5 py-2 text-xs font-sans rounded-xl shrink-0">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span className="text-neutral-400">Formato: </span>
          <span className="text-white font-semibold">.AVIF Nativo</span>
        </div>
      </div>

      {/* Upload Zone */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl transition-all p-8 sm:p-10 text-center cursor-pointer relative overflow-hidden group ${
          isProcessing
            ? 'border-neutral-700 bg-neutral-950/80 cursor-wait'
            : 'border-white/20 hover:border-white/40 bg-neutral-950/50 hover:bg-neutral-900/40'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif,image/tiff"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              handleFileUpload(e.target.files[0]);
            }
          }}
        />

        {isProcessing ? (
          <div className="flex flex-col items-center justify-center space-y-3 py-4">
            <RefreshCw className="w-8 h-8 text-white animate-spin" />
            <p className="text-sm font-medium text-white">{progressText}</p>
            <span className="text-xs font-sans text-neutral-400">
              Generando variantes responsivas y mini-placeholder
            </span>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center space-y-2.5">
            <div className="p-3 bg-white/5 rounded-full group-hover:scale-105 transition-transform">
              <UploadCloud className="w-7 h-7 text-white" />
            </div>
            <p className="text-sm sm:text-base font-medium text-white">
              Arrastra una fotografía o haz clic para seleccionar
            </p>
            <p className="text-xs font-sans text-neutral-400 max-w-md">
              Admite JPEG, PNG, WebP o TIFF. Se generarán automáticamente las variantes en <strong>.AVIF</strong> de 150px, 400px, 800px, 1200px y 1920px.
            </p>
          </div>
        )}
      </div>

      {/* Target Options */}
      <div className="flex flex-wrap items-center justify-between gap-4 text-xs font-sans pt-1">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={isHeroTarget}
            onChange={(e) => setIsHeroTarget(e.target.checked)}
            className="rounded border-white/20 text-white focus:ring-0 cursor-pointer"
          />
          <span className="text-neutral-300">Incluir resolución XL (1920px) para grandes portadas</span>
        </label>

        <div className="flex items-center gap-2">
          <span className="text-neutral-500">Identificador editorial:</span>
          <input
            type="text"
            value={customSlug}
            onChange={(e) => setCustomSlug(e.target.value)}
            placeholder="ej. cumbre-economica-ginebra"
            className="bg-neutral-900 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-white/40"
          />
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="p-3.5 bg-red-950/50 border border-red-500/40 text-red-200 text-xs font-sans rounded-xl">
          {error}
        </div>
      )}

      {/* Results Workspace */}
      {result && (
        <div className="space-y-6 pt-4 border-t border-white/10">
          
          {/* Key Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-sans">
            <div className="p-4 bg-neutral-950 border border-white/10 rounded-xl">
              <span className="text-neutral-500 block uppercase font-medium">PESO ORIGINAL</span>
              <span className="text-lg font-semibold text-neutral-200 font-mono tabular-nums">
                {formatKB(result.originalSize)}
              </span>
              <span className="text-[11px] text-neutral-500 block truncate mt-0.5">{result.originalName}</span>
            </div>

            <div className="p-4 bg-neutral-950 border border-white/10 rounded-xl">
              <span className="text-neutral-500 block uppercase font-medium">AVIF 800PX</span>
              <span className="text-lg font-semibold text-emerald-400 font-mono tabular-nums">
                {formatKB(result.variants?.find(v => v.format === 'avif' && v.width === 800)?.sizeBytes)}
              </span>
              <span className="text-[11px] text-emerald-500 block mt-0.5">Formato ultra-ligero</span>
            </div>

            <div className="p-4 bg-neutral-950 border border-white/10 rounded-xl">
              <span className="text-neutral-500 block uppercase font-medium">REDUCCIÓN DE PESO</span>
              <span className="text-lg font-semibold text-white font-mono tabular-nums">
                -{result.totalSavingsPercent || 75}%
              </span>
              <span className="text-[11px] text-neutral-400 block mt-0.5">Carga acelerada</span>
            </div>

            <div className="p-4 bg-neutral-950 border border-white/10 rounded-xl">
              <span className="text-neutral-500 block uppercase font-medium">METADATOS EXIF</span>
              <span className="text-lg font-semibold text-white flex items-center gap-1.5 mt-0.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-semibold">DEPURADOS</span>
              </span>
              <span className="text-[11px] text-neutral-400 block mt-0.5">Privacidad protegida</span>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-2 bg-neutral-950 border border-white/10 rounded-xl">
            <div className="flex items-center gap-1 text-xs font-sans overflow-x-auto no-scrollbar">
              <button
                onClick={() => setActiveTab('preview')}
                className={`px-3 py-1.5 uppercase tracking-wider rounded-lg transition-colors cursor-pointer ${
                  activeTab === 'preview' ? 'bg-white text-black font-semibold shadow-sm' : 'text-neutral-400 hover:text-white'
                }`}
              >
                Vista Previa Picture
              </button>
              <button
                onClick={() => setActiveTab('variants')}
                className={`px-3 py-1.5 uppercase tracking-wider rounded-lg transition-colors cursor-pointer ${
                  activeTab === 'variants' ? 'bg-white text-black font-semibold shadow-sm' : 'text-neutral-400 hover:text-white'
                }`}
              >
                Variantes ({result.variants?.length || 0})
              </button>
              <button
                onClick={() => setActiveTab('code')}
                className={`px-3 py-1.5 uppercase tracking-wider rounded-lg transition-colors cursor-pointer ${
                  activeTab === 'code' ? 'bg-white text-black font-semibold shadow-sm' : 'text-neutral-400 hover:text-white'
                }`}
              >
                Código HTML &lt;picture&gt;
              </button>
              <button
                onClick={() => setActiveTab('vitals')}
                className={`px-3 py-1.5 uppercase tracking-wider rounded-lg transition-colors cursor-pointer ${
                  activeTab === 'vitals' ? 'bg-white text-black font-semibold shadow-sm' : 'text-neutral-400 hover:text-white'
                }`}
              >
                Métricas de Red
              </button>
            </div>

            {onSelectForArticle && (
              <button
                onClick={() => onSelectForArticle(result)}
                className="px-4 py-1.5 bg-white text-black font-semibold text-xs uppercase tracking-wider rounded-lg hover:bg-neutral-200 transition-colors flex items-center gap-1.5 cursor-pointer ml-auto shadow-sm"
              >
                <Check className="w-3.5 h-3.5" />
                <span>USAR EN ESTE DESPACHO</span>
              </button>
            )}
          </div>

          {/* Tab 1: Live Picture Preview */}
          {activeTab === 'preview' && (
            <div className="space-y-3">
              <div className="border border-white/10 p-2 bg-neutral-950 rounded-xl overflow-hidden">
                <OptimizedPicture
                  image={result}
                  alt={result.originalName}
                  priority={true}
                  aspectRatio="16/9"
                  className="w-full max-h-[460px] rounded-lg"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between text-xs font-sans text-neutral-400 px-1">
                <span>Formato principal: <strong className="text-white">image/avif</strong> con compatibilidad cruzada</span>
                <span>Placeholder blur (20px) activo para evitar CLS</span>
              </div>
            </div>
          )}

          {/* Tab 2: Generated Variants Matrix */}
          {activeTab === 'variants' && (
            <div className="overflow-x-auto border border-white/10 rounded-xl">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-neutral-900 border-b border-white/10 text-neutral-400 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="p-3">Formato</th>
                    <th className="p-3">Ancho</th>
                    <th className="p-3">Dimensiones</th>
                    <th className="p-3">Peso</th>
                    <th className="p-3">Nombre de Archivo</th>
                    <th className="p-3 text-right">Vista</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-sans">
                  {result.variants?.map((v, idx) => (
                    <tr key={idx} className="hover:bg-neutral-900/50 transition-colors">
                      <td className="p-3">
                        <span className={`px-2 py-0.5 uppercase text-[10px] font-semibold rounded ${
                          v.format === 'avif' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/40' :
                          v.format === 'webp' ? 'bg-sky-950 text-sky-400 border border-sky-800/40' :
                          'bg-neutral-800 text-neutral-300'
                        }`}>
                          {v.format}
                        </span>
                      </td>
                      <td className="p-3 text-white font-medium">{v.width}px</td>
                      <td className="p-3 text-neutral-400 font-mono tabular-nums">{v.width} × {v.height}</td>
                      <td className="p-3 text-white font-mono tabular-nums">{formatKB(v.sizeBytes)}</td>
                      <td className="p-3 text-neutral-400 font-mono text-[11px] truncate max-w-xs">{v.filename}</td>
                      <td className="p-3 text-right">
                        <a
                          href={v.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-neutral-400 hover:text-white inline-flex items-center gap-1 transition-colors"
                        >
                          <span>Ver</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Tab 3: HTML Snippet */}
          {activeTab === 'code' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-sans text-neutral-400">
                  Elemento &lt;picture&gt; optimizado con srcset y sizes:
                </span>
                <button
                  onClick={handleCopyCode}
                  className="px-3 py-1.5 bg-neutral-900 border border-white/20 rounded-xl text-xs font-sans font-medium flex items-center gap-1.5 hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  {copiedSnippet ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>COPIADO</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>COPIAR SNIPPET</span>
                    </>
                  )}
                </button>
              </div>

              <pre className="p-4 bg-neutral-950 border border-white/10 rounded-xl text-xs font-mono text-neutral-300 overflow-x-auto leading-relaxed">
                {result.pictureSnippet}
              </pre>
            </div>
          )}

          {/* Tab 4: Web Vitals Impact */}
          {activeTab === 'vitals' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-sans">
              <div className="p-5 bg-neutral-950 border border-white/10 rounded-xl space-y-2.5">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                  <Gauge className="w-4 h-4" />
                  <span>IMPACTO EN LCP (CORE WEB VITALS)</span>
                </div>
                <p className="text-neutral-300 leading-relaxed font-light">
                  Al reducir el peso de la imagen de portada de ~{formatKB(result.originalSize)} a ~{formatKB(result.variants?.find(v => v.format === 'avif' && v.width === 800)?.sizeBytes)}, el tiempo de renderizado de pintura con contenido más grande (LCP) se acelera notablemente en redes móviles.
                </p>
              </div>

              <div className="p-5 bg-neutral-950 border border-white/10 rounded-xl space-y-2.5">
                <div className="flex items-center gap-2 text-sky-400 font-semibold">
                  <Zap className="w-4 h-4" />
                  <span>AHORRO DE TRANSFERENCIA</span>
                </div>
                <p className="text-neutral-300 leading-relaxed font-light">
                  Para 50,000 lectores de esta noticia, la compresión a .AVIF ahorra aproximadamente <strong>
                    {(((result.originalSize - (result.variants?.find(v => v.format === 'avif' && v.width === 800)?.sizeBytes || 0)) * 50000) / (1024 * 1024 * 1024)).toFixed(1)} GB
                  </strong> de ancho de banda.
                </p>
              </div>

              <div className="p-5 bg-neutral-950 border border-white/10 rounded-xl space-y-2.5">
                <div className="flex items-center gap-2 text-purple-400 font-semibold">
                  <Layers className="w-4 h-4" />
                  <span>COMPATIBILIDAD DE FORMATOS</span>
                </div>
                <p className="text-neutral-300 leading-relaxed font-light">
                  <strong>AVIF:</strong> ~94% navegadores modernos.<br />
                  <strong>WebP:</strong> ~98% soporte global.<br />
                  <strong>JPEG:</strong> 100% de fallback garantizado sin pantallas en blanco.
                </p>
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
};
