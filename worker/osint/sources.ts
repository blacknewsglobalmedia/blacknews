/**
 * BLACKNEWS OSINT — Fuentes built-in.
 *
 * Sólo conectores SIN clave (o con el secreto TAVILY_API_KEY que el proyecto
 * ya usa). Cada una documenta qué ofrece y sus límites reales; lo que no
 * esté documentado queda como 'unknown' (nunca se inventan cuotas).
 *
 * - GDELT DOC 2.0: agregador global de medios, sin clave, con límite de
 *   frecuencia publicado (máx. ~1 consulta/15 s recomendada, maxrecords
 *   acotado). Documentación: https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/
 * - RSS público: medios y organismos oficiales; sin cuota documentada.
 * - OpenAlex: catálogo académico abierto; cuota generosa documentada
 *   (100k req/día en "polite pool" con mailto). https://openalex.org/
 * - Wikidata SPARQL: consulta estructurada; requiere User-Agent identificativo
 *   y puede limitar por tasa. https://www.wikidata.org/wiki/Wikidata:SPARQL_query_service
 * - Tavily: búsqueda web con IA; reutiliza el secreto TAVILY_API_KEY ya
 *   presente en el proyecto (se usa hoy en worker/ai.ts).
 */
import type { OsintSourceConfig } from '../../src/types/osint';

export const BUILTIN_SOURCES: OsintSourceConfig[] = [
  {
    id: 'gdelt',
    name: 'GDELT DOC 2.0',
    kind: 'gdelt',
    enabled: true,
    url: 'https://api.gdeltproject.org/api/v2/doc/doc',
    docs: 'https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/',
    description:
      'Agregador global de cobertura informativa (24h de ventanas, traducciones y artlist). Descubrimiento y monitoreo internacional.',
    categories: ['*'],
    languages: ['en', 'es', 'fr', 'de', 'pt', 'ar', 'ru', 'zh'],
    regions: ['*'],
    authMethod: 'none',
    quotaNote:
      'GDELT recomienda no superar ~1 consulta cada 15 segundos por cliente y acota maxrecords (limit 250). No publica "cuota diaria".',
    quotaKind: 'official',
    internalDailyLimit: 300,
  },
  {
    id: 'rss-world',
    name: 'RSS · Medios y organismos (built-in)',
    kind: 'rss',
    enabled: true,
    // Cada feed built-in se declara en connectors/rss.ts con su URL oficial.
    docs: 'https://www.bbc.co.uk/feeds/rss | https://rss.dw.com/rdf/rss-en-all | https://www.france24.com/en/rss | https://news.un.org/feed/',
    description:
      'Feeds RSS públicos de medios y organismos oficiales seleccionados (BBC Mundo/World, DW, France 24, ONU News). Se pueden añadir feeds propios desde la pestaña de fuentes.',
    categories: ['*'],
    languages: ['en', 'es', 'fr', 'de'],
    regions: ['*'],
    authMethod: 'none',
    quotaNote: 'Feeds públicos sin cuota documentada; el límite interno evita refrescos abusivos.',
    quotaKind: 'internal',
    internalDailyLimit: 120,
  },
  {
    id: 'openalex',
    name: 'OpenAlex (investigación académica)',
    kind: 'openalex',
    enabled: false,
    url: 'https://api.openalex.org/works',
    docs: 'https://docs.openalex.org/',
    description:
      'Catálogo abierto de publicaciones académicas: artículos, preprints y datos de investigación. Sirve para verificar estudios citados y hallar documentación primaria.',
    categories: ['CIENCIA', 'TECNOLOGÍA', 'ECONOMÍA & MERCADOS', 'ENERGÍA & CLIMA'],
    languages: ['*'],
    regions: ['*'],
    authMethod: 'none',
    quotaNote:
      'OpenAlex recomienda el "polite pool" (mailto en la query) y declara ~100.000 req/día; no informa saldo restante en cabeceras.',
    quotaKind: 'official',
    internalDailyLimit: 200,
  },
  {
    id: 'wikidata',
    name: 'Wikidata Query Service',
    kind: 'wikidata',
    enabled: false,
    url: 'https://query.wikidata.org/sparql',
    docs: 'https://www.wikidata.org/wiki/Wikidata:SPARQL_query_service',
    description:
      'Datos estructurados sobre personas, organizaciones y acontecimientos vía SPARQL. Para contextualizar y verificar entidades.',
    categories: ['*'],
    languages: ['*'],
    regions: ['*'],
    authMethod: 'none',
    quotaNote:
      'El servicio pide identificación (User-Agent) y puede aplicar límites de tasa no documentados con exactitud.',
    quotaKind: 'unknown',
    internalDailyLimit: 60,
  },
  {
    id: 'tavily',
    name: 'Tavily (búsqueda web del proyecto)',
    kind: 'tavily',
    enabled: true,
    docs: 'https://tavily.com/',
    description:
      'Búsqueda web general ya contratada por BlackNews para la IA editorial (worker/ai.ts). Aporta titulares actuales de la web abierta.',
    categories: ['*'],
    languages: ['*'],
    regions: ['*'],
    authMethod: 'secret',
    secretVar: 'TAVILY_API_KEY',
    quotaNote: 'Plan gratuito con límite diario del proveedor (no publicado en su documentación pública).',
    quotaKind: 'unknown',
    internalDailyLimit: 100,
  },
];
