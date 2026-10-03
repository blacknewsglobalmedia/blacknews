import React, { useState } from "react";
import {
  Calculator,
  DollarSign,
  ShieldAlert,
  TrendingDown,
  ShieldCheck,
  RefreshCw,
  BarChart3,
  HelpCircle,
} from "lucide-react";

export const PurchasingPowerCalculator: React.FC = () => {
  const [amount, setAmount] = useState<number>(50000);
  const [currency, setCurrency] = useState<"UYU" | "USD">("UYU");
  const [years, setYears] = useState<number>(3);

  // Approximate historical annual inflation estimates
  const annualInflation = currency === "UYU" ? 0.058 : 0.032; // 5.8% UYU, 3.2% USD
  const goldPreservationRate = 0.085; // 8.5% average annual appreciation of gold/hard assets

  // Calculations
  const futureFiatValue = amount / Math.pow(1 + annualInflation, years);
  const purchasingPowerLoss = amount - futureFiatValue;
  const purchasingPowerLossPercent = (
    (purchasingPowerLoss / amount) *
    100
  ).toFixed(1);

  const hardAssetValue = amount * Math.pow(1 + goldPreservationRate, years);
  const assetDifference = hardAssetValue - futureFiatValue;

  return (
    <div className="w-full bg-neutral-950 border border-white/10 rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl my-8 font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-amber-400 font-bold mb-1">
            <Calculator className="w-4 h-4 text-amber-400" />
            <span>HERRAMIENTA INTERACTIVA · MONEDA & PODER ADQUISITIVO</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight font-['Lexend']">
            Calculadora de Erosión Monetaria y Reserva de Valor
          </h3>
          <p className="text-xs sm:text-sm text-neutral-400 font-light mt-1 max-w-2xl">
            Simula el impacto de la inflación implícita en tus liquidez
            monetaria frente a activos duros y de alta certidumbre
            macroeconómica.
          </p>
        </div>

        <div className="px-3.5 py-2 bg-neutral-900 border border-white/10 rounded-xl text-xs font-mono text-neutral-300 flex items-center gap-2 shrink-0">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span>Inflación UYU: ~5,8% p.a. | USD: ~3,2% p.a.</span>
        </div>
      </div>

      {/* Input Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
        {/* Amount Input */}
        <div className="p-4 bg-neutral-900/80 rounded-xl border border-white/10 space-y-2">
          <label className="text-[11px] text-neutral-400 uppercase font-bold block">
            Monto Inicial de Capital:
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 font-bold">
              {currency === "UYU" ? "$" : "US$"}
            </span>
            <input
              type="number"
              value={amount}
              onChange={(e) =>
                setAmount(Math.max(1000, Number(e.target.value)))
              }
              className="w-full bg-black border border-white/10 text-white font-bold text-base pl-10 pr-3 py-2 rounded-lg focus:outline-none focus:border-amber-400 transition-colors"
            />
          </div>
        </div>

        {/* Currency Selection */}
        <div className="p-4 bg-neutral-900/80 rounded-xl border border-white/10 space-y-2">
          <label className="text-[11px] text-neutral-400 uppercase font-bold block">
            Moneda de Referencia:
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setCurrency("UYU")}
              className={`py-2 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                currency === "UYU"
                  ? "bg-amber-400 text-black"
                  : "bg-black text-neutral-400 hover:text-white border border-white/10"
              }`}
            >
              Pesos (UYU)
            </button>
            <button
              onClick={() => setCurrency("USD")}
              className={`py-2 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                currency === "USD"
                  ? "bg-amber-400 text-black"
                  : "bg-black text-neutral-400 hover:text-white border border-white/10"
              }`}
            >
              Dólares (USD)
            </button>
          </div>
        </div>

        {/* Time Horizon Selection */}
        <div className="p-4 bg-neutral-900/80 rounded-xl border border-white/10 space-y-2">
          <label className="text-[11px] text-neutral-400 uppercase font-bold block">
            Horizonte Temporal:
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {[1, 3, 5].map((y) => (
              <button
                key={y}
                onClick={() => setYears(y)}
                className={`py-2 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                  years === y
                    ? "bg-white text-black"
                    : "bg-black text-neutral-400 hover:text-white border border-white/10"
                }`}
              >
                {y} {y === 1 ? "Año" : "Años"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results Comparison Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: Fiat Erosion */}
        <div className="p-5 bg-rose-950/20 border border-rose-500/30 rounded-xl space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-rose-400 font-bold flex items-center gap-1.5">
              <TrendingDown className="w-4 h-4" />
              MANTENER EN DINERO FIAT / EFECTIVO
            </span>
            <span className="px-2 py-0.5 bg-rose-500/20 text-rose-300 font-bold rounded text-[10px]">
              PÉRDIDA DE -{purchasingPowerLossPercent}%
            </span>
          </div>

          <div>
            <div className="text-2xl font-bold text-white font-mono">
              {currency === "UYU" ? "$" : "US$"}{" "}
              {futureFiatValue.toLocaleString("es-UY", {
                maximumFractionDigits: 0,
              })}
            </div>
            <div className="text-xs text-neutral-400 mt-1 font-light">
              Poder adquisitivo real proyectado en {years}{" "}
              {years === 1 ? "año" : "años"} debido a la pérdida de capacidad de
              compra.
            </div>
          </div>

          <div className="pt-2 border-t border-rose-500/20 flex items-center justify-between text-xs font-mono text-rose-300">
            <span>Capital Erosionado:</span>
            <span className="font-bold">
              -{currency === "UYU" ? "$" : "US$"}{" "}
              {purchasingPowerLoss.toLocaleString("es-UY", {
                maximumFractionDigits: 0,
              })}
            </span>
          </div>
        </div>

        {/* Card 2: Hard Asset Protection */}
        <div className="p-5 bg-emerald-950/20 border border-emerald-500/30 rounded-xl space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-emerald-400 font-bold flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" />
              RESPALDO EN ACTIVOS DUROS & ORO FÍSICO
            </span>
            <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 font-bold rounded text-[10px]">
              PROTECCIÓN PRODUCTIVA
            </span>
          </div>

          <div>
            <div className="text-2xl font-bold text-emerald-400 font-mono">
              {currency === "UYU" ? "$" : "US$"}{" "}
              {hardAssetValue.toLocaleString("es-UY", {
                maximumFractionDigits: 0,
              })}
            </div>
            <div className="text-xs text-neutral-400 mt-1 font-light">
              Valor nominal estimado conservando el poder adquisitivo real y
              absorbiendo la inflación.
            </div>
          </div>

          <div className="pt-2 border-t border-emerald-500/20 flex items-center justify-between text-xs font-mono text-emerald-300">
            <span>Diferencia a Favor:</span>
            <span className="font-bold">
              +{currency === "UYU" ? "$" : "US$"}{" "}
              {assetDifference.toLocaleString("es-UY", {
                maximumFractionDigits: 0,
              })}
            </span>
          </div>
        </div>
      </div>

      {/* Analytical Footer Note */}
      <div className="p-4 bg-neutral-900/60 rounded-xl border border-white/5 flex items-start gap-3 text-xs text-neutral-400 font-light">
        <HelpCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <p>
          <strong className="text-white font-medium">
            Metodología de cálculo:
          </strong>{" "}
          Datos construidos a partir de promedios ponderados de IPC y tasas
          reales de rendimiento en metales preciosos y activos productivos
          durante los últimos 10 años. Este simulador tiene fines estrictamente
          informativos y analíticos.
        </p>
      </div>
    </div>
  );
};
