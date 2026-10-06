import React from "react";
import {
  X,
  History,
  Bookmark,
  Megaphone,
  Trash2,
  ArrowUpRight,
  User,
} from "lucide-react";
import { Report } from "../types/news";
import { AdCampaign, AdStatus } from "../types/ads";
import { RedactorProfile } from "../types/auth";
import {
  HistoryEntry,
  HISTORY_LIMIT,
  FREE_BOOKMARK_LIMIT,
} from "../utils/readerPanel";

interface ReaderPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: RedactorProfile;
  isSubscribed: boolean;
  /** Últimas lecturas del dispositivo (más reciente primero). */
  history: HistoryEntry[];
  reports: Report[];
  /** Marcadores ya resueltos contra reports. */
  bookmarks: Report[];
  /** Total real de marcadores guardados (incluye los ya no disponibles). */
  bookmarksTotal: number;
  /** Publicidades enviadas por esta cuenta (applicantEmail). */
  myAds: AdCampaign[];
  onSelectReport: (report: Report) => void;
  onRemoveBookmark: (reportId: string) => void;
  onOpenBookmarks: () => void;
  onOpenCreateAd: () => void;
}

/** Chip de estado de una campaña (misma semántica que AdsManager). */
const statusChipClass = (status: AdStatus): string => {
  switch (status) {
    case "ACTIVE":
      return "border-emerald-500/50 bg-emerald-950/30 text-emerald-400";
    case "PENDIENTE_PAGO":
      return "border-amber-500/50 bg-amber-950/30 text-amber-400";
    case "PENDIENTE_APROBACION":
      return "border-sky-500/50 bg-sky-950/30 text-sky-400";
    case "RECHAZADA":
      return "border-red-500/50 bg-red-950/30 text-red-400";
    default:
      return "border-white/20 text-neutral-300";
  }
};

