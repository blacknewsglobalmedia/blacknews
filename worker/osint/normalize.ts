/**
 * BLACKNEWS OSINT — Normalización, dedupe y puntuación (lógica PURA).
 *
 * Sin fetch ni KV: este módulo se prueba directamente en Node
 * (test/osint-logic.test.mjs). Reglas:
 *
 * - Duplicados = misma URL canónica (sin trackers) O titulares idénticos
 *   normalizados con proximidad temporal. Nunca se borra nada: los
 *   duplicados se AGRUPAN en un acontecimiento (cluster) conservando todas
 *   las fuentes originales. Los titulares cortos no agrupan por palabras
 *   clave para no confundir acontecimientos distintos.
 * - La puntuación es editorial (recencia, fuentes, coincidencia…), con
 *   factores explicados. NO es prueba de veracidad ni de exclusividad.
 */
import type { OsintCluster, OsintItem, OsintRawItem } from '../../src/types/osint';

/* ------------------------------------------------------------------ */
/* Hash estable (djb2 → hex) para ids sin dependencias.                */
/* ------------------------------------------------------------------ */
export function hashHex(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h + input.charCodeAt(i)) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/* ------------------------------------------------------------------ */
/* URL canónica: quita trackers conocidos, fragmento y www.            */
/* ------------------------------------------------------------------ */
const TRACKER_PARAMS = /^(utm_|fbclid$|gclid$|mc_cid$|mc_eid$|igshid$|ref$|ref_src$|cmpid$|smtyp$|smid$)/;

export function canonicalUrl(raw: string): string {
  try {
    const url = new URL(raw);
    url.hash = '';
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, '');
    const params = [...url.searchParams.entries()].filter(
      ([k]) => !TRACKER_PARAMS.test(k.toLowerCase()),
    );
    params.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    const qs = params.map(([k, v]) => `${k}=${v}`).join('&');
    const path = url.pathname.replace(/\/+$/, '') || '/';
    return `${url.protocol}//${url.hostname}${path}${qs ? `?${qs}` : ''}`;
  } catch {
    return raw.trim().toLowerCase();
  }
}

/* ------------------------------------------------------------------ */
/* Titular normalizado para comparación.                               */
/* ------------------------------------------------------------------ */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // sin tildes
    .replace(/[^a-z0-9\s]/g, ' ') // sin puntuación
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(title: string): Set<string> {
  return new Set(normalizeTitle(title).split(' ').filter((t) => t.length > 2));
}

/** Similitud de Jaccard sobre tokens del titular (0..1). */
export function titleSimilarity(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / (ta.size + tb.size - inter);
}

const MIN_CLUSTER_TITLE_CHARS = 40; // titulares cortos no agrupan por texto
const CLUSTER_WINDOW_MS = 6 * 3_600_000; // ±6 h para considerar "mismo momento"

/* ------------------------------------------------------------------ */
/* Ítems crudos → normalizados + cluster inicial (por URL).            */
/* ------------------------------------------------------------------ */
export interface NormalizeContext {
  sourceId: string;
  sourceName: string;
  sourceKind: OsintRawItem extends never ? never : string;
  detectedAt: string;
  query: string;
}

