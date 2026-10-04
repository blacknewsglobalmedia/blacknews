import {
  ALL_LEGAL_SECTIONS,
  POLICIES_INTRO,
  LegalBlock,
  LegalSection,
} from "../data/legalDocs";

/** Par de la cabecera meta del documento (**Etiqueta:** valor). */
export interface PolicyIntroItem {
  label: string;
  value: string;
}

/**
 * Registro compartido de políticas (Firestore `settings/policies`).
 * `version` empieza en0 para el documento integrado; cada publicación del admin
 * incrementa la versión y dispara el aviso a todos los visitantes.
 */
export interface PoliciesRecord {
  md: string;
  /** Fecha de entrada en vigor, formato YYYY-MM-DD. */
  effectiveDate: string;
  version: number;
  /** ISO timestamp de la última publicación. */
  updatedAt: string;
  updatedBy?: string;
}

export const DEFAULT_EFFECTIVE_DATE = "2026-10-03";

const MONTHS_ES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/** "2026-10-03" → "3 de octubre de 2026" (sin desfases de zona horaria). */
export function formatPolicyDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((iso || "").trim());
  if (!m) return iso || "";
  const day = parseInt(m[3], 10);
  const month = MONTHS_ES[parseInt(m[2], 10) - 1];
  if (!month) return iso;
  return `${day} de ${month} de ${m[1]}`;
}

/** Hoy en YYYY-MM-DD (hora local) para comparar con effectiveDate. */
export function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function isFutureDate(iso: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) && iso > todayIso();
}

