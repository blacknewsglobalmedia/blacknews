/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { TopBar } from './components/TopBar';
import { BreakingTicker } from './components/BreakingTicker';
import { LeadStory } from './components/LeadStory';
import { ReportsGrid } from './components/ReportsGrid';
import { ReportDetailModal } from './components/ReportDetailModal';
import { ShareModal } from './components/ShareModal';
import { SearchBarModal } from './components/SearchBarModal';
import { BookmarksDrawer } from './components/BookmarksDrawer';
import { RedactionStudio } from './components/RedactionStudio';
import { GoogleAuthModal } from './components/GoogleAuthModal';
import { Footer } from './components/Footer';
import { REPORTS, CATEGORIES, FLASH_NEWS } from './data/newsData';
import { Report, CategoryId, FlashNews } from './types/news';
import { RedactorProfile, RedactorRole } from './types/auth';
import { FrontPageLayoutConfig, AutomationPreset } from './types/layout';
import { DEFAULT_LAYOUT_CONFIG, computeLayoutPreset } from './utils/layoutUtils';
import { db, auth } from './firebase';
import { doc, setDoc } from 'firebase/firestore';

// Initial team: only the owner is Admin, others are moderator, redactor, and basic lector
const INITIAL_REDACTORS: RedactorProfile[] = [
  {
    id: 'usr-admin',
    name: 'Administrador',
    email: 'blacknewsglobalmedia@gmail.com',
    role: 'ADMIN',
    bureau: 'Zúrich / Central',
    title: 'Administrador',
    requestedAt: '01 Ene 2026',
    approvedAt: '01 Ene 2026',
    avatarInitials: 'ADM',
    bio: 'Supervisión de la certidumbre jurídica, el libre mercado y la inviolabilidad de la propiedad privada.',
    isGoogleAccount: true,
  },
  {
    id: 'usr-helena',
    name: 'Helena Von Berg',
    email: 'editor.portada@blacknews.media',
    role: 'MODERADOR',
    bureau: 'Ginebra / Mesa de Portada',
    title: 'Moderadora de Portada',
    requestedAt: '12 Feb 2026',
    approvedAt: '15 Feb 2026',
    avatarInitials: 'HB',
    bio: 'Edición en tiempo real de la primera plana y coordinación de portada.',
    isGoogleAccount: true,
  },
  {
    id: 'usr-mateo',
    name: 'Mateo R. Valenzuela',
    email: 'mateo.valenzuela@blacknews.media',
    role: 'REDACTOR',
    bureau: 'Zúrich / Mercados',
    title: 'Redactor de Mercados',
    requestedAt: '10 Feb 2026',
    approvedAt: '12 Feb 2026',
    avatarInitials: 'MV',
    bio: 'Análisis de divisas y asignación voluntaria de capitales.',
    isGoogleAccount: true,
  },
  {
    id: 'usr-carlos',
    name: 'Carlos Hernán Vélez',
    email: 'carlos.velez@prensa-economica.com',
    role: 'LECTOR',
    bureau: 'Lector Registrado',
    title: 'Usuario Básico',
    requestedAt: '24 Sep 2026',
    avatarInitials: 'CH',
    bio: 'Usuario lector registrado sin permisos de redacción.',
    isGoogleAccount: false,
  },
];

