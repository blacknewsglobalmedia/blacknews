import React, { useEffect, useState } from "react";
import { getReadPct, READ_POS_EVENT } from "../utils/readProgress";

interface ResumeBadgeProps {
  reportId: string;
  className?: string;
}

/**
 * Chip "▸ 40%" en las tarjetas: indica que el lector dejó el artículo
 * a medias y puede retomarlo. Se actualiza cuando cambia la posición.
 */
export const ResumeBadge: React.FC<ResumeBadgeProps> = ({
  reportId,
  className = "",
}) => {
  const [pct, setPct] = useState<number | null>(() => getReadPct(reportId));

  useEffect(() => {
    const sync = () => setPct(getReadPct(reportId));
    window.addEventListener(READ_POS_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(READ_POS_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [reportId]);

  if (!pct) return null;

  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-sans font-semibold uppercase tracking-wider text-black bg-white rounded-[3px] ${className}`}
      title="Continuar leyendo donde quedaste"
    >
      ▸ {Math.round(pct * 100)}%
    </span>
  );
};
