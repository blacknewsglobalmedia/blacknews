import React from "react";

interface DailyQuote {
  text: string;
  author: string;
  source: string;
}

/**
 * «Palabra del día»: banda tipográfica que da un respiro entre secciones
 * densas, con el único acento de color del sistema (filete esmeralda) y
 * attributiones en versalitas.
 *
 * La rotación es determinista por fecha: mismo quote todo el día en todos
 * los dispositivos, sin backend. La curaduría vive en QUOTES y se amplía
 * sin tocar el layout (una entrada por día de rotación).
 */
const QUOTES: DailyQuote[] = [
  {
    text: "El Estado es la gran ficción por la que todos intentan vivir a expensas de todos los demás.",
    author: "Frédéric Bastiat",
    source: "La Ley, 1850",
  },
  {
    text: "No es de la benevolencia del carnicero, del cervecero o del panadero de donde esperamos nuestra cena, sino de su interés por su propio beneficio.",
    author: "Adam Smith",
    source: "La riqueza de las naciones, 1776",
  },
  {
    text: "Si los hombres fueran ángeles, no haría necesario ningún gobierno.",
    author: "James Madison",
    source: "El Federalista n.º 51, 1788",
  },
  {
    text: "La tolerancia ilimitada lleva a la desaparición de la tolerancia.",
    author: "Karl Popper",
    source: "La sociedad abierta y sus enemigos, 1945",
  },
  {
    text: "El poder tiende a corromper, y el poder absoluto corrompe absolutamente.",
    author: "Lord Acton",
    source: "Cartas a obispos anglicanos, 1887",
  },
];

export const QuoteOfTheDay: React.FC = () => {
  const dayIndex = Math.floor(Date.now() / 86_400_000) % QUOTES.length;
  const quote = QUOTES[dayIndex];
  return (
    <section className="border-t border-white/10 bg-black font-sans">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <figure className="max-w-3xl mx-auto flex gap-5 sm:gap-7">
          {/* Filete esmeralda: único acento de color de la banda */}
          <div
            className="w-[3px] shrink-0 rounded-full bg-gradient-to-b from-emerald-400 via-emerald-500/60 to-transparent"
            aria-hidden
          />
          <div className="min-w-0">
            <blockquote className="bn-dottext font-headline text-xl sm:text-2xl lg:text-[28px] leading-snug tracking-tight">
              <span className="text-neutral-600">«</span>
              {quote.text}
              <span className="text-neutral-600">»</span>
            </blockquote>
            <figcaption className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-[11px] uppercase tracking-[0.25em] font-semibold text-neutral-500">
                {quote.author}
              </span>
              <span className="h-px w-6 bg-white/15" aria-hidden />
              <span className="text-[11px] font-mono text-neutral-600">
                {quote.source}
              </span>
            </figcaption>
          </div>
        </figure>
      </div>
    </section>
  );
};
