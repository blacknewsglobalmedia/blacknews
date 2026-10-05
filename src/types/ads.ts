import { CategoryId } from './news';

export type AdPlacement = 
  | 'TOP_BILLBOARD'       // Horizontal 970x250 o 728x90 (Portada superior)
  | 'IN_FEED_LEADERBOARD' // Horizontal 1200x180 o 800x120 (Entre bloques de portada)
  | 'ARTICLE_SIDEBAR'     // Vertical 300x600 o 300x250 (Barra lateral de lectura)
  | 'ARTICLE_FOOTER'      // Horizontal 728x90 (Al pie de artículos)
  | 'GRID_CARD';          // Vertical 4:5 integrado como card en la cuadrícula

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
   * Cómo dimensiona el front el contenedor del slot:
   * - 'fixed-height': ALTURA FIJA por breakpoint + ancho fluido (los
   *   contenedores horizontales). La creatividad se escala con
   *   `object-contain` y NUNCA se recorta; el sobrante en negro es
   *   invisible sobre el fondo AMOLED. Cero saltos de layout (CLS = 0).
   * - 'aspect': el contenedor se define por RELACIÓN DE ASPECTO (las
   *   cards verticales/cuadradas); la altura deriva del ancho.
   */
  sizing: 'fixed-height' | 'aspect';
  /** Clases Tailwind del contenedor: alturas del slot por breakpoint (sizing='fixed-height') */
  containerClass?: string;
  /** Relación de aspecto CSS del contenedor, ej. '4 / 5' (sizing='aspect') */
  aspect?: string;
  /** Ajuste de la creatividad dentro del contenedor */
  fit: 'contain' | 'cover';
  /** Tamaños nominales recomendados para exportar la creatividad (px) */
  exportSizes: string[];
}

export const AD_PLACEMENTS_INFO: Record<AdPlacement, AdPlacementInfo> = {
  TOP_BILLBOARD: {
    id: 'TOP_BILLBOARD',
    name: 'Top Billboard Portada',
    description: 'Ubicación de máximo impacto visual entre el teletipo y la noticia de apertura.',
    recommendedSize: '970 × 250 px / 728 × 90 px / 320 × 100 px',
    suggestedRate: '$1,800 USD / mes',
    orientation: 'horizontal',
    sizing: 'fixed-height',
    containerClass: 'h-[90px] sm:h-[120px] md:h-[160px]',
    fit: 'contain',
    exportSizes: ['970 × 250', '728 × 90', '320 × 100'],
  },
  IN_FEED_LEADERBOARD: {
    id: 'IN_FEED_LEADERBOARD',
    name: 'Leaderboard In-Feed',
    description: 'Banner horizontal de transición entre la Edición Visual y los cuadernos de redacción.',
    recommendedSize: '1200 × 180 px / 970 × 120 px / 728 × 90 px',
    suggestedRate: '$1,200 USD / mes',
    orientation: 'horizontal',
    sizing: 'fixed-height',
    containerClass: 'h-[72px] sm:h-[96px] md:h-[120px]',
    fit: 'contain',
    exportSizes: ['1200 × 180', '970 × 120', '728 × 90'],
  },
  ARTICLE_SIDEBAR: {
    id: 'ARTICLE_SIDEBAR',
    name: 'Rectangle In-Article',
    description: 'Banner dentro del cuerpo del artículo, tras la entradilla. Altura contenida para no interrumpir la lectura.',
    recommendedSize: '300 × 250 px / 300 × 600 px',
    suggestedRate: '$950 USD / mes',
    orientation: 'vertical',
    sizing: 'fixed-height',
    containerClass: 'h-[200px] sm:h-[250px]',
    fit: 'contain',
    exportSizes: ['300 × 250 (recomendado)', '300 × 600 (vertical, se muestra completo)'],
  },
  ARTICLE_FOOTER: {
    id: 'ARTICLE_FOOTER',
    name: 'Banner Pie de Artículo',
    description: 'Visible al concluir la lectura de despachos completos y antes de las claves ejecutivas.',
    recommendedSize: '728 × 90 px / 800 × 120 px',
    suggestedRate: '$650 USD / mes',
    orientation: 'horizontal',
    sizing: 'fixed-height',
    containerClass: 'h-[56px] sm:h-[72px] md:h-[90px]',
    fit: 'contain',
    exportSizes: ['728 × 90', '800 × 120'],
  },
  GRID_CARD: {
    id: 'GRID_CARD',
    name: 'Card Patrocinada 4:5',
    description: 'Tarjeta publicitaria integrada nativamente con la estética y proporción de los posts de noticias.',
    recommendedSize: 'Proporción 4:5 (800 × 1000 px)',
    suggestedRate: '$1,400 USD / mes',
    orientation: 'card',
    sizing: 'aspect',
    aspect: '4 / 5',
    fit: 'cover',
    exportSizes: ['800 × 1000 (4:5)'],
  },
};

// Initial institutional campaigns
export const INITIAL_AD_CAMPAIGNS: AdCampaign[] = [];

// IDs de las campañas de demostración: se depuran del almacenamiento local.
export const MOCK_AD_IDS = [
  'ad-zurich-capital',
  'ad-quantum-cluster',
  'ad-sovereignty-fund',
  'ad-global-arbitration',
];
