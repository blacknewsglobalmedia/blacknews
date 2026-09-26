import React, { useState } from 'react';
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
  Zap
} from 'lucide-react';
import { Report, ReportSection, CategoryId, OptimizedImageSet } from '../types/news';
import { RedactorProfile, RedactorRole, ROLE_PERMISSIONS } from '../types/auth';
import { FrontPageLayoutConfig, AutomationPreset } from '../types/layout';
import { FlashNews } from '../types/news';
import { FrontPageManager } from './FrontPageManager';
import { ImageOptimizationStudio } from './ImageOptimizationStudio';

interface RedactionStudioProps {
  onBackToNews: () => void;
  onPublishReport: (newReport: Report) => void;
  onUpdateExistingReport: (updatedReport: Report) => void;
  currentUser: RedactorProfile;
  onSwitchUser: (user: RedactorProfile) => void;
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
  onSwitchUser,
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
}) => {
  const permissions = ROLE_PERMISSIONS[currentUser.role];

  // Default tab based on role
  const [activeTab, setActiveTab] = useState<'layout' | 'builder' | 'images' | 'users' | 'my-articles' | 'register'>(
    permissions.canWritePosts ? 'builder' : 'my-articles'
  );
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
  const [category, setCategory] = useState<CategoryId>('ECONOMÍA & MERCADOS');
  const [selectedImage, setSelectedImage] = useState(PRESET_IMAGES[0].url);
  const [imageCaption, setImageCaption] = useState(PRESET_IMAGES[0].defaultCaption);
  const [customImageUrl, setCustomImageUrl] = useState('');
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

  const handleSelectOptimizedImageForArticle = (optSet: OptimizedImageSet) => {
    setSelectedOptimizedImage(optSet);
    const bestVariant = optSet.variants.find(v => v.format === 'avif' && v.width === 1200) ||
                        optSet.variants.find(v => v.format === 'avif' && v.width === 800) ||
                        optSet.variants[0];
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
        imageCaption: imageCaption.trim() || 'Archivo fotográfico.',
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
      imageCaption: imageCaption.trim() || 'Archivo fotográfico de la redacción.',
      lead: lead.trim(),
      sections: sections.filter((s) => (s.text && s.text.trim().length > 0) || s.value),
      keyTakeaways: takeawayInputs.filter((t) => t.trim().length > 0),
      tags: finalTags,
      exclusive,
      trending: true,
    };

    onPublishReport(newReport);
    setPublishSuccess(true);
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

  return (
    <div className="min-h-screen bg-black text-white font-sans pb-20">
      {/* Studio Topbar: Ultra-minimalist */}
      <div className="border-b border-white/10 bg-black px-4 sm:px-6 py-3.5 sticky top-0 z-30 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToNews}
            className="flex items-center gap-2 text-xs sm:text-sm font-semibold uppercase tracking-wider text-neutral-400 hover:text-white transition-colors cursor-pointer py-1 px-2.5 rounded-md hover:bg-white/5"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>PORTADA</span>
          </button>
          <span className="text-neutral-700">/</span>
          <span className="text-xs font-sans uppercase tracking-wider text-white font-semibold">
            SISTEMA EDITORIAL
          </span>
        </div>

        {/* User Identity & Fast Role Switcher */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={onOpenGoogleAuth}
            className="flex items-center gap-2 text-xs font-sans py-1.5 px-3 border border-white/15 hover:border-white transition-colors cursor-pointer rounded-md hover:bg-white/5"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                currentUser.role === 'ADMIN'
                  ? 'bg-white'
                  : currentUser.role === 'MODERADOR'
                  ? 'bg-neutral-300'
                  : currentUser.role === 'REDACTOR'
                  ? 'bg-neutral-500'
                  : 'bg-neutral-700'
              }`}
            ></span>
            <span className="text-white font-semibold">{currentUser.name}</span>
            <span className="text-neutral-400">[{currentUser.role}]</span>
          </button>

          <div className="flex items-center gap-1 text-xs font-sans">
            <span className="text-neutral-500 hidden md:inline mr-1 text-[11px] font-medium uppercase">PROBAR:</span>
            {allRedactors
              .filter((u) => u.role !== 'LECTOR')
              .slice(0, 3)
              .map((user) => (
                <button
                  key={user.id}
                  onClick={() => onSwitchUser(user)}
                  className={`px-2.5 py-1 transition-colors cursor-pointer text-xs rounded-md border ${
                    currentUser.id === user.id
                      ? 'border-white text-white font-semibold bg-white/10'
                      : 'border-white/10 text-neutral-400 hover:text-white hover:border-white/30'
                  }`}
                  title={`Cambiar a ${user.name} (${user.role})`}
                >
                  {user.avatarInitials}
                </button>
              ))}
          </div>
        </div>
      </div>

      {/* Main Studio Navigation Tabs: Purely typographical */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 pb-4 border-b border-white/10 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4 sm:gap-6 text-xs sm:text-sm font-semibold uppercase tracking-wider overflow-x-auto no-scrollbar">
          {/* TAB 1: GESTIÓN DE PORTADA (Admin/Moderator only) */}
          {permissions.canManageLayout && (
            <button
              onClick={() => setActiveTab('layout')}
              className={`transition-colors cursor-pointer flex items-center gap-1.5 pb-1 whitespace-nowrap ${
                activeTab === 'layout'
                  ? 'text-white border-b-2 border-white font-bold'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>GESTIÓN DE PORTADA</span>
            </button>
          )}

          {/* TAB 2: CONSTRUCTOR / EDITOR DE ARTÍCULOS */}
          <button
            onClick={() => setActiveTab('builder')}
            className={`transition-colors cursor-pointer flex items-center gap-1.5 pb-1 whitespace-nowrap ${
              activeTab === 'builder'
                ? 'text-white border-b-2 border-white font-bold'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>{editingReportId ? 'EDITANDO INFORME' : 'CONSTRUCTOR DE ARTÍCULOS'}</span>
          </button>

          {/* TAB: OPTIMIZADOR DE IMÁGENES & R2 */}
          <button
            onClick={() => setActiveTab('images')}
            className={`transition-colors cursor-pointer flex items-center gap-1.5 pb-1 whitespace-nowrap ${
              activeTab === 'images'
                ? 'text-white border-b-2 border-white font-bold'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>OPTIMIZADOR AVIF & R2</span>
          </button>

          {/* TAB 3: GESTIÓN DE EQUIPO & ROLES (Admin/Moderator only) */}
          {permissions.canManageUsers && (
            <button
              onClick={() => setActiveTab('users')}
              className={`transition-colors cursor-pointer flex items-center gap-1.5 pb-1 whitespace-nowrap ${
                activeTab === 'users'
                  ? 'text-white border-b-2 border-white font-bold'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>ROLES & USUARIOS</span>
            </button>
          )}

          {/* TAB 4: ARTÍCULOS PUBLICADOS */}
          <button
            onClick={() => setActiveTab('my-articles')}
            className={`transition-colors cursor-pointer flex items-center gap-1.5 pb-1 whitespace-nowrap ${
              activeTab === 'my-articles'
                ? 'text-white border-b-2 border-white font-bold'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>DESPACHOS ({publishedReports.length})</span>
          </button>

          {/* TAB 5: SOLICITAR ACREDITACIÓN (For basic readers) */}
          {isBasicReader && (
            <button
              onClick={() => setActiveTab('register')}
              className={`transition-colors cursor-pointer flex items-center gap-1.5 pb-1 whitespace-nowrap ${
                activeTab === 'register'
                  ? 'text-white border-b-2 border-white font-bold'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>SOLICITAR PERMISOS DE REDACCIÓN</span>
            </button>
          )}
        </div>

        {activeTab === 'builder' && permissions.canWritePosts && (
          <div className="flex items-center gap-3">
            {editingReportId && (
              <button
                onClick={handleCancelEdit}
                className="text-xs font-sans font-medium text-neutral-400 hover:text-white transition-colors cursor-pointer"
              >
                CANCELAR EDICIÓN
              </button>
            )}
            <button
              onClick={() => setPreviewMode(!previewMode)}
              className="text-xs font-sans font-medium uppercase tracking-wider text-neutral-400 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer py-1.5 px-3 rounded-md hover:bg-white/5"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{previewMode ? 'VOLVER AL EDITOR' : 'VISTA PREVIA'}</span>
            </button>
            <button
              onClick={handleSaveOrPublish}
              className="px-4 py-2 bg-white text-black hover:bg-neutral-200 font-semibold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer rounded-md shadow-sm"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{editingReportId ? 'GUARDAR CAMBIOS' : 'PUBLICAR EN PORTADA'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Success Notification */}
      {publishSuccess && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4">
          <div className="p-4 border border-white text-white flex items-center gap-3 bg-neutral-950">
            <CheckCircle className="w-5 h-5 text-white shrink-0" />
            <div>
              <div className="font-medium text-sm">
                {editingReportId ? '¡INFORME ACTUALIZADO CON ÉXITO!' : '¡INFORME PUBLICADO EXITOSAMENTE!'}
              </div>
              <div className="text-xs text-neutral-400 mt-0.5">
                Los cambios se han sincronizado con la portada de BLACKNEWS.
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8">
          {/* If user is basic reader: block editing with clear message */}
          {!permissions.canWritePosts ? (
            <div className="p-8 border border-white/15 max-w-2xl mx-auto text-center my-8 bg-neutral-950">
              <Lock className="w-8 h-8 text-neutral-400 mx-auto mb-3" />
              <h3 className="text-sm font-medium uppercase tracking-wider text-white mb-2">
                CUENTA DE USUARIO BÁSICO (LECTOR)
              </h3>
              <p className="text-xs text-neutral-400 leading-relaxed max-w-lg mx-auto mb-6">
                Los usuarios registrados no tienen permisos de redacción ni edición por defecto. Cuando la administración habilite específicamente tu cuenta como <strong>Redactor</strong>, podrás redactar y editar exclusivamente tus propios artículos.
              </p>
              <button
                onClick={() => setActiveTab('register')}
                className="px-4 py-2 bg-white text-black font-medium text-xs uppercase tracking-wider hover:bg-neutral-200 transition-colors cursor-pointer"
              >
                SOLICITAR HABILITACIÓN DE CUENTA
              </button>
            </div>
          ) : (
            <>
              {editingReportId && (
                <div className="p-3 bg-neutral-950 border border-white/20 mb-6 flex items-center justify-between">
                  <div className="text-xs font-mono text-white flex items-center gap-2">
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>MODO DE EDICIÓN: Modificando tu artículo publicado</span>
                  </div>
                  <button
                    onClick={handleCancelEdit}
                    className="text-xs font-mono text-neutral-400 hover:text-white underline cursor-pointer"
                  >
                    Salir sin guardar
                  </button>
                </div>
              )}

              {formError && (
                <div className="p-4 border border-white/30 text-xs font-mono text-white mb-6">
                  AVISO: {formError}
                </div>
              )}

              {previewMode ? (
                /* Vista previa */
                <div className="max-w-3xl mx-auto py-8">
                  <div className="text-xs font-mono text-neutral-500 uppercase tracking-wider mb-2">
                    [VISTA PREVIA DEL DESPACHO]
                  </div>
                  <div className="text-xs font-mono uppercase tracking-widest text-neutral-400 mb-2">
                    {category} · {readTime}
                  </div>
                  <h1 className="text-3xl sm:text-4xl font-medium tracking-tight text-white leading-tight mb-4">
                    {title || 'Titular del informe no especificado'}
                  </h1>
                  <p className="text-base text-neutral-300 leading-relaxed mb-6 font-normal">
                    {subtitle || 'Bajada o subtítulo del informe...'}
                  </p>

                  <div className="aspect-[16/9] w-full bg-neutral-950 overflow-hidden mb-3">
                    <img
                      src={customImageUrl.trim() ? customImageUrl : selectedImage}
                      alt={title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="text-xs text-neutral-500 italic mb-8">
                    {imageCaption}
                  </div>

                  <div className="text-sm text-neutral-200 leading-relaxed space-y-4">
                    <p className="first-letter:text-4xl first-letter:float-left first-letter:mr-2 font-light">
                      {lead || 'Entrada principal del artículo...'}
                    </p>
                    {sections.map((sec, i) => (
                      <div key={i}>
                        {sec.type === 'paragraph' && <p>{sec.text}</p>}
                        {sec.type === 'heading' && <h3 className="text-lg font-medium text-white pt-2">{sec.text}</h3>}
                        {sec.type === 'quote' && (
                          <blockquote className="border-l-2 border-white pl-4 py-2 my-4 italic text-neutral-300">
                            "{sec.text}"
                            {sec.cite && <div className="text-xs text-neutral-500 mt-1 not-italic font-mono">— {sec.cite}</div>}
                          </blockquote>
                        )}
                        {sec.type === 'stat' && (
                          <div className="p-4 border border-white/10 my-4">
                            <div className="text-2xl font-mono font-medium text-white">{sec.value}</div>
                            <div className="text-xs text-neutral-400 mt-1">{sec.label}</div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                /* Formulario de Redacción */
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  <div className="lg:col-span-8 space-y-6">
                    <div>
                      <label className="block text-xs font-mono uppercase tracking-wider text-neutral-400 mb-2">
                        TITULAR DEL INFORME (MEDIUM WEIGHT, SIN SUBRAYADOS)
                      </label>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Ej: Inversión privada impulsa la modernización portuaria"
                        className="w-full bg-black border-b border-white/20 pb-2 text-lg sm:text-xl font-medium text-white placeholder-neutral-600 focus:outline-none focus:border-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-mono uppercase tracking-wider text-neutral-400 mb-2">
                        SUBTÍTULO / BAJADA DE PORTADA (DECK)
                      </label>
                      <textarea
                        rows={2}
                        value={subtitle}
                        onChange={(e) => setSubtitle(e.target.value)}
                        placeholder="Resumen objetivo del análisis..."
                        className="w-full bg-black border-b border-white/20 pb-2 text-sm text-neutral-300 placeholder-neutral-600 focus:outline-none focus:border-white resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-mono uppercase tracking-wider text-neutral-400 mb-2">
                        ENTRADA PRINCIPAL (LEAD)
                      </label>
                      <textarea
                        rows={4}
                        value={lead}
                        onChange={(e) => setLead(e.target.value)}
                        placeholder="Párrafo inicial del despacho..."
                        className="w-full bg-black border border-white/10 p-3 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-white resize-none"
                      />
                    </div>

                    {/* Secciones del Cuerpo */}
                    <div className="space-y-4 pt-4 border-t border-white/5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono uppercase tracking-wider text-neutral-400 font-medium">
                          BLOQUES DEL ARTÍCULO ({sections.length})
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleAddSection('paragraph')}
                            className="px-2.5 py-1 text-xs font-mono border border-white/15 text-neutral-300 hover:text-white hover:border-white transition-colors cursor-pointer"
                          >
                            + PÁRRAFO
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAddSection('heading')}
                            className="px-2.5 py-1 text-xs font-mono border border-white/15 text-neutral-300 hover:text-white hover:border-white transition-colors cursor-pointer"
                          >
                            + SUBTÍTULO
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAddSection('quote')}
                            className="px-2.5 py-1 text-xs font-mono border border-white/15 text-neutral-300 hover:text-white hover:border-white transition-colors cursor-pointer"
                          >
                            + CITA
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAddSection('stat')}
                            className="px-2.5 py-1 text-xs font-mono border border-white/15 text-neutral-300 hover:text-white hover:border-white transition-colors cursor-pointer"
                          >
                            + CIFRA
                          </button>
                        </div>
                      </div>

                      {sections.map((section, idx) => (
                        <div key={idx} className="p-3 border border-white/10 space-y-2">
                          <div className="flex items-center justify-between text-xs font-mono text-neutral-500">
                            <span>BLOQUE #{idx + 1} · {section.type.toUpperCase()}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveSection(idx)}
                              className="hover:text-red-400 transition-colors cursor-pointer"
                            >
                              ELIMINAR
                            </button>
                          </div>

                          {section.type === 'paragraph' && (
                            <textarea
                              rows={3}
                              value={section.text}
                              onChange={(e) => handleUpdateSection(idx, { ...section, text: e.target.value })}
                              placeholder="Texto del párrafo..."
                              className="w-full bg-black border-b border-white/10 pb-1 text-xs sm:text-sm text-neutral-200 focus:outline-none focus:border-white resize-none"
                            />
                          )}

                          {section.type === 'heading' && (
                            <input
                              type="text"
                              value={section.text}
                              onChange={(e) => handleUpdateSection(idx, { ...section, text: e.target.value })}
                              placeholder="Subtítulo intermedio..."
                              className="w-full bg-black border-b border-white/10 pb-1 text-sm font-medium text-white focus:outline-none focus:border-white"
                            />
                          )}

                          {section.type === 'quote' && (
                            <div className="space-y-2">
                              <textarea
                                rows={2}
                                value={section.text}
                                onChange={(e) => handleUpdateSection(idx, { ...section, text: e.target.value })}
                                placeholder="Cita textual..."
                                className="w-full bg-black border-b border-white/10 pb-1 text-xs sm:text-sm text-neutral-300 italic focus:outline-none focus:border-white resize-none"
                              />
                              <input
                                type="text"
                                value={section.cite || ''}
                                onChange={(e) => handleUpdateSection(idx, { ...section, cite: e.target.value })}
                                placeholder="Fuente o autor de la cita..."
                                className="w-full bg-black border-b border-white/10 pb-1 text-xs font-mono text-neutral-400 focus:outline-none focus:border-white"
                              />
                            </div>
                          )}

                          {section.type === 'stat' && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <input
                                type="text"
                                value={section.value || ''}
                                onChange={(e) => handleUpdateSection(idx, { ...section, value: e.target.value })}
                                placeholder="Valor: Ej. +32%"
                                className="bg-black border-b border-white/10 pb-1 text-sm font-mono text-white focus:outline-none focus:border-white"
                              />
                              <input
                                type="text"
                                value={section.label || ''}
                                onChange={(e) => handleUpdateSection(idx, { ...section, label: e.target.value })}
                                placeholder="Explicación del indicador..."
                                className="bg-black border-b border-white/10 pb-1 text-xs text-neutral-400 focus:outline-none focus:border-white"
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Claves del Informe */}
                    <div className="space-y-3 pt-4 border-t border-white/5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono uppercase tracking-wider text-neutral-400 font-medium">
                          CLAVES DEL INFORME (TAKEAWAYS)
                        </span>
                        <button
                          type="button"
                          onClick={handleAddTakeaway}
                          className="px-2.5 py-1 text-xs font-mono border border-white/15 text-neutral-300 hover:text-white transition-colors cursor-pointer"
                        >
                          + AÑADIR PUNTO
                        </button>
                      </div>
                      {takeawayInputs.map((val, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="text-xs font-mono text-neutral-500">{String(idx + 1).padStart(2, '0')}</span>
                          <input
                            type="text"
                            value={val}
                            onChange={(e) => handleUpdateTakeaway(idx, e.target.value)}
                            placeholder="Punto clave sintetizado..."
                            className="flex-1 bg-black border-b border-white/10 pb-1 text-xs text-neutral-300 focus:outline-none focus:border-white"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveTakeaway(idx)}
                            className="text-neutral-500 hover:text-red-400 text-xs font-mono cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Configuración lateral */}
                  <div className="lg:col-span-4 space-y-6">
                    <div>
                      <label className="block text-xs font-mono uppercase tracking-wider text-neutral-400 mb-2 font-medium">
                        SECCIÓN EDITORIAL
                      </label>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value as CategoryId)}
                        className="w-full bg-black border border-white/20 p-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-white font-mono"
                      >
                        <option value="ECONOMÍA & MERCADOS">ECONOMÍA & MERCADOS</option>
                        <option value="GEOPOLÍTICA">GEOPOLÍTICA</option>
                        <option value="TECNOLOGÍA & INNOVACIÓN">TECNOLOGÍA & INNOVACIÓN</option>
                        <option value="DERECHO & PROPIEDAD">DERECHO & PROPIEDAD</option>
                        <option value="ENERGÍA & INDUSTRIA">ENERGÍA & INDUSTRIA</option>
                        <option value="DOSSIERS">DOSSIERS</option>
                      </select>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-sans uppercase tracking-wider text-neutral-400 font-semibold flex items-center gap-1.5">
                          <ImageIcon className="w-3.5 h-3.5 text-white" />
                          <span>FOTOGRAFÍA EDITORIAL (EN COLOR)</span>
                        </label>
                      </div>

                      {/* Button to open Optimizer */}
                      <button
                        type="button"
                        onClick={() => setActiveTab('images')}
                        className="w-full py-2.5 px-3 bg-neutral-900 border border-white/20 hover:border-white text-white text-xs font-sans font-semibold uppercase tracking-wider rounded-md flex items-center justify-center gap-2 transition-colors cursor-pointer mb-3"
                      >
                        <Zap className="w-3.5 h-3.5 text-amber-400" />
                        <span>Subir y optimizar con AVIF / WebP / R2</span>
                      </button>

                      {selectedOptimizedImage && (
                        <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-lg mb-3 flex items-center justify-between text-xs font-sans">
                          <div>
                            <span className="text-emerald-300 font-semibold block">✓ AVIF/WebP Optimizado Activo</span>
                            <span className="text-[11px] text-emerald-400/80 font-light">{selectedOptimizedImage.variants.length} variantes generadas</span>
                          </div>
                          <span className="text-xs text-white font-mono bg-emerald-900/60 px-2 py-0.5 rounded tabular-nums">
                            -{selectedOptimizedImage.totalSavingsPercent}%
                          </span>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2 mb-3">
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
                            className={`p-1.5 text-left transition-colors cursor-pointer border rounded-md ${
                              selectedImage === img.url && !customImageUrl
                                ? 'border-white bg-white/5'
                                : 'border-white/10 opacity-60 hover:opacity-100 hover:border-white/30'
                            }`}
                          >
                            <div className="aspect-[16/9] w-full overflow-hidden mb-1 rounded">
                              <img src={img.url} alt={img.label} className="w-full h-full object-cover" />
                            </div>
                            <div className="text-[11px] font-sans truncate text-neutral-300 font-medium">{img.label}</div>
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
                        placeholder="O URL de imagen..."
                        className="w-full bg-black border-b border-white/15 pb-1 text-xs text-white focus:outline-none focus:border-white mb-2 font-sans"
                      />

                      <input
                        type="text"
                        value={imageCaption}
                        onChange={(e) => setImageCaption(e.target.value)}
                        placeholder="Pie de foto descriptivo..."
                        className="w-full bg-black border-b border-white/15 pb-1 text-xs text-neutral-400 focus:outline-none focus:border-white font-sans"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-mono uppercase tracking-wider text-neutral-400 mb-1">
                        TIEMPO DE LECTURA
                      </label>
                      <input
                        type="text"
                        value={readTime}
                        onChange={(e) => setReadTime(e.target.value)}
                        placeholder="Ej: 5 min de lectura"
                        className="w-full bg-black border-b border-white/15 pb-1 text-xs font-mono text-white focus:outline-none focus:border-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-mono uppercase tracking-wider text-neutral-400 mb-1">
                        ETIQUETAS
                      </label>
                      <input
                        type="text"
                        value={tagString}
                        onChange={(e) => setTagString(e.target.value)}
                        placeholder="Libre Mercado, Competencia, Propiedad"
                        className="w-full bg-black border-b border-white/15 pb-1 text-xs font-mono text-white focus:outline-none focus:border-white"
                      />
                    </div>

                    <div className="pt-2 flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="chk-exclusive"
                        checked={exclusive}
                        onChange={(e) => setExclusive(e.target.checked)}
                        className="w-3.5 h-3.5 bg-black accent-white cursor-pointer"
                      />
                      <label htmlFor="chk-exclusive" className="text-xs font-mono text-neutral-300 uppercase cursor-pointer">
                        MARCAR COMO EXCLUSIVA
                      </label>
                    </div>

                    <button
                      type="button"
                      onClick={handleSaveOrPublish}
                      className="w-full py-3 bg-white text-black font-medium text-xs uppercase tracking-wider hover:bg-neutral-200 transition-colors flex items-center justify-center gap-2 cursor-pointer mt-6"
                    >
                      <Send className="w-4 h-4" />
                      <span>{editingReportId ? 'GUARDAR CAMBIOS' : 'PUBLICAR EN PORTADA'}</span>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* TAB CONTENT: OPTIMIZADOR AVIF & CLOUDFLARE R2 */}
      {activeTab === 'images' && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8">
          <ImageOptimizationStudio
            onSelectForArticle={handleSelectOptimizedImageForArticle}
            currentArticleTitle={title || undefined}
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
    </div>
  );
};
