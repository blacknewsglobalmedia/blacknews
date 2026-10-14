import React, { useRef, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  CircleAlert,
  Eye,
  FileImage,
  Link2,
  Loader2,
  Megaphone,
  ShieldCheck,
  Upload,
} from "lucide-react";
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
 * Carga de publicidad (flujo del anunciante) como PÁGINA del panel:
 * ubicación → creatividad con vista previa real → plan con alcance
 * estimado → datos y pago. Sustituye al antiguo CreateAdModal.
 *
 * Diseño: tipografía legible (mín. 13 px, títulos 18-24 px), etiquetas
 * visibles sobre cada campo y un stepper guía de 4 pasos con acceso
 * directo por ancla.
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

const PAYMENT_OPTIONS: Array<{
  id: AdPaymentMethod;
  name: string;
  note: string;
}> = [
  {
    id: "PAYPAL",
    name: "PayPal",
    note: "Te lleva a PayPal y vuelves con el pago confirmado.",
  },
  {
    id: "BANK_TRANSFER",
    name: "Transferencia",
    note: "Registramos la solicitud y validamos el comprobante.",
  },
  {
    id: "MERCADO_PAGO",
    name: "Mercado Pago",
    note: "Registramos la solicitud y validamos el comprobante.",
  },
];

const STEPS: Array<{ id: string; label: string }> = [
  { id: "ubicacion", label: "Ubicación" },
  { id: "creatividad", label: "Creatividad" },
  { id: "plan", label: "Plan" },
  { id: "envio", label: "Envío" },
];

/** Relación de aspecto nominal de la creatividad («970 / 250» → 3.88). */
const nominalRatioOf = (ratio: string): number => {
  const [w, h] = ratio.split("/").map((part) => parseFloat(part.trim()));
  return w && h ? w / h : 1;
};

/** Encabezado de cada sección: número, icono y título grande. */
const SectionHeading: React.FC<{
  step: number;
  title: string;
  description: string;
}> = ({ step, title, description }) => (
  <div className="mb-5 flex items-start gap-3">
    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 font-mono text-sm font-bold text-emerald-400">
      {step}
    </span>
    <div>
      <h2 className="text-lg font-semibold text-white sm:text-xl">{title}</h2>
      <p className="mt-0.5 text-sm leading-relaxed text-neutral-400">
        {description}
      </p>
    </div>
  </div>
);

/** Etiqueta de campo con texto visible (no solo placeholder). */
const FieldLabel: React.FC<{
  htmlFor: string;
  label: string;
  hint?: string;
}> = ({ htmlFor, label, hint }) => (
  <label htmlFor={htmlFor} className="block">
    <span className="text-[13px] font-semibold text-neutral-200">{label}</span>
    {hint && (
      <span className="mt-0.5 block text-xs font-light text-neutral-500">
        {hint}
      </span>
    )}
  </label>
);

