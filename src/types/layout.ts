export type AutomationPreset = 'manual' | 'auto-latest' | 'auto-impact' | 'auto-diversity';

/**
 * Parte «Intelligence»: análisis reservado publicado en portada. Lo escribe
 * la redacción desde el estudio (Portada · Análisis reservado); los no
 * socios lo ven difuminado con llamada a la acción de suscripción.
 * Sin configurar ⇒ la sección no aparece (no hay contenido de relleno).
 */
export interface IntelligenceBrief {
  title: string;
  /** Claves del parte, una por línea. */
  bullets: string[];
  /** Fecha de publicación en pantalla (p. ej. "12 OCT 2026"). */
  publishedAt: string;
}

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
  /** Parte Intelligence (contenido de pago); opcional. */
  intelligence?: IntelligenceBrief;
}
