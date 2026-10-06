/**
 * Reacciones y comentarios de los lectores al final de cada informe.
 *
 * - "Me gusta" 👍: un voto por (post, correo), activar/desactiva con contador.
 * - Comentarios: lista pública + formulario con la cuota diaria del plan
 *   (ver utils/commentMeter). Los invitados ven todo pero deben iniciar
 *   sesión con Google para reaccionar o escribir.
 */

import React, { useEffect, useState } from "react";
import {
  Lock,
  LogIn,
  MessageCircle,
  Send,
  ThumbsUp,
  Trash2,
} from "lucide-react";
import { Report } from "../types/news";
import { RedactorProfile } from "../types/auth";
import { CommentMeter, COMMENT_MAX_LENGTH } from "../utils/commentMeter";
import {
  LikeState,
  PostComment,
  deleteComment,
  fetchComments,
  fetchLikes,
  publishComment,
  setLike,
} from "../utils/comments";

interface PostInteractionsProps {
  report: Report;
  /** Perfil de la sesión actual (firma los comentarios). */
  currentUser: RedactorProfile;
  /** Hay sesión con correo (no invitado). */
  signedIn: boolean;
  /** Cuota diaria de comentarios del plan. */
  meter: CommentMeter;
  /** Tras publicar con éxito: consume la cuota del día. */
  onCommentPosted: () => void;
  /** Abre el login de Google (invitado que intenta reaccionar/comentar). */
  onOpenGoogleAuth: () => void;
  /** Abre el modal de suscripciones desde el aviso de cuota agotada. */
  onOpenSubscription?: () => void;
}

/** "hace 5 min" / "hace 2 h" / "hace 3 d" … */
function ago(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return "ahora mismo";
  const m = Math.floor(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `hace ${d} d`;
  const w = Math.floor(d / 7);
  if (w < 5) return `hace ${w} sem`;
  return new Date(ts).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "2-digit",
  });
}

/** Mensaje amable para los errores de Firestore. */
function friendlyError(e: unknown): string {
  const code = typeof e === "object" && e && "code" in e ? String((e as { code: unknown }).code) : "";
  if (code.includes("permission-denied")) {
    return "Tu sesión no está verificada con Google. Inicia sesión con una cuenta de Google para publicar.";
  }
  return "No se pudo publicar. Comprueba tu conexión e inténtalo de nuevo.";
}

