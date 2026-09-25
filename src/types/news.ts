export type CategoryId = 
  | 'TODAS'
  | 'ECONOMÍA & MERCADOS'
  | 'GEOPOLÍTICA'
  | 'TECNOLOGÍA & INNOVACIÓN'
  | 'DERECHO & PROPIEDAD'
  | 'ENERGÍA & INDUSTRIA'
  | 'DOSSIERS';

export interface Author {
  name: string;
  bureau: string;
  role: string;
  email?: string;
  id?: string;
}

export interface ReportSection {
  type: 'paragraph' | 'heading' | 'quote' | 'stat' | 'highlight';
  text?: string;
  cite?: string;
  value?: string;
  label?: string;
}

export interface OptimizedImageVariant {
  width: number;
  height: number;
  format: 'avif' | 'webp' | 'jpeg';
  url: string;
  sizeBytes: number;
  filename: string;
}

export interface OptimizedImageSet {
  slug: string;
  originalName: string;
  originalSize?: number;
  width: number;
  height: number;
  aspectRatio?: number;
  blurDataUrl?: string;
  variants?: OptimizedImageVariant[];
  srcsetAvif: string;
  srcsetWebp: string;
  srcsetJpeg: string;
  fallbackUrl: string;
  pictureSnippet?: string;
  totalSavingsPercent?: number;
  storage?: 'cloudflare-r2' | 'local-edge';
}

export interface Report {
  id: string;
  title: string;
  subtitle: string;
  category: CategoryId;
  author: Author;
  authorEmail?: string;
  authorId?: string;
  publishedAt: string;
  readTime: string;
  image: string;
  optimizedImage?: OptimizedImageSet;
  imageCaption: string;
  lead: string;
  sections: ReportSection[];
  keyTakeaways: string[];
  tags: string[];
  trending?: boolean;
  exclusive?: boolean;
}

export interface FlashNews {
  id: string;
  time: string;
  category: CategoryId;
  title: string;
  reportId?: string;
}
