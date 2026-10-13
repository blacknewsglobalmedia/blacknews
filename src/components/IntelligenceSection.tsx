import React from "react";
import { Lock, ArrowRight } from "lucide-react";
import type { IntelligenceBrief } from "../types/layout";

interface IntelligenceSectionProps {
  brief: IntelligenceBrief | undefined;
  isSubscribed: boolean;
  onOpenSubscription: () => void;
}

/**
 * «Parte Intelligence»: el primer contenido de pago de la portada.
 *
 * La redacción publica el parte desde el estudio (Portada · Análisis
 * reservado) y aquí se sirve a todo el mundo: sin suscripción activa el
 * cuerpo va difuminado bajo un velo con CTA esmeralda hacia el modal de
 * suscripción; con suscripción, se lee completo. Si no hay parte publicado
 * la sección no renderiza.
 */
export const IntelligenceSection: React.FC<IntelligenceSectionProps> = ({
  brief,
  isSubscribed,
  onOpenSubscription,
}) => {
  if (!brief || brief.bullets.length === 0) return null;

  return (
    <section className="border-t border-white/10 bg-black font-sans">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-10 sm:py-12">
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.03] overflow-hidden">
          {/* Cabecera: sello Intelligence + título + fecha de publicación */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 sm:px-8 pt-6 sm:pt-7">
            <span className="shrink-0 bg-emerald-500 text-black text-[10px] font-bold uppercase tracking-[0.2em] px-2 py-0.5 rounded">
              Intelligence
            </span>
            <h2 className="font-headline text-lg sm:text-xl text-white tracking-tight min-w-0">
              {brief.title}
            </h2>
            <span className="ml-auto text-[10px] font-mono text-neutral-500">
              {brief.publishedAt}
            </span>
          </div>

          {/* Cuerpo: completo para socios, difuminado con CTA para el resto */}
          <div className="relative px-5 sm:px-8 py-6 sm:py-7">
            <ul
              className={`space-y-3 ${
                isSubscribed ? "" : "blur-[6px] select-none"
              }`}
              aria-hidden={!isSubscribed}
            >
              {brief.bullets.map((b, i) => (
                <li
                  key={i}
                  className="flex gap-3 text-sm leading-relaxed text-neutral-200"
                >
                  <span
                    className="mt-2.5 h-px w-3 bg-emerald-400 shrink-0"
                    aria-hidden
                  />
                  <span className="min-w-0">{b}</span>
                </li>
              ))}
            </ul>

            {!isSubscribed && (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-black/90 via-black/75 to-black/55 px-5">
                <div className="text-center max-w-sm">
                  <Lock className="w-5 h-5 text-emerald-400 mx-auto mb-2.5" />
                  <p className="text-sm font-semibold text-white">
                    Parte reservado a las socias y socios
                  </p>
                  <p className="mt-1 text-[11px] text-neutral-400 leading-relaxed">
                    Sin publicidad · Análisis exclusivos · Acceso anticipado
                  </p>
                  <button
                    type="button"
                    onClick={onOpenSubscription}
                    className="mt-4 inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold uppercase tracking-wider px-5 py-2.5 rounded-xl transition-colors cursor-pointer"
                  >
                    Hacerse socio
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