export const PostInteractions: React.FC<PostInteractionsProps> = ({
  report,
  currentUser,
  signedIn,
  meter,
  onCommentPosted,
  onOpenGoogleAuth,
  onOpenSubscription,
}) => {
  const [comments, setComments] = useState<PostComment[] | null>(null);
  const [likes, setLikes] = useState<LikeState | null>(null);
  const [draft, setDraft] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cargar comentarios y reacciones del post abierto
  useEffect(() => {
    let alive = true;
    setComments(null);
    setLikes(null);
    setError(null);
    setDraft("");
    fetchComments(report.id)
      .then((list) => {
        if (alive) setComments(list);
      })
      .catch(() => {
        if (alive) setComments([]);
      });
    fetchLikes(report.id, signedIn ? currentUser.email : null)
      .then((state) => {
        if (alive) setLikes(state);
      })
      .catch(() => {
        if (alive) setLikes({ count: 0, mine: false });
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report.id]);

  const handleLike = async () => {
    if (!signedIn) {
      onOpenGoogleAuth();
      return;
    }
    if (!likes) return;
    const turnOn = !likes.mine;
    const prev = likes;
    setLikes({
      count: likes.count + (turnOn ? 1 : -1),
      mine: turnOn,
    });
    try {
      await setLike(report.id, currentUser.email, turnOn);
    } catch (e) {
      setLikes(prev);
      setError(friendlyError(e));
    }
  };

  const handlePublish = async () => {
    const text = draft.trim();
    if (!text || publishing) return;
    if (text.length > COMMENT_MAX_LENGTH) return;
    if (!meter.unlimited && meter.remaining <= 0) return;
    setPublishing(true);
    setError(null);
    try {
      await publishComment({
        reportId: report.id,
        authorEmail: currentUser.email,
        authorName: currentUser.name,
        avatarInitials: currentUser.avatarInitials,
        authorAvatar: currentUser.avatarUrl,
        text,
      });
      setDraft("");
      onCommentPosted();
      const list = await fetchComments(report.id);
      setComments(list);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setPublishing(false);
    }
  };

  const handleDelete = async (id: string) => {
    const prev = comments;
    setComments((cur) => (cur ? cur.filter((c) => c.id !== id) : cur));
    try {
      await deleteComment(id);
    } catch (e) {
      setComments(prev);
      setError(friendlyError(e));
    }
  };

  return (
    <section className="mt-12 font-sans" aria-label="Reacciones y comentarios">
      {/* Barra de reacciones */}
      <div className="flex flex-wrap items-center gap-3 sm:gap-4 py-4 border-y border-white/10">
        <button
          type="button"
          onClick={handleLike}
          disabled={!likes}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer disabled:cursor-default ${
            likes?.mine
              ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
              : "border-white/10 bg-white/[0.03] text-neutral-300 hover:border-white/30 hover:text-white"
          }`}
          title={signedIn ? "Me gusta" : "Inicia sesión para reaccionar"}
        >
          <ThumbsUp className="w-4 h-4" />
          <span className="font-mono">{likes ? likes.count : 0}</span>
          <span>{likes?.mine ? "Te gusta" : "Me gusta"}</span>
        </button>
        <div className="flex items-center gap-1.5 text-xs text-neutral-500">
          <MessageCircle className="w-3.5 h-3.5" />
          <span>
            {comments === null
              ? "Cargando comentarios…"
              : `${comments.length} ${comments.length === 1 ? "comentario" : "comentarios"}`}
          </span>
        </div>
      </div>

      {/* Comentarios */}
      <div className="mt-7">
        <h3 className="text-xs uppercase tracking-widest text-neutral-400 font-semibold mb-5">
          COMENTARIOS DE LOS LECTORES
        </h3>

        {error && (
          <p className="mb-4 text-xs text-red-400 bg-red-950/40 border border-red-500/30 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {/* Formulario (con sesión y cuota disponible) */}
        {signedIn && !meter.exhausted && (
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <div className="flex items-start gap-3">
              {currentUser.avatarUrl ? (
                <img
                  src={currentUser.avatarUrl}
                  alt={currentUser.name}
                  className="w-8 h-8 shrink-0 rounded-lg object-cover border border-white/10"
                />
              ) : (
                <div className="w-8 h-8 shrink-0 rounded-lg bg-white text-black font-extrabold flex items-center justify-center text-xs">
                  {currentUser.avatarInitials}
                </div>
              )}
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={COMMENT_MAX_LENGTH}
                rows={3}
                placeholder="Escribe un comentario sobre este informe…"
                className="flex-1 min-w-0 resize-none bg-transparent text-base text-white placeholder:text-neutral-500 font-light leading-relaxed focus:outline-none"
              />
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <span className="font-mono text-[11px] text-neutral-500">
                {draft.length}/{COMMENT_MAX_LENGTH}
                {" · "}
                {meter.unlimited
                  ? "comentarios ilimitados"
                  : `${meter.remaining} de ${meter.limit} hoy`}
              </span>
              <button
                type="button"
                onClick={handlePublish}
                disabled={publishing || !draft.trim()}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-white text-black hover:bg-neutral-200 disabled:opacity-40 text-xs font-bold uppercase tracking-wider rounded-md transition-colors cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                {publishing ? "Publicando…" : "Publicar"}
              </button>
            </div>
          </div>
        )}

        {/* Cuota agotada: aviso + suscripción (nunca se bloquea el artículo) */}
        {signedIn && meter.exhausted && (
          <div className="p-4 rounded-xl border border-emerald-500/40 bg-emerald-950/40">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-emerald-300 mb-2">
              <Lock className="w-3.5 h-3.5" />
              <span>Comentarios gratuitos agotados</span>
            </div>
            <p className="text-xs sm:text-sm text-neutral-300 font-light leading-relaxed">
              Has utilizado tus{" "}
              <span className="text-white font-semibold">
                {meter.limit} comentarios de hoy
              </span>
              . La cuota se renueva cada día; con una suscripción tienes más
              (y en Intelligence, ilimitados).
            </p>
            {onOpenSubscription && (
              <button
                type="button"
                onClick={onOpenSubscription}
                className="mt-3.5 px-5 py-2.5 bg-emerald-400 hover:bg-emerald-300 text-black text-xs font-bold uppercase tracking-wider rounded-md transition-colors cursor-pointer"
              >
                Ver suscripciones
              </button>
            )}
          </div>
        )}

        {/* Invitado: login para reaccionar y comentar */}
        {!signedIn && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-white/10 bg-white/[0.02]">
            <p className="text-xs sm:text-sm text-neutral-400 font-light leading-relaxed">
              Inicia sesión con Google para reaccionar y comentar este
              informe.
            </p>
            <button
              type="button"
              onClick={onOpenGoogleAuth}
              className="flex items-center justify-center gap-1.5 shrink-0 px-4 py-2.5 bg-white text-black hover:bg-neutral-200 text-xs font-bold uppercase tracking-wider rounded-md transition-colors cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              Iniciar sesión
            </button>
          </div>
        )}

        {/* Lista */}
        <div className="mt-6">
          {comments === null ? (
            <p className="text-xs text-neutral-500 font-light">
              Cargando comentarios…
            </p>
          ) : comments.length === 0 ? (
            <p className="text-xs text-neutral-500 font-light">
              Sé el primero en comentar este informe.
            </p>
          ) : (
            <ul className="space-y-5">
              {comments.map((c) => (
                <li
                  key={c.id}
                  className="flex items-start gap-3 border-b border-white/5 pb-5 last:border-0 last:pb-0"
                >
                  {c.authorAvatar ? (
                    <img
                      src={c.authorAvatar}
                      alt={c.authorName}
                      className="w-8 h-8 shrink-0 rounded-lg object-cover border border-white/10"
                    />
                  ) : (
                    <div className="w-8 h-8 shrink-0 rounded-lg bg-white text-black font-extrabold flex items-center justify-center text-xs">
                      {c.avatarInitials}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-white">
                        {c.authorName}
                      </span>
                      <span className="text-[10px] font-mono text-neutral-500">
                        {ago(c.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-neutral-300 font-light leading-relaxed whitespace-pre-wrap break-words">
                      {c.text}
                    </p>
                  </div>
                  {signedIn && c.authorEmail === currentUser.email && (
                    <button
                      type="button"
                      onClick={() => handleDelete(c.id)}
                      className="p-2.5 -m-1 rounded text-neutral-500 hover:text-red-400 hover:bg-white/5 transition-colors cursor-pointer shrink-0"
                      title="Eliminar mi comentario"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
};
