import React from "react";
import { Megaphone, X, ArrowRight } from "lucide-react";
import { usePolicies } from "../context/PoliciesContext";
import { formatPolicyDate, isFutureDate } from "../utils/policies";

interface PoliciesNoticeBannerProps {
  onOpenPolicies: () => void;
}

/**
 * Aviso a todos los visitantes cuando el editor publica una versión nueva:
 * informa de la fecha de entrada en vigor y enlaza a la página de políticas.
 * Se oculta al descartarlo (queda registrada la versión vista) o al publicar
 * de nuevo una versión igual a la vista.
 */
export const PoliciesNoticeBanner: React.FC<PoliciesNoticeBannerProps> = ({
  onOpenPolicies,
}) => {
  const { record, needsNotice, ackNotice } = usePolicies();

  if (!needsNotice) return null;

  const future = isFutureDate(record.effectiveDate);
  const dateLabel = formatPolicyDate(record.effectiveDate);

  return (
    <div className="w-full bg-amber-500 text-black font-sans border-b border-black/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs sm:text-sm">
        <Megaphone className="w-4 h-4 shrink-0" />
        <span className="font-bold uppercase tracking-wider">
          Aviso de políticas
        </span>
        <span className="font-medium">
          {future
            ? `Se actualizaron las políticas de BLACKNEWS. Entrarán en vigor el ${dateLabel}.`
            : `Se actualizaron las políticas de BLACKNEWS. Vigentes desde el ${dateLabel}.`}
        </span>
        <button
          onClick={onOpenPolicies}
          className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 bg-black text-amber-400 text-xs font-semibold uppercase tracking-wider rounded hover:bg-neutral-800 transition-colors cursor-pointer"
        >
          <span>Leer políticas</span>
          <ArrowRight className="w-3 h-3" />
        </button>
        <button
          onClick={ackNotice}
          aria-label="Descartar aviso de políticas"
          className="p-1 rounded hover:bg-black/15 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
