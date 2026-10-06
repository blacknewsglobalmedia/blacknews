/**
 * Cuota diaria de comentarios en los posts (con reinicio diario).
 *
 * Reglas (06/10/2026):
 * - plan gratuito: 3 comentarios al día,
 * - BlackNews Access: 10 al día,
 * - BlackNews Insight: 30 al día,
 * - BlackNews Intelligence y redacción (ADMIN/MODERADOR/REDACTOR): sin límite.
 *
 * Igual que las lecturas gratuitas, la cuota vive en el dispositivo: al
 * agotarse NO se bloquea el artículo, solo el formulario de comentarios, que
 * se sustituye por un aviso con la opción de suscribirse.
 */

const KEY = "blacknews_comment_usage";

export const COMMENT_LIMIT_FREE = 3;
export const COMMENT_LIMIT_ACCESS = 10;
export const COMMENT_LIMIT_INSIGHT = 30;

/** Longitud máxima del texto de un comentario (validada también en firestore.rules). */
export const COMMENT_MAX_LENGTH = 600;

export interface CommentUsage {
  /** Día (YYYY-MM-DD) al que pertenece el contador. */
  date: string;
  /** Comentarios publicados ese día. */
  count: number;
}

export interface CommentMeter {
  /** Sin límite: Intelligence o redacción. */
  unlimited: boolean;
  /** Cuota del día (0 cuando no aplica). */
  limit: number;
  /** Comentarios publicados hoy. */
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

/** Uso guardado hoy; si la cuota es de otro día (o storage no disponible), cero. */
export function loadCommentUsage(): CommentUsage {
  const today = todayKey();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data && data.date === today && typeof data.count === "number") {
        return { date: today, count: Math.max(0, Math.floor(data.count)) };
      }
    }
  } catch {
    /* modo privado o storage lleno: la cuota empieza en cero */
  }
  return { date: today, count: 0 };
}

function saveCommentUsage(usage: CommentUsage): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(usage));
  } catch {
    /* sin storage la publicación sigue adelante sin contarse */
  }
}

/** Devuelve el uso con un comentario añadido y lo persiste. */
export function recordComment(current: CommentUsage): CommentUsage {
  // Cuota heredada de otro día (pestaña abierta toda la noche): reinicia
  const base: CommentUsage =
    current.date === todayKey() ? current : { date: todayKey(), count: 0 };
  const next: CommentUsage = { ...base, count: base.count + 1 };
  saveCommentUsage(next);
  return next;
}

interface MeterInputs {
  /** Plan de pago activo (null = plan gratuito). */
  plan: "access" | "insight" | "intelligence" | null;
  /** Redacción: ADMIN, MODERADOR o REDACTOR. */
  isStaff: boolean;
}

export function computeCommentMeter(
  usage: CommentUsage,
  { plan, isStaff }: MeterInputs,
): CommentMeter {
  if (isStaff || plan === "intelligence") {
    return {
      unlimited: true,
      limit: 0,
      used: usage.count,
      remaining: 0,
      exhausted: false,
    };
  }

  const limit =
    plan === "access"
      ? COMMENT_LIMIT_ACCESS
      : plan === "insight"
        ? COMMENT_LIMIT_INSIGHT
        : COMMENT_LIMIT_FREE;
  const used = usage.date === todayKey() ? usage.count : 0;
  const remaining = Math.max(0, limit - used);

  return {
    unlimited: false,
    limit,
    used,
    remaining,
    exhausted: remaining === 0,
  };
}
