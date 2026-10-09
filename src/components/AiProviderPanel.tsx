/**
 * AiProviderPanel — Visualizador y gestor de proveedores IA disponibles.
 * Muestra el estado, créditos estimados y límites de cada API configurada.
 * Se renderiza dentro de ServiceUsagePanel en el overview del dashboard.
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  Bot,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Zap,
  Cloud,
  Cpu,
} from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type ProviderStatus = "ok" | "error" | "unknown" | "checking";

interface ProviderInfo {
  id: string;
  name: string;
  icon: React.ReactNode;
  /** Descripción del límite diario en la capa gratuita */
  freeLimit: string;
  /** URL del panel de créditos / dashboard */
  dashboardUrl: string;
  /** Clave que el worker expone en /api/ai/provider-status (si hay) */
  statusKey: string;
  /** Si es nativa de Cloudflare (sin API key) */
  native?: boolean;
  /** Descripción corta del plan */
  plan: string;
  /** Color del indicador */
  color: string;
}

const PROVIDERS: ProviderInfo[] = [
  {
    id: "workers_ai",
    name: "Cloudflare Workers AI",
    icon: <Cloud className="w-4 h-4" />,
    freeLimit: "10.000 neuronas · Sin tarjeta",
    dashboardUrl: "https://dash.cloudflare.com/?to=/:account/ai",
    statusKey: "workers_ai",
    native: true,
    plan: "Nativo · Gratis",
    color: "#f38020",
  },
  {
    id: "groq",
    name: "Groq Cloud",
    icon: <Zap className="w-4 h-4" />,
    freeLimit: "14.400 peticiones / día",
    dashboardUrl: "https://console.groq.com/keys",
    statusKey: "groq",
    plan: "Free Tier · Sin tarjeta",
    color: "#f55036",
  },
  {
    id: "gemini",
    name: "Google Gemini",
    icon: <Cpu className="w-4 h-4" />,
    freeLimit: "1.500 peticiones / día",
    dashboardUrl: "https://aistudio.google.com/app/apikey",
    statusKey: "gemini",
    plan: "Free Tier · Sin tarjeta",
    color: "#4285f4",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    icon: <Bot className="w-4 h-4" />,
    freeLimit: "1.000 peticiones / día*",
    dashboardUrl: "https://openrouter.ai/credits",
    statusKey: "openrouter",
    plan: "Free con saldo · $0.0001/post",
    color: "#7c3aed",
  },
];

// ─── Utilidades ───────────────────────────────────────────────────────────────

const STATUS_ICON: Record<ProviderStatus, React.ReactNode> = {
  ok: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />,
  error: <XCircle className="w-3.5 h-3.5 text-red-400" />,
  unknown: <AlertTriangle className="w-3.5 h-3.5 text-neutral-500" />,
  checking: (
    <span className="w-3.5 h-3.5 rounded-full border-2 border-neutral-600 border-t-white animate-spin inline-block" />
  ),
};

const STATUS_LABEL: Record<ProviderStatus, string> = {
  ok: "Activo",
  error: "No configurado",
  unknown: "Sin verificar",
  checking: "Verificando…",
};

// ─── Hook que consulta el estado desde el worker ──────────────────────────────

interface ProviderStatuses {
  workers_ai: ProviderStatus;
  groq: ProviderStatus;
  gemini: ProviderStatus;
  openrouter: ProviderStatus;
}