export function isValidIsoDate(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

/** Serializa intro + secciones al markdown editable (fuente del editor admin). */
export function serializePolicies(
  intro: PolicyIntroItem[],
  sections: LegalSection[],
): string {
  const out: string[] = [];
  for (const item of intro) {
    out.push(`**${item.label}:** ${item.value}`);
  }
  for (const section of sections) {
    out.push("", `# ${section.title}`);
    for (const block of section.blocks) {
      if (block.h) out.push("", `## ${block.h}`);
      else if (block.p) out.push("", block.p);
      else if (block.list) out.push("", ...block.list.map((i) => `- ${i}`));
      else if (block.num)
        out.push("", ...block.num.map((t, idx) => `${idx + 1}. ${t}`));
      else if (block.note) out.push("", `> ${block.note}`);
    }
  }
  return `${out.join("\n").trim()}\n`;
}

/**
 * Parsea el markdown editable a intro + secciones.
 * Formato: líneas `**Etiqueta:** valor` antes del primer `# `; `# ` abre
 * sección, `## ` subepígrafe, `- ` lista, `N. ` enumeración, `> ` nota,
 * línea vacía separa párrafos. Un párrafo en varias líneas se une con espacio.
 */
export function parsePolicies(md: string): {
  intro: PolicyIntroItem[];
  sections: LegalSection[];
} {
  const norm = (md || "").replace(/\r\n/g, "\n");
  const hashIdx = norm.search(/^# /m);
  const introRaw = hashIdx >= 0 ? norm.slice(0, hashIdx) : norm;
  const body = hashIdx >= 0 ? norm.slice(hashIdx) : "";

  const intro: PolicyIntroItem[] = [];
  for (const line of introRaw.split("\n")) {
    const m = /^\*\*(.+?):\*\*\s*(.*)$/.exec(line);
    if (m) intro.push({ label: m[1].trim(), value: m[2].trim() });
  }

  const sections: LegalSection[] = [];
  for (const chunk of body.split(/^# /m)) {
    if (!chunk.trim()) continue;
    const lines = chunk.split("\n");
    const title = (lines.shift() || "").trim();
    if (!title) continue;

    const blocks: LegalBlock[] = [];
    let para: string[] = [];
    let list: string[] = [];
    let num: string[] = [];
    const flushPara = () => {
      if (para.length) {
        blocks.push({ p: para.join(" ") });
        para = [];
      }
    };
    const flushList = () => {
      if (list.length) {
        blocks.push({ list });
        list = [];
      }
    };
    const flushNum = () => {
      if (num.length) {
        blocks.push({ num });
        num = [];
      }
    };
    const flushAll = () => {
      flushPara();
      flushList();
      flushNum();
    };

    for (const raw of lines) {
      const line = raw.trimEnd();
      if (!line.trim()) {
        flushAll();
        continue;
      }
      if (/^##\s+/.test(line)) {
        flushAll();
        blocks.push({ h: line.replace(/^##\s+/, "").trim() });
        continue;
      }
      if (/^[-*]\s+/.test(line)) {
        flushPara();
        flushNum();
        list.push(line.replace(/^[-*]\s+/, "").trim());
        continue;
      }
      if (/^\d+\.\s+/.test(line)) {
        flushPara();
        flushList();
        num.push(line.replace(/^\d+\.\s+/, "").trim());
        continue;
      }
      if (/^>\s?/.test(line)) {
        flushAll();
        blocks.push({ note: line.replace(/^>\s?/, "").trim() });
        continue;
      }
      flushList();
      flushNum();
      para.push(line.trim());
    }
    flushAll();
    sections.push({ title, blocks });
  }

  return { intro, sections };
}

/** Markdown por defecto: el documento oficial integrado en el build. */
export const DEFAULT_POLICIES_MD = serializePolicies(
  POLICIES_INTRO,
  ALL_LEGAL_SECTIONS,
);

/** Registro integrado (versión0: sin publicaciones todavía). */
export function defaultPoliciesRecord(): PoliciesRecord {
  return {
    md: DEFAULT_POLICIES_MD,
    effectiveDate: DEFAULT_EFFECTIVE_DATE,
    version: 0,
    updatedAt: "",
    updatedBy: "",
  };
}

/** Parsea un registro con defensas: md vacío o sin secciones → documento por defecto. */
export function parseRecord(record: PoliciesRecord): {
  intro: PolicyIntroItem[];
  sections: LegalSection[];
} {
  let parsed = parsePolicies(record.md);
  if (parsed.sections.length === 0) parsed = parsePolicies(DEFAULT_POLICIES_MD);
  if (parsed.intro.length === 0) parsed.intro = POLICIES_INTRO;
  return parsed;
}

// ---------------------------------------------------------------------------
// Caché local (pintado instantáneo + red si está disponible)
// ---------------------------------------------------------------------------

const CACHE_KEY = "blacknews_policies_cache";
const SEEN_KEY = "blacknews_policies_seen";

function isRecord(value: unknown): value is PoliciesRecord {
  const v = value as PoliciesRecord | null;
  return Boolean(
    v &&
      typeof v.md === "string" &&
      typeof v.effectiveDate === "string" &&
      typeof v.version === "number",
  );
}

export function loadCachedPolicies(): PoliciesRecord | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveCachedPolicies(record: PoliciesRecord): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(record));
  } catch {
    /* almacenamiento lleno o bloqueado: el registro remoto sigue siendo la fuente */
  }
}

export function loadSeenVersion(): number {
  try {
    const v = Number(localStorage.getItem(SEEN_KEY));
    return Number.isFinite(v) && v > 0 ? v : 0;
  } catch {
    return 0;
  }
}

export function saveSeenVersion(version: number): void {
  try {
    localStorage.setItem(SEEN_KEY, String(version));
  } catch {
    /* ignorar */
  }
}

// ---------------------------------------------------------------------------
// Borrador del editor admin (no perder texto si la publicación falla)
// ---------------------------------------------------------------------------

export const DRAFT_KEY = "blacknews_policies_draft";

/** Devuelve el borrador sin publicar o `null` si no hay (o está vacío). */
export function loadDraft(): string | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw && raw.trim() ? raw : null;
  } catch {
    return null;
  }
}

export function saveDraft(md: string): void {
  try {
    localStorage.setItem(DRAFT_KEY, md);
  } catch {
    /* ignorar: en el peor caso el texto queda en el textarea */
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignorar */
  }
}