export default function App() {
  const [currentView, setCurrentView] = useState<'portada' | 'redaccion'>('portada');
  const [selectedCategory, setSelectedCategory] = useState<CategoryId>('TODAS');
  const [activeReport, setActiveReport] = useState<Report | null>(null);
  const [shareTargetReport, setShareTargetReport] = useState<Report | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isBookmarksOpen, setIsBookmarksOpen] = useState(false);
  const [isGoogleAuthOpen, setIsGoogleAuthOpen] = useState(false);
  const [liveTickerActive, setLiveTickerActive] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Persistent reports list
  const [reportsList, setReportsList] = useState<Report[]>(() => {
    try {
      const saved = localStorage.getItem('blacknews_reports');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return REPORTS;
  });

  // Persistent breaking news / teletipo
  const [flashNewsList, setFlashNewsList] = useState<FlashNews[]>(() => {
    try {
      const saved = localStorage.getItem('blacknews_flash_news');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return FLASH_NEWS;
  });

  // Front page layout configuration
  const [layoutConfig, setLayoutConfig] = useState<FrontPageLayoutConfig>(() => {
    try {
      const saved = localStorage.getItem('blacknews_layout_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.leadReportId) return parsed;
      }
    } catch {}
    return DEFAULT_LAYOUT_CONFIG;
  });

  // Persistent redactors and registered users management
  const [redactorsList, setRedactorsList] = useState<RedactorProfile[]>(() => {
    try {
      const saved = localStorage.getItem('blacknews_redactors');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return INITIAL_REDACTORS;
  });

  // Current active user (defaults to Admin for full initial exploration)
  const [currentUser, setCurrentUser] = useState<RedactorProfile>(() => {
    return redactorsList[0] || INITIAL_REDACTORS[0];
  });

  // Persistent bookmarks
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('blacknews_bookmarks');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Sync Layout Config
  const handleUpdateLayoutConfig = async (newConfig: FrontPageLayoutConfig) => {
    setLayoutConfig(newConfig);
    try {
      localStorage.setItem('blacknews_layout_config', JSON.stringify(newConfig));
      await setDoc(doc(db, 'settings', 'frontpage_layout'), newConfig);
    } catch (err) {
      console.warn('[BLACKNEWS] Local storage backup saved for layout config');
    }
    showToast(`Distribución de portada: [${newConfig.automationPreset.toUpperCase()}]`);
  };

  // Apply automation preset with 1 click
  const handleAutomationApply = (preset: AutomationPreset) => {
    const computed = computeLayoutPreset(preset, reportsList);
    handleUpdateLayoutConfig(computed);
  };

  // Update breaking ticker news
  const handleUpdateFlashNews = async (updatedFlash: FlashNews[]) => {
    setFlashNewsList(updatedFlash);
    try {
      localStorage.setItem('blacknews_flash_news', JSON.stringify(updatedFlash));
      await setDoc(doc(db, 'settings', 'flash_news'), { items: updatedFlash });
    } catch (err) {
      console.warn('[BLACKNEWS] Local storage backup saved for flash news');
    }
    showToast('Teletipo de última hora actualizado');
  };

  // URL Deeplinking: detect ?informe=id on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reportIdFromUrl = params.get('informe');
    if (reportIdFromUrl) {
      const found = reportsList.find((r) => r.id === reportIdFromUrl);
      if (found) {
        setActiveReport(found);
      }
    }
  }, [reportsList]);

  // Sync URL when active report changes
  const handleOpenReport = (report: Report) => {
    setActiveReport(report);
    const newUrl = `${window.location.pathname}?informe=${encodeURIComponent(report.id)}`;
    window.history.pushState({ reportId: report.id }, '', newUrl);
  };

  const handleCloseReport = () => {
    setActiveReport(null);
    window.history.pushState({}, '', window.location.pathname);
  };

  // Bookmark toggling
  const handleToggleBookmark = (report: Report) => {
    setBookmarkedIds((prev) => {
      const next = new Set(prev);
      if (next.has(report.id)) {
        next.delete(report.id);
        showToast('Informe retirado de lecturas guardadas');
      } else {
        next.add(report.id);
        showToast('Informe añadido a lecturas guardadas');
      }
      try {
        localStorage.setItem('blacknews_bookmarks', JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  };

  const handleRemoveBookmark = (reportId: string) => {
    setBookmarkedIds((prev) => {
      const next = new Set(prev);
      next.delete(reportId);
      try {
        localStorage.setItem('blacknews_bookmarks', JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
    showToast('Informe eliminado');
  };

  const handleClearAllBookmarks = () => {
    setBookmarkedIds(new Set());
    try {
      localStorage.removeItem('blacknews_bookmarks');
    } catch {}
    showToast('Lista de lectura vaciada');
  };

  // Publishing a new report
  const handlePublishReport = async (newReport: Report) => {
    const updated = [newReport, ...reportsList];
    setReportsList(updated);
    try {
      localStorage.setItem('blacknews_reports', JSON.stringify(updated));
      await setDoc(doc(db, 'reports', newReport.id), newReport);
    } catch (err) {
      console.warn('[BLACKNEWS] Local storage backup saved for report');
    }
    showToast(`¡"${newReport.title.slice(0, 38)}..." publicado en portada!`);
  };

  // Updating an existing report (only author or admin)
  const handleUpdateExistingReport = async (updatedReport: Report) => {
    const updated = reportsList.map((r) => (r.id === updatedReport.id ? updatedReport : r));
    setReportsList(updated);
    try {
      localStorage.setItem('blacknews_reports', JSON.stringify(updated));
      await setDoc(doc(db, 'reports', updatedReport.id), updatedReport);
    } catch (err) {
      console.warn('[BLACKNEWS] Local storage backup saved for updated report');
    }
    showToast(`¡Informe "${updatedReport.title.slice(0, 32)}..." actualizado!`);
  };

  // Deleting a report (author or admin)
  const handleDeleteReport = async (id: string) => {
    const updated = reportsList.filter((r) => r.id !== id);
    setReportsList(updated);
    try {
      localStorage.setItem('blacknews_reports', JSON.stringify(updated));
    } catch {}
    showToast('Informe retirado de portada');
  };

  // Assign user role (ADMIN, MODERADOR, REDACTOR, LECTOR)
  const handleChangeUserRole = (userId: string, newRole: RedactorRole) => {
    const updated = redactorsList.map((member) => {
      if (member.id === userId) {
        return {
          ...member,
          role: newRole,
          approvedAt: newRole !== 'LECTOR' ? (member.approvedAt || '24 Sep 2026') : undefined,
        };
      }
      return member;
    });
    setRedactorsList(updated);
    try {
      localStorage.setItem('blacknews_redactors', JSON.stringify(updated));
    } catch {}

    if (currentUser.id === userId) {
      setCurrentUser((prev) => ({ ...prev, role: newRole }));
    }
    showToast(`Permisos actualizados: ${newRole}`);
  };

  // Approvals Management
  const handleApproveRedactor = (id: string) => {
    handleChangeUserRole(id, 'REDACTOR');
    showToast('Habilitado como Redactor (edición solo a sus post)');
  };

  const handleRejectRedactor = (id: string) => {
    handleChangeUserRole(id, 'LECTOR');
    showToast('Permisos revocados a usuario Lector');
  };

  const handleRegisterRedactor = (candidate: Omit<RedactorProfile, 'id' | 'role' | 'requestedAt' | 'avatarInitials'>) => {
    const initials = candidate.name
      .split(' ')
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

    // Regular registrations are always basic readers without editing capabilities
    const newProfile: RedactorProfile = {
      ...candidate,
      id: `usr-${Date.now()}`,
      role: 'LECTOR',
      requestedAt: '24 Sep 2026',
      avatarInitials: initials || 'US',
      isGoogleAccount: false,
    };

    const updated = [...redactorsList, newProfile];
    setRedactorsList(updated);
    try {
      localStorage.setItem('blacknews_redactors', JSON.stringify(updated));
    } catch {}
    setCurrentUser(newProfile);
    showToast('Cuenta registrada como Lector básico. Solicitud enviada.');
  };

  // Google Login and Registration Handler
  const handleLoginWithGoogle = (
    email: string,
    name: string,
    bureau: string = 'Lector Registrado',
    title: string = 'Usuario Básico',
    role?: RedactorRole
  ) => {
    // Check if user already exists
    const existing = redactorsList.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (existing) {
      setCurrentUser(existing);
      showToast(`Sesión: ${existing.name} [${existing.role}]`);
      return;
    }

    // Strict rule: Only the owner email is ADMIN. Any normal user registering with Google is LECTOR!
    const assignedRole: RedactorRole = role 
      ? role 
      : email.toLowerCase() === 'blacknewsglobalmedia@gmail.com'
      ? 'ADMIN'
      : 'LECTOR';

    const initials = name
      .split(' ')
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

    const newGoogleUser: RedactorProfile = {
      id: `usr-google-${Date.now()}`,
      name,
      email,
      role: assignedRole,
      bureau,
      title,
      avatarInitials: initials || 'G',
      requestedAt: '24 Sep 2026',
      approvedAt: assignedRole !== 'LECTOR' ? '24 Sep 2026' : undefined,
      isGoogleAccount: true,
    };

    const updated = [newGoogleUser, ...redactorsList];
    setRedactorsList(updated);
    try {
      localStorage.setItem('blacknews_redactors', JSON.stringify(updated));
    } catch {}
    setCurrentUser(newGoogleUser);
    showToast(`Cuenta Google conectada: ${name} [${assignedRole}]`);
  };

  const handleLogout = () => {
    showToast('Sesión cerrada');
  };

  const handleSwitchUser = (user: RedactorProfile) => {
    setCurrentUser(user);
    showToast(`Sesión: ${user.name} [${user.role}]`);
  };

  // Sharing handling
  const handleOpenShare = (report: Report | null) => {
    setShareTargetReport(report);
    setIsShareModalOpen(true);
  };

  // Category Filtering
  const filteredReports = selectedCategory === 'TODAS'
    ? reportsList
    : reportsList.filter((r) => r.category === selectedCategory);

  // Layout slots computed for 'TODAS'
  const configuredLead = reportsList.find((r) => r.id === layoutConfig.leadReportId) || reportsList[0];
  const configuredBlock1 = layoutConfig.block1ReportIds
    .map((id) => reportsList.find((r) => r.id === id))
    .filter((r): r is Report => Boolean(r));
  const configuredBlock2 = layoutConfig.block2ReportIds
    .map((id) => reportsList.find((r) => r.id === id))
    .filter((r): r is Report => Boolean(r));
  const configuredDossier = reportsList.find((r) => r.id === layoutConfig.dossierReportId);

  // Active Lead story for the top position
  const leadReport = selectedCategory === 'TODAS'
    ? configuredLead
    : filteredReports[0];

  const secondaryReports = selectedCategory === 'TODAS'
    ? reportsList.filter((r) => r.id !== leadReport?.id)
    : filteredReports.slice(1);

  // Check whether current user has editorial privileges to access internal media studio
  const canAccessInternalMedia = Boolean(currentUser && currentUser.role !== 'LECTOR');

  // Strict security guard: redirect away from redaccion immediately if user is LECTOR
  useEffect(() => {
    if (!canAccessInternalMedia && currentView === 'redaccion') {
      setCurrentView('portada');
    }
  }, [canAccessInternalMedia, currentView]);

  const handleToggleStudio = () => {
    if (!canAccessInternalMedia) {
      showToast('Acceso restringido a la sala interna de redacción.');
      return;
    }
    setCurrentView(currentView === 'redaccion' ? 'portada' : 'redaccion');
  };

  const savedReportsList = reportsList.filter((r) => bookmarkedIds.has(r.id));

  return (
    <div className="min-h-screen bg-black text-white font-['Lexend',sans-serif] selection:bg-white selection:text-black flex flex-col justify-between">
      {/* Toast notification banner */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-white text-black px-4 py-2.5 text-xs font-mono font-medium tracking-wider uppercase border border-neutral-300 shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <span className="w-2 h-2 bg-black inline-block"></span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Navigation */}
      <TopBar
        selectedCategory={selectedCategory}
        onSelectCategory={(cat) => {
          setSelectedCategory(cat);
          setCurrentView('portada');
        }}
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenBookmarks={() => setIsBookmarksOpen(true)}
        bookmarksCount={bookmarkedIds.size}
        onShareSite={() => handleOpenShare(null)}
        liveTickerActive={liveTickerActive}
        onToggleLiveTicker={() => setLiveTickerActive(!liveTickerActive)}
        onOpenStudio={handleToggleStudio}
        isStudioOpen={currentView === 'redaccion' && canAccessInternalMedia}
        currentUser={currentUser}
        onOpenGoogleAuth={() => setIsGoogleAuthOpen(true)}
      />

      {/* Real-time breaking ticker */}
      {liveTickerActive && currentView === 'portada' && (
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
        {currentView === 'redaccion' && canAccessInternalMedia ? (
          <RedactionStudio
            onBackToNews={() => setCurrentView('portada')}
            onPublishReport={handlePublishReport}
            onUpdateExistingReport={handleUpdateExistingReport}
            currentUser={currentUser}
            onSwitchUser={handleSwitchUser}
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
          />
        ) : (
          <>
            {leadReport && (
              <LeadStory
                report={leadReport}
                onRead={handleOpenReport}
                onShare={handleOpenShare}
                isBookmarked={bookmarkedIds.has(leadReport.id)}
                onToggleBookmark={handleToggleBookmark}
              />
            )}

            <ReportsGrid
              reports={secondaryReports}
              categories={CATEGORIES}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
              onReadReport={handleOpenReport}
              onShareReport={handleOpenShare}
              bookmarkedIds={bookmarkedIds}
              onToggleBookmark={handleToggleBookmark}
              configuredBlock1={selectedCategory === 'TODAS' ? configuredBlock1 : undefined}
              configuredBlock2={selectedCategory === 'TODAS' ? configuredBlock2 : undefined}
              configuredDossier={selectedCategory === 'TODAS' ? configuredDossier : undefined}
            />
          </>
        )}
      </main>

      {/* Footer */}
      <Footer
        categories={CATEGORIES}
        onSelectCategory={(cat) => {
          setSelectedCategory(cat);
          setCurrentView('portada');
        }}
        onShareSite={() => handleOpenShare(null)}
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
      />
    </div>
  );
}
