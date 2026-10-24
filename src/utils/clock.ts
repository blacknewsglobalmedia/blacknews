/**
 * Relojes del sitio.
 *
 * La referencia editorial es Uruguay (`REFERENCE_TZ`): con esa zona se
 * fechan las noticias, la fecha de cabecera y el sello del pie. La barra
 * inferior muestra esa hora como oficial y, al lado, la de los principales
 * países más la zona del propio visitante (detectada con `Intl`), para que
 * cualquiera tenga su hora a la vista.
 */

export const REFERENCE_TZ = "America/Montevideo";

export interface ClockCity {
  flag: string;
  name: string;
  /** Zona IANA, p. ej. "Europe/Madrid". */
  tz: string;
  /** Coordenadas del atlas [lon, lat] para el mapa del panel. */
  coords?: [number, number];
}

/** Ciudades mostradas en la barra marquee y en su panel (Uruguay primero). */
export const CLOCK_CITIES: ClockCity[] = [
  { flag: "🇺🇾", name: "MONTEVIDEO", tz: "America/Montevideo", coords: [-56.16, -34.9] },
  { flag: "🇦🇷", name: "BUENOS AIRES", tz: "America/Argentina/Buenos_Aires", coords: [-58.38, -34.6] },
  { flag: "🇧🇷", name: "SÃO PAULO", tz: "America/Sao_Paulo", coords: [-46.63, -23.55] },
  { flag: "🇨🇱", name: "SANTIAGO", tz: "America/Santiago", coords: [-70.65, -33.45] },
  { flag: "🇨🇴", name: "BOGOTÁ", tz: "America/Bogota", coords: [-74.07, 4.71] },
  { flag: "🇲🇽", name: "CIUDAD DE MÉXICO", tz: "America/Mexico_City", coords: [-99.13, 19.43] },
  { flag: "🇺🇸", name: "NUEVA YORK", tz: "America/New_York", coords: [-74.0, 40.71] },
  { flag: "🇪🇸", name: "MADRID", tz: "Europe/Madrid", coords: [-3.7, 40.42] },
  { flag: "🇫🇷", name: "PARÍS", tz: "Europe/Paris", coords: [2.35, 48.86] },
  { flag: "🇩🇪", name: "BERLÍN", tz: "Europe/Berlin", coords: [13.4, 52.52] },
  { flag: "🇬🇧", name: "LONDRES", tz: "Europe/London", coords: [-0.13, 51.51] },
  { flag: "🇨🇭", name: "ZÚRICH", tz: "Europe/Zurich", coords: [8.54, 47.37] },
  { flag: "🇮🇹", name: "ROMA", tz: "Europe/Rome", coords: [12.5, 41.9] },
  { flag: "🇷🇺", name: "MOSCÚ", tz: "Europe/Moscow", coords: [37.62, 55.75] },
  { flag: "🇦🇪", name: "DUBÁI", tz: "Asia/Dubai", coords: [55.27, 25.2] },
  { flag: "🇮🇳", name: "NUEVA DELHI", tz: "Asia/Kolkata", coords: [77.21, 28.61] },
  { flag: "🇨🇳", name: "PEKÍN", tz: "Asia/Shanghai", coords: [116.4, 39.9] },
  { flag: "🇯🇵", name: "TOKIO", tz: "Asia/Tokyo", coords: [139.69, 35.68] },
  { flag: "🇰🇷", name: "SEÚL", tz: "Asia/Seoul", coords: [126.98, 37.57] },
  { flag: "🇿🇦", name: "JOHANNESBURGO", tz: "Africa/Johannesburg", coords: [28.05, -26.2] },
  { flag: "🇦🇺", name: "SÍDNEY", tz: "Australia/Sydney", coords: [151.21, -33.87] },
];

const MONTHS = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

const pad = (n: number) => String(n).padStart(2, "0");

interface DateParts {
  day: number;
  month: number;
  year: number;
  hh: number;
  mm: number;
}

/** Fecha y hora en `tz`. Si el navegador no soporta la zona, usa la local. */
export function datePartsIn(tz: string, date: Date = new Date()): DateParts {
  try {
    const fmt = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const raw: Record<string, number> = {};
    for (const part of fmt.formatToParts(date)) {
      if (part.type !== "literal") raw[part.type] = Number(part.value);
    }
    const parts: DateParts = {
      day: raw.day,
      month: raw.month,
      year: raw.year,
      // en-GB devuelve 24 en algunos motores a medianoche
      hh: raw.hour % 24,
      mm: raw.minute,
    };
    if (!Object.values(parts).every((v) => Number.isFinite(v))) {
      throw new Error("Partes de fecha inválidas");
    }
    return parts;
  } catch {
    return {
      day: date.getDate(),
      month: date.getMonth() + 1,
      year: date.getFullYear(),
      hh: date.getHours(),
      mm: date.getMinutes(),
    };
  }
}

/** Hora en `tz`, tipo «05:59». */
export function timeIn(tz: string, date: Date = new Date()): string {
  const { hh, mm } = datePartsIn(tz, date);
  return `${pad(hh)}:${pad(mm)}`;
}

/** Fecha en `tz`, tipo «04 oct 2026». */
export function dateIn(tz: string, date: Date = new Date()): string {
  const { day, month, year } = datePartsIn(tz, date);
  return `${pad(day)} ${MONTHS[month - 1] ?? ""} ${year}`;
}

/**
 * Zona del visitante si aún no está en la lista (p. ej. «America/Asuncion»
 * → 🌐 ASUNCIÓN). Devuelve `null` cuando su hora ya se muestra.
 */
export function visitorClockCity(): ClockCity | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!tz || CLOCK_CITIES.some((c) => c.tz === tz)) return null;
    const label = tz.split("/").pop() ?? tz;
    return { flag: "🌐", name: label.replace(/_/g, " ").toUpperCase(), tz };
  } catch {
    return null;
  }
}
