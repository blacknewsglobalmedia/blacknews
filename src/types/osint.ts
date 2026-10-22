/**
 * BLACKNEWS — Módulo OSINT (Centro de Investigación).
 *
 * Contrato de datos compartido entre el Worker (`worker/osint/`) y la
 * interfaz del panel (`src/components/OsintCenter.tsx`). Sólo tipos y
 * constantes puras: no importa nada del navegador ni de React, para que
 * el Worker pueda importarlo sin arrastrar dependencias.
 *
 * Reglas del módulo:
 * - Nunca se exponen claves al navegador: todo se consulta en el Worker.
 * - Las cuotas se distinguen en 4 categorías (oficial / cabeceras /
 *   internas / desconocido) y JAMÁS se presentan contadores internos
 *   como cuotas oficiales del proveedor.
 * - Los errores de una fuente no bloquean las demás (resultados parciales).
 */

export type OsintSourceKind = 'gdelt' | 'rss' | 'rss-category' | 'openalex' | 'wikidata' | 'tavily';

export type OsintSourceStatus =
  | 'active'
  | 'disabled'
  | 'pending_setup'
  | 'rate_limited'
  | 'error';

/** De qué tipo de dato disponemos sobre el límite de una fuente. */
export type OsintQuotaKind =
  /** Cuota documentada oficialmente por el proveedor. */
  | 'official'
  /** Cuota leída de las cabeceras devueltas por la API (x-ratelimit-*). */
  | 'headers'
  /** Sólo contadores internos de BlackNews (NO es cuota del proveedor). */
  | 'internal'
  /** Límite desconocido o no verificable. */
  | 'unknown';

export type OsintPeriod = '6h' | '24h' | '7d' | 'custom';

/** Configuración persistida de una fuente (built-in o personalizada). */
export interface OsintSourceConfig {
  id: string;
  name: string;
  kind: OsintSourceKind;
  enabled: boolean;
  /** Endpoint o feed autorizado (RSS personalizado). */
  url?: string;
  /** Documentación oficial / condiciones de uso. */
  docs?: string;
  description: string;
  /** Categorías cubiertas; '*' = todas. */
  categories: string[];
  /** ISO 639-1; '*' = todos. */
  languages: string[];
  /** ISO 3166-1 alpha-2; '*' = global. */
  regions: string[];
  authMethod: 'none' | 'secret';
  /** NOMBRE de la variable de secretos en el Worker. Jamás el valor. */
  secretVar?: string;
  /** Cuota publicada por el proveedor (texto literal de su documentación). */
  quotaNote?: string;
  /**
   * Qué sabemos del límite por DOCUMENTACIÓN del proveedor (se muestra junto
   * a la nota). Si cambia a 'headers' en runtime es porque la API lo informó.
   * Sin este dato la UI usa 'internal'/'unknown': nunca se inventa cuota.
   */
  quotaKind?: OsintQuotaKind;
  /** Límite interno configurable por el administrador (por día). */
  internalDailyLimit?: number;
  /** ¿Fuente añadida por el administrador (no built-in)? */
  custom?: boolean;
  /** Clave de la categoría temática (sólo kind 'rss-category'; connectors.ts). */
  categoryKey?: string;
}

/** Estado de consumo/errores de una fuente (persistido en KV). */
export interface OsintSourceRuntime {
  id: string;
  status: OsintSourceStatus;
  lastQueryAt?: string;
  lastOkAt?: string;
  lastError?: string;
  lastErrorAt?: string;
  lastLimitAt?: string;
  requestsTotal: number;
  requestsToday: number;
  requestsThisMonth: number;
  /** Próxima ventana de restablecimiento conocida (contadores internos). */
  periodResetsAt?: string;
  quotaKind: OsintQuotaKind;
  /** Sólo cuando la API lo informa explícitamente en sus cabeceras. */
  quotaHeaderRemaining?: number;
  quotaHeaderLimit?: number;
  /** Texto de la cuota oficial documentada, si existe. */
  quotaOfficialNote?: string;
  /** Cortacircuito: hasta cuándo se salta la fuente. */
  blockedUntil?: string;
}

/** Resultado crudo de un conector (antes de normalizar). */
export interface OsintRawItem {
  title: string;
  url: string;
  snippet?: string;
  author?: string;
  /** ISO 8601 de publicación ORIGINAL de la fuente. */
  publishedAt?: string;
  language?: string;
  /** ISO 3166-1 alpha-2 si la fuente lo informa. */
  country?: string;
  imageUrl?: string;
}

