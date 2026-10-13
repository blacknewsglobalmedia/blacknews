import React, { useEffect, useState } from "react";
import { Check } from "lucide-react";
import type { Report } from "../types/news";

const STORAGE_KEY = "blacknews_briefing_topics";
const MAX_TOPICS = 3;
/** Máximo de despachos mostrados en la tira del briefing. */
const MAX_ITEMS = 6;

interface PersonalBriefingProps {
  reports: Report[];
  categories: readonly string[];
  onReadReport: (report: Report) => void;
}

/**
 * «Tu briefing»: el lector elige hasta 3 temas y la portada le reserva una
 * tira con lo último de esos temas. La selección vive en el dispositivo
 * (localStorage); sin selección, la sección muestra el selector de temas.
 *
 * Es la base sobre la que después podrá montarse la sincronización de la
 * preferencia para cuentas suscritas (mismo componente, otro backend).
 */
export const PersonalBriefing: React.FC<PersonalBriefingProps> = ({
  reports,
  categories,
  onReadReport,
}) => {
  const [topics, setTopics] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed)
        ? parsed.filter((t) => typeof t === "string").slice(0, MAX_TOPICS)
        : [];
    } catch {
      return [];
    }
  });
  // Abierto a edición sólo al entrar sin temas: después se lee la tira.
  const [picking, setPicking] = useState(topics.length === 0);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(topics));
    } catch {
      /* modo privado: la selección dura esta sesión */
    }
  }, [topics]);

  const toggleTopic = (cat: string) => {
    setTopics((prev) => {
      if (prev.includes(cat)) return prev.filter((t) => t !== cat);
      if (prev.length >= MAX_TOPICS) return [...prev.slice(1), cat];
      return [...prev, cat];
    });
  };

  const items =
    topics.length > 0
      ? reports.filter((r) => topics.includes(r.category)).slice(0, MAX_ITEMS)
      : [];

  return (
    <section className="border-t border-white/10 bg-black font-sans">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="flex items-baseline gap-x-3 mb-5">
          <span className="text-[10px] uppercase tracking-[0.25em] text-neutral-600 font-semibold">
            Tu briefing
          </span>
          <span className="text-[10px] font-mono text-neutral-600">
            {topics.length > 0
              ? `${topics.length}/${MAX_TOPICS} temas`
              : "elige hasta 3 temas"}
          </span>
          <span className="flex-1 h-px bg-white/5" aria-hidden />
          {topics.length > 0 && (
            <button
              type="button"
              onClick={() => setPicking((p) => !p)}
              className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 hover:text-white transition-colors cursor-pointer"
            >
              {picking ? "Listo" : "Editar"}
            </button>
          )}
        </div>

        {/* Selector de temas: máx. 3; el cuarto desplaza al primero */}
        {picking && (
          <div className="flex flex-wrap gap-2 mb-5">
            {categories
              .filter((c) => c !== "TODAS")
              .map((c) => {
                const on = topics.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleTopic(c)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                      on
                        ? "bg-white text-black font-bold"
                        : "text-neutral-400 hover:text-white border border-white/10 hover:border-white/25"
                    }`}
                  >
                    {on && <Check className="w-3 h-3" />}
                    {c}
                  </button>
                );
              })}
          </div>
        )}

        {/* Tira con lo último de los temas elegidos */}
        {topics.length > 0 && !picking && (
          <>
            <div className="flex flex-wrap gap-1.5 mb-4">
              {topics.map((t) => (
                <span
                  key={t}
                  className="text-[10px] uppercase tracking-[0.18em] text-emerald-400/80 font-semibold"
                >
                  {t}
                </span>
              ))}
            </div>
            {items.length > 0 ? (
              <ul className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 pb-0.5">
                {items.map((r) => (
                  <li key={r.id} className="shrink-0 w-[260px]">
                    <button
                      type="button"
                      onClick={() => onReadReport(r)}
                      className="w-full h-full text-left rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] transition-colors px-4 py-3 cursor-pointer"
                    >
                      <span className="block text-[10px] uppercase tracking-[0.18em] font-semibold text-neutral-500">
                        {r.category}
                      </span>
                      <span className="mt-1 block text-sm font-semibold leading-snug text-white line-clamp-3">
                        {r.title}
                      </span>
                      <span className="mt-2 block text-[10px] font-mono text-neutral-600">
                        {r.publishedAt}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-neutral-500">
                Sin despachos recientes en tus temas. Pulsa «Editar» para
                cambiar la selección.
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
};
