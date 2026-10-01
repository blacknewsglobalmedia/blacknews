import React, { useState, useRef, useEffect } from 'react';
import { 
  Download, 
  Copy, 
  Upload, 
  Image as ImageIcon, 
  Video as VideoIcon, 
  Volume2, 
  VolumeX, 
  Sparkles, 
  Check, 
  RotateCcw, 
  Eye, 
  Layers, 
  Sliders, 
  FileText, 
  Play, 
  Pause, 
  Maximize2,
  Trash2,
  Palette,
  Film,
  Smartphone,
  Globe,
  MapPin,
  Plus,
  X,
  Type,
  Zap,
  Scissors,
  Gauge,
  FileCode,
  FolderUp,
  FileDown,
  User
} from 'lucide-react';
import { Report } from '../types/news';
import fixWebmDuration from 'fix-webm-duration';

interface SocialPostGeneratorProps {
  reports?: Report[];
  categories?: string[];
}

export interface CountryItem {
  name: string;
  code: string;
  flag: string;
}

export const POPULAR_COUNTRIES: CountryItem[] = [
  { name: 'Israel', code: 'IL', flag: '🇮🇱' },
  { name: 'Irán', code: 'IR', flag: '🇮🇷' },
  { name: 'EE.UU.', code: 'US', flag: '🇺🇸' },
  { name: 'China', code: 'CN', flag: '🇨🇳' },
  { name: 'Rusia', code: 'RU', flag: '🇷🇺' },
  { name: 'Ucrania', code: 'UA', flag: '🇺🇦' },
  { name: 'Arabia Saudí', code: 'SA', flag: '🇸🇦' },
  { name: 'Líbano', code: 'LB', flag: '🇱🇧' },
  { name: 'Siria', code: 'SY', flag: '🇸🇾' },
  { name: 'Yemen', code: 'YE', flag: '🇾🇪' },
  { name: 'Taiwán', code: 'TW', flag: '🇹🇼' },
  { name: 'Corea del Sur', code: 'KR', flag: '🇰🇷' },
  { name: 'Corea del Norte', code: 'KP', flag: '🇰🇵' },
  { name: 'España', code: 'ES', flag: '🇪🇸' },
  { name: 'Reino Unido', code: 'GB', flag: '🇬🇧' },
  { name: 'Francia', code: 'FR', flag: '🇫🇷' },
  { name: 'Alemania', code: 'DE', flag: '🇩🇪' },
  { name: 'Argentina', code: 'AR', flag: '🇦🇷' },
  { name: 'Venezuela', code: 'VE', flag: '🇻🇪' },
  { name: 'Brasil', code: 'BR', flag: '🇧🇷' },
  { name: 'México', code: 'MX', flag: '🇲🇽' },
  { name: 'Colombia', code: 'CO', flag: '🇨🇴' },
  { name: 'Chile', code: 'CL', flag: '🇨🇱' },
  { name: 'Perú', code: 'PE', flag: '🇵🇪' },
  { name: 'Japón', code: 'JP', flag: '🇯🇵' },
  { name: 'India', code: 'IN', flag: '🇮🇳' },
  { name: 'Turquía', code: 'TR', flag: '🇹🇷' },
  { name: 'Egipto', code: 'EG', flag: '🇪🇬' },
  { name: 'Qatar', code: 'QA', flag: '🇶🇦' },
  { name: 'Unión Europea', code: 'EU', flag: '🇪🇺' },
  { name: 'Internacional', code: 'GLOBAL', flag: '🌐' },
];

export const EXPANDED_CATEGORIES: string[] = [
  'GEOPOLÍTICA',
  'ECONOMÍA & MERCADOS',
  'TECNOLOGÍA & INNOVACIÓN',
  'DEFENSA & INTELIGENCIA',
  'DERECHO & PROPIEDAD',
  'ENERGÍA & PETRÓLEO',
  'CRIPTOACTIVOS & SOBERANÍA',
  'RELACIONES EXTERIORES',
  'COMERCIO GLOBAL',
  'POLÍTICA MONETARIA',
  'CADENAS DE SUMINISTRO',
  'INFRAESTRUCTURA & INDUSTRIA',
  'FINANZAS & BANCA',
  'SEGURIDAD & CIBERDEFENSA',
  'DOSSIERS',
  'EDITORIAL'
];

// In-memory cache for loaded flag images for canvas rendering
const flagImageCache = new Map<string, HTMLImageElement>();

export const loadFlagImage = (code: string): Promise<HTMLImageElement | null> => {
  if (!code || code === 'GLOBAL') return Promise.resolve(null);
  const lower = code.toLowerCase();
  if (flagImageCache.has(lower)) {
    return Promise.resolve(flagImageCache.get(lower)!);
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      flagImageCache.set(lower, img);
      resolve(img);
    };
    img.onerror = () => resolve(null);
    img.src = `https://flagcdn.com/w40/${lower}.png`;
  });
};

export const CountryFlag: React.FC<{ code: string; className?: string; fallback?: string }> = ({
  code,
  className = 'w-4 h-2.5 object-cover rounded-[1px] inline-block shadow-xs',
  fallback = '🌐',
}) => {
  const [failed, setFailed] = useState(false);
  if (!code || code === 'GLOBAL' || failed) {
    return <span className="inline-block text-[11px] leading-none">{fallback}</span>;
  }
  return (
    <img
      src={`https://flagcdn.com/w40/${code.toLowerCase()}.png`}
      alt={code}
      loading="lazy"
      onError={() => setFailed(true)}
      className={className}
    />
  );
};

type MediaFilter = 'bw-high' | 'bw-smooth' | 'noir' | 'color' | 'muted-color';

