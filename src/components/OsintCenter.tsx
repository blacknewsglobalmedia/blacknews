/**
 * BLACKNEWS OSINT — Centro de Investigación (sección del panel interno).
 *
 * Sólo para administradores (la pestaña se gatinga en RedactionStudio y el
 * Worker vuelve a verificar en backend). Todo consulta al Worker: aquí no
 * hay claves ni llamadas directas a APIs de terceros.
 *
 * Secciones:
 * - Estado del sistema (fuentes, cuotas, avisos, última búsqueda)
 * - Buscador multi-fuente (errores parciales visibles por fuente)
 * - Resultados + vista previa lateral (importar / guardar / descartar)
 * - Guardados (estados configurables + notas internas)
 * - Fuentes de inteligencia (activar, límites, añadir feed RSS con prueba)
 *
 * Las cuotas se muestran SIEMPRE con su categoría real: oficial / por
 * cabeceras / internas / desconocido. Un contador interno nunca se
 * presenta como cuota del proveedor.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Activity,
  AlertTriangle,
  Bookmark,
  BookmarkCheck,
  Check,
  Clock,
  ExternalLink,
  FileInput,
  Globe2,
  Inbox,
  Languages,
  Loader2,
  Pause,
  PencilLine,
  Plus,
  Radar,
  RefreshCw,
  Rss,
  Search,
  Send,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import {
  OSINT_LANGUAGES,
  OSINT_SAVED_STATES,
  type OsintCluster,
  type OsintItem,
  type OsintPostImport,
  type OsintQuotaKind,
  type OsintSavedItem,
  type OsintSavedState,
  type OsintSearchRequest,
  type OsintSearchResponse,
  type OsintSourceConfig,
  type OsintSourceResult,
  type OsintSourceRuntime,
  type OsintStatusResponse,
} from '../types/osint';
import { osintApi } from '../utils/osintApi';

const SAVED_KEY = 'blacknews_osint_saved';

/* ISO 3166-1 → nombre legible (sólo cuando la fuente lo informa). */
const ISO_NAMES: Record<string, string> = {
  UY: 'Uruguay', AR: 'Argentina', BR: 'Brasil', CL: 'Chile', CO: 'Colombia',
  PE: 'Perú', VE: 'Venezuela', PY: 'Paraguay', BO: 'Bolivia', EC: 'Ecuador',
  MX: 'México', CU: 'Cuba', DO: 'Rep. Dominicana', CR: 'Costa Rica', PA: 'Panamá',
  GT: 'Guatemala', HT: 'Haití', US: 'Estados Unidos', CA: 'Canadá', ES: 'España',
  PT: 'Portugal', FR: 'Francia', DE: 'Alemania', GB: 'Reino Unido', IT: 'Italia',
  NL: 'Países Bajos', BE: 'Bélgica', CH: 'Suiza', AT: 'Austria', SE: 'Suecia',
  NO: 'Noruega', FI: 'Finlandia', DK: 'Dinamarca', IE: 'Irlanda', PL: 'Polonia',
  CZ: 'Chequia', SK: 'Eslovaquia', HU: 'Hungría', RO: 'Rumanía', BG: 'Bulgaria',
  GR: 'Grecia', RS: 'Serbia', HR: 'Croacia', UA: 'Ucrania', RU: 'Rusia',
  TR: 'Turquía', IL: 'Israel', IR: 'Irán', IQ: 'Irak', SY: 'Siria', JO: 'Jordania',
  LBN: 'Líbano', EG: 'Egipto', SA: 'Arabia Saudita', AE: 'Emiratos Árabes',
  QA: 'Catar', KW: 'Kuwait', YE: 'Yemen', MA: 'Marruecos', DZ: 'Argelia',
  TN: 'Túnez', LY: 'Libia', SD: 'Sudán', NG: 'Nigeria', ZA: 'Sudáfrica',
  KE: 'Kenia', ET: 'Etiopía', CN: 'China', JP: 'Japón', KR: 'Corea del Sur',
  IN: 'India', PK: 'Pakistán', BD: 'Bangladés', VN: 'Vietnam', TH: 'Tailandia',
  ID: 'Indonesia', MY: 'Malasia', SG: 'Singapur', PH: 'Filipinas', AU: 'Australia',
  NZ: 'Nueva Zelanda', KZ: 'Kazajistán',
};

function flagEmoji(code: string): string {
  const c = code.toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return '🌐';
  return String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65, 0x1f1e6 + c.charCodeAt(1) - 65);
}

function countryName(code?: string): string | undefined {
  if (!code) return undefined;
  return ISO_NAMES[code.toUpperCase()] || `País ${code.toUpperCase()}`;
}

