import React from "react";
import { LegalBlock, LegalSection } from "../data/legalDocs";

/** Negritas con markdown ligero (**texto**). */
export const renderText = (text: string): React.ReactNode =>
  text.split(/\*\*(.+?)\*\*/g).map((seg, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="text-white font-medium">
        {seg}
      </strong>
    ) : (
      <React.Fragment key={i}>{seg}</React.Fragment>
    ),
  );

export const renderBlock = (block: LegalBlock, i: number): React.ReactNode => {
  if (block.h) {
    return (
      <h4
        key={i}
        className="text-[13px] font-bold text-white uppercase tracking-wider pt-3 pb-0.5"
      >
        {block.h}
      </h4>
    );
  }
  if (block.p) {
    return <p key={i}>{renderText(block.p)}</p>;
  }
  if (block.list) {
    return (
      <ul key={i} className="list-disc pl-5 space-y-1 text-neutral-400">
        {block.list.map((item, j) => (
          <li key={j}>{renderText(item)}</li>
        ))}
      </ul>
    );
  }
  if (block.num) {
    return (
      <ol key={i} className="list-decimal pl-5 space-y-1 text-neutral-400">
        {block.num.map((item, j) => (
          <li key={j}>{renderText(item)}</li>
        ))}
      </ol>
    );
  }
  if (block.note) {
    return (
      <div
        key={i}
        className="p-3 bg-neutral-950 border border-white/10 rounded-lg"
      >
        <p className="text-white font-mono text-xs sm:text-sm break-all">
          {block.note}
        </p>
      </div>
    );
  }
  return null;
};

interface LegalProseProps {
  sections: LegalSection[];
  /** Prefijo de las anclas de sección (para no chocar con la página pública). */
  idPrefix?: string;
  /** Nº de la primera sección (por si la lista está recortada). */
  startIndex?: number;
}

/**
 * Cuerpo del documento legal: secciones numeradas con ancla `seccion-<n>`
 * (1-based, en orden de documento) para el índice y el deep-link `?politicas=`.
 */
export const LegalProse: React.FC<LegalProseProps> = ({
  sections,
  idPrefix = "seccion-",
  startIndex = 0,
}) => (
  <div className="space-y-8 text-xs sm:text-sm text-neutral-300 font-light leading-relaxed">
    {sections.map((section, i) => {
      const n = startIndex + i + 1;
      return (
        <section
          key={section.title}
          id={`${idPrefix}${n}`}
          className="space-y-3 pt-5 border-t border-white/5 first:border-t-0 first:pt-0 scroll-mt-24"
        >
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <span className="text-emerald-400 font-mono text-xs">§{n}</span>
            <span>{section.title}</span>
          </h3>
          <div className="space-y-3">{section.blocks.map(renderBlock)}</div>
        </section>
      );
    })}
  </div>
);