export const SocialPostGenerator: React.FC<SocialPostGeneratorProps> = ({
  reports = [],
  categories: propCategories = [],
}) => {
  // Combine prop categories with expanded list without duplicates
  const allAvailableCategories = Array.from(
    new Set([
      ...EXPANDED_CATEGORIES,
      ...propCategories.filter((c) => c !== 'TODAS')
    ])
  );

  // Post Text Content
  const [category, setCategory] = useState('GEOPOLÍTICA');
  const [title, setTitle] = useState('Oriente Medio,\nen una nueva fase\nde incertidumbre');
  const [description, setDescription] = useState(
    'La escalada de tensiones entre Israel e Irán reconfigura el tablero regional y pone a prueba la estabilidad global.'
  );
  // Optional caption/character at bottom right of photo
  const [photoCaption, setPhotoCaption] = useState<string>('');

  // Countries / Regional attribution
  const [selectedCountries, setSelectedCountries] = useState<CountryItem[]>([
    { name: 'Israel', code: 'IL', flag: '🇮🇱' },
    { name: 'Irán', code: 'IR', flag: '🇮🇷' }
  ]);
  const [customCountryName, setCustomCountryName] = useState('');
  const [countryPlacement, setCountryPlacement] = useState<'line' | 'badge' | 'none'>('line');
  const [countryFormat, setCountryFormat] = useState<'names' | 'flags-names' | 'flags-codes'>('names');
  const [countrySearch, setCountrySearch] = useState('');
  const [autoFitHeader, setAutoFitHeader] = useState(true);
  const [headerSize, setHeaderSize] = useState(20);

  // Media state
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [mediaSrc, setMediaSrc] = useState<string>(
    'https://images.unsplash.com/photo-1541872703-74c5e44368f9?auto=format&fit=crop&w=1200&q=80'
  );
  const [mediaName, setMediaName] = useState<string>('Imagen predeterminada');
  const [isDragOver, setIsDragOver] = useState(false);

  // Filters & Appearance
  const [filter, setFilter] = useState<MediaFilter>('bw-high');
  const [isMuted, setIsMuted] = useState(true);
  const [blendFade, setBlendFade] = useState(true); // Smooth fade into black background
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(115);

  // Font sizes (base 1080x1350 canvas pixels)
  const [fontSizeTitle, setFontSizeTitle] = useState(62);
  const [fontSizeDesc, setFontSizeDesc] = useState(30);

  // Spacing & Line Height (base 1080x1350 canvas pixels, 1:1 synced with preview)
  const [gapCategoryToTitle, setGapCategoryToTitle] = useState(30);
  const [gapTitleToDesc, setGapTitleToDesc] = useState(26);
  const [titleLineHeightRatio, setTitleLineHeightRatio] = useState(1.18);
  const [descLineHeightRatio, setDescLineHeightRatio] = useState(1.42);

  // Video playback & optimization
  const [isVideoPlaying, setIsVideoPlaying] = useState(true);
  const [isRecordingVideo, setIsRecordingVideo] = useState(false);
  const [recordingProgress, setRecordingProgress] = useState(0);
  const [recordingPaused, setRecordingPaused] = useState(false);
  const [videoQuality, setVideoQuality] = useState<'social' | 'compact' | 'hq'>('social');
  const [videoFormat, setVideoFormat] = useState<'mp4' | 'webm'>('mp4');
  const [maxVideoDuration, setMaxVideoDuration] = useState<number>(0); // 5s, 10s, 15s, 30s, 60s or 0 (full)
  const [exportedVideoSize, setExportedVideoSize] = useState<string | null>(null);
  const [videoSpeed, setVideoSpeed] = useState<number>(1.0);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [trimStart, setTrimStart] = useState<number>(0);
  const [trimEnd, setTrimEnd] = useState<number>(0);

  // JSON import/export modal states
  const [isJsonModalOpen, setIsJsonModalOpen] = useState(false);
  const [jsonInputText, setJsonInputText] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const jsonFileInputRef = useRef<HTMLInputElement>(null);

  // Feedback states
  const [isExporting, setIsExporting] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [exportedImageUrl, setExportedImageUrl] = useState<string | null>(null);
  const [exportFileName, setExportFileName] = useState<string>('blacknews-post-4x5.png');
  const [exportedVideoUrl, setExportedVideoUrl] = useState<string | null>(null);
  const [exportVideoFileName, setExportVideoFileName] = useState<string>('blacknews-video-4x5.webm');

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hiddenCanvasRef = useRef<HTMLCanvasElement>(null);
  // Progreso de grabación escrito directo en el DOM: re-renderizar este
  // componente durante la exportación provocaba picos de >100 ms (tirones).
  const recBarRef = useRef<HTMLDivElement>(null);
  const recPctRef = useRef<HTMLSpanElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  // WebAudio graph for the preview video (created on first export with sound and
  // reused afterwards: a media element can only be routed through one source node)
  const audioGraphRef = useRef<{ ctx: AudioContext; dest: MediaStreamAudioDestinationNode } | null>(null);
  // true mientras el grabador de video controla el clip (desactiva el rebobinado
  // del preview, que si no reinicia en trimStart justo al llegar a trimEnd)
  const isRecordingRef = useRef(false);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const uploadedVideoFileRef = useRef<File | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Segundos reales que saldrán en la exportación de video (trim + duración
  // máxima + velocidad). Se muestra antes y durante la grabación para que
  // nunca sorprenda un clip más corto que el original.
  const exportClipSeconds = (() => {
    if (mediaType !== 'video' || !(videoDuration > 0)) return null;
    const duration = videoDuration;
    const s = Math.max(0, Math.min(trimStart, Math.max(duration - 0.1, 0)));
    let e = trimEnd > s && duration > 0 ? Math.min(trimEnd, duration) : duration;
    if (maxVideoDuration > 0) e = Math.min(e, s + maxVideoDuration * videoSpeed);
    if (!(e > s)) return null;
    return Math.round(((e - s) / videoSpeed) * 10) / 10;
  })();

  // Toggle country selection
  const handleToggleCountry = (country: CountryItem) => {
    setSelectedCountries((prev) => {
      const exists = prev.some((c) => c.code === country.code || c.name.toLowerCase() === country.name.toLowerCase());
      if (exists) {
        return prev.filter((c) => c.code !== country.code && c.name.toLowerCase() !== country.name.toLowerCase());
      } else {
        return [...prev, country];
      }
    });
  };

  // Add custom country
  const handleAddCustomCountry = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = customCountryName.trim();
    if (!trimmed) return;

    const newCountry: CountryItem = {
      name: trimmed,
      code: trimmed.toUpperCase().slice(0, 4),
      flag: '📍'
    };

    if (!selectedCountries.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
      setSelectedCountries([...selectedCountries, newCountry]);
    }
    setCustomCountryName('');
    showToast(`País/Región "${trimmed}" añadido al post`);
  };

  // Remove country
  const handleRemoveCountry = (code: string) => {
    setSelectedCountries((prev) => prev.filter((c) => c.code !== code));
  };

  // Pre-fill from an existing article
  const handleLoadFromReport = (reportId: string) => {
    const found = reports.find((r) => r.id === reportId);
    if (!found) return;

    setCategory(found.category || 'GEOPOLÍTICA');
    setTitle(found.title);
    setDescription(found.subtitle || found.lead || '');
    setPhotoCaption(found.imageCaption || '');
    if (found.image) {
      setMediaType('image');
      setMediaSrc(found.image);
      setMediaName(found.title.slice(0, 25) + '...');
    }
    showToast(`Despacho "${found.title.slice(0, 30)}..." cargado en el generador`);
  };

  // Drag and Drop & File Upload handling
  const handleFile = (file: File) => {
    if (!file) return;

    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');

    if (!isImage && !isVideo) {
      showToast('Por favor sube un archivo de imagen o video válido.');
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setMediaSrc(objectUrl);
    setMediaType(isVideo ? 'video' : 'image');
    setMediaName(file.name);

    if (isVideo) {
      uploadedVideoFileRef.current = file;
      setIsVideoPlaying(true);
      const tempVideo = document.createElement('video');
      tempVideo.src = objectUrl;
      tempVideo.onloadedmetadata = () => {
        const dur = Math.round((tempVideo.duration || 0) * 10) / 10;
        if (dur > 0) {
          setVideoDuration(dur);
          setTrimStart(0);
          setTrimEnd(dur);
        }
      };
    }
    showToast(`${isVideo ? 'Video' : 'Imagen'} "${file.name}" cargada correctamente`);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const LOCAL_STORAGE_KEY = 'blacknews_post_generator_draft';

  // Construct full post configuration JSON object
  const getPostConfigObject = () => {
    return {
      version: 1,
      appName: 'BlackNews 4:5 Generator',
      savedAt: new Date().toISOString(),
      content: {
        title,
        description,
        category,
        photoCaption,
        countryPlacement,
        countryFormat,
        selectedCountries,
      },
      typography: {
        fontSizeTitle,
        fontSizeDesc,
        gapCategoryToTitle,
        gapTitleToDesc,
        titleLineHeightRatio,
        descLineHeightRatio,
        headerSize,
        autoFitHeader,
      },
      appearance: {
        filter,
        brightness,
        contrast,
        blendFade,
      },
      mediaSettings: {
        mediaType,
        mediaName,
        isMuted,
        videoSpeed,
        trimStart,
        trimEnd,
        videoQuality,
        videoFormat,
        maxVideoDuration,
        mediaUrl: mediaSrc.startsWith('blob:') ? null : mediaSrc,
      }
    };
  };

  // Copy JSON configuration to clipboard
  const handleCopyJson = () => {
    try {
      const config = getPostConfigObject();
      const jsonStr = JSON.stringify(config, null, 2);
      navigator.clipboard.writeText(jsonStr);
      showToast('✓ ¡Configuración JSON copiada al portapapeles!');
    } catch {
      showToast('No se pudo copiar directamente al portapapeles.');
    }
  };

  // Download JSON configuration file
  const handleDownloadJsonFile = () => {
    try {
      const config = getPostConfigObject();
      const jsonStr = JSON.stringify(config, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const slug = title.slice(0, 16).toLowerCase().replace(/[^a-z0-9]/g, '-');
      triggerDownload(url, `blacknews-post-${slug || 'draft'}.json`);
      showToast('✓ Archivo JSON descargado');
    } catch {
      showToast('Error al descargar archivo JSON.');
    }
  };

  // Import JSON configuration
  const handleApplyJson = (rawText: string) => {
    try {
      if (!rawText.trim()) {
        setJsonError('Pega un contenido JSON válido.');
        return;
      }
      const data = JSON.parse(rawText);
      if (data.content) {
        if (typeof data.content.title === 'string') setTitle(data.content.title);
        if (typeof data.content.description === 'string') setDescription(data.content.description);
        if (typeof data.content.category === 'string') setCategory(data.content.category);
        if (typeof data.content.photoCaption === 'string') setPhotoCaption(data.content.photoCaption);
        if (data.content.countryPlacement) setCountryPlacement(data.content.countryPlacement);
        if (data.content.countryFormat) setCountryFormat(data.content.countryFormat);
        if (Array.isArray(data.content.selectedCountries)) setSelectedCountries(data.content.selectedCountries);
      }
      if (data.typography) {
        if (data.typography.fontSizeTitle) setFontSizeTitle(data.typography.fontSizeTitle);
        if (data.typography.fontSizeDesc) setFontSizeDesc(data.typography.fontSizeDesc);
        if (data.typography.gapCategoryToTitle) setGapCategoryToTitle(data.typography.gapCategoryToTitle);
        if (data.typography.gapTitleToDesc) setGapTitleToDesc(data.typography.gapTitleToDesc);
        if (data.typography.titleLineHeightRatio) setTitleLineHeightRatio(data.typography.titleLineHeightRatio);
        if (data.typography.descLineHeightRatio) setDescLineHeightRatio(data.typography.descLineHeightRatio);
        if (data.typography.headerSize) setHeaderSize(data.typography.headerSize);
        if (typeof data.typography.autoFitHeader === 'boolean') setAutoFitHeader(data.typography.autoFitHeader);
      }
      if (data.appearance) {
        if (data.appearance.filter) setFilter(data.appearance.filter);
        if (typeof data.appearance.brightness === 'number') setBrightness(data.appearance.brightness);
        if (typeof data.appearance.contrast === 'number') setContrast(data.appearance.contrast);
        if (typeof data.appearance.blendFade === 'boolean') setBlendFade(data.appearance.blendFade);
      }
      if (data.mediaSettings) {
        if (data.mediaSettings.mediaType) setMediaType(data.mediaSettings.mediaType);
        if (data.mediaSettings.mediaName) setMediaName(data.mediaSettings.mediaName);
        if (typeof data.mediaSettings.isMuted === 'boolean') setIsMuted(data.mediaSettings.isMuted);
        if (typeof data.mediaSettings.videoSpeed === 'number') setVideoSpeed(data.mediaSettings.videoSpeed);
        if (typeof data.mediaSettings.trimStart === 'number') setTrimStart(data.mediaSettings.trimStart);
        if (typeof data.mediaSettings.trimEnd === 'number') setTrimEnd(data.mediaSettings.trimEnd);
        if (data.mediaSettings.videoQuality) setVideoQuality(data.mediaSettings.videoQuality);
        if (data.mediaSettings.videoFormat) setVideoFormat(data.mediaSettings.videoFormat);
        if (typeof data.mediaSettings.maxVideoDuration === 'number') setMaxVideoDuration(data.mediaSettings.maxVideoDuration);
        if (data.mediaSettings.mediaUrl) setMediaSrc(data.mediaSettings.mediaUrl);
      }
      setIsJsonModalOpen(false);
      setJsonError(null);
      setJsonInputText('');
      showToast('✓ ¡Post restaurado con éxito desde JSON!');
    } catch (err: any) {
      setJsonError('Formato JSON no válido: ' + (err.message || 'error de sintaxis'));
    }
  };

  // Upload and parse JSON file from disk
  const handleUploadJsonFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text) {
        handleApplyJson(text);
      }
    };
    reader.readAsText(file);
  };

  // Auto-save to localStorage so updates or refreshes never wipe their work
  useEffect(() => {
    const timeout = setTimeout(() => {
      try {
        const config = getPostConfigObject();
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(config));
      } catch {}
    }, 600);
    return () => clearTimeout(timeout);
  }, [
    title, description, category, countryPlacement, countryFormat, selectedCountries,
    fontSizeTitle, fontSizeDesc, gapCategoryToTitle, gapTitleToDesc, titleLineHeightRatio,
    descLineHeightRatio, filter, brightness, contrast, blendFade, isMuted,
    mediaType, videoSpeed, trimStart, trimEnd, videoQuality, videoFormat, maxVideoDuration
  ]);

  // Restore draft on initial load if available
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.content?.title && parsed.content.title.trim() !== '') {
          handleApplyJson(saved);
        }
      }
    } catch {}
  }, []);

  // Sync video speed with preview video element
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = videoSpeed;
    }
  }, [videoSpeed]);

  // Global paste listener (Ctrl+V / Cmd+V for images)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            handleFile(blob);
            break;
          }
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  // Compute CSS filter style for live preview
  const getFilterCss = () => {
    let base = `brightness(${brightness}%) contrast(${contrast}%)`;
    switch (filter) {
      case 'bw-high':
        return `grayscale(100%) contrast(${contrast + 15}%) brightness(${brightness - 5}%)`;
      case 'bw-smooth':
        return `grayscale(100%) contrast(${contrast}%) brightness(${brightness}%)`;
      case 'noir':
        return `grayscale(100%) contrast(${contrast + 35}%) brightness(${brightness - 10}%)`;
      case 'muted-color':
        return `saturate(45%) contrast(${contrast}%) brightness(${brightness}%)`;
      case 'color':
      default:
        return base;
    }
  };

  // Compute canvas filter string
  const getCanvasFilterString = () => {
    let b = brightness / 100;
    let c = contrast / 100;
    switch (filter) {
      case 'bw-high':
        return `grayscale(100%) contrast(${(c * 1.15).toFixed(2)}) brightness(${(b * 0.95).toFixed(2)})`;
      case 'bw-smooth':
        return `grayscale(100%) contrast(${c.toFixed(2)}) brightness(${b.toFixed(2)})`;
      case 'noir':
        return `grayscale(100%) contrast(${(c * 1.35).toFixed(2)}) brightness(${(b * 0.90).toFixed(2)})`;
      case 'muted-color':
        return `saturate(45%) contrast(${c.toFixed(2)}) brightness(${b.toFixed(2)})`;
      case 'color':
      default:
        return `brightness(${b.toFixed(2)}) contrast(${c.toFixed(2)})`;
    }
  };

  // Helper to wrap text into canvas lines
  const wrapText = (
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number
  ): string[] => {
    const paragraphs = text.split('\n');
    const allLines: string[] = [];

    paragraphs.forEach((paragraph) => {
      if (paragraph.length === 0) {
        allLines.push('');
        return;
      }
      const words = paragraph.split(' ');
      let currentLine = '';

      for (let n = 0; n < words.length; n++) {
        const testLine = currentLine ? `${currentLine} ${words[n]}` : words[n];
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && currentLine !== '') {
          allLines.push(currentLine);
          currentLine = words[n];
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) {
        allLines.push(currentLine);
      }
    });

    return allLines;
  };

  // Formatted countries string for display and canvas
  const getFormattedCountries = (fmt: 'names' | 'flags-names' | 'flags-codes' = countryFormat) => {
    if (selectedCountries.length === 0) return '';
    switch (fmt) {
      case 'flags-codes':
        return selectedCountries.map((c) => `${c.flag} ${c.code}`).join(' · ');
      case 'flags-names':
        return selectedCountries.map((c) => `${c.flag} ${c.name.toUpperCase()}`).join(' · ');
      case 'names':
      default:
        return selectedCountries.map((c) => c.name.toUpperCase()).join(' · ');
    }
  };

  // Render high-res 1080x1350 canvas
  const renderToCanvas = async (
    targetCanvas: HTMLCanvasElement,
    mediaElement?: HTMLImageElement | HTMLVideoElement,
    cachedFlags?: Array<{ code: string; img: HTMLImageElement | null; text: string }>,
    isOverlayOnly = false
  ): Promise<void> => {
    const W = 1080;
    const H = 1350;

    // 1) Todo el trabajo asíncrono ANTES de tocar el lienzo: si esperamos fuentes
    //    o banderas despejándolo, el capturador del grabador de video puede leer un
    //    fotograma a medio pintar (parpadeos, "rayas" y macrobloques en el archivo).
    if (document.fonts) {
      await document.fonts.ready;
    }
    const flagsData = cachedFlags || await Promise.all(
      selectedCountries.map(async (c) => {
        const img = countryFormat !== 'names' ? await loadFlagImage(c.code) : null;
        const text = countryFormat === 'flags-codes' ? c.code : c.name.toUpperCase();
        return { code: c.code, img, text };
      })
    );

    // 2) Lienzo y estado de forma síncrona: solo redimensionar si hace falta
    //    (reasignar el tamaño reinicia el bitmap y rearmada la capa capturada)
    //    y de ahí en adelante no se vuelve a esperar nada antes de dibujar.
    if (targetCanvas.width !== W) targetCanvas.width = W;
    if (targetCanvas.height !== H) targetCanvas.height = H;
    const ctx = targetCanvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.filter = 'none';
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = 1;
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'miter';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
    ctx.letterSpacing = '0px';

    // 3. Background
    if (isOverlayOnly) {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, W, 540);
    } else {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, W, H);
    }

    // Padding parameters
    const padX = 84;
    const contentWidth = W - padX * 2;
    let curY = 76;

    // 2. Category & Country Header Line (Guaranteed Single Line with Vector Flags)
    ctx.save();
    ctx.textBaseline = 'top';
    const catUpper = category.trim().toUpperCase();
    const maxTextWidth = contentWidth - 65; // Leaves space for at least 45px line

    let curHeaderSize = autoFitHeader ? 20 : headerSize;
    let curLetterSpacing = 2.0;

    // Helper to calculate total width of header with flags
    const computeTotalWidth = (fSize: number, lSpacing: number) => {
      ctx.font = `600 ${fSize}px 'Lexend', sans-serif`;
      ctx.letterSpacing = `${lSpacing}px`;
      let totalW = ctx.measureText(catUpper).width;
      if (countryPlacement === 'line' && flagsData.length > 0) {
        totalW += ctx.measureText('  ·  ').width;
        const flagW = Math.round(fSize * 1.3);
        for (let i = 0; i < flagsData.length; i++) {
          if (countryFormat !== 'names' && flagsData[i].img) {
            totalW += flagW + 6;
          }
          totalW += ctx.measureText(flagsData[i].text).width;
          if (i < flagsData.length - 1) {
            totalW += ctx.measureText(' · ').width;
          }
        }
      }
      return totalW;
    };

    while (computeTotalWidth(curHeaderSize, curLetterSpacing) > maxTextWidth && curHeaderSize > 10.5) {
      curHeaderSize -= 0.5;
      curLetterSpacing = Math.max(0.5, Number((curHeaderSize * 0.1).toFixed(1)));
    }

    ctx.font = `600 ${curHeaderSize}px 'Lexend', sans-serif`;
    ctx.letterSpacing = `${curLetterSpacing}px`;
    ctx.fillStyle = '#FFFFFF';

    let curX = padX;
    ctx.fillText(catUpper, curX, curY);
    curX += ctx.measureText(catUpper).width;

    if (countryPlacement === 'line' && flagsData.length > 0) {
      ctx.fillStyle = '#64748B';
      const sepStr = '  ·  ';
      ctx.fillText(sepStr, curX, curY);
      curX += ctx.measureText(sepStr).width;

      const flagW = Math.round(curHeaderSize * 1.3);
      const flagH = Math.round(flagW * 0.68);
      const flagOffsetY = Math.round((curHeaderSize - flagH) / 2);

      for (let i = 0; i < flagsData.length; i++) {
        const item = flagsData[i];
        if (countryFormat !== 'names' && item.img) {
          ctx.drawImage(item.img, curX, curY + flagOffsetY, flagW, flagH);
          curX += flagW + 6;
        }
        ctx.fillStyle = '#E2E8F0';
        ctx.fillText(item.text, curX, curY);
        curX += ctx.measureText(item.text).width;

        if (i < flagsData.length - 1) {
          ctx.fillStyle = '#64748B';
          const midSep = ' · ';
          ctx.fillText(midSep, curX, curY);
          curX += ctx.measureText(midSep).width;
        }
      }
    }

    // Line divider
    const lineStartX = curX + 18;
    const lineEndX = Math.min(lineStartX + 60, W - padX);

    if (lineEndX > lineStartX + 8) {
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.beginPath();
      const lineCenterY = Math.round(curY + curHeaderSize / 2);
      ctx.moveTo(lineStartX, lineCenterY);
      ctx.lineTo(lineEndX, lineCenterY);
      ctx.stroke();
    }
    ctx.restore();

    curY += curHeaderSize + gapCategoryToTitle;

    // 2.1 Country Badge (if placement is 'badge')
    if (countryPlacement === 'badge' && flagsData.length > 0) {
      ctx.save();
      const badgeFontSize = 18;
      ctx.font = `600 ${badgeFontSize}px 'Lexend', sans-serif`;
      ctx.letterSpacing = '1.5px';
      ctx.textBaseline = 'top';

      const bFlagW = Math.round(badgeFontSize * 1.3);
      const bFlagH = Math.round(bFlagW * 0.68);
      const bFlagOffsetY = Math.round((badgeFontSize - bFlagH) / 2);
      let bX = padX;

      for (let i = 0; i < flagsData.length; i++) {
        const item = flagsData[i];
        if (item.img) {
          ctx.drawImage(item.img, bX, curY + bFlagOffsetY, bFlagW, bFlagH);
          bX += bFlagW + 7;
        }
        ctx.fillStyle = '#CBD5E1';
        ctx.fillText(item.text, bX, curY);
        bX += ctx.measureText(item.text).width;
        if (i < flagsData.length - 1) {
          ctx.fillStyle = '#64748B';
          const sep = '   ·   ';
          ctx.fillText(sep, bX, curY);
          bX += ctx.measureText(sep).width;
        }
      }
      ctx.restore();
      curY += badgeFontSize + gapCategoryToTitle;
    }

    // 3. Title (Lexend Bold)
    ctx.save();
    ctx.font = `700 ${fontSizeTitle}px 'Lexend', sans-serif`;
    ctx.fillStyle = '#FFFFFF';
    ctx.textBaseline = 'top';
    const titleLineHeight = Math.round(fontSizeTitle * titleLineHeightRatio);
    const titleLines = wrapText(ctx, title, contentWidth);
    for (const line of titleLines) {
      if (line) {
        ctx.fillText(line, padX, curY);
      }
      curY += titleLineHeight;
    }
    ctx.restore();

    curY += gapTitleToDesc;

    // 4. Description (Lexend Medium/Normal)
    if (description.trim()) {
      ctx.save();
      ctx.font = `400 ${fontSizeDesc}px 'Lexend', sans-serif`;
      ctx.fillStyle = '#E2E8F0';
      ctx.textBaseline = 'top';
      const descLineHeight = Math.round(fontSizeDesc * descLineHeightRatio);
      const descLines = wrapText(ctx, description, contentWidth);
      for (const line of descLines) {
        if (line) {
          ctx.fillText(line, padX, curY);
        }
        curY += descLineHeight;
      }
      ctx.restore();
    }

    curY += 40;

    // 5. Draw Media (Image or Video Frame)
    // Entero a propósito: una y fraccional deja una costura antialias de 1 px
    // entre el fondo negro y el video (la "raya" del borde superior).
    const mediaTopY = Math.round(Math.max(curY, 520));
    const mediaHeight = H - mediaTopY;

    if (mediaElement && !isOverlayOnly) {
      ctx.save();
      const canvasFilter = getCanvasFilterString();
      // Identidad (brillo/contraste al 100%): saltarnos ctx.filter acelera mucho
      // el dibujo por fotograma y evita el filo que el filtro deja en los bordes.
      if (canvasFilter !== 'brightness(1.00) contrast(1.00)') {
        ctx.filter = canvasFilter;
      }

      const elW = (mediaElement as HTMLVideoElement).videoWidth || (mediaElement as HTMLImageElement).naturalWidth || 1280;
      const elH = (mediaElement as HTMLVideoElement).videoHeight || (mediaElement as HTMLImageElement).naturalHeight || 720;

      const targetRatio = W / mediaHeight;
      const sourceRatio = elW / elH;

      let sx = 0, sy = 0, sw = elW, sh = elH;
      if (sourceRatio > targetRatio) {
        sw = elH * targetRatio;
        sx = (elW - sw) / 2;
      } else {
        sh = elW / targetRatio;
        sy = (elH - sh) / 2;
      }

      ctx.drawImage(
        mediaElement,
        sx, sy, sw, sh,
        0, mediaTopY, W, mediaHeight
      );
      ctx.restore();
    }

    // Soft Top Gradient Fade to Black (seamless transition from solid black header)
    if (blendFade) {
      ctx.save();
      const fadeHeight = Math.min(220, mediaHeight * 0.42);
      const grad = ctx.createLinearGradient(0, mediaTopY, 0, mediaTopY + fadeHeight);
      grad.addColorStop(0, '#000000');
      grad.addColorStop(0.3, 'rgba(0, 0, 0, 0.7)');
      grad.addColorStop(0.7, 'rgba(0, 0, 0, 0.2)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = grad;
      ctx.fillRect(0, mediaTopY, W, fadeHeight);
      ctx.restore();
    }

    // Subtle bottom shadow vignette behind logo and caption
    ctx.save();
    const bottomGrad = ctx.createLinearGradient(0, H - 160, 0, H);
    bottomGrad.addColorStop(0, 'rgba(0,0,0,0)');
    bottomGrad.addColorStop(1, 'rgba(0,0,0,0.85)');
    ctx.fillStyle = bottomGrad;
    ctx.fillRect(0, H - 160, W, 160);
    ctx.restore();

    // 6. Watermark Logo at Bottom-Left: "■ BlackNews"
    ctx.save();
    const logoY = H - 65;
    const logoBoxSize = 34;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(padX, logoY - logoBoxSize + 4, logoBoxSize, logoBoxSize);

    ctx.font = `700 36px 'Lexend', sans-serif`;
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
    ctx.shadowBlur = 6;
    ctx.fillText('BlackNews', padX + logoBoxSize + 16, logoY);

    // 6.1 Compact Photo Caption / Personaje at Bottom-Right (same height as logo, only if present)
    if (photoCaption && photoCaption.trim()) {
      ctx.font = `500 24px 'Lexend', sans-serif`;
      ctx.fillStyle = '#E2E8F0';
      ctx.textAlign = 'right';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
      ctx.shadowBlur = 6;

      const maxCapWidth = contentWidth - (logoBoxSize + 16 + 260);
      let capText = photoCaption.trim();
      if (ctx.measureText(capText).width > maxCapWidth) {
        while (ctx.measureText(capText + '...').width > maxCapWidth && capText.length > 3) {
          capText = capText.slice(0, -1);
        }
        capText += '...';
      }
      ctx.fillText(capText, W - padX, logoY);
    }
    ctx.restore();
  };

  // Helper to safely trigger browser download
  const triggerDownload = (url: string, filename: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (document.body.contains(a)) {
        document.body.removeChild(a);
      }
    }, 1200);
  };

  // Helper to load image safely without crossOrigin tainting
  const loadImageSafely = async (src: string): Promise<HTMLImageElement | null> => {
    if (!src) return null;
    return new Promise((resolve) => {
      const img = new Image();
      if (!src.startsWith('data:') && !src.startsWith('blob:')) {
        img.crossOrigin = 'anonymous';
      }
      img.onload = () => resolve(img);
      img.onerror = () => {
        // Fallback without crossOrigin
        if (img.crossOrigin) {
          const fallback = new Image();
          fallback.onload = () => resolve(fallback);
          fallback.onerror = () => resolve(null);
          fallback.src = src;
        } else {
          resolve(null);
        }
      };
      img.src = src;
    });
  };

  // Export High-Res PNG
  const handleExportPng = async () => {
    try {
      setIsExporting(true);
      const canvas = hiddenCanvasRef.current;
      if (!canvas) return;

      if (mediaType === 'video' && videoRef.current) {
        await renderToCanvas(canvas, videoRef.current);
      } else {
        const img = await loadImageSafely(mediaSrc);
        await renderToCanvas(canvas, img && img.complete && img.naturalWidth > 0 ? img : undefined);
      }

      const slug = title.slice(0, 20).toLowerCase().replace(/[^a-z0-9]/g, '-');
      const filename = `blacknews-post-${slug || '4x5'}-${Date.now()}.png`;
      setExportFileName(filename);

      try {
        canvas.toBlob((blob) => {
          if (!blob) {
            // Fallback to toDataURL
            try {
              const dataUrl = canvas.toDataURL('image/png');
              triggerDownload(dataUrl, filename);
              setExportedImageUrl(dataUrl);
              showToast('¡Post 4:5 exportado en PNG con éxito (1080×1350)!');
            } catch (canvasErr) {
              console.error(canvasErr);
              showToast('La imagen tiene restricciones de origen. Te mostramos la vista previa para guardar.');
            }
            setIsExporting(false);
            return;
          }
          const url = URL.createObjectURL(blob);
          triggerDownload(url, filename);
          setExportedImageUrl(url);
          showToast('¡Post 4:5 exportado en PNG con éxito (1080×1350)!');
          setIsExporting(false);
        }, 'image/png');
      } catch (toBlobErr) {
        console.error(toBlobErr);
        try {
          const dataUrl = canvas.toDataURL('image/png');
          triggerDownload(dataUrl, filename);
          setExportedImageUrl(dataUrl);
          showToast('¡Post 4:5 exportado en PNG con éxito (1080×1350)!');
        } catch {
          showToast('Error de exportación por origen de imagen. Prueba subiendo la foto directamente.');
        }
        setIsExporting(false);
      }
    } catch (err) {
      console.error(err);
      showToast('Ocurrió un error al exportar la imagen.');
      setIsExporting(false);
    }
  };

  // Copy PNG image to clipboard
  const handleCopyToClipboard = async () => {
    try {
      const canvas = hiddenCanvasRef.current;
      if (!canvas) return;

      let mediaEl: HTMLImageElement | HTMLVideoElement | undefined = undefined;
      if (mediaType === 'video' && videoRef.current) {
        mediaEl = videoRef.current;
      } else {
        const img = await loadImageSafely(mediaSrc);
        if (img && img.complete && img.naturalWidth > 0) mediaEl = img;
      }

      await renderToCanvas(canvas, mediaEl);

      canvas.toBlob(async (blob) => {
        if (!blob) return;
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
          setCopySuccess(true);
          showToast('¡Imagen copiada al portapapeles!');
          setTimeout(() => setCopySuccess(false), 3000);
        } catch {
          showToast('Usa el botón de descargar PNG.');
        }
      }, 'image/png');
    } catch {
      showToast('No se pudo copiar directamente al portapapeles.');
    }
  };

  // ─── Exportación de video 4:5 100% en el navegador ─────────────────────────
  // El post (frame del video + overlay tipográfico) se graba directamente desde
  // el canvas compositor con MediaRecorder. Nada se sube a un servidor: el video
  // original no sale del equipo del usuario y el proceso no consume recursos
  // serverless (el antiguo endpoint FFmpeg /api/video/* sigue retirado → 410).
  const handleExportVideo = async () => {
    if (mediaType !== 'video') return;
    const video = videoRef.current;
    const canvas = hiddenCanvasRef.current;
    if (!video || !canvas) {
      showToast('Carga un video antes de exportar.');
      return;
    }
    if (typeof MediaRecorder === 'undefined' || typeof canvas.captureStream !== 'function') {
      showToast('Tu navegador no admite exportación de video. Prueba con Chrome o Edge.');
      return;
    }

    // Prefiere el formato elegido por el usuario y cae a cualquier otro soportado
    const pickCodec = (): { mimeType: string; ext: 'mp4' | 'webm' } => {
      const mp4 = [
        'video/mp4;codecs=avc1.640028,mp4a.40.2',
        'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
        'video/mp4',
      ];
      const webm = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
      const groups = videoFormat === 'mp4' ? [mp4, webm] : [webm, mp4];
      for (const group of groups) {
        for (const mime of group) {
          if (MediaRecorder.isTypeSupported(mime)) {
            return { mimeType: mime, ext: mime.startsWith('video/mp4') ? 'mp4' : 'webm' };
          }
        }
      }
      return { mimeType: '', ext: 'webm' };
    };

    // PREFLIGHT de cadencia: cuando Chrome deja de componer la ventana (pestaña
    // en segundo plano, ventana tapada o minimizada) rAF cae a ~1 Hz y la
    // grabación saldría congelada a 1 fotograma por segundo. Medimos antes de
    // empezar y nos negamos a grabar en ese estado.
    const preFps = await new Promise<number>((resolve) => {
      let frames = 0;
      let alive = true;
      const loop = () => {
        frames += 1;
        if (alive) requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
      window.setTimeout(() => {
        alive = false;
        resolve((frames * 1000) / 700);
      }, 700);
    });
    if (preFps < 12) {
      showToast(
        'La pestaña del navegador está en segundo plano y el vídeo saldría congelado. Vuelve a la pestaña de BlackNews y pulsa Exportar de nuevo.'
      );
      return;
    }

    // Pista viva del capturador: se libera en `finally` aunque falle a mitad
    // de grabación (si no, el canvas seguiría capturando en segundo plano).
    let liveStream: MediaStream | null = null;
    let removeVisibilityListener: (() => void) | null = null;

    try {
      setIsRecordingVideo(true);
      setRecordingProgress(2);

      const { mimeType, ext } = pickCodec();
      const formatNote =
        videoFormat === 'mp4' && ext !== 'mp4'
          ? ' Este navegador no graba MP4: se exportó en WebM.'
          : '';

      // Ventana de recorte en tiempo de origen (trim + duración máxima + velocidad)
      const duration =
        Number.isFinite(video.duration) && video.duration > 0 ? video.duration : videoDuration;
      const start = Math.max(0, Math.min(trimStart, Math.max(duration - 0.1, 0)));
      let end = trimEnd > start && duration > 0 ? Math.min(trimEnd, duration) : duration;
      if (maxVideoDuration > 0) end = Math.min(end, start + maxVideoDuration * videoSpeed);
      if (!(end > start)) {
        showToast('El recorte de video no es válido: revisa inicio y fin.');
        return;
      }

      // Calentamiento: tipografías y banderas una sola vez, para que cada fotograma
      // grabado sea solo trabajo de canvas (sin red)
      const cachedFlags = await Promise.all(
        selectedCountries.map(async (c) => ({
          code: c.code,
          img: countryFormat !== 'names' ? await loadFlagImage(c.code) : null,
          text: countryFormat === 'flags-codes' ? c.code : c.name.toUpperCase(),
        }))
      );
      await renderToCanvas(canvas, video, cachedFlags);
      setRecordingProgress(10);

      video.pause();
      video.loop = false;
      video.playbackRate = videoSpeed;
      video.muted = isMuted;
      // Solo buscar si hace falta: si ya está en `start`, el evento 'seeked'
      // nunca llega y estaríamos esperando el timeout entero antes de grabar.
      if (Math.abs(video.currentTime - start) > 0.05) {
        video.currentTime = start;
        await new Promise<void>((resolve) => {
          let settled = false;
          const onSeeked = () => {
            if (settled) return;
            settled = true;
            video.removeEventListener('seeked', onSeeked);
            resolve();
          };
          video.addEventListener('seeked', onSeeked);
          // En archivos grandes el seek puede tardar: si no llega en 3 s, no
          // bloqueamos la grabación (el tick ignora saltos durante el arranque).
          window.setTimeout(onSeeked, 3000);
        });
      }

      // Audio: el elemento se enruta por WebAudio una sola vez y se reutiliza
      let audioTrack: MediaStreamTrack | null = null;
      if (!isMuted) {
        try {
          let graph = audioGraphRef.current;
          if (!graph) {
            const audioCtx = new AudioContext();
            const source = audioCtx.createMediaElementSource(video);
            const dest = audioCtx.createMediaStreamDestination();
            source.connect(dest);
            source.connect(audioCtx.destination);
            graph = { ctx: audioCtx, dest };
            audioGraphRef.current = graph;
          }
          if (graph.ctx.state === 'suspended') await graph.ctx.resume();
          audioTrack = graph.dest.stream.getAudioTracks()[0] ?? null;
        } catch (audioErr) {
          console.warn('Audio no disponible en la grabación:', audioErr);
        }
      }
      setRecordingProgress(14);

      const stream = canvas.captureStream(30);
      liveStream = stream;
      if (audioTrack) stream.addTrack(audioTrack);
      const videoBitsPerSecond =
        videoQuality === 'hq' ? 6_000_000 : videoQuality === 'compact' ? 1_500_000 : 3_000_000;
      const recorder = new MediaRecorder(stream, {
        ...(mimeType ? { mimeType } : {}),
        videoBitsPerSecond,
        audioBitsPerSecond: 96_000,
      });

      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };
      const finished = new Promise<Blob>((resolve, reject) => {
        recorder.onstop = () =>
          resolve(new Blob(chunks, { type: recorder.mimeType || mimeType || 'video/webm' }));
        recorder.addEventListener('error', (e) =>
          reject((e as unknown as { error?: Error }).error ?? new Error('Error de grabación'))
        );
      });

      const slug = title.slice(0, 20).toLowerCase().replace(/[^a-z0-9]/g, '-');
      const filename = `blacknews-video-${slug || '4x5'}-${Date.now()}.${ext}`;
      setExportVideoFileName(filename);

      let rafId = 0;
      let stopped = false;
      let lastPct = 14;
      let lastProgressAt = 0;
      let hardDeadline = performance.now() + ((end - start) / videoSpeed) * 1000 + 8000;
      const stopRecording = () => {
        if (stopped) return;
        stopped = true;
        cancelAnimationFrame(rafId);
        try {
          if (recorder.state !== 'inactive') recorder.stop();
        } catch {}
        // ATENCIÓN: las pistas NO se cortan aquí. Hacerlo justo después de
        // recorder.stop() truncaba el último chunk (fin del vídeo roto/cortado);
        // se liberan cuando ya tenemos el blob y en `finally`.
        try {
          video.pause();
          video.loop = true;
        } catch {}
        setIsVideoPlaying(false);
      };

      // PROTECCIÓN DE SEGUNDO PLANO: si la ventana deja de componer (rAF cae a
      // ~1 Hz o se detiene al ocultar la pestaña) pausamos el vídeo —el tiempo
      // de contenido deja de avanzar, así que no se pierde nada— y reanudamos
      // cuando la pestaña vuelve. Sin esto la exportación sale a 1 fps y rota.
      let lastTickAt = performance.now();
      let slowTicks = 0;
      let fastTicks = 0;
      let pausedForBg = false;
      let pausedAt = 0;
      const pauseForBackground = () => {
        if (pausedForBg || stopped) return;
        pausedForBg = true;
        pausedAt = performance.now();
        try {
          video.pause();
        } catch {}
        setIsVideoPlaying(false);
        setRecordingPaused(true);
      };
      const resumeFromBackground = () => {
        if (!pausedForBg || stopped) return;
        pausedForBg = false;
        fastTicks = 0;
        slowTicks = 0;
        // El tiempo pausado no cuenta para el tope de seguridad
        hardDeadline += performance.now() - pausedAt;
        lastTickAt = performance.now();
        void video
          .play()
          .then(() => {
            if (!stopped) setIsVideoPlaying(true);
          })
          .catch(() => {});
        setRecordingPaused(false);
      };
      const onVisibility = () => {
        if (document.visibilityState === 'hidden') pauseForBackground();
      };
      document.addEventListener('visibilitychange', onVisibility);
      removeVisibilityListener = () => document.removeEventListener('visibilitychange', onVisibility);

      isRecordingRef.current = true;
      recorder.start(250);
      await video.play();
      setIsVideoPlaying(true);

      let maxT = start;
      let lastDrawVt = -1;
      let lastPhase = 0;
      const tick = () => {
        const now = performance.now();
        const dt = now - lastTickAt;
        lastTickAt = now;

        // Recuperación tras estar en segundo plano: exigen dos ticks rápidos
        // segundos para no flapping con ráfagas aisladas.
        if (pausedForBg) {
          fastTicks = dt < 250 ? fastTicks + 1 : 0;
          if (fastTicks >= 2) resumeFromBackground();
          rafId = requestAnimationFrame(tick);
          return;
        }

        // Cadencia insostenible (>500 ms entre ticks) = ventana sin componer
        slowTicks = dt > 500 ? slowTicks + 1 : 0;
        if (slowTicks >= 2 || dt > 1500) {
          pauseForBackground();
          rafId = requestAnimationFrame(tick);
          return;
        }
        slowTicks = 0;

        const t = video.currentTime;
        // Dibujar SOLO cuando el vídeo avanza: los renders redundantes a 60 Hz
        // saturaban la CPU principal y dejaban menos margen al codificador.
        if (t !== lastDrawVt) {
          lastDrawVt = t;
          void renderToCanvas(canvas, video, cachedFlags);
        }
        if (t > maxT) maxT = t;
        const pct = Math.min(99, Math.round(((t - start) / Math.max(0.1, end - start)) * 100));
        // Progreso: escritura directa en el DOM (~4/s). React solo se entera al
        // cruzar de tramo de mensaje (≤4 veces por exportación).
        if (pct > lastPct && now - lastProgressAt > 250) {
          lastPct = pct;
          lastProgressAt = now;
          if (recPctRef.current) recPctRef.current.textContent = `${pct}%`;
          if (recBarRef.current) recBarRef.current.style.width = `${Math.max(5, pct)}%`;
          const phase = pct < 30 ? 0 : pct < 65 ? 1 : pct < 90 ? 2 : 3;
          if (phase !== lastPhase) {
            lastPhase = phase;
            setRecordingProgress(pct);
          }
        }
        // Fin natural, clip terminado o rebobinado (si el preview volviera a
        // iniciar el bucle). El reinicio por trimEnd queda desactivado arriba;
        // la gracia de 0,5 s evita cortar por un seek de arranque tardío.
        const rebobinado = t < maxT - 0.3 && maxT > start + 0.5;
        if (t >= end - 0.02 || video.ended || rebobinado || now > hardDeadline) {
          setRecordingProgress(99);
          stopRecording();
          return;
        }
        rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);

      const blob = await finished;
      // El grabador ya entregó su último chunk: ahora sí se sueltan las pistas.
      stream.getVideoTracks().forEach((track) => track.stop());
      const url = URL.createObjectURL(blob);
      const sizeFormatted =
        blob.size < 1024 * 1024
          ? `${Math.round(blob.size / 1024)} KB`
          : `${(blob.size / (1024 * 1024)).toFixed(1)} MB`;
      setExportedVideoSize(sizeFormatted);
      setExportedVideoUrl(url);
      setRecordingProgress(100);
      triggerDownload(url, filename);
      showToast(`¡Video 4:5 exportado en tu navegador (${sizeFormatted})!${formatNote}`);
    } catch (err: any) {
      console.error('Error exportando video:', err);
      showToast(err?.message || 'No se pudo exportar el video en el navegador.');
    } finally {
      isRecordingRef.current = false;
      setIsRecordingVideo(false);
      setRecordingProgress(0);
      setRecordingPaused(false);
      removeVisibilityListener?.();
      liveStream?.getVideoTracks().forEach((track) => track.stop());
    }
  };

  // Real-time proportional metrics for live preview (canvas: 1080px wide, preview ~420px max)
  const previewScale = 0.3888;
  const previewTitleSize = Math.max(15, Math.round(fontSizeTitle * previewScale));
  const previewDescSize = Math.max(11, Math.round(fontSizeDesc * previewScale));
  const previewPadTop = Math.round(76 * previewScale);
  const previewPadX = Math.round(84 * previewScale);
  const previewGapCatTitle = Math.round(gapCategoryToTitle * previewScale);
  const previewGapTitleDesc = Math.round(gapTitleToDesc * previewScale);

  // Dynamic header sizing calculation to strictly fit in ONE single line
  const countriesLineText = countryPlacement === 'line' ? getFormattedCountries() : '';
  const headerTotalLength = (category || 'GEOPOLÍTICA').length + (countriesLineText ? countriesLineText.length + 3 : 0);

  let previewHeaderSize = autoFitHeader 
    ? (headerTotalLength > 48 ? 8 : headerTotalLength > 36 ? 9 : headerTotalLength > 24 ? 10 : 11.5)
    : Math.max(8, Math.round(headerSize * previewScale * 10) / 10);
  
  let previewHeaderTracking = previewHeaderSize < 9.5 ? '0.04em' : previewHeaderSize < 11 ? '0.08em' : '0.14em';

  // Filtered countries for search
  const filteredCountries = countrySearch.trim()
    ? POPULAR_COUNTRIES.filter((c) =>
        c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
        c.code.toLowerCase().includes(countrySearch.toLowerCase())
      )
    : POPULAR_COUNTRIES;

  return (
    <div className="font-['Lexend',sans-serif] space-y-8 pb-16">
      {/* High-res processing canvas (positioned offscreen to maintain active compositor pipeline for captureStream) */}
      <canvas 
        ref={hiddenCanvasRef} 
        width={1080} 
        height={1350}
        style={{
          position: 'fixed',
          left: '-9999px',
          top: '-9999px',
          width: '1080px',
          height: '1350px',
          pointerEvents: 'none',
          opacity: 0,
          zIndex: -9999
        }}
        aria-hidden="true"
      />

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-6 border-b border-white/10 gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-sans uppercase tracking-widest text-neutral-400 font-semibold mb-1">
            <Smartphone className="w-3.5 h-3.5 text-white" />
            <span>FORMATO VERTICAL 4:5 · SUPER AMOLED BLACK</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Generador de Posts 4:5
          </h2>
          <p className="text-xs sm:text-sm text-neutral-400 mt-1 font-light max-w-2xl leading-relaxed">
            Publicaciones visuales de alto impacto con fondo negro absoluto, tipografía Lexend, atribución geográfica por países, filtros fotográficos y controles de audio para video.
          </p>
        </div>

        {/* Header Actions: Quick Report Pre-fill Dropdown & JSON Backup buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* JSON Export / Import Buttons */}
          <div className="flex items-center gap-1.5 bg-neutral-950 border border-white/10 p-1 rounded-xl shadow-lg">
            <button
              type="button"
              onClick={handleCopyJson}
              className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-neutral-200 hover:text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer border border-white/5"
              title="Copiar configuración completa del post como JSON"
            >
              <Copy className="w-3.5 h-3.5 text-amber-400" />
              <span>Copiar JSON</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setJsonError(null);
                setJsonInputText('');
                setIsJsonModalOpen(true);
              }}
              className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-neutral-200 hover:text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer border border-white/5"
              title="Pegar o restaurar configuración desde JSON"
            >
              <FileCode className="w-3.5 h-3.5 text-cyan-400" />
              <span>Pegar JSON</span>
            </button>
          </div>

          {/* Quick Report Pre-fill Dropdown */}
          {reports.length > 0 && (
            <div className="flex items-center gap-2 bg-neutral-950 border border-white/10 rounded-xl p-2 max-w-xs shadow-lg">
              <FileText className="w-4 h-4 text-neutral-400 shrink-0 ml-1" />
              <select
                onChange={(e) => handleLoadFromReport(e.target.value)}
                defaultValue=""
                className="bg-transparent text-xs text-neutral-200 focus:outline-none cursor-pointer truncate max-w-[190px] font-medium"
              >
                <option value="" disabled className="bg-neutral-900 text-neutral-400">
                  ⚡ Autocompletar desde despacho...
                </option>
                {reports.map((r) => (
                  <option key={r.id} value={r.id} className="bg-neutral-900 text-white">
                    {r.category}: {r.title}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-white text-black px-4 py-2.5 text-xs font-sans font-medium rounded-xl border border-neutral-200 shadow-2xl flex items-center gap-2 animate-in fade-in">
          <span className="w-2 h-2 rounded-full bg-black inline-block"></span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Grid: Controls (Left) vs Live Preview (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COLUMN: Controls & Settings (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Card 1: Text Content & Typography */}
          <div className="bg-neutral-950/80 border border-white/10 rounded-2xl p-5 sm:p-6 space-y-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-white" />
                <span>1. Contenido Editorial & Tipografía</span>
              </h3>
              <span className="text-[11px] text-neutral-400 font-mono">
                Lexend Bold & Medium
              </span>
            </div>

            {/* Headline / Titular */}
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-xs font-semibold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Type className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Titular (Lexend Bold)</span>
                </label>

                {/* Real-time size control & presets */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-white bg-neutral-900 px-2 py-0.5 rounded-lg border border-white/10">
                    {fontSizeTitle}px
                  </span>
                  <input
                    type="range"
                    min={42}
                    max={82}
                    value={fontSizeTitle}
                    onChange={(e) => setFontSizeTitle(Number(e.target.value))}
                    className="w-24 accent-white h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                    title="Ajustar tamaño en tiempo real"
                  />
                  <div className="flex items-center gap-1">
                    {[48, 62, 74].map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => setFontSizeTitle(sz)}
                        className={`px-1.5 py-0.5 text-[10px] font-mono rounded transition-colors ${
                          fontSizeTitle === sz
                            ? 'bg-white text-black font-bold'
                            : 'bg-neutral-900 text-neutral-400 hover:text-white'
                        }`}
                      >
                        {sz === 48 ? 'S' : sz === 62 ? 'M' : 'L'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <textarea
                rows={3}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Titular en impacto directo..."
                className="w-full bg-neutral-900 border border-white/10 rounded-xl p-3.5 text-sm sm:text-base font-bold text-white leading-snug focus:outline-none focus:border-white/40 resize-none font-['Lexend']"
              />
              <span className="text-[11px] text-neutral-500 font-light block">
                Presiona Enter para romper la línea exactamente donde quieras equilibrar el texto.
              </span>
            </div>

            {/* Description / Bajada */}
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-xs font-semibold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Descripción / Bajada (Lexend Normal)</span>
                </label>

                {/* Real-time size control */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-white bg-neutral-900 px-2 py-0.5 rounded-lg border border-white/10">
                    {fontSizeDesc}px
                  </span>
                  <input
                    type="range"
                    min={20}
                    max={42}
                    value={fontSizeDesc}
                    onChange={(e) => setFontSizeDesc(Number(e.target.value))}
                    className="w-24 accent-white h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                    title="Ajustar tamaño en tiempo real"
                  />
                  <div className="flex items-center gap-1">
                    {[24, 30, 38].map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => setFontSizeDesc(sz)}
                        className={`px-1.5 py-0.5 text-[10px] font-mono rounded transition-colors ${
                          fontSizeDesc === sz
                            ? 'bg-white text-black font-bold'
                            : 'bg-neutral-900 text-neutral-400 hover:text-white'
                        }`}
                      >
                        {sz === 24 ? 'S' : sz === 30 ? 'M' : 'L'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detalle o contexto clave que complementa el titular..."
                className="w-full bg-neutral-900 border border-white/10 rounded-xl p-3.5 text-xs sm:text-sm font-normal text-neutral-200 leading-relaxed focus:outline-none focus:border-white/40 resize-none font-['Lexend']"
              />
            </div>

            {/* Spacing & Interlineado Sub-section */}
            <div className="pt-3 border-t border-white/5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Espaciado entre Textos (1:1 con la exportación)</span>
                </span>
                <span className="text-[10px] text-neutral-400 font-mono">
                  Sep: {gapTitleToDesc}px · Interl: {titleLineHeightRatio}x
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-neutral-900/60 p-3 rounded-xl border border-white/5">
                {/* Gap Title to Desc */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-neutral-400">Separación Titular ↔ Bajada</span>
                    <span className="font-mono text-white font-bold">{gapTitleToDesc}px</span>
                  </div>
                  <input
                    type="range"
                    min={12}
                    max={56}
                    value={gapTitleToDesc}
                    onChange={(e) => setGapTitleToDesc(Number(e.target.value))}
                    className="w-full accent-white h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                  />
                  <div className="flex items-center gap-1">
                    {[16, 26, 38].map((gap) => (
                      <button
                        key={gap}
                        type="button"
                        onClick={() => setGapTitleToDesc(gap)}
                        className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                          gapTitleToDesc === gap
                            ? 'bg-white text-black font-bold'
                            : 'bg-neutral-800 text-neutral-400 hover:text-white'
                        }`}
                      >
                        {gap === 16 ? 'Compacto' : gap === 26 ? 'Equilibrado' : 'Amplio'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Gap Category to Title */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-neutral-400">Separación Cabecera ↔ Titular</span>
                    <span className="font-mono text-white font-bold">{gapCategoryToTitle}px</span>
                  </div>
                  <input
                    type="range"
                    min={16}
                    max={48}
                    value={gapCategoryToTitle}
                    onChange={(e) => setGapCategoryToTitle(Number(e.target.value))}
                    className="w-full accent-white h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                  />
                  <div className="flex items-center gap-1">
                    {[22, 30, 40].map((gap) => (
                      <button
                        key={gap}
                        type="button"
                        onClick={() => setGapCategoryToTitle(gap)}
                        className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                          gapCategoryToTitle === gap
                            ? 'bg-white text-black font-bold'
                            : 'bg-neutral-800 text-neutral-400 hover:text-white'
                        }`}
                      >
                        {gap === 22 ? 'Pegado' : gap === 30 ? 'Estándar' : 'Holgado'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Line height presets */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px]">
                <div className="flex items-center gap-2">
                  <span className="text-neutral-400">Interlineado Titular:</span>
                  <div className="flex items-center gap-1 bg-black/40 p-0.5 rounded-lg border border-white/5">
                    {[1.12, 1.18, 1.25].map((ratio) => (
                      <button
                        key={ratio}
                        type="button"
                        onClick={() => setTitleLineHeightRatio(ratio)}
                        className={`px-2 py-0.5 text-[10px] font-mono rounded transition-colors ${
                          titleLineHeightRatio === ratio
                            ? 'bg-white text-black font-bold'
                            : 'text-neutral-400 hover:text-white'
                        }`}
                      >
                        {ratio}x
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-neutral-400">Interlineado Bajada:</span>
                  <div className="flex items-center gap-1 bg-black/40 p-0.5 rounded-lg border border-white/5">
                    {[1.32, 1.42, 1.54].map((ratio) => (
                      <button
                        key={ratio}
                        type="button"
                        onClick={() => setDescLineHeightRatio(ratio)}
                        className={`px-2 py-0.5 text-[10px] font-mono rounded transition-colors ${
                          descLineHeightRatio === ratio
                            ? 'bg-white text-black font-bold'
                            : 'text-neutral-400 hover:text-white'
                        }`}
                      >
                        {ratio}x
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Categorías & Atribución de Países */}
          <div className="bg-neutral-950/80 border border-white/10 rounded-2xl p-5 sm:p-6 space-y-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                <Globe className="w-4 h-4 text-white" />
                <span>2. Sección Editorial & Países Involucrados</span>
              </h3>
              <span className="text-[11px] text-neutral-400 font-mono">
                {allAvailableCategories.length} Secciones
              </span>
            </div>

            {/* Category selection */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block">
                Sección Editorial (Escribe o elige una)
              </label>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value.toUpperCase())}
                  placeholder="Ej: GEOPOLÍTICA, DEFENSA & INTELIGENCIA..."
                  className="flex-1 bg-neutral-900 border border-white/10 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-semibold text-white tracking-widest uppercase focus:outline-none focus:border-white/40"
                />

                <select
                  onChange={(e) => {
                    if (e.target.value) setCategory(e.target.value);
                  }}
                  value=""
                  className="bg-neutral-900 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-neutral-300 focus:outline-none cursor-pointer max-w-[150px] sm:max-w-xs truncate"
                >
                  <option value="" disabled>
                    Elegir del catálogo ({allAvailableCategories.length})
                  </option>
                  {allAvailableCategories.map((c) => (
                    <option key={c} value={c} className="bg-neutral-900 text-white">
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* Quick Category Chips */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {['GEOPOLÍTICA', 'ECONOMÍA & MERCADOS', 'DEFENSA & INTELIGENCIA', 'TECNOLOGÍA & INNOVACIÓN', 'ENERGÍA & PETRÓLEO', 'CRIPTOACTIVOS & SOBERANÍA', 'COMERCIO GLOBAL'].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategory(c)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold tracking-wide transition-all cursor-pointer ${
                      category === c
                        ? 'bg-white text-black font-bold shadow-sm'
                        : 'bg-neutral-900 text-neutral-400 hover:text-white border border-white/5'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Countries Section */}
            <div className="space-y-3 pt-3 border-t border-white/5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <label className="text-xs font-semibold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-neutral-400" />
                    <span>Países o Regiones del Acontecimiento</span>
                  </label>
                  <p className="text-[11px] text-neutral-400 font-light">
                    Muestra a qué actores internacionales corresponde la noticia (ej. Israel e Irán).
                  </p>
                </div>

                {/* Country Display Placement */}
                <div className="flex items-center gap-1.5 bg-neutral-900 p-1 rounded-xl border border-white/10 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setCountryPlacement('line')}
                    className={`px-2 py-1 rounded-lg transition-colors cursor-pointer ${
                      countryPlacement === 'line'
                        ? 'bg-white text-black font-bold'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                    title="Mostrar en la barra superior junto a la categoría"
                  >
                    En Línea
                  </button>
                  <button
                    type="button"
                    onClick={() => setCountryPlacement('badge')}
                    className={`px-2 py-1 rounded-lg transition-colors cursor-pointer ${
                      countryPlacement === 'badge'
                        ? 'bg-white text-black font-bold'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                    title="Mostrar como etiqueta destacada sobre el titular"
                  >
                    Insignia
                  </button>
                  <button
                    type="button"
                    onClick={() => setCountryPlacement('none')}
                    className={`px-2 py-1 rounded-lg transition-colors cursor-pointer ${
                      countryPlacement === 'none'
                        ? 'bg-white text-black font-bold'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                    title="Ocultar mención de países"
                  >
                    Ocultar
                  </button>
                </div>
              </div>

              {/* Single-line Format & Sizing Controls (When 'line' placement is active) */}
              {countryPlacement === 'line' && selectedCountries.length > 0 && (
                <div className="p-3 bg-neutral-900/90 rounded-xl border border-white/10 space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <span className="text-neutral-300 font-semibold uppercase tracking-wider text-[11px]">
                      Estilo de países en línea
                    </span>
                    <div className="flex items-center gap-1 bg-black/40 p-1 rounded-lg border border-white/5">
                      <button
                        type="button"
                        onClick={() => setCountryFormat('names')}
                        className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                          countryFormat === 'names'
                            ? 'bg-white text-black font-bold'
                            : 'text-neutral-400 hover:text-white'
                        }`}
                        title="Solo nombres: ISRAEL · IRÁN"
                      >
                        Nombres
                      </button>
                      <button
                        type="button"
                        onClick={() => setCountryFormat('flags-names')}
                        className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                          countryFormat === 'flags-names'
                            ? 'bg-white text-black font-bold'
                            : 'text-neutral-400 hover:text-white'
                        }`}
                        title="Banderas y nombres: 🇮🇱 ISRAEL · 🇮🇷 IRÁN"
                      >
                        Banderas + Nombres
                      </button>
                      <button
                        type="button"
                        onClick={() => setCountryFormat('flags-codes')}
                        className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                          countryFormat === 'flags-codes'
                            ? 'bg-white text-black font-bold'
                            : 'text-neutral-400 hover:text-white'
                        }`}
                        title="Ultra compacto para muchos países: 🇮🇱 IL · 🇮🇷 IR"
                      >
                        Códigos (Compacto)
                      </button>
                    </div>
                  </div>

                  {/* Header Auto-Fit vs Manual Size */}
                  <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[11px]">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="autoFitCheck"
                        checked={autoFitHeader}
                        onChange={(e) => setAutoFitHeader(e.target.checked)}
                        className="w-3.5 h-3.5 accent-white rounded cursor-pointer"
                      />
                      <label htmlFor="autoFitCheck" className="text-neutral-300 font-medium cursor-pointer">
                        Ajuste automático inteligente a 1 sola línea (garantiza que quepan todos)
                      </label>
                    </div>

                    {!autoFitHeader && (
                      <div className="flex items-center gap-2">
                        <span className="text-neutral-400 font-mono">{headerSize}px</span>
                        <input
                          type="range"
                          min={12}
                          max={26}
                          value={headerSize}
                          onChange={(e) => setHeaderSize(Number(e.target.value))}
                          className="w-20 accent-white h-1 bg-neutral-800 rounded-lg cursor-pointer"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Selected Countries Badges */}
              {selectedCountries.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2 p-3 bg-neutral-900/90 rounded-xl border border-white/10">
                  <span className="text-[11px] text-neutral-400 uppercase font-mono mr-1">
                    Activos:
                  </span>
                  {selectedCountries.map((c) => (
                    <span
                      key={c.code}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/10 text-white rounded-lg text-xs font-semibold border border-white/15"
                    >
                      <CountryFlag code={c.code} className="w-4 h-2.5 object-cover rounded-[1px] inline-block shadow-xs" fallback="📍" />
                      <span>{c.name}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveCountry(c.code)}
                        className="hover:text-red-400 transition-colors ml-0.5 cursor-pointer"
                        title={`Quitar ${c.name}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  <button
                    type="button"
                    onClick={() => setSelectedCountries([])}
                    className="text-[11px] text-neutral-500 hover:text-neutral-300 ml-auto underline cursor-pointer"
                  >
                    Limpiar todos
                  </button>
                </div>
              ) : (
                <div className="p-3 bg-neutral-900/40 rounded-xl border border-dashed border-white/10 text-xs text-neutral-500 text-center">
                  Ningún país seleccionado actualmente. Haz clic en los botones de abajo o escribe uno personalizado.
                </div>
              )}

              {/* Country Search & Quick Adder */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={countrySearch}
                  onChange={(e) => setCountrySearch(e.target.value)}
                  placeholder="Filtrar países (ej. Israel, Irán, EE.UU., China...)"
                  className="flex-1 bg-neutral-900 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-white/30"
                />

                <form onSubmit={handleAddCustomCountry} className="flex items-center gap-1">
                  <input
                    type="text"
                    value={customCountryName}
                    onChange={(e) => setCustomCountryName(e.target.value)}
                    placeholder="Otro país..."
                    className="w-28 sm:w-36 bg-neutral-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-white/30"
                  />
                  <button
                    type="submit"
                    className="p-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl cursor-pointer transition-colors"
                    title="Añadir país personalizado"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>

              {/* Popular Countries Grid Chips */}
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1 bg-black/40 rounded-xl border border-white/5">
                {filteredCountries.map((c) => {
                  const isSelected = selectedCountries.some(
                    (item) => item.code === c.code || item.name.toLowerCase() === c.name.toLowerCase()
                  );
                  return (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => handleToggleCountry(c)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-white text-black font-bold shadow-sm'
                          : 'bg-neutral-900 text-neutral-300 hover:bg-neutral-850 hover:text-white border border-white/5'
                      }`}
                    >
                      <CountryFlag code={c.code} className="w-3.5 h-2.5 object-cover rounded-[1px] inline-block shadow-xs" fallback="📍" />
                      <span>{c.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Card 3: Media Upload (Image or Video) */}
          <div className="bg-neutral-950/80 border border-white/10 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                <Upload className="w-4 h-4 text-white" />
                <span>3. Imagen o Video (Arrastra o Selecciona)</span>
              </h3>
              <span className="text-[11px] text-neutral-400 font-mono">
                {mediaType === 'video' ? '🎬 Modo Video' : '🖼️ Modo Imagen'}
              </span>
            </div>

            {/* Drag & Drop Zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-all ${
                isDragOver
                  ? 'border-white bg-white/10'
                  : 'border-white/15 bg-neutral-900/60 hover:border-white/30 hover:bg-neutral-900'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFile(e.target.files[0]);
                  }
                }}
                className="hidden"
              />

              <div className="flex flex-col items-center justify-center gap-2">
                <div className="p-3 bg-white/5 rounded-2xl text-white">
                  {mediaType === 'video' ? (
                    <VideoIcon className="w-6 h-6" />
                  ) : (
                    <ImageIcon className="w-6 h-6" />
                  )}
                </div>
                <p className="text-xs sm:text-sm font-semibold text-white">
                  Arrastra aquí tu imagen o video, o haz clic para explorar
                </p>
                <p className="text-[11px] text-neutral-400 font-light">
                  Soporta PNG, JPG, WebP, AVIF, MP4 y WebM · También puedes pegar con Ctrl+V
                </p>
              </div>
            </div>

            {/* Current loaded media bar */}
            <div className="flex items-center justify-between bg-neutral-900/80 px-4 py-2.5 rounded-xl border border-white/5 text-xs">
              <span className="text-neutral-400 truncate max-w-xs font-mono">
                Archivo actual: <strong className="text-white">{mediaName}</strong>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMediaType('image');
                    setMediaSrc('https://images.unsplash.com/photo-1541872703-74c5e44368f9?auto=format&fit=crop&w=1200&q=80');
                    setMediaName('Imagen de muestra');
                  }}
                  className="text-neutral-400 hover:text-white transition-colors cursor-pointer text-[11px] underline"
                >
                  Restablecer muestra
                </button>
              </div>
            </div>

            {/* Pie de foto / Personaje o Crédito */}
            <div className="pt-3 border-t border-white/5 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Pie de Foto / Personaje o Crédito (Opcional)</span>
                </label>
                {photoCaption && (
                  <button
                    type="button"
                    onClick={() => setPhotoCaption('')}
                    className="text-[11px] text-neutral-500 hover:text-neutral-300 underline cursor-pointer"
                  >
                    Borrar
                  </button>
                )}
              </div>
              <p className="text-[11px] text-neutral-400 font-light">
                Aparece en la base de la foto a la misma altura del logo BlackNews (a la izquierda), compacto y alineado a la derecha. Dejar vacío si no hay personaje.
              </p>
              <input
                type="text"
                value={photoCaption}
                onChange={(e) => setPhotoCaption(e.target.value)}
                placeholder="Ej: Benjamin Netanyahu · Primer Ministro (o dejar en blanco)"
                className="w-full bg-neutral-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-white/30 font-['Lexend']"
              />
            </div>
          </div>

          {/* Card 4: Filtros & Ajustes */}
          <div className="bg-neutral-950/80 border border-white/10 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xl">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <Palette className="w-4 h-4 text-white" />
              <span>4. Filtros Fotográficos & Control de Audio</span>
            </h3>

            {/* Filter buttons */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block">
                Filtro Editorial (Sin Color / B&N)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setFilter('bw-high')}
                  className={`px-3 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    filter === 'bw-high'
                      ? 'bg-white text-black font-bold shadow-md'
                      : 'bg-neutral-900 text-neutral-300 hover:bg-neutral-850 border border-white/10'
                  }`}
                >
                  <span>B&N Contraste</span>
                  <span className="text-[10px] opacity-70">(Ref.)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFilter('bw-smooth')}
                  className={`px-3 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    filter === 'bw-smooth'
                      ? 'bg-white text-black font-bold shadow-md'
                      : 'bg-neutral-900 text-neutral-300 hover:bg-neutral-850 border border-white/10'
                  }`}
                >
                  <span>Sin Color Suave</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFilter('noir')}
                  className={`px-3 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    filter === 'noir'
                      ? 'bg-white text-black font-bold shadow-md'
                      : 'bg-neutral-900 text-neutral-300 hover:bg-neutral-850 border border-white/10'
                  }`}
                >
                  <span>Noir Profundo</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFilter('color')}
                  className={`px-3 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    filter === 'color'
                      ? 'bg-white text-black font-bold shadow-md'
                      : 'bg-neutral-900 text-neutral-300 hover:bg-neutral-850 border border-white/10'
                  }`}
                >
                  <span>Color Original</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFilter('muted-color')}
                  className={`px-3 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer col-span-2 sm:col-span-1 ${
                    filter === 'muted-color'
                      ? 'bg-white text-black font-bold shadow-md'
                      : 'bg-neutral-900 text-neutral-300 hover:bg-neutral-850 border border-white/10'
                  }`}
                >
                  <span>Color Desaturado</span>
                </button>
              </div>
            </div>

            {/* Video Audio Control & Social Networks Optimization */}
            {mediaType === 'video' && (
              <div className="space-y-3.5 p-4 bg-neutral-900/90 border border-white/15 rounded-xl">
                {/* Audio row */}
                <div className="flex items-center justify-between pb-3 border-b border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/10 rounded-xl text-white">
                      {isMuted ? <VolumeX className="w-5 h-5 text-amber-400" /> : <Volume2 className="w-5 h-5 text-emerald-400" />}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                        Audio del Video
                      </h4>
                      <p className="text-[11px] text-neutral-400 font-light">
                        {isMuted ? 'El video se exportará sin audio (silenciado).' : 'El video conservará su pista de audio original.'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setIsMuted(!isMuted);
                      if (videoRef.current) {
                        videoRef.current.muted = !isMuted;
                      }
                    }}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1.5 ${
                      isMuted
                        ? 'bg-neutral-900 text-neutral-400 border border-white/15 hover:text-white'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    }`}
                  >
                    {isMuted ? '🔇 Silenciado' : '🔊 Con Audio (Activo)'}
                  </button>
                </div>

                {/* Video Format Selector (MP4 for X/Twitter vs WebM) */}
                <div className="space-y-1.5 pt-0.5">
                  <div className="flex items-center justify-between text-xs">
                    <label className="font-semibold text-neutral-200 uppercase tracking-wider flex items-center gap-1.5">
                      <Film className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Formato de Video</span>
                    </label>
                    <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20 font-bold">
                      {videoFormat === 'mp4' ? 'MP4 (H.264 / AAC) · 100% X (Twitter) & Meta' : 'WebM (VP9) · Web abierta'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setVideoFormat('mp4')}
                      className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
                        videoFormat === 'mp4'
                          ? 'bg-white text-black border-white shadow-md'
                          : 'bg-neutral-950 text-neutral-300 border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="text-[11px] font-bold uppercase tracking-wider flex items-center justify-between">
                        <span>MP4 (.mp4)</span>
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500 text-black text-[9px] font-extrabold tracking-normal">
                          PARA X / TWITTER
                        </span>
                      </div>
                      <div className={`text-[10px] mt-1 ${videoFormat === 'mp4' ? 'text-neutral-700 font-medium' : 'text-neutral-500'}`}>
                        Compatible con X, Instagram, Facebook y WhatsApp sin errores de formato
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setVideoFormat('webm')}
                      className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
                        videoFormat === 'webm'
                          ? 'bg-white text-black border-white shadow-md'
                          : 'bg-neutral-950 text-neutral-300 border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="text-[11px] font-bold uppercase tracking-wider">WebM (.webm)</div>
                      <div className={`text-[10px] mt-1 ${videoFormat === 'webm' ? 'text-neutral-700 font-medium' : 'text-neutral-500'}`}>
                        Formato web abierto para Chrome o navegadores de escritorio
                      </div>
                    </button>
                  </div>
                </div>

                {/* Social Media Bitrate & Weight Optimization */}
                <div className="space-y-2 pt-0.5">
                  <div className="flex items-center justify-between text-xs">
                    <label className="font-semibold text-neutral-200 uppercase tracking-wider flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      <span>Optimización para X, Instagram & Meta</span>
                    </label>
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-bold">
                      {videoQuality === 'social' ? '3 Mbps · ~4 MB / 10 s' : videoQuality === 'compact' ? '1.5 Mbps · ~2 MB / 10 s' : '6 Mbps · ~7.5 MB / 10 s'}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setVideoQuality('social')}
                      className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
                        videoQuality === 'social'
                          ? 'bg-white text-black border-white shadow-md'
                          : 'bg-neutral-950 text-neutral-300 border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="text-[11px] font-bold uppercase tracking-wider">Redes Sociales</div>
                      <div className={`text-[10px] ${videoQuality === 'social' ? 'text-neutral-700 font-medium' : 'text-neutral-500'}`}>
                        Equilibrado (X / Insta)
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setVideoQuality('compact')}
                      className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
                        videoQuality === 'compact'
                          ? 'bg-white text-black border-white shadow-md'
                          : 'bg-neutral-950 text-neutral-300 border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="text-[11px] font-bold uppercase tracking-wider">Ultra Ligero</div>
                      <div className={`text-[10px] ${videoQuality === 'compact' ? 'text-neutral-700 font-medium' : 'text-neutral-500'}`}>
                        WhatsApp / Web rápida
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setVideoQuality('hq')}
                      className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
                        videoQuality === 'hq'
                          ? 'bg-white text-black border-white shadow-md'
                          : 'bg-neutral-950 text-neutral-300 border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="text-[11px] font-bold uppercase tracking-wider">Master HQ</div>
                      <div className={`text-[10px] ${videoQuality === 'hq' ? 'text-neutral-700 font-medium' : 'text-neutral-500'}`}>
                        Bitrate alto (6M)
                      </div>
                    </button>
                  </div>
                </div>

                {/* Video Playback & Export Speed */}
                <div className="space-y-1.5 pt-1 border-t border-white/5">
                  <div className="flex items-center justify-between text-xs">
                    <label className="font-semibold text-neutral-200 uppercase tracking-wider flex items-center gap-1.5">
                      <Gauge className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Velocidad de Video</span>
                    </label>
                    <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20 font-bold">
                      {videoSpeed === 1.0 ? '1.0x (Normal)' : videoSpeed < 1.0 ? `${videoSpeed}x (Lento)` : `${videoSpeed}x (Rápido)`}
                    </span>
                  </div>

                  <div className="grid grid-cols-6 gap-1">
                    {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map((speed) => (
                      <button
                        key={speed}
                        type="button"
                        onClick={() => {
                          setVideoSpeed(speed);
                          if (videoRef.current) {
                            videoRef.current.playbackRate = speed;
                          }
                          showToast(`Velocidad ajustada a ${speed}x`);
                        }}
                        className={`py-1.5 text-[11px] font-mono rounded-lg transition-colors cursor-pointer border text-center ${
                          videoSpeed === speed
                            ? 'bg-white text-black font-bold border-white shadow-sm'
                            : 'bg-neutral-950 text-neutral-400 border-white/10 hover:text-white'
                        }`}
                      >
                        {speed}x
                      </button>
                    ))}
                  </div>
                </div>

                {/* Video Trimmer (Start & End) */}
                <div className="space-y-2.5 pt-2 border-t border-white/5">
                  <div className="flex items-center justify-between text-xs">
                    <label className="font-semibold text-neutral-200 uppercase tracking-wider flex items-center gap-1.5">
                      <Scissors className="w-3.5 h-3.5 text-amber-400" />
                      <span>Recorte del Video (Rango de Reproducción)</span>
                    </label>
                    <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 font-bold">
                      {videoDuration > 0 ? `Total: ${videoDuration}s` : 'Video cargado'}
                    </span>
                  </div>

                  {/* Dual Sliders / Range Controls */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-black/40 p-3 rounded-xl border border-white/5">
                    {/* Trim Start */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-neutral-400">Punto de Inicio:</span>
                        <span className="font-mono text-white font-bold">{trimStart.toFixed(1)}s</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={Math.max(0.1, (trimEnd > 0 ? trimEnd - 0.5 : (videoDuration || 30)))}
                        step={0.1}
                        value={trimStart}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setTrimStart(val);
                          if (videoRef.current) {
                            videoRef.current.currentTime = val;
                          }
                        }}
                        className="w-full accent-amber-400 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (videoRef.current) {
                            const cur = Math.round(videoRef.current.currentTime * 10) / 10;
                            if (cur < (trimEnd > 0 ? trimEnd : 999)) {
                              setTrimStart(cur);
                              showToast(`Inicio fijado en ${cur}s`);
                            }
                          }
                        }}
                        className="text-[10px] text-amber-400/90 hover:text-amber-300 transition-colors flex items-center gap-1 cursor-pointer pt-0.5"
                      >
                        ⏱️ Fijar inicio en segundo actual
                      </button>
                    </div>

                    {/* Trim End */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-neutral-400">Punto de Fin:</span>
                        <span className="font-mono text-white font-bold">{trimEnd > 0 ? trimEnd.toFixed(1) : (videoDuration || 10).toFixed(1)}s</span>
                      </div>
                      <input
                        type="range"
                        min={Math.max(0.5, trimStart + 0.5)}
                        max={videoDuration > 0 ? videoDuration : 60}
                        step={0.1}
                        value={trimEnd > 0 ? trimEnd : (videoDuration || 10)}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setTrimEnd(val);
                          if (videoRef.current) {
                            videoRef.current.currentTime = val;
                          }
                        }}
                        className="w-full accent-amber-400 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (videoRef.current) {
                            const cur = Math.round(videoRef.current.currentTime * 10) / 10;
                            if (cur > trimStart) {
                              setTrimEnd(cur);
                              showToast(`Fin fijado en ${cur}s`);
                            }
                          }
                        }}
                        className="text-[10px] text-amber-400/90 hover:text-amber-300 transition-colors flex items-center gap-1 cursor-pointer pt-0.5"
                      >
                        ⏱️ Fijar fin en segundo actual
                      </button>
                    </div>
                  </div>

                  {/* Summary badge & presets */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5 text-[11px]">
                    <span className="text-neutral-300 font-medium">
                      ✂️ Clip: <strong className="text-white">{(Math.max(0, (trimEnd > 0 ? trimEnd : (videoDuration || 10)) - trimStart)).toFixed(1)}s</strong> {videoSpeed !== 1.0 && <span className="text-neutral-400 font-normal">(con {videoSpeed}x dura {(((Math.max(0, (trimEnd > 0 ? trimEnd : (videoDuration || 10)) - trimStart))) / videoSpeed).toFixed(1)}s)</span>}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setTrimStart(0);
                          setTrimEnd(Math.min(videoDuration || 10, 5));
                          if (videoRef.current) videoRef.current.currentTime = 0;
                        }}
                        className="px-2 py-0.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded text-[10px] transition-colors"
                      >
                        5s
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTrimStart(0);
                          setTrimEnd(Math.min(videoDuration || 10, 10));
                          if (videoRef.current) videoRef.current.currentTime = 0;
                        }}
                        className="px-2 py-0.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded text-[10px] transition-colors"
                      >
                        10s
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTrimStart(0);
                          setTrimEnd(Math.min(videoDuration || 30, 30));
                          if (videoRef.current) videoRef.current.currentTime = 0;
                        }}
                        className="px-2 py-0.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded text-[10px] transition-colors"
                      >
                        30s
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTrimStart(0);
                          setTrimEnd(videoDuration || 15);
                          if (videoRef.current) videoRef.current.currentTime = 0;
                        }}
                        className="px-2 py-0.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded text-[10px] transition-colors"
                      >
                        Completo
                      </button>
                    </div>
                  </div>
                </div>

                {/* Duration Limiter */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-neutral-300 font-medium">Duración máxima del clip de noticia:</span>
                    <span className="text-[11px] font-mono text-neutral-400">
                      {maxVideoDuration > 0 ? `${maxVideoDuration} segundos` : 'Video completo'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                    {[5, 10, 15, 30, 60, 0].map((dur) => (
                      <button
                        key={dur}
                        type="button"
                        onClick={() => setMaxVideoDuration(dur)}
                        className={`py-1.5 text-[11px] font-mono rounded-lg transition-colors cursor-pointer border ${
                          maxVideoDuration === dur
                            ? 'bg-white text-black font-bold border-white'
                            : 'bg-neutral-950 text-neutral-400 border-white/10 hover:text-white'
                        }`}
                      >
                        {dur === 0 ? 'Completo' : `${dur}s`}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10.5px] text-neutral-400 font-light pt-0.5">
                    💡 <strong>Tip para X e Instagram:</strong> Los clips de 10 segundos en bucle consiguen alta retención y evitan que el algoritmo de compresión de Meta destruya la calidad del video.
                  </p>
                </div>
              </div>
            )}

            {/* Sliders for exposure & blend fade */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-neutral-400">
                  <span>Contraste</span>
                  <span className="font-mono text-white">{contrast}%</span>
                </div>
                <input
                  type="range"
                  min={80}
                  max={180}
                  value={contrast}
                  onChange={(e) => setContrast(Number(e.target.value))}
                  className="w-full accent-white h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs text-neutral-400">
                  <span>Brillo</span>
                  <span className="font-mono text-white">{brightness}%</span>
                </div>
                <input
                  type="range"
                  min={60}
                  max={140}
                  value={brightness}
                  onChange={(e) => setBrightness(Number(e.target.value))}
                  className="w-full accent-white h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                />
              </div>
            </div>

            {/* Fade toggle */}
            <div className="flex items-center justify-between pt-2 border-t border-white/5">
              <div>
                <span className="text-xs font-semibold text-neutral-200 block">
                  Desvanecimiento superior hacia negro (Gradient Mask)
                </span>
                <span className="text-[11px] text-neutral-400 font-light">
                  Difumina sutilmente el horizonte de la imagen contra el fondo negro superior.
                </span>
              </div>
              <input
                type="checkbox"
                checked={blendFade}
                onChange={(e) => setBlendFade(e.target.checked)}
                className="w-4 h-4 accent-white rounded cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Live Interactive 4:5 Preview (5 cols) */}
        <div className="lg:col-span-5 sticky top-8 space-y-4">
          
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-white" />
              <span>Vista Previa en Vivo 4:5</span>
            </span>
            <span className="text-[11px] font-mono text-neutral-400">
              Titular: {fontSizeTitle}px · Bajada: {fontSizeDesc}px
            </span>
          </div>

          {/* THE 4:5 CARD CONTAINER */}
          <div 
            ref={previewContainerRef}
            className="w-full max-w-[420px] mx-auto aspect-[4/5] bg-black rounded-2xl overflow-hidden relative border border-white/20 shadow-2xl flex flex-col justify-between select-none"
            style={{ backgroundColor: '#000000' }}
          >
            {/* Top Text Content Area (1:1 with canvas metrics) */}
            <div 
              style={{
                paddingTop: `${previewPadTop}px`,
                paddingLeft: `${previewPadX}px`,
                paddingRight: `${previewPadX}px`
              }}
              className="z-20 relative select-none"
            >
              {/* Category + Country Single-line Bar */}
              <div className="flex items-center gap-2 w-full overflow-hidden whitespace-nowrap min-w-0">
                <span 
                  style={{ 
                    fontSize: `${previewHeaderSize}px`, 
                    letterSpacing: previewHeaderTracking 
                  }}
                  className="font-semibold uppercase text-white font-['Lexend'] shrink-0 select-none"
                >
                  {category || 'GEOPOLÍTICA'}
                </span>

                {countryPlacement === 'line' && selectedCountries.length > 0 && (
                  <>
                    <span 
                      style={{ fontSize: `${previewHeaderSize}px` }} 
                      className="text-neutral-500 shrink-0 font-mono px-0.5"
                    >
                      ·
                    </span>
                    <div 
                      style={{ 
                        fontSize: `${previewHeaderSize}px`, 
                        letterSpacing: previewHeaderTracking 
                      }}
                      className="inline-flex items-center gap-1.5 font-semibold uppercase text-neutral-300 font-['Lexend'] truncate shrink min-w-0 select-none"
                    >
                      {selectedCountries.map((c, idx) => (
                        <React.Fragment key={c.code}>
                          {idx > 0 && <span className="text-neutral-500 text-[10px]">·</span>}
                          <span className="inline-flex items-center gap-1 shrink-0">
                            {countryFormat !== 'names' && (
                              <CountryFlag 
                                code={c.code} 
                                className="w-3.5 h-2.5 object-cover rounded-[1px] inline-block shadow-xs" 
                              />
                            )}
                            <span>{countryFormat === 'flags-codes' ? c.code : c.name.toUpperCase()}</span>
                          </span>
                        </React.Fragment>
                      ))}
                    </div>
                  </>
                )}

                <span className="flex-1 max-w-[50px] min-w-[16px] h-[1.5px] bg-white inline-block shrink-0"></span>
              </div>

              {/* Country Badge (if badge placement is selected) */}
              {countryPlacement === 'badge' && selectedCountries.length > 0 && (
                <div 
                  style={{ marginTop: `${Math.round(14 * previewScale)}px` }}
                  className="flex flex-wrap items-center gap-1.5"
                >
                  {selectedCountries.map((c) => (
                    <span
                      key={c.code}
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-white/10 text-neutral-200 rounded text-[10px] font-semibold tracking-wide border border-white/15"
                    >
                      <CountryFlag code={c.code} className="w-3.5 h-2.5 object-cover rounded-[1px]" />
                      <span>{c.name.toUpperCase()}</span>
                    </span>
                  ))}
                </div>
              )}

              {/* Title with dynamic Real-time Font Size and Spacing */}
              <h1 
                style={{ 
                  marginTop: `${previewGapCatTitle}px`,
                  fontSize: `${previewTitleSize}px`, 
                  lineHeight: titleLineHeightRatio 
                }}
                className="font-bold text-white font-['Lexend'] whitespace-pre-line tracking-tight drop-shadow-sm transition-[font-size,margin]"
              >
                {title || 'Escribe un titular impactante...'}
              </h1>

              {/* Description with dynamic Real-time Font Size and Spacing */}
              {description && (
                <p 
                  style={{ 
                    marginTop: `${previewGapTitleDesc}px`,
                    fontSize: `${previewDescSize}px`, 
                    lineHeight: descLineHeightRatio 
                  }}
                  className="text-neutral-300 font-normal font-['Lexend'] line-clamp-5 transition-[font-size,margin]"
                >
                  {description}
                </p>
              )}
            </div>

            {/* Media Container (Occupies bottom half with smooth fade) */}
            <div className="absolute inset-0 top-[40%] overflow-hidden z-0">
              {mediaType === 'video' ? (
                <video
                  ref={videoRef}
                  src={mediaSrc}
                  crossOrigin={mediaSrc.startsWith('blob:') || mediaSrc.startsWith('data:') ? undefined : 'anonymous'}
                  autoPlay
                  loop
                  muted={isMuted}
                  playsInline
                  style={{ filter: getFilterCss() }}
                  className="w-full h-full object-cover"
                  onLoadedMetadata={(e) => {
                    const dur = Math.round((e.currentTarget.duration || 0) * 10) / 10;
                    if (dur > 0) {
                      setVideoDuration(dur);
                      if (trimEnd === 0 || trimEnd > dur) {
                        setTrimEnd(dur);
                      }
                    }
                  }}
                  onTimeUpdate={(e) => {
                    // Durante la exportación no se recorta: el límite lo marca el grabador
                    if (isRecordingRef.current) return;
                    if (trimEnd > trimStart) {
                      if (e.currentTarget.currentTime >= trimEnd) {
                        e.currentTarget.currentTime = trimStart;
                      } else if (e.currentTarget.currentTime < trimStart) {
                        e.currentTarget.currentTime = trimStart;
                      }
                    }
                  }}
                />
              ) : (
                <img
                  src={mediaSrc}
                  alt="Post preview"
                  style={{ filter: getFilterCss() }}
                  className="w-full h-full object-cover"
                />
              )}

              {/* Soft Gradient Fade from black on top of media */}
              {blendFade && (
                <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black via-black/60 to-transparent pointer-events-none" />
              )}

              {/* Subtle bottom vignette */}
              <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
            </div>

            {/* Bottom Watermark Logo: "■ BlackNews" & Right-Aligned Caption */}
            <div className="p-6 sm:p-7 z-20 flex items-center justify-between gap-3 relative mt-auto border-t border-white/5 bg-gradient-to-t from-black via-black/80 to-transparent">
              <div className="flex items-center gap-2 shrink-0">
                <div className="w-4 h-4 bg-white rounded-none"></div>
                <span className="text-sm sm:text-base font-bold text-white tracking-tight font-['Lexend']">
                  BlackNews
                </span>
              </div>

              {/* Right-aligned compact photo caption / character text (Only if present, at same height) */}
              <div className="flex items-center gap-2.5 justify-end flex-1 min-w-0 pl-3">
                {photoCaption && photoCaption.trim() ? (
                  <span 
                    className="text-[10px] sm:text-[11.5px] font-normal text-neutral-300 font-['Lexend'] tracking-wide truncate block text-right drop-shadow-md select-none max-w-[280px] sm:max-w-[400px]"
                    title={photoCaption.trim()}
                  >
                    {photoCaption.trim()}
                  </span>
                ) : null}

                {/* Video control overlay button in preview */}
                {mediaType === 'video' && (
                  <button
                    type="button"
                    onClick={() => {
                      if (videoRef.current) {
                        if (videoRef.current.paused) {
                          videoRef.current.play();
                          setIsVideoPlaying(true);
                        } else {
                          videoRef.current.pause();
                          setIsVideoPlaying(false);
                        }
                      }
                    }}
                    className="p-1.5 bg-black/60 hover:bg-black/90 text-white rounded-full backdrop-blur-sm transition-colors cursor-pointer border border-white/20 shrink-0"
                    title="Pausar / Reproducir video"
                  >
                    {isVideoPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Export Action Buttons */}
          <div className="space-y-2.5 pt-2">
            
            {/* Primary: Export Video or Export PNG depending on mediaType */}
            {mediaType === 'video' ? (
              // La exportación se compone íntegramente en el navegador (MediaRecorder
              // sobre el canvas compositor): sin servidor, sin subir el archivo.
              <button
                type="button"
                disabled={isRecordingVideo}
                onClick={handleExportVideo}
                className="w-full py-3.5 bg-white hover:bg-neutral-200 text-black font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xl disabled:opacity-50"
                title="Se procesa en tu navegador: el video no se sube a ningún servidor"
              >
                <Film className="w-4 h-4" />
                <span>
                  {isRecordingVideo
                    ? `Exportando video… ${recordingProgress}%`
                    : 'Exportar Video 4:5 (en tu navegador)'}
                </span>
              </button>
            ) : (
              <button
                type="button"
                disabled={isExporting}
                onClick={handleExportPng}
                className="w-full py-3.5 bg-white hover:bg-neutral-200 text-black font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xl disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                <span>
                  {isExporting ? 'Procesando imagen 4:5...' : 'Descargar Imagen PNG (1080×1350)'}
                </span>
              </button>
            )}

            {/* Secondary actions */}
            <div className="grid grid-cols-2 gap-2">
              {mediaType === 'video' ? (
                <>
                  <button
                    type="button"
                    disabled={isExporting}
                    onClick={handleExportPng}
                    className="py-2.5 bg-neutral-900 hover:bg-neutral-850 text-white text-xs font-semibold uppercase tracking-wider rounded-xl border border-white/10 transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5 text-neutral-300" />
                    <span>Capturar PNG</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyToClipboard}
                    className="py-2.5 bg-neutral-900 hover:bg-neutral-850 text-white text-xs font-semibold uppercase tracking-wider rounded-xl border border-white/10 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {copySuccess ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copySuccess ? '¡Copiado!' : 'Copiar PNG'}</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleCopyToClipboard}
                    className="py-2.5 bg-neutral-900 hover:bg-neutral-850 text-white text-xs font-semibold uppercase tracking-wider rounded-xl border border-white/10 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {copySuccess ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copySuccess ? '¡Copiado!' : 'Copiar PNG'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTitle('Oriente Medio,\nen una nueva fase\nde incertidumbre');
                      setDescription('La escalada de tensiones entre Israel e Irán reconfigura el tablero regional y pone a prueba la estabilidad global.');
                      setCategory('GEOPOLÍTICA');
                      setSelectedCountries([
                        { name: 'Israel', code: 'IL', flag: '🇮🇱' },
                        { name: 'Irán', code: 'IR', flag: '🇮🇷' }
                      ]);
                      setFilter('bw-high');
                      setFontSizeTitle(62);
                      setFontSizeDesc(30);
                      showToast('Diseño restablecido al ejemplo oficial de referencia');
                    }}
                    className="py-2.5 bg-neutral-900 hover:bg-neutral-850 text-neutral-400 hover:text-white text-xs font-semibold uppercase tracking-wider rounded-xl border border-white/10 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Plantilla Ref.</span>
                  </button>
                </>
              )}
            </div>

            <p className="text-[11px] text-neutral-400 text-center font-light pt-1">
              {mediaType === 'video' && exportClipSeconds !== null && (
                <>
                  Se exportarán <strong className="text-white font-semibold">{exportClipSeconds} s</strong> de
                  video{maxVideoDuration > 0 ? ` (duración máxima: ${maxVideoDuration} s en «Duración máxima del clip»)` : ''}.
                  <br />
                </>
              )}
              Formato óptimo para Instagram (4:5 vertical), LinkedIn, Twitter / X y estados de WhatsApp.
              {mediaType === 'video' && ' El video se compone en tu navegador: no se sube a ningún servidor.'}
            </p>
          </div>

        </div>
      </div>

      {/* Video Export in Progress Dialog */}
      {isRecordingVideo && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-neutral-950 border border-white/20 rounded-2xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Film className="w-6 h-6 animate-pulse" />
            </div>

            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Exportando Video BlackNews 4:5
              </h3>
              <p className="text-xs text-neutral-400">
                {recordingPaused
                  ? '⏸ Pausada: vuelve a la pestaña de BlackNews para continuar.'
                  : (
                  <>
                    {recordingProgress < 30 && 'Preparando overlay tipográfico 1080×1350...'}
                    {recordingProgress >= 30 && recordingProgress < 65 && 'Componiendo fotogramas en tu navegador...'}
                    {recordingProgress >= 65 && recordingProgress < 90 && 'Grabando video y audio en tiempo real...'}
                    {recordingProgress >= 90 && 'Finalizando archivo y descargando...'}
                  </>
                  )}
              </p>
            </div>

            {/* Progress bar */}
            <div className="space-y-1.5">
              <div className="w-full bg-neutral-900 rounded-full h-2.5 overflow-hidden border border-white/10">
                <div 
                  ref={recBarRef}
                  className="bg-gradient-to-r from-amber-500 to-emerald-400 h-full transition-all duration-300 rounded-full"
                  style={{ width: `${Math.max(5, recordingProgress)}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-[11px] font-mono text-neutral-400">
                <span>
                  1080 × 1350 px{exportClipSeconds !== null ? ` · ${exportClipSeconds} s` : ''} · grabación local
                </span>
                <span ref={recPctRef} className="font-bold text-white">{recordingProgress}%</span>
              </div>
            </div>

            <p className="text-[11px] text-neutral-500 leading-snug">
              Se compone y graba en tu equipo: el video no se sube a ningún servidor y no consume recursos de la web. La duración es la real del clip.
            </p>
          </div>
        </div>
      )}

      {/* Export Success Modal with Direct Download & Preview */}
      {(exportedImageUrl || exportedVideoUrl) && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-neutral-950 border border-white/20 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <Check className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    {exportedVideoUrl ? '¡Video 4:5 Optimizado!' : '¡Post 4:5 Exportado!'}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-neutral-400 font-mono">1080 × 1350 px</span>
                    {exportedVideoSize && (
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 font-bold">
                        Peso: {exportedVideoSize}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => {
                  setExportedImageUrl(null);
                  setExportedVideoUrl(null);
                  setExportedVideoSize(null);
                }}
                className="text-neutral-400 hover:text-white p-1.5 rounded-lg transition-colors cursor-pointer bg-white/5 hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Generated media preview */}
            <div className="aspect-[4/5] max-h-[50vh] mx-auto rounded-xl overflow-hidden border border-white/15 bg-black shadow-lg">
              {exportedVideoUrl ? (
                <video 
                  src={exportedVideoUrl} 
                  controls 
                  autoPlay 
                  loop 
                  className="w-full h-full object-contain" 
                />
              ) : (
                <img 
                  src={exportedImageUrl!} 
                  alt="Post Exportado" 
                  className="w-full h-full object-contain" 
                />
              )}
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <a 
                href={exportedVideoUrl || exportedImageUrl!} 
                download={exportedVideoUrl ? exportVideoFileName : exportFileName} 
                onClick={() => showToast(`Descargando ${exportedVideoUrl ? 'video' : 'imagen'}...`)}
                className="py-2.5 px-4 bg-white text-black text-xs font-bold uppercase tracking-wider rounded-xl text-center hover:bg-neutral-200 transition-colors shadow-lg flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{exportedVideoUrl ? 'Descargar Video' : 'Descargar PNG'}</span>
              </a>

              {exportedVideoUrl ? (
                <button
                  type="button"
                  onClick={handleExportPng}
                  className="py-2.5 px-4 bg-neutral-900 border border-white/15 text-white text-xs font-semibold uppercase tracking-wider rounded-xl text-center hover:bg-neutral-850 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-neutral-300" />
                  <span>Capturar PNG</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleCopyToClipboard}
                  className="py-2.5 px-4 bg-neutral-900 border border-white/15 text-white text-xs font-semibold uppercase tracking-wider rounded-xl text-center hover:bg-neutral-850 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {copySuccess ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copySuccess ? 'Copiado' : 'Copiar Imagen'}</span>
                </button>
              )}
            </div>

            <p className="text-[11px] text-neutral-400 text-center font-light leading-snug">
              Tu navegador ya inició la descarga automática. Si tu navegador bloquea descargas en ventanas emergentes, pulsa el botón blanco de arriba o haz clic derecho sobre el archivo y selecciona <strong>"Guardar {exportedVideoUrl ? 'video' : 'imagen'} como..."</strong>.
            </p>
          </div>
        </div>
      )}

      {/* JSON Import / Export Modal */}
      {isJsonModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-neutral-950 border border-white/20 rounded-2xl max-w-lg w-full p-5 sm:p-6 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                  <FileCode className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Copia de Seguridad & Restauración JSON
                  </h3>
                  <span className="text-[10px] text-neutral-400 font-mono">
                    Guarda o restaura todo el diseño y textos del post
                  </span>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => {
                  setIsJsonModalOpen(false);
                  setJsonError(null);
                  setJsonInputText('');
                }}
                className="text-neutral-400 hover:text-white p-1.5 rounded-lg transition-colors cursor-pointer bg-white/5 hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-neutral-300 font-light leading-relaxed">
              Pega aquí el código JSON de un post previamente copiado, o sube un archivo <code className="text-cyan-400 font-mono">.json</code> para restaurar al instante todos los campos, textos, selecciones geográficas, filtros y configuraciones.
            </p>

            {jsonError && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs font-mono">
                {jsonError}
              </div>
            )}

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-neutral-400">
                <span>Código JSON del Post:</span>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const text = await navigator.clipboard.readText();
                      if (text) {
                        setJsonInputText(text);
                        setJsonError(null);
                        showToast('✓ Texto pegado desde el portapapeles');
                      }
                    } catch {
                      showToast('Usa Ctrl+V para pegar en el cuadro');
                    }
                  }}
                  className="text-cyan-400 hover:underline cursor-pointer flex items-center gap-1 text-[11px]"
                >
                  <Copy className="w-3 h-3" />
                  <span>Pegar desde Portapapeles</span>
                </button>
              </div>

              <textarea
                rows={8}
                value={jsonInputText}
                onChange={(e) => {
                  setJsonInputText(e.target.value);
                  setJsonError(null);
                }}
                placeholder='{\n  "version": 1,\n  "content": {\n    "title": "...",\n    "description": "..."\n  }\n}'
                className="w-full bg-neutral-900 border border-white/15 rounded-xl p-3 font-mono text-xs text-neutral-200 focus:outline-none focus:border-cyan-400 resize-none leading-relaxed"
              />
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10">
              <div className="flex items-center gap-2">
                <input
                  ref={jsonFileInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleUploadJsonFile(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => jsonFileInputRef.current?.click()}
                  className="px-3 py-2 bg-neutral-900 hover:bg-neutral-850 text-neutral-300 hover:text-white rounded-xl text-xs font-medium border border-white/10 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <FolderUp className="w-3.5 h-3.5" />
                  <span>Subir .json</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadJsonFile}
                  className="px-3 py-2 bg-neutral-900 hover:bg-neutral-850 text-neutral-300 hover:text-white rounded-xl text-xs font-medium border border-white/10 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  <span>Descargar .json</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => handleApplyJson(jsonInputText)}
                className="px-4 py-2 bg-white hover:bg-neutral-200 text-black font-bold rounded-xl text-xs uppercase tracking-wider transition-colors flex items-center gap-1.5 cursor-pointer shadow-lg"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Restaurar Post</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
