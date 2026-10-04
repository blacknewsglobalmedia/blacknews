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
}

/** Ciudades mostradas en la barra marquee y en su panel (Uruguay primero). */
export const CLOCK_CITIES: ClockCity[] = [
  { flag: "🇺🇾", name: "MONTEVIDEO", tz: "America/Montevideo" },
  { flag: "🇦🇷", name: "BUENOS AIRES", tz: "America/Argentina/Buenos_Aires" },
  { flag: "🇧🇷", name: "SÃO PAULO", tz: "America/Sao_Paulo" },
  { flag: "🇨🇱", name: "SANTIAGO", tz: "America/Santiago" },
  { flag: "🇨🇴", name: "BOGOTÁ", tz: "America/Bogota" },
  { flag: "🇲🇽", name: "CIUDAD DE MÉXICO", tz: "America/Mexico_City" },
  { flag: "🇺🇸", name: "NUEVA YORK", tz: "America/New_York" },
  { flag: "🇪🇸", name: "MADRID", tz: "Europe/Madrid" },
  { flag: "🇫🇷", name: "PARÍS", tz: "Europe/Paris" },
  { flag: "🇩🇪", name: "BERLÍN", tz: "Europe/Berlin" },
  { flag: "🇬🇧", name: "LONDRES", tz: "Europe/London" },
  { flag: "🇨🇭", name: "ZÚRICH", tz: "Europe/Zurich" },
  { flag: "🇮🇹", name: "ROMA", tz: "Europe/Rome" },
  { flag: "🇷🇺", name: "MOSCÚ", tz: "Europe/Moscow" },
  { flag: "🇦🇪", name: "DUBÁI", tz: "Asia/Dubai" },
  { flag: "🇮🇳", name: "NUEVA DELHI", tz: "Asia/Kolkata" },
  { flag: "🇨🇳", name: "PEKÍN", tz: "Asia/Shanghai" },
  { flag: "🇯🇵", name: "TOKIO", tz: "Asia/Tokyo" },
  { flag: "🇰🇷", name: "SEÚL", tz: "Asia/Seoul" },
  { flag: "🇿🇦", name: "JOHANNESBURGO", tz: "Africa/Johannesburg" },
  { flag: "🇦🇺", name: "SÍDNEY", tz: "Australia/Sydney" },
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
