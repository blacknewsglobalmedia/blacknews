import { Report } from '../types/news';
import { FrontPageLayoutConfig, AutomationPreset } from '../types/layout';

export const DEFAULT_LAYOUT_CONFIG: FrontPageLayoutConfig = {
  leadReportId: 'rep-001',
  block1ReportIds: ['rep-002', 'rep-003'],
  block2ReportIds: ['rep-004', 'rep-005', 'rep-006'],
  dossierReportId: 'rep-007',
  automationPreset: 'manual',
  lastUpdated: '24 Sep 2026 · Edición Central',
};

export function computeLayoutPreset(
  preset: AutomationPreset,
  reports: Report[]
): FrontPageLayoutConfig {
  if (reports.length === 0) return DEFAULT_LAYOUT_CONFIG;

  const nowStr = `24 Sep 2026 · Auto (${preset.replace('auto-', '')})`;

  if (preset === 'auto-latest') {
    // Top 7 most recent
    const lead = reports[0]?.id || 'rep-001';
    const b1_1 = reports[1]?.id || lead;
    const b1_2 = reports[2]?.id || lead;
    const b2_1 = reports[3]?.id || lead;
    const b2_2 = reports[4]?.id || lead;
    const b2_3 = reports[5]?.id || lead;
    const dossier = reports.find((r) => r.category === 'DOSSIERS')?.id || reports[reports.length - 1]?.id || lead;

    return {
      leadReportId: lead,
      block1ReportIds: [b1_1, b1_2],
      block2ReportIds: [b2_1, b2_2, b2_3],
      dossierReportId: dossier,
      automationPreset: 'auto-latest',
      lastUpdated: nowStr,
    };
  }

  if (preset === 'auto-impact') {
    // Prioritize exclusive, trending or deep investigations
    const exclusiveOrTrending = reports.filter((r) => r.exclusive || r.trending);
    const pool = [...exclusiveOrTrending, ...reports];
    const uniquePool = Array.from(new Set(pool.map((r) => r.id))).map(
      (id) => pool.find((r) => r.id === id)!
    );

    const lead = uniquePool[0]?.id || reports[0].id;
    const b1_1 = uniquePool[1]?.id || reports[1]?.id || lead;
    const b1_2 = uniquePool[2]?.id || reports[2]?.id || lead;
    const b2_1 = uniquePool[3]?.id || reports[3]?.id || lead;
    const b2_2 = uniquePool[4]?.id || reports[4]?.id || lead;
    const b2_3 = uniquePool[5]?.id || reports[5]?.id || lead;
    const dossier = reports.find((r) => r.category === 'DOSSIERS')?.id || uniquePool[6]?.id || lead;

    return {
      leadReportId: lead,
      block1ReportIds: [b1_1, b1_2],
      block2ReportIds: [b2_1, b2_2, b2_3],
      dossierReportId: dossier,
      automationPreset: 'auto-impact',
      lastUpdated: nowStr,
    };
  }

  if (preset === 'auto-diversity') {
    // Pick from distinct categories
    const categoriesWanted = [
      'ECONOMÍA & MERCADOS',
      'GEOPOLÍTICA',
      'TECNOLOGÍA & INNOVACIÓN',
      'DERECHO & PROPIEDAD',
      'ENERGÍA & INDUSTRIA',
      'DOSSIERS',
    ];

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

    const lead = pickedIds[0] || reports[0].id;
    const b1_1 = pickedIds[1] || reports[1]?.id || lead;
    const b1_2 = pickedIds[2] || reports[2]?.id || lead;
    const b2_1 = pickedIds[3] || reports[3]?.id || lead;
    const b2_2 = pickedIds[4] || reports[4]?.id || lead;
    const b2_3 = pickedIds[5] || reports[5]?.id || lead;
    const dossier = reports.find((r) => r.category === 'DOSSIERS')?.id || pickedIds[6] || lead;

    return {
      leadReportId: lead,
      block1ReportIds: [b1_1, b1_2],
      block2ReportIds: [b2_1, b2_2, b2_3],
      dossierReportId: dossier,
      automationPreset: 'auto-diversity',
      lastUpdated: nowStr,
    };
  }

  return DEFAULT_LAYOUT_CONFIG;
}
