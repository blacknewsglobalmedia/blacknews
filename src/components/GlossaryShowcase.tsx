import React, { useState } from "react";
import { BookOpen, Search, X, ArrowRight } from "lucide-react";
import { GLOSSARY } from "../data/glossary";

const SPOTLIGHT_TERMS = [
  "FED",
  "spread",
  "OPEP+",
  "Estrecho de Ormuz",
  "volatilidad",
  "deuda soberana",
];

/** Vitrina del glosario en la portada + modal con el glosario completo y buscador. */
export const GlossaryShowcase: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const spotlight = SPOTLIGHT_TERMS.map((t) =>
    GLOSSARY.find((g) => g.term === t),
  ).filter((g): g is NonNullable<typeof g> => Boolean(g));

  const q = query.trim().toLowerCase();
  const filtered = q
    ? GLOSSARY.filter(
        (g) =>
          g.term.toLowerCase().includes(q) || g.def.toLowerCase().includes(q),
      )
    : GLOSSARY;

  return (
    <section className="border-t border-white/10 bg-black">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-neutral-500 font-semibold mb-3">
              GLOSARIO BLACKNEWS
            </div>
            <h2 className="font-headline text-2xl sm:text-3xl text-white tracking-tight leading-snug">
              Términos que deberías conocer
            </h2>
            <p className="text-sm text-neutral-400 font-light mt-2 max-w-xl leading-relaxed">
              Finanzas y geopolítica hablan su propio idioma. Los despejamos en
              una línea cada uno — y dentro de los artículos, al pasar el cursor
              sobre el término.
            </p>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 border border-white/20 hover:border-white text-white text-xs font-semibold uppercase tracking-wider rounded-md transition-colors cursor-pointer"
          >
            <BookOpen className="w-3.5 h-3.5" />
            VER LOS {GLOSSARY.length} TÉRMINOS
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {spotlight.map((g) => (
            <div
              key={g.term}
              className="border border-white/10 rounded-lg p-4 hover:border-white/25 transition-colors"
            >
              <div className="font-headline text-base text-white mb-1.5 tracking-tight">
                {g.term}
              </div>
              <p className="text-xs text-neutral-400 font-light leading-relaxed">
                {g.def}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Modal: glosario completo */}
      {open && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black flex flex-col font-['Lexend',sans-serif]">
          <div className="sticky top-0 z-10 bg-black/95 backdrop-blur-md border-b border-white/10 px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <BookOpen className="w-4 h-4 text-neutral-400 shrink-0" />
              <span className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-white truncate">
                GLOSARIO · {filtered.length} TÉRMINOS
              </span>
            </div>
            <div className="flex items-center gap-2 flex-1 max-w-sm justify-end">
              <div className="relative w-full">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar término…"
                  className="w-full bg-neutral-900 border border-white/15 rounded-md pl-8 pr-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-white/40"
                />
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-2 rounded-md text-neutral-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer shrink-0"
                aria-label="Cerrar glosario"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="max-w-4xl w-full mx-auto px-4 sm:px-6 py-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filtered.map((g) => (
                <div key={g.term} className="border border-white/10 rounded-lg p-4">
                  <div className="font-headline text-base text-white mb-1.5 tracking-tight">
                    {g.term}
                  </div>
                  <p className="text-sm text-neutral-400 font-light leading-relaxed">
                    {g.def}
                  </p>
                </div>
              ))}
            </div>
            {filtered.length === 0 && (
              <p className="text-sm text-neutral-500 text-center py-12 font-light">
                Ningún término coincide con “{query}”.
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
