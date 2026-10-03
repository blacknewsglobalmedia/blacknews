import React, { useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Info,
  X,
  Zap,
  ArrowUpRight,
} from "lucide-react";

interface MacroIndicator {
  id: string;
  symbol: string;
  name: string;
  value: string;
  change: string;
  isPositive: boolean;
  neutral?: boolean;
  analysis: string;
  impactLevel: "CRÍTICO" | "ALTO" | "MODERADO";
}

const INITIAL_INDICATORS: MacroIndicator[] = [
  {
    id: "btc",
    symbol: "BTC/USD",
    name: "Bitcoin Spot",
    value: "$89.450",
    change: "+3,42%",
    isPositive: true,
    impactLevel: "CRÍTICO",
    analysis:
      "Acumulación récord por fondos soberanos e institucionales tras la aceleración del déficit fiscal estadounidense.",
  },
  {
    id: "gold",
    symbol: "XAU/USD",
    name: "Oro Físico (Oz)",
    value: "$2.742,50",
    change: "+0,85%",
    isPositive: true,
    impactLevel: "ALTO",
    analysis:
      "Bancos centrales de economías emergentes incrementan reservas físicas en respuesta al riesgo geopolítico.",
  },
  {
    id: "brent",
    symbol: "BRENT",
    name: "Petróleo Brent",
    value: "$74,20",
    change: "-1,15%",
    isPositive: false,
    impactLevel: "MODERADO",
    analysis:
      "Presión a la baja por mayor oferta no-OPEP y desaceleración temporal de la demanda manufacturera.",
  },
  {
    id: "fed",
    symbol: "FED RATE",
    name: "Tasa Referencia FED",
    value: "4,75%",
    change: "0.00%",
    isPositive: true,
    neutral: true,
    impactLevel: "ALTO",
    analysis:
      "La Reserva Federal sostiene una postura prudente ante la resistencia inflacionaria del sector servicios.",
  },
  {
    id: "uyu",
    symbol: "USD/UYU",
    name: "Dólar en Uruguay",
    value: "$41,80",
    change: "-0,12%",
    isPositive: false,
    neutral: true,
    impactLevel: "ALTO",
    analysis:
      "Estabilidad del peso uruguayo impulsada por colocaciones de deuda soberana e ingresos por exportación de servicios.",
  },
  {
    id: "cpi",
    symbol: "GLOBAL CPI",
    name: "Inflación Media G20",
    value: "3,10%",
    change: "-0,05%",
    isPositive: true,
    impactLevel: "MODERADO",
    analysis:
      "Desaceleración paulatina de precios finales, aunque con costos logísticos marítimos bajo observación.",
  },
];

export const MacroTerminalBar: React.FC = () => {
  const [selectedIndicator, setSelectedIndicator] =
    useState<MacroIndicator | null>(null);

  return (
    <div className="w-full bg-black/90 border-b border-white/10 font-mono text-xs text-neutral-300 relative overflow-hidden backdrop-blur-md">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Terminal Label */}
        <div className="hidden md:flex items-center gap-2 px-4 py-2.5 bg-neutral-900 border-r border-white/10 shrink-0 text-[11px] font-bold tracking-widest text-emerald-400">
          <Activity className="w-3.5 h-3.5 animate-pulse text-emerald-400" />
          <span>LIVE MACRO TERMINAL</span>
        </div>

        {/* Ticker items */}
        <div className="flex items-center gap-6 overflow-x-auto no-scrollbar py-2.5 px-4 scroll-smooth">
          {INITIAL_INDICATORS.map((ind) => (
            <button
              key={ind.id}
              onClick={() => setSelectedIndicator(ind)}
              className="flex items-center gap-2 shrink-0 hover:bg-white/5 px-2 py-1 rounded transition-colors text-left cursor-pointer group"
            >
              <span className="font-bold text-white group-hover:text-amber-400 transition-colors">
                {ind.symbol}
              </span>
              <span className="text-neutral-300">{ind.value}</span>
              <span
                className={`flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.2 rounded ${
                  ind.neutral
                    ? "text-neutral-400 bg-neutral-800"
                    : ind.isPositive
                      ? "text-emerald-400 bg-emerald-500/10"
                      : "text-rose-400 bg-rose-500/10"
                }`}
              >
                {!ind.neutral &&
                  (ind.isPositive ? (
                    <TrendingUp className="w-2.5 h-2.5" />
                  ) : (
                    <TrendingDown className="w-2.5 h-2.5" />
                  ))}
                {ind.change}
              </span>
            </button>
          ))}
        </div>

        {/* Live Status indicator */}
        <div className="hidden lg:flex items-center gap-2 px-4 py-2.5 border-l border-white/10 shrink-0 text-[10px] text-neutral-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
          <span>ACTUALIZADO EN TIEMPO REAL</span>
        </div>
      </div>

      {/* Analytical Tooltip Modal */}
      {selectedIndicator && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-950 border border-white/20 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl relative animate-in fade-in zoom-in duration-150 font-sans">
            <button
              onClick={() => setSelectedIndicator(null)}
              className="absolute top-4 right-4 text-neutral-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[10px] font-mono text-neutral-400 uppercase tracking-widest">
                  ANÁLISIS DE MERCADO · BLACKNEWS INTEL
                </div>
                <h3 className="text-lg font-bold text-white font-['Lexend']">
                  {selectedIndicator.name} ({selectedIndicator.symbol})
                </h3>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 font-mono text-xs">
              <div className="p-3 bg-neutral-900 rounded-xl border border-white/5">
                <div className="text-[10px] text-neutral-500">VALOR ACTUAL</div>
                <div className="text-base font-bold text-white">
                  {selectedIndicator.value}
                </div>
              </div>
              <div className="p-3 bg-neutral-900 rounded-xl border border-white/5">
                <div className="text-[10px] text-neutral-500">VARIACIÓN</div>
                <div
                  className={`text-base font-bold ${selectedIndicator.isPositive ? "text-emerald-400" : "text-rose-400"}`}
                >
                  {selectedIndicator.change}
                </div>
              </div>
            </div>

            <div className="p-4 bg-neutral-900/60 rounded-xl border border-white/10 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-neutral-400">IMPACTO EN PORTAFOLIO</span>
                <span className="px-2 py-0.5 bg-amber-400/20 text-amber-300 font-bold rounded text-[10px]">
                  {selectedIndicator.impactLevel}
                </span>
              </div>
              <p className="text-xs text-neutral-300 leading-relaxed font-light">
                {selectedIndicator.analysis}
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedIndicator(null)}
                className="px-4 py-2 bg-white text-black font-bold text-xs uppercase rounded-xl hover:bg-neutral-200 transition-colors"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
