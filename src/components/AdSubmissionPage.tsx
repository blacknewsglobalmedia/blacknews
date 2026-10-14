import React, { useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CircleAlert,
  CreditCard,
  Eye,
  FileImage,
  Landmark,
  LayoutGrid,
  Link2,
  Loader2,
  MapPin,
  Monitor,
  MoveHorizontal,
  PanelBottom,
  PanelRight,
  Send,
  ShieldCheck,
  Timer,
  Upload,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  AdCampaign,
  AD_PLACEMENTS_INFO,
  AD_PRICING_PLANS,
  AdPaymentMethod,
  AdPlacement,
  AdPricingPlan,
  estimateCampaignViews,
  formatAdViews,
} from "../types/ads";
import { RedactorProfile } from "../types/auth";
import { createAdOrder } from "../utils/paypalAds";

/**
 * Carga de publicidad como ASISTENTE de 4 pantallas dentro del panel:
 * una decisión por pantalla (dónde → imagen → plan → envío), iconos
 * grandes, navegación Atrás/Siguiente y vista previa real del slot.
 * Sustituye al antiguo CreateAdModal.
 */
interface AdSubmissionPageProps {
  currentUser?: RedactorProfile;
  onSubmitAdCampaign?: (campaign: AdCampaign) => void;
  /** Vuelve a la lista «Mi publicidad». */
  onClose: () => void;
  /** Ubicación preseleccionada («Anúnciate aquí» de un slot concreto). */
  initialPlacement?: AdPlacement;
}

const PLACEMENT_ORDER: AdPlacement[] = [
  "TOP_BILLBOARD",
  "IN_FEED_LEADERBOARD",
  "ARTICLE_SIDEBAR",
  "ARTICLE_FOOTER",
  "GRID_CARD",
];

/** Ubicación por defecto: la de más rotación en portada. */
const DEFAULT_PLACEMENT: AdPlacement = "IN_FEED_LEADERBOARD";

/** Icono por ubicación: dibuja dónde va el anuncio sin necesidad de leer. */
const PLACEMENT_ICONS: Record<AdPlacement, LucideIcon> = {
  TOP_BILLBOARD: Monitor,
  IN_FEED_LEADERBOARD: MoveHorizontal,
  ARTICLE_SIDEBAR: PanelRight,
  ARTICLE_FOOTER: PanelBottom,
  GRID_CARD: LayoutGrid,
};

const PAYMENT_OPTIONS: Array<{
  id: AdPaymentMethod;
  name: string;
  note: string;
  icon: LucideIcon;
}> = [
  {
    id: "PAYPAL",
    name: "PayPal",
    note: "Te lleva a PayPal y vuelves con el pago confirmado.",
    icon: Wallet,
  },
  {
    id: "BANK_TRANSFER",
    name: "Transferencia",
    note: "Registramos la solicitud y validamos el comprobante.",
    icon: Landmark,
  },
  {
    id: "MERCADO_PAGO",
    name: "Mercado Pago",
    note: "Registramos la solicitud y validamos el comprobante.",
    icon: CreditCard,
  },
];

const STEPS: Array<{ id: string; label: string; icon: LucideIcon }> = [
  { id: "ubicacion", label: "Dónde", icon: MapPin },
  { id: "creatividad", label: "Imagen", icon: FileImage },
  { id: "plan", label: "Plan", icon: Timer },
  { id: "envio", label: "Enviar", icon: Send },
];

const inputClass = (hasError: boolean) =>
  `mt-1.5 w-full rounded-lg border bg-neutral-950/60 px-3.5 py-3 text-sm text-white outline-none transition-colors placeholder:text-neutral-600 focus:border-white/40 ${
    hasError ? "border-red-500/60" : "border-white/10"
  }`;

/** Encabezado centrado de cada pantalla: icono grande + título + ayuda. */
const StepHeader: React.FC<{
  icon: LucideIcon;
  title: string;
  hint: string;
}> = ({ icon: Icon, title, hint }) => (
  <div className="mb-7 text-center">
    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10">
      <Icon className="h-7 w-7 text-emerald-400" />
    </div>
    <h2 className="text-xl font-semibold text-white sm:text-2xl">{title}</h2>
    <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-neutral-400">
      {hint}
    </p>
  </div>
);

