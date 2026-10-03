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
