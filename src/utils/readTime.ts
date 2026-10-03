import { Report } from "../types/news";

const WORDS_PER_MINUTE = 200;

const countWords = (text: string): number => {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
};

type ReadTimeReport = Pick<Report, "readTime" | "lead" | "sections" | "keyTakeaways">;

/**
 * Tiempo de lectura calculado del texto real del informe
 * (lead + secciones + claves) a ~200 palabras por minuto.
 * Si no hay texto suficiente, usa el valor escrito por el redactor.
 */
export const readTimeOf = (report: ReadTimeReport): string => {
  const body = [
    report.lead ?? "",
    (report.keyTakeaways ?? []).join(" "),
    (report.sections ?? [])
      .map((s) => s.text || s.label || "")
      .join(" "),
  ].join(" ");

  const words = countWords(body);
  if (words < 20) return report.readTime;

  const minutes = Math.max(1, Math.round(words / WORDS_PER_MINUTE));
  return `${minutes} min de lectura`;
};
