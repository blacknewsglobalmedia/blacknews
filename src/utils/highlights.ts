export interface Highlight {
  id: string;
  reportId: string;
  text: string;
  ts: number;
}

const KEY = "blacknews_highlights";
const MAX_ITEMS = 200;
export const HIGHLIGHTS_EVENT = "bn:highlights";

const load = (): Highlight[] => {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as Highlight[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
};

const persist = (list: Highlight[]) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* cuota llena: se ignora */
  }
  window.dispatchEvent(new Event(HIGHLIGHTS_EVENT));
};

export const getHighlights = (reportId: string): Highlight[] =>
  load()
    .filter((h) => h.reportId === reportId)
    .sort((a, b) => a.ts - b.ts);

export const addHighlight = (reportId: string, text: string) => {
  const trimmed = text.trim();
  if (!trimmed) return;
  const list = load();
  if (list.some((h) => h.reportId === reportId && h.text === trimmed)) return;
  list.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    reportId,
    text: trimmed,
    ts: Date.now(),
  });
  persist(list.length > MAX_ITEMS ? list.slice(list.length - MAX_ITEMS) : list);
};

export const removeHighlight = (id: string) => {
  persist(load().filter((h) => h.id !== id));
};
