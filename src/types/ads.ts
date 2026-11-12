import { CategoryId } from './news';

export type AdPlacement = 
  | 'TOP_BILLBOARD'       // Horizontal 970x250 o 728x90 (Portada superior)
  | 'IN_FEED_LEADERBOARD' // Horizontal 1200x180 o 800x120 (Entre bloques de portada)
  | 'ARTICLE_SIDEBAR'     // Rectangle 300x250 dentro del cuerpo del artículo
  | 'IN_ARTICLE_PARAGRAPHS' // Horizontal 728x90 cada N párrafos del cuerpo
  | 'ARTICLE_FOOTER'      // Horizontal 728x90 (Al pie de artículos)
  | 'GRID_CARD';          // Vertical 4:5 integrado como card en la cuadrícula

/** Cuerpo cada cuántos párrafos entra el banner in-article (misma cifra en
 *  la maqueta del paso «Dónde» y en la inserción del artículo). */
export const IN_ARTICLE_AD_EVERY = 8;

export type AdStatus = 
  | 'ACTIVE' 
  | 'PAUSED' 
  | 'SCHEDULED' 
  | 'EXPIRED' 
  | 'PENDIENTE_PAGO' 
  | 'PENDIENTE_APROBACION' 
  | 'RECHAZADA';

export type AdPricingModel = 'FIXED_PERIOD' | 'CPM' | 'CPC';

export type AdPaymentMethod = 'PAYPAL' | 'MERCADO_PAGO' | 'BANK_TRANSFER' | 'STRIPE';

export interface AdCampaign {
  id: string;
  title: string;
  advertiser: string;
  advertiserUrl: string;
  placement: AdPlacement;
  imageUrl: string;
  imageAlt?: string;
  badgeText?: string;
  targetCategory?: CategoryId | 'TODAS';
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  status: AdStatus;
  price: number;
  currency: 'USD' | 'UYU' | 'CHF' | 'EUR';
  pricingModel: AdPricingModel;
  impressions: number;
  clicks: number;
  createdAt: string;
  notes?: string;
  // Self-service & Approval fields
  applicantEmail?: string;
  applicantName?: string;
  paymentMethod?: AdPaymentMethod;
  paymentReceiptUrl?: string;
  rejectionReason?: string;
  targetImpressionsBudget?: number;
}

export interface AdPricingPlan {
  id: string;
  name: string;
  description: string;
  pricingModel: AdPricingModel;
  durationDays?: number;
  targetImpressions?: number;
  priceUyu: number;
  priceUsd: number;
  badge: string;
}

export const AD_PRICING_PLANS: AdPricingPlan[] = [
  {
    id: 'plan-flash-7d',
    name: 'Plan Rápido (7 Días)',
    description: '7 días de visibilidad continua. Ideal para eventos, lanzamientos y promociones PyME.',
    pricingModel: 'FIXED_PERIOD',
    durationDays: 7,
    priceUyu: 650,
    priceUsd: 15,
    badge: 'ACCESIBLE',
  },
  {
    id: 'plan-fortnight-15d',
    name: 'Plan Quincenal (15 Días)',
    description: '15 días de presencia destacada en la portada y artículos.',
    pricingModel: 'FIXED_PERIOD',
    durationDays: 15,
    priceUyu: 1200,
    priceUsd: 28,
    badge: 'POPULAR',
  },
  {
    id: 'plan-monthly-30d',
    name: 'Plan Mensual (30 Días)',
    description: '30 días de exposición máxima continua en todas las ubicaciones principales.',
    pricingModel: 'FIXED_PERIOD',
    durationDays: 30,
    priceUyu: 2100,
    priceUsd: 49,
    badge: 'RECOMENDADO',
  },
  {
    id: 'plan-cpm-10k',
    name: '10.000 Impresiones Garantizadas',
    description: 'Exhibición hasta alcanzar 10.000 vistas reales medidas en la plataforma.',
    pricingModel: 'CPM',
    targetImpressions: 10000,
    priceUyu: 500,
    priceUsd: 12,
    badge: 'MEDICIÓN REAL',
  },
  {
    id: 'plan-cpm-50k',
    name: '50.000 Impresiones Garantizadas',
    description: 'Exhibición extendida hasta alcanzar 50.000 vistas garantizadas.',
    pricingModel: 'CPM',
    targetImpressions: 50000,
    priceUyu: 1900,
    priceUsd: 45,
    badge: 'ALTO ALCANCE',
  },
];

export interface AdPlacementInfo {
  id: AdPlacement;
  name: string;
  description: string;
  recommendedSize: string;
  suggestedRate: string;
  orientation: 'horizontal' | 'vertical' | 'card';
  /**
   * Clases Tailwind del contenedor: TOPE DE ANCHO del hueco en px
   * (`max-w-[…]`), igual al ancho nominal de exportación. El hueco nunca
   * se pinta por encima del tamaño de la creatividad (sin escalados hacia
   * arriba) y la vista previa del asistente aplica el mismo tope. Sin
   * tope, un vertical como ARTICLE_SIDEBAR mediría ~700 px de alto en la
   * columna del artículo. Por debajo del tope el ancho es el de la
   * columna y la altura sigue la proporción (`ratio`).
   */
  containerClass?: string;
  /** Tamaños nominales recomendados para exportar la creatividad (px) */
  exportSizes: string[];
  /**
   * Relación de aspecto de la creatividad nominal (anchura / altura) Y
   * del contenedor del slot: el hueco se dibuja con la proporción del
   * tamaño recomendado, así una creatividad bien exportada lo llena al
   * 100% y la vista previa del asistente — que usa este mismo dato —
   * replica el slot real por construcción. Fuera de proporción se
   * recorta por el centro (`object-cover`). Formato CSS, ej. '970 / 250'.
   */
  ratio: string;
  /** Vistas diarias ESTIMADAS de la ubicación (tabla editorial ajustable,
   *  no analítica en vivo): base para proyectar el alcance de un plan. */
  estimatedDailyViews: number;
}

