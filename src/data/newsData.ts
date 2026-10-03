import { Report, FlashNews } from '../types/news';

// Catálogo canónico de secciones: ÚNICA fuente de verdad para la navegación,
// el formulario de redacción, el generador de posts, el gestor de categorías
// y la portada. Cualquier lista de categorías debe derivar de aquí.
export const CATEGORIES = [
  'TODAS',
  'ECONOMÍA & MERCADOS',
  'GEOPOLÍTICA',
  'DEFENSA & SEGURIDAD',
  'TECNOLOGÍA & INNOVACIÓN',
  'DERECHO & PROPIEDAD',
  'ENERGÍA & INDUSTRIA',
  'INVESTIGACIÓN',
  'EDITORIAL',
] as const;

// Qué abarca cada sección: se muestra en el gestor de categorías y junto
// al selector del formulario de redacción para que nunca haya dudas.
export const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  TODAS: 'Portada completa con todos los despachos.',
  'ECONOMÍA & MERCADOS': 'Mercados, finanzas, monedas y política monetaria.',
  'GEOPOLÍTICA': 'Diplomacia, relaciones internacionales y panorama mundial.',
  'DEFENSA & SEGURIDAD': 'Defensa, fuerzas armadas, ciberseguridad e inteligencia.',
  'TECNOLOGÍA & INNOVACIÓN': 'Inteligencia artificial, digitalización y ciencia aplicada.',
  'DERECHO & PROPIEDAD': 'Legislación, tribunales, contratos y garantías individuales.',
  'ENERGÍA & INDUSTRIA': 'Energía, materias primas, infraestructura y producción.',
  'INVESTIGACIÓN': 'Reportajes de fondo y análisis extensos (antes «Dossiers»).',
  'EDITORIAL': 'Columnas de opinión y posiciones del medio.',
};

// Renombres de la taxonomía antigua: se aplican a los datos persistidos
// en cada navegador al cargar, para migrar sin perder contenido real.
export const OLD_CATEGORY_ALIASES: Record<string, string> = {
  DOSSIERS: 'INVESTIGACIÓN',
};

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
