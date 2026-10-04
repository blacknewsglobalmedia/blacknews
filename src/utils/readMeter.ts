/**
 * Medidor de lecturas gratuitas con reinicio diario.
 *
 * Reglas (04/10/2026):
 * - invitado (sin registro): 2 artículos al día,
 * - registrado (con sesión): 3 al día,
 * - suscriptores de pago y redacción (ADMIN/MODERADOR/REDACTOR): sin límite.
 *
 * Al llegar al límite NO se bloquea la lectura: el artículo se abre y muestra
 * un aviso con la opción de suscribirse. Solo se cuentan artículos distintos,
 * de modo que volver a abrir uno ya leído hoy no consume cuota.
 */

const KEY = "blacknews_free_reads";

export const FREE_LIMIT_GUEST = 2;
export const FREE_LIMIT_REGISTERED = 3;

export interface ReadUsage {
  /** Día (YYYY-MM-DD) al que pertenecen los ids. */
  date: string;
  /** Artículos únicos abiertos ese día. */
  ids: string[];
}

export type ReadMeterKind = "guest" | "registered" | "subscriber" | "staff";

export interface ReadMeter {
  kind: ReadMeterKind;
  /** Sin límite: suscriptor de pago o redacción. */
  unlimited: boolean;
  /** Cuota del día (0 cuando no aplica). */
  limit: number;
  /** Artículos únicos leídos hoy. */
  used: number;
  /** Cuota pendiente (nunca negativa). */
  remaining: number;
  /** Cuota consumida hoy. */
  exhausted: boolean;
}

function todayKey(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/**
 * Uso guardado hoy. Si la cuota es de otro día (o storage no disponible)
 * devuelve el día actual a cero.
 */
export function loadReadUsage(): ReadUsage {
  const today = todayKey();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (
        data &&
        data.date === today &&
        Array.isArray(data.ids) &&
        data.ids.every((id: unknown) => typeof id === "string")
      ) {
        return { date: today, ids: data.ids as string[] };
      }
    }
  } catch {
    /* modo privado o storage lleno: la cuota empieza en cero */
  }
  return { date: today, ids: [] };
}

export function saveReadUsage(usage: ReadUsage): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(usage));
  } catch {
    /* sin storage la lectura sigue adelante sin contarse */
  }
}

/** Devuelve el uso con el artículo añadido (sin duplicar) y lo persiste. */
export function recordRead(current: ReadUsage, reportId: string): ReadUsage {
  // Si la cuota guardada es de otro día (pestaña abierta toda la noche), se reinicia
  const base: ReadUsage =
    current.date === todayKey() ? current : { date: todayKey(), ids: [] };
  const next: ReadUsage = base.ids.includes(reportId)
    ? base
    : { ...base, ids: [...base.ids, reportId] };
  if (next !== current) saveReadUsage(next);
  return next;
}

interface MeterInputs {
  isSubscribed: boolean;
  /** Sin sesión de lector (invitado). */
  isGuest: boolean;
  /** Redacción: ADMIN, MODERADOR o REDACTOR. */
  isStaff: boolean;
}

export function computeReadMeter(
  usage: ReadUsage,
  { isSubscribed, isGuest, isStaff }: MeterInputs,
): ReadMeter {
  if (isSubscribed || isStaff) {
    return {
      kind: isSubscribed ? "subscriber" : "staff",
      unlimited: true,
      limit: 0,
      used: usage.ids.length,
      remaining: 0,
      exhausted: false,
    };
  }

  const limit = isGuest ? FREE_LIMIT_GUEST : FREE_LIMIT_REGISTERED;
  // Cuota heredada de otro día: se cuenta como si aún no se hubiera leído nada
  const used = usage.date === todayKey() ? usage.ids.length : 0;
  const remaining = Math.max(0, limit - used);

  return {
    kind: isGuest ? "guest" : "registered",
    unlimited: false,
    limit,
    used,
    remaining,
    exhausted: remaining === 0,
  };
}
