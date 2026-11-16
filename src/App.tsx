import React, { useState, useEffect, Suspense } from 'react';
import {
  FileText,
  DollarSign,
  Compass,
  FolderOpen,
  Mic,
  Sparkles,
  ChevronRight,
  TrendingUp,
  Camera,
  Smartphone,
  Activity,
  Building2,
} from 'lucide-react';
import {
  DeviceFile,
  DeviceContact,
  NoteItem,
  PaymentItem,
  UserFinancialProfile,
  SavingsGoal,
  NotificationPreferences,
} from './types';
import {
  INITIAL_DEVICE_FILES,
  INITIAL_DEVICE_CONTACTS,
  INITIAL_PAYMENTS,
  INITIAL_NOTES,
  INITIAL_PROFILE,
  INITIAL_SAVINGS_GOALS,
  DEFAULT_CATEGORY_BUDGETS,
  DEFAULT_ALERT_THRESHOLDS,
  DEFAULT_GLOBAL_ALERT_THRESHOLD,
} from './data/mockDeviceData';
import { Header } from './components/Header';
import { VoiceAssistantModal } from './components/VoiceAssistantModal';
import { NotesTab } from './components/NotesTab';
import { FilePreviewModal } from './components/FilePreviewModal';
import { NotificationSettingsModal } from './components/NotificationSettingsModal';
import { ReceiptScannerModal } from './components/ReceiptScannerModal';
import { FloatingAIAssistant } from './components/FloatingAIAssistant';
import { MobileBottomNav } from './components/MobileBottomNav';
import { DesktopNav } from './components/DesktopNav';
import { Skeleton } from './components/ui';
import { MobileInstallPromptModal } from './components/MobileInstallPromptModal';
import { UserSettingsModal, UserSettingsTab } from './components/UserSettingsModal';
import { generateFinancialReportPDF } from './utils/pdfGenerator';
import {
  registerServiceWorker,
  getNotificationPermission,
  checkAndTriggerProactiveAlerts,
  ProactiveNotificationItem,
  loadNotificationPreferences,
  saveNotificationPreferences,
  getQueuedDndNotifications,
  clearQueuedDndNotifications,
  isWithinQuietHours,
} from './utils/notificationService';
import { useTheme } from './context/ThemeContext';
import { useEmpresa } from './context/EmpresaContext';
import { realtimeSync } from './services/realtimeSyncService';
import { AccesoEmpresasModal } from './components/empresas/AccesoEmpresasModal';
import { PanelEmpresasModal } from './components/empresas/PanelEmpresasModal';
import { indexedDbService } from './services/indexedDbService';

// Carga diferida de secciones pesadas: el bundle inicial sólo incluye el shell
// y la pestaña por defecto (Notas). El resto se descarga al navegar.
const FinancesTab = React.lazy(() => import('./components/FinancesTab').then((m) => ({ default: m.FinancesTab })));
const VoiceAnalyticsTab = React.lazy(() => import('./components/VoiceAnalyticsTab').then((m) => ({ default: m.VoiceAnalyticsTab })));
const MarketRadarTab = React.lazy(() => import('./components/MarketRadarTab').then((m) => ({ default: m.MarketRadarTab })));
const DeviceGalleryTab = React.lazy(() => import('./components/DeviceGalleryTab').then((m) => ({ default: m.DeviceGalleryTab })));
const MobileAppModule = React.lazy(() => import('./components/MobileAppModule').then((m) => ({ default: m.MobileAppModule })));

/** Estado de carga coherente con el sistema de diseño mientras llega una sección. */
const TabSkeleton: React.FC = () => (
  <div className="space-y-4" role="status" aria-label="Cargando sección">
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Skeleton className="h-28" />
      <Skeleton className="h-28" />
      <Skeleton className="h-28 hidden sm:block" />
      <Skeleton className="h-28 hidden lg:block" />
    </div>
    <Skeleton className="h-72" />
  </div>
);

