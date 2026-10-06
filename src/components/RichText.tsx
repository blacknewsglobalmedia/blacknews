import React, { useRef } from "react";
import { GLOSSARY } from "../data/glossary";
import { Highlight } from "../utils/highlights";

interface RichTextProps {
  text: string;
  /** Términos del glosario ya resaltados en este artículo (1ª aparición). */
  seen: Set<string>;
  highlights?: Highlight[];
}

interface Interval {
  start: number;
  end: number;
  hlId?: string;
  term?: string;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const GLOSSARY_RE = new RegExp(
  `(?<![\\p{L}\\p{N}])(${GLOSSARY.map((g) => escapeRe(g.term))
    .sort((a, b) => b.length - a.length)
    .join("|")})(?![\\p{L}\\p{N}])`,
  "giu",
);

const GLOSS_BY_TERM = new Map(GLOSSARY.map((g) => [g.term.toLowerCase(), g.def]));

const GlossTerm: React.FC<{ def: string; children: React.ReactNode }> = ({
  def,
  children,
}) => {
  const ref = useRef<HTMLSpanElement>(null);

  // Si el término está cerca del borde superior, el tooltip se despliega hacia abajo
  // y, en móvil, se encaja horizontalmente para no salirse de la pantalla.
  const place = () => {
    const el = ref.current;
    const tip = el?.querySelector<HTMLElement>(".gloss-tip");
    if (!el || !tip) return;
    tip.classList.toggle("gloss-tip-below", el.getBoundingClientRect().top < 130);
    const r = el.getBoundingClientRect();
    const w = tip.offsetWidth || Math.min(300, window.innerWidth * 0.72);
    const half = w / 2 + 8;
    const center = r.left + r.width / 2;
    const clamped = Math.min(Math.max(center, half), window.innerWidth - half);
    tip.style.left = `${clamped - r.left}px`;
  };

  // Toc/tap: alterna el tooltip (en táctil no existe :hover fiable)
  const toggle = () => {
    const el = ref.current;
    if (!el) return;
    const wasOpen = el.getAttribute("data-open") === "1";
    document
      .querySelectorAll('.gloss-term[data-open="1"]')
      .forEach((n) => n.removeAttribute("data-open"));
    if (!wasOpen) {
      place();
      el.setAttribute("data-open", "1");
    }
  };

  // Un toque fuera cierra cualquier tooltip abierto
  React.useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if ((e.target as HTMLElement | null)?.closest?.(".gloss-term")) return;
      document
        .querySelectorAll('.gloss-term[data-open="1"]')
        .forEach((n) => n.removeAttribute("data-open"));
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  return (
    <span
      ref={ref}
      className="gloss-term"
      tabIndex={0}
      onMouseEnter={place}
      onFocus={place}
      onClick={toggle}
    >
      {children}
      <span className="gloss-tip" role="tooltip">
        {def}
      </span>
    </span>
  );
};

const buildIntervals = (
  text: string,
  seen: Set<string>,
  highlights?: Highlight[],
): Interval[] => {
  const intervals: Interval[] = [];

  (highlights || []).forEach((h) => {
    const start = text.indexOf(h.text);
    if (start >= 0) intervals.push({ start, end: start + h.text.length, hlId: h.id });
  });

  GLOSSARY_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = GLOSSARY_RE.exec(text)) !== null) {
    const key = m[0].toLowerCase();
    const start = m.index;
    const end = start + m[0].length;
    if (
      !seen.has(key) &&
      !intervals.some((iv) => start < iv.end && end > iv.start)
    ) {
      seen.add(key);
      intervals.push({ start, end, term: key });
    }
    if (m[0].length === 0) GLOSSARY_RE.lastIndex++;
  }

  intervals.sort((a, b) => a.start - b.start);
  return intervals;
};

/** Texto con subrayados del lector y primeras apariciones del glosario. */
export const RichText: React.FC<RichTextProps> = ({ text, seen, highlights }) => {
  const intervals = buildIntervals(text, seen, highlights);
  if (intervals.length === 0) return <>{text}</>;

  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  intervals.forEach((iv, i) => {
    if (iv.start < cursor) return;
    if (iv.start > cursor) nodes.push(text.slice(cursor, iv.start));
    const content = text.slice(iv.start, iv.end);
    if (iv.hlId) {
      nodes.push(
        <mark key={`h${i}`} className="bn-mark">
          {content}
        </mark>,
      );
    } else {
      nodes.push(
        <GlossTerm key={`g${i}`} def={GLOSS_BY_TERM.get(iv.term || "") || ""}>
          {content}
        </GlossTerm>,
      );
    }
    cursor = iv.end;
  });
  if (cursor < text.length) nodes.push(text.slice(cursor));

  return <>{nodes}</>;
};
