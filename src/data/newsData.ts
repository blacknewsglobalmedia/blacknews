import { Report, FlashNews } from '../types/news';

export const CATEGORIES = [
  'TODAS',
  'ECONOMÍA & MERCADOS',
  'GEOPOLÍTICA',
  'TECNOLOGÍA & INNOVACIÓN',
  'DERECHO & PROPIEDAD',
  'ENERGÍA & INDUSTRIA',
  'DOSSIERS',
] as const;

export const FLASH_NEWS: FlashNews[] = [];

// IDs de las alertas de demostración: se depuran del almacenamiento local.
export const MOCK_FLASH_IDS = ['flash-1', 'flash-2', 'flash-3', 'flash-4', 'flash-5'];

export const REPORTS: Report[] = [];

// IDs de los antiguos artículos de demostración: se depuran del almacenamiento local
// para que ninguna navegación conserve los posts de muestra.
export const MOCK_REPORT_IDS = [
  'rep-geoeconomia-reservas',
  'rep-soberania-algoritmica',
  'rep-derecho-propiedad',
  'rep-megainfraestructura-oceanica',
  'rep-pacto-ginebra',
  'rep-minerales-criticos',
];
