import React, { useCallback, useEffect, useState } from 'react';
import { HardDrive, Gauge, Server, RefreshCw } from 'lucide-react';
import { FREE_LIMIT_REGISTERED, loadReadUsage } from '../utils/readMeter';

interface ServiceUsagePanelProps {
  publishedCount: number;
  flashCount: number;
  adsActiveCount: number;
  adsImpressions: number;
  adsClicks: number;
  draftsCount: number;
  maxDrafts: number;
  redactorsCount: number;
  categoriesCount: number;
}

/** Límite típico de localStorage por origen en los navegadores (~5 MB de caracteres). */
const LOCAL_LIMIT_CHARS = 5_000_000;

const fmtBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

/** Tamaño aproximado de un valor de localStorage (caracteres UTF-16 → bytes ×2). */
const fmtChars = (chars: number): string => fmtBytes(chars * 2);

const categoryOf = (key: string): string => {
  if (key === 'blacknews_reports' || key === 'blacknews_unsynced_report_ids' || key === 'blacknews_pending_report_deletes') return 'Despachos';
  if (key.startsWith('blacknews_drafts_') || key === 'blacknews_post_generator_draft') return 'Borradores';
  if (key === 'blacknews_flash_news') return 'Teletipo';
  if (key === 'blacknews_ads') return 'Anuncios';
  if (/redactors|categories|layout_config|active_user|subscription/.test(key)) return 'Equipo y portada';
  if (/bookmarks|readpos|highlights|map_reads/.test(key)) return 'Lectura';
  return 'Otros';
};

const scanLocalUsage = (): { total: number; groups: Array<[string, number]> } => {
  const groups: Record<string, number> = {};
  let total = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith('blacknews_')) continue;
      const value = localStorage.getItem(key) || '';
      const chars = key.length + value.length;
      total += chars;
      const cat = categoryOf(key);
      groups[cat] = (groups[cat] || 0) + chars;
    }
  } catch {}
  return {
    total,
    groups: Object.entries(groups)
      .filter(([, chars]) => chars > 0)
      .sort((a, b) => b[1] - a[1]),
  };
};

/** Barra de progreso con etiqueta y contador n/m. */
const Meter: React.FC<{ label: string; used: number; max: number; hint?: string }> = ({
  label,
  used,
  max,
  hint,
}) => {
  const pct = max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
          {label}
        </span>
        <span className="text-xs font-mono text-white">
          {used}
          <span className="text-neutral-600"> / {max}</span>
        </span>
      </div>
      <div className="mt-1.5 h-1 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${pct >= 100 ? 'bg-red-400' : pct >= 80 ? 'bg-amber-300' : 'bg-white'}`}
          style={{ width: `${Math.max(pct, used > 0 ? 1.5 : 0)}%` }}
        />
      </div>
      {hint && <div className="text-[10px] text-neutral-600 mt-1 font-light">{hint}</div>}
    </div>
  );
};

/** Cifra simple de uso (etiqueta + valor). */
const Stat: React.FC<{ label: string; value: string | number; hint?: string }> = ({
  label,
  value,
  hint,
}) => (
  <div className="min-w-0">
    <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 truncate">
      {label}
    </div>
    <div className="text-lg font-extrabold text-white tracking-tight leading-tight mt-0.5">
      {value}
    </div>
    {hint && <div className="text-[10px] text-neutral-600 font-light truncate">{hint}</div>}
  </div>
);

const CardShell: React.FC<{
  icon: React.ReactNode;
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}> = ({ icon, title, right, children }) => (
  <div className="border border-white/10 rounded-xl bg-neutral-950/60 p-5 flex flex-col">
    <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/10">
      <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
        <span className="text-neutral-400">{icon}</span>
        {title}
      </h3>
      {right}
    </div>
    {children}
  </div>
);

