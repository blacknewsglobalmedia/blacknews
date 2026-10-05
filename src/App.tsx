/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { TopBar } from "./components/TopBar";
import { BreakingTicker } from "./components/BreakingTicker";
import { LeadStory } from "./components/LeadStory";
import { VisualPostsSection } from "./components/VisualPostsSection";
import { AdBanner } from "./components/AdBanner";
import { ReportsGrid } from "./components/ReportsGrid";
import { ReportDetailModal } from "./components/ReportDetailModal";
import { ShareModal } from "./components/ShareModal";
import { SearchBarModal } from "./components/SearchBarModal";
import { BookmarksDrawer } from "./components/BookmarksDrawer";
import { RedactionStudio } from "./components/RedactionStudio";
import { GoogleAuthModal } from "./components/GoogleAuthModal";
import { Footer } from "./components/Footer";
import { PoliciesPage } from "./components/PoliciesPage";
import { PoliciesNoticeBanner } from "./components/PoliciesNoticeBanner";
import { ReadingDock } from "./components/ReadingDock";
import { WorldClockBar } from "./components/WorldClockBar";
import { CreateAdModal } from "./components/CreateAdModal";
import { GeoMapSection } from "./components/GeoMapSection";
import { GlossaryShowcase } from "./components/GlossaryShowcase";
import { InstallPromo } from "./components/InstallPromo";
import { TrustSection } from "./components/TrustSection";
import { SubscriptionModal } from "./components/SubscriptionModal";
import { REPORTS, CATEGORIES, FLASH_NEWS, MOCK_REPORT_IDS, MOCK_FLASH_IDS, OLD_CATEGORY_ALIASES } from "./data/newsData";
import { Report, CategoryId, FlashNews } from "./types/news";
import { RedactorProfile, RedactorRole, GUEST_USER_ID } from "./types/auth";
import { FrontPageLayoutConfig, AutomationPreset } from "./types/layout";
import { AdCampaign, INITIAL_AD_CAMPAIGNS, MOCK_AD_IDS } from "./types/ads";
import {
  DEFAULT_LAYOUT_CONFIG,
  computeLayoutPreset,
} from "./utils/layoutUtils";
import { loadReadUsage, recordRead, computeReadMeter } from "./utils/readMeter";
import { fetchSubscriptionStatus, PLAN_NAMES, type PlanTier } from "./utils/paypalSubscription";
import { healPublishedAt } from "./utils/publishedAt";
import { db, auth, onAuthStateChanged, signOut } from "./firebase";
import {
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  collection,
  getDocs,
} from "firebase/firestore";

/** Evento beforeinstallprompt (Chrome/Edge/Android) para instalar la PWA. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

/**
 * SECURITY: single-admin rule. Only this account may hold the ADMIN role, and only
 * through a verified Google sign-in (see handleLoginWithGoogle). No quick-access or
 * test accounts are shipped to the public anymore.
 */
const OWNER_EMAIL = "blacknewsglobalmedia@gmail.com";

// Test accounts created during development: removed from the team and purged from any
// stored roster so they can never show up (or be signed in) again.
const LEGACY_TEST_EMAILS = [
  "editor.portada@blacknews.media",
  "mateo.valenzuela@blacknews.media",
  "carlos.velez@prensa-economica.com",
];

const isOwnerEmail = (email: string): boolean =>
  email.trim().toLowerCase() === OWNER_EMAIL;

// Demotes any stored profile that holds ADMIN without being the owner (legacy test data)
const enforceOwnerOnlyAdmin = (user: RedactorProfile): RedactorProfile => {
  if (user.role !== "ADMIN" || isOwnerEmail(user.email)) return user;
  return {
    ...user,
    role: "LECTOR",
    title: user.title === "Administrador" ? "Usuario Básico" : user.title,
    approvedAt: undefined,
  };
};

// Unauthenticated visitor: basic reader, no access to the internal panel
const GUEST_USER: RedactorProfile = {
  id: GUEST_USER_ID,
  name: "Lector Invitado",
  email: "lector.invitado@blacknews.media",
  role: "LECTOR",
  bureau: "Lector",
  title: "Invitado",
  requestedAt: "30 Sep 2026",
  avatarInitials: "LI",
  bio: "Lector no autenticado.",
  isGoogleAccount: false,
};

// Initial team: only the owner account exists, and it is the ADMIN
const INITIAL_REDACTORS: RedactorProfile[] = [
  {
    id: "usr-admin",
    name: "Administrador",
    email: OWNER_EMAIL,
    role: "ADMIN",
    bureau: "Zúrich / Central",
    title: "Administrador",
    requestedAt: "01 Ene 2026",
    approvedAt: "01 Ene 2026",
    avatarInitials: "ADM",
    bio: "Supervisión de la certidumbre jurídica, el libre mercado y la inviolabilidad de la propiedad privada.",
    isGoogleAccount: true,
  },
];

/** Una sola cuenta de visita por carga de página (StrictMode ejecuta los efectos dos veces en dev). */
let visitCountedThisLoad = false;

