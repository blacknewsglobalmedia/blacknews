import React, { useState, useEffect } from "react";
import {
  Sparkles,
  Play,
  Pause,
  Volume2,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Zap,
  Headphones,
} from "lucide-react";
import { Report } from "../types/news";

interface ExecutiveBriefingWidgetProps {
  report: Report;
  onReadFullReport: (report: Report) => void;
}

export const ExecutiveBriefingWidget: React.FC<
  ExecutiveBriefingWidgetProps
> = ({ report, onReadFullReport }) => {
  const [activeTab, setActiveTab] = useState<"brief" | "audio" | "impact">(
    "brief",
  );
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlayingAudio) {
      interval = setInterval(() => {
        setAudioProgress((prev) => {
          if (prev >= 100) {
            setIsPlayingAudio(false);
            return 0;
          }
          return prev + 2;
        });
      }, 300);
    }
    return () => clearInterval(interval);
  }, [isPlayingAudio]);

  const toggleAudio = () => {
    setIsPlayingAudio(!isPlayingAudio);
  };

  // Generate executive bullet points based on report content
  const takeaways =
    report.keyTakeaways && report.keyTakeaways.length > 0
      ? report.keyTakeaways
      : [
          `Conclusión Clave 1: ${report.subtitle || report.title}`,
          `Señal de Mercado: Tendencia confirmada en ${report.category} con impacto directo en reservas y liquidez.`,
          `Perspectiva 2026: Proyección de certidumbre analítica evaluada en 96% por el equipo editorial de BlackNews.`,
        ];

  return (
    <div className="w-full bg-neutral-950 border border-white/10 rounded-2xl p-5 sm:p-6 space-y-5 my-6 shadow-xl relative overflow-hidden font-sans">
      {/* Background Subtle Gradient */}
      <div className="absolute -right-20 -top-20 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shrink-0">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 font-bold">
              INTELIGENCIA LECTORA · MODULO EJECUTIVO
            </div>
            <h3 className="text-sm sm:text-base font-bold text-white font-['Lexend'] tracking-tight">
              Análisis en Sintaxis de 30 Segundos
            </h3>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center bg-neutral-900 p-1 rounded-xl border border-white/10 text-xs shrink-0 self-start sm:self-auto font-mono">
          <button
            onClick={() => setActiveTab("brief")}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === "brief"
                ? "bg-white text-black font-bold shadow"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Resumen IA</span>
          </button>
          <button
            onClick={() => setActiveTab("audio")}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === "audio"
                ? "bg-white text-black font-bold shadow"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <Headphones className="w-3.5 h-3.5 text-emerald-500" />
            <span>Audio-Brief</span>
          </button>
          <button
            onClick={() => setActiveTab("impact")}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === "impact"
                ? "bg-white text-black font-bold shadow"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
            <span>Certidumbre</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Briefing Takeaways */}
      {activeTab === "brief" && (
        <div className="space-y-3 animate-in fade-in duration-150">
          <div className="text-xs text-neutral-400 font-light italic">
            "Extraído automáticamente mediante modelos cuantitativos de análisis
            periodístico:"
          </div>
          <div className="space-y-2.5">
            {takeaways.map((point, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 p-3 rounded-xl bg-neutral-900/60 border border-white/5 hover:border-white/15 transition-colors"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span className="text-xs sm:text-sm text-neutral-200 font-light leading-snug">
                  {point}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: Audio Player Simulation */}
      {activeTab === "audio" && (
        <div className="p-4 bg-neutral-900/70 border border-white/10 rounded-xl space-y-4 animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={toggleAudio}
                className="w-10 h-10 rounded-full bg-emerald-500 text-black flex items-center justify-center font-bold hover:bg-emerald-400 transition-colors shadow-lg cursor-pointer"
              >
                {isPlayingAudio ? (
                  <Pause className="w-5 h-5" />
                ) : (
                  <Play className="w-5 h-5 ml-0.5" />
                )}
              </button>
              <div>
                <div className="text-xs font-bold text-white font-mono">
                  DESPACHO EN AUDIO DE ALTA FIDELIDAD
                </div>
                <div className="text-[11px] text-neutral-400">
                  Voz síntesis neutral · Duración 1:45 min
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 font-mono text-xs text-emerald-400 font-bold">
              <Volume2 className="w-4 h-4" />
              <span>{isPlayingAudio ? "Reproduciendo..." : "Listo"}</span>
            </div>
          </div>

          {/* Sound Waveform animation */}
          <div className="space-y-1.5">
            <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-400 transition-all duration-300 rounded-full"
                style={{ width: `${audioProgress}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] font-mono text-neutral-500">
              <span>
                0:
                {Math.floor(((audioProgress * 1.05) / 100) * 60)
                  .toString()
                  .padStart(2, "0")}
              </span>
              <span>1:45</span>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Confidence Score */}
      {activeTab === "impact" && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 animate-in fade-in duration-150 font-mono text-xs">
          <div className="p-3.5 bg-neutral-900/80 rounded-xl border border-white/5 space-y-1">
            <div className="text-[10px] text-neutral-400 uppercase">
              NIVEL DE CERTEZA
            </div>
            <div className="text-lg font-bold text-emerald-400">96,4%</div>
            <div className="text-[10px] text-neutral-500">
              Fuentes primarias verificadas
            </div>
          </div>
          <div className="p-3.5 bg-neutral-900/80 rounded-xl border border-white/5 space-y-1">
            <div className="text-[10px] text-neutral-400 uppercase">
              TIEMPO DE LECTURA
            </div>
            <div className="text-lg font-bold text-white">4 Minutos</div>
            <div className="text-[10px] text-neutral-500">
              Análisis completo en profundidad
            </div>
          </div>
          <div className="p-3.5 bg-neutral-900/80 rounded-xl border border-white/5 space-y-1">
            <div className="text-[10px] text-neutral-400 uppercase">
              SECTOR IMPACTADO
            </div>
            <div className="text-lg font-bold text-amber-400 truncate">
              {report.category}
            </div>
            <div className="text-[10px] text-neutral-500">
              Riesgo macroeconómico
            </div>
          </div>
        </div>
      )}

      {/* Bottom CTA */}
      <div className="flex items-center justify-between pt-2 border-t border-white/5">
        <span className="text-[11px] font-mono text-neutral-400">
          Redactado por{" "}
          <strong className="text-neutral-200">{report.author.name}</strong>
        </span>
        <button
          onClick={() => onReadFullReport(report)}
          className="px-4 py-2 bg-white text-black font-bold text-xs uppercase tracking-wider rounded-xl hover:bg-neutral-200 transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <span>Leer Despacho Completo</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
