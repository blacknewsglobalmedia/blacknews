/**
 * Catálogo de países — fuente única para el creador de artículos, el
 * generador de posts, el mapa de cobertura y las banderas de portada.
 *
 * - `./countriesData.ts` (generado) aporta el catálogo base en español
 *   (destacados + resto alfabético) y las coordenadas del mapa.
 * - Los países personalizados que da de alta el usuario se guardan en
 *   `localStorage` y, cuando hay permisos (sesión del propietario), se
 *   sincronizan con `settings/custom_countries` en Firestore para verlos
 *   desde cualquier navegador. Sin permisos o sin red sigue la copia local.
 */
import { useMemo, useSyncExternalStore } from "react";
import { db } from "../firebase";
import { deleteField, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import {
  COUNTRY_COORDS,
  FEATURED_COUNTRIES,
  OTHER_COUNTRIES,
  type CountrySeed,
} from "./countriesData";

export interface CountryItem {
  name: string;
  code: string;
  flag: string;
  /** true si el usuario lo dio de alta (no forma parte del catálogo base). */
  custom?: boolean;
}

/** Pseudo-entrada de alcance global: sin código ISO, bandera 🌐. */
export const INTERNATIONAL_COUNTRY: CountryItem = {
  name: "Internacional",
  code: "GLOBAL",
  flag: "🌐",
};

/** Catálogo base completo en el orden en que se muestra la UI:
 *  destacados primero, después el resto en orden alfabético. */
export const ALL_COUNTRIES: CountryItem[] = (
  [...FEATURED_COUNTRIES, ...OTHER_COUNTRIES] as CountrySeed[]
).map((c) => ({ ...c }));

const FEATURED: CountryItem[] = ALL_COUNTRIES.slice(0, FEATURED_COUNTRIES.length);
const REST: CountryItem[] = ALL_COUNTRIES.slice(FEATURED_COUNTRIES.length);
const BASE_WITH_INTERNATIONAL: CountryItem[] = [...ALL_COUNTRIES, INTERNATIONAL_COUNTRY];

// ── Normalización de textos ─────────────────────────────────────────────

/** Minúsculas sin acentos ni puntuación: "EE.UU." → "ee uu", "Perú" → "peru". */
export const normalizeCountryText = (value: string): string =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

/** Clave de identidad de un país ("Costa Rica" → "costarica"). */
export const countryKey = (value: string): string =>
  normalizeCountryText(value).replace(/\s+/g, "");

const flagFromCode = (code: string): string =>
  code
    .toUpperCase()
    .split("")
    .map((ch) => String.fromCodePoint(127397 + ch.charCodeAt(0)))
    .join("");

/** ¿Es un código ISO alfa-2 de verdad? */
const isIsoCode = (code: string): boolean => /^[A-Za-z]{2}$/.test(code);

/** Código sintético único para personalizados sin ISO: no existe en
 *  flagcdn, así que la UI dibuja el emoji de reserva en su lugar. */
const syntheticCode = (name: string): string => {
  const key = countryKey(name).replace(/[^a-z0-9]/g, "").toUpperCase();
  return `X${key.slice(0, 3)}${name.length % 10}`;
};

// ── Países personalizados (localStorage + Firestore) ────────────────────

const LS_KEY = "blacknews_custom_countries";

interface StoredCustom extends CountryItem {
  addedAt: number;
}

const readLocalCustom = (): StoredCustom[] => {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (c): c is StoredCustom =>
        Boolean(c) && typeof c.name === "string" && c.name.trim().length > 0,
    );
  } catch {
    return [];
  }
};

let customCountries: StoredCustom[] = readLocalCustom();
const listeners = new Set<() => void>();

const persistLocal = () => {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(customCountries));
  } catch {
    /* modo privado o cuota llena: sigue en memoria */
  }
};

const notify = () => listeners.forEach((listener) => listener());

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const snapshot = (): StoredCustom[] => customCountries;

/** Países personalizados (catálogo reactivo). */
export const useCustomCountries = (): CountryItem[] =>
  useSyncExternalStore(subscribe, snapshot, snapshot);

/** Catálogo completo reactivo: destacados + personalizados + resto + Internacional. */
export const useCountryCatalog = (): CountryItem[] => {
  const customs = useCustomCountries();
  return useMemo(
    () => [...FEATURED, ...customs, ...REST, INTERNATIONAL_COUNTRY],
    [customs],
  );
};

/** Versión no reactiva (para lecturas puntuales fuera de render). */
export const getCustomCountries = (): CountryItem[] => customCountries;

const pushRemote = async (items: StoredCustom[]): Promise<void> => {
  if (items.length === 0) return;
  try {
    // Mapa con merge: cada alta solo toca su propia clave y no pisa lo que
    // haya dado de alta otro navegador.
    await setDoc(
      doc(db, "settings", "custom_countries"),
      {
        items: Object.fromEntries(
          items.map((c) => [
            countryKey(c.name),
            { name: c.name, code: c.code, addedAt: c.addedAt },
          ]),
        ),
      },
      { merge: true },
    );
  } catch {
    /* sin sesión de propietario: se queda la copia local */
  }
};

/**
 * Da de alta (o recupera) un país personalizado. Si el nombre ya está en el
 * catálogo devuelve el existente sin duplicarlo; si existe pero sin código
 * ISO y ahora llega uno, se actualiza para poder mostrar bandera.
 */
