import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  Check,
  CheckCircle2,
  Lock,
  Loader2,
  Newspaper,
  Radar,
  Sparkles,
  Telescope,
  X,
} from "lucide-react";
import { GUEST_USER_ID, type RedactorProfile } from "../types/auth";
import {
  activateSubscription,
  cancelSubscription,
  fetchPayPalConfig,
  fetchSubscriptionStatus,
  PayPalApiError,
  PLAN_NAMES,
  type BillingCycle,
  type PayPalConfig,
  type PlanTier,
  type SubscriptionStatus,
} from "../utils/paypalSubscription";

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: RedactorProfile | null;
  onOpenGoogleAuth?: () => void;
  onSubscribeSuccess?: (planId: string) => void;
  onStatusChange?: (active: boolean) => void;
}

type ConfigState = "loading" | "ready" | "unavailable" | "error";
type SdkState = "idle" | "loading" | "ready" | "error";
type ActionState = "idle" | "activating" | "pending" | "error";
type CancelState = "idle" | "confirm" | "cancelling" | "error";

/** Icono de cada plan: lectura → análisis → radar. */
type PlanIcon = React.ComponentType<{ className?: string }>;

/** Contenido comercial de cada plan (copiado de la propuesta editorial). */
const PLAN_CONTENT: Record<
  PlanTier,
  { tagline: string; cumulative: boolean; icon: PlanIcon; features: string[] }
> = {
  access: {
    tagline: "Para quien simplemente quiere apoyar y leer más.",
    cumulative: false,
    icon: Newspaper,
    features: [
      "Acceso sin publicidad",
      "Archivo de BlackNews",
      "Artículos premium",
      "Newsletter semanal",
      "Guardar artículos",
      "Perfil de miembro",
    ],
  },
  insight: {
    tagline: "Para el lector que quiere entender lo que ocurre.",
    cumulative: true,
    icon: Telescope,
    features: [
      "Análisis exclusivos",
      "Informes especiales",
      "Datos y estadísticas",
      "Gráficos interactivos",
      "Cronologías",
      "Fichas de países",
      "Newsletter premium",
      "Alertas de acontecimientos importantes",
    ],
  },
  intelligence: {
    tagline: "El plan premium de BlackNews, sin concesiones.",
    cumulative: true,
    icon: Radar,
    features: [
      "Briefings exclusivos",
      "Informes mensuales",
      "Base de datos de indicadores",
      "Mapas geopolíticos interactivos",
      "Seguimiento de conflictos y elecciones",
      "Archivo completo",
      "Acceso anticipado a investigaciones",
      "Eventos privados",
      "Comunidad exclusiva",
    ],
  },
};

const FREE_FEATURES = [
  "Cuota diaria: 2 lecturas de invitado · 3 con cuenta",
  "Teletipo y portada en tiempo real",
  "Todas las secciones de blacknews.media",
];

/** Ahorro real del plan anual frente a 12 cuotas mensuales. */
function savingsOf(monthly: string, yearly: string) {
  const full = Math.round(Number(monthly) * 12 * 100) / 100;
  const save = Math.round((full - Number(yearly)) * 100) / 100;
  if (!(full > 0) || save <= 0) return null;
  return { amount: save.toFixed(2), pct: Math.round((save / full) * 100) };
}

/** El SDK de PayPal se carga una sola vez por pestaña. */
let sdkPromise: Promise<void> | null = null;

