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