export function normalizeItems(
  raws: OsintRawItem[],
  ctx: Omit<NormalizeContext, 'sourceKind'> & { sourceKind: OsintItem['sourceKind'] },
): Array<Omit<OsintItem, 'clusterId' | 'score' | 'scoreFactors'>> {
  const seen = new Set<string>();
  const out: Array<Omit<OsintItem, 'clusterId' | 'score' | 'scoreFactors'>> = [];
  for (const raw of raws) {
    const title = (raw.title || '').replace(/\s+/g, ' ').trim();
    if (!title || !raw.url) continue; // nunca inventar titulares/enlaces
    const canon = canonicalUrl(raw.url);
    if (seen.has(canon)) continue; // duplicado exacto dentro de la misma fuente
    seen.add(canon);
    out.push({
      id: `${ctx.sourceId}-${hashHex(canon)}`,
      sourceId: ctx.sourceId,
      sourceKind: ctx.sourceKind,
      sourceName: ctx.sourceName,
      title,
      url: raw.url,
      canonicalUrl: canon,
      snippet: raw.snippet?.replace(/\s+/g, ' ').trim() || undefined,
      author: raw.author?.trim() || undefined,
      publishedAt: raw.publishedAt || undefined,
      detectedAt: ctx.detectedAt,
      language: raw.language?.toLowerCase() || undefined,
      country: raw.country?.toUpperCase() || undefined,
      imageUrl: raw.imageUrl || undefined,
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Agrupación de acontecimientos (duplicados entre fuentes).           */
/* ------------------------------------------------------------------ */
export function clusterItems(items: Array<Omit<OsintItem, 'clusterId' | 'score' | 'scoreFactors'>>): {
  items: OsintItem[];
  clusters: OsintCluster[];
  duplicateCount: number;
} {
  const itemsWithCluster: OsintItem[] = items.map((it) => ({ ...it, clusterId: '', score: 0, scoreFactors: [] }));
  const clusters: OsintCluster[] = [];
  let duplicateCount = 0;

  const indexOfCanon = new Map<string, number>(); // canonicalUrl → índice de cluster
  const clusterTitles: Array<string[]> = []; // tokens por cluster (regla textual)

  for (const item of itemsWithCluster) {
    // 1) Misma URL canónica → mismo acontecimiento.
    const byUrl = indexOfCanon.get(item.canonicalUrl);
    if (byUrl !== undefined) {
      attachToCluster(clusters[byUrl], item);
      item.clusterId = clusters[byUrl].id;
      duplicateCount++;
      continue;
    }

    // 2) Titular idéntico normalizado + proximidad temporal (±6 h).
    //    Sólo con titulares largos: evita confundir dos acontecimientos
    //    distintos que comparten palabras comunes.
    const norm = normalizeTitle(item.title);
    let merged = false;
    if (norm.length >= MIN_CLUSTER_TITLE_CHARS) {
      const t = tokens(item.title);
      for (let ci = 0; ci < clusters.length && !merged; ci++) {
        const existing = itemsWithCluster.filter((i) => i.clusterId === clusters[ci].id);
        // Similitud alta con cualquier miembro del cluster
        for (const member of existing) {
          if (titleSimilarity(member.title, item.title) < 0.9) continue;
          const a = Date.parse(member.publishedAt || member.detectedAt);
          const b = Date.parse(item.publishedAt || item.detectedAt);
          if (Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) > CLUSTER_WINDOW_MS) {
            continue; // mismo titular pero otra fecha → otro acontecimiento
          }
          attachToCluster(clusters[ci], item);
          item.clusterId = clusters[ci].id;
          duplicateCount++;
          merged = true;
          break;
        }
        void t;
      }
    }

    if (!merged) {
      const cluster: OsintCluster = {
        id: `c-${hashHex(item.canonicalUrl + item.id)}`,
        title: item.title,
        itemCount: 0,
        sourceIds: [],
        itemIds: [],
        firstSeenAt: item.publishedAt || item.detectedAt,
        lastSeenAt: item.publishedAt || item.detectedAt,
      };
      attachToCluster(cluster, item);
      item.clusterId = cluster.id;
      clusters.push(cluster);
      indexOfCanon.set(item.canonicalUrl, clusters.length - 1);
      clusterTitles.push([norm]);
    }
  }

  return { items: itemsWithCluster, clusters, duplicateCount };
}

function attachToCluster(cluster: OsintCluster, item: OsintItem): void {
  cluster.itemCount++;
  if (!cluster.sourceIds.includes(item.sourceId)) cluster.sourceIds.push(item.sourceId);
  cluster.itemIds.push(item.id);
  const t = Date.parse(item.publishedAt || item.detectedAt);
  if (Number.isFinite(t)) {
    if (t < Date.parse(cluster.firstSeenAt)) cluster.firstSeenAt = new Date(t).toISOString();
    if (t > Date.parse(cluster.lastSeenAt)) cluster.lastSeenAt = new Date(t).toISOString();
  }
  // El titular del grupo = el más reciente (regla simple y determinista).
  if (Date.parse(item.publishedAt || item.detectedAt) >= Date.parse(cluster.lastSeenAt)) {
    cluster.title = item.title;
  }
}

/* ------------------------------------------------------------------ */
/* Puntuación editorial con factores explicados.                       */
/* ------------------------------------------------------------------ */
export function scoreItems(
  items: OsintItem[],
  clusters: OsintCluster[],
  query: string,
): void {
  const clusterById = new Map(clusters.map((c) => [c.id, c]));
  const qTokens = tokens(query);
  for (const item of items) {
    const factors: string[] = [];
    let score = 0;

    const published = Date.parse(item.publishedAt || item.detectedAt);
    const ageH = Number.isFinite(published) ? (Date.now() - published) / 3_600_000 : 999;
    if (ageH <= 6) {
      score += 30;
      factors.push('Muy reciente (<6 h)');
    } else if (ageH <= 24) {
      score += 20;
      factors.push('Últimas 24 h');
    } else if (ageH <= 24 * 7) {
      score += 8;
      factors.push('Últimos 7 días');
    }

    const cluster = clusterById.get(item.clusterId);
    if (cluster && cluster.sourceIds.length > 1) {
      const bonus = Math.min(20, (cluster.sourceIds.length - 1) * 8);
      score += bonus;
      factors.push(`Cubierto por ${cluster.sourceIds.length} fuentes independientes`);
    }

    if (qTokens.size > 0) {
      const titleTokens = tokens(item.title);
      let hit = 0;
      for (const t of qTokens) if (titleTokens.has(t)) hit++;
      if (hit > 0) {
        const ratio = hit / qTokens.size;
        const bonus = Math.round(15 * ratio);
        score += bonus;
        factors.push('Titular relacionado con la búsqueda');
      }
    }

    if (item.snippet) {
      score += 5;
      factors.push('Incluye fragmento de la fuente');
    }
    if (item.sourceKind === 'wikidata' || item.sourceKind === 'openalex') {
      score += 5;
      factors.push('Documentación estructurada/académica');
    }
    if (item.author) {
      score += 2;
      factors.push('Con autoría identificada');
    }

    item.score = Math.min(100, score);
    item.scoreFactors = factors.length > 0 ? factors : ['Sin factores destacados'];
  }
}

/** Orden pedagogía-first: score, fecha o coincidencia textual. */
export function sortItems(items: OsintItem[], sort: 'date' | 'relevance' | 'score'): OsintItem[] {
  const copy = [...items];
  if (sort === 'date') {
    copy.sort(
      (a, b) =>
        Date.parse(b.publishedAt || b.detectedAt) - Date.parse(a.publishedAt || a.detectedAt),
    );
  } else if (sort === 'relevance') {
    const q = (s: string) => s.toLowerCase();
    copy.sort((a, b) => b.score - a.score || q(a.title).localeCompare(q(b.title)));
  } else {
    copy.sort((a, b) => b.score - a.score);
  }
  return copy;
}
