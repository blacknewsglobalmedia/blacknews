import React, { useState, useEffect, useMemo } from 'react';
import { 
  Sparkles, 
  RotateCw, 
  Check, 
  SlidersHorizontal, 
  Star, 
  Layers, 
  Radio, 
  Zap, 
  Compass, 
  Calendar,
  AlertCircle,
  GripVertical,
  ArrowRightLeft,
  Timer,
  Clock,
  Search,
  Filter,
  CheckCircle2,
  RefreshCw,
  Info,
  ChevronDown
} from 'lucide-react';
import { Report, FlashNews } from '../types/news';
import { FrontPageLayoutConfig, AutomationPreset } from '../types/layout';
import { UserPermissions } from '../types/auth';

interface FrontPageManagerProps {
  reports: Report[];
  categories: readonly string[];
  layoutConfig: FrontPageLayoutConfig;
  onUpdateLayoutConfig: (newConfig: FrontPageLayoutConfig) => void;
  flashNews: FlashNews[];
  onUpdateFlashNews: (news: FlashNews[]) => void;
  permissions: UserPermissions;
  onAutomationApply: (preset: AutomationPreset) => void;
}

// Available slots on the Skeleton Mockup
type SlotKey = 'lead' | 'b1_0' | 'b1_1' | 'b2_0' | 'b2_1' | 'b2_2' | 'dossier';

interface DragPayload {
  reportId: string;
  source: 'pool' | SlotKey;
}