export const AdSubmissionPage: React.FC<AdSubmissionPageProps> = ({
  currentUser,
  onSubmitAdCampaign,
  onClose,
  initialPlacement,
}) => {
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
  const planViews = estimateCampaignViews(placementInfo, plan);
  const nominalRatio = nominalRatioOf(placementInfo.ratio);
  const assetRatio = assetDims ? assetDims.w / assetDims.h : null;
  const ratioDelta =
    assetRatio !== null ? Math.abs(assetRatio - nominalRatio) / nominalRatio : null;

  const missing = {
    imageUrl: !imageUrl.trim(),
    title: !title.trim(),
    advertiser: !advertiser.trim(),
    advertiserUrl: !advertiserUrl.trim(),
  };
  const isValid = !Object.values(missing).some(Boolean);

  /** Paso completado (para el stepper guía). */
  const stepDone = [true, !missing.imageUrl, true, isValid];

  const goToStep = (id: string) => {
    document
      .getElementById(`paso-${id}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
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
    if (!isValid) {
      // Lleva al primer paso pendiente.
      goToStep(missing.imageUrl ? "creatividad" : "envio");
      return;
    }
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
            Solicitud registrada
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
    <form onSubmit={handleSubmit} className="mx-auto max-w-4xl">
      {/* Cabecera */}
      <div className="mb-6">
        <button
          type="button"
          onClick={onClose}
          className="mb-3 flex items-center gap-1.5 text-[13px] font-semibold text-neutral-400 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Volver a mi publicidad
        </button>
        <h1 className="text-2xl font-semibold text-white sm:text-3xl">
          Cargar una publicidad
        </h1>
        <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-neutral-300">
          Son 4 pasos: eliges dónde se ve, subes tu arte, eliges el plan y
          envías. Todo con vista previa real antes de pagar.
        </p>
      </div>

      {/* Stepper guía */}
      <nav
        aria-label="Pasos"
        className="mb-10 flex flex-wrap items-center gap-2"
      >
        {STEPS.map((step, i) => (
          <React.Fragment key={step.id}>
            {i > 0 && (
              <span className="h-px w-4 bg-white/15 sm:w-6" aria-hidden />
            )}
            <button
              type="button"
              onClick={() => goToStep(step.id)}
              className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 py-1.5 pl-2 pr-3.5 text-[13px] font-semibold text-neutral-200 transition-colors hover:border-white/30 hover:text-white"
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full font-mono text-[11px] font-bold ${
                  stepDone[i]
                    ? "bg-emerald-500 text-black"
                    : "bg-neutral-800 text-neutral-300"
                }`}
              >
                {stepDone[i] ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              {step.label}
            </button>
          </React.Fragment>
        ))}
      </nav>

      {/* 1 · Ubicación */}
      <section id="paso-ubicacion" className="mb-12 scroll-mt-24">
        <SectionHeading
          step={1}
          title="¿Dónde se ve tu anuncio?"
          description="Elige la ubicación. Cada una tiene su tamaño y su proporción; la vista previa del paso 2 usa el mismo espacio real del sitio."
        />
        <div className="grid gap-4 sm:grid-cols-2">
          {PLACEMENT_ORDER.map((id) => {
            const info = AD_PLACEMENTS_INFO[id];
            const selected = id === placement;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setPlacement(id)}
                aria-pressed={selected}
                className={`rounded-2xl border p-5 text-left transition-colors ${
                  selected
                    ? "border-emerald-500/70 bg-emerald-500/5"
                    : "border-white/10 bg-neutral-950/60 hover:border-white/30"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[15px] font-semibold text-white">
                        {info.name}
                      </span>
                      {id === DEFAULT_PLACEMENT && (
                        <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                          Recomendado
                        </span>
                      )}
                      {selected && (
                        <Check className="h-4 w-4 shrink-0 text-emerald-400" />
                      )}
                    </div>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-neutral-400">
                      {info.description}
                    </p>
                  </div>
                  {/* Miniatura a la proporción de la creatividad */}
                  <div
                    className="shrink-0 rounded-lg border border-white/15 bg-black"
                    style={{
                      width: 84,
                      aspectRatio: info.ratio,
                      maxHeight: 64,
                    }}
                    aria-hidden
                  />
                </div>
                <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
                  {info.exportSizes.map((size) => (
                    <span
                      key={size}
                      className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[11px] text-neutral-200"
                    >
                      {size}
                    </span>
                  ))}
                </div>
                <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-neutral-400">
                  <span>
                    Proporción{" "}
                    <span className="font-mono text-neutral-200">
                      {info.ratio.replace("/", ":")}
                    </span>
                  </span>
                  <span>
                    <span className="font-mono text-neutral-200">
                      ≈ {formatAdViews(info.estimatedDailyViews)}
                    </span>{" "}
                    vistas al día
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* 2 · Creatividad + vista previa */}
      <section id="paso-creatividad" className="mb-12 scroll-mt-24">
        <SectionHeading
          step={2}
          title="Sube tu creatividad"
          description="Arrastra tu imagen o pega una URL. A la derecha ves exactamente cómo se verá en el sitio."
        />

        {/* Formato recomendado de la ubicación elegida */}
        <div className="mb-5 flex flex-wrap items-center gap-x-5 gap-y-1.5 rounded-xl border border-white/10 bg-neutral-950/60 px-4 py-3 text-[13px] text-neutral-300">
          <span className="font-semibold text-white">
            {placementInfo.name}:
          </span>
          <span>
            exporta en{" "}
            <span className="font-mono text-white">
              {placementInfo.exportSizes[0]}
            </span>
          </span>
          <span>
            proporción{" "}
            <span className="font-mono text-white">
              {placementInfo.ratio.replace("/", ":")}
            </span>
          </span>
          <span className="text-neutral-500">JPG, PNG o WEBP · 20 MB máx.</span>
        </div>

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
              className={`rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${
                showErrors && missing.imageUrl
                  ? "border-red-500/50 bg-red-500/5"
                  : "border-white/15 bg-neutral-950/60 hover:border-white/35"
              }`}
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
              <FileImage className="mx-auto mb-3 h-8 w-8 text-neutral-600" />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-bold text-black transition-colors hover:bg-neutral-200 disabled:opacity-60"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Subiendo…
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" /> Elegir imagen
                  </>
                )}
              </button>
              <p className="mt-3 text-sm text-neutral-400">
                o arrastra el archivo hasta aquí
              </p>
            </div>

            <div>
              <FieldLabel
                htmlFor="ad-image-url"
                label="…o usa una imagen ya publicada"
                hint="Pega el enlace directo de una imagen (URL que empieza por https://)."
              />
              <div className="mt-2 flex items-center gap-2">
                <div className="flex h-11 flex-1 items-center rounded-lg border border-white/10 bg-neutral-950/60 px-3 focus-within:border-white/40">
                  <Link2 className="h-4 w-4 shrink-0 text-neutral-500" />
                  <input
                    id="ad-image-url"
                    type="url"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    onBlur={() => applyUrl(urlInput)}
                    placeholder="https://…"
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
            </div>

            {uploadError && (
              <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm leading-relaxed text-red-300">
                {uploadError}
              </p>
            )}

            {assetDims && (
              <div className="rounded-xl border border-white/10 bg-neutral-950/60 px-4 py-3 text-sm leading-relaxed text-neutral-300">
                <span className="font-semibold text-white">Tu imagen: </span>
                <span className="font-mono text-neutral-100">
                  {assetDims.w} × {assetDims.h} px
                </span>
                {ratioDelta !== null && (
                  <>
                    {" · "}
                    {ratioDelta <= 0.05 ? (
                      <span className="text-emerald-400">
                        ✓ coincide con esta ubicación
                      </span>
                    ) : (
                      <span className="text-amber-300">
                        ≠ no coincide: se mostrará{" "}
                        {placementInfo.fit === "cover"
                          ? "recortada al centro"
                          : "contenida, sin recorte"}
                      </span>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Vista previa con el contenedor REAL del slot */}
          <div>
            <p className="mb-2 text-[13px] font-semibold uppercase tracking-wider text-neutral-400">
              Así se verá en el sitio
            </p>
            <div
              className={`group relative w-full overflow-hidden rounded-xl border border-white/10 bg-black ${
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
                  <FileImage className="h-6 w-6 text-neutral-700" />
                  <span className="text-sm text-neutral-500">
                    Tu creatividad aparecerá aquí
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
            <p className="mt-2.5 text-[13px] leading-relaxed text-neutral-500">
              Tu imagen se muestra {placementInfo.fit === "cover" ? "a sangre (se recorta al borde)" : "entera, sin recortes"}; arriba se superponen el rótulo
              PUBLICIDAD y tu marca.
            </p>
          </div>
        </div>
      </section>

      {/* 3 · Plan y alcance */}
      <section id="paso-plan" className="mb-12 scroll-mt-24">
        <SectionHeading
          step={3}
          title="Elige el plan"
          description="Precio a la vista y alcance estimado para la ubicación elegida. Los planes de impresiones incluyen garantía medida en la plataforma."
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[15px] font-semibold text-white">
                    {p.name}
                  </span>
                  <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-neutral-200">
                    {p.badge}
                  </span>
                </div>
                <p className="mt-1.5 text-[13px] leading-relaxed text-neutral-400">
                  {p.description}
                </p>
                <div className="mt-3 font-mono text-2xl font-semibold text-white">
                  ${p.priceUsd}
                  <span className="ml-1 text-sm font-normal text-neutral-400">
                    USD
                  </span>
                </div>
                <div className="font-mono text-[13px] text-neutral-400">
                  ≈ ${p.priceUyu} UYU
                </div>
                <div className="mt-3 space-y-1.5 text-[13px] text-neutral-300">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-neutral-500" />
                    {p.durationDays
                      ? `${p.durationDays} días publicado`
                      : "hasta agotar presupuesto"}
                  </div>
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4 text-neutral-500" />
                    <span className="font-mono text-white">
                      ≈ {formatAdViews(views)}
                    </span>{" "}
                    vistas estimadas
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* 4 · Datos y envío */}
      <section id="paso-envio" className="mb-10 scroll-mt-24">
        <SectionHeading
          step={4}
          title="Tus datos y el envío"
          description="Revisa el resumen de la derecha. La creatividad se publica tras la revisión del equipo y la confirmación del pago."
        />
        <div className="grid gap-5 lg:grid-cols-5">
          {/* Campos */}
          <div className="space-y-4 lg:col-span-3">
            <div>
              <FieldLabel
                htmlFor="ad-title"
                label="Título del anuncio"
                hint="Se ve junto a tu marca sobre la imagen."
              />
              <input
                id="ad-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej.: Custodia de oro en Suiza"
                className={`mt-1.5 w-full rounded-lg border bg-neutral-950/60 px-3.5 py-3 text-sm text-white outline-none transition-colors placeholder:text-neutral-600 focus:border-white/40 ${
                  showErrors && missing.title
                    ? "border-red-500/60"
                    : "border-white/10"
                }`}
              />
              {showErrors && missing.title && (
                <p className="mt-1 text-xs text-red-300">
                  Escribe un título para tu anuncio.
                </p>
              )}
            </div>
            <div>
              <FieldLabel
                htmlFor="ad-advertiser"
                label="Marca o empresa"
                hint="El nombre que se mostrará como anunciante."
              />
              <input
                id="ad-advertiser"
                type="text"
                value={advertiser}
                onChange={(e) => setAdvertiser(e.target.value)}
                placeholder="Ej.: Helvetia Wealth"
                className={`mt-1.5 w-full rounded-lg border bg-neutral-950/60 px-3.5 py-3 text-sm text-white outline-none transition-colors placeholder:text-neutral-600 focus:border-white/40 ${
                  showErrors && missing.advertiser
                    ? "border-red-500/60"
                    : "border-white/10"
                }`}
              />
              {showErrors && missing.advertiser && (
                <p className="mt-1 text-xs text-red-300">
                  Indica la marca o empresa anunciante.
                </p>
              )}
            </div>
            <div>
              <FieldLabel
                htmlFor="ad-url"
                label="Enlace de destino"
                hint="A dónde llega el lector al hacer clic en tu anuncio."
              />
              <input
                id="ad-url"
                type="url"
                value={advertiserUrl}
                onChange={(e) => setAdvertiserUrl(e.target.value)}
                placeholder="https://tu-sitio.com"
                className={`mt-1.5 w-full rounded-lg border bg-neutral-950/60 px-3.5 py-3 text-sm text-white outline-none transition-colors placeholder:text-neutral-600 focus:border-white/40 ${
                  showErrors && missing.advertiserUrl
                    ? "border-red-500/60"
                    : "border-white/10"
                }`}
              />
              {showErrors && missing.advertiserUrl && (
                <p className="mt-1 text-xs text-red-300">
                  Añade el enlace de destino (https://…).
                </p>
              )}
            </div>
            <div>
              <FieldLabel
                htmlFor="ad-badge"
                label="Rótulo del anuncio"
                hint="Texto que identifica el anuncio (opcional)."
              />
              <input
                id="ad-badge"
                type="text"
                value={badgeText}
                onChange={(e) => setBadgeText(e.target.value)}
                placeholder="PATROCINADO"
                className="mt-1.5 w-full rounded-lg border border-white/10 bg-neutral-950/60 px-3.5 py-3 text-sm text-white outline-none transition-colors placeholder:text-neutral-600 focus:border-white/40"
              />
            </div>

            {/* Pago */}
            <div>
              <span className="text-[13px] font-semibold text-neutral-200">
                Forma de pago
              </span>
              <div className="mt-1.5 grid gap-2.5 sm:grid-cols-3">
                {PAYMENT_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setPaymentMethod(option.id)}
                    aria-pressed={paymentMethod === option.id}
                    className={`rounded-xl border px-4 py-3.5 text-left transition-colors ${
                      paymentMethod === option.id
                        ? "border-emerald-500/70 bg-emerald-500/5 text-white"
                        : "border-white/10 bg-neutral-950/60 text-neutral-300 hover:border-white/30"
                    }`}
                  >
                    <span className="block text-sm font-semibold">
                      {option.name}
                    </span>
                    <span className="mt-1 block text-xs leading-snug text-neutral-400">
                      {option.note}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            {paymentMethod !== "PAYPAL" && (
              <div>
                <FieldLabel
                  htmlFor="ad-receipt"
                  label="Comprobante (opcional)"
                  hint="Nº de operación o referencia si ya transfiriste."
                />
                <input
                  id="ad-receipt"
                  type="text"
                  value={receiptNote}
                  onChange={(e) => setReceiptNote(e.target.value)}
                  placeholder="Ej.: op. 123456"
                  className="mt-1.5 w-full rounded-lg border border-white/10 bg-neutral-950/60 px-3.5 py-3 text-sm text-white outline-none transition-colors placeholder:text-neutral-600 focus:border-white/40"
                />
              </div>
            )}

            {showErrors && !isValid && (
              <p className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm leading-relaxed text-red-300">
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                Faltan datos: completa los campos marcados y añade una
                creatividad en el paso 2.
              </p>
            )}
          </div>

          {/* Resumen */}
          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-white/10 bg-neutral-950/60 p-5">
              <p className="text-[13px] font-bold uppercase tracking-wider text-neutral-400">
                Resumen
              </p>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-neutral-400">Ubicación</dt>
                  <dd className="text-right font-medium text-white">
                    {placementInfo.name}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-neutral-400">Formato</dt>
                  <dd className="text-right font-mono text-[13px] text-neutral-100">
                    {placementInfo.exportSizes[0]} ·{" "}
                    {placementInfo.ratio.replace("/", ":")}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-neutral-400">Plan</dt>
                  <dd className="text-right font-medium text-white">
                    {plan.name}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-neutral-400">Duración</dt>
                  <dd className="text-right text-neutral-100">
                    {plan.durationDays
                      ? `${plan.durationDays} días`
                      : "hasta agotar presupuesto"}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-neutral-400">Vistas estimadas</dt>
                  <dd className="text-right font-mono text-neutral-100">
                    ≈ {formatAdViews(planViews)}
                  </dd>
                </div>
                <div className="border-t border-white/10 pt-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-neutral-400">Precio</dt>
                    <dd className="text-right">
                      <span className="font-mono text-2xl font-semibold text-white">
                        ${plan.priceUsd}
                      </span>
                      <span className="ml-1 font-mono text-[13px] text-neutral-400">
                        USD
                      </span>
                      <span className="block font-mono text-[13px] text-neutral-500">
                        ≈ ${plan.priceUyu} UYU
                      </span>
                    </dd>
                  </div>
                </div>
              </dl>

              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-4 text-sm font-bold uppercase tracking-wider text-black transition-colors hover:bg-emerald-400 disabled:opacity-60"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Procesando…
                  </>
                ) : paymentMethod === "PAYPAL" ? (
                  <>Continuar a PayPal</>
                ) : (
                  <>Enviar solicitud</>
                )}
              </button>
              <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-neutral-500">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                Se publica tras revisión del equipo y confirmación del pago.
                Puedes retirarla cuando quieras.
              </p>
            </div>
          </div>
        </div>
      </section>
    </form>
  );
};