export const AD_PLACEMENTS_INFO: Record<AdPlacement, AdPlacementInfo> = {
  TOP_BILLBOARD: {
    id: 'TOP_BILLBOARD',
    name: 'Top Billboard Portada',
    description: 'Ubicación de máximo impacto visual entre el teletipo y la noticia de apertura.',
    recommendedSize: '970 × 250 px / 728 × 90 px / 320 × 100 px',
    suggestedRate: '$1,800 USD / mes',
    orientation: 'horizontal',
    containerClass: 'max-w-[970px]',
    exportSizes: ['970 × 250', '728 × 90', '320 × 100'],
    ratio: '970 / 250',
    estimatedDailyViews: 1200,
  },
  IN_FEED_LEADERBOARD: {
    id: 'IN_FEED_LEADERBOARD',
    name: 'Leaderboard In-Feed',
    description: 'Banner horizontal de transición entre la Edición Visual y los cuadernos de redacción.',
    recommendedSize: '1200 × 180 px / 970 × 120 px / 728 × 90 px',
    suggestedRate: '$1,200 USD / mes',
    orientation: 'horizontal',
    containerClass: 'max-w-[1200px]',
    exportSizes: ['1200 × 180', '970 × 120', '728 × 90'],
    ratio: '1200 / 180',
    estimatedDailyViews: 900,
  },
  ARTICLE_SIDEBAR: {
    id: 'ARTICLE_SIDEBAR',
    name: 'Rectangle In-Article',
    description:
      'Rectangle dentro del cuerpo del artículo, tras las claves del informe. Altura contenida para no interrumpir la lectura.',
    recommendedSize: '300 × 250 px / 300 × 600 px',
    suggestedRate: '$950 USD / mes',
    orientation: 'vertical',
    containerClass: 'max-w-[300px]',
    exportSizes: ['300 × 250 (recomendado)', '300 × 600 (vertical, se recorta a los lados)'],
    ratio: '300 / 250',
    estimatedDailyViews: 500,
  },
  IN_ARTICLE_PARAGRAPHS: {
    id: 'IN_ARTICLE_PARAGRAPHS',
    name: `In-Article cada ${IN_ARTICLE_AD_EVERY} párrafos`,
    description: `Banner horizontal dentro del cuerpo del artículo que reaparece tras cada ${IN_ARTICLE_AD_EVERY} párrafos: presencia repetida en lecturas largas.`,
    recommendedSize: '728 × 90 px / 800 × 120 px',
    suggestedRate: '$850 USD / mes',
    orientation: 'horizontal',
    containerClass: 'max-w-[728px]',
    exportSizes: ['728 × 90', '800 × 120'],
    ratio: '728 / 90',
    estimatedDailyViews: 650,
  },
  ARTICLE_FOOTER: {
    id: 'ARTICLE_FOOTER',
    name: 'Banner Pie de Artículo',
    description:
      'Visible al concluir la lectura de despachos completos, tras los subrayados del lector.',
    recommendedSize: '728 × 90 px / 800 × 120 px',
    suggestedRate: '$650 USD / mes',
    orientation: 'horizontal',
    containerClass: 'max-w-[728px]',
    exportSizes: ['728 × 90', '800 × 120'],
    ratio: '728 / 90',
    estimatedDailyViews: 600,
  },
  GRID_CARD: {
    id: 'GRID_CARD',
    name: 'Card Patrocinada 4:5',
    description: 'Tarjeta publicitaria integrada nativamente con la estética y proporción de los posts de noticias.',
    recommendedSize: 'Proporción 4:5 (800 × 1000 px)',
    suggestedRate: '$1,400 USD / mes',
    orientation: 'card',
    // Tope = ancho de la columna real de la parrilla «Edición Visual»
    // (max-w-7xl + lg:grid-cols-3 gap-8 ≈ 389 px): en el sitio no llega
    // a aplicarse y la vista previa replica el ancho del slot real.
    containerClass: 'max-w-[390px]',
    exportSizes: ['800 × 1000 (4:5)'],
    ratio: '4 / 5',
    estimatedDailyViews: 400,
  },
};

/** Impresiones (vistas) estimadas de un plan en una ubicación: los planes
 *  CPM traen su garantía; los de periodo se proyectan con las vistas
 *  diarias de la ubicación. Siempre «estimado», nunca promesa. */
export function estimateCampaignViews(
  info: Pick<AdPlacementInfo, 'estimatedDailyViews'>,
  plan: Pick<AdPricingPlan, 'durationDays' | 'targetImpressions'>,
): number {
  if (plan.targetImpressions) return plan.targetImpressions;
  return (plan.durationDays || 30) * info.estimatedDailyViews;
}

/** Miles con punto: 1200 → «1.200», 36000 → «36.000». */
export const formatAdViews = (views: number): string =>
  new Intl.NumberFormat('es-UY').format(Math.round(views));

// Initial institutional campaigns
export const INITIAL_AD_CAMPAIGNS: AdCampaign[] = [];

// IDs de las campañas de demostración: se depuran del almacenamiento local.
export const MOCK_AD_IDS = [
  'ad-zurich-capital',
  'ad-quantum-cluster',
  'ad-sovereignty-fund',
  'ad-global-arbitration',
];
