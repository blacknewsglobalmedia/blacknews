/**
 * Agenda editorial BLACKNEWS — acontecimientos de aquí en adelante.
 *
 * Fuente única de verdad para el calendario del panel interno: elecciones
 * nacionales, cumbres y citas internacionales, efemérides históricas y
 * recordatorios de redacción.
 *
 * Persistencia (mismo patrón que teletipo y categorías):
 *   - Firestore `settings/editorial_calendar` → lo ven todos los acreditados.
 *   - localStorage `blacknews_editorial_calendar` → copia de respaldo local.
 *
 * Los acontecimientos se guardan como fechas ISO (YYYY-MM-DD) en un año base;
 * los marcados `recurring` se expanden automáticamente a cada año visible
 * (el 11-S aparece todos los años sin tener que duplicar nada).
 */
import type { CATEGORIES } from "./newsData";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type CalendarEventKind =
  | "eleccion"
  | "efemeride"
  | "recordatorio"
  | "cumbre"
  | "deporte"
  | "economia";

export interface CalendarEvent {
  id: string;
  title: string;
  /** Fecha ISO YYYY-MM-DD (primera fecha si el evento ocupa varios días). */
  date: string;
  /** Fecha final ISO para eventos de varios días (opcional). */
  endDate?: string;
  kind: CalendarEventKind;
  /** Código ISO del país del catálogo, o 'GLOBAL' para lo internacional. */
  country: string;
  /** Sección editorial BLACKNEWS a la que se vincula (opcional). */
  category?: Extract<(typeof CATEGORIES)[number], string>;
  /** Detalle breve que se muestra en la ficha del día. */
  notes?: string;
  /** true = se repite cada año (11-S, 24-F, 8-M…). */
  recurring?: boolean;
  /** Semilla precargada vs. alta manual del redactor. */
  source?: "seed" | "manual";
}

// ---------------------------------------------------------------------------
// Taxonomía visible: etiqueta + color por tipo
// ---------------------------------------------------------------------------
export const KIND_META: Record<
  CalendarEventKind,
  { label: string; short: string; chip: string; dot: string }
> = {
  eleccion: {
    label: "Elecciones",
    short: "ELECCIÓN",
    chip: "bg-emerald-400/10 text-emerald-300 border-emerald-400/25",
    dot: "bg-emerald-400",
  },
  efemeride: {
    label: "Efemérides",
    short: "EFEMÉRIDE",
    chip: "bg-sky-400/10 text-sky-300 border-sky-400/25",
    dot: "bg-sky-400",
  },
  recordatorio: {
    label: "Recordatorios",
    short: "AVISO",
    chip: "bg-amber-400/10 text-amber-300 border-amber-400/25",
    dot: "bg-amber-400",
  },
  cumbre: {
    label: "Cumbres & cita",
    short: "CUMBRE",
    chip: "bg-violet-400/10 text-violet-300 border-violet-400/25",
    dot: "bg-violet-400",
  },
  deporte: {
    label: "Deporte",
    short: "DEPORTE",
    chip: "bg-rose-400/10 text-rose-300 border-rose-400/25",
    dot: "bg-rose-400",
  },
  economia: {
    label: "Economía & mercados",
    short: "ECONOMÍA",
    chip: "bg-orange-400/10 text-orange-300 border-orange-400/25",
    dot: "bg-orange-400",
  },
};

export const KIND_ORDER: CalendarEventKind[] = [
  "eleccion",
  "cumbre",
  "efemeride",
  "recordatorio",
  "economia",
  "deporte",
];

// ---------------------------------------------------------------------------
// Utilidades de fecha (ISO sin zona horaria: nunca con new Date(iso))
// ---------------------------------------------------------------------------