export const FrontPageManager: React.FC<FrontPageManagerProps> = ({
  reports,
  categories,
  layoutConfig,
  onUpdateLayoutConfig,
  flashNews,
  onUpdateFlashNews,
  permissions,
  onAutomationApply,
}) => {
  // Drag and Drop active states
  const [activeDragItem, setActiveDragItem] = useState<DragPayload | null>(null);
  const [activeDropTarget, setActiveDropTarget] = useState<SlotKey | null>(null);

  // Search & Filter for Available Articles Pool
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('TODAS');

  // Flash ticker quick form
  const [newFlashTitle, setNewFlashTitle] = useState('');
  const [newFlashCategory, setNewFlashCategory] = useState('ECONOMÍA & MERCADOS');

  // Feedback banner
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // Real-time countdown for auto-rotation
  const [remainingTimeStr, setRemainingTimeStr] = useState<string>('');
  const [percentElapsed, setPercentElapsed] = useState<number>(0);
  const [isExpired, setIsExpired] = useState<boolean>(false);

  // Calculate remaining time before auto-rotation
  useEffect(() => {
    const updateCountdown = () => {
      const enabled = layoutConfig.autoRefreshEnabled !== false;
      if (!enabled) {
        setRemainingTimeStr('Desactivado (Solo Manual)');
        setPercentElapsed(0);
        setIsExpired(false);
        return;
      }

      const hours = layoutConfig.autoRefreshHours || 24;
      const totalMs = hours * 3600 * 1000;
      const lastModified = layoutConfig.lastModifiedTimestamp || Date.now();
      const elapsed = Date.now() - lastModified;
      const remainingMs = Math.max(0, totalMs - elapsed);

      const percent = Math.min(100, Math.max(0, (elapsed / totalMs) * 100));
      setPercentElapsed(percent);

      if (remainingMs <= 0) {
        setIsExpired(true);
        setRemainingTimeStr('0h 00m (Ciclo cumplido)');
      } else {
        setIsExpired(false);
        const remHours = Math.floor(remainingMs / (1000 * 60 * 60));
        const remMins = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
        setRemainingTimeStr(`${remHours}h ${remMins.toString().padStart(2, '0')}m restantes`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 10000);
    return () => clearInterval(interval);
  }, [layoutConfig]);

  const showFeedback = (msg: string) => {
    setFeedbackMessage(msg);
    setTimeout(() => setFeedbackMessage(null), 3500);
  };

  if (!permissions.canManageLayout) {
    return (
      <div className="p-8 text-center border border-white/10 max-w-xl mx-auto my-12 rounded-2xl bg-neutral-950 font-sans">
        <AlertCircle className="w-8 h-8 text-neutral-400 mx-auto mb-3" />
        <h3 className="text-sm font-semibold uppercase tracking-wider text-white mb-2">
          ACCESO RESTRINGIDO A LA MESA EDITORIAL
        </h3>
        <p className="text-xs text-neutral-400 leading-relaxed font-light">
          Se requieren permisos de <strong>Administrador</strong> o <strong>Moderador</strong> para reorganizar los bloques y titulares de la portada principal.
        </p>
      </div>
    );
  }

  // Helper to get which report is in which slot
  const slotReportIds: Record<SlotKey, string> = {
    lead: layoutConfig.leadReportId,
    b1_0: layoutConfig.block1ReportIds[0] || '',
    b1_1: layoutConfig.block1ReportIds[1] || '',
    b2_0: layoutConfig.block2ReportIds[0] || '',
    b2_1: layoutConfig.block2ReportIds[1] || '',
    b2_2: layoutConfig.block2ReportIds[2] || '',
    dossier: layoutConfig.dossierReportId,
  };

  // Set of all currently assigned report IDs in front page
  const assignedReportIds = new Set(Object.values(slotReportIds));

  // Find report helper
  const getReportById = (id: string): Report | undefined => {
    return reports.find((r) => r.id === id);
  };

  // Assign a report to a target slot
  const assignReportToSlot = (slot: SlotKey, reportId: string) => {
    const nextConfig = { ...layoutConfig };
    const now = new Date();
    nextConfig.lastUpdated = `${now.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })} · Manual (Mesa editorial)`;
    nextConfig.lastModifiedTimestamp = Date.now();
    nextConfig.automationPreset = 'manual';

    if (slot === 'lead') {
      nextConfig.leadReportId = reportId;
    } else if (slot === 'b1_0') {
      const b1 = [...layoutConfig.block1ReportIds];
      b1[0] = reportId;
      nextConfig.block1ReportIds = b1;
    } else if (slot === 'b1_1') {
      const b1 = [...layoutConfig.block1ReportIds];
      b1[1] = reportId;
      nextConfig.block1ReportIds = b1;
    } else if (slot === 'b2_0') {
      const b2 = [...layoutConfig.block2ReportIds];
      b2[0] = reportId;
      nextConfig.block2ReportIds = b2;
    } else if (slot === 'b2_1') {
      const b2 = [...layoutConfig.block2ReportIds];
      b2[1] = reportId;
      nextConfig.block2ReportIds = b2;
    } else if (slot === 'b2_2') {
      const b2 = [...layoutConfig.block2ReportIds];
      b2[2] = reportId;
      nextConfig.block2ReportIds = b2;
    } else if (slot === 'dossier') {
      nextConfig.dossierReportId = reportId;
    }

    onUpdateLayoutConfig(nextConfig);
    const assignedReport = getReportById(reportId);
    showFeedback(`"${assignedReport?.title.slice(0, 35)}..." asignado a ${getSlotLabel(slot)}`);
  };

  // Swap reports between two slots
  const swapSlots = (slotA: SlotKey, slotB: SlotKey) => {
    if (slotA === slotB) return;
    const reportA = slotReportIds[slotA];
    const reportB = slotReportIds[slotB];

    const nextConfig = { ...layoutConfig };
    const now = new Date();
    nextConfig.lastUpdated = `${now.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })} · Reorganización Manual`;
    nextConfig.lastModifiedTimestamp = Date.now();
    nextConfig.automationPreset = 'manual';

    const applySlot = (slot: SlotKey, repId: string) => {
      if (slot === 'lead') nextConfig.leadReportId = repId;
      else if (slot === 'b1_0') {
        const b = [...nextConfig.block1ReportIds];
        b[0] = repId;
        nextConfig.block1ReportIds = b;
      } else if (slot === 'b1_1') {
        const b = [...nextConfig.block1ReportIds];
        b[1] = repId;
        nextConfig.block1ReportIds = b;
      } else if (slot === 'b2_0') {
        const b = [...nextConfig.block2ReportIds];
        b[0] = repId;
        nextConfig.block2ReportIds = b;
      } else if (slot === 'b2_1') {
        const b = [...nextConfig.block2ReportIds];
        b[1] = repId;
        nextConfig.block2ReportIds = b;
      } else if (slot === 'b2_2') {
        const b = [...nextConfig.block2ReportIds];
        b[2] = repId;
        nextConfig.block2ReportIds = b;
      } else if (slot === 'dossier') {
        nextConfig.dossierReportId = repId;
      }
    };

    applySlot(slotA, reportB);
    applySlot(slotB, reportA);

    onUpdateLayoutConfig(nextConfig);
    showFeedback(`Posiciones intercambiadas entre ${getSlotLabel(slotA)} y ${getSlotLabel(slotB)}`);
  };

  const getSlotLabel = (slot: SlotKey): string => {
    switch (slot) {
      case 'lead': return 'Posición 1 (Lead Story / Gran Apertura)';
      case 'b1_0': return 'Posición 2A (Bloque I - Columna Izquierda)';
      case 'b1_1': return 'Posición 2B (Bloque I - Columna Derecha)';
      case 'b2_0': return 'Posición 3A (Bloque II - Columna 1)';
      case 'b2_1': return 'Posición 3B (Bloque II - Columna 2)';
      case 'b2_2': return 'Posición 3C (Bloque II - Columna 3)';
      case 'dossier': return 'Posición 4 (Investigación destacada)';
    }
  };

  // Drag Handlers
  const handleDragStartFromPool = (e: React.DragEvent, reportId: string) => {
    setActiveDragItem({ reportId, source: 'pool' });
    e.dataTransfer.setData('text/plain', JSON.stringify({ reportId, source: 'pool' }));
    e.dataTransfer.effectAllowed = 'copyMove';
  };

  const handleDragStartFromSlot = (e: React.DragEvent, slot: SlotKey) => {
    const reportId = slotReportIds[slot];
    setActiveDragItem({ reportId, source: slot });
    e.dataTransfer.setData('text/plain', JSON.stringify({ reportId, source: slot }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOverSlot = (e: React.DragEvent, slot: SlotKey) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (activeDropTarget !== slot) {
      setActiveDropTarget(slot);
    }
  };

  const handleDragLeaveSlot = (e: React.DragEvent, slot: SlotKey) => {
    if (activeDropTarget === slot) {
      setActiveDropTarget(null);
    }
  };

  const handleDropOnSlot = (e: React.DragEvent, targetSlot: SlotKey) => {
    e.preventDefault();
    setActiveDropTarget(null);

    let payload = activeDragItem;
    if (!payload) {
      try {
        const raw = e.dataTransfer.getData('text/plain');
        if (raw) payload = JSON.parse(raw);
      } catch {}
    }

    if (!payload) return;

    if (payload.source === 'pool') {
      assignReportToSlot(targetSlot, payload.reportId);
    } else {
      // Swapping slots!
      swapSlots(payload.source, targetSlot);
    }

    setActiveDragItem(null);
  };

  const handleDragEnd = () => {
    setActiveDragItem(null);
    setActiveDropTarget(null);
  };

  // Change auto-refresh interval
  const handleChangeAutoRefreshHours = (hours: number) => {
    onUpdateLayoutConfig({
      ...layoutConfig,
      autoRefreshHours: hours,
      autoRefreshEnabled: hours > 0,
      lastModifiedTimestamp: Date.now(), // Reset clock upon setting new interval
    });
    showFeedback(hours > 0 ? `Temporizador configurado a ${hours} horas sin modificación` : 'Rotación automática desactivada');
  };

  // Change auto-refresh policy
  const handleChangeAutoRefreshPolicy = (policy: AutomationPreset) => {
    onUpdateLayoutConfig({
      ...layoutConfig,
      autoRefreshPolicy: policy,
    });
    showFeedback(`Estrategia de rotación automática: [${policy.toUpperCase()}]`);
  };

  // Reset clock / Extender 24h
  const handleResetClock = () => {
    onUpdateLayoutConfig({
      ...layoutConfig,
      lastModifiedTimestamp: Date.now(),
    });
    showFeedback(`Reloj reiniciado. La portada actual permanecerá ${layoutConfig.autoRefreshHours || 24}h más.`);
  };

  // Force rotation now (for testing / manual trigger)
  const handleForceRotationNow = () => {
    const policy = layoutConfig.autoRefreshPolicy || 'auto-latest';
    onAutomationApply(policy);
    showFeedback(`Rotación forzada ejecutada con estrategia: [${policy.toUpperCase()}]`);
  };

  // Flash News handlers
  const handleAddFlash = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFlashTitle.trim()) return;
    const item: FlashNews = {
      id: `flash-${Date.now()}`,
      time: 'AHORA',
      category: newFlashCategory as any,
      title: newFlashTitle.trim(),
    };
    onUpdateFlashNews([item, ...flashNews]);
    setNewFlashTitle('');
    showFeedback('Titular añadido al teletipo');
  };

  const handleRemoveFlash = (id: string) => {
    onUpdateFlashNews(flashNews.filter((f) => f.id !== id));
    showFeedback('Titular retirado del teletipo');
  };

  // Filtered pool reports
  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      const matchCat = selectedCategoryFilter === 'TODAS' || r.category === selectedCategoryFilter;
      const matchSearch = searchQuery.trim() === '' || 
        r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.author?.name && r.author.name.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchCat && matchSearch;
    });
  }, [reports, selectedCategoryFilter, searchQuery]);

  // Categories list for filter
  const allCategories = [...categories];

  // Current slot reports
  const leadReport = getReportById(slotReportIds.lead);
  const b1_0Report = getReportById(slotReportIds.b1_0);
  const b1_1Report = getReportById(slotReportIds.b1_1);
  const b2_0Report = getReportById(slotReportIds.b2_0);
  const b2_1Report = getReportById(slotReportIds.b2_1);
  const b2_2Report = getReportById(slotReportIds.b2_2);
  const dossierReport = getReportById(slotReportIds.dossier);

  return (
    <div className="space-y-8 pb-16 font-sans text-white">
      {/* Toast Feedback */}
      {feedbackMessage && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-xl bg-neutral-900 border border-white/20 text-white shadow-2xl flex items-center gap-3 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs sm:text-sm font-medium">{feedbackMessage}</span>
        </div>
      )}

      {/* HEADER SECTION: Title & Description */}
      <div className="pb-6 border-b border-white/10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1">
            <SlidersHorizontal className="w-3.5 h-3.5 text-white" />
            <span>MESA EDITORIAL DE PORTADA & MAQUETACIÓN VIVA</span>
          </div>
          <h2 className="font-headline text-2xl sm:text-3xl font-normal text-white tracking-tight">
            Maqueta Skeleton de Portada (Drag & Drop)
          </h2>
          <p className="text-xs text-neutral-400 mt-1 font-light max-w-2xl">
            Organiza las noticias arrastrando artículos desde el banco lateral hacia cualquier posición de la maqueta o intercambiando posiciones entre sí.
          </p>
        </div>

        {/* Quick Automation Presets */}
        <div className="flex flex-wrap items-center gap-2 bg-neutral-950 p-3 rounded-2xl border border-white/10">
          <span className="text-xs text-neutral-400 uppercase font-semibold mr-1">
            PLANTILLAS RÁPIDAS:
          </span>
          <button
            onClick={() => onAutomationApply('auto-latest')}
            className={`px-3 py-1.5 text-xs uppercase tracking-wider rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer border ${
              layoutConfig.automationPreset === 'auto-latest'
                ? 'bg-white text-black border-white font-bold'
                : 'border-white/15 text-neutral-300 hover:text-white hover:border-white/40'
            }`}
            title="Asignar automáticamente los artículos más recientes"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>ÚLTIMA HORA</span>
          </button>
          <button
            onClick={() => onAutomationApply('auto-impact')}
            className={`px-3 py-1.5 text-xs uppercase tracking-wider rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer border ${
              layoutConfig.automationPreset === 'auto-impact'
                ? 'bg-white text-black border-white font-bold'
                : 'border-white/15 text-neutral-300 hover:text-white hover:border-white/40'
            }`}
            title="Priorizar noticias exclusivas o de alto impacto"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>IMPACTO</span>
          </button>
          <button
            onClick={() => onAutomationApply('auto-diversity')}
            className={`px-3 py-1.5 text-xs uppercase tracking-wider rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer border ${
              layoutConfig.automationPreset === 'auto-diversity'
                ? 'bg-white text-black border-white font-bold'
                : 'border-white/15 text-neutral-300 hover:text-white hover:border-white/40'
            }`}
            title="Equilibrar secciones temáticas para máxima diversidad"
          >
            <Compass className="w-3.5 h-3.5" />
            <span>VARIEDAD</span>
          </button>
        </div>
      </div>

      {/* TIMER & AUTO-ROTATION EXPIRATION PANEL */}
      <div className="p-5 bg-neutral-950 rounded-2xl border border-white/15 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              isExpired ? 'bg-amber-500/20 text-amber-300' : 'bg-white/10 text-white'
            }`}>
              <Timer className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase font-bold tracking-wider text-white">
                  CADUCIDAD & ROTACIÓN AUTOMÁTICA PROGRAMADA
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider ${
                  layoutConfig.autoRefreshEnabled !== false
                    ? isExpired
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-neutral-800 text-neutral-400'
                }`}>
                  {layoutConfig.autoRefreshEnabled !== false
                    ? isExpired ? 'Ciclo Cumplido' : 'Rotación Activa'
                    : 'Desactivada'}
                </span>
              </div>
              <p className="text-xs text-neutral-400 font-light mt-0.5">
                Si nadie modifica la maqueta manualmente en el lapso elegido, la portada se actualizará con nuevas publicaciones para mantener la frescura informativa.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <button
              onClick={handleResetClock}
              className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-xl bg-neutral-900 border border-white/15 hover:border-white/30 text-neutral-200 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5"
              title="Reiniciar temporizador manteniendo la maqueta actual"
            >
              <RefreshCw className="w-3.5 h-3.5 text-neutral-400" />
              <span>REINICIAR VIGENCIA (+{layoutConfig.autoRefreshHours || 24}H)</span>
            </button>
            <button
              onClick={handleForceRotationNow}
              className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer flex items-center gap-1.5"
              title="Simular o ejecutar inmediatamente la rotación automática"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>ROTAR AHORA</span>
            </button>
          </div>
        </div>

        {/* Progress & Countdown Bar */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-neutral-400">
              <Clock className="w-3.5 h-3.5" />
              <span>Vigencia de la maqueta manual:</span>
              <strong className="text-white font-semibold">{remainingTimeStr}</strong>
            </div>
            <span className="text-[11px] text-neutral-500">
              Último ajuste: {layoutConfig.lastUpdated || 'Reciente'}
            </span>
          </div>
          <div className="w-full h-2 bg-neutral-900 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-500 rounded-full ${
                isExpired ? 'bg-amber-400' : 'bg-white'
              }`}
              style={{ width: `${percentElapsed}%` }}
            />
          </div>
        </div>

        {/* Controls: Interval selector & Policy selector */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-white/10 text-xs">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-400 mb-2">
              TIEMPO DE VIGENCIA ANTES DE ROTAR AUTOMÁTICAMENTE:
            </label>
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: '6 Horas', value: 6 },
                { label: '12 Horas', value: 12 },
                { label: '24 Horas (Recomendado)', value: 24 },
                { label: '48 Horas', value: 48 },
                { label: '72 Horas', value: 72 },
                { label: 'Desactivar', value: 0 },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleChangeAutoRefreshHours(opt.value)}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer border ${
                    (layoutConfig.autoRefreshHours ?? 24) === opt.value && (opt.value === 0 ? layoutConfig.autoRefreshEnabled === false : layoutConfig.autoRefreshEnabled !== false)
                      ? 'bg-white text-black border-white font-bold'
                      : 'border-white/10 bg-neutral-900/60 text-neutral-400 hover:text-white hover:border-white/25'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-400 mb-2">
              CRITERIO AL ROTAR TRAS EL VENCIMIENTO:
            </label>
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: 'Nuevas Publicaciones (Última hora)', value: 'auto-latest' },
                { label: 'Mayor Impacto', value: 'auto-impact' },
                { label: 'Variedad de Secciones', value: 'auto-diversity' },
              ].map((pol) => (
                <button
                  key={pol.value}
                  onClick={() => handleChangeAutoRefreshPolicy(pol.value as AutomationPreset)}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer border ${
                    (layoutConfig.autoRefreshPolicy || 'auto-latest') === pol.value
                      ? 'bg-white text-black border-white font-bold'
                      : 'border-white/10 bg-neutral-900/60 text-neutral-400 hover:text-white hover:border-white/25'
                  }`}
                >
                  {pol.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* MAIN TWO-COLUMN WORKSPACE: LEFT = POOL OF ARTICLES | RIGHT = SKELETON MOCKUP */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

        {/* LEFT COLUMN: BANCO DE ARTÍCULOS DISPONIBLES (POLL) */}
        <div className="lg:col-span-4 bg-neutral-950 rounded-2xl border border-white/10 p-5 space-y-4 lg:sticky lg:top-20 max-h-[85vh] flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-white" />
                <span>BANCO DE NOTICIAS</span>
              </h3>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                Arrastra una tarjeta hacia cualquier ranura de la maqueta.
              </p>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full bg-white/10 font-bold">
              {filteredReports.length}
            </span>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por titular o sección..."
              className="w-full bg-neutral-900 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-white/30 font-sans"
            />
          </div>

          {/* Category filter pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 text-[10px]">
            {allCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategoryFilter(cat)}
                className={`px-2 py-1 rounded-lg shrink-0 font-medium transition-colors cursor-pointer ${
                  selectedCategoryFilter === cat
                    ? 'bg-white text-black font-bold'
                    : 'bg-neutral-900 text-neutral-400 hover:text-white'
                }`}
              >
                {cat.split(' & ')[0]}
              </button>
            ))}
          </div>

          {/* Draggable Articles List */}
          <div className="space-y-2.5 overflow-y-auto pr-1 flex-1 min-h-[300px]">
            {filteredReports.map((report) => {
              const isAssigned = assignedReportIds.has(report.id);
              return (
                <div
                  key={report.id}
                  draggable={true}
                  onDragStart={(e) => handleDragStartFromPool(e, report.id)}
                  onDragEnd={handleDragEnd}
                  className={`p-3 rounded-xl border transition-all cursor-grab active:cursor-grabbing select-none group ${
                    isAssigned 
                      ? 'border-white/15 bg-neutral-900/40 hover:border-white/30' 
                      : 'border-white/10 bg-neutral-900/80 hover:border-white/40 hover:bg-neutral-900'
                  } ${activeDragItem?.reportId === report.id ? 'opacity-40 scale-95 ring-2 ring-white' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-16 h-12 bg-neutral-950 rounded-lg overflow-hidden shrink-0 relative">
                      <img src={report.image} alt={report.title} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-[10px] text-neutral-400 font-medium uppercase truncate">
                          {report.category}
                        </span>
                        {isAssigned ? (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-white/15 text-white font-semibold uppercase shrink-0">
                            EN PORTADA
                          </span>
                        ) : (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 font-semibold uppercase shrink-0">
                            LIBRE
                          </span>
                        )}
                      </div>

                      <h4 className="text-xs font-semibold text-white line-clamp-2 leading-tight">
                        {report.title}
                      </h4>

                      <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-white/5 text-[10px] text-neutral-500">
                        <span className="flex items-center gap-1 font-medium text-neutral-400">
                          <GripVertical className="w-3 h-3 text-neutral-400 group-hover:text-white" />
                          Arrastrar a maqueta
                        </span>

                        {/* Quick Placement Dropdown Fallback */}
                        <select
                          value=""
                          onChange={(e) => {
                            if (e.target.value) {
                              assignReportToSlot(e.target.value as SlotKey, report.id);
                            }
                          }}
                          className="bg-neutral-800 text-neutral-300 text-[10px] rounded px-1.5 py-0.5 focus:outline-none hover:text-white cursor-pointer"
                        >
                          <option value="">Colocar en...</option>
                          <option value="lead">Pos. 1 · Lead Story</option>
                          <option value="b1_0">Pos. 2A · Bloque I (Izq)</option>
                          <option value="b1_1">Pos. 2B · Bloque I (Der)</option>
                          <option value="b2_0">Pos. 3A · Bloque II (Col 1)</option>
                          <option value="b2_1">Pos. 3B · Bloque II (Col 2)</option>
                          <option value="b2_2">Pos. 3C · Bloque II (Col 3)</option>
                          <option value="dossier">Pos. 4 · Investigación</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredReports.length === 0 && (
              <div className="p-8 text-center text-xs text-neutral-500">
                No se encontraron artículos con ese criterio.
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: SKELETON MOCKUP INTERACTIVO (WIREFRAME DE PORTADA) */}
        <div className="lg:col-span-8 space-y-6">

          {/* Skeleton Mockup Frame Banner */}
          <div className="p-4 bg-neutral-950 rounded-2xl border border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-xs">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-bold uppercase tracking-wider text-white">
                SKELETON WIREFRAME · VISTA EN VIVO
              </span>
              <span className="text-neutral-500 hidden sm:inline">|</span>
              <span className="text-neutral-400 hidden sm:inline">
                Arrastra artículos entre ranuras para intercambiarlos
              </span>
            </div>
            <div className="text-[11px] text-neutral-400 flex items-center gap-1 font-medium">
              <ArrowRightLeft className="w-3 h-3 text-neutral-300" />
              <span>Intercambio dinámico</span>
            </div>
          </div>

          {/* SKELETON WIREFRAME CANVAS */}
          <div className="bg-black/90 p-6 rounded-3xl border border-white/15 space-y-8 shadow-2xl relative">

            {/* Wireframe Mini Topbar */}
            <div className="pb-3 border-b border-white/10 flex items-center justify-between text-[11px] text-neutral-500">
              <div className="flex items-center gap-2">
                <span className="font-bold text-neutral-300">BLACKNEWS</span>
                <span>·</span>
                <span className="text-[10px] uppercase tracking-wider">MAQUETA DE DISTRIBUCIÓN</span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] uppercase text-neutral-400">
                <Radio className="w-2.5 h-2.5 text-red-500 animate-pulse" />
                <span>TELETIPO EN VIVO ACTIVO</span>
              </div>
            </div>

            {/* ======================================================== */}
            {/* RANURA 1: GRAN TITULAR DE APERTURA (LEAD STORY)           */}
            {/* ======================================================== */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-white" />
                  <span className="font-bold uppercase tracking-wider text-white">
                    POSICIÓN 1 · GRAN TITULAR DE APERTURA GLOBAL (LEAD STORY)
                  </span>
                </div>
                <span className="text-[11px] text-neutral-400 uppercase font-medium">
                  HERO PRINCIPAL
                </span>
              </div>

              {/* Lead Drop Zone */}
              <div
                onDragOver={(e) => handleDragOverSlot(e, 'lead')}
                onDragLeave={(e) => handleDragLeaveSlot(e, 'lead')}
                onDrop={(e) => handleDropOnSlot(e, 'lead')}
                draggable={!!leadReport}
                onDragStart={(e) => handleDragStartFromSlot(e, 'lead')}
                onDragEnd={handleDragEnd}
                className={`relative rounded-2xl border-2 transition-all p-5 select-none ${
                  activeDropTarget === 'lead'
                    ? 'border-white border-dashed bg-white/15 scale-[1.01] ring-4 ring-white/20'
                    : 'border-white/15 bg-neutral-950/80 hover:border-white/30'
                } ${activeDragItem?.source === 'lead' ? 'opacity-40 ring-2 ring-white' : ''}`}
              >
                {leadReport ? (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
                    <div className="md:col-span-5 aspect-[16/9] bg-neutral-900 rounded-xl overflow-hidden relative group">
                      <img src={leadReport.image} alt={leadReport.title} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                        <span className="px-2.5 py-1 rounded-md bg-black/70 text-[10px] font-semibold text-white flex items-center gap-1 border border-white/20">
                          <GripVertical className="w-3 h-3" /> Arrastrar para mover
                        </span>
                      </div>
                    </div>

                    <div className="md:col-span-7 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs uppercase tracking-wider font-bold text-white bg-white/10 px-2 py-0.5 rounded">
                          {leadReport.category}
                        </span>
                        <span className="text-xs text-neutral-400">
                          {leadReport.readTime}
                        </span>
                      </div>
                      <h3 className="font-headline text-xl sm:text-2xl font-normal text-white leading-tight">
                        {leadReport.title}
                      </h3>
                      <p className="text-xs text-neutral-400 line-clamp-2 font-light">
                        {leadReport.subtitle}
                      </p>

                      <div className="pt-2 flex items-center justify-between border-t border-white/10 text-xs">
                        <span className="text-neutral-400 text-[11px]">
                          Por {leadReport.author.name} · {leadReport.author.bureau}
                        </span>
                        <div className="flex items-center gap-2">
                          <select
                            value={slotReportIds.lead}
                            onChange={(e) => assignReportToSlot('lead', e.target.value)}
                            className="bg-neutral-900 border border-white/15 rounded-lg text-xs px-2 py-1 text-white focus:outline-none"
                          >
                            {reports.map((r) => (
                              <option key={r.id} value={r.id}>
                                [{r.category}] {r.title.slice(0, 40)}...
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center text-neutral-500 border border-dashed border-white/10 rounded-xl">
                    Suelta un artículo aquí para la Posición 1
                  </div>
                )}
              </div>
            </div>

            {/* ======================================================== */}
            {/* RANURA 2: BLOQUE I — DESPACHOS DE FONDO (2 COLUMNAS)      */}
            {/* ======================================================== */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-white" />
                  <span className="font-bold uppercase tracking-wider text-white">
                    POSICIÓN 2 · BLOQUE I: DESPACHOS DE FONDO (2 COLUMNAS ANCHAS)
                  </span>
                </div>
                <span className="text-[11px] text-neutral-400 uppercase font-medium">
                  2 COLUMNAS
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { key: 'b1_0' as SlotKey, label: 'COLUMNA IZQUIERDA (2A)', report: b1_0Report },
                  { key: 'b1_1' as SlotKey, label: 'COLUMNA DERECHA (2B)', report: b1_1Report },
                ].map(({ key, label, report }) => (
                  <div
                    key={key}
                    onDragOver={(e) => handleDragOverSlot(e, key)}
                    onDragLeave={(e) => handleDragLeaveSlot(e, key)}
                    onDrop={(e) => handleDropOnSlot(e, key)}
                    draggable={!!report}
                    onDragStart={(e) => handleDragStartFromSlot(e, key)}
                    onDragEnd={handleDragEnd}
                    className={`rounded-2xl border-2 transition-all p-4 select-none ${
                      activeDropTarget === key
                        ? 'border-white border-dashed bg-white/15 scale-[1.01] ring-4 ring-white/20'
                        : 'border-white/15 bg-neutral-950/80 hover:border-white/30'
                    } ${activeDragItem?.source === key ? 'opacity-40 ring-2 ring-white' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-300">
                        {label}
                      </span>
                      <span className="text-[10px] text-neutral-500 font-medium">
                        Arrastrable
                      </span>
                    </div>

                    {report ? (
                      <div className="space-y-2.5">
                        <div className="aspect-[16/9] w-full bg-neutral-900 rounded-xl overflow-hidden relative group">
                          <img src={report.image} alt={report.title} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                            <span className="px-2 py-0.5 rounded bg-black/70 text-[9px] font-semibold text-white flex items-center gap-1 border border-white/20">
                              <GripVertical className="w-2.5 h-2.5" /> Mover
                            </span>
                          </div>
                        </div>

                        <div className="text-[10px] font-bold text-neutral-400 uppercase">
                          {report.category}
                        </div>
                        <h4 className="font-headline text-base font-normal text-white line-clamp-2 leading-snug">
                          {report.title}
                        </h4>

                        <div className="pt-2 border-t border-white/10">
                          <select
                            value={slotReportIds[key]}
                            onChange={(e) => assignReportToSlot(key, e.target.value)}
                            className="w-full bg-neutral-900 border border-white/15 rounded-lg text-xs p-1.5 text-white focus:outline-none"
                          >
                            {reports.map((r) => (
                              <option key={r.id} value={r.id}>
                                [{r.category}] {r.title.slice(0, 36)}...
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ) : (
                      <div className="py-6 text-center text-neutral-500 text-xs">
                        Suelta un artículo aquí
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* ======================================================== */}
            {/* RANURA 3: BLOQUE II — COLUMNAS SECTORIALES (3 COLUMNAS)   */}
            {/* ======================================================== */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-white" />
                  <span className="font-bold uppercase tracking-wider text-white">
                    POSICIÓN 3 · BLOQUE II: COLUMNAS SECTORIALES (3 COLUMNAS)
                  </span>
                </div>
                <span className="text-[11px] text-neutral-400 uppercase font-medium">
                  3 COLUMNAS
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { key: 'b2_0' as SlotKey, label: 'COLUMNA 1 (3A)', report: b2_0Report },
                  { key: 'b2_1' as SlotKey, label: 'COLUMNA 2 (3B)', report: b2_1Report },
                  { key: 'b2_2' as SlotKey, label: 'COLUMNA 3 (3C)', report: b2_2Report },
                ].map(({ key, label, report }) => (
                  <div
                    key={key}
                    onDragOver={(e) => handleDragOverSlot(e, key)}
                    onDragLeave={(e) => handleDragLeaveSlot(e, key)}
                    onDrop={(e) => handleDropOnSlot(e, key)}
                    draggable={!!report}
                    onDragStart={(e) => handleDragStartFromSlot(e, key)}
                    onDragEnd={handleDragEnd}
                    className={`rounded-2xl border-2 transition-all p-3.5 select-none ${
                      activeDropTarget === key
                        ? 'border-white border-dashed bg-white/15 scale-[1.01] ring-4 ring-white/20'
                        : 'border-white/15 bg-neutral-950/80 hover:border-white/30'
                    } ${activeDragItem?.source === key ? 'opacity-40 ring-2 ring-white' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-300">
                        {label}
                      </span>
                    </div>

                    {report ? (
                      <div className="space-y-2">
                        <div className="aspect-[16/9] w-full bg-neutral-900 rounded-lg overflow-hidden relative group">
                          <img src={report.image} alt={report.title} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                            <span className="px-2 py-0.5 rounded bg-black/70 text-[9px] font-semibold text-white flex items-center gap-1 border border-white/20">
                              <GripVertical className="w-2.5 h-2.5" /> Mover
                            </span>
                          </div>
                        </div>

                        <div className="text-[10px] font-bold text-neutral-400 uppercase">
                          {report.category}
                        </div>
                        <h5 className="font-headline text-sm font-normal text-white line-clamp-2 leading-snug">
                          {report.title}
                        </h5>

                        <div className="pt-2 border-t border-white/10">
                          <select
                            value={slotReportIds[key]}
                            onChange={(e) => assignReportToSlot(key, e.target.value)}
                            className="w-full bg-neutral-900 border border-white/15 rounded-lg text-[11px] p-1 text-white focus:outline-none"
                          >
                            {reports.map((r) => (
                              <option key={r.id} value={r.id}>
                                [{r.category}] {r.title.slice(0, 30)}...
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ) : (
                      <div className="py-6 text-center text-neutral-500 text-xs">
                        Suelta un artículo aquí
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* ======================================================== */}
            {/* RANURA 4: BLOQUE III — INVESTIGACIÓN DESTACADA           */}
            {/* ======================================================== */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-white" />
                  <span className="font-bold uppercase tracking-wider text-white">
                    POSICIÓN 4 · BLOQUE III: INVESTIGACIÓN DESTACADA (FRANJA INFERIOR)
                  </span>
                </div>
                <span className="text-[11px] text-amber-300 uppercase font-semibold">
                  EDICIÓN ESPECIAL
                </span>
              </div>

              <div
                onDragOver={(e) => handleDragOverSlot(e, 'dossier')}
                onDragLeave={(e) => handleDragLeaveSlot(e, 'dossier')}
                onDrop={(e) => handleDropOnSlot(e, 'dossier')}
                draggable={!!dossierReport}
                onDragStart={(e) => handleDragStartFromSlot(e, 'dossier')}
                onDragEnd={handleDragEnd}
                className={`rounded-2xl border-2 transition-all p-4 select-none ${
                  activeDropTarget === 'dossier'
                    ? 'border-white border-dashed bg-white/15 scale-[1.01] ring-4 ring-white/20'
                    : 'border-white/15 bg-neutral-950/80 hover:border-white/30'
                } ${activeDragItem?.source === 'dossier' ? 'opacity-40 ring-2 ring-white' : ''}`}
              >
                {dossierReport ? (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-20 h-14 bg-neutral-900 rounded-lg overflow-hidden shrink-0 relative group">
                        <img src={dossierReport.image} alt={dossierReport.title} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                          <GripVertical className="w-3.5 h-3.5 text-white" />
                        </div>
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] uppercase font-bold text-amber-300 mb-0.5">
                          INVESTIGACIÓN SELECCIONADA · {dossierReport.category}
                        </div>
                        <h4 className="font-headline text-base font-normal text-white truncate">
                          {dossierReport.title}
                        </h4>
                        <p className="text-xs text-neutral-400 truncate font-light">
                          {dossierReport.subtitle}
                        </p>
                      </div>
                    </div>

                    <div className="w-full sm:w-72 shrink-0">
                      <select
                        value={slotReportIds.dossier}
                        onChange={(e) => assignReportToSlot('dossier', e.target.value)}
                        className="w-full bg-neutral-900 border border-white/15 rounded-lg p-2 text-xs text-white focus:outline-none font-sans"
                      >
                        {reports.map((r) => (
                          <option key={r.id} value={r.id}>
                            [{r.category}] {r.title.slice(0, 42)}...
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="py-6 text-center text-neutral-500 text-xs">
                    Suelta un artículo aquí para Investigación
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* POSICIÓN 5: TELETIPO DE ÚLTIMA HORA (BREAKING TICKER) */}
      <div className="pt-8 border-t border-white/10 font-sans">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-white" />
            <h3 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-white">
              POSICIÓN 5 · TELETIPO EN DIRECTO ({flashNews.length} NOTICIAS ACTIVAS)
            </h3>
          </div>
          <span className="text-xs text-neutral-400">
            Cintillo dinámico en primera plana
          </span>
        </div>

        {/* Form to add rapid breaking headline */}
        <form onSubmit={handleAddFlash} className="flex flex-col sm:flex-row gap-3 mb-6 bg-neutral-950 p-4 rounded-2xl border border-white/10">
          <input
            type="text"
            required
            value={newFlashTitle}
            onChange={(e) => setNewFlashTitle(e.target.value)}
            placeholder="Escribir titular urgente para el teletipo en vivo..."
            className="flex-1 bg-neutral-900 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-white/30 font-sans"
          />
          <select
            value={newFlashCategory}
            onChange={(e) => setNewFlashCategory(e.target.value)}
            className="bg-neutral-900 border border-white/15 rounded-xl px-3 py-2 text-xs font-sans text-white focus:outline-none"
          >
            {categories
              .filter((c) => c !== 'TODAS')
              .map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
          </select>
          <button
            type="submit"
            className="px-4 py-2 bg-white text-black font-semibold text-xs uppercase tracking-wider hover:bg-neutral-200 transition-colors cursor-pointer shrink-0 rounded-xl shadow-sm"
          >
            + AÑADIR A TELETIPO
          </button>
        </form>

        {/* Active flash list */}
        <div className="divide-y divide-white/5 border-t border-white/10 font-sans">
          {flashNews.map((flash) => (
            <div key={flash.id} className="py-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-xs font-sans text-neutral-400 uppercase shrink-0 font-medium">
                  [{flash.category}]
                </span>
                <span className="text-xs sm:text-sm text-neutral-200 truncate font-light">
                  {flash.title}
                </span>
              </div>
              <button
                onClick={() => handleRemoveFlash(flash.id)}
                className="text-xs font-sans text-neutral-500 hover:text-red-400 transition-colors cursor-pointer shrink-0 font-medium"
              >
                RETIRAR
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
