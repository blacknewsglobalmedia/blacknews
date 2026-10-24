const KEY = "blacknews_readpos";
export const READ_POS_EVENT = "bn:readpos";

interface ReadPos {
  pct: number;
  ts: number;
}

type PosMap = Record<string, ReadPos>;

const load = (): PosMap => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PosMap) : {};
  } catch {
    return {};
  }
};

const persist = (map: PosMap) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* cuota llena: se ignora */
  }
  window.dispatchEvent(new Event(READ_POS_EVENT));
};

// ── Huella de lectura: días con lectura (para la portada) ────────────────
const DAYS_KEY = "blacknews_read_days";
/** Diez semanas de huella, como máximo. */
const MAX_READ_DAYS = 70;

const todayIsoLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Días con lectura registrada (ISO local, ascendente). */
export const readDays = (): string[] => {
  try {
    const raw = localStorage.getItem(DAYS_KEY);
    const arr = raw ? JSON.parse(raw) : null;
    return Array.isArray(arr)
      ? arr.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
};

/** Apunta hoy como día de lectura (idempotente; no emite el evento). */
const markReadDay = () => {
  try {
    const days = readDays();
    const today = todayIsoLocal();
    if (days[days.length - 1] === today) return;
    days.push(today);
    if (days.length > MAX_READ_DAYS) days.splice(0, days.length - MAX_READ_DAYS);
    localStorage.setItem(DAYS_KEY, JSON.stringify(days));
  } catch {
    /* modo privado: la huella dura esta sesión */
  }
};

/** Porcentaje de avance guardado (null si no hay posición útil). */
export const getReadPct = (reportId: string): number | null => {
  const pos = load()[reportId];
  if (!pos || typeof pos.pct !== "number") return null;
  if (pos.pct < 0.05 || pos.pct > 0.92) return null;
  return pos.pct;
};

/**
 * Guarda el avance de lectura. Por debajo del 5% se considera "sin empezar"
 * y por encima del 95% "terminado": en ambos casos se limpia la entrada.
 */
export const setReadPct = (reportId: string, pct: number) => {
  // Toda lectura real (≥5%) deja huella del día en la portada.
  if (pct >= 0.05) markReadDay();
  const map = load();

  if (pct < 0.05 || pct >= 0.95) {
    if (map[reportId]) {
      delete map[reportId];
      persist(map);
    }
    return;
  }

  map[reportId] = { pct, ts: Date.now() };

  // Mantener como máximo 40 posiciones guardadas (las más recientes)
  const keys = Object.keys(map);
  if (keys.length > 40) {
    keys
      .sort((a, b) => map[a].ts - map[b].ts)
      .slice(0, keys.length - 40)
      .forEach((k) => delete map[k]);
  }

  persist(map);
};
