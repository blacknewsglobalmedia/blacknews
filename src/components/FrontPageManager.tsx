import React from 'react';
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
  AlertCircle
} from 'lucide-react';
import { Report, FlashNews } from '../types/news';
import { FrontPageLayoutConfig, AutomationPreset } from '../types/layout';
import { UserPermissions } from '../types/auth';

interface FrontPageManagerProps {
  reports: Report[];
  layoutConfig: FrontPageLayoutConfig;
  onUpdateLayoutConfig: (newConfig: FrontPageLayoutConfig) => void;
  flashNews: FlashNews[];
  onUpdateFlashNews: (news: FlashNews[]) => void;
  permissions: UserPermissions;
  onAutomationApply: (preset: AutomationPreset) => void;
}

export const FrontPageManager: React.FC<FrontPageManagerProps> = ({
  reports,
  layoutConfig,
  onUpdateLayoutConfig,
  flashNews,
  onUpdateFlashNews,
  permissions,
  onAutomationApply,
}) => {
  const [newFlashTitle, setNewFlashTitle] = React.useState('');
  const [newFlashCategory, setNewFlashCategory] = React.useState('ECONOMÍA & MERCADOS');

  if (!permissions.canManageLayout) {
    return (
      <div className="p-8 text-center border border-white/10 max-w-xl mx-auto my-12">
        <AlertCircle className="w-8 h-8 text-neutral-400 mx-auto mb-3" />
        <h3 className="text-sm font-medium uppercase tracking-wider text-white mb-2">
          ACCESO RESTRINGIDO A LA MESA EDITORIAL
        </h3>
        <p className="text-xs text-neutral-400 leading-relaxed">
          Se requieren permisos de <strong>Administrador</strong> o <strong>Moderador</strong> para reorganizar los bloques y titulares de la portada principal.
        </p>
      </div>
    );
  }

  // Handlers to assign reports to slots
  const handleAssignLead = (reportId: string) => {
    onUpdateLayoutConfig({
      ...layoutConfig,
      leadReportId: reportId,
      automationPreset: 'manual',
      lastUpdated: '24 Sep 2026 · Manual',
    });
  };

  const handleAssignBlock1 = (index: number, reportId: string) => {
    const nextBlock1 = [...layoutConfig.block1ReportIds];
    nextBlock1[index] = reportId;
    onUpdateLayoutConfig({
      ...layoutConfig,
      block1ReportIds: nextBlock1,
      automationPreset: 'manual',
      lastUpdated: '24 Sep 2026 · Manual',
    });
  };

  const handleAssignBlock2 = (index: number, reportId: string) => {
    const nextBlock2 = [...layoutConfig.block2ReportIds];
    nextBlock2[index] = reportId;
    onUpdateLayoutConfig({
      ...layoutConfig,
      block2ReportIds: nextBlock2,
      automationPreset: 'manual',
      lastUpdated: '24 Sep 2026 · Manual',
    });
  };

  const handleAssignDossier = (reportId: string) => {
    onUpdateLayoutConfig({
      ...layoutConfig,
      dossierReportId: reportId,
      automationPreset: 'manual',
      lastUpdated: '24 Sep 2026 · Manual',
    });
  };

  // Handler for adding breaking ticker items
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
  };

  const handleRemoveFlash = (id: string) => {
    onUpdateFlashNews(flashNews.filter((f) => f.id !== id));
  };

  const currentLead = reports.find((r) => r.id === layoutConfig.leadReportId) || reports[0];
  const block1Reports = layoutConfig.block1ReportIds.map(
    (id) => reports.find((r) => r.id === id) || reports[1]
  );
  const block2Reports = layoutConfig.block2ReportIds.map(
    (id) => reports.find((r) => r.id === id) || reports[2]
  );
  const currentDossier = reports.find((r) => r.id === layoutConfig.dossierReportId) || reports[reports.length - 1];

  return (
    <div className="space-y-12 pb-12">
      {/* Top Banner: Automation Hub */}
      <div className="pb-6 border-b border-white/5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-neutral-400 mb-1">
              <SlidersHorizontal className="w-3.5 h-3.5 text-white" />
              <span>GESTOR DE PORTADA & MAQUETACIÓN EDITORIAL</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-medium text-white tracking-tight uppercase">
              DISTRIBUCIÓN DE NOTICIAS EN LA PORTADA
            </h2>
            <p className="text-xs text-neutral-400 mt-1 font-mono">
              ESTADO ACTUAL: {layoutConfig.automationPreset.toUpperCase()} · ÚLTIMO AJUSTE: {layoutConfig.lastUpdated}
            </p>
          </div>

          {/* Preset Buttons for 1-Click Automation */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-mono text-neutral-500 uppercase mr-1">
              AUTOMATIZAR EN 1 CLIC:
            </span>
            <button
              onClick={() => onAutomationApply('auto-latest')}
              className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer border ${
                layoutConfig.automationPreset === 'auto-latest'
                  ? 'bg-white text-black border-white font-semibold'
                  : 'border-white/15 text-neutral-300 hover:text-white hover:border-white/40'
              }`}
              title="Colocar las noticias más recientes en las posiciones estelares"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>POR ÚLTIMA HORA</span>
            </button>

            <button
              onClick={() => onAutomationApply('auto-impact')}
              className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer border ${
                layoutConfig.automationPreset === 'auto-impact'
                  ? 'bg-white text-black border-white font-semibold'
                  : 'border-white/15 text-neutral-300 hover:text-white hover:border-white/40'
              }`}
              title="Priorizar informes exclusivos y de alto impacto"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>POR IMPACTO</span>
            </button>

            <button
              onClick={() => onAutomationApply('auto-diversity')}
              className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer border ${
                layoutConfig.automationPreset === 'auto-diversity'
                  ? 'bg-white text-black border-white font-semibold'
                  : 'border-white/15 text-neutral-300 hover:text-white hover:border-white/40'
              }`}
              title="Equilibrar secciones temáticas para máxima variedad"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>POR VARIEDAD</span>
            </button>
          </div>
        </div>
      </div>

      {/* POSICIÓN 1: GRAN TITULAR DE APERTURA GLOBAL */}
      <div className="pb-8 border-b border-white/5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-white" />
            <h3 className="text-sm font-medium uppercase tracking-wider text-white">
              POSICIÓN 1 · GRAN TITULAR DE APERTURA GLOBAL (LEAD STORY)
            </h3>
          </div>
          <span className="text-xs font-mono text-neutral-400">
            PRIMERA PLANA CENTRADA
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Active Preview */}
          <div className="lg:col-span-8 p-4 border border-white/10 flex flex-col sm:flex-row gap-4 items-start">
            {currentLead && (
              <>
                <div className="w-full sm:w-48 aspect-[16/9] bg-neutral-950 overflow-hidden shrink-0">
                  <img src={currentLead.image} alt={currentLead.title} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-mono uppercase text-neutral-400 mb-1">
                    {currentLead.category} · {currentLead.readTime}
                  </div>
                  <h4 className="text-base font-medium text-white line-clamp-2 leading-snug">
                    {currentLead.title}
                  </h4>
                  <p className="text-xs text-neutral-400 line-clamp-2 mt-1">
                    {currentLead.subtitle}
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Slot Selector Dropdown */}
          <div className="lg:col-span-4">
            <label className="block text-xs font-mono uppercase tracking-wider text-neutral-400 mb-2">
              ASIGNAR OTRO INFORME A ESTA POSICIÓN:
            </label>
            <select
              value={layoutConfig.leadReportId}
              onChange={(e) => handleAssignLead(e.target.value)}
              className="w-full bg-black border border-white/20 p-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-white"
            >
              {reports.map((rep) => (
                <option key={rep.id} value={rep.id}>
                  [{rep.category}] {rep.title.slice(0, 55)}...
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* POSICIÓN 2: BLOQUE I — DESPACHOS DE FONDO (2 COLUMNAS) */}
      <div className="pb-8 border-b border-white/5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-white" />
            <h3 className="text-sm font-medium uppercase tracking-wider text-white">
              POSICIÓN 2 · BLOQUE I: DESPACHOS DE FONDO (2 COLUMNAS ANCHAS)
            </h3>
          </div>
          <span className="text-xs font-mono text-neutral-400">
            DESPACHOS DESTACADOS
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[0, 1].map((colIndex) => {
            const report = block1Reports[colIndex];
            return (
              <div key={colIndex} className="p-4 border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono uppercase tracking-wider text-white font-medium">
                    COLUMNA #{colIndex + 1}
                  </span>
                  <span className="text-xs font-mono text-neutral-500">BLOQUE I</span>
                </div>

                {report && (
                  <div className="space-y-2">
                    <div className="aspect-[16/9] w-full bg-neutral-950 overflow-hidden">
                      <img src={report.image} alt={report.title} className="w-full h-full object-cover" />
                    </div>
                    <div className="text-xs font-mono uppercase text-neutral-400">
                      {report.category}
                    </div>
                    <h5 className="text-sm font-medium text-white line-clamp-2">
                      {report.title}
                    </h5>
                  </div>
                )}

                <div className="pt-2 border-t border-white/5">
                  <label className="block text-[11px] font-mono text-neutral-400 uppercase mb-1">
                    Cambiar artículo asignado:
                  </label>
                  <select
                    value={layoutConfig.block1ReportIds[colIndex] || ''}
                    onChange={(e) => handleAssignBlock1(colIndex, e.target.value)}
                    className="w-full bg-black border border-white/15 p-2 text-xs text-white focus:outline-none focus:border-white"
                  >
                    {reports.map((rep) => (
                      <option key={rep.id} value={rep.id}>
                        [{rep.category}] {rep.title.slice(0, 45)}...
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* POSICIÓN 3: BLOQUE II — COLUMNAS SECTORIALES (3 COLUMNAS) */}
      <div className="pb-8 border-b border-white/5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-white" />
            <h3 className="text-sm font-medium uppercase tracking-wider text-white">
              POSICIÓN 3 · BLOQUE II: COLUMNAS SECTORIALES (3 COLUMNAS)
            </h3>
          </div>
          <span className="text-xs font-mono text-neutral-400">
            ANÁLISIS DE MERCADO & CIENCIA
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[0, 1, 2].map((colIndex) => {
            const report = block2Reports[colIndex];
            return (
              <div key={colIndex} className="p-4 border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono uppercase tracking-wider text-white font-medium">
                    COLUMNA #{colIndex + 1}
                  </span>
                  <span className="text-xs font-mono text-neutral-500">BLOQUE II</span>
                </div>

                {report && (
                  <div className="space-y-1.5">
                    <div className="aspect-[16/9] w-full bg-neutral-950 overflow-hidden mb-2">
                      <img src={report.image} alt={report.title} className="w-full h-full object-cover" />
                    </div>
                    <div className="text-xs font-mono uppercase text-neutral-400">
                      {report.category}
                    </div>
                    <h5 className="text-xs sm:text-sm font-medium text-white line-clamp-2">
                      {report.title}
                    </h5>
                  </div>
                )}

                <div className="pt-2 border-t border-white/5">
                  <label className="block text-[11px] font-mono text-neutral-400 uppercase mb-1">
                    Cambiar artículo:
                  </label>
                  <select
                    value={layoutConfig.block2ReportIds[colIndex] || ''}
                    onChange={(e) => handleAssignBlock2(colIndex, e.target.value)}
                    className="w-full bg-black border border-white/15 p-1.5 text-xs text-white focus:outline-none focus:border-white"
                  >
                    {reports.map((rep) => (
                      <option key={rep.id} value={rep.id}>
                        [{rep.category}] {rep.title.slice(0, 40)}...
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* POSICIÓN 4: BLOQUE III — DOSSIER PERMANENTE */}
      <div className="pb-8 border-b border-white/5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-white" />
            <h3 className="text-sm font-medium uppercase tracking-wider text-white">
              POSICIÓN 4 · BLOQUE III: DOSSIER DESTACADO EN LA FRANJA INFERIOR
            </h3>
          </div>
        </div>

        <div className="p-4 border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="text-xs font-mono uppercase text-neutral-400 mb-1">
              DOSSIER SELECCIONADO:
            </div>
            <h4 className="text-sm font-medium text-white truncate">
              {currentDossier?.title}
            </h4>
          </div>
          <div className="w-full sm:w-80 shrink-0">
            <select
              value={layoutConfig.dossierReportId}
              onChange={(e) => handleAssignDossier(e.target.value)}
              className="w-full bg-black border border-white/20 p-2 text-xs text-white focus:outline-none focus:border-white"
            >
              {reports.map((rep) => (
                <option key={rep.id} value={rep.id}>
                  [{rep.category}] {rep.title.slice(0, 45)}...
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* POSICIÓN 5: TELETIPO DE ÚLTIMA HORA (BREAKING TICKER) */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-white" />
            <h3 className="text-sm font-medium uppercase tracking-wider text-white">
              POSICIÓN 5 · TELETIPO EN DIRECTO ({flashNews.length} NOTICIAS ACTIVAS)
            </h3>
          </div>
        </div>

        {/* Form to add rapid breaking headline */}
        <form onSubmit={handleAddFlash} className="flex flex-col sm:flex-row gap-3 mb-6">
          <input
            type="text"
            required
            value={newFlashTitle}
            onChange={(e) => setNewFlashTitle(e.target.value)}
            placeholder="Escribir titular urgente para el teletipo en vivo..."
            className="flex-1 bg-black border-b border-white/20 pb-2 text-xs sm:text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-white"
          />
          <select
            value={newFlashCategory}
            onChange={(e) => setNewFlashCategory(e.target.value)}
            className="bg-black border border-white/20 px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-white"
          >
            <option value="ECONOMÍA & MERCADOS">ECONOMÍA & MERCADOS</option>
            <option value="GEOPOLÍTICA">GEOPOLÍTICA</option>
            <option value="TECNOLOGÍA & INNOVACIÓN">TECNOLOGÍA & INNOVACIÓN</option>
            <option value="DERECHO & PROPIEDAD">DERECHO & PROPIEDAD</option>
            <option value="ENERGÍA & INDUSTRIA">ENERGÍA & INDUSTRIA</option>
          </select>
          <button
            type="submit"
            className="px-4 py-2 bg-white text-black font-medium text-xs uppercase tracking-wider hover:bg-neutral-200 transition-colors cursor-pointer shrink-0"
          >
            + AÑADIR A TELETIPO
          </button>
        </form>

        {/* Active flash list */}
        <div className="divide-y divide-white/5 border-t border-white/5">
          {flashNews.map((flash) => (
            <div key={flash.id} className="py-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-xs font-mono text-neutral-500 uppercase shrink-0">
                  [{flash.category}]
                </span>
                <span className="text-xs sm:text-sm text-neutral-200 truncate">
                  {flash.title}
                </span>
              </div>
              <button
                onClick={() => handleRemoveFlash(flash.id)}
                className="text-xs font-mono text-neutral-500 hover:text-red-400 transition-colors cursor-pointer shrink-0"
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
