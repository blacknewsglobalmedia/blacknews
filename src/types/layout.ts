export type AutomationPreset = 'manual' | 'auto-latest' | 'auto-impact' | 'auto-diversity';

export interface FrontPageLayoutConfig {
  leadReportId: string;
  block1ReportIds: string[];
  block2ReportIds: string[];
  dossierReportId: string;
  automationPreset: AutomationPreset;
  lastUpdated: string;
  lastModifiedTimestamp?: number; // Timestamp in ms when admin last edited or saved the layout
  autoRefreshHours?: number; // Configured expiration time (e.g. 24 hours, 12 hours, 6 hours)
  autoRefreshPolicy?: AutomationPreset; // Algorithm to use when expiring ('auto-latest', 'auto-impact', 'auto-diversity')
  autoRefreshEnabled?: boolean; // Whether auto-rotation is active
}
