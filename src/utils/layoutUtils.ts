import { Report } from '../types/news';
import { FrontPageLayoutConfig, AutomationPreset } from '../types/layout';
import { CATEGORIES } from '../data/newsData';

export const DEFAULT_LAYOUT_CONFIG: FrontPageLayoutConfig = {
  leadReportId: 'rep-001',
  block1ReportIds: ['rep-002', 'rep-003'],
  block2ReportIds: ['rep-004', 'rep-005', 'rep-006'],
  dossierReportId: 'rep-007',
  automationPreset: 'manual',
  lastUpdated: '24 Sep 2026 · Edición Central',
  lastModifiedTimestamp: Date.now(),
  autoRefreshHours: 24,
  autoRefreshPolicy: 'auto-latest',
  autoRefreshEnabled: true,
};

/**
 * Toma hasta `size` despachos del pool que todavía no estén colocados.
 * Rellenaba los huecos con `|| lead` y, con menos de 6 informes, repetía
 * el mismo id en varios huecos → tarjetas duplicadas y claves duplicadas
 * en React. Si el pool se agota, el hueco queda vacío y la portada omite
 * ese bloque en vez de repetir posts.
 */
function takeIds(pool: Report[], size: number, used: Set<string>): string[] {
  const out: string[] = [];
  for (const report of pool) {
    if (out.length >= size) break;
    if (!report?.id || used.has(report.id)) continue;
    used.add(report.id);
    out.push(report.id);
  }
  return out;
}

export function computeLayoutPreset(
  preset: AutomationPreset,
  reports: Report[],
  prevConfig?: FrontPageLayoutConfig
): FrontPageLayoutConfig {
  if (reports.length === 0) return DEFAULT_LAYOUT_CONFIG;

  const now = new Date();
  const nowStr = `${now.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })} · Auto (${preset.replace('auto-', '')})`;
  const baseTimestamp = Date.now();
  const autoHours = prevConfig?.autoRefreshHours ?? 24;
  const autoPolicy = prevConfig?.autoRefreshPolicy ?? (preset === 'manual' ? 'auto-latest' : preset);
  const autoEnabled = prevConfig?.autoRefreshEnabled ?? true;

  if (preset === 'auto-latest') {
    // Top 7 most recent
    const used = new Set<string>();
    const lead = reports[0]?.id || 'rep-001';
    used.add(lead);
    const b1 = takeIds(reports, 2, used);
    const b2 = takeIds(reports, 3, used);
    const dossier = reports.find((r) => r.category === 'INVESTIGACIÓN')?.id || reports[reports.length - 1]?.id || lead;

    return {
      leadReportId: lead,
      block1ReportIds: b1,
      block2ReportIds: b2,
      dossierReportId: dossier,
      automationPreset: 'auto-latest',
      lastUpdated: nowStr,
      lastModifiedTimestamp: baseTimestamp,
      autoRefreshHours: autoHours,
      autoRefreshPolicy: autoPolicy,
      autoRefreshEnabled: autoEnabled,
    };
  }

  if (preset === 'auto-impact') {
    // Prioritize exclusive, trending or deep investigations
    const exclusiveOrTrending = reports.filter((r) => r.exclusive || r.trending);
    const pool = [...exclusiveOrTrending, ...reports];
    const uniquePool = Array.from(new Set(pool.map((r) => r.id))).map(
      (id) => pool.find((r) => r.id === id)!
    );

    const used = new Set<string>();
    const lead = uniquePool[0]?.id || reports[0].id;
    used.add(lead);
    const b1 = takeIds(uniquePool, 2, used);
    const b2 = takeIds(uniquePool, 3, used);
    const dossier = reports.find((r) => r.category === 'INVESTIGACIÓN')?.id || uniquePool[6]?.id || lead;

    return {
      leadReportId: lead,
      block1ReportIds: b1,
      block2ReportIds: b2,
      dossierReportId: dossier,
      automationPreset: 'auto-impact',
      lastUpdated: nowStr,
      lastModifiedTimestamp: baseTimestamp,
      autoRefreshHours: autoHours,
      autoRefreshPolicy: autoPolicy,
      autoRefreshEnabled: autoEnabled,
    };
  }

  if (preset === 'auto-diversity') {
    // Pick from distinct categories
    const categoriesWanted = CATEGORIES.filter((c) => c !== 'TODAS');

    const pickedIds: string[] = [];
    categoriesWanted.forEach((cat) => {
      const match = reports.find((r) => r.category === cat && !pickedIds.includes(r.id));
      if (match) pickedIds.push(match.id);
    });

    // Fill remaining if needed
    reports.forEach((r) => {
      if (pickedIds.length < 7 && !pickedIds.includes(r.id)) {
        pickedIds.push(r.id);
      }
    });

    const pool = pickedIds
      .map((id) => reports.find((r) => r.id === id))
      .filter((r): r is Report => Boolean(r));

    const used = new Set<string>();
    const lead = pool[0]?.id || reports[0].id;
    used.add(lead);
    const b1 = takeIds(pool, 2, used);
    const b2 = takeIds(pool, 3, used);
    const dossier = reports.find((r) => r.category === 'INVESTIGACIÓN')?.id || pickedIds[6] || lead;

    return {
      leadReportId: lead,
      block1ReportIds: b1,
      block2ReportIds: b2,
      dossierReportId: dossier,
      automationPreset: 'auto-diversity',
      lastUpdated: nowStr,
      lastModifiedTimestamp: baseTimestamp,
      autoRefreshHours: autoHours,
      autoRefreshPolicy: autoPolicy,
      autoRefreshEnabled: autoEnabled,
    };
  }

  return {
    ...DEFAULT_LAYOUT_CONFIG,
    lastModifiedTimestamp: baseTimestamp,
    autoRefreshHours: autoHours,
    autoRefreshPolicy: autoPolicy,
    autoRefreshEnabled: autoEnabled,
  };
}
