import React from "react";
import { CountryFlag } from "./CountryFlag";

/** Estado editorial de un frente: el punto de color es el semáforo. */
type FrontStatus = "estable" | "tension" | "critica";

interface OpenFront {
  name: string;
  /** Códigos ISO alfa-2 de las banderas del frente; vacío si no aplica. */
  codes: string[];
  status: FrontStatus;
  /** Frase corta que enmarca el foco del frente. */
  focus: string;
}

/**
 * «Frentes abiertos»: tira compacta tipo sala de situación con los focos
 * geopolíticos que BLACKNEWS sigue en portada. La curaduría es editorial
 * (estados y textos definidos en redacción): el semáforo va de estable
 * (emerald) a tensión (ámbar) y crítica (rojo con pulso suave).
 *
 * En móvil la tira se desplaza en horizontal (sin scrollbar visible), al
 * igual que la tira de categorías del TopBar.
 */
const OPEN_FRONTS: OpenFront[] = [
  {
    name: "Israel · Irán",
    codes: ["il", "ir"],
    status: "critica",
    focus: "Escalada militar directa",
  },
  {
    name: "Ucrania · Rusia",
    codes: ["ua", "ru"],
    status: "tension",
    focus: "Guerra de desgaste en el frente oriental",
  },
  {
    name: "Taiwán · China",
    codes: ["tw", "cn"],
    status: "tension",
    focus: "Presión naval en el estrecho",
  },
  {
    name: "Venezuela · Guyana",
    codes: ["ve", "gy"],
    status: "tension",
    focus: "Esequibo: reclamación territorial",
  },
  {
    name: "Sahel",
    codes: ["ml", "ne"],
    status: "tension",
    focus: "Retirada de misiones occidentales",
  },
  {
    name: "Corea del Norte",
    codes: ["kp", "kr"],
    status: "tension",
    focus: "Programa de misiles",
  },
  {
    name: "Ártico",
    codes: [],
    status: "estable",
    focus: "Ruta polar: competencia de accesos",
  },
];

const STATUS_META: Record<
  FrontStatus,
  { label: string; dot: string; text: string }
> = {
  estable: {
    label: "Estable",
    dot: "bg-emerald-400",
    text: "text-emerald-400/80",
  },
  tension: { label: "Tensión", dot: "bg-amber-400", text: "text-amber-400/80" },
  critica: {
    label: "Crítica",
    dot: "bg-red-400 animate-pulse",
    text: "text-red-400/80",
  },
};

export const OpenFrontsStrip: React.FC = () => {
  const activos = OPEN_FRONTS.filter((f) => f.status !== "estable").length;
  return (
    <section className="border-t border-white/10 bg-black font-sans">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="flex items-baseline gap-x-3 gap-y-1 mb-5">
          <span className="text-[10px] uppercase tracking-[0.25em] text-neutral-600 font-semibold">
            Frentes abiertos
          </span>
          <span className="text-[10px] font-mono text-neutral-600">
            {activos} activos · {OPEN_FRONTS.length} monitorizados
          </span>
          <span className="flex-1 h-px bg-white/5" aria-hidden />
        </div>

        <ul className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 pb-0.5">
          {OPEN_FRONTS.map((f) => {
            const meta = STATUS_META[f.status];
            return (
              <li
                key={f.name}
                data-assemble
                className="shrink-0 w-[240px] rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] transition-colors px-4 py-3"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${meta.dot}`}
                    aria-hidden
                  />
                  <span className="min-w-0 truncate text-sm font-semibold text-white tracking-tight">
                    {f.name}
                  </span>
                  {f.codes.length > 0 && (
                    <span className="ml-auto flex shrink-0 items-center gap-1">
                      {f.codes.map((code) => (
                        <CountryFlag
                          key={code}
                          code={code}
                          className="h-3.5 w-5 rounded-[2px] object-cover inline-block"
                        />
                      ))}
                    </span>
                  )}
                </div>
                <p className="mt-1.5 text-[11px] leading-snug text-neutral-500 line-clamp-2">
                  {f.focus}
                </p>
                <p
                  className={`mt-2 text-[10px] uppercase tracking-[0.2em] font-semibold ${meta.text}`}
                >
                  {meta.label}
                </p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
};