export default function App() {
  const [currentView, setCurrentView] = useState<
    "portada" | "redaccion" | "politicas"
  >(() => {
    // Deep-link de la página de políticas (?politicas o ?politicas=<n>)
    const params = new URLSearchParams(window.location.search);
    return params.has("politicas") ? "politicas" : "portada";
  });
  const [policiesSection, setPoliciesSection] = useState<number | null>(() => {
    const raw = new URLSearchParams(window.location.search).get("politicas");
    const n = raw ? Number.parseInt(raw, 10) : NaN;
    return Number.isFinite(n) && n > 0 ? n : null;
  });
  const [selectedCategory, setSelectedCategory] = useState<CategoryId>("TODAS");
  const [activeReport, setActiveReport] = useState<Report | null>(null);
  const [shareTargetReport, setShareTargetReport] = useState<Report | null>(
    null,
  );
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isBookmarksOpen, setIsBookmarksOpen] = useState(false);
  const [isGoogleAuthOpen, setIsGoogleAuthOpen] = useState(false);
  const [isAdModalOpen, setIsAdModalOpen] = useState(false);
  const [liveTickerActive, setLiveTickerActive] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Persistent reports list
  const [reportsList, setReportsList] = useState<Report[]>(() => {
    try {
      const saved = localStorage.getItem("blacknews_reports");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Depura los posts de muestra de versiones anteriores: solo queda contenido real.
          let categoryChanged = false;
          const cleaned = parsed
            .filter((r: Report) => r && !MOCK_REPORT_IDS.includes(r.id))
            .map((r: Report) => {
              // Corrige la fecha fija heredada del editor (ver utils/publishedAt)
              const healed = healPublishedAt(r);
              const renamed = OLD_CATEGORY_ALIASES[healed.category] ?? healed.category;
              if (renamed === healed.category) return healed;
              categoryChanged = true;
              return { ...healed, category: renamed };
            });
          if (categoryChanged || cleaned.length !== parsed.length) {
            localStorage.setItem("blacknews_reports", JSON.stringify(cleaned));
          }
          return cleaned;
        }
      }
    } catch {}
    return REPORTS;
  });

  // Persistent breaking news / teletipo
  const [flashNewsList, setFlashNewsList] = useState<FlashNews[]>(() => {
    try {
      const saved = localStorage.getItem("blacknews_flash_news");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Depura las alertas de muestra de versiones anteriores.
          const cleaned = parsed.filter(
            (f: FlashNews) => f && !MOCK_FLASH_IDS.includes(f.id),
          );
          if (cleaned.length !== parsed.length) {
            localStorage.setItem(
              "blacknews_flash_news",
              JSON.stringify(cleaned),
            );
          }
          return cleaned;
        }
      }
    } catch {}
    return FLASH_NEWS;
  });

  // Front page layout configuration
  const [layoutConfig, setLayoutConfig] = useState<FrontPageLayoutConfig>(
    () => {
      try {
        const saved = localStorage.getItem("blacknews_layout_config");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.leadReportId) return parsed;
        }
      } catch {}
      return DEFAULT_LAYOUT_CONFIG;
    },
  );

  // Persistent categories catalog
  const [categoriesList, setCategoriesList] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("blacknews_categories");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Catálogo antiguo sin personalizar → se sustituye por el estándar vigente.
          const legacyDefaults = [
            "TODAS",
            "ECONOMÍA & MERCADOS",
            "GEOPOLÍTICA",
            "TECNOLOGÍA & INNOVACIÓN",
            "DERECHO & PROPIEDAD",
            "ENERGÍA & INDUSTRIA",
            "DOSSIERS",
          ];
          const untouchedLegacy =
            parsed.length === legacyDefaults.length &&
            legacyDefaults.every((c) => parsed.includes(c));
          if (untouchedLegacy) {
            const fresh = [...CATEGORIES];
            try {
              localStorage.setItem("blacknews_categories", JSON.stringify(fresh));
            } catch {}
            return fresh;
          }
          // Lista personalizada: aplica renombres y descarta duplicados.
          const renamed = parsed
            .map((c: string) => OLD_CATEGORY_ALIASES[c] ?? c)
            .filter((c: string, i: number, arr: string[]) => arr.indexOf(c) === i);
          if (renamed.length > 0) {
            const next = JSON.stringify(renamed);
            if (next !== saved) {
              try {
                localStorage.setItem("blacknews_categories", next);
              } catch {}
            }
            return renamed;
          }
        }
      }
    } catch {}
    return [...CATEGORIES];
  });

  // Persistent Advertising Campaigns
  const [adsList, setAdsList] = useState<AdCampaign[]>(() => {
    try {
      const saved = localStorage.getItem("blacknews_ads");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Depura las campañas de muestra de versiones anteriores.
          const cleaned = parsed.filter(
            (c: AdCampaign) => c && !MOCK_AD_IDS.includes(c.id),
          );
          if (cleaned.length !== parsed.length) {
            localStorage.setItem("blacknews_ads", JSON.stringify(cleaned));
          }
          return cleaned;
        }
      }
    } catch {}
    return INITIAL_AD_CAMPAIGNS;
  });

  // Subscription state (BlackNews Digital Pass / Pro Terminal).
  // La suscripción vive en el servidor (PayPal + Workers KV): aquí SOLO se
  // consulta. Antes se concedía escribiendo localStorage — era el error
  // crítico que daba acceso de pago gratis a cualquiera.
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);

  const handleSaveCampaign = (campaign: AdCampaign) => {
    setAdsList((prev) => {
      const exists = prev.some((c) => c.id === campaign.id);
      const updated = exists
        ? prev.map((c) => (c.id === campaign.id ? campaign : c))
        : [campaign, ...prev];
      try {
        localStorage.setItem("blacknews_ads", JSON.stringify(updated));
      } catch {}
      return updated;
    });
    showToast(
      `Campaña "${campaign.title.slice(0, 20)}..." guardada con éxito.`,
    );
  };

  const handleDeleteCampaign = (campaignId: string) => {
    setAdsList((prev) => {
      const updated = prev.filter((c) => c.id !== campaignId);
      try {
        localStorage.setItem("blacknews_ads", JSON.stringify(updated));
      } catch {}
      return updated;
    });
    showToast("Campaña publicitaria retirada.");
  };

  const handleTrackImpression = (campaignId: string) => {
    setAdsList((prev) => {
      const updated = prev.map((c) =>
        c.id === campaignId
          ? { ...c, impressions: (c.impressions || 0) + 1 }
          : c,
      );
      try {
        localStorage.setItem("blacknews_ads", JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const handleTrackClick = (campaignId: string) => {
    setAdsList((prev) => {
      const updated = prev.map((c) =>
        c.id === campaignId ? { ...c, clicks: (c.clicks || 0) + 1 } : c,
      );
      try {
        localStorage.setItem("blacknews_ads", JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  // Persistent redactors and registered users management (always honoring the single-admin rule)
  const [redactorsList, setRedactorsList] = useState<RedactorProfile[]>(() => {
    try {
      const saved = localStorage.getItem("blacknews_redactors");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const sanitized = (parsed as RedactorProfile[])
            .filter(
              (user) =>
                !LEGACY_TEST_EMAILS.includes(user.email.trim().toLowerCase()),
            )
            .map(enforceOwnerOnlyAdmin);
          if (sanitized.length > 0) return sanitized;
        }
      }
    } catch {}
    return INITIAL_REDACTORS;
  });

  // Current active user: restored from persistent storage on F5 refresh.
  // Verified Google sign-in maintains state automatically.
  const [currentUser, setCurrentUser] = useState<RedactorProfile>(() => {
    try {
      const saved = localStorage.getItem("blacknews_active_user");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.email) return parsed;
      }
    } catch {}
    return GUEST_USER;
  });

  // Estado de suscripción: consultado al servidor por cuenta (PayPal + KV).
  useEffect(() => {
    // Clave heredada de la vieja concesión gratuita: se ignora y se purga.
    try {
      localStorage.removeItem("blacknews_subscription");
    } catch {}
    // Estado por defecto: sin cuenta no hay suscripción (antes se quedaba
    // el valor de la sesión anterior al cerrar sesión).
    setIsSubscribed(false);
    if (!currentUser.email || currentUser.id === GUEST_USER_ID) return;
    let alive = true;
    fetchSubscriptionStatus(currentUser.email)
      .then((s) => {
        if (alive) setIsSubscribed(s.active);
      })
      .catch(() => {
        /* sin conexión se mantiene la cuota gratuita */
      });
    return () => {
      alive = false;
    };
  }, [currentUser]);

  // Cuota de lecturas gratuitas con reinicio diario:
  // invitado 2 · registrado 3 · suscriptores y redacción sin límite
  const [readUsage, setReadUsage] = useState(loadReadUsage);
  const readMeter = computeReadMeter(readUsage, {
    isSubscribed,
    isGuest: currentUser.id === GUEST_USER_ID,
    isStaff: currentUser.role !== "LECTOR",
  });

  /** Anota la lectura de un artículo (no cuenta si la cuota es ilimitada). */
  const countArticleRead = (report: Report) => {
    if (readMeter.unlimited) return;
    setReadUsage((prev) => recordRead(prev, report.id));
  };

  // Contenido publicado: Firestore es la fuente de verdad para todos los
  // navegadores (en una pestaña de incógnito no existe la copia local).
  // Se recupera en segundo plano al arrancar; si algo falla (sin red o sin
  // permisos) se mantiene lo que haya en este dispositivo.
  useEffect(() => {
    let alive = true;

    const pullReports = async () => {
      try {
        const snap = await getDocs(collection(db, "reports"));
        if (!alive) return;
        const remote = snap.docs
          .map((d) => healPublishedAt({ ...(d.data() as Report), id: d.id }))
          .filter(
            (r) =>
              r && typeof r.title === "string" && !MOCK_REPORT_IDS.includes(r.id),
          )
          // Los ids llevan marca de tiempo (rep-custom-<ms>): lo más reciente primero
          .sort((a, b) => b.id.localeCompare(a.id));
        if (remote.length === 0) return;
        setReportsList(remote);
        try {
          localStorage.setItem("blacknews_reports", JSON.stringify(remote));
        } catch {}
      } catch {
        /* sin conexión: sigue mandando la copia local */
      }
    };

    const pullFlashNews = async () => {
      try {
        const snap = await getDoc(doc(db, "settings", "flash_news"));
        if (!alive || !snap.exists()) return;
        const items = (snap.data() as { items?: FlashNews[] }).items;
        if (!Array.isArray(items)) return;
        setFlashNewsList(items);
        try {
          localStorage.setItem("blacknews_flash_news", JSON.stringify(items));
        } catch {}
      } catch {}
    };

    const pullCategories = async () => {
      try {
        const snap = await getDoc(doc(db, "settings", "categories"));
        if (!alive || !snap.exists()) return;
        const cats = (snap.data() as { categories?: string[] }).categories;
        if (!Array.isArray(cats) || cats.length === 0) return;
        setCategoriesList(cats);
        try {
          localStorage.setItem("blacknews_categories", JSON.stringify(cats));
        } catch {}
      } catch {}
    };

    const pullFrontLayout = async () => {
      try {
        const snap = await getDoc(doc(db, "settings", "frontpage_layout"));
        if (!alive || !snap.exists()) return;
        const cfg = snap.data() as FrontPageLayoutConfig;
        if (!cfg || typeof cfg.leadReportId !== "string") return;
        setLayoutConfig(cfg);
        try {
          localStorage.setItem("blacknews_layout_config", JSON.stringify(cfg));
        } catch {}
      } catch {}
    };

    void Promise.all([
      pullReports(),
      pullFlashNews(),
      pullCategories(),
      pullFrontLayout(),
    ]);

    return () => {
      alive = false;
    };
  }, []);

  // Automatically verify and maintain Firebase Auth session across F5 page reloads
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser && firebaseUser.email) {
        const email = firebaseUser.email;
        const name = firebaseUser.displayName || "Usuario Google";
        handleLoginWithGoogle(
          email,
          name,
          isOwnerEmail(email) ? "Zúrich / Central" : "Lector Registrado",
          isOwnerEmail(email) ? "Administrador" : "Usuario Básico",
          true,
        );
      }
    });
    return () => unsubscribe();
  }, []);

  // Persist the sanitized roster on mount so legacy test accounts and non-owner ADMIN
  // entries are really purged from the browser storage.
  useEffect(() => {
    try {
      const saved = localStorage.getItem("blacknews_redactors");
      if (saved && saved !== JSON.stringify(redactorsList)) {
        localStorage.setItem(
          "blacknews_redactors",
          JSON.stringify(redactorsList),
        );
      }
    } catch {}
  }, []);

  // Persistent bookmarks
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem("blacknews_bookmarks");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Modo ligero: ocultar imágenes para leer solo texto (conexiones lentas)
  const [liteMode, setLiteMode] = useState(
    () => localStorage.getItem("blacknews_lite") === "1",
  );
  useEffect(() => {
    document.body.classList.toggle("bn-lite", liteMode);
    try {
      localStorage.setItem("blacknews_lite", liteMode ? "1" : "0");
    } catch {}
  }, [liteMode]);

  // Métrica local: visitas de este dispositivo (visible en Servicio y Límites del panel admin)
  useEffect(() => {
    if (visitCountedThisLoad) return;
    visitCountedThisLoad = true;
    try {
      const prev = parseInt(localStorage.getItem("blacknews_device_visits") || "0", 10) || 0;
      localStorage.setItem("blacknews_device_visits", String(prev + 1));
    } catch {}
  }, []);

  // PWA: instalación desde el navegador (beforeinstallprompt)
  const [installEvt, setInstallEvt] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [isStandalone, setStandalone] = useState(
    () =>
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone ===
        true,
  );
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallEvt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstallEvt(null);
      setStandalone(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const handleInstallPWA = async () => {
    if (!installEvt) return;
    try {
      await installEvt.prompt();
      const choice = await installEvt.userChoice;
      if (choice.outcome) setInstallEvt(null);
    } catch {}
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Sync Layout Config
  const handleUpdateLayoutConfig = async (newConfig: FrontPageLayoutConfig) => {
    const finalizedConfig: FrontPageLayoutConfig = {
      ...newConfig,
      lastModifiedTimestamp: newConfig.lastModifiedTimestamp ?? Date.now(),
      autoRefreshHours: newConfig.autoRefreshHours ?? 24,
      autoRefreshPolicy: newConfig.autoRefreshPolicy ?? "auto-latest",
      autoRefreshEnabled: newConfig.autoRefreshEnabled !== false,
    };
    setLayoutConfig(finalizedConfig);
    try {
      localStorage.setItem(
        "blacknews_layout_config",
        JSON.stringify(finalizedConfig),
      );
      await setDoc(doc(db, "settings", "frontpage_layout"), finalizedConfig);
    } catch (err) {
      console.warn("[BLACKNEWS] Local storage backup saved for layout config");
    }
    showToast(
      `Distribución de portada: [${finalizedConfig.automationPreset.toUpperCase()}]`,
    );
  };

  // Apply automation preset with 1 click
  const handleAutomationApply = (preset: AutomationPreset) => {
    const computed = computeLayoutPreset(preset, reportsList, layoutConfig);
    handleUpdateLayoutConfig(computed);
  };

  // Auto-expiration & rotation timer check (e.g. 24h cycle)
  useEffect(() => {
    const checkAutoRotation = () => {
      if (layoutConfig.autoRefreshEnabled === false) return;
      const intervalHours = layoutConfig.autoRefreshHours || 24;
      const intervalMs = intervalHours * 60 * 60 * 1000;
      const lastTimestamp = layoutConfig.lastModifiedTimestamp || Date.now();
      const elapsed = Date.now() - lastTimestamp;

      if (elapsed >= intervalMs) {
        // Expiration threshold exceeded without manual edit!
        const policy = layoutConfig.autoRefreshPolicy || "auto-latest";
        const refreshed = computeLayoutPreset(
          policy,
          reportsList,
          layoutConfig,
        );
        const now = new Date();
        const dateStr = now.toLocaleDateString("es-ES", {
          day: "2-digit",
          month: "short",
        });
        refreshed.lastUpdated = `${dateStr} · Rotación Automática (${intervalHours}h)`;
        refreshed.lastModifiedTimestamp = Date.now();
        refreshed.automationPreset = policy;
        handleUpdateLayoutConfig(refreshed);
        showToast(
          `Portada rotada automáticamente con nuevas publicaciones (Ciclo de ${intervalHours}h cumplido)`,
        );
      }
    };

    // Run check once and schedule periodic check
    checkAutoRotation();
    const intervalId = setInterval(checkAutoRotation, 60000);
    return () => clearInterval(intervalId);
  }, [layoutConfig, reportsList]);

  // Update breaking ticker news
  const handleUpdateFlashNews = async (updatedFlash: FlashNews[]) => {
    setFlashNewsList(updatedFlash);
    try {
      localStorage.setItem(
        "blacknews_flash_news",
        JSON.stringify(updatedFlash),
      );
      await setDoc(doc(db, "settings", "flash_news"), { items: updatedFlash });
    } catch (err) {
      console.warn("[BLACKNEWS] Local storage backup saved for flash news");
    }
    showToast("Teletipo de última hora actualizado");
  };

  // Update categories catalog
  const handleUpdateCategories = async (newCategories: string[]) => {
    setCategoriesList(newCategories);
    try {
      localStorage.setItem(
        "blacknews_categories",
        JSON.stringify(newCategories),
      );
      await setDoc(doc(db, "settings", "categories"), {
        categories: newCategories,
      });
    } catch (err) {
      console.warn("[BLACKNEWS] Local storage backup saved for categories");
    }
    showToast("Catálogo de categorías actualizado");
  };

  // URL Deeplinking: detect ?informe=id on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reportIdFromUrl = params.get("informe");
    if (reportIdFromUrl) {
      const found = reportsList.find((r) => r.id === reportIdFromUrl);
      if (found) {
        countArticleRead(found);
        setActiveReport(found);
      }
    }
  }, [reportsList]);

  // Sync URL when active report changes
  const handleOpenReport = (report: Report) => {
    countArticleRead(report);
    setActiveReport(report);
    const newUrl = `${window.location.pathname}?informe=${encodeURIComponent(report.id)}`;
    window.history.pushState({ reportId: report.id }, "", newUrl);
  };

  const handleCloseReport = () => {
    setActiveReport(null);
    window.history.pushState({}, "", window.location.pathname);
  };

  // Página de políticas (vista completa con deep-link ?politicas=<n>)
  const handleOpenPolicies = (section?: number) => {
    setPoliciesSection(section ?? null);
    setCurrentView("politicas");
    const suffix =
      typeof section === "number" && section > 0
        ? `?politicas=${section}`
        : "?politicas";
    window.history.pushState(
      { policies: section ?? true },
      "",
      `${window.location.pathname}${suffix}`,
    );
    window.scrollTo({ top: 0 });
  };

  const handleClosePolicies = () => {
    setPoliciesSection(null);
    setCurrentView("portada");
    window.history.pushState({}, "", window.location.pathname);
    window.scrollTo({ top: 0 });
  };

  // Bookmark toggling
  const handleToggleBookmark = (report: Report) => {
    setBookmarkedIds((prev) => {
      const next = new Set(prev);
      if (next.has(report.id)) {
        next.delete(report.id);
        showToast("Informe retirado de lecturas guardadas");
      } else {
        next.add(report.id);
        showToast("Informe añadido a lecturas guardadas");
      }
      try {
        localStorage.setItem(
          "blacknews_bookmarks",
          JSON.stringify(Array.from(next)),
        );
      } catch {}
      return next;
    });
  };

  const handleRemoveBookmark = (reportId: string) => {
    setBookmarkedIds((prev) => {
      const next = new Set(prev);
      next.delete(reportId);
      try {
        localStorage.setItem(
          "blacknews_bookmarks",
          JSON.stringify(Array.from(next)),
        );
      } catch {}
      return next;
    });
    showToast("Informe eliminado");
  };

  const handleClearAllBookmarks = () => {
    setBookmarkedIds(new Set());
    try {
      localStorage.removeItem("blacknews_bookmarks");
    } catch {}
    showToast("Lista de lectura vaciada");
  };

  // Publishing a new report
  const handlePublishReport = async (newReport: Report) => {
    const updated = [newReport, ...reportsList];
    setReportsList(updated);
    try {
      localStorage.setItem("blacknews_reports", JSON.stringify(updated));
      await setDoc(doc(db, "reports", newReport.id), newReport);
    } catch (err) {
      console.warn("[BLACKNEWS] Local storage backup saved for report");
    }
    showToast(`¡"${newReport.title.slice(0, 38)}..." publicado en portada!`);
  };

  // Updating an existing report (only author or admin)
  const handleUpdateExistingReport = async (updatedReport: Report) => {
    const updated = reportsList.map((r) =>
      r.id === updatedReport.id ? updatedReport : r,
    );
    setReportsList(updated);
    try {
      localStorage.setItem("blacknews_reports", JSON.stringify(updated));
      await setDoc(doc(db, "reports", updatedReport.id), updatedReport);
    } catch (err) {
      console.warn("[BLACKNEWS] Local storage backup saved for updated report");
    }
    showToast(`¡Informe "${updatedReport.title.slice(0, 32)}..." actualizado!`);
  };

  // Deleting a report (author or admin)
  const handleDeleteReport = async (id: string) => {
    const updated = reportsList.filter((r) => r.id !== id);
    setReportsList(updated);
    try {
      localStorage.setItem("blacknews_reports", JSON.stringify(updated));
      // Retira también la copia remota: sin esto la noticia volvería a
      // aparecer en los demás navegadores al sincronizar al arrancar.
      await deleteDoc(doc(db, "reports", id));
    } catch {}
    showToast("Informe retirado de portada");
  };

  // Assign user role (ADMIN, MODERADOR, REDACTOR, LECTOR)
  const handleChangeUserRole = (userId: string, newRole: RedactorRole) => {
    const target = redactorsList.find((member) => member.id === userId);
    // Single-admin rule: ADMIN can only ever be held by the owner email
    const safeRole: RedactorRole =
      newRole === "ADMIN" && target && !isOwnerEmail(target.email)
        ? "LECTOR"
        : newRole;

    const updated = redactorsList.map((member) => {
      if (member.id === userId) {
        return {
          ...member,
          role: safeRole,
          approvedAt:
            safeRole !== "LECTOR"
              ? member.approvedAt || "30 Sep 2026"
              : undefined,
        };
      }
      return member;
    });
    setRedactorsList(updated);
    try {
      localStorage.setItem("blacknews_redactors", JSON.stringify(updated));
    } catch {}

    if (currentUser.id === userId) {
      setCurrentUser((prev) => ({ ...prev, role: safeRole }));
    }
    showToast(`Permisos actualizados: ${safeRole}`);
  };

  // Approvals Management
  const handleApproveRedactor = (id: string) => {
    handleChangeUserRole(id, "REDACTOR");
    showToast("Habilitado como Redactor (edición solo a sus post)");
  };

  const handleRejectRedactor = (id: string) => {
    handleChangeUserRole(id, "LECTOR");
    showToast("Permisos revocados a usuario Lector");
  };

  const handleRegisterRedactor = (
    candidate: Omit<
      RedactorProfile,
      "id" | "role" | "requestedAt" | "avatarInitials"
    >,
  ) => {
    const initials = candidate.name
      .split(" ")
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();

    // Regular registrations are always basic readers without editing capabilities
    const newProfile: RedactorProfile = {
      ...candidate,
      id: `usr-${Date.now()}`,
      role: "LECTOR",
      requestedAt: "30 Sep 2026",
      avatarInitials: initials || "US",
      isGoogleAccount: false,
    };

    const updated = [...redactorsList, newProfile];
    setRedactorsList(updated);
    try {
      localStorage.setItem("blacknews_redactors", JSON.stringify(updated));
    } catch {}
    setCurrentUser(newProfile);
    showToast("Cuenta registrada como Lector básico. Solicitud enviada.");
  };

  // Google Login and Registration Handler.
  // `verified` is true ONLY when the session comes from a real Firebase Google sign-in:
  // that is the single flow capable of restoring or granting editorial roles.
  const handleLoginWithGoogle = (
    email: string,
    name: string,
    bureau: string = "Lector Registrado",
    title: string = "Usuario Básico",
    verified: boolean = false,
  ) => {
    const initials =
      name
        .split(" ")
        .map((w) => w[0])
        .slice(0, 2)
        .join("")
        .toUpperCase() || "US";

    const existing = redactorsList.find(
      (u) => u.email.toLowerCase() === email.toLowerCase(),
    );

    // Manual (unverified) registration: always a basic reader, never inherits editorial roles
    if (!verified) {
      const readerProfile: RedactorProfile =
        existing && existing.role === "LECTOR"
          ? existing
          : {
              id: `usr-manual-${Date.now()}`,
              name,
              email,
              role: "LECTOR",
              bureau: "Lector Registrado",
              title: "Usuario Básico",
              avatarInitials: initials,
              requestedAt: "30 Sep 2026",
              isGoogleAccount: false,
            };

      if (!existing) {
        const updated = [readerProfile, ...redactorsList];
        setRedactorsList(updated);
        try {
          localStorage.setItem("blacknews_redactors", JSON.stringify(updated));
        } catch {}
      }

      setCurrentUser(readerProfile);
      showToast(
        existing && existing.role !== "LECTOR"
          ? "Permisos editoriales en pausa: verifica tu identidad con Google para activarlos."
          : "Cuenta registrada como Lector básico. Solicitud enviada.",
      );
      return;
    }

    // Verified Google session: only the owner email becomes/keeps ADMIN
    const nextProfile: RedactorProfile = existing
      ? isOwnerEmail(email)
        ? { ...existing, role: "ADMIN" }
        : enforceOwnerOnlyAdmin(existing)
      : {
          id: `usr-google-${Date.now()}`,
          name,
          email,
          role: isOwnerEmail(email) ? "ADMIN" : "LECTOR",
          bureau,
          title,
          avatarInitials: initials,
          requestedAt: "30 Sep 2026",
          approvedAt: isOwnerEmail(email) ? "30 Sep 2026" : undefined,
          isGoogleAccount: true,
        };

    const roleChanged = !existing || nextProfile.role !== existing.role;
    if (roleChanged) {
      const updated = existing
        ? redactorsList.map((u) => (u.id === existing.id ? nextProfile : u))
        : [nextProfile, ...redactorsList];
      setRedactorsList(updated);
      try {
        localStorage.setItem("blacknews_redactors", JSON.stringify(updated));
      } catch {}
    }

    setCurrentUser(nextProfile);
    try {
      localStorage.setItem(
        "blacknews_active_user",
        JSON.stringify(nextProfile),
      );
    } catch {}
    showToast(
      `Sesión verificada con Google: ${nextProfile.name} [${nextProfile.role}]`,
    );
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch {}
    setCurrentUser(GUEST_USER);
    setCurrentView("portada");
    try {
      localStorage.removeItem("blacknews_active_user");
    } catch {}
    showToast("Sesión cerrada. Modo Lector activado.");
  };

  // Sharing handling
  const handleOpenShare = (report: Report | null) => {
    setShareTargetReport(report);
    setIsShareModalOpen(true);
  };

  // Category Filtering
  const filteredReports =
    selectedCategory === "TODAS"
      ? reportsList
      : reportsList.filter((r) => r.category === selectedCategory);

  // Layout slots computed for 'TODAS'
  const configuredLead =
    reportsList.find((r) => r.id === layoutConfig.leadReportId) ||
    reportsList[0];
  const configuredBlock1 = layoutConfig.block1ReportIds
    .map((id) => reportsList.find((r) => r.id === id))
    .filter((r): r is Report => Boolean(r));
  const configuredBlock2 = layoutConfig.block2ReportIds
    .map((id) => reportsList.find((r) => r.id === id))
    .filter((r): r is Report => Boolean(r));
  const configuredDossier = reportsList.find(
    (r) => r.id === layoutConfig.dossierReportId,
  );

  // Active Lead story for the top position
  const leadReport =
    selectedCategory === "TODAS" ? configuredLead : filteredReports[0];

  const secondaryReports =
    selectedCategory === "TODAS"
      ? reportsList.filter((r) => r.id !== leadReport?.id)
      : filteredReports.slice(1);

  // Check whether current user has editorial privileges to access internal media studio
  const canAccessInternalMedia = Boolean(
    currentUser && currentUser.role !== "LECTOR",
  );

  // Strict security guard: redirect away from redaccion immediately if user is LECTOR
  useEffect(() => {
    if (!canAccessInternalMedia && currentView === "redaccion") {
      setCurrentView("portada");
    }
  }, [canAccessInternalMedia, currentView]);

  const handleToggleStudio = () => {
    if (!canAccessInternalMedia) {
      showToast("Acceso restringido a la sala interna de redacción.");
      return;
    }
    setCurrentView(currentView === "redaccion" ? "portada" : "redaccion");
  };

  const savedReportsList = reportsList.filter((r) => bookmarkedIds.has(r.id));

  return (
    <div className="min-h-screen bg-black text-[#EDEDED] font-['Lexend',sans-serif] selection:bg-white selection:text-black flex flex-col justify-between">
      {/* Toast notification banner */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-white text-black px-4 py-2.5 text-xs font-sans font-medium tracking-normal rounded-lg border border-neutral-200 shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <span className="w-1.5 h-1.5 rounded-full bg-black inline-block"></span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Aviso de políticas a todos los visitantes (si hay versión nueva) */}
      <PoliciesNoticeBanner onOpenPolicies={() => handleOpenPolicies()} />

      {/* Top Navigation */}
      <TopBar
        categories={categoriesList}
        selectedCategory={selectedCategory}
        onSelectCategory={(cat) => {
          setSelectedCategory(cat);
          setCurrentView("portada");
        }}
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenBookmarks={() => setIsBookmarksOpen(true)}
        bookmarksCount={bookmarkedIds.size}
        onShareSite={() => handleOpenShare(null)}
        liveTickerActive={liveTickerActive}
        onToggleLiveTicker={() => setLiveTickerActive(!liveTickerActive)}
        onOpenStudio={handleToggleStudio}
        isStudioOpen={currentView === "redaccion" && canAccessInternalMedia}
        currentUser={currentUser}
        onOpenGoogleAuth={() => setIsGoogleAuthOpen(true)}
        liteMode={liteMode}
        onToggleLite={() => setLiteMode((v) => !v)}
      />

      {/* Real-time breaking ticker */}
      {liveTickerActive && currentView === "portada" && (
        <BreakingTicker
          news={flashNewsList}
          onSelectNews={(repId) => {
            if (repId) {
              const r = reportsList.find((item) => item.id === repId);
              if (r) handleOpenReport(r);
            }
          }}
        />
      )}

      {/* Main View Switcher */}
      <main className="flex-1">
        {currentView === "politicas" ? (
          <PoliciesPage
            onBack={handleClosePolicies}
            initialSection={policiesSection}
          />
        ) : currentView === "redaccion" && canAccessInternalMedia ? (
          <RedactionStudio
            onBackToNews={() => setCurrentView("portada")}
            onPublishReport={handlePublishReport}
            onUpdateExistingReport={handleUpdateExistingReport}
            currentUser={currentUser}
            allRedactors={redactorsList}
            onApproveRedactor={handleApproveRedactor}
            onRejectRedactor={handleRejectRedactor}
            onChangeUserRole={handleChangeUserRole}
            onRegisterRedactor={handleRegisterRedactor}
            publishedReports={reportsList}
            onDeleteReport={handleDeleteReport}
            layoutConfig={layoutConfig}
            onUpdateLayoutConfig={handleUpdateLayoutConfig}
            flashNews={flashNewsList}
            onUpdateFlashNews={handleUpdateFlashNews}
            onAutomationApply={handleAutomationApply}
            onOpenGoogleAuth={() => setIsGoogleAuthOpen(true)}
            categories={categoriesList}
            onUpdateCategories={handleUpdateCategories}
            adCampaigns={adsList}
            onSaveAdCampaign={handleSaveCampaign}
            onDeleteAdCampaign={handleDeleteCampaign}
          />
        ) : (
          <>
            {/* Top Billboard Sponsor Banner (los suscriptores no ven publicidad) */}
            {!isSubscribed && (
              <AdBanner
                placement="TOP_BILLBOARD"
                campaigns={adsList}
                selectedCategory={selectedCategory}
                onTrackImpression={handleTrackImpression}
                onTrackClick={handleTrackClick}
              />
            )}

            {leadReport && (
              <>
                <LeadStory
                  report={leadReport}
                  onRead={handleOpenReport}
                  onShare={handleOpenShare}
                  isBookmarked={bookmarkedIds.has(leadReport.id)}
                  onToggleBookmark={handleToggleBookmark}
                />
              </>
            )}

            <GeoMapSection
              reports={reportsList}
              categories={categoriesList}
              onOpenReport={handleOpenReport}
              onOpenSubscriptionModal={() => setIsSubscriptionModalOpen(true)}
              meter={readMeter}
            />

            {/* Visual Posts Section: News cards in 4:5 post format */}
            <VisualPostsSection
              reports={reportsList}
              categories={categoriesList}
              onReadReport={handleOpenReport}
              onShareReport={handleOpenShare}
              bookmarkedIds={bookmarkedIds}
              onToggleBookmark={handleToggleBookmark}
              onOpenInStudio={
                canAccessInternalMedia
                  ? (report) => {
                      setCurrentView("redaccion");
                      showToast(
                        `Despacho "${report.title.slice(0, 25)}..." cargado para edición`,
                      );
                    }
                  : undefined
              }
            />

            {/* In-Feed Leaderboard Horizontal Banner (los suscriptores no ven publicidad) */}
            {!isSubscribed && (
              <AdBanner
                placement="IN_FEED_LEADERBOARD"
                campaigns={adsList}
                selectedCategory={selectedCategory}
                onTrackImpression={handleTrackImpression}
                onTrackClick={handleTrackClick}
              />
            )}

            <ReportsGrid
              reports={secondaryReports}
              categories={categoriesList}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
              onReadReport={handleOpenReport}
              onShareReport={handleOpenShare}
              bookmarkedIds={bookmarkedIds}
              onToggleBookmark={handleToggleBookmark}
              configuredBlock1={
                selectedCategory === "TODAS" ? configuredBlock1 : undefined
              }
              configuredBlock2={
                selectedCategory === "TODAS" ? configuredBlock2 : undefined
              }
              configuredDossier={
                selectedCategory === "TODAS" ? configuredDossier : undefined
              }
            />
            <GlossaryShowcase />
            {!isStandalone && (
              <InstallPromo
                reports={reportsList}
                installAvailable={installEvt !== null}
                onInstall={handleInstallPWA}
              />
            )}
            <TrustSection reports={reportsList} />
          </>
        )}
      </main>

      {/* Footer */}
      <Footer
        categories={categoriesList}
        onSelectCategory={(cat) => {
          setSelectedCategory(cat);
          setCurrentView("portada");
        }}
        onShareSite={() => handleOpenShare(null)}
        onOpenAdModal={() => setIsAdModalOpen(true)}
        onOpenPolicies={handleOpenPolicies}
      />

      {/* Deep Report Reader Modal */}
      <ReportDetailModal
        report={activeReport}
        isOpen={activeReport !== null}
        onClose={handleCloseReport}
        onShare={handleOpenShare}
        isBookmarked={activeReport ? bookmarkedIds.has(activeReport.id) : false}
        onToggleBookmark={handleToggleBookmark}
        onSelectReport={handleOpenReport}
        allReports={reportsList}
        adCampaigns={adsList}
        onTrackImpression={handleTrackImpression}
        onTrackClick={handleTrackClick}
        readExhausted={readMeter.exhausted}
        readLimit={readMeter.limit}
        onOpenSubscription={() => setIsSubscriptionModalOpen(true)}
      />

      {/* Social Media Sharing Modal */}
      <ShareModal
        report={shareTargetReport}
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
      />

      {/* Real-time Search Modal */}
      <SearchBarModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        reports={reportsList}
        onSelectReport={handleOpenReport}
      />

      {/* Reading List Drawer */}
      <BookmarksDrawer
        isOpen={isBookmarksOpen}
        onClose={() => setIsBookmarksOpen(false)}
        savedReports={savedReportsList}
        onSelectReport={handleOpenReport}
        onRemoveBookmark={handleRemoveBookmark}
        onClearAll={handleClearAllBookmarks}
      />

      {/* Google Authentication & Roles Modal */}
      <GoogleAuthModal
        isOpen={isGoogleAuthOpen}
        onClose={() => setIsGoogleAuthOpen(false)}
        currentUser={currentUser}
        onLoginWithGoogle={handleLoginWithGoogle}
        onLogout={handleLogout}
        onOpenStudio={handleToggleStudio}
      />

      {/* Self-Service Advertising Modal */}
      <CreateAdModal
        isOpen={isAdModalOpen}
        onClose={() => setIsAdModalOpen(false)}
        currentUser={currentUser}
        onOpenGoogleAuth={() => setIsGoogleAuthOpen(true)}
        onSubmitAdCampaign={(campaign) => {
          handleSaveCampaign(campaign);
          showToast(
            "Tu anuncio fue enviado a revisión. El equipo lo aprobará en breve.",
          );
        }}
      />

      {/* Subscription Plans Modal */}
      <SubscriptionModal
        isOpen={isSubscriptionModalOpen}
        onClose={() => setIsSubscriptionModalOpen(false)}
        currentUser={currentUser}
        onOpenGoogleAuth={() => {
          setIsSubscriptionModalOpen(false);
          setIsGoogleAuthOpen(true);
        }}
        onSubscribeSuccess={(planId) => {
          setIsSubscribed(true);
          showToast(
            `Suscripción ${
              PLAN_NAMES[planId as PlanTier] ?? planId
            } activada. Lecturas ilimitadas desbloqueadas.`,
          );
        }}
        onStatusChange={(active) => {
          setIsSubscribed(active);
          if (!active) {
            showToast("Suscripción cancelada. Ya no habrá más cobros.");
          }
        }}
      />

      {/* Barra flotante inferior: cuota de lecturas del día + volver arriba */}
      {currentView !== "redaccion" && (
        <ReadingDock
          meter={readMeter}
          onOpenSubscription={() => setIsSubscriptionModalOpen(true)}
        />
      )}

      {/* Relojes del mundo: marquee pegado al borde inferior, en todo el sitio */}
      <WorldClockBar />
    </div>
  );
}