export const ServiceUsagePanel: React.FC<ServiceUsagePanelProps> = ({
  publishedCount,
  flashCount,
  adsActiveCount,
  adsImpressions,
  adsClicks,
  draftsCount,
  maxDrafts,
  redactorsCount,
  categoriesCount,
}) => {
  const [scan, setScan] = useState(scanLocalUsage);
  const [origin, setOrigin] = useState<{ usage: number; quota: number } | null>(null);
  const [visits, setVisits] = useState(0);
  const [freeReads, setFreeReads] = useState(0);
  const [bookmarksCount, setBookmarksCount] = useState(0);
  const [highlightsCount, setHighlightsCount] = useState(0);

  const refresh = useCallback(() => {
    setScan(scanLocalUsage());
    try {
      setVisits(parseInt(localStorage.getItem('blacknews_device_visits') || '0', 10) || 0);
    } catch {}
    try {
      // Cuota diaria de lecturas gratuitas (artículos únicos de hoy)
      setFreeReads(loadReadUsage().ids.length);
    } catch {}
    try {
      const parsed = JSON.parse(localStorage.getItem('blacknews_bookmarks') || '[]');
      setBookmarksCount(Array.isArray(parsed) ? parsed.length : 0);
    } catch {}
    try {
      const parsed = JSON.parse(localStorage.getItem('blacknews_highlights') || '[]');
      setHighlightsCount(Array.isArray(parsed) ? parsed.length : 0);
    } catch {}
    try {
      navigator.storage
        ?.estimate?.()
        .then((est) => {
          if (est && typeof est.usage === 'number' && typeof est.quota === 'number') {
            setOrigin({ usage: est.usage, quota: est.quota });
          }
        })
        .catch(() => {});
    } catch {}
  }, []);

  // Recalcula al montar y cuando cambian los contadores que llegan por props.
  useEffect(() => {
    refresh();
  }, [refresh, draftsCount, publishedCount, flashCount]);

  const pctLocal = Math.min(100, Math.round((scan.total / LOCAL_LIMIT_CHARS) * 100));
  const ctr =
    adsImpressions > 0 ? `${((adsClicks / adsImpressions) * 100).toFixed(1)}%` : '—';

  return (
    <section className="space-y-4">
      {/* Encabezado de sección */}
      <div className="flex items-center justify-between pb-2 border-b border-white/10">
        <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
          <Server className="w-3.5 h-3.5 text-neutral-400" />
          <span>Servicio y Límites</span>
        </h3>
        <button
          type="button"
          onClick={refresh}
          className="text-[11px] text-neutral-500 hover:text-white font-medium flex items-center gap-1.5 cursor-pointer transition-colors"
          title="Recalcular consumo local"
        >
          <RefreshCw className="w-3 h-3" />
          Recalcular
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* CARD 1: Almacenamiento del contenido */}
        <CardShell icon={<HardDrive className="w-3.5 h-3.5" />} title="Almacenamiento">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-white tracking-tight">
              {fmtChars(scan.total)}
            </span>
            <span className="text-[11px] text-neutral-500 font-light">
              de ~5 MB · {pctLocal === 0 && scan.total > 0 ? '<1%' : `${pctLocal}%`}
            </span>
          </div>
          <div className="mt-2 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${pctLocal >= 90 ? 'bg-red-400' : pctLocal >= 70 ? 'bg-amber-300' : 'bg-white'}`}
              style={{ width: `${Math.max(pctLocal, scan.total > 0 ? 1 : 0)}%` }}
            />
          </div>
          <p className="text-[10px] text-neutral-600 mt-1.5 font-light">
            Datos del sitio en este navegador (límite típico de los navegadores).
          </p>

          {scan.groups.length > 0 && (
            <div className="mt-4 space-y-1.5">
              {scan.groups.map(([label, chars]) => (
                <div
                  key={label}
                  className="flex items-center justify-between text-[11px] gap-2"
                >
                  <span className="text-neutral-400 font-light truncate">{label}</span>
                  <span className="font-mono text-neutral-300 shrink-0">
                    {fmtChars(chars)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {origin && origin.quota > 0 && (
            <div className="mt-4 pt-3 border-t border-white/10">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                Caché y datos del origen
              </div>
              <div className="text-xs font-mono text-neutral-300 mt-1">
                {fmtBytes(origin.usage)} / {fmtBytes(origin.quota)}
              </div>
              <div className="text-[10px] text-neutral-600 font-light mt-0.5">
                Incluye la caché PWA de la aplicación.
              </div>
            </div>
          )}
        </CardShell>

        {/* CARD 2: Uso y límites de la cuenta */}
        <CardShell icon={<Gauge className="w-3.5 h-3.5" />} title="Uso y límites">
          <div className="space-y-4">
            <Meter
              label="Borradores por redactor"
              used={draftsCount}
              max={maxDrafts}
              hint="Máximo de artículos en borradores por usuario"
            />
            <Meter
              label="Lecturas gratuitas · hoy"
              used={Math.min(freeReads, FREE_LIMIT_REGISTERED)}
              max={FREE_LIMIT_REGISTERED}
              hint="Plan gratuito (2 sin registro · 3 con cuenta) · se reinicia cada día"
            />
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-3.5 mt-5 pt-4 border-t border-white/10">
            <Stat label="Visitas" value={visits} hint="Este dispositivo" />
            <Stat label="Despachos" value={publishedCount} hint="Almacenamiento local" />
            <Stat label="Alertas teletipo" value={flashCount} />
            <Stat label="Anuncios activos" value={adsActiveCount} />
            <Stat label="Impresiones anuncios" value={adsImpressions.toLocaleString('es-ES')} />
            <Stat label="Clics · CTR" value={`${adsClicks.toLocaleString('es-ES')} · ${ctr}`} />
            <Stat label="Marcadores" value={bookmarksCount} />
            <Stat label="Subrayados" value={highlightsCount} />
            <Stat label="Equipo" value={redactorsCount} hint="Cuentas de redacción" />
            <Stat label="Categorías" value={categoriesCount} hint="Secciones de portada" />
          </div>
        </CardShell>

        {/* CARD 3: Plan del servicio (referencia oficial) */}
        <CardShell
          icon={<Server className="w-3.5 h-3.5" />}
          title="Plan del servicio"
          right={
            <span className="text-[9px] font-mono uppercase text-neutral-600">
              Referencia · oct 2026
            </span>
          }
        >
          <div className="space-y-4 text-[11px] leading-relaxed">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-white mb-1.5">
                Cloudflare Workers · Gratis
              </div>
              <ul className="space-y-1 text-neutral-400 font-light">
                <li>
                  <span className="text-neutral-200 font-medium">100.000 solicitudes/día</span>{' '}
                  (se reinicia a medianoche UTC)
                </li>
                <li>
                  <span className="text-neutral-200 font-medium">10 ms de CPU</span> por
                  solicitud · <span className="text-neutral-200 font-medium">128 MB</span> de
                  memoria
                </li>
                <li>
                  Worker ≤ <span className="text-neutral-200 font-medium">64 MiB</span> · hasta{' '}
                  <span className="text-neutral-200 font-medium">20.000 archivos estáticos</span>{' '}
                  (≤25 MiB c/u)
                </li>
              </ul>
            </div>

            <div className="pt-3 border-t border-white/10">
              <div className="text-[10px] font-bold uppercase tracking-wider text-white mb-1.5">
                Cloudinary · Gratis (imágenes)
              </div>
              <ul className="space-y-1 text-neutral-400 font-light">
                <li>
                  <span className="text-neutral-200 font-medium">25 créditos/mes</span> ·
                  intercambiables
                </li>
                <li>
                  1 crédito ={' '}
                  <span className="text-neutral-200 font-medium">1 GB de almacenamiento</span> ={' '}
                  <span className="text-neutral-200 font-medium">1.000 transformaciones</span> ={' '}
                  <span className="text-neutral-200 font-medium">1 GB de ancho de banda</span>
                </li>
                <li>
                  <span className="text-neutral-200 font-medium">3 usuarios</span> /1 cuenta
                </li>
              </ul>
            </div>

            <p className="pt-3 border-t border-white/10 text-[10px] text-neutral-600 font-light">
              Fuentes: developers.cloudflare.com/workers/platform/limits (sep 2026) y
              cloudinary.com/pricing (oct 2026). Las visitas y solicitudes globales del sitio se
              miden en la consola de Cloudflare (Workers → Métricas).
            </p>
          </div>
        </CardShell>
      </div>
    </section>
  );
};