/** 'YYYY-MM-DD' → número de día dentro del año (1 = 1 de enero). */
export const dayOfYear = (iso: string): number => {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.round(
    (Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86_400_000,
  ) + 1;
};

/** Fecha local (YYYY-MM-DD) de hoy. */
export const todayIso = (): string => {
  const n = new Date();
  const p = (v: number) => String(v).padStart(2, "0");
  return `${n.getFullYear()}-${p(n.getMonth() + 1)}-${p(n.getDate())}`;
};

const MONTHS = [
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

const WEEKDAYS = [
  "domingo",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
];

/** '2026-09-11' → 'viernes, 11 de septiembre'. */
export const formatLongDate = (iso: string): string => {
  const [y, m, d] = iso.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${WEEKDAYS[dow]}, ${d} de ${MONTHS[m - 1]}${y !== new Date().getFullYear() ? ` de ${y}` : ""}`;
};

/** Días restantes hasta la fecha (negativo = ya pasó). */
export const daysUntil = (iso: string): number => {
  const [y, m, d] = iso.split("-").map(Number);
  const [ty, tm, td] = todayIso().split("-").map(Number);
  return Math.round(
    (Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / 86_400_000,
  );
};

// ---------------------------------------------------------------------------
// Expansión de eventos recurrentes
// ---------------------------------------------------------------------------

/** Instancia de un evento en un año concreto. */
const instanceInYear = (ev: CalendarEvent, year: number): CalendarEvent => {
  const [, m, d] = ev.date.split("-");
  return {
    ...ev,
    id: `${ev.id}@${year}`,
    date: `${year}-${m}-${d}`,
    endDate: ev.endDate ? `${year}-${ev.endDate.split("-")[1]}-${ev.endDate.split("-")[2]}` : undefined,
  };
};

/**
 * Todos los eventos visibles en un año, expandidos: los recurrentes ocupan
 * una entrada por año y los puntuales solo aparecen en su año original.
 */
export const expandEventsForYear = (
  events: CalendarEvent[],
  year: number,
): CalendarEvent[] => {
  const out: CalendarEvent[] = [];
  for (const ev of events) {
    if (ev.recurring) {
      out.push(instanceInYear(ev, year));
    } else if (Number(ev.date.slice(0, 4)) === year) {
      out.push(ev);
    }
  }
  return out.sort(
    (a, b) => dayOfYear(a.date) - dayOfYear(b.date) || a.title.localeCompare(b.title),
  );
};

/** ¿El evento ocupa la fecha dada (teniendo en cuenta rangos)? */
export const eventCovers = (ev: CalendarEvent, iso: string): boolean => {
  if (!ev.endDate) return ev.date === iso;
  return iso >= ev.date && iso <= ev.endDate;
};

// ---------------------------------------------------------------------------
// Semilla: acontecimientos de cara a 2026-2028
// ---------------------------------------------------------------------------
// Nota: las fechas de convocatoria electoral se revisan en cada ciclo; las
// marcadas con «orientativa» se confirman contra el calendario oficial antes
// de usarlas como titular.

const SEED: Array<Omit<CalendarEvent, "id" | "source">> = [
  // ── Elecciones ──────────────────────────────────────────────────────────
  {
    title: "Brasil · Segunda vuelta presidencial",
    date: "2026-10-25",
    kind: "eleccion",
    country: "BR",
    category: "GEOPOLÍTICA",
    notes: "Definición del presidencialismo tras la primera vuelta de octubre.",
  },
  {
    title: "Estados Unidos · Elecciones legislativas (midterms)",
    date: "2026-11-03",
    kind: "eleccion",
    country: "US",
    category: "GEOPOLÍTICA",
    notes: "Cámara completa y un tercio del Senado. Define el mapa legislativo de la segunda mitad de mandato.",
  },
  {
    title: "Nigeria · Elecciones generales",
    date: "2027-02-25",
    kind: "eleccion",
    country: "NG",
    category: "GEOPOLÍTICA",
    notes: "Fecha orientativa: el ciclo electoral nigeriano se confirma con la convocatoria oficial.",
  },
  {
    title: "Francia · Elecciones presidenciales (primera vuelta)",
    date: "2027-04-25",
    kind: "eleccion",
    country: "FR",
    category: "GEOPOLÍTICA",
    notes: "Fecha orientativa. Segunda vuelta dos semanas después.",
  },
  {
    title: "Italia · Elecciones generales (término de legislatura)",
    date: "2027-05-01",
    kind: "eleccion",
    country: "IT",
    category: "GEOPOLÍTICA",
    notes: "Fecha orientativa: el Parlamento caduca en mayo de 2027; puede adelantarse.",
  },
  {
    title: "Colombia · Presidenciales, primera vuelta",
    date: "2027-05-30",
    kind: "eleccion",
    country: "CO",
    category: "GEOPOLÍTICA",
  },
  {
    title: "Colombia · Presidenciales, segunda vuelta",
    date: "2027-06-20",
    kind: "eleccion",
    country: "CO",
    category: "GEOPOLÍTICA",
  },
  {
    title: "España · Término máximo de la legislatura",
    date: "2027-08-01",
    kind: "eleccion",
    country: "ES",
    category: "GEOPOLÍTICA",
    notes: "Fecha orientativa: disolución de Cortes y convocatoria de generales antes de esta fecha.",
  },
  {
    title: "Argentina · Elecciones legislativas",
    date: "2027-10-31",
    kind: "eleccion",
    country: "AR",
    category: "GEOPOLÍTICA",
    notes: "Último domingo de octubre: renovación de diputados y senadores.",
  },
  {
    title: "Paraguay · Elecciones generales",
    date: "2028-04-30",
    kind: "eleccion",
    country: "PY",
    category: "GEOPOLÍTICA",
    notes: "Último domingo de abril: presidenciales y parlamento.",
  },
  {
    title: "México · Elecciones estatales",
    date: "2027-06-06",
    kind: "eleccion",
    country: "MX",
    category: "GEOPOLÍTICA",
    notes: "Fecha orientativa: renovación de governorías y congresos locales.",
  },

  // ── Cumbres y citas internacionales ─────────────────────────────────────
  {
    title: "Foro de Davos (WEF)",
    date: "2027-01-18",
    endDate: "2027-01-22",
    kind: "cumbre",
    country: "GLOBAL",
    category: "ECONOMÍA & MERCADOS",
    notes: "Reunión anual de líderes económicos y políticos en Suiza.",
  },
  {
    title: "COP31 · Cumbre del Clima",
    date: "2026-11-09",
    endDate: "2026-11-20",
    kind: "cumbre",
    country: "TR",
    category: "ENERGÍA & INDUSTRIA",
    notes: "Sede propuesta: Antalya (Turquía), pendiente de confirmación definitiva. Fecha orientativa.",
  },
  {
    title: "Asamblea General de la ONU (semana de alto nivel)",
    date: "2027-09-21",
    endDate: "2027-09-27",
    kind: "cumbre",
    country: "US",
    category: "GEOPOLÍTICA",
    notes: "Nueva York. Fecha orientativa según el patrón histórico del tercer lunes de septiembre.",
  },

  // ── Economía & mercados ─────────────────────────────────────────────────
  {
    title: "Temporada de resultados del cuarto trimestre",
    date: "2027-01-12",
    endDate: "2027-02-28",
    kind: "economia",
    country: "GLOBAL",
    category: "ECONOMÍA & MERCADOS",
    notes: "Ventana de publicación de balances de las grandes cotizadas.",
  },
  {
    title: "Reunión anual del FMI y Banco Mundial",
    date: "2027-10-11",
    endDate: "2027-10-17",
    kind: "economia",
    country: "GLOBAL",
    category: "ECONOMÍA & MERCADOS",
    notes: "Fecha orientativa: segunda semana de octubre.",
  },

  // ── Deporte ─────────────────────────────────────────────────────────────
  {
    title: "Super Bowl LXI",
    date: "2027-02-14",
    kind: "deporte",
    country: "US",
    notes: "Final de la NFL. Sede orientativa: SoFi Stadium (Inglewood, California).",
  },
  {
    title: "Copa del Mundo Femenina de la FIFA",
    date: "2027-06-24",
    endDate: "2027-07-25",
    kind: "deporte",
    country: "BR",
    notes: "Brasil es sede: mayor cita del fútbol femenino.",
  },
  {
    title: "Final de la UEFA Champions League",
    date: "2027-05-29",
    kind: "deporte",
    country: "HU",
    notes: "Sede orientativa: Budapest. La UEFA confirma el estadio con antelación.",
  },
  {
    title: "Juegos Panamericanos",
    date: "2027-11-01",
    endDate: "2027-11-16",
    kind: "deporte",
    country: "CO",
    notes: "Fecha orientativa: Barranquilla es sede de la edición.",
  },
  {
    title: "Juegos Olímpicos de Los Ángeles 2028",
    date: "2028-07-14",
    endDate: "2028-07-30",
    kind: "deporte",
    country: "US",
  },

  // ── Efemérides históricas (anuales) ─────────────────────────────────────
  {
    title: "11-S · Atentados de Nueva York y Washington",
    date: "2001-09-11",
    kind: "efemeride",
    country: "US",
    recurring: true,
    notes: "Aniversario de los atentados del 11 de septiembre de 2001.",
  },
  {
    title: "11-S · Golpe de Estado en Chile",
    date: "1973-09-11",
    kind: "efemeride",
    country: "CL",
    recurring: true,
    notes: "Aniversario del golpe de 1973 y el inicio de la dictadura.",
  },
  {
    title: "24-F · Golpe de Estado en Uruguay",
    date: "1973-02-24",
    kind: "efemeride",
    country: "UY",
    recurring: true,
    notes: "Aniversario del golpe de Estado de 1973.",
  },
  {
    title: "24 de marzo · Golpe de Estado en Argentina",
    date: "1976-03-24",
    kind: "efemeride",
    country: "AR",
    recurring: true,
    notes: "Aniversario del inicio de la última dictadura militar.",
  },
  {
    title: "2 de abril · Día del Veterano y de los Caídos en Malvinas",
    date: "1982-04-02",
    kind: "efemeride",
    country: "AR",
    recurring: true,
  },
  {
    title: "9 de julio · Declaración de la Independencia",
    date: "1816-07-09",
    kind: "efemeride",
    country: "AR",
    recurring: true,
  },
  {
    title: "28 de julio · Independencia del Perú",
    date: "1821-07-28",
    kind: "efemeride",
    country: "PE",
    recurring: true,
  },
  {
    title: "20 de julio · Independencia de Colombia",
    date: "1810-07-20",
    kind: "efemeride",
    country: "CO",
    recurring: true,
  },
  {
    title: "6 de agosto · Independencia de Bolivia",
    date: "1825-08-06",
    kind: "efemeride",
    country: "BO",
    recurring: true,
  },
  {
    title: "7 de septiembre · Independencia de Brasil",
    date: "1822-09-07",
    kind: "efemeride",
    country: "BR",
    recurring: true,
  },
  {
    title: "16 de septiembre · Grito de Dolores (México)",
    date: "1810-09-16",
    kind: "efemeride",
    country: "MX",
    recurring: true,
  },
  {
    title: "15 de septiembre · Independencia de Centroamérica",
    date: "1821-09-15",
    kind: "efemeride",
    country: "GT",
    recurring: true,
    notes: "Aniversario de la independencia de Guatemala, El Salvador, Honduras, Nicaragua y Costa Rica.",
  },
  {
    title: "18 de septiembre · Fiestas Patrias de Chile",
    date: "1810-09-18",
    kind: "efemeride",
    country: "CL",
    recurring: true,
  },
  {
    title: "12 de octubre · Fiesta Nacional de España",
    date: "1492-10-12",
    kind: "efemeride",
    country: "ES",
    recurring: true,
  },
  {
    title: "10 de octubre · Grito de Yara (Cuba)",
    date: "1868-10-10",
    kind: "efemeride",
    country: "CU",
    recurring: true,
  },
  {
    title: "2 de noviembre · Día de Muertos",
    date: "2020-11-02",
    kind: "efemeride",
    country: "MX",
    recurring: true,
  },
  {
    title: "20 de noviembre · Revolución Mexicana",
    date: "1910-11-20",
    kind: "efemeride",
    country: "MX",
    recurring: true,
  },
  {
    title: "25 de noviembre · Día Internacional de la Eliminación de la Violencia contra la Mujer",
    date: "1960-11-25",
    kind: "efemeride",
    country: "GLOBAL",
    recurring: true,
  },
  {
    title: "10 de diciembre · Día de los Derechos Humanos",
    date: "1948-12-10",
    kind: "efemeride",
    country: "GLOBAL",
    recurring: true,
    notes: "Aniversario de la aprobación de la Declaración Universal por la ONU (1948).",
  },
  {
    title: "Referéndum constitutivo de la Constitución Española",
    date: "1978-12-06",
    kind: "efemeride",
    country: "ES",
    recurring: true,
    notes: "Aniversario del referéndum de 1978 en el que se aprobó la Constitución.",
  },
  {
    title: "25 de diciembre · Navidad",
    date: "2020-12-25",
    kind: "efemeride",
    country: "GLOBAL",
    recurring: true,
  },
  {
    title: "1 de enero · Año Nuevo",
    date: "2021-01-01",
    kind: "efemeride",
    country: "GLOBAL",
    recurring: true,
  },
  {
    title: "8 de marzo · Día Internacional de la Mujer",
    date: "1910-03-08",
    kind: "efemeride",
    country: "GLOBAL",
    recurring: true,
  },
  {
    title: "1 de mayo · Día Internacional del Trabajo",
    date: "1886-05-01",
    kind: "efemeride",
    country: "GLOBAL",
    recurring: true,
  },
  {
    title: "5 de mayo · Batalla de Puebla",
    date: "1862-05-05",
    kind: "efemeride",
    country: "MX",
    recurring: true,
  },
  {
    title: "8 de mayo · Fin de la Segunda Guerra Mundial en Europa",
    date: "1945-05-08",
    kind: "efemeride",
    country: "GLOBAL",
    recurring: true,
  },
  {
    title: "25 de abril · Revolución de los Claveles (Portugal)",
    date: "1974-04-25",
    kind: "efemeride",
    country: "PT",
    recurring: true,
  },
  {
    title: "23 de abril · Día del Libro",
    date: "1995-04-23",
    kind: "efemeride",
    country: "GLOBAL",
    recurring: true,
    notes: "Aniversario de la muerte de Cervantes y Shakespeare (1616).",
  },
  {
    title: "21 de junio · Solsticio y Día de la Música",
    date: "2020-06-21",
    kind: "efemeride",
    country: "GLOBAL",
    recurring: true,
  },
  {
    title: "5 de junio · Día Mundial del Medio Ambiente",
    date: "1974-06-05",
    kind: "efemeride",
    country: "GLOBAL",
    recurring: true,
  },
  {
    title: "6 de agosto · Bombardeo atómico de Hiroshima",
    date: "1945-08-06",
    kind: "efemeride",
    country: "JP",
    recurring: true,
  },
  {
    title: "9 de agosto · Bombardeo atómico de Nagasaki",
    date: "1945-08-09",
    kind: "efemeride",
    country: "JP",
    recurring: true,
  },
  {
    title: "15 de agosto · Fin de la Segunda Guerra Mundial",
    date: "1945-08-15",
    kind: "efemeride",
    country: "GLOBAL",
    recurring: true,
    notes: "Rendición de Japón: fin definitivo del conflicto.",
  },
  {
    title: "24 de octubre · Día de las Naciones Unidas",
    date: "1945-10-24",
    kind: "efemeride",
    country: "GLOBAL",
    recurring: true,
    notes: "Aniversario de la entrada en vigor de la Carta de la ONU.",
  },
  {
    title: "9 de noviembre · Caída del Muro de Berlín",
    date: "1989-11-09",
    kind: "efemeride",
    country: "DE",
    recurring: true,
  },
  {
    title: "11 de noviembre · Armisticio de la Primera Guerra Mundial",
    date: "1918-11-11",
    kind: "efemeride",
    country: "GLOBAL",
    recurring: true,
  },
  {
    title: "3 de diciembre · Día Internacional de las Personas con Discapacidad",
    date: "1992-12-03",
    kind: "efemeride",
    country: "GLOBAL",
    recurring: true,
  },

  // ── Recordatorios de redacción ──────────────────────────────────────────
  {
    title: "Cierre de la ronda de presentación de cuentas anuales",
    date: "2027-03-31",
    kind: "recordatorio",
    country: "GLOBAL",
    category: "ECONOMÍA & MERCADOS",
    notes: "Último plazo habitual de depósito de cuentas anuales en los mercados europeos.",
  },
  {
    title: "Revisión anual de tarifas y planes de suscripción",
    date: "2027-01-05",
    kind: "recordatorio",
    country: "GLOBAL",
    notes: "Repaso de precios, planes y límites del plan gratuito antes del arranque del año.",
  },
];

/** Semilla precargada con IDs estables. */
export const SEED_EVENTS: CalendarEvent[] = SEED.map((ev, i) => ({
  ...ev,
  id: `seed-${String(i + 1).padStart(2, "0")}`,
  source: "seed" as const,
}));

// ---------------------------------------------------------------------------
// Persistencia local
// ---------------------------------------------------------------------------
const LS_KEY = "blacknews_editorial_calendar";

/** Lee la copia local; si no hay nada devuelve la semilla. */
export const readLocalEvents = (): CalendarEvent[] => {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return SEED_EVENTS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return SEED_EVENTS;
    return parsed as CalendarEvent[];
  } catch {
    return SEED_EVENTS;
  }
};

export const writeLocalEvents = (events: CalendarEvent[]): void => {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(events));
  } catch {
    /* sin espacio: se sigue con la copia en memoria */
  }
};