export const addCustomCountry = (
  rawName: string,
  isoCode?: string,
): CountryItem | null => {
  const name = rawName.trim();
  const key = countryKey(name);
  if (!name || !key) return null;
  const code = isoCode && isIsoCode(isoCode) ? isoCode.toUpperCase() : "";

  const idx = customCountries.findIndex((c) => countryKey(c.name) === key);
  if (idx >= 0) {
    const current = customCountries[idx];
    if (code && !isIsoCode(current.code)) {
      const updated: StoredCustom = {
        ...current,
        code,
        flag: flagFromCode(code),
      };
      customCountries = customCountries.map((c, i) => (i === idx ? updated : c));
      persistLocal();
      void pushRemote([updated]);
      notify();
      return updated;
    }
    return current;
  }

  const inBase = BASE_WITH_INTERNATIONAL.find((c) => countryKey(c.name) === key);
  if (inBase) return inBase;

  const item: StoredCustom = {
    name,
    code: code || syntheticCode(name),
    flag: code ? flagFromCode(code) : "📍",
    addedAt: Date.now(),
    custom: true,
  };
  customCountries = [item, ...customCountries];
  persistLocal();
  void pushRemote([item]);
  notify();
  return item;
};

/** Elimina un país personalizado del listado (local y remoto). */
export const removeCustomCountry = (rawName: string): void => {
  const key = countryKey(rawName);
  if (!key) return;
  const next = customCountries.filter((c) => countryKey(c.name) !== key);
  if (next.length === customCountries.length) return;
  customCountries = next;
  persistLocal();
  notify();
  try {
    void updateDoc(doc(db, "settings", "custom_countries"), {
      [`items.${key}`]: deleteField(),
    }).catch(() => {
      /* el documento aún no existe */
    });
  } catch {
    /* sin permisos: solo queda la copia local */
  }
};

/** Trae los personalizados de Firestore y los fusiona con la copia local. */
export const hydrateCustomCountries = async (): Promise<void> => {
  try {
    const snap = await getDoc(doc(db, "settings", "custom_countries"));
    if (!snap.exists()) return;
    const raw = (snap.data() as { items?: Record<string, unknown> }).items;
    if (!raw || typeof raw !== "object") return;

    const remote: StoredCustom[] = [];
    for (const value of Object.values(raw)) {
      if (!value || typeof value !== "object") continue;
      const entry = value as { name?: unknown; code?: unknown; addedAt?: unknown };
      if (typeof entry.name !== "string" || !entry.name.trim()) continue;
      const name = entry.name.trim();
      const code =
        typeof entry.code === "string" && isIsoCode(entry.code)
          ? entry.code.toUpperCase()
          : syntheticCode(name);
      remote.push({
        name,
        code,
        flag: isIsoCode(code) ? flagFromCode(code) : "📍",
        addedAt: typeof entry.addedAt === "number" ? entry.addedAt : 0,
        custom: true,
      });
    }
    if (remote.length === 0) return;

    const merged = new Map<string, StoredCustom>();
    customCountries.forEach((c) => merged.set(countryKey(c.name), c));
    remote.forEach((r) => {
      const key = countryKey(r.name);
      const local = merged.get(key);
      // Gana el que tenga código ISO (así una copia local sin bandera no
      // pisa la sincronizada con código).
      if (!local || (!isIsoCode(local.code) && isIsoCode(r.code))) {
        merged.set(key, r);
      }
    });

    const next = Array.from(merged.values()).sort((a, b) => b.addedAt - a.addedAt);
    if (JSON.stringify(next) !== JSON.stringify(customCountries)) {
      customCountries = next;
      persistLocal();
      notify();
    }
  } catch {
    /* sin conexión: sigue la copia local */
  }
};

// ── Consultas ───────────────────────────────────────────────────────────

/** Busca por nombre normalizado (sin importar acentos) o por código ISO. */
export const searchCountries = (
  query: string,
  list: CountryItem[],
): CountryItem[] => {
  const q = normalizeCountryText(query);
  if (!q) return list;
  return list.filter(
    (c) => normalizeCountryText(c.name).includes(q) || c.code.toLowerCase().includes(q),
  );
};

/** Resuelve un nombre (del catálogo o personalizado) a su item con bandera. */
export const findCountryByName = (name: string): CountryItem | undefined => {
  const key = countryKey(name);
  if (!key) return undefined;
  return (
    customCountries.find((c) => countryKey(c.name) === key) ??
    BASE_WITH_INTERNATIONAL.find((c) => countryKey(c.name) === key)
  );
};

/** Índice para buscar países citados en un texto (tags/título): nombres
 *  largos primero, así «Papúa Nueva Guinea» gana a «Guinea». */
const ORDERED_FOR_TEXT: CountryItem[] = [...ALL_COUNTRIES].sort(
  (a, b) => b.name.length - a.name.length,
);

export const matchCountryInText = (text: string): CountryItem | undefined => {
  const hay = ` ${normalizeCountryText(text)} `;
  if (!hay.trim()) return undefined;
  const customs = [...customCountries].sort(
    (a, b) => b.name.length - a.name.length,
  );
  for (const c of [...customs, ...ORDERED_FOR_TEXT]) {
    if (hay.includes(` ${normalizeCountryText(c.name)} `)) return c;
  }
  return undefined;
};

// ── Mapa de cobertura ───────────────────────────────────────────────────

const COORDS_BY_CODE: Record<string, [number, number]> = {};
for (const item of ALL_COUNTRIES) {
  const coords = COUNTRY_COORDS[item.name];
  if (coords) COORDS_BY_CODE[item.code] = coords;
}

/** [lon, lat] de un nombre de país (también alias resolubles por código).
 *  Sin datos → el grupo se muestra en el panel pero no pinta pin. */
export const coordsForCountry = (name: string): [number, number] | undefined => {
  const direct = COUNTRY_COORDS[name];
  if (direct) return direct;
  const item = findCountryByName(name);
  return item ? COORDS_BY_CODE[item.code] : undefined;
};
