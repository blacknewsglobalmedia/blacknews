import { AD_PLACEMENTS_INFO, AdPlacement } from "../types/ads";

/**
 * Plantillas publicitarias descargables (paso 2 del asistente).
 *
 * Cada plantilla es un SVG editable con la proporción EXACTA del hueco,
 * generado desde AD_PLACEMENTS_INFO (misma fuente que el render): fondo
 * negro del sitio, zona segura, cruz central del recorte (cover), etiqueta
 * «PUBLICIDAD» y el tamaño nominal. Una sola plantilla por proporción:
 * IN_ARTICLE_PARAGRAPHS y ARTICLE_FOOTER comparten 728 × 90.
 *
 * El kit completo se empaqueta en un ZIP escrito a mano (método store,
 * sin dependencias): cabeceras locales + directorio central + EOCD con
 * CRC-32.
 */

export interface AdTemplate {
  /** Slug estable, ej. «970x250» */
  id: string;
  /** Tamaño nominal de exportación (px) */
  width: number;
  height: number;
  /** Proporción CSS, ej. «970 / 250» */
  ratio: string;
  /** Etiqueta visible, ej. «970 × 250» */
  label: string;
  /** Slots que comparten esta proporción */
  placements: { id: AdPlacement; name: string }[];
}

function parseNominal(size: string): { w: number; h: number } | null {
  const m = size.match(/(\d+)\s*×\s*(\d+)/);
  return m ? { w: parseInt(m[1], 10), h: parseInt(m[2], 10) } : null;
}

/** Una plantilla por proporción única (no por slot). */
export const AD_TEMPLATES: AdTemplate[] = (() => {
  const map = new Map<string, AdTemplate>();
  for (const p of Object.values(AD_PLACEMENTS_INFO)) {
    const nominal = parseNominal(p.exportSizes[0] ?? "");
    if (!nominal) continue;
    const id = `${nominal.w}x${nominal.h}`;
    const entry = map.get(id);
    if (entry) {
      entry.placements.push({ id: p.id, name: p.name });
    } else {
      map.set(id, {
        id,
        width: nominal.w,
        height: nominal.h,
        ratio: `${nominal.w} / ${nominal.h}`,
        label: `${nominal.w} × ${nominal.h}`,
        placements: [{ id: p.id, name: p.name }],
      });
    }
  }
  return [...map.values()];
})();

