import React, { useState, useRef, useEffect } from 'react';
import { 
  UploadCloud, 
  Sparkles, 
  Check, 
  Copy, 
  FileImage, 
  ShieldCheck, 
  Cpu, 
  ArrowRight, 
  RefreshCw, 
  ExternalLink,
  Layers,
  Zap,
  Gauge
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
  const [r2Status, setR2Status] = useState<any>(null);
  const [isHeroTarget, setIsHeroTarget] = useState(true);
  const [customSlug, setCustomSlug] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch Cloudflare R2 / Server Engine status
  useEffect(() => {
    fetch('/api/images/status')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setR2Status(data);
        }
      })
      .catch(() => {
        setR2Status({
          isConfigured: false,
          provider: 'Almacenamiento Edge Local (Dev)',
          formats: ['AVIF (55)', 'WebP (68)', 'JPEG (72)'],
          sizes: [150, 400, 800, 1200, 1920]
        });
      });
  }, []);

  const handleFileUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Por favor selecciona un archivo de imagen válido (JPEG, PNG, WebP, AVIF o TIFF).');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setProgressText('Eliminando metadatos EXIF y preparando pipeline...');

    try {
      const formData = new FormData();
      formData.append('image', file);
      if (customSlug.trim()) {
        formData.append('slug', customSlug.trim());
      } else if (currentArticleTitle) {
        formData.append('slug', currentArticleTitle);
      }
      formData.append('isHero', String(isHeroTarget));

      setProgressText('Generando variantes AVIF (calidad 55), WebP (68) y JPEG (72) en 5 tamaños...');
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
      setError(err.message || 'Ocurrió un error al procesar y comprimir la imagen.');
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
    <div className="bg-black text-white font-['Lexend',sans-serif] p-4 sm:p-6 rounded-none border border-white/10 space-y-6">
      
      {/* Header & Engine Status */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-white/10 gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-neutral-400">
            <Cpu className="w-3.5 h-3.5 text-white" />
            <span>MOTOR DE OPTIMIZACIÓN & COMPRESIÓN DE PRENSA</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-medium tracking-tight mt-1">
            Pipeline AVIF / WebP / JPEG & Cloudflare R2
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Compresión agresiva con preservación de fidelidad visual editorial, eliminación de EXIF y mini-placeholder de 20px.
          </p>
        </div>

        {/* Engine Badge */}
        <div className="flex items-center gap-2 bg-neutral-900 border border-white/10 px-3 py-1.5 text-xs font-mono">
          <span className={`w-2 h-2 rounded-full ${r2Status?.isConfigured ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`}></span>
          <div>
            <span className="text-neutral-400 uppercase">Destino: </span>
            <span className="text-white font-medium">
              {r2Status?.isConfigured ? 'Cloudflare R2 Bucket' : 'Edge Storage Local'}
            </span>
          </div>
        </div>
      </div>

      {/* Upload Zone */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed transition-all p-8 sm:p-10 text-center cursor-pointer relative overflow-hidden group ${
          isProcessing
            ? 'border-neutral-700 bg-neutral-950/80 cursor-wait'
            : 'border-white/20 hover:border-white/50 bg-neutral-950/40 hover:bg-neutral-900/40'
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
            <span className="text-xs font-mono text-neutral-400">
              Procesando con sharp libvips · Compresión multihilo
            </span>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center space-y-2.5">
            <div className="p-3 bg-white/5 rounded-full group-hover:scale-105 transition-transform">
              <UploadCloud className="w-7 h-7 text-white" />
            </div>
            <p className="text-sm sm:text-base font-medium text-white">
              Arrastra una fotografía de alta resolución o haz clic para subir
            </p>
            <p className="text-xs font-mono text-neutral-400 max-w-md">
              Genera automáticamente variantes AVIF (calidad 55), WebP (68) y JPEG (72) en 150px, 400px, 800px, 1200px y 1920px sin EXIF.
            </p>
          </div>
        )}
      </div>

      {/* Target Options */}
      <div className="flex flex-wrap items-center justify-between gap-4 text-xs font-mono pt-1">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={isHeroTarget}
            onChange={(e) => setIsHeroTarget(e.target.checked)}
            className="rounded-none border-white/20 text-white focus:ring-0 cursor-pointer"
          />
          <span className="text-neutral-300">Incluir variante XL (1920px) para Aperturas / Hero</span>
        </label>

        <div className="flex items-center gap-2">
          <span className="text-neutral-500">Slug personalizado:</span>
          <input
            type="text"
            value={customSlug}
            onChange={(e) => setCustomSlug(e.target.value)}
            placeholder="ej. reforma-tributaria-madrid"
            className="bg-neutral-900 border border-white/10 px-2.5 py-1 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-white/40"
          />
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="p-3 bg-red-950/50 border border-red-500/40 text-red-200 text-xs font-mono">
          {error}
        </div>
      )}

      {/* Results Workspace */}
      {result && (
        <div className="space-y-6 pt-4 border-t border-white/10">
          
          {/* Key Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
            <div className="p-3 bg-neutral-950 border border-white/10">
              <span className="text-neutral-500 block uppercase">PESO ORIGINAL</span>
              <span className="text-base font-semibold text-neutral-300">
                {formatKB(result.originalSize)}
              </span>
              <span className="text-[10px] text-neutral-600 block truncate">{result.originalName}</span>
            </div>

            <div className="p-3 bg-neutral-950 border border-white/10">
              <span className="text-neutral-500 block uppercase">AVIF 800PX (DEFAULT)</span>
              <span className="text-base font-semibold text-emerald-400">
                {formatKB(result.variants.find(v => v.format === 'avif' && v.width === 800)?.sizeBytes)}
              </span>
              <span className="text-[10px] text-emerald-500 block">Fidelidad 55 agresiva</span>
            </div>

            <div className="p-3 bg-neutral-950 border border-white/10">
              <span className="text-neutral-500 block uppercase">AHORRO DE BANDA</span>
              <span className="text-base font-semibold text-white">
                -{result.totalSavingsPercent}%
              </span>
              <span className="text-[10px] text-neutral-400 block">Menor tiempo de carga LCP</span>
            </div>

            <div className="p-3 bg-neutral-950 border border-white/10">
              <span className="text-neutral-500 block uppercase">SEGURIDAD & EXIF</span>
              <span className="text-base font-semibold text-white flex items-center gap-1">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>DEPURADO</span>
              </span>
              <span className="text-[10px] text-neutral-400 block">0 metadatos privados</span>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-neutral-900 border border-white/10">
            <div className="flex items-center gap-1.5 text-xs font-mono">
              <button
                onClick={() => setActiveTab('preview')}
                className={`px-3 py-1 uppercase tracking-wider transition-colors ${
                  activeTab === 'preview' ? 'bg-white text-black font-semibold' : 'text-neutral-400 hover:text-white'
                }`}
              >
                Vista Previa Picture
              </button>
              <button
                onClick={() => setActiveTab('variants')}
                className={`px-3 py-1 uppercase tracking-wider transition-colors ${
                  activeTab === 'variants' ? 'bg-white text-black font-semibold' : 'text-neutral-400 hover:text-white'
                }`}
              >
                Variantes ({result.variants.length})
              </button>
              <button
                onClick={() => setActiveTab('code')}
                className={`px-3 py-1 uppercase tracking-wider transition-colors ${
                  activeTab === 'code' ? 'bg-white text-black font-semibold' : 'text-neutral-400 hover:text-white'
                }`}
              >
                Código HTML / Picture
              </button>
              <button
                onClick={() => setActiveTab('vitals')}
                className={`px-3 py-1 uppercase tracking-wider transition-colors ${
                  activeTab === 'vitals' ? 'bg-white text-black font-semibold' : 'text-neutral-400 hover:text-white'
                }`}
              >
                Métricas de Red
              </button>
            </div>

            {onSelectForArticle && (
              <button
                onClick={() => onSelectForArticle(result)}
                className="px-4 py-1.5 bg-white text-black font-medium text-xs uppercase tracking-wider hover:bg-neutral-200 transition-colors flex items-center gap-1.5 cursor-pointer ml-auto"
              >
                <Check className="w-3.5 h-3.5" />
                <span>USAR EN ESTE DESPACHO</span>
              </button>
            )}
          </div>

          {/* Tab 1: Live Picture Preview */}
          {activeTab === 'preview' && (
            <div className="space-y-3">
              <div className="border border-white/10 p-2 bg-neutral-950">
                <OptimizedPicture
                  image={result}
                  alt={result.originalName}
                  priority={true}
                  aspectRatio="16/9"
                  className="w-full max-h-[460px]"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between text-xs font-mono text-neutral-400 px-1">
                <span>Formato preferido: <strong>image/avif</strong> con fallback a <strong>image/webp</strong> y <strong>image/jpeg</strong></span>
                <span>Placeholder blur (20px) activo</span>
              </div>
            </div>
          )}

          {/* Tab 2: Generated Variants Matrix */}
          {activeTab === 'variants' && (
            <div className="overflow-x-auto border border-white/10">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-neutral-900 border-b border-white/10 text-neutral-400">
                  <tr>
                    <th className="p-2.5">Formato</th>
                    <th className="p-2.5">Ancho</th>
                    <th className="p-2.5">Dimensiones</th>
                    <th className="p-2.5">Peso</th>
                    <th className="p-2.5">Nombre de Archivo</th>
                    <th className="p-2.5 text-right">Enlace</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {result.variants.map((v, idx) => (
                    <tr key={idx} className="hover:bg-neutral-900/50">
                      <td className="p-2.5">
                        <span className={`px-1.5 py-0.5 uppercase text-[10px] font-semibold ${
                          v.format === 'avif' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/40' :
                          v.format === 'webp' ? 'bg-sky-950 text-sky-400 border border-sky-800/40' :
                          'bg-neutral-800 text-neutral-300'
                        }`}>
                          {v.format}
                        </span>
                      </td>
                      <td className="p-2.5 text-white font-medium">{v.width}px</td>
                      <td className="p-2.5 text-neutral-400">{v.width} × {v.height}</td>
                      <td className="p-2.5 text-white">{formatKB(v.sizeBytes)}</td>
                      <td className="p-2.5 text-neutral-400 font-mono">{v.filename}</td>
                      <td className="p-2.5 text-right">
                        <a
                          href={v.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-neutral-400 hover:text-white inline-flex items-center gap-1"
                        >
                          <span>Abrir</span>
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
                <span className="text-xs font-mono text-neutral-400">
                  Elemento &lt;picture&gt; optimizado con srcset y sizes:
                </span>
                <button
                  onClick={handleCopyCode}
                  className="px-3 py-1 bg-neutral-900 border border-white/20 text-xs font-mono flex items-center gap-1.5 hover:bg-neutral-800 transition-colors"
                >
                  {copiedSnippet ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span>COPIADO</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>COPIAR SNIPPET</span>
                    </>
                  )}
                </button>
              </div>

              <pre className="p-4 bg-neutral-950 border border-white/10 text-xs font-mono text-neutral-300 overflow-x-auto leading-relaxed">
                {result.pictureSnippet}
              </pre>
            </div>
          )}

          {/* Tab 4: Web Vitals Impact */}
          {activeTab === 'vitals' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
              <div className="p-4 bg-neutral-950 border border-white/10 space-y-2">
                <div className="flex items-center gap-2 text-emerald-400 font-medium">
                  <Gauge className="w-4 h-4" />
                  <span>IMPACTO EN LCP (CORE WEB VITALS)</span>
                </div>
                <p className="text-neutral-300 leading-relaxed">
                  Al reducir el peso de la imagen de portada de ~{formatKB(result.originalSize)} a solo ~{formatKB(result.variants.find(v => v.format === 'avif' && v.width === 800)?.sizeBytes)}, el tiempo de renderizado de pintura con contenido más grande (LCP) disminuye hasta en un <strong>70% en redes móviles</strong>.
                </p>
              </div>

              <div className="p-4 bg-neutral-950 border border-white/10 space-y-2">
                <div className="flex items-center gap-2 text-sky-400 font-medium">
                  <Zap className="w-4 h-4" />
                  <span>AHORRO DE EGRESS / TRANSFERENCIA</span>
                </div>
                <p className="text-neutral-300 leading-relaxed">
                  Para 50,000 lectores de esta noticia, la compresión a AVIF ahorra aproximadamente <strong>
                    {(((result.originalSize - (result.variants.find(v => v.format === 'avif' && v.width === 800)?.sizeBytes || 0)) * 50000) / (1024 * 1024 * 1024)).toFixed(1)} GB
                  </strong> de ancho de banda mensual.
                </p>
              </div>

              <div className="p-4 bg-neutral-950 border border-white/10 space-y-2">
                <div className="flex items-center gap-2 text-purple-400 font-medium">
                  <Layers className="w-4 h-4" />
                  <span>COMPATIBILIDAD DE FORMATOS</span>
                </div>
                <p className="text-neutral-300 leading-relaxed">
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