function fmtDateTime(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-UY', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Categoría de cuota → etiqueta honesta para la UI. */
const QUOTA_LABEL: Record<OsintQuotaKind, string> = {
  official: 'Cuota documentada por el proveedor',
  headers: 'Saldo informado por la API (cabeceras)',
  internal: 'Contador interno de BlackNews',
  unknown: 'Límite desconocido / no verificable',
};

const STATUS_PILL: Record<OsintSourceRuntime['status'], { label: string; cls: string }> = {
  active: { label: 'ACTIVA', cls: 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10' },
  disabled: { label: 'DESACTIVADA', cls: 'text-neutral-400 border-white/15 bg-white/5' },
  pending_setup: { label: 'PENDIENTE DE CONFIGURAR', cls: 'text-amber-300 border-amber-500/40 bg-amber-500/10' },
  rate_limited: { label: 'LÍMITE ALCANZADO', cls: 'text-orange-300 border-orange-500/40 bg-orange-500/10' },
  error: { label: 'CON ERROR', cls: 'text-red-300 border-red-500/40 bg-red-500/10' },
};

interface OsintCenterProps {
  onImportToPosts: (payload: OsintPostImport) => void;
  onImportToArticle: (item: OsintItem) => void;
}

type CenterTab = 'buscar' | 'guardados' | 'fuentes';

export function OsintCenter({ onImportToPosts, onImportToArticle }: OsintCenterProps) {
  /* ---------------- estado del sistema ---------------- */
  const [status, setStatus] = useState<OsintStatusResponse | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  /* ---------------- buscador ---------------- */
  const [tab, setTab] = useState<CenterTab>('buscar');
  const [query, setQuery] = useState('');
  const [period, setPeriod] = useState<OsintSearchRequest['period']>('24h');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [langs, setLangs] = useState<Set<string>>(new Set());
  const [sourceFilter, setSourceFilter] = useState<Set<string>>(new Set());
  const [onlyNew, setOnlyNew] = useState(false);
  const [sort, setSort] = useState<'date' | 'relevance' | 'score'>('score');
  const [maxPerSource, setMaxPerSource] = useState(20);
  const [autoRefresh, setAutoRefresh] = useState(false); // OFF por defecto
  const [autoMinutes, setAutoMinutes] = useState(30);

  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [lastSearch, setLastSearch] = useState<OsintSearchResponse | null>(null);

  /* ---------------- resultados / guardados ---------------- */
  const [preview, setPreview] = useState<OsintItem | null>(null);
  const [saved, setSaved] = useState<OsintSavedItem[]>([]);
  const [savedFilter, setSavedFilter] = useState<'all' | OsintSavedState>('all');

  /* ---------------- fuentes ---------------- */
  const [testingUrl, setTestingUrl] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [newFeed, setNewFeed] = useState({ name: '', url: '', language: 'es' });
  const [creatingFeed, setCreatingFeed] = useState(false);

  const savedIds = useMemo(() => new Set(saved.map((s) => s.item.id)), [saved]);
  const searchRanOnce = useRef(false);

  /* ---------------- persistencia local (guardados) ---------------- */
  const loadSaved = useCallback(() => {
    try {
      const raw = localStorage.getItem(SAVED_KEY);
      setSaved(raw ? (JSON.parse(raw) as OsintSavedItem[]) : []);
    } catch {
      setSaved([]);
    }
  }, []);

  const persistSaved = useCallback((next: OsintSavedItem[]) => {
    setSaved(next);
    localStorage.setItem(SAVED_KEY, JSON.stringify(next));
  }, []);

  const refreshStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      setStatus(await osintApi.status());
      setStatusError(null);
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'No se pudo leer el estado.');
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    loadSaved();
    refreshStatus();
  }, [loadSaved, refreshStatus]);

  /* ---------------- buscar ---------------- */
  const runSearch = useCallback(
    async (signal?: AbortSignal) => {
      if (query.trim().length < 2) {
        setSearchError('Escribe al menos 2 palabras clave para buscar.');
        return;
      }
      setSearching(true);
      setSearchError(null);
      try {
        const body: OsintSearchRequest = {
          query: query.trim(),
          period,
          sort,
          maxPerSource,
          sources: sourceFilter.size > 0 ? [...sourceFilter] : undefined,
          languages: langs.size > 0 ? [...langs] : undefined,
          excludeIds: onlyNew && savedIds.size > 0 ? [...savedIds] : undefined,
          customFrom: period === 'custom' && customFrom ? new Date(`${customFrom}T00:00:00`).toISOString() : undefined,
          customTo: period === 'custom' && customTo ? new Date(`${customTo}T23:59:59`).toISOString() : undefined,
        };
        const res = await osintApi.search(body);
        if (signal?.aborted) return;
        setLastSearch(res);
        searchRanOnce.current = true;
        refreshStatus(); // refresca contadores del panel superior
      } catch (err) {
        if (!signal?.aborted) {
          setSearchError(err instanceof Error ? err.message : 'La búsqueda falló.');
        }
      } finally {
        if (!signal?.aborted) setSearching(false);
      }
    },
    [customFrom, customTo, langs, maxPerSource, onlyNew, period, query, refreshStatus, savedIds, sort, sourceFilter],
  );

  /* Actualización automática: DESACTIVADA hasta que el admin la active. */
  useEffect(() => {
    if (!autoRefresh || query.trim().length < 2) return;
    const controller = new AbortController();
    const id = window.setInterval(() => {
      void runSearch(controller.signal);
    }, Math.max(5, autoMinutes) * 60_000);
    return () => {
      window.clearInterval(id);
      controller.abort();
    };
  }, [autoRefresh, autoMinutes, query, runSearch]);

  /* ---------------- guardados ---------------- */
  const saveItem = (item: OsintItem) => {
    if (savedIds.has(item.id)) return;
    const now = new Date().toISOString();
    persistSaved([{ item, state: 'new', notes: '', savedAt: now, updatedAt: now }, ...saved]);
  };

  const unsaveItem = (id: string) => persistSaved(saved.filter((s) => s.item.id !== id));

  const updateSaved = (id: string, patch: Partial<Pick<OsintSavedItem, 'state' | 'notes'>>) =>
    persistSaved(
      saved.map((s) => (s.item.id === id ? { ...s, ...patch, updatedAt: new Date().toISOString() } : s)),
    );

  /* ---------------- importaciones ---------------- */
  const importToPosts = (item: OsintItem) => {
    const payload: OsintPostImport = {
      title: item.title,
      description: item.snippet || '',
      countries: item.country ? [{ name: countryName(item.country) || item.country, code: item.country, flag: flagEmoji(item.country) }] : [],
      sourceName: item.sourceName,
      sourceUrl: item.url,
      imageUrl: item.imageUrl,
      publishedAt: item.publishedAt,
    };
    onImportToPosts(payload);
    updateSaved(item.id, { state: 'imported_posts' });
    if (!savedIds.has(item.id)) {
      const now = new Date().toISOString();
      persistSaved([{ item, state: 'imported_posts', notes: '', savedAt: now, updatedAt: now }, ...saved]);
    }
  };

  const importToArticle = (item: OsintItem) => {
    onImportToArticle(item);
    updateSaved(item.id, { state: 'imported_article' });
    if (!savedIds.has(item.id)) {
      const now = new Date().toISOString();
      persistSaved([{ item, state: 'imported_article', notes: '', savedAt: now, updatedAt: now }, ...saved]);
    }
  };

  /* ---------------- fuentes (admin) ---------------- */
  const toggleSource = async (config: OsintSourceConfig) => {
    try {
      await osintApi.updateSource(config.id, { enabled: !config.enabled });
      await refreshStatus();
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'No se pudo actualizar la fuente.');
    }
  };

  const setInternalLimit = async (config: OsintSourceConfig, value: string) => {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return;
    try {
      await osintApi.updateSource(config.id, { internalDailyLimit: Math.floor(n) });
      await refreshStatus();
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'No se pudo guardar el límite.');
    }
  };

  const removeSource = async (config: OsintSourceConfig) => {
    if (!window.confirm(`¿Eliminar la fuente «${config.name}»?`)) return;
    try {
      await osintApi.deleteSource(config.id);
      await refreshStatus();
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'No se pudo eliminar la fuente.');
    }
  };

  const testFeed = async () => {
    const url = newFeed.url.trim();
    if (!url) return;
    setTestingUrl(url);
    setTestResult(null);
    try {
      const res = await osintApi.testSource(url);
      setTestResult(
        res.ok
          ? `Conexión correcta: ${res.total ?? res.preview?.length ?? 0} artículos leídos. Ejemplo: «${res.preview?.[0]?.title || '—'}»`
          : `Fallo: ${res.error || 'sin detalle'}`,
      );
    } catch (err) {
      setTestResult(`Fallo: ${err instanceof Error ? err.message : 'error desconocido'}`);
    } finally {
      setTestingUrl(null);
    }
  };

  const createFeed = async () => {
    if (newFeed.name.trim().length < 2 || !newFeed.url.trim()) return;
    setCreatingFeed(true);
    try {
      await osintApi.createSource({
        name: newFeed.name.trim(),
        url: newFeed.url.trim(),
        languages: [newFeed.language],
      });
      setNewFeed({ name: '', url: '', language: 'es' });
      setTestResult(null);
      await refreshStatus();
    } catch (err) {
      setTestResult(`No se pudo crear: ${err instanceof Error ? err.message : 'error'}`);
    } finally {
      setCreatingFeed(false);
    }
  };

  /* ---------------- derivados ---------------- */
  const clustersById = useMemo(() => {
    const map = new Map<string, OsintCluster>();
    for (const c of lastSearch?.clusters || []) map.set(c.id, c);
    return map;
  }, [lastSearch]);

  const results = lastSearch?.results || [];
  const enabledSources = (status?.sources || []).filter((s) => s.enabled);
  const problemSources = enabledSources.filter(
    (s) => s.runtime.status === 'error' || s.runtime.status === 'rate_limited' || s.runtime.status === 'pending_setup',
  );

  const filteredSaved = saved.filter((s) => savedFilter === 'all' || s.state === savedFilter);

  const toggleInSet = (set: Set<string>, value: string): Set<string> => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  };

  /* ================================================== */
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-16 space-y-8">
      {/* Cabecera */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[13px] font-mono uppercase tracking-widest text-neutral-400 font-semibold mb-1">
            <Radar className="w-4 h-4 text-emerald-400" />
            <span>OSINT · CENTRO DE INVESTIGACIÓN</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight font-['Lexend']">
            Inteligencia de fuentes abiertas
          </h2>
          <p className="text-sm text-neutral-400 font-light mt-1 max-w-2xl">
            Búsquedas multi-fuente desde el backend, verificación de administración y
            exportación a las herramientas editoriales. Ninguna clave sale del Worker.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refreshStatus()}
          className="px-3.5 py-2 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 hover:text-white rounded-xl text-[13px] font-semibold transition-colors flex items-center gap-2 shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${loadingStatus ? 'animate-spin' : ''}`} />
          Actualizar estado
        </button>
      </div>

      {/* Sub-navegación */}
      <div className="flex gap-2">
        {(
          [
            ['buscar', 'Buscar', Search],
            ['guardados', `Guardados (${saved.length})`, Bookmark],
            ['fuentes', 'Fuentes', Globe2],
          ] as Array<[CenterTab, string, typeof Search]>
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`px-4 py-2 rounded-xl text-[13px] font-semibold transition-colors flex items-center gap-2 ${
              tab === id
                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40'
                : 'bg-neutral-950 text-neutral-400 border border-white/10 hover:text-white'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ------------- Estado del sistema ------------- */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatusCard
          icon={<Activity className="w-4 h-4 text-emerald-400" />}
          label="Estado del sistema"
          value={
            statusError
              ? 'SIN CONEXIÓN'
              : loadingStatus
                ? '…'
                : problemSources.length === 0
                  ? 'OPERATIVO'
                  : `${problemSources.length} AVISO${problemSources.length > 1 ? 'S' : ''}`
          }
          tone={statusError ? 'red' : problemSources.length > 0 ? 'amber' : 'emerald'}
        />
        <StatusCard
          icon={<Globe2 className="w-4 h-4 text-sky-400" />}
          label="Fuentes"
          value={`${enabledSources.length} ACTIVAS`}
          hint={`${(status?.sources || []).length - enabledSources.length} desactivadas`}
        />
        <StatusCard
          icon={<Clock className="w-4 h-4 text-neutral-300" />}
          label="Última búsqueda"
          value={status?.lastSearchAt ? fmtDateTime(status.lastSearchAt).toUpperCase() : 'NUNCA'}
          hint={
            lastSearch
              ? `${lastSearch.newCount} nuevos · ${lastSearch.duplicateCount} duplicados · ${lastSearch.took} ms`
              : undefined
          }
        />
        <StatusCard
          icon={<Send className="w-4 h-4 text-neutral-300" />}
          label="Solicitudes (interno)"
          value={`${status?.totals.requestsToday ?? 0} HOY`}
          hint={`${status?.totals.requestsTotal ?? 0} en total · contadores internos, no cuota oficial`}
        />
      </section>

      {(statusError || (status?.warnings.length ?? 0) > 0) && (
        <section className="space-y-2">
          {statusError && (
            <WarningRow tone="red" text={statusError} />
          )}
          {status?.warnings.map((w) => (
            <WarningRow key={w} tone="amber" text={w} />
          ))}
        </section>
      )}

      {tab === 'buscar' && (
        <>
          {/* ------------- Buscador ------------- */}
          <section className="rounded-2xl border border-white/10 bg-neutral-950/60 p-5 space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && void runSearch()}
                  placeholder="Palabras clave: personas, organizaciones, acontecimientos…"
                  className="w-full bg-neutral-900 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-[15px] text-white placeholder:text-neutral-600 focus:outline-none focus:border-emerald-500/50"
                />
              </div>
              <button
                type="button"
                onClick={() => void runSearch()}
                disabled={searching}
                className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-500/40 text-black font-bold text-[15px] flex items-center justify-center gap-2 transition-colors"
              >
                {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                {searching ? 'Buscando…' : 'Buscar'}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-[13px]">
              <Select
                label="Período"
                value={period}
                onChange={(v) => setPeriod(v as OsintSearchRequest['period'])}
                options={[
                  ['6h', 'Últimas 6 horas'],
                  ['24h', 'Últimas 24 horas'],
                  ['7d', 'Últimos 7 días'],
                  ['custom', 'Personalizado'],
                ]}
              />
              {period === 'custom' && (
                <>
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="bg-neutral-900 border border-white/10 rounded-lg px-3 py-2 text-[13px] text-neutral-200"
                  />
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="bg-neutral-900 border border-white/10 rounded-lg px-3 py-2 text-[13px] text-neutral-200"
                  />
                </>
              )}
              <Select
                label="Orden"
                value={sort}
                onChange={(v) => setSort(v as 'date' | 'relevance' | 'score')}
                options={[
                  ['score', 'Potencial de investigación'],
                  ['date', 'Más recientes'],
                  ['relevance', 'Relevancia'],
                ]}
              />
              <Select
                label="Máx./fuente"
                value={String(maxPerSource)}
                onChange={(v) => setMaxPerSource(Number(v))}
                options={[['10', '10'], ['20', '20'], ['50', '50']]}
              />
              <label className="flex items-center gap-2 text-neutral-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={onlyNew}
                  onChange={(e) => setOnlyNew(e.target.checked)}
                  className="w-4 h-4 rounded accent-emerald-500"
                />
                Sólo no guardados
              </label>
            </div>

            {/* Idiomas */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1.5 text-[13px] text-neutral-500 font-semibold uppercase tracking-wider">
                <Languages className="w-3.5 h-3.5" /> Idiomas
              </span>
              {OSINT_LANGUAGES.map((l) => (
                <Chip
                  key={l.code}
                  label={l.label}
                  active={langs.has(l.code)}
                  onClick={() => setLangs(toggleInSet(langs, l.code))}
                />
              ))}
            </div>

            {/* Fuentes */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1.5 text-[13px] text-neutral-500 font-semibold uppercase tracking-wider">
                <Globe2 className="w-3.5 h-3.5" /> Fuentes
              </span>
              {enabledSources.map((s) => (
                <Chip
                  key={s.id}
                  label={s.name}
                  active={sourceFilter.has(s.id)}
                  onClick={() => setSourceFilter(toggleInSet(sourceFilter, s.id))}
                  disabled={s.runtime.status === 'pending_setup'}
                />
              ))}
              {enabledSources.length === 0 && (
                <span className="text-[13px] text-neutral-500">Sin fuentes activas.</span>
              )}
            </div>

            {/* Actualización automática: apagada por defecto */}
            <div className="flex flex-wrap items-center gap-3 border-t border-white/5 pt-3">
              <label className="flex items-center gap-2 text-[13px] text-neutral-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="w-4 h-4 rounded accent-emerald-500"
                />
                Actualización automática (sólo con esta pestaña abierta)
              </label>
              {autoRefresh && (
                <Select
                  label="Cada"
                  value={String(autoMinutes)}
                  onChange={(v) => setAutoMinutes(Number(v))}
                  options={[['5', '5 min'], ['10', '10 min'], ['30', '30 min'], ['60', '60 min']]}
                />
              )}
              {!autoRefresh && (
                <span className="text-[13px] text-neutral-500">Apagada por defecto: no consulta sin que lo pidas.</span>
              )}
            </div>
          </section>

          {/* ------------- Resultados por fuente ------------- */}
          {searching && (
            <section className="flex items-center gap-3 text-[15px] text-neutral-300">
              <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
              Consultando fuentes en el Worker…
            </section>
          )}

          {searchError && <WarningRow tone="red" text={searchError} />}

          {results.length > 0 && (
            <section className="flex flex-wrap gap-2">
              {results.map((r) => (
                <SourceResultChip key={r.sourceId} result={r} />
              ))}
            </section>
          )}

          {/* ------------- Tarjetas de resultados ------------- */}
          {lastSearch && (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[15px] font-bold text-white flex items-center gap-2">
                  <Inbox className="w-4 h-4 text-neutral-400" />
                  {lastSearch.items.length} hallazgos · {lastSearch.clusters.length} acontecimientos agrupados
                </h3>
              </div>
              {lastSearch.items.length === 0 && !searching && (
                <p className="text-sm text-neutral-400">
                  Sin resultados para esa combinación. Prueba otro período, quita filtros o amplía las fuentes.
                </p>
              )}
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                {lastSearch.items.map((item) => (
                  <ResultCard
                    key={item.id}
                    item={item}
                    cluster={clustersById.get(item.clusterId)}
                    saved={savedIds.has(item.id)}
                    onPreview={() => setPreview(item)}
                    onSave={() => saveItem(item)}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* ------------- Guardados ------------- */}
      {tab === 'guardados' && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Chip label={`Todos (${saved.length})`} active={savedFilter === 'all'} onClick={() => setSavedFilter('all')} />
            {OSINT_SAVED_STATES.map((st) => (
              <Chip
                key={st.id}
                label={`${st.label} (${saved.filter((s) => s.state === st.id).length})`}
                active={savedFilter === st.id}
                onClick={() => setSavedFilter(st.id)}
              />
            ))}
          </div>
          {filteredSaved.length === 0 && (
            <p className="text-sm text-neutral-400">
              Aún no hay investigaciones guardadas. Usa «Guardar» en un resultado del buscador.
            </p>
          )}
          <div className="space-y-3">
            {filteredSaved.map((s) => (
              <div key={s.item.id} className="rounded-2xl border border-white/10 bg-neutral-950/60 p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="min-w-0">
                    <a
                      href={s.item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[15px] font-semibold text-white hover:text-emerald-300 transition-colors"
                    >
                      {s.item.title}
                    </a>
                    <p className="text-[13px] text-neutral-500 mt-0.5">
                      {s.item.sourceName} · detectado {fmtDateTime(s.item.detectedAt)}
                      {s.item.publishedAt ? ` · publicado ${fmtDateTime(s.item.publishedAt)}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={s.state}
                      onChange={(e) => updateSaved(s.item.id, { state: e.target.value as OsintSavedState })}
                      className="bg-neutral-900 border border-white/10 rounded-lg px-3 py-2 text-[13px] text-neutral-200"
                    >
                      {OSINT_SAVED_STATES.map((st) => (
                        <option key={st.id} value={st.id}>
                          {st.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => unsaveItem(s.item.id)}
                      aria-label="Descartar de los guardados"
                      className="p-2 text-neutral-500 hover:text-red-300 rounded-lg hover:bg-white/5"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <textarea
                  value={s.notes}
                  onChange={(e) => updateSaved(s.item.id, { notes: e.target.value })}
                  placeholder="Notas internas de la investigación…"
                  rows={2}
                  className="w-full bg-neutral-900 border border-white/10 rounded-xl px-3 py-2 text-[13px] text-neutral-200 placeholder:text-neutral-600 resize-y"
                />
                <div className="flex flex-wrap gap-2">
                  <SmallBtn onClick={() => importToPosts(s.item)}>
                    <FileInput className="w-3.5 h-3.5" /> Importar al generador
                  </SmallBtn>
                  <SmallBtn onClick={() => importToArticle(s.item)}>
                    <PencilLine className="w-3.5 h-3.5" /> Importar al redactor
                  </SmallBtn>
                  <SmallBtn onClick={() => setPreview(s.item)}>
                    <Search className="w-3.5 h-3.5" /> Previsualizar
                  </SmallBtn>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ------------- Fuentes de inteligencia ------------- */}
      {tab === 'fuentes' && (
        <section className="space-y-5">
          <p className="text-sm text-neutral-400">
            Activa sólo las fuentes que quieras usar. Los límites muestran su categoría real:
            cuota documentada, saldo informado por la API, contador interno de BlackNews o desconocido.
          </p>
          <div className="space-y-3">
            {(status?.sources || []).map((s) => (
              <SourceRow
                key={s.id}
                source={s}
                onToggle={() => void toggleSource(s)}
                onLimit={(v) => void setInternalLimit(s, v)}
                onDelete={s.custom ? () => void removeSource(s) : undefined}
              />
            ))}
          </div>

          {/* Añadir feed RSS personalizado */}
          <div className="rounded-2xl border border-white/10 bg-neutral-950/60 p-5 space-y-3">
            <h4 className="text-[15px] font-bold text-white flex items-center gap-2">
              <Plus className="w-4 h-4 text-emerald-400" /> Añadir feed RSS / Atom
            </h4>
            <p className="text-[13px] text-neutral-400 leading-relaxed">
              El dominio debe estar en la allowlist del Worker (<code className="font-mono text-neutral-300">OSINT_RSS_ALLOWLIST</code>);
              sin ella, cualquier URL no se convierte en destino del servidor (protección SSRF).
            </p>
            <div className="grid sm:grid-cols-[1fr_2fr_auto] gap-3">
              <input
                value={newFeed.name}
                onChange={(e) => setNewFeed({ ...newFeed, name: e.target.value })}
                placeholder="Nombre (ej. Ministerio X)"
                className="bg-neutral-900 border border-white/10 rounded-xl px-3 py-2.5 text-[14px] text-white placeholder:text-neutral-600"
              />
              <input
                value={newFeed.url}
                onChange={(e) => setNewFeed({ ...newFeed, url: e.target.value })}
                placeholder="https://medio.org/feed.xml"
                className="bg-neutral-900 border border-white/10 rounded-xl px-3 py-2.5 text-[14px] text-white placeholder:text-neutral-600 font-mono"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void testFeed()}
                  disabled={testingUrl !== null}
                  className="px-4 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-200 text-[13px] font-semibold flex items-center gap-2 border border-white/10"
                >
                  {testingUrl ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rss className="w-4 h-4" />}
                  Probar
                </button>
                <button
                  type="button"
                  onClick={() => void createFeed()}
                  disabled={creatingFeed}
                  className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-500/40 text-black text-[13px] font-bold"
                >
                  {creatingFeed ? 'Añadiendo…' : 'Añadir'}
                </button>
              </div>
            </div>
            {testResult && <p className="text-[13px] text-neutral-300">{testResult}</p>}
          </div>
        </section>
      )}

      {/* ------------- Vista previa lateral ------------- */}
      {preview && (
        <PreviewDrawer
          item={preview}
          cluster={clustersById.get(preview.clusterId)}
          saved={savedIds.has(preview.id)}
          onClose={() => setPreview(null)}
          onImportPosts={() => importToPosts(preview)}
          onImportArticle={() => importToArticle(preview)}
          onSave={() => saveItem(preview)}
        />
      )}
    </div>
  );
}

/* ================================================== */
/* Componentes de presentación                        */
/* ================================================== */

function StatusCard({
  icon,
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone?: 'neutral' | 'emerald' | 'amber' | 'red';
}) {
  const toneCls =
    tone === 'emerald'
      ? 'text-emerald-300'
      : tone === 'amber'
        ? 'text-amber-300'
        : tone === 'red'
          ? 'text-red-300'
          : 'text-white';
  return (
    <div className="rounded-2xl border border-white/10 bg-neutral-950/60 p-4 space-y-1">
      <div className="flex items-center gap-2 text-[13px] text-neutral-500 font-semibold uppercase tracking-wider">
        {icon}
        {label}
      </div>
      <div className={`text-[17px] font-bold font-mono ${toneCls}`}>{value}</div>
      {hint && <div className="text-[13px] text-neutral-500 leading-snug">{hint}</div>}
    </div>
  );
}

function WarningRow({ tone, text }: { tone: 'amber' | 'red'; text: string }) {
  return (
    <div
      className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-[13px] leading-relaxed ${
        tone === 'red'
          ? 'border-red-500/30 bg-red-500/10 text-red-200'
          : 'border-amber-500/30 bg-amber-500/10 text-amber-200'
      }`}
    >
      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
      <span>{text}</span>
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <label className="flex items-center gap-2 text-neutral-300">
      <span className="text-[13px] text-neutral-500 font-semibold uppercase tracking-wider">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-neutral-900 border border-white/10 rounded-lg px-3 py-2 text-[13px] text-neutral-200"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

function Chip({
  label,
  active,
  onClick,
  disabled,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`px-3 py-1.5 rounded-full text-[13px] font-semibold transition-colors border ${
        disabled
          ? 'opacity-40 cursor-not-allowed border-white/10 bg-white/5 text-neutral-500'
          : active
            ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
            : 'border-white/10 bg-neutral-950 text-neutral-400 hover:text-white'
      }`}
    >
      {label}
    </button>
  );
}

function SmallBtn({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-white/10 text-[13px] font-semibold text-neutral-200 flex items-center gap-1.5 transition-colors"
    >
      {children}
    </button>
  );
}

function SourceResultChip({ result }: { result: OsintSourceResult }) {
  const cls = result.ok
    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
    : result.skipped
      ? 'border-white/15 bg-white/5 text-neutral-400'
      : 'border-red-500/40 bg-red-500/10 text-red-200';
  return (
    <div
      title={result.error || `${result.itemCount} resultados · ${result.durationMs} ms`}
      className={`rounded-xl border px-3 py-2 text-[13px] font-semibold flex items-center gap-2 ${cls}`}
    >
      {result.ok ? (
        <Check className="w-3.5 h-3.5" />
      ) : result.skipped ? (
        <Pause className="w-3.5 h-3.5" />
      ) : (
        <AlertTriangle className="w-3.5 h-3.5" />
      )}
      {result.sourceName}
      <span className="font-mono font-normal opacity-80">
        {result.ok ? `${result.itemCount}` : result.skipped ? 'omitida' : 'error'} · {result.durationMs} ms
      </span>
    </div>
  );
}

function ResultCard({
  item,
  cluster,
  saved,
  onPreview,
  onSave,
}: {
  item: OsintItem;
  cluster?: OsintCluster;
  saved: boolean;
  onPreview: () => void;
  onSave: () => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-neutral-950/60 p-4 flex flex-col gap-3 hover:border-white/20 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <span className="text-[13px] font-mono text-neutral-500">{item.sourceName}</span>
        <span
          title={item.scoreFactors.join(' · ')}
          className="shrink-0 rounded-full border border-sky-500/40 bg-sky-500/10 px-2 py-0.5 text-[12px] font-mono font-bold text-sky-300"
        >
          {item.score}
        </span>
      </div>
      <button type="button" onClick={onPreview} className="text-left">
        <h4 className="text-[15px] font-semibold leading-snug text-white hover:text-emerald-300 transition-colors">
          {item.title}
        </h4>
      </button>
      {item.snippet && (
        <p className="text-[13px] text-neutral-400 leading-relaxed line-clamp-3">{item.snippet}</p>
      )}
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-neutral-500">
        {item.publishedAt && <span>Publicado {fmtDateTime(item.publishedAt)}</span>}
        {item.language && <span className="uppercase">{item.language}</span>}
        {item.country && (
          <span>
            {flagEmoji(item.country)} {countryName(item.country)}
          </span>
        )}
        {cluster && cluster.sourceIds.length > 1 && (
          <span className="text-sky-400">Agrupado con {cluster.itemCount} fuentes</span>
        )}
      </div>
      <div className="flex items-center gap-2 mt-auto pt-1">
        <SmallBtn onClick={onPreview}>
          <Search className="w-3.5 h-3.5" /> Ver
        </SmallBtn>
        {saved ? (
          <span className="flex items-center gap-1.5 text-[13px] text-emerald-300 font-semibold px-2">
            <BookmarkCheck className="w-4 h-4" /> Guardado
          </span>
        ) : (
          <SmallBtn onClick={onSave}>
            <Bookmark className="w-3.5 h-3.5" /> Guardar
          </SmallBtn>
        )}
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto p-2 text-neutral-500 hover:text-emerald-300 rounded-lg hover:bg-white/5"
          title="Abrir la fuente original"
        >
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>
    </div>
  );
}

function PreviewDrawer({
  item,
  cluster,
  saved,
  onClose,
  onImportPosts,
  onImportArticle,
  onSave,
}: {
  item: OsintItem;
  cluster?: OsintCluster;
  saved: boolean;
  onClose: () => void;
  onImportPosts: () => void;
  onImportArticle: () => void;
  onSave: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex justify-end" onClick={onClose}>
      <aside
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl h-full bg-neutral-950 border-l border-white/10 overflow-y-auto p-6 space-y-5"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[13px] font-mono uppercase tracking-widest text-neutral-500">
              Vista previa · {item.sourceName}
            </div>
            <h3 className="text-lg font-bold text-white mt-1 font-['Lexend'] leading-snug">{item.title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar vista previa"
            className="p-2 text-neutral-400 hover:text-white rounded-lg hover:bg-white/10 shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {item.snippet ? (
          <p className="text-sm text-neutral-300 leading-relaxed">{item.snippet}</p>
        ) : (
          <WarningRow
            tone="amber"
            text="La fuente sólo ofrece titular y enlace: no hay texto legalmente disponible a través de su API/feed. No se simula el artículo completo."
          />
        )}

        <div className="grid grid-cols-2 gap-3 text-[13px]">
          <Meta label="Fuente original" value={item.sourceName} />
          <Meta label="Autor" value={item.author || '—'} />
          <Meta label="Publicado" value={fmtDateTime(item.publishedAt)} />
          <Meta label="Detectado por BlackNews" value={fmtDateTime(item.detectedAt)} />
          <Meta label="Idioma" value={item.language?.toUpperCase() || '—'} />
          <Meta label="País (informado por la fuente)" value={item.country ? `${flagEmoji(item.country)} ${countryName(item.country)}` : '—'} />
          <Meta label="Puntuación editorial" value={`${item.score}/100`} />
          <Meta label="Tipo" value={item.sourceKind.toUpperCase()} />
        </div>

        <div className="rounded-xl border border-white/10 bg-neutral-900 p-4 space-y-1.5">
          <div className="text-[13px] font-bold uppercase tracking-wider text-neutral-400">
            Factores de la puntuación
          </div>
          <ul className="text-[13px] text-neutral-300 space-y-0.5">
            {item.scoreFactors.map((f) => (
              <li key={f}>· {f}</li>
            ))}
          </ul>
          <p className="text-[13px] text-neutral-500 pt-1">
            La puntuación orienta el orden editorial; no es prueba de veracidad, importancia objetiva ni exclusividad.
          </p>
        </div>

        {cluster && cluster.itemIds.length > 1 && (
          <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-4 space-y-1.5">
            <div className="text-[13px] font-bold uppercase tracking-wider text-sky-300">
              Mismo acontecimiento · {cluster.itemIds.length} publicaciones · {cluster.sourceIds.length} fuentes
            </div>
            <p className="text-[13px] text-neutral-300">
              Primer hallazgo {fmtDateTime(cluster.firstSeenAt)} · último {fmtDateTime(cluster.lastSeenAt)}.
              Cada fuente conserva su enlace original.
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-white/10 text-[14px] font-semibold text-neutral-200 flex items-center gap-2"
          >
            <ExternalLink className="w-4 h-4" /> Abrir fuente original
          </a>
          <button
            type="button"
            onClick={onImportPosts}
            className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-[14px] font-bold flex items-center gap-2"
          >
            <FileInput className="w-4 h-4" /> Importar al generador de posts
          </button>
          <button
            type="button"
            onClick={onImportArticle}
            className="px-4 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-white/10 text-[14px] font-semibold text-neutral-200 flex items-center gap-2"
          >
            <PencilLine className="w-4 h-4" /> Importar al redactor
          </button>
          {!saved && (
            <button
              type="button"
              onClick={onSave}
              className="px-4 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-white/10 text-[14px] font-semibold text-neutral-200 flex items-center gap-2"
            >
              <Bookmark className="w-4 h-4" /> Guardar para investigar
            </button>
          )}
        </div>

        <p className="text-[13px] text-neutral-500 leading-relaxed">
          Importar precompleta un borrador en la herramienta elegida; nada se publica automáticamente
          y todos los campos siguen siendo editables.
        </p>
      </aside>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-neutral-500 font-semibold uppercase tracking-wider">{label}</div>
      <div className="text-neutral-200 mt-0.5">{value}</div>
    </div>
  );
}

function SourceRow({
  source,
  onToggle,
  onLimit,
  onDelete,
}: {
  source: OsintSourceConfig & { runtime: OsintSourceRuntime };
  onToggle: () => void;
  onLimit: (v: string) => void;
  onDelete?: () => void;
}) {
  const pill = STATUS_PILL[source.runtime.status] || STATUS_PILL.active;
  const quota = source.runtime;
  return (
    <div className="rounded-2xl border border-white/10 bg-neutral-950/60 p-4 space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-semibold text-white">{source.name}</span>
            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider ${pill.cls}`}>
              {pill.label}
            </span>
            <span className="text-[12px] font-mono text-neutral-500 uppercase">{source.kind}</span>
            {source.custom && <span className="text-[12px] text-neutral-500">(personalizada)</span>}
          </div>
          <p className="text-[13px] text-neutral-400 mt-1 leading-relaxed">{source.description}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-neutral-500 mt-1">
            <span>
              Consultas: <span className="font-mono text-neutral-300">{source.runtime.requestsToday}</span> hoy ·{' '}
              <span className="font-mono text-neutral-300">{source.runtime.requestsTotal}</span> total
            </span>
            {source.runtime.lastOkAt && <span>Última OK {fmtDateTime(source.runtime.lastOkAt)}</span>}
            {source.runtime.lastQueryAt && <span>Última consulta {fmtDateTime(source.runtime.lastQueryAt)}</span>}
          </div>
          <div className="text-[13px] text-neutral-400 mt-1">
            <span className="text-neutral-500 font-semibold">Cuota: </span>
            <span>{QUOTA_LABEL[quota.quotaKind]}</span>
            {quota.quotaHeaderRemaining !== undefined && (
              <span className="font-mono text-neutral-200">
                {' '}
                · saldo {quota.quotaHeaderRemaining}
                {quota.quotaHeaderLimit !== undefined ? `/${quota.quotaHeaderLimit}` : ''}
              </span>
            )}
            {quota.quotaHeaderRemaining === undefined && (
              <span className="text-neutral-500"> · saldo restante desconocido</span>
            )}
            {source.quotaNote && <span className="text-neutral-500"> · {source.quotaNote}</span>}
            {source.internalDailyLimit ? (
              <span className="text-neutral-500">
                {' '}
                · límite interno {source.runtime.requestsToday}/{source.internalDailyLimit} (BlackNews)
              </span>
            ) : null}
          </div>
          {source.runtime.lastError && (
            <div className="text-[13px] text-red-300 mt-1">
              Último error ({fmtDateTime(source.runtime.lastErrorAt)}): {source.runtime.lastError}
            </div>
          )}
          {source.docs && (
            <a
              href={source.docs.split(' ')[0]}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[13px] text-emerald-400 hover:text-emerald-300 mt-1"
            >
              <Sparkles className="w-3.5 h-3.5" /> Documentación y condiciones
            </a>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onToggle}
            className={`px-3 py-1.5 rounded-lg text-[13px] font-semibold border transition-colors ${
              source.enabled
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                : 'border-white/15 bg-white/5 text-neutral-400 hover:text-white'
            }`}
          >
            {source.enabled ? 'Activa' : 'Desactivada'}
          </button>
          <label className="flex items-center gap-2 text-[13px] text-neutral-400">
            Límite interno/día
            <input
              type="number"
              min={0}
              max={100000}
              defaultValue={source.internalDailyLimit ?? 0}
              onBlur={(e) => onLimit(e.target.value)}
              className="w-20 bg-neutral-900 border border-white/10 rounded-lg px-2 py-1 text-[13px] font-mono text-neutral-200"
            />
          </label>
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="flex items-center gap-1.5 text-[13px] text-neutral-500 hover:text-red-300"
            >
              <Trash2 className="w-3.5 h-3.5" /> Eliminar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
