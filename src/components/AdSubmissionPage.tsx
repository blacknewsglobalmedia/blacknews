import React, { useRef, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Eye,
  Link2,
  Loader2,
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

/** Relación de aspecto nominal de la creatividad («970 / 250» → 3.88). */
const nominalRatioOf = (ratio: string): number => {
  const [w, h] = ratio.split("/").map((part) => parseFloat(part.trim()));
  return w && h ? w / h : 1;
};

const SectionTitle: React.FC<{
  index: string;
  title: string;
  hint?: string;
}> = ({ index, title, hint }) => (
  <div className="mb-4">
    <h2 className="text-sm font-semibold uppercase tracking-wider text-white">
      <span className="mr-2 font-mono text-emerald-400">{index}</span>
      {title}
    </h2>
    {hint && <p className="mt-1 text-xs font-light text-neutral-500">{hint}</p>}
  </div>
);

export const AdSubmissionPage: React.FC<AdSubmissionPageProps> = ({
  currentUser,
  onSubmitAdCampaign,
  onClose,
  initialPlacement,
}) => {
  // ── Estado del formulario ───────────────────────────────────────────────
  const [placement, setPlacement] = useState<AdPlacement>(
    initialPlacement || "IN_FEED_LEADERBOARD",
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
        <div className="rounded-2xl border border-white/10 bg-neutral-950/60 p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/10">
            <Check className="h-6 w-6 text-emerald-400" />
          </div>
          <h1 className="text-lg font-semibold text-white">
            Solicitud registrada
          </h1>
          <p className="mx-auto mt-2 max-w-md text-xs font-light leading-relaxed text-neutral-400">
            «{submitted.title}» en {placementInfo.name}, plan {plan.name}. El
            equipo revisa la creatividad y confirmamos el pago antes de
            publicarla.
          </p>
          {paypalFailed && (
            <p className="mx-auto mt-4 max-w-md rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] leading-relaxed text-amber-300">
              PayPal no respondió, pero tu solicitud quedó guardada. El pago se
              puede completar luego con el equipo.
            </p>
          )}
          <div className="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row">
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-lg bg-emerald-500 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-black transition-colors hover:bg-emerald-400 sm:w-auto"
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
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={onClose}
            className="mb-2 flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-neutral-500 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-3 w-3" /> Mi publicidad
          </button>
          <h1 className="text-xl font-semibold text-white sm:text-2xl">
            Cargar una publicidad
          </h1>
          <p className="mt-1 text-xs font-light leading-relaxed text-neutral-400">
            Elige la ubicación, sube tu creatividad y revisa la vista previa
            real antes de pagar.
          </p>
        </div>
      </div>

      {/* 1 · Ubicación */}
      <section className="mb-10">
        <SectionTitle
          index="1"
          title="Ubicación"
          hint="Cada ubicación tiene su tamaño y su proporción. Verás la vista previa al estilo real del sitio."
        />
        <div className="grid gap-3 sm:grid-cols-2">
          {PLACEMENT_ORDER.map((id) => {
            const info = AD_PLACEMENTS_INFO[id];
            const selected = id === placement;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setPlacement(id)}
                className={`rounded-xl border p-4 text-left transition-colors ${
                  selected
                    ? "border-emerald-500/60 bg-emerald-500/5"
                    : "border-white/10 bg-neutral-950/60 hover:border-white/25"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-xs font-semibold uppercase tracking-wider text-white">
                        {info.name}
                      </span>
                      {selected && (
                        <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                      )}
                    </div>
                    <p className="mt-1 text-[11px] font-light leading-relaxed text-neutral-500">
                      {info.description}
                    </p>
                  </div>
                  {/* Miniatura a la proporción de la creatividad */}
                  <div
                    className="shrink-0 rounded-md border border-white/15 bg-black"
                    style={{
                      width: 72,
                      aspectRatio: info.ratio,
                      maxHeight: 56,
                    }}
                    aria-hidden
                  />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {info.exportSizes.map((size) => (
                    <span
                      key={size}
                      className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[9px] text-neutral-300"
                    >
                      {size}
                    </span>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-wider text-neutral-500">
                  <span>
                    Proporción <span className="text-neutral-300">{info.ratio.replace("/", ":")}</span>
                  </span>
                  <span>
                    ≈ {formatAdViews(info.estimatedDailyViews)} vistas/día
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* 2 · Creatividad + vista previa */}
      <section className="mb-10">
        <SectionTitle
          index="2"
          title="Creatividad"
          hint={`Exporta tu asset en ${placementInfo.exportSizes.join(" o ")} (proporción ${placementInfo.ratio.replace("/", ":")}). JPG, PNG o WEBP, hasta 20 MB.`}
        />
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Controles */}
          <div className="space-y-3">
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (file) void ingestFile(file);
              }}
              className="rounded-xl border border-dashed border-white/15 bg-neutral-950/60 p-5 text-center transition-colors hover:border-white/30"
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
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-white/10 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-white transition-colors hover:bg-white/15 disabled:opacity-60"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Subiendo…
                  </>
                ) : (
                  <>
                    <Upload className="h-3.5 w-3.5" /> Subir imagen
                  </>
                )}
              </button>
              <p className="mt-2 text-[10px] font-light text-neutral-500">
                Arrastra el archivo aquí o pulsa el botón.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex h-9 flex-1 items-center rounded-lg border border-white/10 bg-neutral-950/60 px-3">
                <Link2 className="h-3.5 w-3.5 shrink-0 text-neutral-500" />
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onBlur={() => applyUrl(urlInput)}
                  placeholder="…o pega la URL de tu imagen"
                  className="h-full w-full bg-transparent pl-2 text-xs text-white outline-none placeholder:text-neutral-600"
                />
              </div>
              <button
                type="button"
                onClick={() => applyUrl(urlInput)}
                className="h-9 shrink-0 rounded-lg border border-white/15 px-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-300 transition-colors hover:text-white"
              >
                Usar
              </button>
            </div>

            {uploadError && (
              <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] leading-relaxed text-red-300">
                {uploadError}
              </p>
            )}

            {assetDims && (
              <div className="rounded-lg border border-white/5 bg-neutral-950/60 px-3 py-2 text-[11px] text-neutral-400">
                <span className="font-mono uppercase tracking-wider text-neutral-500">
                  Tu asset:{" "}
                </span>
                <span className="font-mono text-neutral-200">
                  {assetDims.w} × {assetDims.h} px
                </span>{" "}
                {ratioDelta !== null &&
                  (ratioDelta <= 0.05 ? (
                    <span className="text-emerald-400">
                      ✓ coincide con la proporción de esta ubicación
                    </span>
                  ) : (
                    <span className="text-amber-300">
                      ≠ no coincide: se mostrará{" "}
                      {placementInfo.fit === "cover"
                        ? "recortada al centro"
                        : "contenida, sin recorte"}
                    </span>
                  ))}
              </div>
            )}
          </div>

          {/* Vista previa con el contenedor REAL del slot */}
          <div>
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-500">
              Vista previa en el sitio
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
                <div className="flex h-full w-full flex-col items-center justify-center gap-1 px-4 text-center">
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-600">
                    Tu creatividad aparecerá aquí
                  </span>
                </div>
              )}
              <span className="pointer-events-none absolute left-2 top-1.5 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-500">
                Publicidad
              </span>
              <span className="pointer-events-none absolute bottom-1.5 left-2 max-w-[55%] truncate font-mono text-[10px] uppercase tracking-widest text-neutral-600">
                {advertiser || "Tu marca"}
              </span>
            </div>
            <p className="mt-2 text-[10px] font-light leading-relaxed text-neutral-500">
              {placementInfo.description} La creatividad nunca se recorta si su
              proporción coincide{" "}
              {placementInfo.fit === "cover" &&
                "(en esta ubicación se usa recorte tipo «cover» sobre la tarjeta)"}
              .
            </p>
          </div>
        </div>
      </section>

      {/* 3 · Plan y alcance */}
      <section className="mb-10">
        <SectionTitle
          index="3"
          title="Plan y alcance"
          hint="Las vistas son estimaciones de la ubicación seleccionada; los planes de impresiones incluyen garantía medida en la plataforma."
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
                className={`rounded-xl border p-4 text-left transition-colors ${
                  selected
                    ? "border-emerald-500/60 bg-emerald-500/5"
                    : "border-white/10 bg-neutral-950/60 hover:border-white/25"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-white">
                    {p.name}
                  </span>
                  <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-neutral-300">
                    {p.badge}
                  </span>
                </div>
                <p className="mt-1.5 text-[11px] font-light leading-relaxed text-neutral-500">
                  {p.description}
                </p>
                <div className="mt-3 font-mono text-sm text-white">
                  ${p.priceUsd} USD
                  <span className="ml-1.5 text-[10px] text-neutral-500">
                    / ${p.priceUyu} UYU
                  </span>
                </div>
                <div className="mt-2 space-y-0.5 font-mono text-[10px] uppercase tracking-wider text-neutral-500">
                  <div className="flex items-center gap-1.5">
                    <CalendarDays className="h-3 w-3" />
                    {p.durationDays ? `${p.durationDays} días` : "hasta agotar"}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Eye className="h-3 w-3" />
                    <span className="text-neutral-300">
                      ≈ {formatAdViews(views)} vistas
                    </span>
                    <span className="normal-case">(estimado)</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* 4 · Datos y envío */}
      <section className="mb-10">
        <SectionTitle
          index="4"
          title="Datos y envío"
          hint="Revisa el resumen: la creatividad se publica tras la revisión del equipo y la confirmación del pago."
        />
        <div className="grid gap-4 lg:grid-cols-5">
          {/* Campos */}
          <div className="space-y-3 lg:col-span-3">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título del anuncio (se ve junto a tu marca)"
              className={`w-full rounded-lg border bg-neutral-950/60 px-3 py-2.5 text-xs text-white outline-none transition-colors placeholder:text-neutral-600 focus:border-white/40 ${
                showErrors && missing.title ? "border-red-500/60" : "border-white/10"
              }`}
            />
            <input
              type="text"
              value={advertiser}
              onChange={(e) => setAdvertiser(e.target.value)}
              placeholder="Marca o empresa"
              className={`w-full rounded-lg border bg-neutral-950/60 px-3 py-2.5 text-xs text-white outline-none transition-colors placeholder:text-neutral-600 focus:border-white/40 ${
                showErrors && missing.advertiser
                  ? "border-red-500/60"
                  : "border-white/10"
              }`}
            />
            <input
              type="url"
              value={advertiserUrl}
              onChange={(e) => setAdvertiserUrl(e.target.value)}
              placeholder="https://tu-sitio.com (adónde lleva el clic)"
              className={`w-full rounded-lg border bg-neutral-950/60 px-3 py-2.5 text-xs text-white outline-none transition-colors placeholder:text-neutral-600 focus:border-white/40 ${
                showErrors && missing.advertiserUrl
                  ? "border-red-500/60"
                  : "border-white/10"
              }`}
            />
            <input
              type="text"
              value={badgeText}
              onChange={(e) => setBadgeText(e.target.value)}
              placeholder="Etiqueta (PATROCINADO)"
              className="w-full rounded-lg border border-white/10 bg-neutral-950/60 px-3 py-2.5 text-xs text-white outline-none transition-colors placeholder:text-neutral-600 focus:border-white/40"
            />

            {/* Pago */}
            <div className="grid gap-2 sm:grid-cols-3">
              {PAYMENT_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setPaymentMethod(option.id)}
                  title={option.note}
                  className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                    paymentMethod === option.id
                      ? "border-emerald-500/60 bg-emerald-500/5 text-white"
                      : "border-white/10 bg-neutral-950/60 text-neutral-400 hover:border-white/25"
                  }`}
                >
                  <span className="block text-[11px] font-semibold uppercase tracking-wider">
                    {option.name}
                  </span>
                  <span className="mt-0.5 block text-[10px] font-light leading-snug text-neutral-500">
                    {option.note}
                  </span>
                </button>
              ))}
            </div>
            {paymentMethod !== "PAYPAL" && (
              <input
                type="text"
                value={receiptNote}
                onChange={(e) => setReceiptNote(e.target.value)}
                placeholder="Nº de operación o referencia del comprobante (opcional)"
                className="w-full rounded-lg border border-white/10 bg-neutral-950/60 px-3 py-2.5 text-xs text-white outline-none transition-colors placeholder:text-neutral-600 focus:border-white/40"
              />
            )}

            {showErrors && !isValid && (
              <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-300">
                Completa los campos marcados y añade una creatividad.
              </p>
            )}
          </div>

          {/* Resumen */}
          <div className="rounded-xl border border-white/10 bg-neutral-950/60 p-4 lg:col-span-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-500">
              Resumen
            </p>
            <dl className="mt-3 space-y-2 text-[11px]">
              <div className="flex justify-between gap-3">
                <dt className="text-neutral-500">Ubicación</dt>
                <dd className="text-right text-neutral-200">
                  {placementInfo.name}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-neutral-500">Formato</dt>
                <dd className="text-right font-mono text-neutral-200">
                  {placementInfo.exportSizes[0]} ·{" "}
                  {placementInfo.ratio.replace("/", ":")}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-neutral-500">Plan</dt>
                <dd className="text-right text-neutral-200">{plan.name}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-neutral-500">Duración</dt>
                <dd className="text-right text-neutral-200">
                  {plan.durationDays
                    ? `${plan.durationDays} días`
                    : "hasta agotar presupuesto"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-neutral-500">Vistas estimadas</dt>
                <dd className="text-right font-mono text-neutral-200">
                  ≈ {formatAdViews(planViews)}
                </dd>
              </div>
              <div className="border-t border-white/5 pt-2">
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-neutral-500">Precio</dt>
                  <dd className="text-right">
                    <span className="font-mono text-base text-white">
                      ${plan.priceUsd} USD
                    </span>
                    <span className="ml-1 font-mono text-[10px] text-neutral-500">
                      / ${plan.priceUyu} UYU
                    </span>
                  </dd>
                </div>
              </div>
            </dl>

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-3 text-xs font-bold uppercase tracking-wider text-black transition-colors hover:bg-emerald-400 disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Procesando…
                </>
              ) : paymentMethod === "PAYPAL" ? (
                <>Continuar a PayPal</>
              ) : (
                <>Enviar solicitud</>
              )}
            </button>
            <p className="mt-2 flex items-start gap-1.5 text-[10px] font-light leading-relaxed text-neutral-500">
              <ShieldCheck className="mt-px h-3 w-3 shrink-0" />
              Se publica tras revisión del equipo y confirmación del pago. Puedes
              retirarla cuando quieras.
            </p>
          </div>
        </div>
      </section>
    </form>
  );
};