const fmtDate = (ts: number): string =>
  new Date(ts).toLocaleString("es-UY", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

export const ReaderPanel: React.FC<ReaderPanelProps> = ({
  isOpen,
  onClose,
  currentUser,
  isSubscribed,
  history,
  reports,
  bookmarks,
  bookmarksTotal,
  myAds,
  onSelectReport,
  onRemoveBookmark,
  onOpenBookmarks,
  onOpenCreateAd,
}) => {
  if (!isOpen) return null;

  const isStaff = currentUser.role !== "LECTOR";
  const unlimitedSaved = isSubscribed || isStaff;

  const planChip = isSubscribed
    ? {
        text: "PLAN ACTIVO",
        cls: "border-emerald-500/50 bg-emerald-950/30 text-emerald-400",
      }
    : isStaff
      ? { text: "REDACTIÓN", cls: "border-white/25 text-neutral-200" }
      : {
          text: "PLAN GRATUITO",
          cls: "border-amber-500/40 bg-amber-950/30 text-amber-400",
        };

  // Historial resuelto contra el catálogo actual (los borrados no se muestran)
  const byId = new Map(reports.map((r) => [r.id, r]));
  const historyRows = history
    .map((h) => ({ ts: h.ts, report: byId.get(h.id) }))
    .filter((row): row is { ts: number; report: Report } =>
      Boolean(row.report),
    );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in duration-150 font-sans">
      <div className="w-full max-w-2xl bg-black border border-white/10 rounded-xl shadow-2xl max-h-[92dvh] overflow-y-auto overscroll-contain">
        <div className="p-6 sm:p-8">
          {/* Header */}
          <div className="flex items-start justify-between pb-4 border-b border-white/10 mb-5">
            <div className="flex items-center gap-2.5">
              <User className="w-4 h-4 text-white shrink-0" />
              <div>
                <h2 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-white">
                  PANEL DEL LECTOR
                </h2>
                <div className="text-[11px] text-neutral-500 font-light mt-0.5">
                  {currentUser.email}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded border ${planChip.cls}`}
              >
                {planChip.text}
              </span>
              <button
                onClick={onClose}
                className="p-1.5 text-neutral-400 hover:text-white transition-colors cursor-pointer rounded-md hover:bg-white/5"
                aria-label="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Resumen en una línea */}
          <div className="flex items-center gap-3 text-[11px] font-mono text-neutral-500 mb-6">
            <span>
              LECTURAS{" "}
              <span className="text-neutral-300">
                {history.length}/{HISTORY_LIMIT}
              </span>
            </span>
            <span className="text-neutral-700">·</span>
            <span>
              GUARDADOS{" "}
              <span className="text-neutral-300">
                {bookmarksTotal}
                {unlimitedSaved ? "" : `/${FREE_BOOKMARK_LIMIT}`}
              </span>
            </span>
          </div>

          {/* 1) Historial */}
          <section className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-neutral-300">
                <History className="w-3.5 h-3.5 text-neutral-500" />
                <span>ÚLTIMAS LECTURAS</span>
              </div>
              <span className="text-[10px] font-mono text-neutral-600">
                {historyRows.length}/{HISTORY_LIMIT}
              </span>
            </div>

            {historyRows.length === 0 ? (
              <div className="py-5 text-center text-xs text-neutral-500 font-light leading-relaxed border border-white/5 rounded-lg">
                Aún no hay lecturas en este dispositivo. Los últimos{" "}
                {HISTORY_LIMIT} artículos que abras aparecerán aquí.
              </div>
            ) : (
              <div className="max-h-[34vh] overflow-y-auto pr-1 divide-y divide-white/5 border-y border-white/5">
                {historyRows.map((row) => (
                  <button
                    key={`${row.report.id}-${row.ts}`}
                    onClick={() => {
                      onSelectReport(row.report);
                      onClose();
                    }}
                    className="w-full text-left flex items-start gap-3 py-2.5 px-1 hover:bg-white/[0.03] transition-colors cursor-pointer group"
                  >
                    <span className="font-mono text-[10px] text-neutral-600 shrink-0 pt-1 tabular-nums">
                      {fmtDate(row.ts)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs text-white leading-snug group-hover:text-neutral-300 transition-colors truncate">
                        {row.report.title}
                      </span>
                      <span className="block text-[10px] text-neutral-500 uppercase tracking-wider mt-0.5">
                        {row.report.category}
                      </span>
                    </span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-neutral-600 group-hover:text-white shrink-0 mt-0.5 transition-colors" />
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* 2) Guardados */}
          <section className="mb-6 pt-5 border-t border-white/10">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-neutral-300">
                <Bookmark className="w-3.5 h-3.5 text-neutral-500" />
                <span>GUARDADOS</span>
              </div>
              <span className="text-[10px] font-mono text-neutral-600">
                {bookmarksTotal}
                {unlimitedSaved ? " · SIN LÍMITE" : `/${FREE_BOOKMARK_LIMIT}`}
              </span>
            </div>

            {!unlimitedSaved && bookmarksTotal >= FREE_BOOKMARK_LIMIT && (
              <div className="mb-2 text-[11px] text-amber-400/90 font-light leading-relaxed">
                Alcanzaste el límite del plan gratuito (
                {FREE_BOOKMARK_LIMIT} artículos). Los suscriptores guardan sin
                límite.
              </div>
            )}

            {bookmarksTotal === 0 ? (
              <div className="py-5 text-center text-xs text-neutral-500 font-light leading-relaxed border border-white/5 rounded-lg">
                No tienes artículos guardados. Haz clic en el marcador de
                cualquier artículo para guardarlo.
              </div>
            ) : bookmarks.length === 0 ? (
              <div className="py-5 text-center text-xs text-neutral-500 font-light leading-relaxed border border-white/5 rounded-lg">
                {bookmarksTotal} artículo
                {bookmarksTotal === 1 ? "" : "s"} guardado
                {bookmarksTotal === 1 ? "" : "s"} — ya no está disponible en
                el catálogo.
              </div>
            ) : (
              <div className="max-h-[30vh] overflow-y-auto pr-1 divide-y divide-white/5 border-y border-white/5">
                {bookmarks.map((rep) => (
                  <div
                    key={rep.id}
                    className="flex items-center gap-3 py-2.5 px-1 group"
                  >
                    <button
                      onClick={() => {
                        onSelectReport(rep);
                        onClose();
                      }}
                      className="min-w-0 flex-1 text-left cursor-pointer"
                    >
                      <span className="block text-xs text-white leading-snug group-hover:text-neutral-300 transition-colors truncate">
                        {rep.title}
                      </span>
                      <span className="block text-[10px] text-neutral-500 uppercase tracking-wider mt-0.5">
                        {rep.category}
                      </span>
                    </button>
                    <button
                      onClick={() => onRemoveBookmark(rep.id)}
                      className="p-1.5 text-neutral-500 hover:text-red-400 transition-colors cursor-pointer rounded hover:bg-white/5"
                      aria-label="Quitar de guardados"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {bookmarks.length > 0 && (
              <button
                onClick={() => {
                  onOpenBookmarks();
                  onClose();
                }}
                className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <span>ABRIR LISTA DE GUARDADOS</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            )}
          </section>

          {/* 3) Publicidad */}
          <section className="pt-5 border-t border-white/10">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-neutral-300">
                <Megaphone className="w-3.5 h-3.5 text-neutral-500" />
                <span>PUBLICIDAD</span>
              </div>
              <span className="text-[10px] font-mono text-neutral-600">
                {myAds.length} ENVIADA{myAds.length === 1 ? "" : "S"}
              </span>
            </div>

            <button
              onClick={onOpenCreateAd}
              className="w-full py-3 bg-emerald-500 text-black font-bold text-xs uppercase tracking-wider rounded-lg hover:bg-emerald-400 transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-lg"
            >
              <Megaphone className="w-4 h-4" />
              <span>CARGAR UNA PUBLICIDAD</span>
            </button>
            <p className="text-[11px] text-neutral-500 font-light leading-relaxed mt-2 text-center">
              Publicidad de pago: se publica tras la revisión del equipo y la
              confirmación del pago (PayPal, transferencia o Mercado Pago).
            </p>

            {myAds.length > 0 && (
              <div className="mt-4 space-y-1">
                {myAds.map((ad) => (
                  <div
                    key={ad.id}
                    className="flex items-center gap-3 py-2 px-2.5 bg-neutral-950/60 border border-white/5 rounded-lg"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs text-white truncate">
                        {ad.title}
                      </span>
                      <span className="block text-[10px] text-neutral-500 font-mono">
                        {ad.createdAt} · ${ad.price} {ad.currency}
                      </span>
                    </span>
                    <span
                      className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0 ${statusChipClass(ad.status)}`}
                    >
                      {ad.status.replace(/_/g, " ")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Footer */}
          <div className="pt-5 mt-5 border-t border-white/10 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-white/20 text-white hover:bg-white/10 font-semibold text-xs uppercase tracking-wider rounded-md transition-colors cursor-pointer"
            >
              CERRAR
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