export const AdSubmissionPage: React.FC<AdSubmissionPageProps> = ({
  currentUser,
  onSubmitAdCampaign,
  onClose,
  initialPlacement,
}) => {
  // ── Navegación del asistente ───────────────────────────────────────────
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // ── Estado del formulario ───────────────────────────────────────────────
  const [placement, setPlacement] = useState<AdPlacement>(
    initialPlacement || DEFAULT_PLACEMENT,
  );
  const [plan, setPlan] = useState<AdPricingPlan>(AD_PRICING_PLANS[0]);

  const [imageUrl, setImageUrl] = useState("");
  const [assetDims, setAssetDims] = useState<{ w: number; h: number } | null>(
    null,
  );
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [advertiser, setAdvertiser] = useState("");
  const [advertiserUrl, setAdvertiserUrl] = useState("");
  const [badgeText, setBadgeText] = useState("PATROCINADO");

  const [paymentMethod, setPaymentMethod] = useState<AdPaymentMethod>("PAYPAL");
  const [receiptNote, setReceiptNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [paypalFailed, setPaypalFailed] = useState(false);
  const [submitted, setSubmitted] = useState<AdCampaign | null>(null);

  const placementInfo = AD_PLACEMENTS_INFO[placement];
  const PlacementIcon = PLACEMENT_ICONS[placement];
  const planViews = estimateCampaignViews(placementInfo, plan);

  const missing = {
    imageUrl: !imageUrl.trim(),
    title: !title.trim(),
    advertiser: !advertiser.trim(),
    advertiserUrl: !advertiserUrl.trim(),
  };
  const isValid = !Object.values(missing).some(Boolean);
  /** Pasos visitables desde el stepper (los completados o el actual). */
  const stepUnlocked = [true, !missing.imageUrl, true, isValid];

  const scrollTop = () => window.scrollTo({ top: 0, behavior: "auto" });
  const goToStep = (n: 1 | 2 | 3 | 4) => {
    setStep(n);
    scrollTop();
  };

  // ── Creatividad: subida al Worker (Cloudinary, original a máxima calidad)
  const ingestFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setUploadError("El archivo debe ser una imagen (JPG, PNG o WEBP).");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setUploadError("La imagen supera los 20 MB: exporta una versión menor.");
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append("image", file, file.name || "creatividad.jpg");
      formData.append("slug", `anuncio-${placement.toLowerCase()}`);
      const response = await fetch("/api/images/optimize", {
        method: "POST",
        body: formData,
      });
      const json = (await response.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
        data?: {
          originalUrl?: string;
          fallbackUrl?: string;
          width?: number;
          height?: number;
          variants?: Array<{ format?: string; width?: number; url?: string }>;
        };
      } | null;
      if (!json || !json.success) {
        throw new Error(json?.error || "No se pudo subir la imagen.");
      }
      const data = json.data || {};
      const avifMax = (data.variants || [])
        .filter((v) => v.format === "avif")
        .pop();
      const url = data.originalUrl || avifMax?.url || data.fallbackUrl || "";
      if (!url) throw new Error("El Worker no devolvió una URL usable.");
      setImageUrl(url);
      setAssetDims(
        data.width && data.height ? { w: data.width, h: data.height } : null,
      );
    } catch (error) {
      setUploadError(
        error instanceof Error ? error.message : "Error al subir la imagen.",
      );
    } finally {
      setUploading(false);
    }
  };

  /** Imagen pegada por URL: se leen sus dimensiones reales en el navegador. */
  const applyUrl = (value: string) => {
    const url = value.trim();
    if (!url) return;
    setImageUrl(url);
    setUploadError(null);
    const probe = new Image();
    probe.onload = () =>
      setAssetDims(
        probe.naturalWidth && probe.naturalHeight
          ? { w: probe.naturalWidth, h: probe.naturalHeight }
          : null,
      );
    probe.onerror = () => setAssetDims(null);
    probe.src = url;
  };

  // ── Envío (mismo flujo que el modal que sustituye) ─────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowErrors(true);
    if (missing.imageUrl) {
      // Sin creatividad no hay envío: vuelve a la pantalla de la imagen.
      goToStep(2);
      return;
    }
    if (!isValid) return;
    setIsSubmitting(true);

    const now = new Date();
    const startDate = now.toISOString().split("T")[0];
    const end = new Date();
    end.setDate(now.getDate() + (plan.durationDays || 30));
    const endDate = end.toISOString().split("T")[0];

    const newCampaign: AdCampaign = {
      id: `ad-user-${Date.now()}`,
      title: title.trim(),
      advertiser: advertiser.trim(),
      advertiserUrl: advertiserUrl.trim().startsWith("http")
        ? advertiserUrl.trim()
        : `https://${advertiserUrl.trim()}`,
      placement,
      imageUrl: imageUrl.trim(),
      badgeText: badgeText.trim() || "PATROCINADO",
      targetCategory: "TODAS",
      startDate,
      endDate,
      status: "PENDIENTE_PAGO",
      price: plan.priceUyu,
      currency: "UYU",
      pricingModel: plan.pricingModel,
      impressions: 0,
      clicks: 0,
      createdAt: startDate,
      applicantEmail: currentUser?.email || "anunciante@blacknews.com",
      applicantName: currentUser?.name || "Anunciante Registrado",
      paymentMethod,
      paymentReceiptUrl: receiptNote
        ? `Comprobante: ${receiptNote}`
        : undefined,
      targetImpressionsBudget: plan.targetImpressions,
      notes: `Solicitud desde el panel. Ubicación: ${placementInfo.name}. Plan: ${plan.name} ($${plan.priceUyu} UYU / $${plan.priceUsd} USD). Vistas estimadas: ${formatAdViews(planViews)}. Pago: ${paymentMethod}.`,
    };

    // 1) Se registra SIEMPRE (sobrevive aunque el pago no se complete).
    try {
      onSubmitAdCampaign?.(newCampaign);
    } catch {
      // La campaña local ya quedó registrada en el manejador.
    }

    // 2) PayPal: orden con el precio del Worker y redirección.
    if (paymentMethod === "PAYPAL") {
      try {
        const order = await createAdOrder({
          campaignId: newCampaign.id,
          planId: plan.id,
        });
        window.location.assign(order.approveUrl);
        return; // el botón queda procesando durante la redirección
      } catch {
        setPaypalFailed(true);
        setIsSubmitting(false);
        setSubmitted(newCampaign);
        return;
      }
    }

    // 3) Transferencia / Mercado Pago: queda registrada al instante.
    window.setTimeout(() => {
      setIsSubmitting(false);
      setSubmitted(newCampaign);
    }, 500);
  };

  // ── Vista de confirmación ──────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="rounded-2xl border border-white/10 bg-neutral-950/60 p-8 text-center sm:p-10">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/10">
            <Check className="h-8 w-8 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-semibold text-white sm:text-3xl">
            ¡Listo! Solicitud registrada
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-[15px] leading-relaxed text-neutral-300">
            «{submitted.title}» en <strong>{placementInfo.name}</strong>, plan{" "}
            <strong>{plan.name}</strong>. El equipo revisa la creatividad y
            confirmamos el pago antes de publicarla.
          </p>
          {paypalFailed && (
            <p className="mx-auto mt-5 max-w-lg rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm leading-relaxed text-amber-300">
              PayPal no respondió, pero tu solicitud quedó guardada. El pago se
              puede completar luego con el equipo.
            </p>
          )}
          <div className="mt-8">
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-lg bg-emerald-500 px-6 py-3.5 text-sm font-bold uppercase tracking-wider text-black transition-colors hover:bg-emerald-400 sm:w-auto"
            >
              Volver a mi publicidad
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-3xl">
      {/* Cabecera */}
      <div className="mb-6">
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1.5 text-[13px] font-semibold text-neutral-400 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Volver a mi publicidad
        </button>
        <h1 className="mt-3 text-2xl font-semibold text-white sm:text-3xl">
          Cargar una publicidad
        </h1>
      </div>

      {/* Stepper: 4 pasos con icono; los completados se pueden revisar */}
      <nav aria-label="Pasos" className="mb-8 flex items-center">
        {STEPS.map((s, i) => {
          const n = (i + 1) as 1 | 2 | 3 | 4;
          const isCurrent = n === step;
          const isDone = n < step && stepUnlocked[i];
          const reachable = isCurrent || stepUnlocked[i];
          return (
            <React.Fragment key={s.id}>
              {i > 0 && (
                <span
                  className={`h-0.5 flex-1 rounded ${isDone || isCurrent ? "bg-emerald-500/60" : "bg-white/10"}`}
                  aria-hidden
                />
              )}
              <button
                type="button"
                onClick={() => reachable && goToStep(n)}
                disabled={!reachable}
                aria-current={isCurrent ? "step" : undefined}
                className="flex w-16 shrink-0 flex-col items-center gap-1.5 disabled:cursor-not-allowed sm:w-20"
              >
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-full border transition-colors ${
                    isCurrent
                      ? "border-emerald-500 bg-emerald-500 text-black"
                      : isDone
                        ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                        : "border-white/15 bg-neutral-950 text-neutral-500"
                  }`}
                >
                  {isDone ? (
                    <Check className="h-4.5 w-4.5" />
                  ) : (
                    <s.icon className="h-4.5 w-4.5" />
                  )}
                </span>
                <span
                  className={`text-xs font-semibold ${
                    isCurrent
                      ? "text-white"
                      : isDone
                        ? "text-neutral-300"
                        : "text-neutral-500"
                  }`}
                >
                  {s.label}
                </span>
              </button>
            </React.Fragment>
          );
        })}
      </nav>

      {/* ── PASO 1 · DÓNDE ─────────────────────────────────────────────── */}
      {step === 1 && (
        <section>
          <StepHeader
            icon={MapPin}
            title="¿Dónde se ve tu anuncio?"
            hint="Toca la ubicación que prefieras. Las 5 opciones son espacios reales de BlackNews."
          />
          <div className="grid gap-3 sm:grid-cols-2">
            {PLACEMENT_ORDER.map((id) => {
              const info = AD_PLACEMENTS_INFO[id];
              const Icon = PLACEMENT_ICONS[id];
              const selected = id === placement;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPlacement(id)}
                  aria-pressed={selected}
                  className={`flex items-center gap-4 rounded-2xl border p-4 text-left transition-colors ${
                    selected
                      ? "border-emerald-500/70 bg-emerald-500/5"
                      : "border-white/10 bg-neutral-950/60 hover:border-white/30"
                  }`}
                >
                  <span
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border ${
                      selected
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                        : "border-white/10 bg-white/5 text-neutral-300"
                    }`}
                  >
                    <Icon className="h-6 w-6" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-[15px] font-semibold text-white">
                        {info.name}
                      </span>
                      {id === DEFAULT_PLACEMENT && (
                        <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                          Recomendado
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block text-[13px] leading-snug text-neutral-400">
                      {info.description}
                    </span>
                    <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[12px] text-neutral-300">
                      <span>{info.exportSizes[0]}</span>
                      <span className="text-neutral-500">·</span>
                      <span>≈ {formatAdViews(info.estimatedDailyViews)} vistas/día</span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          {/* Vista ilustrativa de la proporción elegida */}
          <div className="mt-6 flex items-center justify-center gap-4 rounded-2xl border border-white/10 bg-neutral-950/60 px-5 py-4">
            <div
              className="shrink-0 rounded-lg border border-white/20 bg-black"
              style={{ width: 96, aspectRatio: placementInfo.ratio, maxHeight: 64 }}
              aria-hidden
            />
            <p className="text-[13px] leading-relaxed text-neutral-400">
              <span className="font-semibold text-white">
                {placementInfo.name}
              </span>
              <br />
              Así de ancho es el espacio; tu imagen se muestra{" "}
              {placementInfo.fit === "cover" ? "a sangre" : "entera, sin recortes"}
              .
            </p>
          </div>
        </section>
      )}

      {/* ── PASO 2 · IMAGEN ────────────────────────────────────────────── */}
      {step === 2 && (
        <section>
          <StepHeader
            icon={FileImage}
            title="Sube tu creatividad"
            hint={`Ideal exportar en ${placementInfo.exportSizes[0]} (proporción ${placementInfo.ratio.replace("/", ":")}). JPG, PNG o WEBP.`}
          />
          <div className="grid gap-5 lg:grid-cols-2">
            {/* Controles */}
            <div className="space-y-4">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files?.[0];
                  if (file) void ingestFile(file);
                }}
                className="rounded-2xl border-2 border-dashed border-white/15 bg-neutral-950/60 p-8 text-center transition-colors hover:border-white/35"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void ingestFile(file);
                    e.target.value = "";
                  }}
                />
                <Upload className="mx-auto mb-3 h-9 w-9 text-neutral-500" />
                {uploading ? (
                  <p className="flex items-center justify-center gap-2 text-sm font-semibold text-neutral-300">
                    <Loader2 className="h-4 w-4 animate-spin" /> Subiendo…
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-bold text-black transition-colors hover:bg-neutral-200"
                  >
                    <Upload className="h-4 w-4" /> Elegir imagen
                  </button>
                )}
                <p className="mt-3 text-sm text-neutral-400">
                  o arrastra el archivo hasta aquí
                </p>
              </div>

              <div className="flex items-center gap-3 text-[13px] text-neutral-500">
                <span className="h-px flex-1 bg-white/10" aria-hidden />o pega
                una URL<span className="h-px flex-1 bg-white/10" aria-hidden />
              </div>

              <div className="flex items-center gap-2">
                <div className="flex h-11 flex-1 items-center rounded-lg border border-white/10 bg-neutral-950/60 px-3 focus-within:border-white/40">
                  <Link2 className="h-4 w-4 shrink-0 text-neutral-500" />
                  <input
                    type="url"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    onBlur={() => applyUrl(urlInput)}
                    placeholder="https://…"
                    aria-label="URL de la imagen"
                    className="h-full w-full bg-transparent pl-2 text-sm text-white outline-none placeholder:text-neutral-600"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => applyUrl(urlInput)}
                  className="h-11 shrink-0 rounded-lg border border-white/20 px-4 text-sm font-semibold text-neutral-200 transition-colors hover:text-white"
                >
                  Usar
                </button>
              </div>

              {uploadError && (
                <p className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm leading-relaxed text-red-300">
                  <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  {uploadError}
                </p>
              )}

              {assetDims && (
                <div className="rounded-xl border border-white/10 bg-neutral-950/60 px-4 py-3 text-sm leading-relaxed text-neutral-300">
                  <span className="font-semibold text-white">Tu imagen: </span>
                  <span className="font-mono text-neutral-100">
                    {assetDims.w} × {assetDims.h} px
                  </span>
                  {(() => {
                    const nominal = ((): number => {
                      const [w, h] = placementInfo.ratio
                        .split("/")
                        .map((part) => parseFloat(part.trim()));
                      return w && h ? w / h : 1;
                    })();
                    const delta =
                      Math.abs(assetDims.w / assetDims.h - nominal) / nominal;
                    return delta <= 0.05 ? (
                      <span className="text-emerald-400"> · ✓ proporción ideal</span>
                    ) : (
                      <span className="text-amber-300">
                        {" "}
                        · se mostrará{" "}
                        {placementInfo.fit === "cover"
                          ? "recortada al centro"
                          : "contenida, sin recorte"}
                      </span>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Vista previa con el contenedor REAL del slot */}
            <div>
              <p className="mb-2 text-[13px] font-semibold uppercase tracking-wider text-neutral-400">
                Así se verá en el sitio
              </p>
              <div
                className={`relative w-full overflow-hidden rounded-xl border border-white/10 bg-black ${
                  placementInfo.containerClass || ""
                }`}
                style={
                  placementInfo.aspect
                    ? { aspectRatio: placementInfo.aspect }
                    : undefined
                }
              >
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt="Vista previa de la creatividad"
                    className={`h-full w-full select-none ${
                      placementInfo.fit === "cover"
                        ? "object-cover"
                        : "object-contain"
                    }`}
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-6 text-center">
                    <FileImage className="h-8 w-8 text-neutral-700" />
                    <span className="text-sm text-neutral-500">
                      Tu imagen aparecerá aquí
                    </span>
                  </div>
                )}
                <span className="pointer-events-none absolute left-2 top-1.5 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-400">
                  Publicidad
                </span>
                <span className="pointer-events-none absolute bottom-1.5 left-2 max-w-[55%] truncate font-mono text-[10px] uppercase tracking-widest text-neutral-500">
                  {advertiser || "Tu marca"}
                </span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── PASO 3 · PLAN ──────────────────────────────────────────────── */}
      {step === 3 && (
        <section>
          <StepHeader
            icon={Timer}
            title="¿Cuánto tiempo se publica?"
            hint={`Las vistas son estimaciones para ${placementInfo.name}. Puedes elegir un plazo fijo o un paquete de impresiones.`}
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {AD_PRICING_PLANS.map((p) => {
              const selected = p.id === plan.id;
              const views = estimateCampaignViews(placementInfo, p);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPlan(p)}
                  aria-pressed={selected}
                  className={`flex flex-col rounded-2xl border p-5 text-left transition-colors ${
                    selected
                      ? "border-emerald-500/70 bg-emerald-500/5"
                      : "border-white/10 bg-neutral-950/60 hover:border-white/30"
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-[15px] font-semibold text-white">
                      {p.name}
                    </span>
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                        selected
                          ? "border-emerald-500 bg-emerald-500 text-black"
                          : "border-white/15 text-transparent"
                      }`}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </span>
                  </span>
                  <span className="mt-3 font-mono text-2xl font-semibold text-white">
                    ${p.priceUsd}
                    <span className="ml-1 text-sm font-normal text-neutral-400">
                      USD
                    </span>
                  </span>
                  <span className="mt-3 flex items-center gap-2 text-[13px] text-neutral-300">
                    <CalendarDays className="h-4 w-4 text-neutral-500" />
                    {p.durationDays
                      ? `${p.durationDays} días publicado`
                      : "hasta agotar presupuesto"}
                  </span>
                  <span className="mt-1.5 flex items-center gap-2 text-[13px] text-neutral-300">
                    <Eye className="h-4 w-4 text-neutral-500" />
                    <span className="font-mono text-white">
                      ≈ {formatAdViews(views)}
                    </span>
                    vistas
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-5 flex items-start gap-2 text-[13px] leading-relaxed text-neutral-500">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            Solo anuncios de tu empresa o marca propia. El equipo los revisa
            antes de publicar.
          </p>
        </section>
      )}

      {/* ── PASO 4 · ENVIAR ────────────────────────────────────────────── */}
      {step === 4 && (
        <section>
          <StepHeader
            icon={Send}
            title="Revisa y envía"
            hint="Solo faltan tus datos. La publicidad se revisa antes de aparecer en el sitio."
          />

          {/* Resumen compacto */}
          <div className="mb-6 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-white/10 bg-neutral-950/60 px-5 py-4 text-sm">
            <span className="flex items-center gap-2 text-neutral-200">
              <PlacementIcon className="h-4 w-4 text-emerald-400" />
              {placementInfo.name}
            </span>
            <span className="flex items-center gap-2 text-neutral-200">
              <Timer className="h-4 w-4 text-emerald-400" />
              {plan.name}
            </span>
            <span className="flex items-center gap-2 text-neutral-200">
              <Eye className="h-4 w-4 text-emerald-400" />≈{" "}
              {formatAdViews(planViews)} vistas
            </span>
            <span className="ml-auto font-mono text-lg font-semibold text-white">
              ${plan.priceUsd} USD
            </span>
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="ad-title" className="text-[13px] font-semibold text-neutral-200">
                Título del anuncio
              </label>
              <input
                id="ad-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej.: Custodia de oro en Suiza"
                className={inputClass(showErrors && missing.title)}
              />
              {showErrors && missing.title && (
                <p className="mt-1 text-xs text-red-300">
                  Escribe un título para tu anuncio.
                </p>
              )}
            </div>
            <div>
              <label htmlFor="ad-advertiser" className="text-[13px] font-semibold text-neutral-200">
                Marca o empresa
              </label>
              <input
                id="ad-advertiser"
                type="text"
                value={advertiser}
                onChange={(e) => setAdvertiser(e.target.value)}
                placeholder="Ej.: Helvetia Wealth"
                className={inputClass(showErrors && missing.advertiser)}
              />
              {showErrors && missing.advertiser && (
                <p className="mt-1 text-xs text-red-300">
                  Indica la marca o empresa anunciante.
                </p>
              )}
            </div>
            <div>
              <label htmlFor="ad-url" className="text-[13px] font-semibold text-neutral-200">
                ¿A dónde lleva el clic?
              </label>
              <input
                id="ad-url"
                type="url"
                value={advertiserUrl}
                onChange={(e) => setAdvertiserUrl(e.target.value)}
                placeholder="https://tu-sitio.com"
                className={inputClass(showErrors && missing.advertiserUrl)}
              />
              {showErrors && missing.advertiserUrl && (
                <p className="mt-1 text-xs text-red-300">
                  Añade el enlace de destino (https://…).
                </p>
              )}
            </div>
            <div>
              <p className="text-[13px] font-semibold text-neutral-200">
                Forma de pago
              </p>
              <div className="mt-1.5 grid gap-2.5 sm:grid-cols-3">
                {PAYMENT_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  const selected = paymentMethod === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setPaymentMethod(option.id)}
                      aria-pressed={selected}
                      className={`rounded-xl border px-4 py-3.5 text-left transition-colors ${
                        selected
                          ? "border-emerald-500/70 bg-emerald-500/5 text-white"
                          : "border-white/10 bg-neutral-950/60 text-neutral-300 hover:border-white/30"
                      }`}
                    >
                      <span className="flex items-center gap-2 text-sm font-semibold">
                        <Icon
                          className={`h-4 w-4 ${selected ? "text-emerald-400" : "text-neutral-500"}`}
                        />
                        {option.name}
                      </span>
                      <span className="mt-1 block text-xs leading-snug text-neutral-400">
                        {option.note}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            {paymentMethod !== "PAYPAL" && (
              <div>
                <label htmlFor="ad-receipt" className="text-[13px] font-semibold text-neutral-200">
                  Nº de comprobante (si ya transferiste)
                </label>
                <input
                  id="ad-receipt"
                  type="text"
                  value={receiptNote}
                  onChange={(e) => setReceiptNote(e.target.value)}
                  placeholder="Ej.: op. 123456"
                  className={inputClass(false)}
                />
              </div>
            )}

            {showErrors && !isValid && (
              <p className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm leading-relaxed text-red-300">
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                Faltan datos: completa los campos marcados.
              </p>
            )}
          </div>
        </section>
      )}

      {/* ── Barra de navegación inferior ─────────────────────────────────── */}
      <div className="sticky bottom-0 mt-8 -mx-4 flex items-center justify-between gap-3 border-t border-white/10 bg-black/90 px-4 py-4 backdrop-blur sm:mx-0 sm:px-0">
        <button
          type="button"
          onClick={() => (step === 1 ? onClose() : goToStep((step - 1) as 1 | 2 | 3 | 4))}
          className="flex items-center gap-2 rounded-lg border border-white/15 px-4 py-3 text-sm font-semibold text-neutral-300 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          {step === 1 ? "Salir" : "Atrás"}
        </button>

        {step < 4 ? (
          <>
            {step === 2 && missing.imageUrl && (
              <span className="hidden text-xs text-amber-300 sm:block">
                Sube o pega tu imagen para continuar
              </span>
            )}
            <button
              type="button"
              onClick={() => goToStep((step + 1) as 2 | 3 | 4)}
              disabled={step === 2 && missing.imageUrl}
              className="ml-auto flex items-center gap-2 rounded-lg bg-emerald-500 px-6 py-3 text-sm font-bold uppercase tracking-wider text-black transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Siguiente
              <ArrowRight className="h-4 w-4" />
            </button>
          </>
        ) : (
          <button
            type="submit"
            disabled={isSubmitting}
            className="ml-auto flex items-center gap-2 rounded-lg bg-emerald-500 px-6 py-3 text-sm font-bold uppercase tracking-wider text-black transition-colors hover:bg-emerald-400 disabled:opacity-60"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Procesando…
              </>
            ) : paymentMethod === "PAYPAL" ? (
              <>Continuar a PayPal · ${plan.priceUsd}</>
            ) : (
              <>Enviar solicitud · ${plan.priceUsd}</>
            )}
          </button>
        )}
      </div>
    </form>
  );
};
