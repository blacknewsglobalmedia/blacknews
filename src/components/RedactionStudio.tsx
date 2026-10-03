import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  ArrowLeft, 
  CheckCircle, 
  Clock, 
  ShieldAlert, 
  Send, 
  Eye, 
  Edit3, 
  Sparkles, 
  Image as ImageIcon,
  UserCheck,
  UserX,
  Users,
  FileText,
  SlidersHorizontal,
  ShieldCheck,
  Check,
  Lock,
  Edit2,
  Zap,
  Download,
  Upload,
  FileCode,
  Bot,
  FileJson,
  HelpCircle,
  Info,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Bookmark,
  BookmarkCheck,
  FolderOpen,
  UploadCloud,
  RefreshCw,
  Tag,
  Smartphone,
  LayoutDashboard,
  Newspaper,
  ArrowRight,
  BarChart3,
  Radio,
  FilePlus,
  Menu,
  X,
  Megaphone,
  DollarSign
} from 'lucide-react';
import { Report, ReportSection, CategoryId, OptimizedImageSet } from '../types/news';
import { RedactorProfile, RedactorRole, ROLE_PERMISSIONS } from '../types/auth';
import { FrontPageLayoutConfig, AutomationPreset } from '../types/layout';
import { FlashNews } from '../types/news';
import { AdCampaign } from '../types/ads';
import { FrontPageManager } from './FrontPageManager';
import { ImageOptimizationStudio } from './ImageOptimizationStudio';
import { CategoryManager } from './CategoryManager';
import { SocialPostGenerator } from './SocialPostGenerator';
import { ImportArticleModal } from './ImportArticleModal';
import { DraftsModal, ArticleDraft } from './DraftsModal';
import { RedactorFloatingBar } from './RedactorFloatingBar';
import { AdsManager } from './AdsManager';
import { OptimizedPicture } from './OptimizedPicture';
import { downloadArticleTemplateJson, ParsedArticleImport } from '../utils/articleTemplate';

interface RedactionStudioProps {
  onBackToNews: () => void;
  onPublishReport: (newReport: Report) => void;
  onUpdateExistingReport: (updatedReport: Report) => void;
  currentUser: RedactorProfile;
  allRedactors: RedactorProfile[];
  onApproveRedactor: (id: string) => void;
  onRejectRedactor: (id: string) => void;
  onChangeUserRole: (userId: string, newRole: RedactorRole) => void;
  onRegisterRedactor: (newCandidate: Omit<RedactorProfile, 'id' | 'role' | 'requestedAt' | 'avatarInitials'>) => void;
  publishedReports: Report[];
  onDeleteReport: (id: string) => void;
  layoutConfig: FrontPageLayoutConfig;
  onUpdateLayoutConfig: (config: FrontPageLayoutConfig) => void;
  flashNews: FlashNews[];
  onUpdateFlashNews: (news: FlashNews[]) => void;
  onAutomationApply: (preset: AutomationPreset) => void;
  onOpenGoogleAuth: () => void;
  categories?: string[];
  onUpdateCategories?: (categories: string[]) => void;
  adCampaigns?: AdCampaign[];
  onSaveAdCampaign?: (campaign: AdCampaign) => void;
  onDeleteAdCampaign?: (campaignId: string) => void;
}

const PRESET_IMAGES = [
  {
    label: 'Mercados & Finanzas',
    url: '/src/assets/images/lead_market_freedom_1790285928979.jpg',
    defaultCaption: 'Mesa de liquidación y monitorización de flujos de capital internacional en tiempo real.',
  },
  {
    label: 'Cómputo Cuántico & IA',
    url: '/src/assets/images/tech_silicon_datacenter_1790285939453.jpg',
    defaultCaption: 'Interconexión criogénica de clusters de procesamiento de capital privado.',
  },
  {
    label: 'Atacama & Minerales',
    url: '/src/assets/images/atacama_lithium_energy_1790285949956.jpg',
    defaultCaption: 'Complejo de evaporación y extracción directa en salares andinos con contratos de largo plazo.',
  },
  {
    label: 'Energía en Alta Mar',
    url: '/src/assets/images/maritime_offshore_energy_1790285958148.jpg',
    defaultCaption: 'Parque de turbinas eólicas marinas financiadas íntegramente por inversión industrial privada.',
  },
  {
    label: 'Ginebra & Diplomacia',
    url: '/src/assets/images/geopolitics_diplomatic_summit_1790285551413.jpg',
    defaultCaption: 'Sesión sobre tratados de indemnidad civil y protección de infraestructuras críticas.',
  },
];

