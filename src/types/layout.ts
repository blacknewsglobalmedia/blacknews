export type AutomationPreset = 'manual' | 'auto-latest' | 'auto-impact' | 'auto-diversity';

export interface FrontPageLayoutConfig {
  leadReportId: string;
  block1ReportIds: string[];
  block2ReportIds: string[];
  dossierReportId: string;
  automationPreset: AutomationPreset;
  lastUpdated: string;
}
