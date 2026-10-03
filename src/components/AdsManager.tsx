import React, { useState } from "react";
import {
  Plus,
  Trash2,
  Edit2,
  Eye,
  ExternalLink,
  DollarSign,
  BarChart3,
  Calendar,
  Megaphone,
  Layers,
  CheckCircle,
  PauseCircle,
  PlayCircle,
  HelpCircle,
  Sparkles,
  Search,
  Filter,
  ArrowUpRight,
  TrendingUp,
  MousePointerClick,
  Info,
  Clock,
  Check,
  X,
  ShieldAlert,
  ThumbsUp,
  ThumbsDown,
  AlertCircle,
  CreditCard,
  Building2,
} from "lucide-react";
import {
  AdCampaign,
  AdPlacement,
  AdStatus,
  AD_PLACEMENTS_INFO,
} from "../types/ads";
import { CategoryId } from "../types/news";

interface AdsManagerProps {
  campaigns: AdCampaign[];
  onSaveCampaign: (campaign: AdCampaign) => void;
  onDeleteCampaign: (campaignId: string) => void;
  categories: readonly CategoryId[];
}

const PRESET_AD_IMAGES = [
  {
    name: "Bóveda Suiza / Oro & Metales",
    url: "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?auto=format&fit=crop&w=1200&q=80",
    bestFor: "Finanzas, Banca Privada, Custodia",
  },
  {
    name: "Clusters Criogénicos / Cómputo IA",
    url: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1200&q=80",
    bestFor: "Tecnología, Infraestructura, Nube",
  },
  {
    name: "Rascacielos Corporativo / Wealth",
    url: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80",
    bestFor: "Gestión Patrimonial, Fondos, Mercados",
  },
  {
    name: "Tribunal Mercantil / Arbitraje",
    url: "https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=1200&q=80",
    bestFor: "Derecho, Propiedad, Arbitraje Jurídico",
  },
];