export const RedactionStudio: React.FC<RedactionStudioProps> = ({
  onBackToNews,
  onPublishReport,
  onUpdateExistingReport,
  currentUser,
  allRedactors,
  onApproveRedactor,
  onRejectRedactor,
  onChangeUserRole,
  onRegisterRedactor,
  publishedReports,
  onDeleteReport,
  layoutConfig,
  onUpdateLayoutConfig,
  flashNews,
  onUpdateFlashNews,
  onAutomationApply,
  onOpenGoogleAuth,
  categories: propCategories,
  onUpdateCategories: propOnUpdateCategories,
  adCampaigns = [],
  onSaveAdCampaign,
  onDeleteAdCampaign,
}) => {
  const permissions = ROLE_PERMISSIONS[currentUser.role];

  const categories = propCategories && propCategories.length > 0
    ? propCategories
    : [
        'TODAS',
        'ECONOMÍA & MERCADOS',
        'GEOPOLÍTICA',
        'TECNOLOGÍA & INNOVACIÓN',
        'DERECHO & PROPIEDAD',
        'ENERGÍA & INDUSTRIA',
        'DOSSIERS',
      ];
  const onUpdateCategories = propOnUpdateCategories || (() => {});

  // Default tab based on role
  const [activeTab, setActiveTab] = useState<'overview' | 'layout' | 'builder' | 'images' | 'categories' | 'post-generator' | 'ads' | 'users' | 'my-articles' | 'register'>('overview');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  const [selectedOptimizedImage, setSelectedOptimizedImage] = useState<OptimizedImageSet | undefined>(undefined);

  // Registration Form State
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regBureau, setRegBureau] = useState('');
  const [regTitle, setRegTitle] = useState('');
  const [regBio, setRegBio] = useState('');
  const [regSubmitted, setRegSubmitted] = useState(false);

  // Article Builder Form State
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [category, setCategory] = useState<CategoryId>(() => {
    return categories.find((c) => c !== 'TODAS') || 'ECONOMÍA & MERCADOS';
  });
  const [selectedImage, setSelectedImage] = useState(PRESET_IMAGES[0].url);
  const [imageCaption, setImageCaption] = useState('');
  const [customImageUrl, setCustomImageUrl] = useState('');
  const [isDirectUploading, setIsDirectUploading] = useState(false);
  const [directUploadProgress, setDirectUploadProgress] = useState<string | null>(null);
  const [directUploadSuccess, setDirectUploadSuccess] = useState<string | null>(null);
  const [showPresetGallery, setShowPresetGallery] = useState(false);
  const fileInputDirectRef = React.useRef<HTMLInputElement>(null);
  const [readTime, setReadTime] = useState('5 min de lectura');
  const [exclusive, setExclusive] = useState(false);
  const [lead, setLead] = useState('');
  const [takeawayInputs, setTakeawayInputs] = useState<string[]>([
    'La certidumbre contractual fomenta la inversión privada a largo plazo.',
    'La evidencia empírica descarta la fijación burocrática de precios.',
  ]);
  const [sections, setSections] = useState<ReportSection[]>([
    {
      type: 'paragraph',
      text: 'Los fundamentos económicos responden de manera inexorable a las leyes de la oferta y la demanda, castigando la manipulación artificial de los tipos de interés.',
    },
    {
      type: 'quote',
      text: 'La propiedad privada es el único mecanismo ético y práctico que permite coordinar el conocimiento disperso en la sociedad.',
      cite: 'Instituto de Análisis Económico',
    },
    {
      type: 'stat',
      value: '+28%',
      label: 'Incremento en el volumen de inversión productiva registrado tras la desregulación.',
    },
  ]);
  const [tagString, setTagString] = useState('Economía, Libre Mercado, Propiedad');
  const [formError, setFormError] = useState<string | null>(null);
  const [publishSuccess, setPublishSuccess] = useState(false);

  // Drafts (Borradores) states & limit of 100 per user
  const MAX_DRAFTS_PER_USER = 100;
  const [drafts, setDrafts] = useState<ArticleDraft[]>(() => {
    try {
      const key = `blacknews_drafts_${currentUser.id || currentUser.email}`;
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.slice(0, MAX_DRAFTS_PER_USER);
      }
    } catch {}
    return [];
  });
  const [isDraftsModalOpen, setIsDraftsModalOpen] = useState(false);
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [lastSavedDraftAt, setLastSavedDraftAt] = useState<string | null>(null);

  // Reload drafts when user changes
  useEffect(() => {
    try {
      const key = `blacknews_drafts_${currentUser.id || currentUser.email}`;
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setDrafts(parsed.slice(0, MAX_DRAFTS_PER_USER));
          return;
        }
      }
    } catch {}
    setDrafts([]);
    setCurrentDraftId(null);
  }, [currentUser.id, currentUser.email]);

  // AI & JSON Template integration states
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAiGuide, setShowAiGuide] = useState(false);
  const [templateDownloadedToast, setTemplateDownloadedToast] = useState(false);
  const [importSuccessBanner, setImportSuccessBanner] = useState<string | null>(null);

  // Draft handlers
  const handleSaveDraft = () => {
    if (!permissions.canWritePosts) {
      setFormError('Tu cuenta no dispone de permisos para redactar ni guardar borradores.');
      return;
    }
    if (!title.trim() && !lead.trim() && !subtitle.trim()) {
      setFormError('Escribe al menos el titular o parte del texto para guardar el borrador.');
      return;
    }

    const existingIndex = drafts.findIndex((d) => d.id === currentDraftId);
    const isUpdatingExisting = existingIndex >= 0;

    if (!isUpdatingExisting && drafts.length >= MAX_DRAFTS_PER_USER) {
      setFormError(
        `Límite alcanzado: máximo ${MAX_DRAFTS_PER_USER} noticias en borradores por usuario. Por favor elimina borradores antiguos para guardar uno nuevo.`
      );
      return;
    }

    setFormError(null);
    const now = new Date();
    const timeStr = `${now.getDate()} ${now.toLocaleString('es-ES', { month: 'short' })} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    const draftId = currentDraftId || `draft-${currentUser.id || 'usr'}-${Date.now()}`;

    const newDraft: ArticleDraft = {
      id: draftId,
      userId: currentUser.id,
      userEmail: currentUser.email,
      title: title.trim(),
      subtitle: subtitle.trim(),
      category,
      selectedImage: customImageUrl.trim() ? customImageUrl.trim() : selectedImage,
      imageCaption: imageCaption.trim(),
      customImageUrl: customImageUrl.trim(),
      readTime: readTime.trim(),
      exclusive,
      lead: lead.trim(),
      takeawayInputs,
      sections,
      tagString,
      savedAt: timeStr,
      updatedAt: Date.now(),
    };

    let updatedDrafts: ArticleDraft[];
    if (isUpdatingExisting) {
      updatedDrafts = [...drafts];
      updatedDrafts[existingIndex] = newDraft;
    } else {
      updatedDrafts = [newDraft, ...drafts];
    }

    setDrafts(updatedDrafts);
    setCurrentDraftId(draftId);
    setLastSavedDraftAt(timeStr);

    try {
      localStorage.setItem(`blacknews_drafts_${currentUser.id || currentUser.email}`, JSON.stringify(updatedDrafts));
    } catch {}

    setImportSuccessBanner(`Borrador guardado con éxito (${updatedDrafts.length}/${MAX_DRAFTS_PER_USER}).`);
    setTimeout(() => {
      setImportSuccessBanner(null);
    }, 4000);
  };

  const handleLoadDraft = (draft: ArticleDraft) => {
    setTitle(draft.title || '');
    setSubtitle(draft.subtitle || '');
    setCategory(draft.category || 'ECONOMÍA & MERCADOS');
    if (draft.selectedImage) setSelectedImage(draft.selectedImage);
    if (draft.customImageUrl) setCustomImageUrl(draft.customImageUrl);
    setImageCaption(draft.imageCaption || '');
    setReadTime(draft.readTime || '5 min de lectura');
    setExclusive(Boolean(draft.exclusive));
    setLead(draft.lead || '');
    setTakeawayInputs(draft.takeawayInputs && draft.takeawayInputs.length > 0 ? draft.takeawayInputs : ['', '']);
    setSections(draft.sections && draft.sections.length > 0 ? draft.sections : [{ type: 'paragraph', text: '' }]);
    setTagString(draft.tagString || '');
    setCurrentDraftId(draft.id);
    setEditingReportId(null);
    setPreviewMode(false);
    setActiveTab('builder');
    setImportSuccessBanner(`Borrador "${draft.title || 'Sin título'}" cargado en el editor.`);
    setTimeout(() => setImportSuccessBanner(null), 4000);
  };

  const handleDeleteDraft = (draftId: string) => {
    const updated = drafts.filter((d) => d.id !== draftId);
    setDrafts(updated);
    try {
      localStorage.setItem(`blacknews_drafts_${currentUser.id || currentUser.email}`, JSON.stringify(updated));
    } catch {}
    if (currentDraftId === draftId) {
      setCurrentDraftId(null);
    }
    setImportSuccessBanner(`Borrador eliminado (${updated.length}/${MAX_DRAFTS_PER_USER}).`);
    setTimeout(() => setImportSuccessBanner(null), 3000);
  };

  const handleNewBlankArticle = () => {
    setTitle('');
    setSubtitle('');
    setLead('');
    setSections([{ type: 'paragraph', text: '' }]);
    setTakeawayInputs(['', '']);
    setTagString('');
    setCustomImageUrl('');
    setCurrentDraftId(null);
    setEditingReportId(null);
    setPreviewMode(false);
  };

  const handleDownloadTemplate = () => {
    downloadArticleTemplateJson();
    setTemplateDownloadedToast(true);
    setTimeout(() => {
      setTemplateDownloadedToast(false);
    }, 4500);
  };

  const handleApplyImportedArticle = (imported: ParsedArticleImport) => {
    setTitle(imported.title);
    setSubtitle(imported.subtitle);
    setCategory(imported.category);
    setLead(imported.lead);
    setReadTime(imported.readTime);
    if (imported.imageCaption) {
      setImageCaption(imported.imageCaption);
    }
    if (imported.image) {
      setSelectedImage(imported.image);
      setCustomImageUrl(imported.image);
    }
    setExclusive(Boolean(imported.exclusive));
    setSections(imported.sections);
    setTakeawayInputs(imported.keyTakeaways);
    setTagString(imported.tags.join(', '));
    setImportSuccessBanner(
      `¡Artículo importado con éxito! Se cargaron ${imported.sections.length} bloques del cuerpo, ${imported.keyTakeaways.length} claves y metadatos completos.`
    );
    setTimeout(() => {
      setImportSuccessBanner(null);
    }, 6000);
  };

  // Check if current user can edit a specific report
  const canUserEditThisReport = (report: Report) => {
    if (currentUser.role === 'ADMIN') return true;
    if (currentUser.role === 'REDACTOR') {
      return (
        (report.authorEmail && report.authorEmail.toLowerCase() === currentUser.email.toLowerCase()) ||
        (report.authorId && report.authorId === currentUser.id) ||
        (report.author && report.author.name.toLowerCase() === currentUser.name.toLowerCase())
      );
    }
    return false;
  };

  // Start editing an existing report
  const handleStartEdit = (report: Report) => {
    if (!canUserEditThisReport(report)) {
      setFormError('Solo puedes editar los informes redactados por ti.');
      return;
    }
    setEditingReportId(report.id);
    setTitle(report.title);
    setSubtitle(report.subtitle);
    setCategory(report.category);
    setSelectedImage(report.image);
    setSelectedOptimizedImage(report.optimizedImage);
    setImageCaption(report.imageCaption || '');
    setReadTime(report.readTime);
    setLead(report.lead);
    setSections(report.sections || []);
    setTakeawayInputs(report.keyTakeaways || []);
    setTagString(report.tags ? report.tags.join(', ') : '');
    setExclusive(Boolean(report.exclusive));
    setPreviewMode(false);
    setActiveTab('builder');
  };

  const handleCancelEdit = () => {
    setEditingReportId(null);
    setSelectedOptimizedImage(undefined);
    setTitle('');
    setSubtitle('');
    setLead('');
  };

  const handleDirectImageUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setFormError('Por favor selecciona un archivo de imagen válido (JPEG, PNG, WebP, AVIF, TIFF).');
      return;
    }

    setIsDirectUploading(true);
    setDirectUploadProgress('Optimizando y convirtiendo a formato .AVIF...');
    setDirectUploadSuccess(null);
    setFormError(null);

    try {
      const formData = new FormData();
      formData.append('image', file);
      if (title.trim()) {
        formData.append('slug', title.trim());
      }
      formData.append('isHero', 'true');

      const response = await fetch('/api/images/optimize', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Error al procesar la imagen');
      }

      const optData: OptimizedImageSet = data.data;
      setSelectedOptimizedImage(optData);

      const bestVariant = optData.variants?.find((v) => v.format === 'avif' && v.width === 1200) ||
                          optData.variants?.find((v) => v.format === 'avif' && v.width === 800) ||
                          (optData.variants && optData.variants[0]);

      const chosenUrl = bestVariant?.url || optData.fallbackUrl;
      setSelectedImage(chosenUrl);
      setCustomImageUrl(chosenUrl);

      if (!imageCaption || imageCaption === PRESET_IMAGES[0].defaultCaption) {
        setImageCaption(`Fotografía editorial · Formato .AVIF (${optData.originalName})`);
      }

      setDirectUploadSuccess(`¡Fotografía optimizada en formato .AVIF (-${optData.totalSavingsPercent || 75}% peso)!`);
      setTimeout(() => setDirectUploadSuccess(null), 5000);
    } catch (err: any) {
      console.error(err);
      setFormError(err.message || 'Error al procesar y optimizar la imagen.');
    } finally {
      setIsDirectUploading(false);
      setDirectUploadProgress(null);
    }
  };

  const handleSelectOptimizedImageForArticle = (optSet: OptimizedImageSet) => {
    setSelectedOptimizedImage(optSet);
    const bestVariant = optSet.variants?.find(v => v.format === 'avif' && v.width === 1200) ||
                        optSet.variants?.find(v => v.format === 'avif' && v.width === 800) ||
                        (optSet.variants && optSet.variants[0]);
    if (bestVariant) {
      setSelectedImage(bestVariant.url);
      setCustomImageUrl(bestVariant.url);
    }
    setActiveTab('builder');
  };

  // Section Handlers
  const handleAddSection = (type: 'paragraph' | 'heading' | 'quote' | 'stat') => {
    if (type === 'paragraph') {
      setSections([...sections, { type: 'paragraph', text: '' }]);
    } else if (type === 'heading') {
      setSections([...sections, { type: 'heading', text: '' }]);
    } else if (type === 'quote') {
      setSections([...sections, { type: 'quote', text: '', cite: '' }]);
    } else if (type === 'stat') {
      setSections([...sections, { type: 'stat', value: '', label: '' }]);
    }
  };

  const handleUpdateSection = (index: number, updated: ReportSection) => {
    const next = [...sections];
    next[index] = updated;
    setSections(next);
  };

  const handleRemoveSection = (index: number) => {
    setSections(sections.filter((_, i) => i !== index));
  };

  // Takeaway Handlers
  const handleAddTakeaway = () => {
    setTakeawayInputs([...takeawayInputs, '']);
  };

  const handleUpdateTakeaway = (index: number, val: string) => {
    const next = [...takeawayInputs];
    next[index] = val;
    setTakeawayInputs(next);
  };

  const handleRemoveTakeaway = (index: number) => {
    setTakeawayInputs(takeawayInputs.filter((_, i) => i !== index));
  };

  // Registration Submit
  const handleSubmitRegistration = (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim() || !regEmail.trim()) return;
    onRegisterRedactor({
      name: regName.trim(),
      email: regEmail.trim(),
      bureau: regBureau.trim() || 'Corresponsalía',
      title: regTitle.trim() || 'Analista / Redactor',
      bio: regBio.trim(),
    });
    setRegSubmitted(true);
  };

  // Publish or Save edited report
  const handleSaveOrPublish = () => {
    if (!permissions.canWritePosts) {
      setFormError('Tu cuenta es de usuario básico (Lector). No tienes permisos de redacción ni edición.');
      return;
    }
    if (!title.trim()) {
      setFormError('El titular del informe es obligatorio.');
      return;
    }
    if (!subtitle.trim()) {
      setFormError('El subtítulo / bajada de portada es obligatorio.');
      return;
    }
    if (!lead.trim()) {
      setFormError('La entrada principal (lead) es obligatoria.');
      return;
    }

    setFormError(null);

    const finalImage = customImageUrl.trim() ? customImageUrl.trim() : selectedImage;
    const finalTags = tagString
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    if (editingReportId) {
      // Find original to preserve ID and publishedAt
      const original = publishedReports.find((r) => r.id === editingReportId);
      if (!original || !canUserEditThisReport(original)) {
        setFormError('No estás autorizado para modificar este informe.');
        return;
      }

      const updated: Report = {
        ...original,
        title: title.trim(),
        subtitle: subtitle.trim(),
        category,
        image: finalImage,
        optimizedImage: selectedOptimizedImage || original.optimizedImage,
        imageCaption: imageCaption.trim(),
        lead: lead.trim(),
        sections: sections.filter((s) => (s.text && s.text.trim().length > 0) || s.value),
        keyTakeaways: takeawayInputs.filter((t) => t.trim().length > 0),
        tags: finalTags,
        exclusive,
        readTime,
      };

      onUpdateExistingReport(updated);
      setPublishSuccess(true);
      setEditingReportId(null);
      setSelectedOptimizedImage(undefined);
      setTimeout(() => {
        setPublishSuccess(false);
        onBackToNews();
      }, 1500);
      return;
    }

    // New report creation
    const newReport: Report = {
      id: `rep-custom-${Date.now()}`,
      title: title.trim(),
      subtitle: subtitle.trim(),
      category,
      author: {
        name: currentUser.name,
        bureau: currentUser.bureau,
        role: currentUser.title,
        email: currentUser.email,
        id: currentUser.id,
      },
      authorEmail: currentUser.email,
      authorId: currentUser.id,
      publishedAt: '24 Sep 2026 · Despacho Reciente',
      readTime,
      image: finalImage,
      optimizedImage: selectedOptimizedImage,
      imageCaption: imageCaption.trim(),
      lead: lead.trim(),
      sections: sections.filter((s) => (s.text && s.text.trim().length > 0) || s.value),
      keyTakeaways: takeawayInputs.filter((t) => t.trim().length > 0),
      tags: finalTags,
      exclusive,
      trending: true,
    };

    onPublishReport(newReport);
    setPublishSuccess(true);

    // If this was a draft, clean it up
    if (currentDraftId) {
      const updated = drafts.filter((d) => d.id !== currentDraftId);
      setDrafts(updated);
      try {
        localStorage.setItem(`blacknews_drafts_${currentUser.id || currentUser.email}`, JSON.stringify(updated));
      } catch {}
      setCurrentDraftId(null);
    }

    setTimeout(() => {
      setPublishSuccess(false);
      onBackToNews();
    }, 1500);
  };

  const isBasicReader = currentUser.role === 'LECTOR';

  if (isBasicReader) {
    return (
      <div className="min-h-[75vh] bg-black text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md p-8 border border-white/10 bg-neutral-950 space-y-4">
          <div className="w-12 h-12 border border-white/20 flex items-center justify-center mx-auto text-white">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-sm font-medium uppercase tracking-wider text-white">
            Acceso Restringido · Redacción Interna
          </h2>
          <p className="text-xs text-neutral-400 font-mono leading-relaxed">
            Tu cuenta tiene perfil de usuario básico (Lector). No dispones de autorización para acceder a las herramientas internas del medio.
          </p>
          <button
            onClick={onBackToNews}
            className="w-full py-2.5 bg-white text-black font-medium text-xs uppercase tracking-wider hover:bg-neutral-200 transition-colors cursor-pointer"
          >
            Volver a Portada
          </button>
        </div>
      </div>
    );
  }

  const userPublishedCount = publishedReports.filter((r) => canUserEditThisReport(r)).length;

  return (
    <div className="min-h-screen bg-black text-white font-sans flex flex-col lg:flex-row pb-20 lg:pb-0">
      {/* MOBILE COMPACT HEADER (< lg) */}
      <div className="lg:hidden border-b border-white/10 bg-black px-4 py-3 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-2.5">
          <div className="w-3.5 h-3.5 bg-white shrink-0" />
          <span className="text-xs font-bold uppercase tracking-wider text-white">
            BlackNews Editorial
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-neutral-300">
            {currentUser.role}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBackToNews}
            className="p-1.5 text-xs text-neutral-400 hover:text-white rounded-lg hover:bg-white/5"
            title="Volver a Portada"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
            className="p-1.5 text-white rounded-lg hover:bg-white/10 border border-white/10"
            title="Abrir menú editorial"
          >
            {isMobileSidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* COMPACT DASHBOARD SIDEBAR (Desktop sticky, Mobile collapsible) */}
      <aside className={`
        ${isMobileSidebarOpen ? 'block' : 'hidden'} lg:block 
        w-full lg:w-64 lg:min-h-screen border-r border-white/10 bg-black
        p-4 shrink-0 lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto z-40 flex flex-col justify-between
      `}>
        <div className="space-y-5">
          {/* Logo & Bureau Badge */}
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="w-4 h-4 bg-white" />
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-white font-['Lexend']">
                  BlackNews
                </div>
                <div className="text-[9px] font-mono text-neutral-400 uppercase tracking-wide">
                  Mesa Editorial
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
              <span>ONLINE</span>
            </div>
          </div>

          {/* User Profile Capsule (Compact) */}
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-white text-black font-extrabold flex items-center justify-center text-xs shrink-0">
                {currentUser.avatarInitials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-white truncate">
                  {currentUser.name}
                </div>
                <div className="flex items-center gap-1 text-[10px] text-neutral-400 font-mono">
                  <span className="text-neutral-300 font-semibold">{currentUser.role}</span>
                  <span>·</span>
                  <span className="truncate">{currentUser.bureau.split('/')[0]}</span>
                </div>
              </div>
            </div>

            {/* Session capsule: no role switcher here anymore (roles change only via verified Google login) */}
          </div>

          {/* Nav Categories */}
          <nav className="space-y-4">
            {/* Category: Redacción */}
            <div className="space-y-1">
              <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 px-2 font-semibold">
                Espacio de Trabajo
              </div>

              {/* Overview (Dashboard) */}
              <button
                type="button"
                onClick={() => {
                  setActiveTab('overview');
                  setIsMobileSidebarOpen(false);
                }}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                  activeTab === 'overview'
                    ? 'bg-white text-black font-bold'
                    : 'text-neutral-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-2">
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Panel General</span>
                </div>
              </button>

              {/* Builder (Redactar) */}
              {permissions.canWritePosts && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('builder');
                    setIsMobileSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                    activeTab === 'builder'
                      ? 'bg-white text-black font-bold'
                      : 'text-neutral-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Edit3 className="w-4 h-4" />
                    <span>{editingReportId ? 'Editando Informe' : 'Redactar Despacho'}</span>
                  </div>
                  {editingReportId && (
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  )}
                </button>
              )}

              {/* Published Articles */}
              <button
                type="button"
                onClick={() => {
                  setActiveTab('my-articles');
                  setIsMobileSidebarOpen(false);
                }}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                  activeTab === 'my-articles'
                    ? 'bg-white text-black font-bold'
                    : 'text-neutral-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  <span>Despachos Emitidos</span>
                </div>
                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-bold ${
                  activeTab === 'my-articles' ? 'bg-black/10 text-black' : 'bg-white/10 text-neutral-300'
                }`}>
                  {publishedReports.length}
                </span>
              </button>

              {/* Borradores */}
              <button
                type="button"
                onClick={() => {
                  setIsDraftsModalOpen(true);
                  setIsMobileSidebarOpen(false);
                }}
                className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-semibold tracking-wide text-neutral-300 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Bookmark className="w-4 h-4 text-neutral-400" />
                  <span>Borradores</span>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white/5 text-neutral-400 font-bold">
                  {drafts.length}
                </span>
              </button>
            </div>

            {/* Category: Multimedia & Redes */}
            <div className="space-y-1">
              <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 px-2 font-semibold">
                Multimedia & Redes
              </div>

              {/* Post 4:5 */}
              <button
                type="button"
                onClick={() => {
                  setActiveTab('post-generator');
                  setIsMobileSidebarOpen(false);
                }}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                  activeTab === 'post-generator'
                    ? 'bg-white text-black font-bold'
                    : 'text-neutral-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-neutral-400" />
                  <span>Creador Post 4:5</span>
                </div>
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded text-neutral-500 font-bold">
                  MP4 / IMG
                </span>
              </button>

              {/* Optimizer .AVIF */}
              <button
                type="button"
                onClick={() => {
                  setActiveTab('images');
                  setIsMobileSidebarOpen(false);
                }}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                  activeTab === 'images'
                    ? 'bg-white text-black font-bold'
                    : 'text-neutral-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-neutral-400" />
                  <span>Optimizador .AVIF</span>
                </div>
              </button>
            </div>

            {/* Category: Portada & Sistema (Admins & Moderators) */}
            {(permissions.canManageLayout || permissions.canManageCategories || permissions.canManageUsers) && (
              <div className="space-y-1">
                <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 px-2 font-semibold">
                  Gestión & Portada
                </div>

                {permissions.canManageLayout && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('layout');
                      setIsMobileSidebarOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                      activeTab === 'layout'
                        ? 'bg-white text-black font-bold'
                        : 'text-neutral-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <SlidersHorizontal className="w-4 h-4" />
                      <span>Gestión Portada</span>
                    </div>
                  </button>
                )}

                {permissions.canManageCategories && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('categories');
                      setIsMobileSidebarOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                      activeTab === 'categories'
                        ? 'bg-white text-black font-bold'
                        : 'text-neutral-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Tag className="w-4 h-4" />
                      <span>Categorías</span>
                    </div>
                  </button>
                )}

                {permissions.canManageUsers && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('users');
                      setIsMobileSidebarOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                      activeTab === 'users'
                        ? 'bg-white text-black font-bold'
                        : 'text-neutral-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      <span>Equipo & Roles</span>
                    </div>
                  </button>
                )}
              </div>
            )}
          </nav>
        </div>

        {/* Sidebar Footer: Return to Portada & Template */}
        <div className="pt-4 border-t border-white/10 space-y-2">
          <button
            type="button"
            onClick={() => downloadArticleTemplateJson()}
            className="w-full py-2 px-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-white/5"
            title="Descargar plantilla JSON para redacción"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Plantilla JSON</span>
          </button>

          <button
            type="button"
            onClick={onBackToNews}
            className="w-full py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors cursor-pointer border border-white/10"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Volver a Portada</span>
          </button>
        </div>
      </aside>

      {/* MAIN WORKSPACE */}
      <main className="flex-1 min-w-0 flex flex-col bg-black">
        {/* Workspace Sticky Header */}
        <div className="border-b border-white/10 bg-black/85 backdrop-blur-md px-4 sm:px-6 py-3 sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3">
          {/* Breadcrumb Title */}
          <div className="flex items-center gap-2 text-xs font-sans uppercase tracking-wider">
            <span className="text-neutral-500 font-semibold">SISTEMA EDITORIAL</span>
            <span className="text-neutral-700">/</span>
            <span className="text-white font-bold">
              {activeTab === 'overview' && 'PANEL DE CONTROL'}
              {activeTab === 'builder' && (editingReportId ? 'EDITANDO INFORME' : 'CONSTRUCTOR DE ARTÍCULOS')}
              {activeTab === 'my-articles' && 'CATÁLOGO DE DESPACHOS'}
              {activeTab === 'post-generator' && 'GENERADOR DE POSTS 4:5'}
              {activeTab === 'images' && 'OPTIMIZADOR .AVIF'}
              {activeTab === 'layout' && 'GESTIÓN DE PORTADA'}
              {activeTab === 'categories' && 'GESTIÓN DE CATEGORÍAS'}
              {activeTab === 'users' && 'EQUIPO & ROLES'}
              {activeTab === 'register' && 'SOLICITUD DE ACREDITACIÓN'}
            </span>
          </div>

          {/* Quick Contextual Actions */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {activeTab === 'builder' && permissions.canWritePosts ? (
              <>
                {editingReportId && (
                  <button
                    onClick={handleCancelEdit}
                    className="text-xs font-semibold text-neutral-400 hover:text-white px-2 py-1 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                )}
                <button
                  onClick={() => setIsDraftsModalOpen(true)}
                  className="text-xs font-semibold text-neutral-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer py-1.5 px-3 rounded-lg bg-neutral-900 border border-white/10 hover:bg-neutral-800"
                >
                  <Bookmark className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Borradores</span> ({drafts.length})
                </button>
                <button
                  onClick={() => setPreviewMode(!previewMode)}
                  className="text-xs font-semibold text-neutral-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer py-1.5 px-3 rounded-lg bg-neutral-900 border border-white/10 hover:bg-neutral-800"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>{previewMode ? 'Editor' : 'Vista Previa'}</span>
                </button>
                <button
                  onClick={handleSaveOrPublish}
                  className="px-3.5 py-1.5 bg-white text-black hover:bg-neutral-200 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer rounded-lg shadow-sm"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{editingReportId ? 'Guardar' : 'Publicar'}</span>
                </button>
              </>
            ) : (
              <>
                {permissions.canWritePosts && (
                  <button
                    type="button"
                    onClick={() => {
                      handleNewBlankArticle();
                      setActiveTab('builder');
                    }}
                    className="px-3 py-1.5 bg-white text-black hover:bg-neutral-200 font-bold text-xs uppercase tracking-wider rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Redactar</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsDraftsModalOpen(true)}
                  className="px-3 py-1.5 text-neutral-400 hover:text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Bookmark className="w-3.5 h-3.5" />
                  <span>Borradores ({drafts.length})</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Success Notification */}
        {publishSuccess && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4 w-full">
            <div className="p-4 border border-white text-white flex items-center gap-3 bg-neutral-950 rounded-xl shadow-xl">
              <CheckCircle className="w-5 h-5 text-white shrink-0" />
              <div>
                <div className="font-bold text-sm">
                  {editingReportId ? '¡INFORME ACTUALIZADO CON ÉXITO!' : '¡INFORME PUBLICADO EXITOSAMENTE!'}
                </div>
                <div className="text-xs text-neutral-400 mt-0.5">
                  La noticia se ha guardado en el archivo central para su asignación editorial.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB CONTENT 0: DASHBOARD COMPACTO (OVERVIEW) */}
        {activeTab === 'overview' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-8 w-full">
            {/* Welcome & Identity Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-2">
              <div className="flex items-center gap-3.5">
                <div className="w-9 h-9 rounded-lg bg-white text-black font-black flex items-center justify-center text-xs">
                  {currentUser.avatarInitials}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                      {currentUser.name}
                    </h2>
                    <span className="text-[10px] font-mono text-neutral-500">
                      {currentUser.role}
                    </span>
                    <span className="text-[10px] text-neutral-500 font-medium flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 inline-block animate-pulse" />
                      Mesa Activa
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500 mt-0.5 font-light">
                    {currentUser.title} · Corresponsalía: {currentUser.bureau}
                  </p>
                </div>
              </div>

              {/* Fast Action Buttons */}
              <div className="flex items-center gap-2 shrink-0">
                {permissions.canWritePosts && (
                  <button
                    type="button"
                    onClick={() => {
                      handleNewBlankArticle();
                      setActiveTab('builder');
                    }}
                    className="px-3.5 py-2 bg-white text-black hover:bg-neutral-200 rounded-lg font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Nuevo Despacho</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsDraftsModalOpen(true)}
                  className="px-3 py-2 text-neutral-400 hover:text-white rounded-lg font-medium text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Bookmark className="w-3.5 h-3.5" />
                  <span>Borradores ({drafts.length})</span>
                </button>
              </div>
            </div>

            {/* KPI Metrics: cifras desnudas separadas por filetes */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-0 lg:divide-x lg:divide-white/10">
              {/* Card 1: Total Despachos */}
              <div 
                onClick={() => setActiveTab('my-articles')}
                className="group cursor-pointer lg:pl-6 lg:first:pl-0 transition-colors"
              >
                <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-600 group-hover:text-neutral-400 transition-colors">
                  Archivo Central
                </div>
                <div className="mt-1.5 flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                    {publishedReports.length}
                  </span>
                  <span className="text-[11px] text-neutral-500 group-hover:text-neutral-300 transition-colors">
                    Despachos publicados
                  </span>
                </div>
              </div>

              {/* Card 2: Tus Despachos */}
              <div 
                onClick={() => setActiveTab('my-articles')}
                className="group cursor-pointer lg:pl-6 lg:first:pl-0 transition-colors"
              >
                <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-600 group-hover:text-neutral-400 transition-colors">
                  Tus Artículos
                </div>
                <div className="mt-1.5 flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                    {userPublishedCount}
                  </span>
                  <span className="text-[11px] text-neutral-500 group-hover:text-neutral-300 transition-colors">
                    Bajo tu firma
                  </span>
                </div>
              </div>

              {/* Card 3: Borradores */}
              <div 
                onClick={() => setIsDraftsModalOpen(true)}
                className="group cursor-pointer lg:pl-6 lg:first:pl-0 transition-colors"
              >
                <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-600 group-hover:text-neutral-400 transition-colors">
                  Borradores
                </div>
                <div className="mt-1.5 flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                    {drafts.length}{' '}
                    <span className="text-xs text-neutral-600 font-normal">/ {MAX_DRAFTS_PER_USER}</span>
                  </span>
                  <span className="text-[11px] text-neutral-500 group-hover:text-neutral-300 transition-colors">
                    En memoria local
                  </span>
                </div>
              </div>

              {/* Card 4: Teletipo / Portada */}
              <div 
                onClick={() => permissions.canManageLayout ? setActiveTab('layout') : null}
                className={`group lg:pl-6 lg:first:pl-0 transition-colors ${
                  permissions.canManageLayout ? 'cursor-pointer' : ''
                }`}
              >
                <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-600 group-hover:text-neutral-400 transition-colors">
                  Teletipo en Vivo
                </div>
                <div className="mt-1.5 flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                    {flashNews.length}
                  </span>
                  <span className="text-[11px] text-neutral-500 group-hover:text-neutral-300 transition-colors">
                    Alertas flash activas
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Action Commands */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4">
              <button
                type="button"
                onClick={() => {
                  handleNewBlankArticle();
                  setActiveTab('builder');
                }}
                className="group pt-3 border-t border-white/10 text-left transition-colors cursor-pointer"
              >
                <div className="text-xs font-bold text-white uppercase tracking-wider group-hover:text-neutral-300 transition-colors">
                  Redactar
                </div>
                <div className="text-[11px] text-neutral-500 mt-0.5 group-hover:text-neutral-400 transition-colors">
                  Crear nuevo despacho
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('post-generator')}
                className="group pt-3 border-t border-white/10 text-left transition-colors cursor-pointer"
              >
                <div className="text-xs font-bold text-white uppercase tracking-wider group-hover:text-neutral-300 transition-colors">
                  Post 4:5
                </div>
                <div className="text-[11px] text-neutral-500 mt-0.5 group-hover:text-neutral-400 transition-colors">
                  Generar video / imagen
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('images')}
                className="group pt-3 border-t border-white/10 text-left transition-colors cursor-pointer"
              >
                <div className="text-xs font-bold text-white uppercase tracking-wider group-hover:text-neutral-300 transition-colors">
                  Optimizador
                </div>
                <div className="text-[11px] text-neutral-500 mt-0.5 group-hover:text-neutral-400 transition-colors">
                  Procesar a .AVIF
                </div>
              </button>

              <button
                type="button"
                onClick={() => setShowImportModal(true)}
                className="group pt-3 border-t border-white/10 text-left transition-colors cursor-pointer"
              >
                <div className="text-xs font-bold text-white uppercase tracking-wider group-hover:text-neutral-300 transition-colors">
                  Importar
                </div>
                <div className="text-[11px] text-neutral-500 mt-0.5 group-hover:text-neutral-400 transition-colors">
                  Cargar desde JSON
                </div>
              </button>
            </div>

            {/* 2-Column Split: Recent Articles & Drafts/Teletipo */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left 2 Cols: Recent Published Articles */}
              <div className="lg:col-span-2 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-white/10">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                    <Newspaper className="w-3.5 h-3.5 text-neutral-400" />
                    <span>Despachos Recientes en Redacción</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => setActiveTab('my-articles')}
                    className="text-xs text-neutral-400 hover:text-white transition-colors cursor-pointer"
                  >
                    Ver todos ({publishedReports.length}) →
                  </button>
                </div>

                <div className="divide-y divide-white/5">
                  {publishedReports.slice(0, 5).map((rep) => {
                    const canEditThis = canUserEditThisReport(rep);
                    return (
                      <div 
                        key={rep.id}
                        className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group transition-colors hover:bg-white/[0.02]"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <OptimizedPicture
                            image={rep.image}
                            alt={rep.title}
                            className="w-14 h-11 rounded-md shrink-0"
                            sizes="56px"
                            aspectRatio="14/11"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase text-neutral-400">
                              <span className="font-semibold text-neutral-300">{rep.category}</span>
                              <span>·</span>
                              <span>{rep.publishedAt}</span>
                            </div>
                            <h4 className="text-xs sm:text-sm font-bold text-white truncate max-w-xl group-hover:text-neutral-200 mt-0.5">
                              {rep.title}
                            </h4>
                            <p className="text-[11px] text-neutral-400 truncate max-w-md">
                              Por {rep.author.name} ({rep.author.bureau})
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                          {canEditThis && (
                            <button
                              type="button"
                              onClick={() => handleStartEdit(rep)}
                              className="px-2 py-1 text-neutral-500 hover:text-white text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer"
                              title="Editar artículo"
                            >
                              <Edit2 className="w-3 h-3" />
                              <span>Editar</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setActiveTab('post-generator')}
                            className="px-2 py-1 text-neutral-500 hover:text-white text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer"
                            title="Crear Post 4:5 para redes"
                          >
                            <Smartphone className="w-3 h-3" />
                            <span>Post 4:5</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right 1 Col: Active Drafts & Teletipo */}
              <div className="space-y-4">
                {/* Drafts Widget */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-white/10">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                      <Bookmark className="w-3.5 h-3.5 text-neutral-500" />
                      <span>Borradores en Curso</span>
                    </h3>
                    <button
                      type="button"
                      onClick={() => setIsDraftsModalOpen(true)}
                      className="text-[11px] text-neutral-500 hover:text-white font-medium cursor-pointer"
                    >
                      Ver ({drafts.length})
                    </button>
                  </div>

                  {drafts.length > 0 ? (
                    <div className="divide-y divide-white/5">
                      {drafts.slice(0, 3).map((draft) => (
                        <div
                          key={draft.id}
                          onClick={() => handleLoadDraft(draft)}
                          className="py-2.5 hover:bg-white/[0.03] transition-colors cursor-pointer"
                        >
                          <div className="text-xs font-bold text-white truncate">
                            {draft.title || 'Borrador sin título'}
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-neutral-400 mt-1 font-mono">
                            <span>{draft.category}</span>
                            <span>{new Date(draft.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-neutral-400 font-light py-2">
                      No tienes borradores guardados. Pulsa en Redactar para comenzar.
                    </p>
                  )}
                </div>

                {/* Teletipo Widget */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-white/10">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                      <Radio className="w-3.5 h-3.5 text-neutral-500" />
                      <span>Cintillo de Última Hora</span>
                    </h3>
                    {permissions.canManageLayout && (
                      <button
                        type="button"
                        onClick={() => setActiveTab('layout')}
                        className="text-[11px] text-neutral-400 hover:text-white font-semibold cursor-pointer"
                      >
                        Gestionar
                      </button>
                    )}
                  </div>

                  <div className="divide-y divide-white/5">
                    {flashNews.slice(0, 3).map((f) => (
                      <div key={f.id} className="py-2">
                        <div className="text-[10px] font-mono text-neutral-500 flex items-center gap-1.5">
                          <span className="text-white font-bold">{f.time}</span>
                          <span>·</span>
                          <span className="truncate">{f.category}</span>
                        </div>
                        <p className="text-xs text-neutral-300 font-normal line-clamp-2 mt-0.5">
                          {f.title}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      {/* TAB CONTENT 1: GESTIÓN DE PORTADA */}
      {activeTab === 'layout' && permissions.canManageLayout && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8">
          <FrontPageManager
            reports={publishedReports}
            layoutConfig={layoutConfig}
            onUpdateLayoutConfig={onUpdateLayoutConfig}
            flashNews={flashNews}
            onUpdateFlashNews={onUpdateFlashNews}
            permissions={permissions}
            onAutomationApply={onAutomationApply}
          />
        </div>
      )}

      {/* TAB CONTENT 2: CONSTRUCTOR / EDITOR DE ARTÍCULOS */}
      {activeTab === 'builder' && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 font-sans">
          {/* If user is basic reader: block editing with clear message */}
          {!permissions.canWritePosts ? (
            <div className="p-8 border border-white/15 max-w-2xl mx-auto text-center my-8 bg-neutral-950 rounded-2xl shadow-xl">
              <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4 text-white">
                <Lock className="w-7 h-7 text-neutral-300" />
              </div>
              <h3 className="text-base font-bold uppercase tracking-wider text-white mb-2">
                CUENTA DE USUARIO BÁSICO (LECTOR)
              </h3>
              <p className="text-sm text-neutral-400 leading-relaxed max-w-lg mx-auto mb-6 font-light">
                Los usuarios registrados no tienen permisos de redacción ni edición por defecto. Cuando la administración habilite específicamente tu cuenta como <strong>Redactor</strong>, podrás redactar y editar exclusivamente tus propios artículos.
              </p>
              <button
                onClick={() => setActiveTab('register')}
                className="px-5 py-2.5 bg-white text-black font-bold text-xs uppercase tracking-wider hover:bg-neutral-200 transition-colors cursor-pointer rounded-xl"
              >
                SOLICITAR HABILITACIÓN DE CUENTA
              </button>
            </div>
          ) : (
            <>
              {editingReportId && (
                <div className="p-4 bg-neutral-950 rounded-2xl mb-6 flex items-center justify-between">
                  <div className="text-sm text-white flex items-center gap-2.5 font-medium">
                    <Edit2 className="w-4 h-4 text-white" />
                    <span>MODO DE EDICIÓN: Modificando tu artículo publicado</span>
                  </div>
                  <button
                    onClick={handleCancelEdit}
                    className="text-xs font-semibold text-neutral-400 hover:text-white px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 transition-colors cursor-pointer"
                  >
                    Salir sin guardar
                  </button>
                </div>
              )}

              {/* Toast for Template Download */}
              {templateDownloadedToast && (
                <div className="mb-6 p-4 rounded-2xl bg-neutral-900/90 text-white flex items-center justify-between gap-3 shadow-lg animate-in fade-in">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    <div>
                      <div className="text-sm font-semibold">
                        Plantilla JSON descargada con éxito
                      </div>
                      <div className="text-xs text-neutral-300 font-light">
                        Archivo: <code className="text-white bg-white/10 px-1.5 py-0.5 rounded">blacknews-plantilla-articulo.json</code> · Pásasela a ChatGPT, Claude o Gemini para generar el artículo completo.
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-medium text-emerald-300 hidden sm:inline bg-emerald-950/60 px-2.5 py-1 rounded-lg">
                    Listo para usar
                  </span>
                </div>
              )}

              {/* Toast for Article Import Success */}
              {importSuccessBanner && (
                <div className="mb-6 p-4 rounded-2xl bg-emerald-950/60 text-emerald-100 flex items-center gap-3 shadow-lg animate-in fade-in">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div className="text-sm font-medium">{importSuccessBanner}</div>
                </div>
              )}

              {formError && (
                <div className="p-4 rounded-2xl text-sm font-medium text-white bg-neutral-950 mb-6 flex items-center gap-2">
                  <span className="text-amber-400 font-bold">AVISO:</span> {formError}
                </div>
              )}

              {/* CONTROL BAR: ASISTENCIA EDITORIAL & PLANTILLAS IA */}
              <div className="rounded-2xl bg-neutral-950/70 p-5 sm:p-6 mb-8">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-white">
                      <div className="p-2 bg-white/10 rounded-xl">
                        <Bot className="w-5 h-5 text-white" />
                      </div>
                      <h2 className="text-base sm:text-lg font-bold uppercase tracking-wider text-white">
                        Asistencia Editorial & Plantillas para IA
                      </h2>
                    </div>
                    <p className="text-xs sm:text-sm text-neutral-300 font-light max-w-2xl leading-relaxed">
                      Descarga la plantilla oficial en formato <code className="text-white bg-white/10 px-1.5 py-0.5 rounded text-xs font-mono">.json</code> con las especificaciones de extensión y balance de párrafos para solicitar artículos a cualquier modelo de Inteligencia Artificial (ChatGPT, Claude, Gemini) o importa un artículo ya generado.
                    </p>
                  </div>

                  {/* Actions buttons */}
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <button
                      type="button"
                      onClick={handleDownloadTemplate}
                      className="px-4 py-2.5 bg-white text-black font-semibold text-xs sm:text-sm uppercase tracking-wider hover:bg-neutral-200 transition-all rounded-xl flex items-center gap-2 cursor-pointer shadow-md"
                      title="Descargar archivo .json de ejemplo con limitaciones e instrucciones para IA"
                    >
                      <Download className="w-4 h-4" />
                      <span>Descargar Plantilla JSON</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowImportModal(true)}
                      className="px-4 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white font-semibold text-xs sm:text-sm uppercase tracking-wider transition-all rounded-xl flex items-center gap-2 cursor-pointer shadow-sm"
                      title="Subir o pegar el archivo JSON generado por la IA"
                    >
                      <Upload className="w-4 h-4 text-neutral-300" />
                      <span>Importar Artículo .JSON</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowAiGuide(!showAiGuide)}
                      className="px-3.5 py-2.5 bg-neutral-900/60 hover:bg-neutral-850 text-neutral-300 hover:text-white font-medium text-xs sm:text-sm rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <HelpCircle className="w-4 h-4" />
                      <span>{showAiGuide ? 'Ocultar Guía' : 'Guía de Caracteres'}</span>
                      {showAiGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Collapsible Guide of Character Counts & Editorial Rules */}
                {showAiGuide && (
                  <div className="mt-5 pt-5 border-t border-white/5 space-y-4 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <span className="text-xs uppercase font-bold tracking-wider text-neutral-400">
                        ESPECIFICACIÓN DE LIMITACIONES Y CARACTERES RECOMENDADOS
                      </span>
                      <span className="text-[11px] text-neutral-400 font-light">
                        Válido para generación con Gemini, Claude 3.7 y GPT-4o
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                      <div className="p-3.5 bg-neutral-900/50 rounded-xl space-y-1">
                        <div className="font-semibold text-white text-sm">Titular (Title)</div>
                        <div className="text-neutral-300 font-medium">50 - 90 caracteres</div>
                        <div className="text-neutral-400 font-light leading-snug">
                          Máximo: 110 caracteres. Asertivo, riguroso, sin sensacionalismo ni signos de admiración.
                        </div>
                      </div>

                      <div className="p-3.5 bg-neutral-900/50 rounded-xl space-y-1">
                        <div className="font-semibold text-white text-sm">Subtítulo / Deck</div>
                        <div className="text-neutral-300 font-medium">120 - 220 caracteres</div>
                        <div className="text-neutral-400 font-light leading-snug">
                          Máximo: 260 caracteres. Resumen ejecutivo con el hallazgo o conclusión central.
                        </div>
                      </div>

                      <div className="p-3.5 bg-neutral-900/50 rounded-xl space-y-1">
                        <div className="font-semibold text-white text-sm">Lead (Entrada)</div>
                        <div className="text-neutral-300 font-medium">280 - 450 caracteres</div>
                        <div className="text-neutral-400 font-light leading-snug">
                          Máximo: 550 caracteres. Máxima densidad informativa; responde qué, quién, cuándo y por qué.
                        </div>
                      </div>

                      <div className="p-3.5 bg-neutral-900/50 rounded-xl space-y-1">
                        <div className="font-semibold text-white text-sm">Párrafos del Cuerpo</div>
                        <div className="text-neutral-300 font-medium">200 - 420 chars / párrafo</div>
                        <div className="text-neutral-400 font-light leading-snug">
                          Máximo: 500 caracteres por párrafo. Lectura ágil; dividir ideas en párrafos concretos.
                        </div>
                      </div>

                      <div className="p-3.5 bg-neutral-900/50 rounded-xl space-y-1">
                        <div className="font-semibold text-white text-sm">Subtítulos (Headings)</div>
                        <div className="text-neutral-300 font-medium">20 - 55 caracteres</div>
                        <div className="text-neutral-400 font-light leading-snug">
                          Estructuran el análisis por ejes temáticos bien definidos.
                        </div>
                      </div>

                      <div className="p-3.5 bg-neutral-900/50 rounded-xl space-y-1">
                        <div className="font-semibold text-white text-sm">Citas Textuales</div>
                        <div className="text-neutral-300 font-medium">80 - 240 chars (cita)</div>
                        <div className="text-neutral-400 font-light leading-snug">
                          Fuente / autor: 15 - 55 caracteres. Declaraciones directas de impacto.
                        </div>
                      </div>

                      <div className="p-3.5 bg-neutral-900/50 rounded-xl space-y-1">
                        <div className="font-semibold text-white text-sm">Cifras / Métricas</div>
                        <div className="text-neutral-300 font-medium">2 - 10 chars (valor)</div>
                        <div className="text-neutral-400 font-light leading-snug">
                          Etiqueta: 30 - 85 caracteres (ej: '+38.5%' en inversión productiva).
                        </div>
                      </div>

                      <div className="p-3.5 bg-neutral-900/50 rounded-xl space-y-1">
                        <div className="font-semibold text-white text-sm">Claves (Takeaways)</div>
                        <div className="text-neutral-300 font-medium">3 a 5 puntos sintéticos</div>
                        <div className="text-neutral-400 font-light leading-snug">
                          Extensión por punto: 60 - 130 caracteres (máximo: 150 chars).
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {previewMode ? (
                /* Vista previa */
                <div className="max-w-3xl mx-auto py-8">
                  <div className="text-xs uppercase tracking-wider text-neutral-400 font-semibold mb-2">
                    [VISTA PREVIA DEL DESPACHO]
                  </div>
                  <div className="text-xs uppercase tracking-widest text-neutral-400 mb-2 font-semibold">
                    {category} · {readTime}
                  </div>
                  <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white leading-tight mb-4">
                    {title || 'Titular del informe no especificado'}
                  </h1>
                  <p className="text-base sm:text-lg text-neutral-300 leading-relaxed mb-6 font-normal">
                    {subtitle || 'Bajada o subtítulo del informe...'}
                  </p>

                  <div className="aspect-[16/9] w-full bg-neutral-950 overflow-hidden mb-3 rounded-2xl shadow-lg">
                    <OptimizedPicture
                      image={customImageUrl.trim() ? customImageUrl : selectedImage}
                      alt={title}
                      className="w-full h-full"
                      sizes="(max-width: 768px) 100vw, 768px"
                    />
                  </div>
                  <div className="text-xs text-neutral-400 italic mb-8 font-light">
                    {imageCaption}
                  </div>

                  <div className="text-base text-neutral-200 leading-relaxed space-y-5">
                    <p className="editorial-drop-cap font-light leading-relaxed">
                      {lead || 'Entrada principal del artículo...'}
                    </p>
                    {sections.map((sec, i) => (
                      <div key={i}>
                        {sec.type === 'paragraph' && <p className="leading-relaxed">{sec.text}</p>}
                        {sec.type === 'heading' && <h3 className="text-xl font-bold text-white pt-3">{sec.text}</h3>}
                        {sec.type === 'quote' && (
                          <blockquote className="border-l-2 border-white pl-5 py-3 my-5 italic text-neutral-200 bg-neutral-950/60 rounded-r-xl">
                            "{sec.text}"
                            {sec.cite && <div className="text-xs text-neutral-400 mt-2 not-italic font-medium">— {sec.cite}</div>}
                          </blockquote>
                        )}
                        {sec.type === 'stat' && (
                          <div className="p-5 rounded-xl bg-neutral-950/60 my-5">
                            <div className="text-3xl font-bold text-white">{sec.value}</div>
                            <div className="text-xs sm:text-sm text-neutral-300 mt-1 font-light">{sec.label}</div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                /* Formulario de Redacción con Lexend, textos más grandes y contenedores limpios sin rebordes */
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  <div className="lg:col-span-8 space-y-6">
                    {/* Titular */}
                    <div className="p-5 sm:p-6 bg-neutral-950/60 rounded-2xl space-y-2.5">
                      <div className="flex items-center justify-between">
                        <label className="block text-sm font-semibold tracking-wide text-neutral-200 uppercase">
                          TITULAR DEL INFORME
                        </label>
                        <span className={`text-xs font-medium ${
                          title.length >= 50 && title.length <= 90
                            ? 'text-emerald-400'
                            : title.length > 90
                            ? 'text-amber-400'
                            : 'text-neutral-400'
                        }`}>
                          {title.length} / 90 chars · {title.length >= 50 && title.length <= 90 ? 'Óptimo' : title.length > 90 ? 'Largo' : 'Breve'}
                        </span>
                      </div>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Ej: Inversión privada impulsa la modernización portuaria"
                        className="w-full bg-neutral-900/60 rounded-xl px-4 py-3.5 text-xl sm:text-2xl font-bold text-white placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-white/20 transition-all"
                      />
                    </div>

                    {/* Subtítulo / Bajada */}
                    <div className="p-5 sm:p-6 bg-neutral-950/60 rounded-2xl space-y-2.5">
                      <div className="flex items-center justify-between">
                        <label className="block text-sm font-semibold tracking-wide text-neutral-200 uppercase">
                          SUBTÍTULO / BAJADA DE PORTADA (DECK)
                        </label>
                        <span className={`text-xs font-medium ${
                          subtitle.length >= 120 && subtitle.length <= 220
                            ? 'text-emerald-400'
                            : subtitle.length > 220
                            ? 'text-amber-400'
                            : 'text-neutral-400'
                        }`}>
                          {subtitle.length} / 220 chars
                        </span>
                      </div>
                      <textarea
                        rows={3}
                        value={subtitle}
                        onChange={(e) => setSubtitle(e.target.value)}
                        placeholder="Resumen objetivo del análisis, tesis principal o conclusión nuclear..."
                        className="w-full bg-neutral-900/60 rounded-xl p-4 text-base text-neutral-200 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-white/20 resize-none leading-relaxed transition-all"
                      />
                    </div>

                    {/* Entrada Principal (Lead) */}
                    <div className="p-5 sm:p-6 bg-neutral-950/60 rounded-2xl space-y-2.5">
                      <div className="flex items-center justify-between">
                        <label className="block text-sm font-semibold tracking-wide text-neutral-200 uppercase">
                          ENTRADA PRINCIPAL (LEAD PERIODÍSTICO)
                        </label>
                        <span className={`text-xs font-medium ${
                          lead.length >= 280 && lead.length <= 450
                            ? 'text-emerald-400'
                            : lead.length > 450
                            ? 'text-amber-400'
                            : 'text-neutral-400'
                        }`}>
                          {lead.length} / 450 chars
                        </span>
                      </div>
                      <textarea
                        rows={4}
                        value={lead}
                        onChange={(e) => setLead(e.target.value)}
                        placeholder="Párrafo inicial del despacho con máxima densidad informativa..."
                        className="w-full bg-neutral-900/60 rounded-xl p-4 text-base sm:text-lg text-white placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-white/20 resize-none leading-relaxed transition-all"
                      />
                    </div>

                    {/* Secciones del Cuerpo */}
                    <div className="space-y-4 pt-2">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2">
                        <div>
                          <span className="text-sm font-bold uppercase tracking-wider text-white">
                            BLOQUES DEL ARTÍCULO ({sections.length})
                          </span>
                          <span className="text-xs text-neutral-400 font-light block">
                            Recomendado: 200 a 420 caracteres por párrafo
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => handleAddSection('paragraph')}
                            className="px-3.5 py-1.5 text-xs sm:text-sm font-semibold rounded-xl bg-neutral-900/80 hover:bg-neutral-800 text-neutral-200 hover:text-white transition-colors cursor-pointer"
                          >
                            + PÁRRAFO
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAddSection('heading')}
                            className="px-3.5 py-1.5 text-xs sm:text-sm font-semibold rounded-xl bg-neutral-900/80 hover:bg-neutral-800 text-neutral-200 hover:text-white transition-colors cursor-pointer"
                          >
                            + SUBTÍTULO
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAddSection('quote')}
                            className="px-3.5 py-1.5 text-xs sm:text-sm font-semibold rounded-xl bg-neutral-900/80 hover:bg-neutral-800 text-neutral-200 hover:text-white transition-colors cursor-pointer"
                          >
                            + CITA
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAddSection('stat')}
                            className="px-3.5 py-1.5 text-xs sm:text-sm font-semibold rounded-xl bg-neutral-900/80 hover:bg-neutral-800 text-neutral-200 hover:text-white transition-colors cursor-pointer"
                          >
                            + CIFRA
                          </button>
                        </div>
                      </div>

                      {sections.map((section, idx) => (
                        <div key={idx} className="p-5 bg-neutral-950/60 rounded-2xl space-y-3 transition-all">
                          <div className="flex items-center justify-between text-xs">
                            <span className="bg-white/10 text-white font-semibold px-2.5 py-1 rounded-lg uppercase tracking-wider">
                              BLOQUE #{idx + 1} · {section.type}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveSection(idx)}
                              className="text-neutral-400 hover:text-red-400 font-medium transition-colors cursor-pointer px-2 py-1 rounded-md hover:bg-white/5"
                            >
                              ELIMINAR
                            </button>
                          </div>

                          {section.type === 'paragraph' && (
                            <div className="space-y-1.5">
                              <textarea
                                rows={3}
                                value={section.text}
                                onChange={(e) => handleUpdateSection(idx, { ...section, text: e.target.value })}
                                placeholder="Texto del párrafo analítico..."
                                className="w-full bg-neutral-900/60 rounded-xl p-3.5 text-sm sm:text-base text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-white/20 resize-y leading-relaxed"
                              />
                              <div className="flex items-center justify-between text-xs text-neutral-400 font-light">
                                <span>Guía: 200 - 420 caracteres</span>
                                <span className={
                                  (section.text?.length || 0) > 450 ? 'text-amber-400 font-medium' : 'text-neutral-400'
                                }>
                                  {section.text?.length || 0} caracteres
                                </span>
                              </div>
                            </div>
                          )}

                          {section.type === 'heading' && (
                            <input
                              type="text"
                              value={section.text}
                              onChange={(e) => handleUpdateSection(idx, { ...section, text: e.target.value })}
                              placeholder="Subtítulo intermedio de sección..."
                              className="w-full bg-neutral-900/60 rounded-xl px-4 py-3 text-base sm:text-lg font-bold text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-white/20"
                            />
                          )}

                          {section.type === 'quote' && (
                            <div className="space-y-2.5">
                              <textarea
                                rows={2}
                                value={section.text}
                                onChange={(e) => handleUpdateSection(idx, { ...section, text: e.target.value })}
                                placeholder="Cita textual autorizada..."
                                className="w-full bg-neutral-900/60 rounded-xl p-3.5 text-sm sm:text-base text-neutral-200 italic placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-white/20 resize-none"
                              />
                              <input
                                type="text"
                                value={section.cite || ''}
                                onChange={(e) => handleUpdateSection(idx, { ...section, cite: e.target.value })}
                                placeholder="Autor, cargo o fuente de la cita (ej: Dra. Elena Vane, Directora)..."
                                className="w-full bg-neutral-900/60 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-neutral-300 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-white/20"
                              />
                            </div>
                          )}

                          {section.type === 'stat' && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <input
                                type="text"
                                value={section.value || ''}
                                onChange={(e) => handleUpdateSection(idx, { ...section, value: e.target.value })}
                                placeholder="Valor: Ej. +41.5% o €14.2B"
                                className="bg-neutral-900/60 rounded-xl px-4 py-2.5 text-lg font-bold text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-white/20"
                              />
                              <input
                                type="text"
                                value={section.label || ''}
                                onChange={(e) => handleUpdateSection(idx, { ...section, label: e.target.value })}
                                placeholder="Explicación concisa del indicador..."
                                className="bg-neutral-900/60 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-neutral-300 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-white/20"
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Claves del Informe */}
                    <div className="p-5 sm:p-6 bg-neutral-950/60 rounded-2xl space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-sm font-bold uppercase tracking-wider text-white block">
                            CLAVES DEL INFORME (TAKEAWAYS)
                          </span>
                          <span className="text-xs text-neutral-400 font-light">
                            3 a 5 puntos sintéticos con los hallazgos principales
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={handleAddTakeaway}
                          className="px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-xl text-neutral-200 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer bg-neutral-900"
                        >
                          + AÑADIR PUNTO
                        </button>
                      </div>

                      <div className="space-y-2.5">
                        {takeawayInputs.map((val, idx) => (
                          <div key={idx} className="flex items-center gap-2.5">
                            <span className="bg-white/10 text-white font-semibold text-xs px-2.5 py-1.5 rounded-lg shrink-0">
                              {String(idx + 1).padStart(2, '0')}
                            </span>
                            <input
                              type="text"
                              value={val}
                              onChange={(e) => handleUpdateTakeaway(idx, e.target.value)}
                              placeholder="Punto clave sintetizado..."
                              className="flex-1 bg-neutral-900/60 rounded-xl px-4 py-2.5 text-sm sm:text-base text-neutral-200 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-white/20"
                            />
                            <button
                              type="button"
                              onClick={() => handleRemoveTakeaway(idx)}
                              className="text-neutral-400 hover:text-red-400 p-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                              title="Eliminar este punto"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Configuración lateral */}
                  <div className="lg:col-span-4 space-y-6">
                    <div className="p-5 sm:p-6 bg-neutral-950/60 rounded-2xl space-y-6">
                      {/* Sección Editorial */}
                      <div>
                        <label className="block text-sm font-semibold tracking-wide text-neutral-200 uppercase mb-2">
                          SECCIÓN EDITORIAL
                        </label>
                        <select
                          value={category}
                          onChange={(e) => setCategory(e.target.value as CategoryId)}
                          className="w-full bg-neutral-900 rounded-xl p-3 text-sm font-semibold text-white focus:outline-none focus:ring-1 focus:ring-white/20 cursor-pointer"
                        >
                          {categories
                            .filter((c) => c !== 'TODAS')
                            .map((cat) => (
                              <option key={cat} value={cat}>
                                {cat}
                              </option>
                            ))}
                        </select>
                      </div>

                      {/* Fotografía Editorial con Conversión AVIF */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm font-semibold uppercase tracking-wide text-neutral-200 flex items-center gap-1.5">
                            <ImageIcon className="w-4 h-4 text-white" />
                            <span>FOTOGRAFÍA EDITORIAL (.AVIF)</span>
                          </label>
                          <span className="text-[11px] text-emerald-400 font-medium">
                            Auto .AVIF
                          </span>
                        </div>

                        {/* Hidden file input */}
                        <input
                          ref={fileInputDirectRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/avif,image/tiff"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              handleDirectImageUpload(e.target.files[0]);
                            }
                          }}
                        />

                        {/* Direct Drag & Drop / Upload Zone */}
                        <div
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                              handleDirectImageUpload(e.dataTransfer.files[0]);
                            }
                          }}
                          className={`rounded-2xl border transition-all overflow-hidden mb-3 ${
                            isDirectUploading
                              ? 'border-white/30 bg-neutral-900/80 p-6 text-center cursor-wait'
                              : customImageUrl || selectedOptimizedImage
                              ? 'border-white/15 bg-neutral-950 p-3'
                              : 'border-dashed border-white/20 hover:border-white/40 bg-neutral-900/40 hover:bg-neutral-900/70 p-6 text-center cursor-pointer'
                          }`}
                          onClick={() => {
                            if (!isDirectUploading && !customImageUrl && !selectedOptimizedImage) {
                              fileInputDirectRef.current?.click();
                            }
                          }}
                        >
                          {isDirectUploading ? (
                            <div className="flex flex-col items-center justify-center space-y-2.5 py-3">
                              <RefreshCw className="w-6 h-6 text-white animate-spin" />
                              <div className="text-xs font-semibold text-white">
                                {directUploadProgress || 'Optimizando imagen a .AVIF...'}
                              </div>
                              <span className="text-[11px] text-neutral-400 font-light">
                                Generando variantes responsivas de alta fidelidad
                              </span>
                            </div>
                          ) : customImageUrl || selectedOptimizedImage ? (
                            <div className="space-y-3">
                              <div className="relative aspect-[16/9] w-full rounded-xl overflow-hidden bg-black group">
                                <OptimizedPicture
                                  image={customImageUrl || selectedImage}
                                  alt="Vista previa"
                                  className="w-full h-full"
                                  sizes="(max-width: 768px) 100vw, 768px"
                                />
                                <div className="absolute top-2 left-2 flex items-center gap-1.5 flex-wrap">
                                  <span className="bg-black/80 backdrop-blur-md text-emerald-400 border border-emerald-500/30 text-[10px] font-semibold px-2 py-0.5 rounded-md flex items-center gap-1">
                                    <Sparkles className="w-3 h-3" />
                                    <span>Formato .AVIF</span>
                                  </span>
                                  {selectedOptimizedImage?.totalSavingsPercent && (
                                    <span className="bg-emerald-950/90 text-white border border-emerald-500/40 text-[10px] font-mono px-2 py-0.5 rounded-md tabular-nums">
                                      -{selectedOptimizedImage.totalSavingsPercent}% peso
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center justify-between gap-2 pt-1 text-xs">
                                <button
                                  type="button"
                                  onClick={() => fileInputDirectRef.current?.click()}
                                  className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 hover:text-white rounded-xl font-medium transition-colors cursor-pointer border border-white/10 flex items-center gap-1.5"
                                >
                                  <Upload className="w-3.5 h-3.5 text-neutral-400" />
                                  <span>Cambiar imagen (.AVIF)</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCustomImageUrl('');
                                    setSelectedOptimizedImage(undefined);
                                    setSelectedImage(PRESET_IMAGES[0].url);
                                  }}
                                  className="text-neutral-400 hover:text-red-400 transition-colors cursor-pointer px-2 py-1"
                                >
                                  Quitar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center space-y-2">
                              <div className="p-2.5 bg-white/5 rounded-full">
                                <UploadCloud className="w-6 h-6 text-white" />
                              </div>
                              <div className="text-xs sm:text-sm font-semibold text-white">
                                Subir imagen para este informe
                              </div>
                              <p className="text-[11px] text-neutral-400 font-light max-w-xs leading-normal">
                                Arrastra o selecciona tu archivo (JPG, PNG, WebP). Se convertirá automáticamente a formato <strong>.AVIF</strong> de máxima velocidad.
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Upload feedback banner */}
                        {directUploadSuccess && (
                          <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-500/30 text-emerald-200 text-xs flex items-center gap-2 mb-3 animate-in fade-in">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                            <span>{directUploadSuccess}</span>
                          </div>
                        )}

                        {/* Fast actions row */}
                        <div className="flex items-center gap-2 mb-3">
                          <button
                            type="button"
                            onClick={() => setActiveTab('images')}
                            className="flex-1 py-2 px-3 bg-neutral-900/80 hover:bg-neutral-800 text-neutral-300 hover:text-white text-xs font-semibold uppercase tracking-wider rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-white/10"
                          >
                            <Zap className="w-3.5 h-3.5 text-amber-400" />
                            <span>Panel de Optimización .AVIF</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setShowPresetGallery(!showPresetGallery)}
                            className="py-2 px-3 bg-neutral-900/50 hover:bg-neutral-850 text-neutral-400 hover:text-neutral-200 text-xs rounded-xl transition-colors cursor-pointer"
                          >
                            {showPresetGallery ? 'Ocultar archivo' : 'Banco de archivo & URL'}
                          </button>
                        </div>

                        {/* Collapsible presets & manual URL */}
                        {showPresetGallery && (
                          <div className="space-y-2.5 p-3 rounded-2xl bg-neutral-900/40 border border-white/5 mb-3 animate-in fade-in">
                            <div className="text-[11px] text-neutral-400 uppercase font-semibold">
                              Selección de fotos de archivo:
                            </div>
                            <div className="grid grid-cols-2 gap-1.5">
                              {PRESET_IMAGES.map((img) => (
                                <button
                                  key={img.label}
                                  type="button"
                                  onClick={() => {
                                    setSelectedImage(img.url);
                                    setImageCaption(img.defaultCaption);
                                    setCustomImageUrl('');
                                    setSelectedOptimizedImage(undefined);
                                  }}
                                  className={`p-1.5 text-left transition-all cursor-pointer rounded-lg ${
                                    selectedImage === img.url && !customImageUrl
                                      ? 'bg-white/15 ring-1 ring-white'
                                      : 'opacity-70 hover:opacity-100 bg-neutral-950/60'
                                  }`}
                                >
                                  <div className="aspect-[16/9] w-full overflow-hidden mb-1 rounded">
                                    <OptimizedPicture image={img.url} alt={img.label} className="w-full h-full" sizes="200px" />
                                  </div>
                                  <div className="text-[10px] truncate text-neutral-200 font-medium">{img.label}</div>
                                </button>
                              ))}
                            </div>

                            <input
                              type="url"
                              value={customImageUrl}
                              onChange={(e) => {
                                setCustomImageUrl(e.target.value);
                                setSelectedOptimizedImage(undefined);
                              }}
                              placeholder="O escribe URL de imagen remota..."
                              className="w-full bg-neutral-900 rounded-xl p-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-white/20"
                            />
                          </div>
                        )}

                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                              Pie de foto / Personaje o Crédito (Opcional)
                            </label>
                            {imageCaption && (
                              <button
                                type="button"
                                onClick={() => setImageCaption('')}
                                className="text-[11px] text-neutral-500 hover:text-neutral-300 underline cursor-pointer"
                              >
                                Borrar
                              </button>
                            )}
                          </div>
                          <p className="text-[11px] text-neutral-400 font-light">
                            Aparece en la base de la foto del post a la misma altura del logo BlackNews, compacto y alineado a la derecha. Dejar vacío si no hay personaje.
                          </p>
                          <input
                            type="text"
                            value={imageCaption}
                            onChange={(e) => setImageCaption(e.target.value)}
                            placeholder="Ej: Benjamin Netanyahu · Primer Ministro (o dejar en blanco)"
                            className="w-full bg-neutral-900/60 rounded-xl p-3 text-xs sm:text-sm text-neutral-300 focus:outline-none focus:ring-1 focus:ring-white/20 font-['Lexend']"
                          />
                        </div>
                      </div>

                      {/* Tiempo de lectura */}
                      <div>
                        <label className="block text-sm font-semibold tracking-wide text-neutral-200 uppercase mb-1.5">
                          TIEMPO DE LECTURA
                        </label>
                        <input
                          type="text"
                          value={readTime}
                          onChange={(e) => setReadTime(e.target.value)}
                          placeholder="Ej: 5 min de lectura"
                          className="w-full bg-neutral-900 rounded-xl p-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/20"
                        />
                      </div>

                      {/* Etiquetas */}
                      <div>
                        <label className="block text-sm font-semibold tracking-wide text-neutral-200 uppercase mb-1.5">
                          ETIQUETAS
                        </label>
                        <input
                          type="text"
                          value={tagString}
                          onChange={(e) => setTagString(e.target.value)}
                          placeholder="Libre Mercado, Competencia, Propiedad"
                          className="w-full bg-neutral-900 rounded-xl p-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/20"
                        />
                      </div>

                      {/* Marcar como exclusiva */}
                      <div className="p-3.5 bg-neutral-900/50 rounded-xl flex items-center gap-3">
                        <input
                          type="checkbox"
                          id="chk-exclusive"
                          checked={exclusive}
                          onChange={(e) => setExclusive(e.target.checked)}
                          className="w-4 h-4 bg-black accent-white cursor-pointer rounded"
                        />
                        <label htmlFor="chk-exclusive" className="text-xs sm:text-sm font-semibold text-neutral-200 uppercase cursor-pointer">
                          MARCAR COMO EXCLUSIVA DE BLACKNEWS
                        </label>
                      </div>

                      {/* Botones de Borrador y Publicar */}
                      <div className="grid grid-cols-2 gap-2 mt-6">
                        <button
                          type="button"
                          onClick={handleSaveDraft}
                          disabled={drafts.length >= MAX_DRAFTS_PER_USER}
                          className="py-3 px-3 bg-neutral-900 hover:bg-neutral-850 text-neutral-200 hover:text-white font-semibold text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-white/10"
                          title={`Guardar borrador (${drafts.length}/${MAX_DRAFTS_PER_USER})`}
                        >
                          <Bookmark className="w-3.5 h-3.5 text-amber-400" />
                          <span>Guardar Borrador</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsDraftsModalOpen(true)}
                          className="py-3 px-3 bg-neutral-900/60 hover:bg-neutral-800 text-neutral-300 hover:text-white font-semibold text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                        >
                          <span>Borradores ({drafts.length})</span>
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={handleSaveOrPublish}
                        className="w-full py-4 bg-white text-black font-bold text-sm uppercase tracking-wider hover:bg-neutral-200 transition-all flex items-center justify-center gap-2 cursor-pointer rounded-xl shadow-xl mt-3"
                      >
                        <Send className="w-4 h-4" />
                        <span>{editingReportId ? 'GUARDAR CAMBIOS' : 'PUBLICAR'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* TAB CONTENT: OPTIMIZADOR AVIF */}
      {activeTab === 'images' && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8">
          <ImageOptimizationStudio
            onSelectForArticle={handleSelectOptimizedImageForArticle}
            currentArticleTitle={title || undefined}
          />
        </div>
      )}

      {/* TAB CONTENT: GESTIÓN DE CATEGORÍAS (Admin only) */}
      {activeTab === 'categories' && permissions.canManageCategories && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8">
          <CategoryManager
            categories={categories}
            onUpdateCategories={onUpdateCategories}
            reports={publishedReports}
          />
        </div>
      )}

      {/* TAB CONTENT: GENERADOR DE POSTS 4:5 */}
      {activeTab === 'post-generator' && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8">
          <SocialPostGenerator
            reports={publishedReports}
            categories={categories}
          />
        </div>
      )}

      {/* TAB CONTENT 3: GESTIÓN DE ROLES Y USUARIOS */}
      {activeTab === 'users' && permissions.canManageUsers && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 space-y-10">
          <div className="pb-4 border-b border-white/5">
            <div className="flex items-center gap-2 text-xs font-mono text-neutral-400 uppercase mb-1">
              <ShieldCheck className="w-3.5 h-3.5 text-white" />
              <span>ADMINISTRACIÓN DE PERMISOS</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-medium text-white tracking-tight uppercase">
              ASIGNACIÓN DE ROLES A USUARIOS
            </h2>
            <p className="text-xs text-neutral-400 mt-1 max-w-2xl">
              Cualquier usuario que se registre inicia como <strong>Lector</strong> (sin capacidad de edición). Aquí puedes asignar permisos de <strong>Redactor</strong> a cuentas específicas para que redacten y editen exclusivamente sus propios artículos.
            </p>
          </div>

          <div className="divide-y divide-white/5 border border-white/10 p-4 sm:p-6">
            {allRedactors.map((member) => {
              const isSelf = member.id === currentUser.id;
              return (
                <div key={member.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white text-sm">{member.name}</span>
                      <span className={`text-[10px] font-mono px-2 py-0.5 border ${
                        member.role === 'ADMIN'
                          ? 'border-white text-white font-semibold'
                          : member.role === 'MODERADOR'
                          ? 'border-neutral-400 text-neutral-200'
                          : member.role === 'REDACTOR'
                          ? 'border-neutral-500 text-neutral-300'
                          : 'border-neutral-700 text-neutral-500'
                      }`}>
                        {member.role === 'LECTOR' ? 'LECTOR (SIN EDICIÓN)' : member.role}
                      </span>
                      {isSelf && (
                        <span className="text-[10px] font-mono text-neutral-400">(TÚ)</span>
                      )}
                    </div>
                    <div className="text-xs font-mono text-neutral-400 mt-0.5">{member.email}</div>
                    <div className="text-xs text-neutral-500 font-mono mt-0.5">
                      {member.bureau} · {member.title}
                    </div>
                  </div>

                  {/* Role Assignment Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] font-mono text-neutral-500 uppercase mr-1">
                      Asignar Rol:
                    </span>
                    <button
                      onClick={() => onChangeUserRole(member.id, 'LECTOR')}
                      className={`px-2.5 py-1 text-xs font-mono transition-colors cursor-pointer border ${
                        member.role === 'LECTOR'
                          ? 'bg-neutral-800 text-white border-neutral-600'
                          : 'border-white/10 text-neutral-400 hover:text-white'
                      }`}
                      title="Usuario básico sin permisos de edición"
                    >
                      LECTOR
                    </button>
                    <button
                      onClick={() => onChangeUserRole(member.id, 'REDACTOR')}
                      className={`px-2.5 py-1 text-xs font-mono transition-colors cursor-pointer border ${
                        member.role === 'REDACTOR'
                          ? 'bg-white text-black border-white font-semibold'
                          : 'border-white/10 text-neutral-300 hover:text-white'
                      }`}
                      title="Permite redactar y editar solo sus propios artículos"
                    >
                      REDACTOR
                    </button>
                    <button
                      onClick={() => onChangeUserRole(member.id, 'MODERADOR')}
                      className={`px-2.5 py-1 text-xs font-mono transition-colors cursor-pointer border ${
                        member.role === 'MODERADOR'
                          ? 'bg-white text-black border-white font-semibold'
                          : 'border-white/10 text-neutral-300 hover:text-white'
                      }`}
                      title="Permite gestionar la portada y asignar roles"
                    >
                      MODERADOR
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB CONTENT 4: DESPACHOS PUBLICADOS */}
      {activeTab === 'my-articles' && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8">
          <div className="flex items-center justify-between pb-3 mb-6 border-b border-white/5">
            <div>
              <h2 className="text-lg font-medium text-white tracking-tight uppercase">
                DESPACHOS PUBLICADOS ({publishedReports.length})
              </h2>
            </div>
            {permissions.canWritePosts && (
              <button
                onClick={() => {
                  setEditingReportId(null);
                  setTitle('');
                  setSubtitle('');
                  setLead('');
                  setActiveTab('builder');
                }}
                className="text-xs font-medium uppercase tracking-wider text-white hover:text-neutral-300 transition-colors cursor-pointer"
              >
                + REDACTAR NUEVO INFORME
              </button>
            )}
          </div>

          <div className="divide-y divide-white/5">
            {publishedReports.map((report) => {
              const canEditThis = canUserEditThisReport(report);
              const isAuthor = (report.authorEmail && report.authorEmail.toLowerCase() === currentUser.email.toLowerCase()) ||
                (report.author && report.author.name.toLowerCase() === currentUser.name.toLowerCase());

              return (
                <div key={report.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group">
                  <div className="max-w-3xl">
                    <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-neutral-400 mb-1">
                      <span>{report.category}</span>
                      <span>·</span>
                      <span>{report.publishedAt}</span>
                      {isAuthor && (
                        <span className="text-white border border-white/30 px-1.5 py-0.2 font-mono">
                          TU DESPACHO
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-medium text-white group-hover:text-neutral-300 transition-colors leading-snug">
                      {report.title}
                    </h3>
                    <p className="text-xs text-neutral-400 mt-1 line-clamp-1">
                      Por {report.author.name} · {report.author.bureau}
                    </p>
                  </div>

                  {/* Actions: only allowed if authorized (Admin or Author) */}
                  <div className="flex items-center gap-3 shrink-0">
                    {canEditThis ? (
                      <>
                        <button
                          onClick={() => handleStartEdit(report)}
                          className="text-xs font-mono text-neutral-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer px-2.5 py-1 border border-white/20 hover:border-white"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>EDITAR</span>
                        </button>
                        {(currentUser.role === 'ADMIN' || isAuthor) && (
                          <button
                            onClick={() => onDeleteReport(report.id)}
                            className="text-xs font-mono text-neutral-500 hover:text-red-400 flex items-center gap-1 transition-colors cursor-pointer px-2 py-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>RETIRAR</span>
                          </button>
                        )}
                      </>
                    ) : (
                      <span className="text-[11px] font-mono text-neutral-600">
                        {isBasicReader ? 'Lectura pública' : 'Edición reservada al autor'}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB CONTENT 5: SOLICITUD DE ACREDITACIÓN (PARA LECTORES) */}
      {activeTab === 'register' && (
        <div className="max-w-xl mx-auto px-4 sm:px-6 pt-10">
          {regSubmitted ? (
            <div className="p-8 text-center border border-white/10">
              <CheckCircle className="w-8 h-8 text-white mx-auto mb-3" />
              <h2 className="text-lg font-medium text-white uppercase tracking-wider mb-2">
                SOLICITUD REGISTRADA CON ÉXITO
              </h2>
              <p className="text-xs text-neutral-400 leading-relaxed max-w-md mx-auto mb-6">
                Tu solicitud ha sido enviada. Cuando un administrador habilite tu cuenta, tendrás permisos de redactor para publicar y editar exclusivamente tus propios artículos.
              </p>
              <button
                onClick={() => setRegSubmitted(false)}
                className="px-4 py-2 border border-white/20 text-xs font-mono uppercase text-white hover:border-white transition-colors cursor-pointer"
              >
                ENVIAR OTRA SOLICITUD
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmitRegistration} className="space-y-5 border border-white/10 p-6 sm:p-8">
              <div>
                <h2 className="text-base font-medium text-white uppercase tracking-wider mb-1">
                  SOLICITUD DE PERMISOS DE REDACTOR
                </h2>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Por política del medio, todos los usuarios inician como lectores básicos sin capacidad de edición. Si deseas que se te asigne una cuenta de redactor para publicar despachos, completa los datos a continuación:
                </p>
              </div>

              <div>
                <label className="block text-xs font-mono text-neutral-400 uppercase mb-1">
                  NOMBRE COMPLETO *
                </label>
                <input
                  type="text"
                  required
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="Nombre y apellidos"
                  className="w-full bg-black border-b border-white/20 pb-1 text-sm text-white focus:outline-none focus:border-white"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-neutral-400 uppercase mb-1">
                  CORREO ELECTRÓNICO REGISTRADO *
                </label>
                <input
                  type="email"
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="tu_cuenta@gmail.com"
                  className="w-full bg-black border-b border-white/20 pb-1 text-sm text-white focus:outline-none focus:border-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-neutral-400 uppercase mb-1">
                    CIUDAD / CORRESPONSALÍA
                  </label>
                  <input
                    type="text"
                    value={regBureau}
                    onChange={(e) => setRegBureau(e.target.value)}
                    placeholder="Ej: Madrid"
                    className="w-full bg-black border-b border-white/20 pb-1 text-xs text-white focus:outline-none focus:border-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-neutral-400 uppercase mb-1">
                    ESPECIALIDAD O CARGO
                  </label>
                  <input
                    type="text"
                    value={regTitle}
                    onChange={(e) => setRegTitle(e.target.value)}
                    placeholder="Ej: Analista de Mercados"
                    className="w-full bg-black border-b border-white/20 pb-1 text-xs text-white focus:outline-none focus:border-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-neutral-400 uppercase mb-1">
                  ENFOQUE O PROPUESTA EDITORIAL
                </label>
                <textarea
                  rows={3}
                  value={regBio}
                  onChange={(e) => setRegBio(e.target.value)}
                  placeholder="Temas que deseas cubrir y trayectoria..."
                  className="w-full bg-black border border-white/10 p-2 text-xs text-white focus:outline-none focus:border-white resize-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-white text-black font-medium text-xs uppercase tracking-wider hover:bg-neutral-200 transition-colors cursor-pointer"
              >
                ENVIAR SOLICITUD A LA ADMINISTRACIÓN
              </button>
            </form>
          )}
        </div>
      )}
      </main>

      {/* Modal para importar artículos desde JSON */}
      <ImportArticleModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleApplyImportedArticle}
      />

      {/* Barra de menú flotante simple para el redactor */}
      {activeTab === 'builder' && permissions.canWritePosts && (
        <RedactorFloatingBar
          onPublish={handleSaveOrPublish}
          onSaveDraft={handleSaveDraft}
          onOpenDrafts={() => setIsDraftsModalOpen(true)}
          onTogglePreview={() => setPreviewMode(!previewMode)}
          previewMode={previewMode}
          draftsCount={drafts.length}
          maxDrafts={MAX_DRAFTS_PER_USER}
          isEditing={Boolean(editingReportId)}
          canWrite={permissions.canWritePosts}
          lastSavedAt={lastSavedDraftAt}
        />
      )}

      {/* Modal de Gestión de Borradores (Límite 100 por redactor) */}
      <DraftsModal
        isOpen={isDraftsModalOpen}
        onClose={() => setIsDraftsModalOpen(false)}
        drafts={drafts}
        onLoadDraft={handleLoadDraft}
        onDeleteDraft={handleDeleteDraft}
        onNewBlankArticle={handleNewBlankArticle}
        maxDrafts={MAX_DRAFTS_PER_USER}
      />
    </div>
  );
};
