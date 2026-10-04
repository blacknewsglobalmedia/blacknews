import React, { useState } from "react";
import {
  X,
  Check,
  ShieldCheck,
  Zap,
  Globe,
  Sparkles,
  Lock,
} from "lucide-react";

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubscribeSuccess?: (planId: string) => void;
}

export const SubscriptionModal: React.FC<SubscriptionModalProps> = ({
  isOpen,
  onClose,
  onSubscribeSuccess,
}) => {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">(
    "yearly",
  );
  const [selectedPlan, setSelectedPlan] = useState<string>("digital");
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubscribe = (planId: string) => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      try {
        localStorage.setItem(
          "blacknews_subscription",
          JSON.stringify({
            status: "active",
            plan: planId,
            activatedAt: new Date().toISOString(),
          }),
        );
      } catch {}
      onSubscribeSuccess?.(planId);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-black border border-white/15 rounded-2xl max-w-3xl w-full p-6 sm:p-8 relative shadow-2xl overflow-y-auto max-h-[90vh] text-[#EDEDED]">
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full text-neutral-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="text-center space-y-2 max-w-xl mx-auto mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/10 text-[11px] font-mono text-amber-400 uppercase tracking-widest font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            Membresía Periodística Independiente
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight font-['Lexend'] leading-tight">
            Información sin sesgos, sin pausas.
          </h2>
          <p className="text-xs sm:text-sm text-neutral-400 font-light leading-relaxed">
            Accede a cobertura geopolítica en tiempo real, mapas interactivos
            sin límites y despachos elaborados directamente por nuestra red de
            corresponsalías.
          </p>

          {/* Billing Switcher */}
          <div className="pt-3 flex items-center justify-center gap-3 select-none">
            <span
              className={`text-xs cursor-pointer transition-colors ${
                billingCycle === "monthly"
                  ? "text-white font-semibold"
                  : "text-neutral-500"
              }`}
              onClick={() => setBillingCycle("monthly")}
            >
              Facturación Mensual
            </span>
            <button
              type="button"
              onClick={() =>
                setBillingCycle(
                  billingCycle === "monthly" ? "yearly" : "monthly",
                )
              }
              className="w-11 h-6 bg-neutral-900 border border-white/20 rounded-full p-0.5 flex items-center transition-colors cursor-pointer"
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform ${
                  billingCycle === "yearly" ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
            <span
              className={`text-xs cursor-pointer transition-colors flex items-center gap-1.5 ${
                billingCycle === "yearly"
                  ? "text-white font-semibold"
                  : "text-neutral-500"
              }`}
              onClick={() => setBillingCycle("yearly")}
            >
              <span>Anual</span>
              <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                Ahorra 20%
              </span>
            </span>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Plan 1: Gratuito */}
          <div
            onClick={() => setSelectedPlan("free")}
            className={`p-5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
              selectedPlan === "free"
                ? "bg-neutral-950 border-white text-white shadow-lg"
                : "bg-black border-white/10 hover:border-white/25 text-neutral-300"
            }`}
          >
            <div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-neutral-500 mb-1">
                Lectura Libre
              </div>
              <div className="text-xl font-bold text-white mb-2">Gratuito</div>
              <div className="text-2xl font-bold text-white font-mono mb-4">
                $0{" "}
                <span className="text-xs text-neutral-500 font-normal">
                  / siempre
                </span>
              </div>
              <ul className="space-y-2.5 text-xs text-neutral-400 font-light">
                <li className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>2 lecturas diarias (invitado) · 3 con cuenta</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Teletipo de última hora</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Guardado de lecturas en local</span>
                </li>
              </ul>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="w-full mt-6 py-2.5 rounded-lg border border-white/20 text-white font-semibold text-xs uppercase tracking-wider hover:bg-white/10 transition-colors"
            >
              Plan Actual
            </button>
          </div>

          {/* Plan 2: Digital Pass (Recomendado) */}
          <div
            onClick={() => setSelectedPlan("digital")}
            className={`p-5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between relative ${
              selectedPlan === "digital"
                ? "bg-neutral-900 border-white shadow-2xl ring-1 ring-white/20"
                : "bg-neutral-950 border-white/15 hover:border-white/30 text-neutral-200"
            }`}
          >
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-2.5 py-0.5 bg-white text-black text-[10px] font-bold uppercase tracking-wider rounded-full shadow-md">
              Más Popular
            </div>

            <div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-amber-400 mb-1 font-semibold flex items-center gap-1">
                <Zap className="w-3 h-3" /> Digital Pass
              </div>
              <div className="text-xl font-bold text-white mb-2">
                Pase Ilimitado
              </div>
              <div className="text-3xl font-bold text-white font-mono mb-4">
                {billingCycle === "yearly" ? "$3.99" : "$4.99"}
                <span className="text-xs text-neutral-400 font-normal">
                  {" "}
                  / mes
                </span>
              </div>
              <ul className="space-y-2.5 text-xs text-neutral-300 font-light">
                <li className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <span className="text-white font-medium">
                    Lecturas ilimitadas en el mapa de cobertura
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <span>Acceso total a informes y análisis especiales</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <span>Generación y exportación de imágenes 4:5 HQ</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <span>Sin publicidad ni patrocinadores intermedios</span>
                </li>
              </ul>
            </div>

            <button
              type="button"
              disabled={isLoading}
              onClick={(e) => {
                e.stopPropagation();
                handleSubscribe("digital");
              }}
              className="w-full mt-6 py-3 rounded-lg bg-white hover:bg-neutral-200 text-black font-bold text-xs uppercase tracking-wider transition-colors shadow-xl flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLoading ? (
                "Activando suscripción..."
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Activar Digital Pass</span>
                </>
              )}
            </button>
          </div>

          {/* Plan 3: Pro Terminal */}
          <div
            onClick={() => setSelectedPlan("pro")}
            className={`p-5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
              selectedPlan === "pro"
                ? "bg-neutral-950 border-white text-white shadow-lg"
                : "bg-black border-white/10 hover:border-white/25 text-neutral-300"
            }`}
          >
            <div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-cyan-400 mb-1 font-semibold flex items-center gap-1">
                <Globe className="w-3 h-3" /> Pro Terminal
              </div>
              <div className="text-xl font-bold text-white mb-2">
                Terminal Institucional
              </div>
              <div className="text-2xl font-bold text-white font-mono mb-4">
                {billingCycle === "yearly" ? "$11.99" : "$14.99"}
                <span className="text-xs text-neutral-500 font-normal">
                  {" "}
                  / mes
                </span>
              </div>
              <ul className="space-y-2.5 text-xs text-neutral-400 font-light">
                <li className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                  <span>Todo lo incluido en el Digital Pass</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                  <span>Radar geopolítico en tiempo real + alertas</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                  <span>Licencia de citación comercial de informes</span>
                </li>
              </ul>
            </div>

            <button
              type="button"
              disabled={isLoading}
              onClick={(e) => {
                e.stopPropagation();
                handleSubscribe("pro");
              }}
              className="w-full mt-6 py-2.5 rounded-lg bg-neutral-900 border border-white/20 hover:bg-neutral-800 text-white font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
            >
              {isLoading ? "Procesando..." : "Suscribir a Pro"}
            </button>
          </div>
        </div>

        {/* Footer info */}
        <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between text-[11px] text-neutral-500 font-light gap-2">
          <div className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-neutral-400" />
            <span>
              Pago seguro encriptado (Cancelación inmediata en 1-clic)
            </span>
          </div>
          <div>Periodismo libre de intereses corporativos.</div>
        </div>
      </div>
    </div>
  );
};
