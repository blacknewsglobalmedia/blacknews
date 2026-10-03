import React, { useState } from "react";
import {
  X,
  Megaphone,
  Check,
  CreditCard,
  Building2,
  Upload,
  ShieldAlert,
  Sparkles,
  ArrowRight,
  Eye,
  Calendar,
  Lock,
} from "lucide-react";
import {
  AdCampaign,
  AdPlacement,
  AD_PLACEMENTS_INFO,
  AD_PRICING_PLANS,
  AdPricingPlan,
  AdPaymentMethod,
} from "../types/ads";
import { RedactorProfile, GUEST_USER_ID } from "../types/auth";

interface CreateAdModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: RedactorProfile;
  onOpenGoogleAuth?: () => void;
  onSubmitAdCampaign: (campaign: AdCampaign) => void;
}

export const CreateAdModal: React.FC<CreateAdModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onOpenGoogleAuth,
  onSubmitAdCampaign,
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Form State
  const [selectedPlacement, setSelectedPlacement] = useState<AdPlacement>(
    "IN_FEED_LEADERBOARD",
  );
  const [selectedPlan, setSelectedPlan] = useState<AdPricingPlan>(
    AD_PRICING_PLANS[0],
  );

  const [title, setTitle] = useState("");
  const [advertiser, setAdvertiser] = useState("");
  const [advertiserUrl, setAdvertiserUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [badgeText, setBadgeText] = useState("PATROCINADO");

  const [paymentMethod, setPaymentMethod] =
    useState<AdPaymentMethod>("MERCADO_PAGO");
  const [receiptNote, setReceiptNote] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const isSignedIn = Boolean(currentUser && currentUser.id !== GUEST_USER_ID);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !title.trim() ||
      !advertiser.trim() ||
      !advertiserUrl.trim() ||
      !imageUrl.trim()
    ) {
      return;
    }

    setIsSubmitting(true);

    const now = new Date();
    const startDate = now.toISOString().split("T")[0];
    const end = new Date();
    end.setDate(now.getDate() + (selectedPlan.durationDays || 30));
    const endDate = end.toISOString().split("T")[0];

    const newCampaign: AdCampaign = {
      id: `ad-user-${Date.now()}`,
      title: title.trim(),
      advertiser: advertiser.trim(),
      advertiserUrl: advertiserUrl.trim().startsWith("http")
        ? advertiserUrl.trim()
        : `https://${advertiserUrl.trim()}`,
      placement: selectedPlacement,
      imageUrl: imageUrl.trim(),
      badgeText: badgeText.trim() || "PATROCINADO",
      targetCategory: "TODAS",
      startDate,
      endDate,
      status: "PENDIENTE_APROBACION",
      price: selectedPlan.priceUyu,
      currency: "UYU",
      pricingModel: selectedPlan.pricingModel,
      impressions: 0,
      clicks: 0,
      createdAt: startDate,
      applicantEmail: currentUser?.email || "anunciante@blacknews.com",
      applicantName: currentUser?.name || "Anunciante Registrado",
      paymentMethod,
      paymentReceiptUrl: receiptNote
        ? `Comprobante: ${receiptNote}`
        : undefined,
      targetImpressionsBudget: selectedPlan.targetImpressions,
      notes: `Solicitud autogestionada por usuario. Plan: ${selectedPlan.name} ($${selectedPlan.priceUyu} UYU).`,
    };

    setTimeout(() => {
      onSubmitAdCampaign(newCampaign);
      setIsSubmitting(false);
      setStep(4);
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 animate-in fade-in duration-150 font-sans">
      <div className="w-full max-w-3xl bg-black border border-white/10 p-6 sm:p-8 shadow-2xl relative max-h-[90vh] flex flex-col rounded-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2.5">
            <Megaphone className="w-4 h-4 text-white" />
            <h2 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-white">
              ANUNCIAR EN BLACKNEWS · PUBLICIDAD AUTOGESTIONADA
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white transition-colors cursor-pointer rounded-md hover:bg-white/5"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Require Authentication Guard */}
        {!isSignedIn ? (
          <div className="py-12 px-4 text-center space-y-5">
            <div className="w-12 h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center mx-auto text-white">
              <Lock className="w-6 h-6" />
            </div>
            <div className="space-y-2 max-w-md mx-auto">
              <h3 className="text-base font-bold text-white uppercase tracking-wider">
                REGISTRO REQUERIDO PARA ANUNCIAR
              </h3>
              <p className="text-xs text-neutral-400 font-light leading-relaxed">
                Para mantener la seguridad y certidumbre de la plataforma, debes
                iniciar sesión con tu cuenta de Google antes de publicar
                anuncios en BlackNews.
              </p>
            </div>
            <button
              onClick={() => {
                onClose();
                if (onOpenGoogleAuth) onOpenGoogleAuth();
              }}
              className="px-6 py-3 bg-white text-black font-semibold text-xs uppercase tracking-wider rounded-md hover:bg-neutral-200 transition-colors inline-flex items-center gap-2 cursor-pointer shadow-lg"
            >
              <span>ACCEDER CON MI CUENTA DE GOOGLE</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <>
            {/* Step Wizard Header */}
            {step < 4 && (
              <div className="grid grid-cols-3 gap-2 my-4 border-b border-white/10 pb-4 shrink-0 text-xs font-mono">
                <button
                  onClick={() => setStep(1)}
                  className={`py-2 px-3 rounded text-left transition-colors cursor-pointer border ${
                    step === 1
                      ? "border-white bg-white/10 text-white font-semibold"
                      : "border-white/5 text-neutral-400 hover:text-white"
                  }`}
                >
                  1. UBICACIÓN & PLAN
                </button>
                <button
                  onClick={() => setStep(2)}
                  className={`py-2 px-3 rounded text-left transition-colors cursor-pointer border ${
                    step === 2
                      ? "border-white bg-white/10 text-white font-semibold"
                      : "border-white/5 text-neutral-400 hover:text-white"
                  }`}
                >
                  2. CREATIVIDAD & ANUNCIO
                </button>
                <button
                  onClick={() => setStep(3)}
                  className={`py-2 px-3 rounded text-left transition-colors cursor-pointer border ${
                    step === 3
                      ? "border-white bg-white/10 text-white font-semibold"
                      : "border-white/5 text-neutral-400 hover:text-white"
                  }`}
                >
                  3. PAGO & CONFIRMACIÓN
                </button>
              </div>
            )}

            {/* Step 1: Ubicación y Plan Tarifario */}
            {step === 1 && (
              <div className="flex-1 overflow-y-auto space-y-6 py-2 pr-1">
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-neutral-400 mb-2 font-medium">
                    PASO 1: SELECCIONA LA UBICACIÓN DEL ANUNCIO
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {Object.values(AD_PLACEMENTS_INFO).map((info) => (
                      <div
                        key={info.id}
                        onClick={() => setSelectedPlacement(info.id)}
                        className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                          selectedPlacement === info.id
                            ? "border-white bg-white/10 shadow-md"
                            : "border-white/10 bg-neutral-950/60 hover:border-white/30"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-bold text-white uppercase">
                            {info.name}
                          </span>
                          {selectedPlacement === info.id && (
                            <Check className="w-4 h-4 text-emerald-400" />
                          )}
                        </div>
                        <p className="text-[11px] text-neutral-400 font-light leading-snug mb-2">
                          {info.description}
                        </p>
                        <span className="text-[10px] font-mono text-neutral-500 bg-black/40 px-2 py-0.5 rounded border border-white/5 inline-block">
                          {info.recommendedSize}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-neutral-400 mb-2 font-medium">
                    SELECCIONA EL PLAN TARIFA (ECONÓMICO POR TIEMPO O
                    IMPRESIONES)
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {AD_PRICING_PLANS.map((plan) => (
                      <div
                        key={plan.id}
                        onClick={() => setSelectedPlan(plan)}
                        className={`p-3.5 rounded-lg border cursor-pointer transition-all flex flex-col justify-between ${
                          selectedPlan.id === plan.id
                            ? "border-white bg-white/10 shadow-md"
                            : "border-white/10 bg-neutral-950/60 hover:border-white/30"
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="text-xs font-semibold text-white">
                              {plan.name}
                            </span>
                            <span className="text-[9px] font-mono px-1.5 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-500/30 rounded">
                              {plan.badge}
                            </span>
                          </div>
                          <p className="text-[11px] text-neutral-400 font-light leading-snug mb-3">
                            {plan.description}
                          </p>
                        </div>
                        <div className="pt-2 border-t border-white/10 flex items-baseline justify-between">
                          <span className="text-sm font-bold text-white font-mono">
                            $ {plan.priceUyu} UYU
                          </span>
                          <span className="text-[10px] text-neutral-500 font-mono">
                            (~${plan.priceUsd} USD)
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t border-white/10">
                  <button
                    onClick={() => setStep(2)}
                    className="px-5 py-2.5 bg-white text-black font-semibold text-xs uppercase tracking-wider rounded-md hover:bg-neutral-200 transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <span>CONTINUAR A CREATIVIDAD</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Creatividad del Anuncio */}
            {step === 2 && (
              <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1">
                <div className="text-xs font-mono uppercase tracking-wider text-neutral-400 mb-2 font-medium">
                  PASO 2: DATOS DEL ANUNCIO Y CREATIVIDAD
                </div>

                <div>
                  <label className="block text-xs font-sans text-neutral-300 mb-1">
                    TÍTULO O TITULAR DE LA CAMPAÑA *
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ej: Custodia Segura de Activos Patrimoniales"
                    className="w-full bg-neutral-950 border border-white/20 p-2.5 text-xs text-white rounded-md focus:outline-none focus:border-white font-sans"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-sans text-neutral-300 mb-1">
                      NOMBRE DE LA EMPRESA O MARCA *
                    </label>
                    <input
                      type="text"
                      required
                      value={advertiser}
                      onChange={(e) => setAdvertiser(e.target.value)}
                      placeholder="Ej: Zurich Wealth Management"
                      className="w-full bg-neutral-950 border border-white/20 p-2.5 text-xs text-white rounded-md focus:outline-none focus:border-white font-sans"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-sans text-neutral-300 mb-1">
                      ETIQUETA DE BADGE (OPCIONAL)
                    </label>
                    <input
                      type="text"
                      value={badgeText}
                      onChange={(e) => setBadgeText(e.target.value)}
                      placeholder="PATROCINADO, PATRIMONIO, PROMO..."
                      className="w-full bg-neutral-950 border border-white/20 p-2.5 text-xs text-white rounded-md focus:outline-none focus:border-white font-sans"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-sans text-neutral-300 mb-1">
                    ENLACE WEB DE DESTINO (URL) *
                  </label>
                  <input
                    type="url"
                    required
                    value={advertiserUrl}
                    onChange={(e) => setAdvertiserUrl(e.target.value)}
                    placeholder="https://tuempresa.com/landings"
                    className="w-full bg-neutral-950 border border-white/20 p-2.5 text-xs text-white rounded-md focus:outline-none focus:border-white font-sans font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-sans text-neutral-300 mb-1">
                    URL DE IMAGEN BANNER (O UN SPLASH DIRECTO) *
                  </label>
                  <input
                    type="url"
                    required
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://images.unsplash.com/photo-..."
                    className="w-full bg-neutral-950 border border-white/20 p-2.5 text-xs text-white rounded-md focus:outline-none focus:border-white font-sans font-mono"
                  />
                </div>

                {/* Previsualización rápida */}
                {imageUrl && title && (
                  <div className="pt-2">
                    <label className="block text-[11px] font-mono text-neutral-400 mb-1">
                      VISTA PREVIA DEL BANNER:
                    </label>
                    <div className="p-3 bg-black border border-white/20 rounded-lg flex items-center gap-3">
                      <img
                        src={imageUrl}
                        alt="Previsualización"
                        className="w-20 h-16 object-cover rounded border border-white/10 shrink-0"
                      />
                      <div className="overflow-hidden">
                        <span className="text-[9px] font-mono uppercase bg-white/10 text-white px-1.5 py-0.5 rounded">
                          {badgeText || "PATROCINADO"}
                        </span>
                        <div className="text-xs font-semibold text-white truncate mt-1">
                          {title}
                        </div>
                        <div className="text-[11px] text-neutral-400 truncate">
                          {advertiser}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-4 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="px-4 py-2 text-xs font-sans text-neutral-400 hover:text-white cursor-pointer"
                  >
                    ATRÁS
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!title || !advertiser || !advertiserUrl || !imageUrl)
                        return;
                      setStep(3);
                    }}
                    disabled={
                      !title || !advertiser || !advertiserUrl || !imageUrl
                    }
                    className="px-5 py-2.5 bg-white text-black font-semibold text-xs uppercase tracking-wider rounded-md hover:bg-neutral-200 transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-40"
                  >
                    <span>PASAR AL PAGO</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Pago e Instrucciones en Uruguay */}
            {step === 3 && (
              <form
                onSubmit={handleSubmit}
                className="flex-1 overflow-y-auto space-y-5 py-2 pr-1"
              >
                <div className="text-xs font-mono uppercase tracking-wider text-neutral-400 mb-2 font-medium">
                  PASO 3: SELECCIÓN DE PAGO Y ENVÍO A VALIDACIÓN
                </div>

                <div className="p-4 bg-neutral-950 border border-white/10 rounded-lg space-y-2">
                  <div className="text-xs font-semibold text-white uppercase tracking-wider">
                    RESUMEN DE SOLICITUD DE ANUNCIO:
                  </div>
                  <div className="flex items-center justify-between text-xs text-neutral-300">
                    <span>Plan seleccionado:</span>
                    <strong className="text-white">{selectedPlan.name}</strong>
                  </div>
                  <div className="flex items-center justify-between text-xs text-neutral-300">
                    <span>Ubicación:</span>
                    <span className="text-white">
                      {AD_PLACEMENTS_INFO[selectedPlacement].name}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-white pt-2 border-t border-white/10 font-mono">
                    <span>TOTAL A PAGAR:</span>
                    <span className="text-base font-bold text-emerald-400">
                      $ {selectedPlan.priceUyu} UYU
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-sans text-neutral-300 mb-2">
                    MÉTODO DE PAGO DESDE URUGUAY *
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div
                      onClick={() => setPaymentMethod("MERCADO_PAGO")}
                      className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                        paymentMethod === "MERCADO_PAGO"
                          ? "border-white bg-white/10"
                          : "border-white/10 bg-neutral-950/60"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <CreditCard className="w-4 h-4 text-sky-400" />
                        <span className="text-xs font-bold text-white">
                          MERCADO PAGO URUGUAY
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-400 font-light">
                        Tarjetas Visa, OCA, Mastercard, Abitab, Redpagos o saldo
                        MP.
                      </p>
                    </div>

                    <div
                      onClick={() => setPaymentMethod("BANK_TRANSFER")}
                      className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                        paymentMethod === "BANK_TRANSFER"
                          ? "border-white bg-white/10"
                          : "border-white/10 bg-neutral-950/60"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Building2 className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs font-bold text-white">
                          TRANSFERENCIA BROU / ITAÚ
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-400 font-light">
                        Transferencia directa entre bancos uruguayos.
                      </p>
                    </div>
                  </div>
                </div>

                {paymentMethod === "BANK_TRANSFER" && (
                  <div className="p-3.5 bg-neutral-950 border border-white/10 rounded-lg space-y-2 text-xs">
                    <div className="font-semibold text-white">
                      DATOS PARA TRANSFERENCIA BANCARIA:
                    </div>
                    <div className="text-neutral-400 font-mono space-y-1 text-[11px]">
                      <p>
                        ● BANCO: BROU (Banco República Oriental del Uruguay)
                      </p>
                      <p>● CUENTA EN PESOS (UYU): 001558294-00001</p>
                      <p>● TITULAR: BLACKNEWS GLOBAL MEDIA</p>
                    </div>
                    <div>
                      <label className="block text-[11px] text-neutral-300 mt-2 mb-1">
                        NÚMERO O DETALLE DEL COMPROBANTE:
                      </label>
                      <input
                        type="text"
                        value={receiptNote}
                        onChange={(e) => setReceiptNote(e.target.value)}
                        placeholder="Ej: Transf. BROU #984210 del 03/10"
                        className="w-full bg-black border border-white/20 p-2 text-xs text-white rounded font-mono"
                      />
                    </div>
                  </div>
                )}

                <div className="p-3 bg-amber-950/30 border border-amber-500/30 rounded-lg flex items-start gap-2.5 text-xs text-amber-200">
                  <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <p className="font-light leading-relaxed">
                    <strong className="text-white font-medium">
                      Revisión previa obligatoria:
                    </strong>{" "}
                    Una vez realizado el pago, tu anuncio pasará al estado{" "}
                    <strong className="text-white font-medium font-mono">
                      PENDIENTE DE APROBACIÓN
                    </strong>
                    . Un administrador o moderador validará la creatividad y la
                    activará en la portada.
                  </p>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="px-4 py-2 text-xs font-sans text-neutral-400 hover:text-white cursor-pointer"
                  >
                    ATRÁS
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-3 bg-emerald-500 text-black font-bold text-xs uppercase tracking-wider rounded-md hover:bg-emerald-400 transition-colors flex items-center gap-2 cursor-pointer shadow-lg disabled:opacity-50"
                  >
                    <span>
                      {isSubmitting
                        ? "PROCESANDO..."
                        : "ENVIAR A VALIDACIÓN DE ADMIN"}
                    </span>
                    <Sparkles className="w-4 h-4" />
                  </button>
                </div>
              </form>
            )}

            {/* Step 4: Confirmación Final */}
            {step === 4 && (
              <div className="py-10 px-4 text-center space-y-5 flex-1 flex flex-col items-center justify-center">
                <div className="w-14 h-14 rounded-full bg-emerald-950 border border-emerald-500/50 flex items-center justify-center text-emerald-400">
                  <Check className="w-8 h-8" />
                </div>
                <div className="space-y-2 max-w-md">
                  <h3 className="text-base font-bold text-white uppercase tracking-wider">
                    ¡SOLICITUD DE PUBLICIDAD ENVIADA!
                  </h3>
                  <p className="text-xs text-neutral-300 leading-relaxed font-light">
                    Tu campaña se ha registrado correctamente con el estado{" "}
                    <strong className="text-amber-400 font-mono">
                      PENDIENTE DE APROBACIÓN
                    </strong>
                    .
                  </p>
                  <p className="text-xs text-neutral-400 leading-relaxed font-light">
                    Un administrador o moderador de BlackNews revisará la imagen
                    y los datos para activarla en la plataforma.
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 bg-white text-black font-semibold text-xs uppercase tracking-wider rounded-md hover:bg-neutral-200 transition-colors cursor-pointer"
                >
                  ENTENDIDO Y CERRAR
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