function useProviderStatuses() {
  const [statuses, setStatuses] = useState<ProviderStatuses>({
    workers_ai: "unknown",
    groq: "unknown",
    gemini: "unknown",
    openrouter: "unknown",
  });
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);

  const check = useCallback(async () => {
    setLoading(true);
    setStatuses({
      workers_ai: "checking",
      groq: "checking",
      gemini: "checking",
      openrouter: "checking",
    });
    try {
      const res = await fetch("/api/ai/provider-status", { method: "GET" });
      if (res.ok) {
        const data = (await res.json()) as {
          providers?: Partial<Record<string, boolean | string>>;
        };
        const p = data.providers || {};
        setStatuses({
          workers_ai: p["workers_ai"] ? "ok" : "error",
          groq: p["groq"] ? "ok" : "error",
          gemini: p["gemini"] ? "ok" : "error",
          openrouter: p["openrouter"] ? "ok" : "error",
        });
        setLastChecked(new Date());
      } else {
        // El endpoint no existe todavía: se marca como desconocido
        setStatuses({
          workers_ai: "unknown",
          groq: "unknown",
          gemini: "unknown",
          openrouter: "unknown",
        });
      }
    } catch {
      setStatuses({
        workers_ai: "unknown",
        groq: "unknown",
        gemini: "unknown",
        openrouter: "unknown",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  return { statuses, lastChecked, loading, check };
}

// ─── Subcomponente: tarjeta de proveedor ──────────────────────────────────────

const ProviderCard: React.FC<{
  provider: ProviderInfo;
  status: ProviderStatus;
}> = ({ provider, status }) => {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-neutral-900/60 border border-white/[0.06] p-3.5 transition-colors hover:border-white/10">
      {/* Icono coloreado */}
      <div
        className="p-2 rounded-lg shrink-0 mt-0.5"
        style={{
          backgroundColor: provider.color + "18",
          color: provider.color,
        }}
      >
        {provider.icon}
      </div>

      {/* Info central */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-bold text-white">{provider.name}</span>
          {provider.native && (
            <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border border-orange-500/30 text-orange-400/80 bg-orange-500/10">
              Nativo
            </span>
          )}
        </div>
        <div className="text-[10px] text-neutral-500 mt-0.5 font-light">
          {provider.plan}
        </div>
        <div className="text-[10px] text-neutral-400 mt-1 font-mono">
          <span className="text-neutral-600">Límite free: </span>
          {provider.freeLimit}
        </div>
      </div>

      {/* Columna derecha: estado + link */}
      <div className="flex flex-col items-end gap-2 shrink-0">
        <div className="flex items-center gap-1.5">
          {STATUS_ICON[status]}
          <span
            className={`text-[10px] font-semibold ${
              status === "ok"
                ? "text-emerald-400"
                : status === "error"
                  ? "text-red-400"
                  : "text-neutral-500"
            }`}
          >
            {STATUS_LABEL[status]}
          </span>
        </div>
        <a
          href={provider.dashboardUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[10px] text-neutral-600 hover:text-white transition-colors"
          title={`Abrir panel de ${provider.name}`}
        >
          <ExternalLink className="w-2.5 h-2.5" />
          <span>Panel</span>
        </a>
      </div>
    </div>
  );
};

// ─── Componente Principal ─────────────────────────────────────────────────────

export const AiProviderPanel: React.FC = () => {
  const { statuses, lastChecked, loading, check } = useProviderStatuses();

  // Verificar al montar
  useEffect(() => {
    check();
  }, [check]);

  const activeCount = Object.values(statuses).filter((s) => s === "ok").length;

  return (
    <div className="border border-white/10 rounded-xl bg-neutral-950/60 p-5 flex flex-col gap-4">
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="w-3.5 h-3.5 text-neutral-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-white">
            Proveedores de IA · Redacción
          </h3>
          {activeCount > 0 && (
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
              {activeCount} activo{activeCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={check}
          disabled={loading}
          className="text-[11px] text-neutral-500 hover:text-white font-medium flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
          title="Verificar estado de los proveedores"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
          Verificar
        </button>
      </div>

      {/* Resumen rápido de créditos */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {PROVIDERS.map((p) => (
          <div
            key={p.id}
            className="text-center p-2.5 rounded-lg bg-white/[0.03] border border-white/5"
          >
            <div
              className="text-lg font-extrabold tracking-tight"
              style={{
                color:
                  statuses[p.statusKey as keyof typeof statuses] === "ok"
                    ? p.color
                    : "#525252",
              }}
            >
              {p.id === "workers_ai"
                ? "10K"
                : p.id === "groq"
                  ? "14.4K"
                  : p.id === "gemini"
                    ? "1.5K"
                    : "1K"}
            </div>
            <div className="text-[9px] font-mono text-neutral-500 mt-0.5 truncate">
              {p.name.split(" ")[0]}
            </div>
            <div className="text-[9px] text-neutral-600 mt-0.5">
              /día gratis
            </div>
          </div>
        ))}
      </div>

      {/* Tarjetas de estado por proveedor */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {PROVIDERS.map((p) => (
          <ProviderCard
            key={p.id}
            provider={p}
            status={statuses[p.statusKey as keyof typeof statuses]}
          />
        ))}
      </div>

      {/* Instrucciones rápidas para añadir claves */}
      <div className="pt-3 border-t border-white/[0.06] space-y-1.5">
        <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
          Cómo activar un proveedor
        </div>
        <div className="text-[11px] text-neutral-500 font-light leading-relaxed space-y-1">
          <div>
            <span className="text-neutral-300 font-mono">
              Cloudflare Workers AI:
            </span>{" "}
            Ya enlazado en{" "}
            <code className="bg-white/5 px-1 rounded">wrangler.jsonc</code> —
            despliega para activar.
          </div>
          <div>
            <span className="text-neutral-300 font-mono">Groq:</span>{" "}
            <code className="bg-white/5 px-1 rounded">
              npx wrangler secret put GROQ_API_KEY
            </code>
          </div>
          <div>
            <span className="text-neutral-300 font-mono">Gemini:</span>{" "}
            <code className="bg-white/5 px-1 rounded">
              npx wrangler secret put GEMINI_API_KEY
            </code>
          </div>
          <div>
            <span className="text-neutral-300 font-mono">OpenRouter:</span>{" "}
            <code className="bg-white/5 px-1 rounded">
              npx wrangler secret put OPENROUTER_API_KEY
            </code>
          </div>
        </div>
        {lastChecked && (
          <div className="text-[10px] font-mono text-neutral-700 pt-1">
            Última verificación: {lastChecked.toLocaleTimeString("es-ES")}
          </div>
        )}
      </div>

      <p className="text-[10px] text-neutral-700 font-light -mt-1">
        * OpenRouter requiere saldo mínimo cargado en cuenta para desbloquear
        1.000 peticiones gratuitas/día. Groq y Gemini son 100% gratis sin
        tarjeta.
      </p>
    </div>
  );
};