export const AdsManager: React.FC<AdsManagerProps> = ({
  campaigns,
  onSaveCampaign,
  onDeleteCampaign,
  categories,
}) => {
  const [activeTab, setActiveTab] = useState<"all" | "pending">("all");
  const [filterPlacement, setFilterPlacement] = useState<string>("TODAS");
  const [filterStatus, setFilterStatus] = useState<string>("TODAS");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal state
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isRateCardOpen, setIsRateCardOpen] = useState(false);
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(
    null,
  );

  // Approval flow state
  const [rejectingCampaignId, setRejectingCampaignId] = useState<string | null>(
    null,
  );
  const [rejectionReason, setRejectionReason] = useState("");

  // Form State
  const [formTitle, setFormTitle] = useState("");
  const [formAdvertiser, setFormAdvertiser] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formPlacement, setFormPlacement] =
    useState<AdPlacement>("TOP_BILLBOARD");
  const [formImageUrl, setFormImageUrl] = useState(PRESET_AD_IMAGES[0].url);
  const [formBadgeText, setFormBadgeText] = useState("PATROCINIO EXCLUSIVO");
  const [formCategory, setFormCategory] = useState<CategoryId | "TODAS">(
    "TODAS",
  );
  const [formStartDate, setFormStartDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [formEndDate, setFormEndDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [formStatus, setFormStatus] = useState<AdStatus>("ACTIVE");
  const [formPrice, setFormPrice] = useState(1200);
  const [formCurrency, setFormCurrency] = useState<
    "USD" | "UYU" | "CHF" | "EUR"
  >("USD");
  const [formPricingModel, setFormPricingModel] = useState<
    "FIXED_PERIOD" | "CPM" | "CPC"
  >("FIXED_PERIOD");
  const [formNotes, setFormNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  // Stats calculation
  const totalCampaigns = campaigns.length;
  const activeCampaigns = campaigns.filter((c) => c.status === "ACTIVE").length;
  const pendingCampaigns = campaigns.filter(
    (c) => c.status === "PENDIENTE_APROBACION" || c.status === "PENDIENTE_PAGO",
  );
  const totalRevenue = campaigns
    .filter((c) => c.status === "ACTIVE")
    .reduce((acc, curr) => acc + (curr.price || 0), 0);
  const totalImpressions = campaigns.reduce(
    (acc, curr) => acc + (curr.impressions || 0),
    0,
  );
  const totalClicks = campaigns.reduce(
    (acc, curr) => acc + (curr.clicks || 0),
    0,
  );
  const averageCtr =
    totalImpressions > 0
      ? ((totalClicks / totalImpressions) * 100).toFixed(2)
      : "0.00";

  const handleApproveCampaign = (campaign: AdCampaign) => {
    onSaveCampaign({
      ...campaign,
      status: "ACTIVE",
      rejectionReason: undefined,
    });
  };

  const handleRejectCampaign = (campaign: AdCampaign) => {
    if (!rejectionReason.trim()) return;
    onSaveCampaign({
      ...campaign,
      status: "RECHAZADA",
      rejectionReason: rejectionReason.trim(),
    });
    setRejectingCampaignId(null);
    setRejectionReason("");
  };

  // Filtered List
  const filteredCampaigns = campaigns.filter((c) => {
    if (filterPlacement !== "TODAS" && c.placement !== filterPlacement)
      return false;
    if (filterStatus !== "TODAS" && c.status !== filterStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        c.title.toLowerCase().includes(q) ||
        c.advertiser.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const handleOpenCreate = () => {
    setEditingCampaignId(null);
    setFormTitle("");
    setFormAdvertiser("");
    setFormUrl("https://");
    setFormPlacement("TOP_BILLBOARD");
    setFormImageUrl(PRESET_AD_IMAGES[0].url);
    setFormBadgeText("PATROCINIO EXCLUSIVO");
    setFormCategory("TODAS");
    setFormStartDate(new Date().toISOString().slice(0, 10));
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    setFormEndDate(d.toISOString().slice(0, 10));
    setFormStatus("ACTIVE");
    setFormPrice(1200);
    setFormCurrency("USD");
    setFormPricingModel("FIXED_PERIOD");
    setFormNotes("");
    setFormError(null);
    setIsEditorOpen(true);
  };

  const handleOpenEdit = (campaign: AdCampaign) => {
    setEditingCampaignId(campaign.id);
    setFormTitle(campaign.title);
    setFormAdvertiser(campaign.advertiser);
    setFormUrl(campaign.advertiserUrl);
    setFormPlacement(campaign.placement);
    setFormImageUrl(campaign.imageUrl);
    setFormBadgeText(campaign.badgeText || "PATROCINIO");
    setFormCategory(campaign.targetCategory || "TODAS");
    setFormStartDate(campaign.startDate);
    setFormEndDate(campaign.endDate);
    setFormStatus(campaign.status);
    setFormPrice(campaign.price);
    setFormCurrency(campaign.currency);
    setFormPricingModel(campaign.pricingModel);
    setFormNotes(campaign.notes || "");
    setFormError(null);
    setIsEditorOpen(true);
  };

  const handleToggleStatus = (campaign: AdCampaign) => {
    const updated: AdCampaign = {
      ...campaign,
      status: campaign.status === "ACTIVE" ? "PAUSED" : "ACTIVE",
    };
    onSaveCampaign(updated);
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setFormError("El titular de la campaña es obligatorio.");
      return;
    }
    if (!formAdvertiser.trim()) {
      setFormError("El nombre del anunciante es obligatorio.");
      return;
    }
    if (!formUrl.trim() || !formUrl.startsWith("http")) {
      setFormError(
        "Proporciona una URL de destino válida (comenzando por https://).",
      );
      return;
    }
    if (!formImageUrl.trim()) {
      setFormError("La URL de la imagen del banner es obligatoria.");
      return;
    }

    const campaignData: AdCampaign = {
      id: editingCampaignId || `ad-camp-${Date.now()}`,
      title: formTitle.trim(),
      advertiser: formAdvertiser.trim(),
      advertiserUrl: formUrl.trim(),
      placement: formPlacement,
      imageUrl: formImageUrl.trim(),
      badgeText: formBadgeText.trim() || "PATROCINIO",
      targetCategory: formCategory,
      startDate: formStartDate,
      endDate: formEndDate,
      status: formStatus,
      price: Number(formPrice) || 0,
      currency: formCurrency,
      pricingModel: formPricingModel,
      impressions: editingCampaignId
        ? campaigns.find((c) => c.id === editingCampaignId)?.impressions || 0
        : 0,
      clicks: editingCampaignId
        ? campaigns.find((c) => c.id === editingCampaignId)?.clicks || 0
        : 0,
      createdAt: editingCampaignId
        ? campaigns.find((c) => c.id === editingCampaignId)?.createdAt ||
          new Date().toISOString()
        : new Date().toISOString(),
      notes: formNotes.trim(),
    };

    onSaveCampaign(campaignData);
    setIsEditorOpen(false);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 w-full font-sans">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-neutral-400 font-semibold mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse" />
            <span>SISTEMA DE PUBLICIDAD & SPONSORS</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight font-['Lexend']">
            Gestión de Anuncios y Patrocinios
          </h2>
          <p className="text-xs sm:text-sm text-neutral-400 font-light mt-0.5 max-w-2xl">
            Control integral de espacios publicitarios, banners, validación de
            solicitudes de usuarios y métricas en tiempo real.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setIsRateCardOpen(true)}
            className="px-3.5 py-2 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 hover:text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 border border-white/10 cursor-pointer"
          >
            <Info className="w-3.5 h-3.5 text-neutral-400" />
            <span>Tarifario & Espacios</span>
          </button>

          <button
            type="button"
            onClick={handleOpenCreate}
            className="px-4 py-2 bg-white text-black hover:bg-neutral-200 font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nueva Campaña</span>
          </button>
        </div>
      </div>

      {/* Tab Nav */}
      <div className="flex gap-1 border-b border-white/10">
        <button
          onClick={() => setActiveTab("all")}
          className={`py-2.5 px-4 text-xs font-semibold uppercase tracking-wider border-b-2 cursor-pointer transition-colors ${
            activeTab === "all"
              ? "border-white text-white"
              : "border-transparent text-neutral-400 hover:text-white"
          }`}
        >
          TODAS LAS CAMPAÑAS
        </button>
        <button
          onClick={() => setActiveTab("pending")}
          className={`py-2.5 px-4 text-xs font-semibold uppercase tracking-wider border-b-2 cursor-pointer transition-colors flex items-center gap-2 ${
            activeTab === "pending"
              ? "border-amber-400 text-amber-400"
              : "border-transparent text-neutral-400 hover:text-amber-300"
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>PENDIENTES DE APROBACIÓN</span>
          {pendingCampaigns.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 bg-amber-500 text-black text-[10px] font-bold rounded-full">
              {pendingCampaigns.length}
            </span>
          )}
        </button>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* KPI 1: Active Campaigns */}
        <div className="p-4 rounded-xl bg-neutral-950 border border-white/10 shadow-lg">
          <div className="flex items-center justify-between text-neutral-400 text-xs mb-1.5">
            <span className="font-semibold uppercase tracking-wider text-[10px]">
              Campañas Activas
            </span>
            <Megaphone className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            {activeCampaigns}{" "}
            <span className="text-xs text-neutral-500 font-normal">
              / {totalCampaigns}
            </span>
          </div>
          <p className="text-[11px] text-neutral-400 mt-1">
            En emisión en la plataforma
          </p>
        </div>

        {/* KPI 2: Revenue */}
        <div className="p-4 rounded-xl bg-neutral-950 border border-white/10 shadow-lg">
          <div className="flex items-center justify-between text-neutral-400 text-xs mb-1.5">
            <span className="font-semibold uppercase tracking-wider text-[10px]">
              Ingresos Activos
            </span>
            <DollarSign className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            ${totalRevenue.toLocaleString()}{" "}
            <span className="text-xs text-neutral-500 font-normal">USD</span>
          </div>
          <p className="text-[11px] text-neutral-400 mt-1">
            Facturación en cartera
          </p>
        </div>

        {/* KPI 3: Impressions */}
        <div className="p-4 rounded-xl bg-neutral-950 border border-white/10 shadow-lg">
          <div className="flex items-center justify-between text-neutral-400 text-xs mb-1.5">
            <span className="font-semibold uppercase tracking-wider text-[10px]">
              Impresiones Reales
            </span>
            <Eye className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            {totalImpressions.toLocaleString()}
          </div>
          <p className="text-[11px] text-neutral-400 mt-1">
            Visualizaciones de banners
          </p>
        </div>

        {/* KPI 4: CTR */}
        <div className="p-4 rounded-xl bg-neutral-950 border border-white/10 shadow-lg">
          <div className="flex items-center justify-between text-neutral-400 text-xs mb-1.5">
            <span className="font-semibold uppercase tracking-wider text-[10px]">
              Rendimiento CTR
            </span>
            <MousePointerClick className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            {averageCtr}%{" "}
            <span className="text-xs text-neutral-500 font-normal">
              ({totalClicks} clics)
            </span>
          </div>
          <p className="text-[11px] text-neutral-400 mt-1">
            Tasa media de interacción
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-xl bg-neutral-950 border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search */}
          <div className="relative min-w-[200px] sm:min-w-[260px]">
            <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por campaña o anunciante..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-neutral-900 border border-white/10 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-white/30"
            />
          </div>

          {/* Placement Filter */}
          <div className="flex items-center gap-1 text-xs">
            <span className="text-neutral-500 font-mono uppercase text-[10px] mr-1">
              Espacio:
            </span>
            <select
              value={filterPlacement}
              onChange={(e) => setFilterPlacement(e.target.value)}
              className="bg-neutral-900 border border-white/10 text-neutral-300 text-xs py-1.5 px-2.5 rounded-lg focus:outline-none focus:border-white/30"
            >
              <option value="TODAS">Todos los espacios</option>
              <option value="TOP_BILLBOARD">Top Billboard Portada</option>
              <option value="IN_FEED_LEADERBOARD">Leaderboard In-Feed</option>
              <option value="ARTICLE_SIDEBAR">Skyscraper Lateral</option>
              <option value="ARTICLE_FOOTER">Banner Pie Artículo</option>
              <option value="GRID_CARD">Card Patrocinada 4:5</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1 text-xs">
            <span className="text-neutral-500 font-mono uppercase text-[10px] mr-1">
              Estado:
            </span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-neutral-900 border border-white/10 text-neutral-300 text-xs py-1.5 px-2.5 rounded-lg focus:outline-none focus:border-white/30"
            >
              <option value="TODAS">Todos los estados</option>
              <option value="ACTIVE">Activas</option>
              <option value="PAUSED">Pausadas</option>
            </select>
          </div>
        </div>

        <div className="text-xs text-neutral-400 font-mono">
          Mostrando {filteredCampaigns.length} de {campaigns.length} campañas
        </div>
      </div>

      {/* PENDING APPROVAL QUEUE */}
      {activeTab === "pending" && (
        <div>
          {pendingCampaigns.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-neutral-950 border border-white/10 space-y-3">
              <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto" />
              <h3 className="text-base font-bold text-white">
                Sin solicitudes pendientes
              </h3>
              <p className="text-xs text-neutral-400 max-w-sm mx-auto font-light">
                No hay campañas esperando aprobación. Todas las solicitudes han
                sido procesadas.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingCampaigns.map((camp) => (
                <div
                  key={camp.id}
                  className="p-5 rounded-xl bg-amber-950/20 border border-amber-500/30 space-y-4 shadow-lg"
                >
                  {/* Header */}
                  <div className="flex items-start gap-4">
                    <img
                      src={camp.imageUrl}
                      alt={camp.title}
                      className="w-28 h-20 object-cover rounded-lg border border-white/10 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-[10px] font-mono uppercase font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded">
                          {camp.status === "PENDIENTE_APROBACION"
                            ? "PENDIENTE APROBACIÓN"
                            : "PENDIENTE PAGO"}
                        </span>
                        <span className="text-[10px] font-mono text-neutral-400">
                          {AD_PLACEMENTS_INFO[camp.placement]?.name}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-white truncate">
                        {camp.title}
                      </h4>
                      <div className="text-xs text-neutral-400 font-mono mt-0.5">
                        {camp.advertiser}
                      </div>
                      <a
                        href={camp.advertiserUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-sky-400 hover:underline font-mono truncate block mt-0.5"
                      >
                        {camp.advertiserUrl}
                      </a>
                    </div>
                  </div>

                  {/* Payment info */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                    <div className="p-2.5 bg-black/40 rounded-lg">
                      <div className="text-neutral-500 text-[10px] uppercase">
                        Anunciante
                      </div>
                      <div className="text-white font-bold truncate">
                        {camp.applicantName || camp.advertiser}
                      </div>
                    </div>
                    <div className="p-2.5 bg-black/40 rounded-lg">
                      <div className="text-neutral-500 text-[10px] uppercase">
                        Email
                      </div>
                      <div className="text-white font-bold truncate">
                        {camp.applicantEmail || "—"}
                      </div>
                    </div>
                    <div className="p-2.5 bg-black/40 rounded-lg">
                      <div className="text-neutral-500 text-[10px] uppercase">
                        Plan / Monto
                      </div>
                      <div className="text-emerald-400 font-bold">
                        {camp.price} {camp.currency}
                      </div>
                    </div>
                    <div className="p-2.5 bg-black/40 rounded-lg">
                      <div className="text-neutral-500 text-[10px] uppercase">
                        Método de Pago
                      </div>
                      <div className="text-white font-bold flex items-center gap-1">
                        {camp.paymentMethod === "MERCADO_PAGO" ? (
                          <>
                            <CreditCard className="w-3.5 h-3.5 text-sky-400" />{" "}
                            Mercado Pago
                          </>
                        ) : camp.paymentMethod === "BANK_TRANSFER" ? (
                          <>
                            <Building2 className="w-3.5 h-3.5 text-emerald-400" />{" "}
                            Transf. Bancaria
                          </>
                        ) : (
                          "—"
                        )}
                      </div>
                    </div>
                  </div>

                  {camp.paymentReceiptUrl && (
                    <div className="p-2.5 bg-black/40 rounded-lg border border-white/10 text-xs font-mono text-neutral-300">
                      <span className="text-neutral-500 text-[10px] uppercase block">
                        Comprobante / Referencia:
                      </span>
                      <span className="text-white">
                        {camp.paymentReceiptUrl}
                      </span>
                    </div>
                  )}

                  {/* Rejection Reason Input */}
                  {rejectingCampaignId === camp.id && (
                    <div className="space-y-2">
                      <label className="text-[11px] font-mono text-red-400 uppercase">
                        MOTIVO DE RECHAZO:
                      </label>
                      <textarea
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        rows={2}
                        placeholder="Ej: Imagen de baja resolución, enlace roto, contenido no permitido por política editorial..."
                        className="w-full bg-black border border-red-500/30 text-white text-xs p-2.5 rounded-lg font-sans focus:outline-none focus:border-red-400"
                      />
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 pt-2 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => handleApproveCampaign(camp)}
                      className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-colors"
                    >
                      <ThumbsUp className="w-3.5 h-3.5" />
                      <span>APROBAR Y PUBLICAR</span>
                    </button>

                    {rejectingCampaignId === camp.id ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleRejectCampaign(camp)}
                          disabled={!rejectionReason.trim()}
                          className="flex-1 py-2.5 bg-red-700 hover:bg-red-600 text-white font-bold text-xs uppercase tracking-wider rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-40"
                        >
                          <ThumbsDown className="w-3.5 h-3.5" />
                          <span>CONFIRMAR RECHAZO</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRejectingCampaignId(null);
                            setRejectionReason("");
                          }}
                          className="p-2.5 text-neutral-400 hover:text-white cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setRejectingCampaignId(camp.id)}
                        className="flex-1 py-2.5 bg-neutral-800 hover:bg-red-900/60 text-neutral-300 hover:text-red-300 border border-white/10 hover:border-red-500/40 font-bold text-xs uppercase tracking-wider rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-colors"
                      >
                        <ThumbsDown className="w-3.5 h-3.5" />
                        <span>RECHAZAR</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleOpenEdit(camp)}
                      className="p-2.5 text-neutral-400 hover:text-white rounded-lg hover:bg-white/10 cursor-pointer border border-white/10 transition-colors"
                      title="Ver / Editar detalles"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CAMPAIGNS TABLE - only in 'all' tab */}
      {activeTab === "all" && (
        <>
          {/* Filter and Search Bar */}
          <div className="p-4 rounded-xl bg-neutral-950 border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative min-w-[200px] sm:min-w-[260px]">
                <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por campaña o anunciante..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-neutral-900 border border-white/10 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-white/30"
                />
              </div>
              <div className="flex items-center gap-1 text-xs">
                <span className="text-neutral-500 font-mono uppercase text-[10px] mr-1">
                  Estado:
                </span>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="bg-neutral-900 border border-white/10 text-neutral-300 text-xs py-1.5 px-2.5 rounded-lg focus:outline-none focus:border-white/30"
                >
                  <option value="TODAS">Todos los estados</option>
                  <option value="ACTIVE">Activas</option>
                  <option value="PAUSED">Pausadas</option>
                  <option value="RECHAZADA">Rechazadas</option>
                  <option value="PENDIENTE_APROBACION">Pendientes</option>
                </select>
              </div>
            </div>
            <div className="text-xs text-neutral-400 font-mono">
              Mostrando {filteredCampaigns.length} de {campaigns.length}{" "}
              campañas
            </div>
          </div>

          {filteredCampaigns.length > 0 ? (
            <div className="space-y-3">
              {filteredCampaigns.map((camp) => {
                const placementDetails = AD_PLACEMENTS_INFO[camp.placement];
                const ctr =
                  camp.impressions > 0
                    ? ((camp.clicks / camp.impressions) * 100).toFixed(2)
                    : "0.00";
                const statusColor =
                  camp.status === "ACTIVE"
                    ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
                    : camp.status === "PENDIENTE_APROBACION"
                      ? "text-amber-400 border-amber-500/30 bg-amber-500/10"
                      : camp.status === "RECHAZADA"
                        ? "text-red-400 border-red-500/30 bg-red-500/10"
                        : "text-neutral-400 border-white/10 bg-neutral-900";

                return (
                  <div
                    key={camp.id}
                    className="p-4 rounded-xl bg-neutral-950 border border-white/10 hover:border-white/25 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-lg group"
                  >
                    <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                      <div className="relative w-24 h-16 rounded-lg overflow-hidden shrink-0 border border-white/10 bg-neutral-900">
                        <img
                          src={camp.imageUrl}
                          alt={camp.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <span className="absolute top-1 left-1 text-[8px] font-mono font-bold uppercase tracking-wider text-black bg-white px-1 rounded-[1px]">
                          {camp.placement.split("_")[0]}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap text-[10px] font-mono uppercase mb-0.5">
                          <span className="font-bold text-white bg-white/10 px-1.5 py-0.2 rounded">
                            {camp.advertiser}
                          </span>
                          <span className="text-neutral-500">·</span>
                          <span className="text-neutral-400 font-semibold">
                            {placementDetails?.name || camp.placement}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-white truncate max-w-xl">
                          {camp.title}
                        </h4>
                        <div className="flex items-center gap-3 text-[11px] text-neutral-400 mt-1 font-mono">
                          <span>
                            {camp.startDate} → {camp.endDate}
                          </span>
                          <span>·</span>
                          <span className="text-neutral-300 font-bold">
                            {camp.price} {camp.currency}
                          </span>
                        </div>
                        {camp.status === "RECHAZADA" &&
                          camp.rejectionReason && (
                            <p className="text-[11px] text-red-400 mt-1 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              {camp.rejectionReason}
                            </p>
                          )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 lg:gap-6 self-end lg:self-center shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-white/5 w-full lg:w-auto justify-between lg:justify-end">
                      <div className="flex items-center gap-4 text-xs font-mono">
                        <div className="text-right">
                          <div className="text-neutral-400 text-[10px] uppercase">
                            Impresiones
                          </div>
                          <div className="font-bold text-white">
                            {camp.impressions.toLocaleString()}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-neutral-400 text-[10px] uppercase">
                            Clics
                          </div>
                          <div className="font-bold text-white">
                            {camp.clicks}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-neutral-400 text-[10px] uppercase">
                            CTR
                          </div>
                          <div className="font-bold text-emerald-400">
                            {ctr}%
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border ${statusColor}`}
                        >
                          {camp.status}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(camp)}
                          className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer border border-white/10"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <a
                          href={camp.advertiserUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer border border-white/10"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`¿Retirar la campaña "${camp.title}"?`))
                              onDeleteCampaign(camp.id);
                          }}
                          className="p-1.5 text-neutral-500 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-12 text-center rounded-2xl bg-neutral-950 border border-white/10 space-y-3">
              <Megaphone className="w-8 h-8 text-neutral-500 mx-auto" />
              <h3 className="text-base font-bold text-white">
                No hay campañas que coincidan
              </h3>
              <p className="text-xs text-neutral-400 max-w-sm mx-auto font-light">
                Ajusta los filtros o crea una nueva campaña publicitaria.
              </p>
              <button
                type="button"
                onClick={handleOpenCreate}
                className="px-4 py-2 bg-white text-black font-bold text-xs uppercase tracking-wider rounded-xl hover:bg-neutral-200 transition-colors"
              >
                Crear Primera Campaña
              </button>
            </div>
          )}
        </>
      )}

      {/* MODAL: CAMPAIGN EDITOR */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-neutral-950 border border-white/15 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl space-y-5 my-8">
            {/* Modal Header */}
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white font-['Lexend']">
                  {editingCampaignId
                    ? "Editar Campaña Publicitaria"
                    : "Nueva Campaña Publicitaria"}
                </h3>
                <p className="text-xs text-neutral-400 font-light mt-0.5">
                  Configure el espacio, fechas de emisión, presupuesto pactado y
                  banner visual.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmitForm} className="p-5 space-y-4 pt-0">
              {formError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-300 text-xs rounded-xl">
                  {formError}
                </div>
              )}

              {/* Title & Advertiser */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">
                    Titular del Anuncio / Campaña *
                  </label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="Ej: Custodia Segura de Metales en Zúrich"
                    className="w-full bg-neutral-900 border border-white/10 p-2.5 text-xs text-white rounded-xl focus:outline-none focus:border-white/30"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">
                    Anunciante / Marca Comercial *
                  </label>
                  <input
                    type="text"
                    required
                    value={formAdvertiser}
                    onChange={(e) => setFormAdvertiser(e.target.value)}
                    placeholder="Ej: Zurich Vault SA"
                    className="w-full bg-neutral-900 border border-white/10 p-2.5 text-xs text-white rounded-xl focus:outline-none focus:border-white/30"
                  />
                </div>
              </div>

              {/* URL & Badge Text */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">
                    URL de Destino al Clic *
                  </label>
                  <input
                    type="url"
                    required
                    value={formUrl}
                    onChange={(e) => setFormUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full bg-neutral-900 border border-white/10 p-2.5 text-xs text-white rounded-xl focus:outline-none focus:border-white/30 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">
                    Rótulo / Badge Patrocinado
                  </label>
                  <input
                    type="text"
                    value={formBadgeText}
                    onChange={(e) => setFormBadgeText(e.target.value)}
                    placeholder="PATROCINIO EXCLUSIVO"
                    className="w-full bg-neutral-900 border border-white/10 p-2.5 text-xs text-white rounded-xl focus:outline-none focus:border-white/30 uppercase font-mono"
                  />
                </div>
              </div>

              {/* Placement & Target Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">
                    Ubicación / Formato de Banner *
                  </label>
                  <select
                    value={formPlacement}
                    onChange={(e) =>
                      setFormPlacement(e.target.value as AdPlacement)
                    }
                    className="w-full bg-neutral-900 border border-white/10 p-2.5 text-xs text-white rounded-xl focus:outline-none focus:border-white/30"
                  >
                    <option value="TOP_BILLBOARD">
                      Top Billboard Portada (970×250 / 728×90)
                    </option>
                    <option value="IN_FEED_LEADERBOARD">
                      Leaderboard In-Feed (1200×180 / 970×120)
                    </option>
                    <option value="ARTICLE_SIDEBAR">
                      Skyscraper Lateral en Lector (300×600)
                    </option>
                    <option value="ARTICLE_FOOTER">
                      Banner Pie de Artículo (728×90)
                    </option>
                    <option value="GRID_CARD">
                      Card Patrocinada 4:5 (Post visual)
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">
                    Segmentación por Categoría
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full bg-neutral-900 border border-white/10 p-2.5 text-xs text-white rounded-xl focus:outline-none focus:border-white/30"
                  >
                    <option value="TODAS">TODAS (Rotación general)</option>
                    {categories
                      .filter((c) => c !== "TODAS")
                      .map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Image URL & Preset selector */}
              <div>
                <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">
                  URL de Imagen del Banner *
                </label>
                <input
                  type="url"
                  required
                  value={formImageUrl}
                  onChange={(e) => setFormImageUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-neutral-900 border border-white/10 p-2.5 text-xs text-white rounded-xl focus:outline-none focus:border-white/30 font-mono mb-2"
                />

                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                  <span className="text-[10px] font-mono text-neutral-500 uppercase mr-1">
                    Presets:
                  </span>
                  {PRESET_AD_IMAGES.map((p) => (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => setFormImageUrl(p.url)}
                      className={`px-2 py-1 rounded text-[10px] font-mono transition-colors whitespace-nowrap cursor-pointer border ${
                        formImageUrl === p.url
                          ? "bg-white text-black font-bold border-white"
                          : "bg-neutral-900 text-neutral-400 border-white/10 hover:text-white"
                      }`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dates & Commercial Terms */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-mono uppercase text-neutral-400 mb-1">
                    Fecha Inicio
                  </label>
                  <input
                    type="date"
                    required
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                    className="w-full bg-neutral-900 border border-white/10 p-2 text-xs text-white rounded-xl focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono uppercase text-neutral-400 mb-1">
                    Fecha Fin
                  </label>
                  <input
                    type="date"
                    required
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                    className="w-full bg-neutral-900 border border-white/10 p-2 text-xs text-white rounded-xl focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono uppercase text-neutral-400 mb-1">
                    Precio ($ USD)
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={formPrice}
                    onChange={(e) => setFormPrice(Number(e.target.value))}
                    className="w-full bg-neutral-900 border border-white/10 p-2 text-xs text-white rounded-xl focus:outline-none font-mono"
                  />
                </div>
              </div>

              {/* Status Switch */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-900/60 border border-white/10">
                <div>
                  <div className="text-xs font-bold text-white">
                    Estado de la Campaña
                  </div>
                  <div className="text-[11px] text-neutral-400 font-light">
                    {formStatus === "ACTIVE"
                      ? "En emisión inmediata en la web"
                      : "En pausa (no visible)"}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setFormStatus(formStatus === "ACTIVE" ? "PAUSED" : "ACTIVE")
                  }
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border transition-colors ${
                    formStatus === "ACTIVE"
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                      : "bg-neutral-800 text-neutral-400 border-white/10"
                  }`}
                >
                  {formStatus === "ACTIVE" ? "Activa" : "Pausada"}
                </button>
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditorOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-neutral-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-white text-black hover:bg-neutral-200 font-bold text-xs uppercase tracking-wider rounded-xl shadow-md transition-colors"
                >
                  {editingCampaignId ? "Guardar Cambios" : "Lanzar Campaña"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RATE CARD & SPECS (Tarifario) */}
      {isRateCardOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-neutral-950 border border-white/15 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl space-y-5 my-8">
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white font-['Lexend']">
                  Tarifario Oficial & Especificaciones Técnicas
                </h3>
                <p className="text-xs text-neutral-400 font-light mt-0.5">
                  Espacios de patrocinio institucional disponibles en BlackNews.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsRateCardOpen(false)}
                className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 pt-0">
              <div className="divide-y divide-white/10">
                {Object.values(AD_PLACEMENTS_INFO).map((info) => (
                  <div
                    key={info.id}
                    className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-2">
                        <span>{info.name}</span>
                        <span className="text-[10px] font-mono uppercase text-neutral-500">
                          [{info.orientation}]
                        </span>
                      </div>
                      <p className="text-xs text-neutral-400 mt-0.5 font-light">
                        {info.description}
                      </p>
                      <div className="text-[10px] font-mono text-neutral-500 mt-1">
                        Tamaño recomendado:{" "}
                        <span className="text-neutral-300">
                          {info.recommendedSize}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-bold text-emerald-400 font-mono">
                        {info.suggestedRate}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 rounded-xl bg-neutral-900 border border-white/10 text-xs text-neutral-300 space-y-1.5 font-light">
                <div className="font-bold text-white text-xs uppercase tracking-wider font-mono">
                  Contacto para Anunciantes Corporativos
                </div>
                <p>
                  Para contrataciones personalizadas, patrocinios anuales o
                  convenios institucionales, comuníquese con la gerencia
                  editorial en:
                </p>
                <div className="font-mono text-white font-semibold">
                  blacknewsglobalmedia@gmail.com
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
