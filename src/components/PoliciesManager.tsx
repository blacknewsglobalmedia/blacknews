import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Scale,
  Save,
  Eye,
  PencilLine,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  CalendarDays,
  ListTree,
} from "lucide-react";
import { usePolicies } from "../context/PoliciesContext";
import {
  DEFAULT_POLICIES_MD,
  DEFAULT_EFFECTIVE_DATE,
  clearDraft,
  formatPolicyDate,
  loadDraft,
  parsePolicies,
  saveDraft,
} from "../utils/policies";
import { LegalProse } from "./LegalProse";
import { scrollToSectionId } from "../utils/scroll";

interface PoliciesManagerProps {
  onOpenGoogleAuth?: () => void;
}

/**
 * Editor de las políticas para la cuenta propietaria (ADMIN): markdown-lite,
 * fecha de entrada en vigor, salto por sección, vista previa y publicación
 * en Firestore (`settings/policies`), que dispara el aviso a los visitantes.
 */
export const PoliciesManager: React.FC<PoliciesManagerProps> = ({
  onOpenGoogleAuth,
}) => {
  const { record, source, loading, syncError, save, refresh } = usePolicies();

  const [md, setMd] = useState(() => loadDraft() ?? record.md);
  const [effectiveDate, setEffectiveDate] = useState(
    () => record.effectiveDate || DEFAULT_EFFECTIVE_DATE,
  );
  const [preview, setPreview] = useState(false);
  const [status, setStatus] = useState<
    { kind: "ok" | "error"; msg: string } | null
  >(null);
  const [busy, setBusy] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sincroniza el formulario cuando cambia el registro remoto (p. ej. al
  // recargar), salvo que el editor tenga un borrador más reciente sin publicar.
  useEffect(() => {
    const draft = loadDraft();
    if (draft === null) {
      setMd(record.md);
      setEffectiveDate(record.effectiveDate || DEFAULT_EFFECTIVE_DATE);
    }
  }, [record.md, record.effectiveDate]);

  const parsed = useMemo(() => parsePolicies(md), [md]);
  const dirty = useMemo(
    () => md !== record.md || effectiveDate !== record.effectiveDate,
    [md, effectiveDate, record.md, record.effectiveDate],
  );
  const draftActive = useMemo(() => loadDraft() !== null, [md, record.md]);

  const handleDraftChange = (value: string) => {
    setMd(value);
    setLastSaved(null);
    if (value === record.md) {
      clearDraft();
    } else {
      saveDraft(value);
    }
  };

  const jumpToSection = (idx: number) => {
    const id = `preview-seccion-${idx + 1}`;
    if (document.getElementById(id)) {
      scrollToSectionId(id);
      return;
    }
    setPreview(true);
    window.setTimeout(() => scrollToSectionId(id), 120);
  };

  const handleSave = async () => {
    setStatus(null);
    if (!dirty && !draftActive) {
      setStatus({
        kind: "error",
        msg: "No hay cambios pendientes de publicar.",
      });
      return;
    }
    setBusy(true);
    const result = await save(md, effectiveDate);
    setBusy(false);
    if (result.ok) {
      clearDraft();
      setLastSaved(new Date().toISOString());
      setStatus({
        kind: "ok",
        msg: `Publicado. Los visitantes verán el aviso con vigencia: ${formatPolicyDate(effectiveDate)}.`,
      });
      await refresh();
    } else {
      setStatus({ kind: "error", msg: result.error || "Error desconocido." });
    }
  };

  const handleReset = () => {
    setMd(record.md);
    setEffectiveDate(record.effectiveDate || DEFAULT_EFFECTIVE_DATE);
    clearDraft();
    setStatus(null);
    setLastSaved(null);
  };

  const handleRestoreOriginal = () => {
    handleDraftChange(DEFAULT_POLICIES_MD);
    setEffectiveDate(DEFAULT_EFFECTIVE_DATE);
    setPreview(false);
    setStatus({
      kind: "error",
      msg: "Documento original cargado en el editor. Revisa la fecha y pulsa «Guardar y publicar» para aplicarlo.",
    });
  };

  const sourceLabel =
    source === "server"
      ? "Servidor (Firestore)"
      : source === "cache"
        ? "Copia local del dispositivo"
        : "Documento integrado en la app";

  return (
    <div className="space-y-5">
      {/* Cabecera */}
      <div className="flex flex-wrap items-start justify-between gap-4 border border-white/10 rounded-xl bg-neutral-950 p-4">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-white">
            <Scale className="w-4 h-4 text-emerald-400" />
            Políticas y Normativa Legal
          </h2>
          <p className="mt-1 text-xs text-neutral-400 font-light max-w-2xl">
            Documento único público (§1-§10). Al publicar, todos los visitantes
            reciben un aviso con la fecha de entrada en vigor.
          </p>
        </div>
        <div className="text-right text-xs font-mono text-neutral-400 leading-relaxed">
          <div>
            Fuente: <span className="text-white">{sourceLabel}</span>
          </div>
          <div>
            Versión:{" "}
            <span className="text-white">
              {record.version > 0 ? `v${record.version}` : "integrada"}
            </span>
            {record.version > 0 && <> · vigencia {formatPolicyDate(record.effectiveDate)}</>}
          </div>
          <div>
            {loading ? (
              <span className="text-neutral-500">Sincronizando…</span>
            ) : syncError ? (
              <span className="text-amber-400">{syncError}</span>
            ) : (
              <span className="text-emerald-400">Conectado</span>
            )}
          </div>
        </div>
      </div>

      {/* Barra de controles */}
      <div className="flex flex-wrap items-end gap-3 border border-white/10 rounded-xl bg-black p-4">
        <label className="flex flex-col gap-1 text-xs text-neutral-400">
          <span className="flex items-center gap-1.5 font-semibold uppercase tracking-wider">
            <CalendarDays className="w-3.5 h-3.5" />
            Entrada en vigor
          </span>
          <input
            type="date"
            value={effectiveDate}
            onChange={(e) => setEffectiveDate(e.target.value)}
            className="bg-neutral-950 border border-white/15 rounded-lg px-3 py-2 text-sm text-white [color-scheme:dark] cursor-pointer"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs text-neutral-400">
          <span className="flex items-center gap-1.5 font-semibold uppercase tracking-wider">
            <ListTree className="w-3.5 h-3.5" />
            Saltar a sección
          </span>
          <select
            value=""
            onChange={(e) => {
              if (e.target.value !== "") jumpToSection(Number(e.target.value));
            }}
            className="bg-neutral-950 border border-white/15 rounded-lg px-3 py-2 text-sm text-white cursor-pointer min-w-[14rem]"
          >
            <option value="">— Seleccionar —</option>
            {parsed.sections.map((s, i) => (
              <option key={s.title} value={i}>
                §{i + 1} {s.title.replace(/^\d+\.\s*/, "")}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-wrap gap-2 ml-auto">
          <button
            onClick={() => setPreview((v) => !v)}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 border border-white/20 text-white text-xs font-semibold uppercase tracking-wider rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            {preview ? (
              <PencilLine className="w-3.5 h-3.5" />
            ) : (
              <Eye className="w-3.5 h-3.5" />
            )}
            {preview ? "Editar" : "Vista previa"}
          </button>
          <button
            onClick={handleReset}
            disabled={!dirty && !draftActive}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 border border-white/20 text-neutral-300 text-xs font-semibold uppercase tracking-wider rounded-lg hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Descartar cambios
          </button>
          <button
            onClick={handleSave}
            disabled={busy}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-black text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-neutral-200 transition-colors cursor-pointer disabled:opacity-60"
          >
            <Save className="w-3.5 h-3.5" />
            {busy ? "Guardando…" : "Guardar y publicar"}
          </button>
        </div>
      </div>

      {/* Avisos de estado */}
      {draftActive && !lastSaved && (
        <div className="flex items-center gap-2 border border-amber-500/40 bg-amber-950/40 rounded-xl px-4 py-2.5 text-xs text-amber-300">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Borrador local sin publicar (guardado en este dispositivo).
        </div>
      )}
      {status && (
        <div
          className={`flex items-start gap-2 border rounded-xl px-4 py-3 text-xs ${
            status.kind === "ok"
              ? "border-emerald-500/40 bg-emerald-950/40 text-emerald-300"
              : "border-red-500/40 bg-red-950/40 text-red-300"
          }`}
        >
          {status.kind === "ok" ? (
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          )}
          <span className="flex-1">{status.msg}</span>
          {status.kind === "error" &&
            /sesión|sign in|iniciar/i.test(status.msg) &&
            onOpenGoogleAuth && (
              <button
                onClick={onOpenGoogleAuth}
                className="shrink-0 px-3 py-1.5 bg-white text-black font-semibold uppercase tracking-wider rounded-md hover:bg-neutral-200 transition-colors cursor-pointer"
              >
                Iniciar sesión
              </button>
            )}
        </div>
      )}

      {/* Editor / vista previa */}
      <div className="border border-white/10 rounded-xl bg-neutral-950 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
          <span>
            {preview ? "Vista previa" : "Editor"} · {parsed.sections.length}{" "}
            secciones
          </span>
          <span className="font-mono normal-case tracking-normal">
            {md.length.toLocaleString("es-ES")} caracteres
          </span>
        </div>

        {preview ? (
          <div className="p-4 sm:p-5 max-h-[70vh] overflow-y-auto">
            <div className="mb-4 p-3 bg-neutral-900 border border-white/10 rounded-lg grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-1.5 text-xs">
              <div className="flex items-baseline gap-2">
                <span className="text-white font-medium">Entrada en vigor:</span>
                <span className="text-neutral-400">
                  {formatPolicyDate(effectiveDate)}
                </span>
              </div>
              {parsed.intro.map((m) => (
                <div key={m.label} className="flex items-baseline gap-2 min-w-0">
                  <span className="text-white font-medium shrink-0">
                    {m.label}:
                  </span>
                  <span className="text-neutral-400 break-all">{m.value}</span>
                </div>
              ))}
            </div>
            <div className="[&_section]:scroll-mt-40">
              <LegalProse
                sections={parsed.sections}
                idPrefix="preview-seccion-"
              />
            </div>
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            dir="ltr"
            value={md}
            onChange={(e) => handleDraftChange(e.target.value)}
            spellCheck={false}
            className="w-full h-[60vh] bg-transparent text-neutral-200 font-mono text-[13px] leading-relaxed p-4 outline-none resize-y"
          />
        )}
      </div>

      <p className="text-[11px] text-neutral-500 font-light leading-relaxed">
        Formato: línea vacía separa párrafos · <code>#</code> sección ·{" "}
        <code>##</code> subepígrafe · <code>-</code> lista · <code>1.</code>{" "}
        enumeración · <code>&gt;</code> nota ·{" "}
        <code>**Etiqueta:** valor</code> en la cabecera.
        {source === "cache" &&
          " El texto se guarda primero en este dispositivo y luego en el servidor."}
      </p>
    </div>
  );
};