export default function App() {
  const { theme, isNitido, isVibrant } = useTheme();
  const { autenticado, esAdministrador, empresa, cerrarSesion } = useEmpresa();

  // Ecosistema multiempresa: acceso y panel de administración
  const [accesoEmpresasAbierto, setAccesoEmpresasAbierto] = useState(false);
  const [panelEmpresasAbierto, setPanelEmpresasAbierto] = useState(false);

  // State with LocalStorage persistence
  const [profile, setProfile] = useState<UserFinancialProfile>(() => {
    try {
      const saved = localStorage.getItem('aurafin_profile');
      return saved ? JSON.parse(saved) : INITIAL_PROFILE;
    } catch {
      return INITIAL_PROFILE;
    }
  });

  const [pdfNotification, setPdfNotification] = useState<string | null>(null);
  const [isGlobalScannerOpen, setIsGlobalScannerOpen] = useState(false);

  const [notes, setNotes] = useState<NoteItem[]>(() => {
    try {
      const saved = localStorage.getItem('aurafin_notes');
      return saved ? JSON.parse(saved) : INITIAL_NOTES;
    } catch {
      return INITIAL_NOTES;
    }
  });

  const [payments, setPayments] = useState<PaymentItem[]>(() => {
    try {
      const saved = localStorage.getItem('aurafin_payments');
      return saved ? JSON.parse(saved) : INITIAL_PAYMENTS;
    } catch {
      return INITIAL_PAYMENTS;
    }
  });

  const [goals, setGoals] = useState<SavingsGoal[]>(() => {
    try {
      const saved = localStorage.getItem('aurafin_goals');
      return saved ? JSON.parse(saved) : INITIAL_SAVINGS_GOALS;
    } catch {
      return INITIAL_SAVINGS_GOALS;
    }
  });

  const [categoryBudgets, setCategoryBudgets] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('aurafin_category_budgets');
      return saved ? JSON.parse(saved) : DEFAULT_CATEGORY_BUDGETS;
    } catch {
      return DEFAULT_CATEGORY_BUDGETS;
    }
  });

  const [alertThresholds, setAlertThresholds] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('aurafin_alert_thresholds');
      return saved ? JSON.parse(saved) : DEFAULT_ALERT_THRESHOLDS;
    } catch {
      return DEFAULT_ALERT_THRESHOLDS;
    }
  });

  const [globalAlertThreshold, setGlobalAlertThreshold] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('aurafin_global_alert_threshold');
      return saved ? Number(saved) : DEFAULT_GLOBAL_ALERT_THRESHOLD;
    } catch {
      return DEFAULT_GLOBAL_ALERT_THRESHOLD;
    }
  });

  const handleUpdateAlertThresholds = (updated: Record<string, number>, globalThreshold?: number) => {
    setAlertThresholds(updated);
    try {
      localStorage.setItem('aurafin_alert_thresholds', JSON.stringify(updated));
    } catch {
      // ignore
    }
    if (globalThreshold !== undefined) {
      setGlobalAlertThreshold(globalThreshold);
      try {
        localStorage.setItem('aurafin_global_alert_threshold', String(globalThreshold));
      } catch {
        // ignore
      }
    }
  };

  const [files, setFiles] = useState<DeviceFile[]>(() => {
    try {
      const saved = localStorage.getItem('aurafin_files');
      return saved ? JSON.parse(saved) : INITIAL_DEVICE_FILES;
    } catch {
      return INITIAL_DEVICE_FILES;
    }
  });

  const [contacts, setContacts] = useState<DeviceContact[]>(() => {
    try {
      const saved = localStorage.getItem('aurafin_contacts');
      return saved ? JSON.parse(saved) : INITIAL_DEVICE_CONTACTS;
    } catch {
      return INITIAL_DEVICE_CONTACTS;
    }
  });

  // App UI state
  const [activeTab, setActiveTab] = useState<'notes' | 'finances' | 'voice-analytics' | 'radar' | 'gallery' | 'mobile-app'>('notes');
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [voiceInitialText, setVoiceInitialText] = useState('');
  const [voiceAudioEnabled, setVoiceAudioEnabled] = useState(true);
  const [previewFile, setPreviewFile] = useState<DeviceFile | null>(null);
  const [previewReason, setPreviewReason] = useState<string | undefined>(undefined);
  const [showFloatingAI, setShowFloatingAI] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('aurafin_show_floating_ai');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);

  // Subscribe to Real-Time Synchronization Bus (Mobile App / APK <-> Web)
  useEffect(() => {
    const unsubscribe = realtimeSync.subscribe((payload) => {
      if (payload.type === 'PAYMENTS' && Array.isArray(payload.data)) {
        setPayments(payload.data);
      } else if (payload.type === 'NOTES' && Array.isArray(payload.data)) {
        setNotes(payload.data);
      } else if (payload.type === 'GOALS' && Array.isArray(payload.data)) {
        setGoals(payload.data);
      } else if (payload.type === 'BUDGETS' && payload.data) {
        setCategoryBudgets(payload.data);
      } else if (payload.type === 'PROFILE' && payload.data) {
        setProfile((prev) => ({ ...prev, ...payload.data }));
      } else if (payload.type === 'FULL_SYNC' && payload.data) {
        if (payload.data.payments) setPayments(payload.data.payments);
        if (payload.data.notes) setNotes(payload.data.notes);
        if (payload.data.goals) setGoals(payload.data.goals);
        if (payload.data.categoryBudgets) setCategoryBudgets(payload.data.categoryBudgets);
        if (payload.data.profile) setProfile((prev) => ({ ...prev, ...payload.data.profile }));
      }
    });

    return () => unsubscribe();
  }, []);

  // Web Push & Proactive Background Notifications state
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
  const [isUserSettingsOpen, setIsUserSettingsOpen] = useState(false);
  const [userSettingsInitialTab, setUserSettingsInitialTab] = useState<UserSettingsTab>('dnd');
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences>(() =>
    loadNotificationPreferences()
  );
  const [queuedDndAlerts, setQueuedDndAlerts] = useState<ProactiveNotificationItem[]>(() =>
    getQueuedDndNotifications()
  );
  const [pushPermission, setPushPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [notificationLog, setNotificationLog] = useState<ProactiveNotificationItem[]>(() => {
    try {
      const saved = localStorage.getItem('aurafin_notification_log');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('aurafin_notification_log', JSON.stringify(notificationLog));
  }, [notificationLog]);

  useEffect(() => {
    saveNotificationPreferences(notificationPreferences);
  }, [notificationPreferences]);

  const handleOpenUserSettings = (tab: UserSettingsTab = 'dnd') => {
    setUserSettingsInitialTab(tab);
    setQueuedDndAlerts(getQueuedDndNotifications());
    setIsUserSettingsOpen(true);
  };

  const handleClearQueuedDnd = () => {
    clearQueuedDndNotifications();
    setQueuedDndAlerts([]);
  };

  const isDndActive = isWithinQuietHours(notificationPreferences).isDnd;

  // Register Service Worker and sync notification permission
  useEffect(() => {
    registerServiceWorker().then(() => {
      setPushPermission(getNotificationPermission());
    });

    if ('serviceWorker' in navigator) {
      const handleSwMessage = (event: MessageEvent) => {
        if (event.data?.type === 'NAVIGATE_TAB' && event.data?.tab) {
          setActiveTab(event.data.tab);
        }
      };
      navigator.serviceWorker.addEventListener('message', handleSwMessage);
      return () => {
        navigator.serviceWorker.removeEventListener('message', handleSwMessage);
      };
    }
  }, []);

  // Proactive background monitoring when app is minimized or tab is hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        const enableBg = localStorage.getItem('aurafin_notify_background') !== 'false';
        if (enableBg) {
          checkAndTriggerProactiveAlerts(
            payments,
            categoryBudgets,
            profile,
            (newNotif) => {
              setNotificationLog((prev) => [newNotif, ...prev].slice(0, 30));
              if (newNotif.suppressedByDnd) {
                setQueuedDndAlerts(getQueuedDndNotifications());
              }
            },
            alertThresholds,
            globalAlertThreshold,
            notificationPreferences
          );
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Periodic check every 3 minutes
    const interval = setInterval(() => {
      checkAndTriggerProactiveAlerts(
        payments,
        categoryBudgets,
        profile,
        (newNotif) => {
          setNotificationLog((prev) => [newNotif, ...prev].slice(0, 30));
          if (newNotif.suppressedByDnd) {
            setQueuedDndAlerts(getQueuedDndNotifications());
          }
        },
        alertThresholds,
        globalAlertThreshold,
        notificationPreferences
      );
    }, 180000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(interval);
    };
  }, [payments, categoryBudgets, profile, alertThresholds, globalAlertThreshold, notificationPreferences]);

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem('aurafin_profile', JSON.stringify(profile));
    indexedDbService.cacheState('profile', profile);
  }, [profile]);

  useEffect(() => {
    localStorage.setItem('aurafin_notes', JSON.stringify(notes));
    indexedDbService.cacheState('notes', notes);
  }, [notes]);

  useEffect(() => {
    localStorage.setItem('aurafin_payments', JSON.stringify(payments));
    indexedDbService.cacheState('payments', payments);
  }, [payments]);

  useEffect(() => {
    localStorage.setItem('aurafin_goals', JSON.stringify(goals));
    indexedDbService.cacheState('goals', goals);
  }, [goals]);

  useEffect(() => {
    localStorage.setItem('aurafin_category_budgets', JSON.stringify(categoryBudgets));
    indexedDbService.cacheState('category_budgets', categoryBudgets);
  }, [categoryBudgets]);

  useEffect(() => {
    localStorage.setItem('aurafin_files', JSON.stringify(files));
    indexedDbService.cacheState('files', files);
  }, [files]);

  useEffect(() => {
    localStorage.setItem('aurafin_contacts', JSON.stringify(contacts));
    indexedDbService.cacheState('contacts', contacts);
  }, [contacts]);

  // Income & Expense totals
  const totalIncome = payments
    .filter((p) => p.type === 'ingreso')
    .reduce((sum, p) => sum + p.amount, 0) || profile.monthlyIncome;

  const totalExpenses = payments
    .filter((p) => p.type === 'gasto')
    .reduce((sum, p) => sum + p.amount, 0);

  // Handlers
  const handleUpdateProfile = (updated: Partial<UserFinancialProfile>) => {
    setProfile((prev) => ({ ...prev, ...updated }));
  };

  const handleNoteCreated = (newNote: NoteItem, newPayment?: PaymentItem, newGoal?: SavingsGoal) => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      indexedDbService.savePendingChange('note', 'create', newNote);
      if (newPayment) indexedDbService.savePendingChange('payment', 'create', newPayment);
      if (newGoal) indexedDbService.savePendingChange('goal', 'create', newGoal);
    }

    setNotes((prev) => {
      const nextNotes = [newNote, ...prev];
      realtimeSync.broadcast('NOTES', nextNotes);
      return nextNotes;
    });
    if (newPayment) {
      setPayments((prev) => {
        const nextPayments = [newPayment, ...prev];
        realtimeSync.broadcast('PAYMENTS', nextPayments);
        return nextPayments;
      });
    }
    if (newGoal) {
      setGoals((prev) => {
        const nextGoals = [newGoal, ...prev];
        realtimeSync.broadcast('GOALS', nextGoals);
        return nextGoals;
      });
    }
  };

  const handleDeleteNote = (id: string) => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      indexedDbService.savePendingChange('note', 'delete', { id });
    }
    setNotes((prev) => {
      const next = prev.filter((n) => n.id !== id);
      realtimeSync.broadcast('NOTES', next);
      return next;
    });
  };

  const handleTogglePin = (id: string) => {
    setNotes((prev) => {
      const next = prev.map((n) => (n.id === id ? { ...n, isPinned: !n.isPinned } : n));
      realtimeSync.broadcast('NOTES', next);
      return next;
    });
  };

  const handleAddPayment = (paymentData: Omit<PaymentItem, 'id' | 'createdAt'>) => {
    const newPayment: PaymentItem = {
      ...paymentData,
      id: `pay-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      indexedDbService.savePendingChange('payment', 'create', newPayment);
    }
    setPayments((prev) => {
      const next = [newPayment, ...prev];
      realtimeSync.broadcast('PAYMENTS', next);
      return next;
    });
  };

  const handleUpdatePayment = (id: string, updated: Partial<PaymentItem>) => {
    setPayments((prev) => {
      const next = prev.map((p) => (p.id === id ? { ...p, ...updated } : p));
      realtimeSync.broadcast('PAYMENTS', next);
      return next;
    });
  };

  const handleTogglePaymentStatus = (id: string) => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      indexedDbService.savePendingChange('payment', 'toggle', { id });
    }
    setPayments((prev) => {
      const next = prev.map((p) =>
        p.id === id
          ? {
              ...p,
              status: (p.status === 'pagado' ? 'pendiente' : 'pagado') as 'pagado' | 'pendiente',
            }
          : p
      );
      realtimeSync.broadcast('PAYMENTS', next);
      return next;
    });
  };

  const handleDeletePayment = (id: string) => {
    setPayments((prev) => {
      const next = prev.filter((p) => p.id !== id);
      realtimeSync.broadcast('PAYMENTS', next);
      return next;
    });
  };

  const handleAddGoal = (goalData: Omit<SavingsGoal, 'id' | 'createdAt'>) => {
    const newGoal: SavingsGoal = {
      ...goalData,
      id: `goal-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setGoals((prev) => {
      const next = [newGoal, ...prev];
      realtimeSync.broadcast('GOALS', next);
      return next;
    });
  };

  const handleUpdateGoalAmount = (id: string, newAmount: number) => {
    setGoals((prev) =>
      prev.map((g) => (g.id === id ? { ...g, currentAmount: newAmount } : g))
    );
  };

  const handleUpdateGoalMonthlyContribution = (id: string, newMonthlyContribution: number) => {
    setGoals((prev) => {
      const next = prev.map((g) =>
        g.id === id
          ? { ...g, monthlyContribution: Math.max(0, Math.round(newMonthlyContribution)) }
          : g
      );
      realtimeSync.broadcast('GOALS', next);
      return next;
    });
  };

  const handleDeleteGoal = (id: string) => {
    setGoals((prev) => prev.filter((g) => g.id !== id));
  };

  const handleAddFile = (newFile: DeviceFile) => {
    setFiles((prev) => [newFile, ...prev]);
  };

  const handleAddContact = (newContact: DeviceContact) => {
    setContacts((prev) => [newContact, ...prev]);
  };

  const handleOpenVoiceWithText = (text: string) => {
    setVoiceInitialText(text);
    setIsVoiceModalOpen(true);
  };

  const handleDownloadPDF = () => {
    const transportExpense = payments
      .filter((p) => p.type === 'gasto' && p.category === 'transporte')
      .reduce((sum, p) => sum + p.amount, 0);

    const rentExpense = payments
      .filter((p) => p.type === 'gasto' && p.category === 'alquiler')
      .reduce((sum, p) => sum + p.amount, 0);

    generateFinancialReportPDF({
      profile,
      payments,
      goals,
      transportExpense,
      rentExpense,
      contacts,
    });

    setPdfNotification(`¡Reporte financiero y Directorio de Contactos (${contacts.length}) PDF generado con éxito!`);
    setTimeout(() => {
      setPdfNotification(null);
    }, 4500);
  };

  const activeAlertsCount = Object.keys(categoryBudgets).filter((cat) => {
    const spent = payments
      .filter((p) => p.type === 'gasto' && p.category === cat)
      .reduce((sum, p) => sum + p.amount, 0);
    const budget = categoryBudgets[cat] || 1;
    const thresholdFraction = (alertThresholds[cat] || globalAlertThreshold) / 100;
    return spent / budget >= thresholdFraction;
  }).length;

  return (
    <div className="min-h-screen flex flex-col font-sans text-primary relative pb-24 lg:pb-6 transition-colors duration-300">
      {/* Acceso al ecosistema de empresas (fijo, accesible en móvil y escritorio) */}
      <div className="fixed left-3 bottom-24 lg:bottom-6 z-40 flex flex-col gap-2">
        {autenticado && esAdministrador && (
          <button
            type="button"
            onClick={() => setPanelEmpresasAbierto(true)}
            className="btn btn-secondary btn-sm shadow-[var(--shadow-pop)]"
            title={`Panel de empresas (${empresa.nombre})`}
          >
            <Building2 className="w-4 h-4" /> Empresas
          </button>
        )}
        {autenticado ? (
          <button
            type="button"
            onClick={cerrarSesion}
            className="btn btn-ghost btn-sm"
            title="Cerrar sesión de la empresa"
          >
            Salir
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setAccesoEmpresasAbierto(true)}
            className="btn btn-secondary btn-sm shadow-[var(--shadow-pop)]"
            title="Iniciar sesión empresarial"
          >
            <Building2 className="w-4 h-4" /> Acceso empresa
          </button>
        )}
      </div>

      {/* Toast Notification */}
      {pdfNotification && (
        <div className="fixed top-20 right-4 sm:right-6 z-50 p-4 rounded-2xl bg-gradient-aura text-white text-xs sm:text-sm font-semibold shadow-[var(--shadow-pop)] flex items-center gap-3 border border-[var(--accent-border)] max-w-[calc(100vw-2rem)]">
          <Sparkles className="w-5 h-5 animate-pulse shrink-0" aria-hidden />
          <span>{pdfNotification}</span>
        </div>
      )}

      {/* Top Header */}
      <Header
        profile={profile}
        onUpdateProfile={handleUpdateProfile}
        voiceAudioEnabled={voiceAudioEnabled}
        onToggleVoiceAudio={() => setVoiceAudioEnabled(!voiceAudioEnabled)}
        onOpenVoiceAssistant={() => {
          setVoiceInitialText('');
          setIsVoiceModalOpen(true);
        }}
        onDownloadPDF={handleDownloadPDF}
        activeAlertsCount={activeAlertsCount}
        onNavigateToFinances={() => setActiveTab('finances')}
        totalIncome={totalIncome}
        totalExpenses={totalExpenses}
        onOpenNotificationCenter={() => setIsNotificationModalOpen(true)}
        pushPermission={pushPermission}
        onOpenInstallModal={() => setIsInstallModalOpen(true)}
        onNavigateToAppModule={() => setActiveTab('mobile-app')}
        showFloatingAI={showFloatingAI}
        onToggleFloatingAI={(val) => {
          setShowFloatingAI(val);
          try {
            localStorage.setItem('aurafin_show_floating_ai', JSON.stringify(val));
          } catch {
            // ignore
          }
        }}
        onOpenUserSettings={handleOpenUserSettings}
        isDndActive={isDndActive}
      />

      {/* Navegación principal (data-driven, compartida con la barra móvil) */}
      <DesktopNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        notesCount={notes.length}
        paymentsCount={payments.length}
        filesCount={files.length}
        activeAlertsCount={activeAlertsCount}
        country={profile.country}
      />


      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <Suspense fallback={<TabSkeleton />}>
        {activeTab === 'notes' && (
          <NotesTab
            notes={notes}
            availableFiles={files}
            availableContacts={contacts}
            profile={profile}
            onOpenVoiceAssistant={(text) => {
              setVoiceInitialText(text || '');
              setIsVoiceModalOpen(true);
            }}
            onDeleteNote={handleDeleteNote}
            onTogglePin={handleTogglePin}
            onSelectFilePreview={(file, reason) => {
              setPreviewFile(file);
              setPreviewReason(reason);
            }}
            voiceAudioEnabled={voiceAudioEnabled}
          />
        )}

        {activeTab === 'finances' && (
          <FinancesTab
            payments={payments}
            profile={profile}
            goals={goals}
            notes={notes}
            categoryBudgets={categoryBudgets}
            onUpdateCategoryBudgets={setCategoryBudgets}
            alertThresholds={alertThresholds}
            globalAlertThreshold={globalAlertThreshold}
            onUpdateAlertThresholds={handleUpdateAlertThresholds}
            availableFiles={files}
            availableContacts={contacts}
            onAddPayment={handleAddPayment}
            onUpdatePayment={handleUpdatePayment}
            onTogglePaymentStatus={handleTogglePaymentStatus}
            onDeletePayment={handleDeletePayment}
            onAddGoal={handleAddGoal}
            onUpdateGoalAmount={handleUpdateGoalAmount}
            onUpdateGoalMonthlyContribution={handleUpdateGoalMonthlyContribution}
            onDeleteGoal={handleDeleteGoal}
            onUpdateProfile={handleUpdateProfile}
            onNavigateToRadar={() => setActiveTab('radar')}
            onSelectFilePreview={(file, reason) => {
              setPreviewFile(file);
              setPreviewReason(reason);
            }}
            onOpenVoiceAssistantWithPrompt={(prompt) => {
              setVoiceInitialText(prompt);
              setIsVoiceModalOpen(true);
            }}
            onDownloadPDF={handleDownloadPDF}
            onOpenNotificationCenter={() => setIsNotificationModalOpen(true)}
            onAddFileToGallery={handleAddFile}
            onOpenUserSettings={handleOpenUserSettings}
            isDndActive={isDndActive}
          />
        )}

        {activeTab === 'voice-analytics' && (
          <VoiceAnalyticsTab
            notes={notes}
            profile={profile}
            payments={payments}
            goals={goals}
            onOpenVoiceAssistant={(text) => {
              setVoiceInitialText(text || '');
              setIsVoiceModalOpen(true);
            }}
            onNavigateToTab={(tab) => setActiveTab(tab)}
          />
        )}

        {activeTab === 'radar' && (
          <MarketRadarTab
            profile={profile}
            payments={payments}
            onUpdateProfile={handleUpdateProfile}
          />
        )}

        {activeTab === 'gallery' && (
          <DeviceGalleryTab
            files={files}
            contacts={contacts}
            notes={notes}
            onAddFile={handleAddFile}
            onAddContact={handleAddContact}
            onSelectFilePreview={(file) => {
              setPreviewFile(file);
              setPreviewReason(undefined);
            }}
            onOpenVoiceAssistantWithText={handleOpenVoiceWithText}
          />
        )}

        {activeTab === 'mobile-app' && (
          <MobileAppModule
            payments={payments}
            notes={notes}
            goals={goals}
            categoryBudgets={categoryBudgets}
            profile={profile}
            onAddPayment={handleAddPayment}
            onTogglePaymentStatus={handleTogglePaymentStatus}
            onAddNote={handleNoteCreated}
            onOpenVoiceAssistant={() => {
              setVoiceInitialText('');
              setIsVoiceModalOpen(true);
            }}
            onOpenScanner={() => setIsGlobalScannerOpen(true)}
            onNavigateToTab={(tab) => setActiveTab(tab)}
          />
        )}
        </Suspense>
      </main>

      {/* Movable & Dismissible AI Assistant Orb */}
      <FloatingAIAssistant
        isVisible={showFloatingAI}
        onToggleVisibility={(val) => {
          setShowFloatingAI(val);
          try {
            localStorage.setItem('aurafin_show_floating_ai', JSON.stringify(val));
          } catch {
            // ignore
          }
        }}
        onOpenVoiceAssistant={(prompt) => {
          setVoiceInitialText(prompt || '');
          setIsVoiceModalOpen(true);
        }}
        onOpenScanner={() => setIsGlobalScannerOpen(true)}
      />

      {/* Native Mobile Bottom Navigation Bar (iOS / Android) */}
      <MobileBottomNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenScanner={() => setIsGlobalScannerOpen(true)}
        onOpenVoiceAssistant={() => {
          setVoiceInitialText('');
          setIsVoiceModalOpen(true);
        }}
        activeAlertsCount={activeAlertsCount}
        notesCount={notes.length}
        paymentsCount={payments.length}
        showFloatingAI={showFloatingAI}
        onToggleFloatingAI={(val) => {
          setShowFloatingAI(val);
          try {
            localStorage.setItem('aurafin_show_floating_ai', JSON.stringify(val));
          } catch {
            // ignore
          }
        }}
      />

      {/* Voice Assistant Modal */}
      <VoiceAssistantModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        availableFiles={files}
        availableContacts={contacts}
        profile={profile}
        voiceAudioEnabled={voiceAudioEnabled}
        onNoteCreated={handleNoteCreated}
        initialPromptText={voiceInitialText}
      />

      {/* File Preview Modal */}
      <FilePreviewModal
        file={previewFile}
        onClose={() => {
          setPreviewFile(null);
          setPreviewReason(undefined);
        }}
        reason={previewReason}
      />

      {/* Web Push & Proactive Background Notification Settings Modal */}
      <NotificationSettingsModal
        isOpen={isNotificationModalOpen}
        onClose={() => setIsNotificationModalOpen(false)}
        payments={payments}
        categoryBudgets={categoryBudgets}
        profile={profile}
        notificationLog={notificationLog}
        onNotificationSent={(item) => {
          setNotificationLog((prev) => [item, ...prev].slice(0, 30));
          if (item.suppressedByDnd) {
            setQueuedDndAlerts(getQueuedDndNotifications());
          }
        }}
        preferences={notificationPreferences}
        onOpenDndSettings={(tab) => handleOpenUserSettings(tab || 'dnd')}
      />

      {/* User Settings Modal: Quiet Hours (DND), Expense Notification Priorities & Financial Profile */}
      <UserSettingsModal
        isOpen={isUserSettingsOpen}
        onClose={() => setIsUserSettingsOpen(false)}
        initialTab={userSettingsInitialTab}
        preferences={notificationPreferences}
        onUpdatePreferences={setNotificationPreferences}
        profile={profile}
        onUpdateProfile={handleUpdateProfile}
        queuedDndAlerts={queuedDndAlerts}
        onClearQueuedDnd={handleClearQueuedDnd}
        onOpenPushSettings={() => {
          setIsUserSettingsOpen(false);
          setIsNotificationModalOpen(true);
        }}
      />

      {/* Global Receipt Scanner Modal */}
      <ReceiptScannerModal
        isOpen={isGlobalScannerOpen}
        onClose={() => setIsGlobalScannerOpen(false)}
        onAddPayment={handleAddPayment}
        profile={profile}
        onAddFileToGallery={handleAddFile}
      />

      {/* PWA Mobile App Installation Prompt Modal (iOS & Android) */}
      <MobileInstallPromptModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
      />

      {/* Ecosistema multiempresa: acceso y panel de administración */}
      <AccesoEmpresasModal
        abierto={accesoEmpresasAbierto}
        onCerrar={() => setAccesoEmpresasAbierto(false)}
        onExito={() => {
          setAccesoEmpresasAbierto(false);
          setPanelEmpresasAbierto(true);
        }}
      />
      <PanelEmpresasModal abierto={panelEmpresasAbierto} onCerrar={() => setPanelEmpresasAbierto(false)} />
    </div>
  );
}