function loadPayPalSdk(clientId: string): Promise<void> {
  const w = window as unknown as { paypal?: { Buttons?: unknown } };
  if (w.paypal?.Buttons) return Promise.resolve();
  if (!sdkPromise) {
    sdkPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(
        clientId,
      )}&vault=true&intent=subscription&currency=USD`;
      script.async = true;
      script.dataset.paypalSdk = "blacknews";
      script.onload = () => resolve();
      script.onerror = () => {
        sdkPromise = null;
        script.remove();
        reject(new Error("sdk_load_failed"));
      };
      document.body.appendChild(script);
    });
  }
  return sdkPromise;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function planKey(tier: PlanTier, cycle: BillingCycle): string {
  return `${tier}_${cycle}`;
}

function humanError(code: string | undefined): string {
  switch (code) {
    case "payments_not_configured":
      return "Los pagos con PayPal aún no están configurados en este entorno.";
    case "plan_mismatch":
    case "custom_mismatch":
      return "La suscripción no coincide con el plan elegido. Inténtalo de nuevo.";
    case "subscription_already_used":
      return "Esa suscripción ya está vinculada a otra cuenta.";
    case "subscription_not_found":
    case "subscription_id_invalido":
      return "No encontramos la suscripción en PayPal. Vuelve a intentarlo.";
    case "paypal_error":
      return "PayPal no responde ahora mismo. Inténtalo en unos minutos.";
    case "sin_suscripcion":
      return "No hay ninguna suscripción activa que cancelar.";
    default:
      if (code?.startsWith("http_5")) {
        return "El servicio de pagos no está disponible ahora mismo. Inténtalo en unos minutos.";
      }
      return "No se pudo completar la operación.";
  }
}

const CHECK_TIER = "w-3.5 h-3.5 shrink-0 mt-0.5";

export const SubscriptionModal: React.FC<SubscriptionModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onOpenGoogleAuth,
  onSubscribeSuccess,
  onStatusChange,
}) => {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("yearly");
  const [selectedPlan, setSelectedPlan] = useState<PlanTier>("insight");

  const [config, setConfig] = useState<PayPalConfig | null>(null);
  const [configState, setConfigState] = useState<ConfigState>("loading");
  const [sdkState, setSdkState] = useState<SdkState>("idle");

  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  const [action, setAction] = useState<ActionState>("idle");
  const [actionError, setActionError] = useState<string | null>(null);

  const [cancelState, setCancelState] = useState<CancelState>("idle");
  const [cancelError, setCancelError] = useState<string | null>(null);

  const buttonsRef = useRef<HTMLDivElement | null>(null);
  const aliveRef = useRef(true);

  const hasAccount = Boolean(
    currentUser && currentUser.id !== GUEST_USER_ID && currentUser.email,
  );
  const email = hasAccount ? (currentUser as RedactorProfile).email : null;
  const isActive = Boolean(status?.active);
  const planId = config ? config.planIds[planKey(selectedPlan, billingCycle)] : undefined;
  const prices = config?.prices;

  // ---------------------------------------------------------------- apertura
  useEffect(() => {
    if (!isOpen) return;
    aliveRef.current = true;
    setAction("idle");
    setActionError(null);
    setCancelState("idle");
    setCancelError(null);
    setSdkState("idle");

    setConfigState("loading");
    fetchPayPalConfig()
      .then((cfg) => {
        if (!aliveRef.current) return;
        setConfig(cfg);
        setConfigState(cfg.enabled && cfg.clientId ? "ready" : "unavailable");
      })
      .catch(() => {
        if (!aliveRef.current) return;
        setConfig(null);
        setConfigState("error");
      });

    if (email) {
      setStatusLoading(true);
      fetchSubscriptionStatus(email)
        .then((s) => aliveRef.current && setStatus(s))
        .catch(() => aliveRef.current && setStatus(null))
        .finally(() => aliveRef.current && setStatusLoading(false));
    } else {
      setStatus(null);
      setStatusLoading(false);
    }

    return () => {
      aliveRef.current = false;
    };
  }, [isOpen, email]);

  // ---------------------------------------------------------------- SDK
  useEffect(() => {
    if (!isOpen || configState !== "ready" || !config?.clientId || !email || isActive) return;
    setSdkState((prev) => (prev === "ready" ? prev : "loading"));
    loadPayPalSdk(config.clientId)
      .then(() => aliveRef.current && setSdkState("ready"))
      .catch(() => aliveRef.current && setSdkState("error"));
  }, [isOpen, configState, config?.clientId, email, isActive]);

  // ------------------------------------------------------- activación del pago
  const finishActivation = useCallback(
    async (subscriptionId: string, plan: PlanTier, cycle: BillingCycle) => {
      setAction("activating");
      setActionError(null);
      for (let attempt = 0; attempt < 4; attempt++) {
        if (!aliveRef.current) return;
        try {
          const res = await activateSubscription({
            subscriptionId,
            email: email as string,
            plan,
            cycle,
          });
          if (!aliveRef.current) return;
          if (res.active) {
            setStatus(res);
            setAction("idle");
            onSubscribeSuccess?.(plan);
            onStatusChange?.(true);
            return;
          }
          if (res.status === "pending") {
            setAction("pending");
            await sleep(6000);
            continue;
          }
          setAction("error");
          setActionError(humanError(undefined));
          return;
        } catch (e) {
          if (!aliveRef.current) return;
          setAction("error");
          setActionError(humanError(e instanceof PayPalApiError ? e.code : undefined));
          return;
        }
      }
      if (!aliveRef.current) return;
      setAction("error");
      setActionError(
        "El primer cobro sigue en proceso. PayPal te avisará cuando se confirme; vuelve a intentarlo en unos minutos.",
      );
    },
    [email, onSubscribeSuccess, onStatusChange],
  );

  // Identidad estable: cambia el padre re-renderiza, pero los botones de
  // PayPal no deben destruirse mientras el popup está abierto.
  const activationRef = useRef(finishActivation);
  activationRef.current = finishActivation;

  // ------------------------------------------- render de los botones de PayPal
  useEffect(() => {
    if (
      !isOpen ||
      sdkState !== "ready" ||
      !buttonsRef.current ||
      !email ||
      !planId ||
      isActive ||
      action === "activating" ||
      action === "pending"
    ) {
      return;
    }

    const w = window as unknown as {
      paypal?: {
        Buttons?: (opts: Record<string, unknown>) => {
          render: (el: HTMLElement) => void;
          isEligible?: () => boolean;
          close?: () => void;
        };
      };
    };
    const paypal = w.paypal;
    if (!paypal?.Buttons) return;

    // Congela el plan elegido en el momento de pulsar: si el usuario cambia
    // el ciclo mientras PayPal está abierto, se activa lo que se pidió.
    const chosen = { plan: selectedPlan, cycle: billingCycle };
    const container = buttonsRef.current;
    container.innerHTML = "";

    const buttons = paypal.Buttons({
      style: {
        layout: "vertical",
        color: "black",
        shape: "rect",
        label: "subscribe",
        height: 44,
      },
      createSubscription: (_data: unknown, actions: any) =>
        actions.subscription.create({
          plan_id: planId,
          custom_id: `${email}|${chosen.plan}|${chosen.cycle}`,
        }),
      onApprove: (data: any) => {
        const subscriptionId = data?.subscriptionID || data?.subscriptionId;
        if (!subscriptionId) {
          setAction("error");
          setActionError(humanError(undefined));
          return;
        }
        void activationRef.current(subscriptionId, chosen.plan, chosen.cycle);
      },
      onError: () => {
        setAction((prev) => (prev === "idle" ? "error" : prev));
        setActionError((prev) => prev ?? humanError(undefined));
      },
      onCancel: () => {
        setAction("idle");
        setActionError(null);
      },
    });

    if (buttons.isEligible?.() === false) {
      setAction("error");
      setActionError("El pago con PayPal no está disponible en este navegador.");
      return;
    }

    buttons.render(container);
    return () => {
      try {
        buttons.close?.();
      } catch {
        /* el botón ya se cerró */
      }
      container.innerHTML = "";
    };
  }, [isOpen, sdkState, planId, email, isActive, action]);

  // --------------------------------------------------------------- cancelación
  const handleCancel = async () => {
    if (!email) return;
    setCancelState("cancelling");
    setCancelError(null);
    try {
      const res = await cancelSubscription(email);
      setStatus(res);
      setCancelState("idle");
      onStatusChange?.(false);
    } catch (e) {
      setCancelState("error");
      setCancelError(humanError(e instanceof PayPalApiError ? e.code : undefined));
    }
  };

  if (!isOpen) return null;

  const cycleLabel = billingCycle === "monthly" ? "Mensual" : "Anual";
  const planName = PLAN_NAMES[selectedPlan];
  const priceValue = prices ? prices[selectedPlan][billingCycle] : null;
  const selectedSavings =
    prices && billingCycle === "yearly"
      ? savingsOf(prices[selectedPlan].monthly, prices[selectedPlan].yearly)
      : null;

  // -------------------------------------------------------------- vistas
  const renderActive = () => (
    <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.02] p-5">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-white">
            Suscripción activa
          </h3>
          <p className="mt-1 text-[13px] leading-relaxed text-neutral-300">
            {PLAN_NAMES[(status?.plan as PlanTier) ?? "insight"] ??
              status?.plan ??
              "Suscripción"} ·{" "}
            {status?.cycle === "yearly" ? "anual" : "mensual"} ·{" "}
            <span className="text-neutral-500">
              {status?.nextBillingDate
                ? `próximo cobro ${new Date(status.nextBillingDate).toLocaleDateString("es-ES", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}`
                : "renovación automática"}
            </span>
          </p>
          <p className="mt-2 text-[12.5px] leading-relaxed text-neutral-400">
            Lecturas ilimitadas y acceso sin publicidad en todo BlackNews.
            Puedes cancelar cuando quieras desde esta misma ventana; la
            cancelación es inmediata y ya no se realizarán cobros.
          </p>

          {cancelState === "idle" ? (
            <button
              type="button"
              onClick={() => setCancelState("confirm")}
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-white/20 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-neutral-300 transition-colors hover:border-red-400/50 hover:text-red-300 cursor-pointer"
            >
              Cancelar suscripción
            </button>
          ) : (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleCancel}
                disabled={cancelState === "cancelling"}
                className="rounded-lg bg-red-500 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-white transition-colors hover:bg-red-400 disabled:opacity-50 cursor-pointer"
              >
                {cancelState === "cancelling" ? "Cancelando…" : "Sí, cancelar ahora"}
              </button>
              <button
                type="button"
                onClick={() => setCancelState("idle")}
                disabled={cancelState === "cancelling"}
                className="rounded-lg border border-white/15 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-neutral-400 transition-colors hover:text-white disabled:opacity-50 cursor-pointer"
              >
                Mantener
              </button>
            </div>
          )}
          {cancelError && (
            <p className="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-red-300">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              {cancelError}
            </p>
          )}
        </div>
      </div>
    </div>
  );

  const renderFeature = (text: string, accent: string) => (
    <li className="flex items-start gap-2">
      <Check className={`${CHECK_TIER} ${accent}`} />
      <span>{text}</span>
    </li>
  );

  const renderPaidCard = (tier: PlanTier) => {
    const selected = selectedPlan === tier;
    const content = PLAN_CONTENT[tier];
    const Icon = content.icon;
    const p = prices?.[tier];
    const savings = p ? savingsOf(p.monthly, p.yearly) : null;
    const fullYear = p
      ? (Math.round(Number(p.monthly) * 12 * 100) / 100).toFixed(2)
      : null;

    return (
      <div
        key={tier}
        role="radio"
        aria-checked={selected}
        tabIndex={0}
        onClick={() => setSelectedPlan(tier)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setSelectedPlan(tier);
          }
        }}
        className={`group flex cursor-pointer flex-col rounded-xl border p-5 transition-colors ${
          selected
            ? "border-white bg-white/[0.035] ring-1 ring-white/20"
            : "border-white/10 bg-black hover:border-white/25"
        }`}
      >
        {/* Cabecera: icono + nombre */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                selected
                  ? "border-amber-400/50 bg-amber-400/10"
                  : "border-white/10"
              }`}
            >
              <Icon
                className={`h-4 w-4 ${
                  selected ? "text-amber-400" : "text-neutral-300"
                }`}
              />
            </span>
            <span className="font-mono text-[11.5px] font-semibold uppercase leading-tight tracking-[0.14em] text-neutral-200">
              {PLAN_NAMES[tier]}
            </span>
          </div>
          {tier === "insight" && (
            <span className="shrink-0 rounded-full bg-white px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-black">
              Recomendado
            </span>
          )}
        </div>

        <p className="mt-3 text-[13px] font-light leading-relaxed text-neutral-400">
          {content.tagline}
        </p>

        {/* Precio + ahorro (sin badge: precio tachado + línea de ahorro) */}
        <div className="mt-4">
          {billingCycle === "yearly" ? (
            <>
              <div className="flex flex-wrap items-baseline gap-2">
                {fullYear && (
                  <s className="font-mono text-sm text-neutral-600 decoration-neutral-700">
                    ${fullYear}
                  </s>
                )}
                <span className="font-mono text-[32px] font-bold leading-none tracking-tight text-white">
                  {p ? `$${p.yearly}` : "—"}
                </span>
                <span className="text-xs text-neutral-500">USD/año</span>
              </div>
              <p className="mt-2 text-[13px] text-neutral-400">
                {p
                  ? `Equivale a $${(Number(p.yearly) / 12).toFixed(2)} por mes`
                  : "Cobro anual"}
              </p>
              {savings && (
                <p className="mt-1 text-[13.5px] font-semibold text-amber-400">
                  Ahorras ${savings.amount} al año ({savings.pct}%)
                </p>
              )}
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-mono text-[32px] font-bold leading-none tracking-tight text-white">
                  {p ? `$${p.monthly}` : "—"}
                </span>
                <span className="text-xs text-neutral-500">USD/mes</span>
              </div>
              <p className="mt-2 text-[13px] text-neutral-400">
                Se cobra cada mes · cancela cuando quieras
              </p>
              {savings && (
                <p className="mt-1 text-[13.5px] text-neutral-400">
                  Al año: ${p.yearly} ·{" "}
                  <span className="font-semibold text-amber-400">
                    ahorras ${savings.amount} ({savings.pct}%)
                  </span>
                </p>
              )}
            </>
          )}
        </div>

        <div className="mt-4 border-t border-white/5 pt-3.5 font-mono text-[10.5px] uppercase tracking-[0.16em] text-neutral-500">
          {content.cumulative ? "Todo lo anterior +" : "Incluye"}
        </div>
        <ul className="mt-3 space-y-2 text-[13.5px] font-light leading-relaxed text-neutral-300">
          {content.features.map((f) => renderFeature(f, "text-amber-400/80"))}
        </ul>

        <div
          className={`mt-auto pt-4 text-[11px] font-bold uppercase tracking-wider ${
            selected
              ? "text-white"
              : "text-neutral-500 group-hover:text-neutral-300"
          }`}
        >
          {selected ? "Seleccionado ✓" : "Seleccionar →"}
        </div>
      </div>
    );
  };

  const renderCheckout = () => {
    if (statusLoading) {
      return (
        <div className="flex h-11 w-56 animate-pulse rounded-lg bg-white/10" />
      );
    }

    if (!hasAccount) {
      return (
        <button
          type="button"
          onClick={() => {
            onClose();
            onOpenGoogleAuth?.();
          }}
          className="w-full rounded-lg bg-white px-5 py-3 text-xs font-bold uppercase tracking-wider text-black transition-colors hover:bg-neutral-200 sm:w-auto cursor-pointer"
        >
          Iniciar sesión con Google
        </button>
      );
    }

    if (configState === "loading") {
      return (
        <div className="flex items-center gap-2 text-[11px] text-neutral-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Preparando pago seguro…
        </div>
      );
    }

    if (configState === "unavailable") {
      return (
        <div className="text-[11px] leading-relaxed text-neutral-400 sm:text-right">
          <span className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-neutral-500">
            <Lock className="w-3.5 h-3.5" /> Pagos en preparación
          </span>
          <p className="mt-2 max-w-[16rem] text-neutral-500">
            PayPal aún no está conectado en este entorno. El plan gratuito
            sigue disponible.
          </p>
        </div>
      );
    }

    if (configState === "error") {
      return (
        <div className="text-[11px] leading-relaxed text-neutral-400 sm:text-right">
          <p className="text-amber-300/90">
            No se pudo conectar con el servicio de pagos.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-1 font-bold uppercase tracking-wider text-neutral-300 underline underline-offset-4 hover:text-white cursor-pointer"
          >
            Reintentar
          </button>
        </div>
      );
    }

    if (sdkState === "error") {
      return (
        <div className="text-[11px] leading-relaxed text-neutral-400 sm:text-right">
          <p className="text-amber-300/90">
            No se pudo cargar el botón de PayPal.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-1 font-bold uppercase tracking-wider text-neutral-300 underline underline-offset-4 hover:text-white cursor-pointer"
          >
            Reintentar
          </button>
        </div>
      );
    }

    if (sdkState === "loading" || sdkState === "idle") {
      return (
        <div className="flex items-center gap-2 text-[11px] text-neutral-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Cargando botones de PayPal…
        </div>
      );
    }

    if (!planId) {
      return (
        <p className="max-w-[16rem] text-[11px] leading-relaxed text-amber-300/90 sm:text-right">
          Este plan no está disponible ahora mismo. Inténtalo más tarde.
        </p>
      );
    }

    if (action === "activating" || action === "pending") {
      return (
        <div className="flex items-center gap-2 text-[11px] text-neutral-300">
          <Loader2 className="w-4 h-4 animate-spin" />
          {action === "activating"
            ? "Confirmando el pago con PayPal…"
            : "PayPal está procesando el primer cobro…"}
        </div>
      );
    }

    return (
      <div className="w-full sm:w-auto">
        <div ref={buttonsRef} className="min-w-[260px] max-w-full" />
        {action === "error" && actionError && (
          <p className="mt-2 flex items-start gap-2 text-[11px] leading-relaxed text-red-300">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            {actionError}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 backdrop-blur-sm font-['Lexend',sans-serif] sm:p-6">
      <div className="relative max-h-[92dvh] w-full max-w-6xl overflow-y-auto overscroll-contain rounded-2xl border border-white/10 bg-black text-[#EDEDED] shadow-2xl">
        <div className="p-5 sm:p-8">
          {/* Cabecera */}
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-400">
                <Sparkles className="w-3 h-3" />
                Membresía periodística independiente
              </div>
              <h2 className="font-headline mt-3 text-xl font-extrabold tracking-tight text-white sm:text-3xl">
                Información sin sesgos, sin pausas.
              </h2>
              <p className="mt-2 max-w-xl text-xs font-light leading-relaxed text-neutral-400 sm:text-sm">
                Cobertura geopolítica en tiempo real, mapas interactivos y
                despachos de nuestras corresponsalías.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="shrink-0 rounded-full p-2 text-neutral-400 transition-colors hover:bg-white/10 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {isActive ? (
            renderActive()
          ) : (
            <>
              {/* Selector de ciclo */}
              <div className="mt-6 flex flex-col items-center">
                <div
                  role="radiogroup"
                  aria-label="Ciclo de facturación"
                  className="inline-flex rounded-full border border-white/10 bg-white/[0.03] p-1"
                >
                  {([["monthly", "Mensual"], ["yearly", "Anual"]] as const).map(
                    ([cycle, label]) => (
                      <button
                        key={cycle}
                        type="button"
                        role="radio"
                        aria-checked={billingCycle === cycle}
                        onClick={() => setBillingCycle(cycle)}
                        className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-[12px] font-bold uppercase tracking-wider transition-colors sm:px-6 cursor-pointer ${
                          billingCycle === cycle
                            ? "bg-white text-black"
                            : "text-neutral-400 hover:text-white"
                        }`}
                      >
                        {label}
                        {cycle === "yearly" && (
                          <span
                            className={`font-mono text-[10.5px] font-bold ${
                              billingCycle === "yearly"
                                ? "text-amber-500"
                                : "text-amber-400"
                            }`}
                          >
                            −20%
                          </span>
                        )}
                      </button>
                    ),
                  )}
                </div>
                {billingCycle === "yearly" && (
                  <p className="mt-2.5 font-mono text-[11px] uppercase tracking-wider text-neutral-500">
                    Se cobra una vez al año · descuento ya aplicado
                  </p>
                )}
              </div>

              {/* Planes: gratuito + Access + Insight + Intelligence */}
              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {/* Gratuito */}
                <div className="flex flex-col rounded-xl border border-white/10 bg-black p-5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10">
                      <BookOpen className="h-4 w-4 text-neutral-400" />
                    </span>
                    <span className="font-mono text-[11.5px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
                      Sin suscripción
                    </span>
                  </div>
                  <div className="mt-3 text-[15px] font-bold text-white">
                    Plan gratuito
                  </div>
                  <p className="mt-1 text-[13px] font-light leading-relaxed text-neutral-500">
                    Para leer BlackNews sin compromiso.
                  </p>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="font-mono text-[32px] font-bold leading-none tracking-tight text-neutral-500">
                      $0
                    </span>
                    <span className="text-xs text-neutral-600">/ siempre</span>
                  </div>
                  <ul className="mt-4 space-y-2 text-[13.5px] font-light leading-relaxed text-neutral-400">
                    {FREE_FEATURES.map((f) =>
                      renderFeature(f, "text-neutral-600"),
                    )}
                  </ul>
                  <button
                    type="button"
                    onClick={onClose}
                    className="mt-auto w-full rounded-lg border border-white/10 py-3 text-[11.5px] font-bold uppercase tracking-wider text-neutral-400 transition-colors hover:bg-white/5 cursor-pointer"
                  >
                    {hasAccount ? "Continuar con lo gratuito" : "Plan actual"}
                  </button>
                </div>

                {(["access", "insight", "intelligence"] as const).map((tier) =>
                  renderPaidCard(tier),
                )}
              </div>

              {/* Barra de pago */}
              <div className="mt-4 flex flex-col gap-4 rounded-xl border border-white/10 bg-white/[0.02] p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-headline text-[15px] font-bold text-white">
                    {planName} · {cycleLabel}
                  </p>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-neutral-400">
                    {priceValue ? (
                      <>
                        Cobro recurrente de{" "}
                        <span className="font-mono text-white">
                          ${priceValue} USD
                        </span>{" "}
                        cada {billingCycle === "monthly" ? "mes" : "12 meses"}
                        {billingCycle === "yearly" && selectedSavings
                          ? ` · ahorras $${selectedSavings.amount} (${selectedSavings.pct}%) frente a la cuota mensual`
                          : ""}{" "}
                        hasta que canceles. Pagos procesados por PayPal.
                      </>
                    ) : (
                      "Suscripción gestionada íntegramente por PayPal."
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 justify-start sm:justify-end">
                  {renderCheckout()}
                </div>
              </div>
            </>
          )}

          {/* Pie */}
          <div className="mt-5 flex flex-col gap-2 border-t border-white/10 pt-4 text-[11px] font-light text-neutral-500 sm:flex-row sm:items-center sm:justify-between">
            <span className="flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              Pago seguro con PayPal · cancelación inmediata en 1 clic
            </span>
            <span>Periodismo libre de intereses corporativos.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
