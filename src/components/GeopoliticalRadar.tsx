import React, { useState } from "react";
import {
  Radar,
  Radio,
  Shield,
  Globe2,
  ChevronRight,
  Clock,
  AlertTriangle,
  Eye,
  ArrowUpRight,
} from "lucide-react";

interface RadarPulse {
  id: string;
  timestamp: string;
  region: string;
  topic: string;
  headline: string;
  certainty: number;
  impact: "CRÍTICO" | "ALTO" | "EN OBSERVACIÓN";
  summary: string;
}

const RADAR_PULSES: RadarPulse[] = [
  {
    id: "p1",
    timestamp: "HACE 12 MIN",
    region: "ORIENTE MEDIO",
    topic: "ENERGÍA Y RUTAS",
    headline:
      "Fluctuación en estrechos estratégicos impulsa primas de seguro marítimo",
    certainty: 96,
    impact: "CRÍTICO",
    summary:
      "Aumento del 18% en tarifas de flete para petroleros VLCC ante nuevas exigencias de cobertura en el Estrecho de Ormuz.",
  },
  {
    id: "p2",
    timestamp: "HACE 34 MIN",
    region: "SUIZA / UE",
    topic: "REGULACIÓN BANCARIA",
    headline:
      "Bancos centrales europeos evalúan nuevos marcos para liquidez transfronteriza",
    certainty: 91,
    impact: "ALTO",
    summary:
      "Directiva preliminar busca reforzar encajes de capital para entidades no bancarias con alta exposición internacional.",
  },
  {
    id: "p3",
    timestamp: "HACE 1 HORA",
    region: "LATINOAMÉRICA",
    topic: "LITIO Y MINERALES",
    headline:
      "Inversión en infraestructura minera en el Cono Sur alcanza máximo de 3 años",
    certainty: 88,
    impact: "EN OBSERVACIÓN",
    summary:
      "Nuevos contratos bilaterales de procesamiento local fortalecen cadenas de valor de baterías de estado sólido.",
  },
  {
    id: "p4",
    timestamp: "HACE 2 HORAS",
    region: "EE.UU. / ASIA",
    topic: "SEMICONDUCTORES",
    headline:
      "Acuerdos de transferencia tecnológica de microchips registran avance en Asia Oriental",
    certainty: 94,
    impact: "ALTO",
    summary:
      "Plantas de empaquetado avanzado en Japón y Taiwán aseguran suministros para centros de datos de IA generativa.",
  },
];

export const GeopoliticalRadar: React.FC = () => {
  const [selectedFilter, setSelectedFilter] = useState<string>("TODOS");

  const filteredPulses =
    selectedFilter === "TODOS"
      ? RADAR_PULSES
      : RADAR_PULSES.filter((p) => p.impact === selectedFilter);

  return (
    <div className="w-full bg-neutral-950 border border-white/10 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl my-8 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400 shrink-0">
            <Radar
              className="w-5 h-5 animate-spin"
              style={{ animationDuration: "8s" }}
            />
          </div>
          <div>
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-sky-400 font-bold">
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              <span>RADAR DE SEÑALES EN TIEMPO REAL</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight font-['Lexend']">
              Inteligencia Geopolítica y Pulso Global
            </h3>
          </div>
        </div>

        {/* Filter Buttons */}
        <div className="flex items-center gap-1 bg-neutral-900 p-1 rounded-xl border border-white/10 text-xs font-mono self-start sm:self-auto">
          {["TODOS", "CRÍTICO", "ALTO", "EN OBSERVACIÓN"].map((filter) => (
            <button
              key={filter}
              onClick={() => setSelectedFilter(filter)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                selectedFilter === filter
                  ? "bg-white text-black font-bold"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Signals Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredPulses.map((pulse) => (
          <div
            key={pulse.id}
            className="p-5 rounded-xl bg-neutral-900/60 border border-white/10 hover:border-white/25 transition-all space-y-3 shadow-md group"
          >
            <div className="flex items-center justify-between text-[11px] font-mono">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-white/10 text-white font-bold rounded">
                  {pulse.region}
                </span>
                <span className="text-neutral-400 font-semibold">
                  {pulse.topic}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-neutral-400">
                <Clock className="w-3 h-3 text-neutral-500" />
                <span>{pulse.timestamp}</span>
              </div>
            </div>

            <h4 className="text-sm sm:text-base font-bold text-white group-hover:text-sky-300 transition-colors font-['Lexend'] leading-snug">
              {pulse.headline}
            </h4>

            <p className="text-xs text-neutral-300 font-light leading-relaxed">
              {pulse.summary}
            </p>

            <div className="pt-3 border-t border-white/5 flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="text-neutral-400 text-[10px] uppercase">
                  CERTEZA ANALÍTICA:
                </span>
                <span className="font-bold text-emerald-400">
                  {pulse.certainty}%
                </span>
              </div>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  pulse.impact === "CRÍTICO"
                    ? "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                    : pulse.impact === "ALTO"
                      ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                      : "bg-sky-500/10 text-sky-400 border border-sky-500/30"
                }`}
              >
                {pulse.impact}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