/** Resultado normalizado de una búsqueda OSINT. */
export interface OsintItem {
  id: string;
  sourceId: string;
  sourceKind: OsintSourceKind;
  sourceName: string;
  /** Titular original de la fuente (sin inventar ni reescribir). */
  title: string;
  url: string;
  /** URL normalizada (sin trackers) para detección de duplicados. */
  canonicalUrl: string;
  /** Fragmento ORIGINAL devuelto por la API/feed. Nada generado. */
  snippet?: string;
  author?: string;
  /** Publicación original (difere de detectedAt cuando la hay). */
  publishedAt?: string;
  /** Cuándo lo detectó BlackNews. */
  detectedAt: string;
  language?: string;
  country?: string;
  imageUrl?: string;
  /** Agrupación de acontecimiento (duplicados). */
  clusterId: string;
  score: number;
  /** Factores que explican la puntuación (no es prueba de veracidad). */
  scoreFactors: string[];
  /**
   * Relleno al importar con traducción automática: el texto original de la
   * fuente se conserva aquí mientras title/snippet llevan la traducción.
   */
  originalTitle?: string;
  machineTranslated?: boolean;
}

export interface OsintCluster {
  id: string;
  /** Titular del artículo más reciente del grupo. */
  title: string;
  itemCount: number;
  sourceIds: string[];
  itemIds: string[];
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface OsintSearchRequest {
  query: string;
  /** Ids de fuentes a consultar; vacío = todas las activas. */
  sources?: string[];
  languages?: string[];
  countries?: string[];
  categories?: string[];
  period: OsintPeriod;
  customFrom?: string;
  customTo?: string;
  maxPerSource?: number;
  /** Excluir los ids ya guardados (pasados por el cliente). */
  excludeIds?: string[];
  sort?: 'date' | 'relevance' | 'score';
}

/** Resultado por fuente: éxito o error SIN bloquear a las demás. */
export interface OsintSourceResult {
  sourceId: string;
  sourceName: string;
  ok: boolean;
  itemCount: number;
  /** Mensaje legible para el administrador (jamás secretos). */
  error?: string;
  durationMs: number;
  skipped?: boolean;
  quota: {
    kind: OsintQuotaKind;
    remaining?: number;
    limit?: number;
    note?: string;
  };
}

export interface OsintSearchResponse {
  items: OsintItem[];
  clusters: OsintCluster[];
  results: OsintSourceResult[];
  took: number;
  newCount: number;
  duplicateCount: number;
}

export interface OsintStatusResponse {
  /** El backend pudo verificar la administración (no dice si el token era válido). */
  sources: Array<OsintSourceConfig & { runtime: OsintSourceRuntime }>;
  lastSearchAt?: string;
  totals: { requestsTotal: number; requestsToday: number };
  /** Advertencias: límites, servicios caídos, fuentes sin configurar. */
  warnings: string[];
}

/** Estados configurables de una investigación guardada (cliente). */
export type OsintSavedState =
  | 'new'
  | 'to_verify'
  | 'researching'
  | 'ready_to_write'
  | 'imported_posts'
  | 'imported_article'
  | 'discarded';

export const OSINT_SAVED_STATES: Array<{ id: OsintSavedState; label: string }> = [
  { id: 'new', label: 'Nuevo hallazgo' },
  { id: 'to_verify', label: 'Pendiente de verificar' },
  { id: 'researching', label: 'En investigación' },
  { id: 'ready_to_write', label: 'Listo para redactar' },
  { id: 'imported_posts', label: 'Importado al generador' },
  { id: 'imported_article', label: 'Importado al redactor' },
  { id: 'discarded', label: 'Descartado' },
];

export interface OsintSavedItem {
  item: OsintItem;
  state: OsintSavedState;
  notes: string;
  savedAt: string;
  updatedAt: string;
}

/** Categorías del buscador: las del sitio + las del spec editorial. */
export const OSINT_CATEGORIES: string[] = [
  'POLÍTICA',
  'ECONOMÍA & MERCADOS',
  'GEOPOLÍTICA',
  'DEFENSA & EJÉRCITO',
  'SEGURIDAD',
  'CRIMEN ORGANIZADO',
  'CIENCIA',
  'TECNOLOGÍA',
  'EMPRESAS',
  'ENERGÍA & CLIMA',
];

export const OSINT_LANGUAGES: Array<{ code: string; label: string }> = [
  { code: 'en', label: 'Inglés' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Francés' },
  { code: 'de', label: 'Alemán' },
  { code: 'pt', label: 'Portugués' },
  { code: 'ar', label: 'Árabe' },
  { code: 'ru', label: 'Ruso' },
  { code: 'zh', label: 'Chino' },
];

/** Importación al generador de posts (prellenado, nunca publica solo). */
export interface OsintPostImport {
  title: string;
  description: string;
  /** Sólo si el hallazgo trae una categoría reconocible; si no, el editor elige. */
  category?: string;
  countries: Array<{ name: string; code: string; flag: string }>;
  sourceName: string;
  sourceUrl: string;
  imageUrl?: string;
  publishedAt?: string;
  /** Traducción automática aplicada al importar (IA del proyecto). */
  machineTranslated?: boolean;
  /** Texto ORIGINAL de la fuente, conservado junto a la traducción. */
  originalTitle?: string;
  originalSnippet?: string;
}