/** SVG de la plantilla. Texto y guías son capas editables. */
export function buildTemplateSvg(t: AdTemplate): string {
  const w = t.width;
  const h = t.height;
  const margin = Math.max(6, Math.round(Math.min(w, h) * 0.05));
  const wordmark = Math.round(Math.min(w * 0.085, h * 0.32));
  const micro = Math.max(8, Math.min(12, Math.round(Math.min(w, h) * 0.06)));
  const centerY = Math.round(h / 2 + wordmark * 0.35);
  const cx = Math.round(w / 2);
  const dashed = `stroke-dasharray="6 6"`;

  const lines = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="Lexend, Arial, sans-serif">`,
    `  <!-- BlackNews · plantilla ${t.label} px · proporción ${t.ratio} · fuente: AD_PLACEMENTS_INFO -->`,
    `  <rect width="${w}" height="${h}" fill="#000000"/>`,
    // Zona segura: nada importante más allá del borde discontinuo.
    `  <rect x="${margin}" y="${margin}" width="${w - margin * 2}" height="${h - margin * 2}" fill="none" stroke="#262626" stroke-width="1" ${dashed}/>`,
    // Cruz central = centro del recorte (cover): lo que quede fuera se corta.
    `  <line x1="${cx}" y1="0" x2="${cx}" y2="${h}" stroke="#141414"/>`,
    `  <line x1="0" y1="${Math.round(h / 2)}" x2="${w}" y2="${Math.round(h / 2)}" stroke="#141414"/>`,
    `  <text x="${margin + 4}" y="${margin + micro + 2}" fill="#71717a" font-size="${micro}" font-weight="600" letter-spacing="${Math.round(micro * 0.3)}">PUBLICIDAD</text>`,
    `  <text x="${cx}" y="${centerY}" fill="#ffffff" font-size="${wordmark}" font-weight="700" text-anchor="middle" letter-spacing="${Math.round(wordmark * 0.02)}">BLACKNEWS</text>`,
  ];

  if (h >= 150) {
    const subSize = Math.max(9, Math.round(wordmark * 0.2));
    lines.push(
      `  <text x="${cx}" y="${centerY + Math.round(wordmark * 0.75)}" fill="#52525b" font-size="${subSize}" font-weight="500" letter-spacing="${Math.round(subSize * 0.35)}" text-anchor="middle">ESPACIO PUBLICITARIO</text>`,
    );
  }

  lines.push(
    `  <text x="${w - margin - 4}" y="${h - margin - 4}" text-anchor="end" fill="#52525b" font-size="${micro}" font-family="ui-monospace, monospace">${t.label} px</text>`,
    `</svg>`,
    ``,
  );
  return lines.join("\n");
}

/* ── ZIP (método store, sin compresión) ─────────────────────────────── */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

interface ZipEntry {
  name: string;
  data: Uint8Array;
}

function buildZip(entries: ZipEntry[]): Uint8Array {
  const encoder = new TextEncoder();
  const now = new Date();
  const dosTime =
    ((now.getHours() & 31) << 11) |
    ((now.getMinutes() & 63) << 5) |
    (Math.floor(now.getSeconds() / 2) & 31);
  const dosDate =
    (((now.getFullYear() - 1980) & 127) << 9) |
    (((now.getMonth() + 1) & 15) << 5) |
    (now.getDate() & 31);

  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const e of entries) {
    const nameBytes = encoder.encode(e.name);
    const crc = crc32(e.data);
    const size = e.data.length;

    // Cabecera local: 0x04034b50 · flags 0x0800 (nombres UTF-8) · method 0
    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true);
    lv.setUint16(8, 0, true);
    lv.setUint16(10, dosTime, true);
    lv.setUint16(12, dosDate, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    local.set(nameBytes, 30);
    localParts.push(local, e.data);

    // Directorio central: 0x02014b50
    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, dosTime, true);
    cv.setUint16(14, dosDate, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    centralParts.push(central);

    offset += local.length + size;
  }

  const centralSize = centralParts.reduce((n, p) => n + p.length, 0);
  // EOCD: 0x06054b50
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  const out = new Uint8Array(offset + centralSize + eocd.length);
  let pos = 0;
  for (const part of [...localParts, ...centralParts, eocd]) {
    out.set(part, pos);
    pos += part.length;
  }
  return out;
}

/* ── Descargas ──────────────────────────────────────────────────────── */

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function downloadAdTemplate(t: AdTemplate): void {
  const svg = buildTemplateSvg(t);
  triggerDownload(
    new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
    `blacknews-plantilla-${t.id}.svg`,
  );
}

function buildKitReadme(): string {
  const list = AD_TEMPLATES.map(
    (t) =>
      `blacknews-plantilla-${t.id}.svg .... ${t.placements.map((p) => p.name).join(" + ")}`,
  ).join("\n");
  return `BLACKNEWS · KIT DE PLANTILLAS PUBLICITARIAS
===========================================

${AD_TEMPLATES.length} plantillas SVG, una por proporción de hueco (los
banners de 728 x 90 comparten plantilla). Cada archivo trae:

  · fondo negro exacto del sitio
  · borde discontinuo = zona segura (nada importante más allá)
  · cruz central = centro del recorte (cover): lo que quede fuera se corta
  · etiqueta PUBLICIDAD (obligatoria en el sitio)
  · tamaño nominal en px, abajo a la derecha

ARCHIVOS
--------
${list}

COMO USARLAS
------------
1. Abre el .svg en Figma, Illustrator, Affinity o Inkscape.
2. Sustituye el texto BLACKNEWS por tu logotipo o creatividad.
3. Exporta a JPG/PNG al tamaño indicado (max. 300 KB recomendado).
4. Sube el archivo en el paso 2 del asistente de BlackNews.

Los tamaños secundarios (p. ej. 728 x 90 en el billboard) se aceptan:
se recortan al centro hasta llenar el hueco.

unslop by Damir Sokolovsky (@heydamir), CC BY 4.0
`;
}

export function buildAdKitZip(): Uint8Array {
  const encoder = new TextEncoder();
  const entries: ZipEntry[] = AD_TEMPLATES.map((t) => ({
    name: `blacknews-plantilla-${t.id}.svg`,
    data: encoder.encode(buildTemplateSvg(t)),
  }));
  entries.push({ name: "LEEME.txt", data: encoder.encode(buildKitReadme()) });
  return buildZip(entries);
}

export function downloadAdKit(): void {
  const zip = buildAdKitZip();
  // .slice() devuelve un Uint8Array con buffer propio (ArrayBuffer exacto):
  // evita el choque de tipos ArrayBufferLike vs ArrayBuffer en BlobPart.
  triggerDownload(
    new Blob([zip.slice().buffer], { type: "application/zip" }),
    "blacknews-kit-plantillas.zip",
  );
}
