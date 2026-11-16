import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import {
  Smartphone,
  Download,
  Share2,
  Copy,
  Check,
  QrCode,
  RefreshCw,
  Wifi,
  Battery,
  DollarSign,
  Plus,
  FileText,
  Compass,
  Layers,
  Sparkles,
  ExternalLink,
  MessageCircle,
  Mail,
  Zap,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Maximize2,
  Minimize2,
  Camera,
  TrendingUp,
} from 'lucide-react';
import { PaymentItem, NoteItem, SavingsGoal, UserFinancialProfile } from '../types';
import { realtimeSync } from '../services/realtimeSyncService';
import { useTheme } from '../context/ThemeContext';

interface MobileAppModuleProps {
  payments: PaymentItem[];
  notes: NoteItem[];
  goals: SavingsGoal[];
  categoryBudgets: Record<string, number>;
  profile: UserFinancialProfile;
  onAddPayment: (payment: Omit<PaymentItem, 'id' | 'createdAt'>) => void;
  onTogglePaymentStatus: (id: string) => void;
  onAddNote?: (note: NoteItem, payment?: PaymentItem, goal?: SavingsGoal) => void;
  onOpenVoiceAssistant?: () => void;
  onOpenScanner?: () => void;
  onNavigateToTab?: (tab: 'notes' | 'finances' | 'radar' | 'gallery') => void;
}

export const MobileAppModule: React.FC<MobileAppModuleProps> = ({
  payments,
  notes,
  goals,
  categoryBudgets,
  profile,
  onAddPayment,
  onTogglePaymentStatus,
  onAddNote,
  onOpenVoiceAssistant,
  onOpenScanner,
  onNavigateToTab,
}) => {
  const { isVibrant } = useTheme();

  // Sharing states
  const [copiedLink, setCopiedLink] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncCount, setSyncCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<string>('En vivo');
  const [mobileViewTab, setMobileViewTab] = useState<'finances' | 'notes' | 'radar' | 'quick-add'>('finances');
  const [isFullscreenPhone, setIsFullscreenPhone] = useState(false);

  // Instalación PWA real (sustituye al antiguo paquete .apk simulado)
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [showInstallHelp, setShowInstallHelp] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    setIsStandalone(
      window.matchMedia('(display-mode: standalone)').matches ||
        (navigator as any).standalone === true
    );
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, []);

  const handleInstallPWA = async () => {
    if (installPrompt) {
      installPrompt.prompt();
      try {
        await installPrompt.userChoice;
      } catch {
        // el usuario canceló
      }
      setInstallPrompt(null);
    } else {
      setShowInstallHelp((v) => !v);
    }
  };

  // Quick transaction form in mobile frame
  const [quickTitle, setQuickTitle] = useState('');
  const [quickAmount, setQuickAmount] = useState('');
  const [quickCategory, setQuickCategory] = useState<PaymentItem['category']>('alimentacion');
  const [quickType, setQuickType] = useState<'gasto' | 'ingreso'>('gasto');
  const [quickSuccessToast, setQuickSuccessToast] = useState<string | null>(null);

  // App download URLs
  const appWebUrl = typeof window !== 'undefined' ? window.location.origin : 'https://aurafin.ai';

  // Generate QR code for mobile scanning
  useEffect(() => {
    QRCode.toDataURL(appWebUrl, {
      width: 280,
      margin: 1.5,
      color: {
        dark: isVibrant ? '#00f0ff' : '#6366f1',
        light: '#070a1e',
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('Error generating QR code:', err));
  }, [appWebUrl, isVibrant]);

  // Subscribe to real-time sync updates
  useEffect(() => {
    const unsubscribe = realtimeSync.subscribe((payload) => {
      setIsSyncing(true);
      setSyncCount((prev) => prev + 1);
      setLastSyncTime(new Date().toLocaleTimeString());
      setTimeout(() => setIsSyncing(false), 900);
    });

    return () => unsubscribe();
  }, []);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(appWebUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleShareNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'AuraFin AI - App Móvil y APK Oficial',
          text: 'Descarga o abre AuraFin AI en tu teléfono Android o iPhone con sincronización en tiempo real.',
          url: appWebUrl,
        });
      } catch {
        // user dismissed
      }
    } else {
      handleCopyLink();
    }
  };

  const handleForceSync = () => {
    setIsSyncing(true);
    realtimeSync.broadcast('FULL_SYNC', {
      payments,
      notes,
      goals,
      categoryBudgets,
      profile,
    });
    setTimeout(() => {
      setIsSyncing(false);
      setSyncCount((c) => c + 1);
      setLastSyncTime(new Date().toLocaleTimeString());
    }, 600);
  };

  const handleMobileSubmitPayment = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(quickAmount);
    if (!quickTitle.trim() || isNaN(amountNum) || amountNum <= 0) return;

    const paymentPayload: Omit<PaymentItem, 'id' | 'createdAt'> = {
      title: quickTitle.trim(),
      amount: amountNum,
      type: quickType,
      category: quickCategory,
      dueDate: new Date().toISOString().split('T')[0],
      status: 'pagado',
      isFixed: false,
      frequency: 'unico',
    };

    onAddPayment(paymentPayload);

    // Broadcast change to web in real time
    realtimeSync.broadcast('PAYMENTS', [
      {
        id: `m_${Date.now()}`,
        ...paymentPayload,
        createdAt: new Date().toISOString(),
      },
      ...payments,
    ]);

    setQuickTitle('');
    setQuickAmount('');
    setQuickSuccessToast(`¡Transacción registrada y sincronizada en tiempo real!`);
    setTimeout(() => setQuickSuccessToast(null), 3000);
  };

  // Calculations for mobile interface
  const totalIncome = payments
    .filter((p) => p.type === 'ingreso')
    .reduce((s, p) => s + p.amount, 0) || profile.monthlyIncome;
  const totalExpenses = payments
    .filter((p) => p.type === 'gasto')
    .reduce((s, p) => s + p.amount, 0);
  const netSavings = totalIncome - totalExpenses;

  return (
    <div className="space-y-8 animate-fadeIn pb-24 sm:pb-12">
      {/* 1. Header Banner: Link Sharing & APK Distribution */}
      <div
        className={`p-6 sm:p-8 rounded-3xl transition-all duration-300 relative overflow-hidden ${
          isVibrant
            ? 'bg-gradient-to-br from-[#0a1032] via-[#06091c] to-[#040614] border border-cyan-400/40 shadow-[0_0_35px_rgba(0,210,255,0.12)]'
            : 'bg-gradient-to-br from-slate-900 via-indigo-950/30 to-slate-900 border border-slate-800 shadow-2xl'
        }`}
      >
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/15 border border-cyan-400/30 text-cyan-300 text-xs font-bold shadow-sm">
              <Smartphone className="w-3.5 h-3.5 animate-pulse text-cyan-400" />
              <span>Módulo de Distribución & Sincronización Móvil</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Descarga la App / APK Oficial de <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-indigo-300 to-fuchsia-400">AuraFin AI</span>
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Lleva tu asistente financiero en tu teléfono Android o iPhone. Cuenta con un <strong>interfaz propio móvil</strong> y se mantiene <strong>conectado e integrado en tiempo real</strong> con esta plataforma web: cualquier cambio se refleja al instante.
            </p>
          </div>

          {/* Real-Time Live Sync Status Pill */}
          <div className="flex items-center gap-3 bg-slate-950/80 p-3 rounded-2xl border border-cyan-500/30 backdrop-blur-md self-start lg:self-center">
            <div className="relative flex items-center justify-center">
              <span className={`w-3 h-3 rounded-full ${isSyncing ? 'bg-amber-400 animate-ping' : 'bg-emerald-400 animate-pulse'}`} />
              <span className={`absolute w-2 h-2 rounded-full ${isSyncing ? 'bg-amber-400' : 'bg-emerald-400'}`} />
            </div>
            <div className="text-xs">
              <div className="flex items-center gap-1.5 font-bold text-white">
                <Wifi className="w-3.5 h-3.5 text-cyan-400" />
                <span>Sync en Tiempo Real Activo</span>
              </div>
              <span className="text-[11px] text-slate-400">
                {isSyncing ? 'Actualizando datos...' : `Sincronizaciones: ${syncCount} • ${lastSyncTime}`}
              </span>
            </div>
            <button
              onClick={handleForceSync}
              title="Forzar comprobación de sincronización ahora"
              className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-cyan-300 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-cyan-400' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Download Links & QR Code Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Direct APK & Web Link Cards (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Card A: Instalación PWA real (Android & iPhone) */}
          <div className="card p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/25">
                  <Download className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-primary flex items-center gap-2">
                    Instalar AuraFin en tu teléfono
                    <span className="badge badge-success">PWA Oficial</span>
                  </h3>
                  <p className="text-xs text-muted mt-0.5">
                    App instalable con sincronización en tiempo real, sin tiendas de aplicaciones. Funciona en Android y iPhone.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              {isStandalone ? (
                <span className="flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 text-xs sm:text-sm font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                  Ya estás usando la app instalada
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleInstallPWA}
                  className="btn btn-success"
                >
                  <Download className="w-4 h-4" />
                  <span>{installPrompt ? 'Instalar App Ahora' : 'Cómo instalarla'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleCopyLink}
                className="btn btn-secondary"
                title="Copiar link de la app para abrirla en tu teléfono"
              >
                {copiedLink ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                <span>{copiedLink ? '¡Link Copiado!' : 'Copiar Link de la App'}</span>
              </button>
            </div>

            {showInstallHelp && !isStandalone && (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl border border-default bg-inset p-3.5">
                  <p className="font-bold text-primary mb-1.5 flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5 text-emerald-500" /> Android (Chrome)
                  </p>
                  <ol className="list-decimal list-inside space-y-1 text-muted leading-relaxed">
                    <li>Abre este link en Chrome</li>
                    <li>Menú ⋮ → «Instalar aplicación» o «Agregar a pantalla de inicio»</li>
                    <li>Confirma: AuraFin aparece como app independiente</li>
                  </ol>
                </div>
                <div className="rounded-xl border border-default bg-inset p-3.5">
                  <p className="font-bold text-primary mb-1.5 flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5 text-sky-500" /> iPhone (Safari)
                  </p>
                  <ol className="list-decimal list-inside space-y-1 text-muted leading-relaxed">
                    <li>Abre este link en Safari</li>
                    <li>Botón Compartir → «Agregar a inicio»</li>
                    <li>Confirma: AuraFin queda en tu pantalla de inicio</li>
                  </ol>
                </div>
              </div>
            )}

            <div className="mt-4 pt-3 border-t border-default flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
              <span className="flex items-center gap-1 text-emerald-500">
                <ShieldCheck className="w-4 h-4" /> Instalación verificada por el navegador
              </span>
              <span className="hidden sm:inline">•</span>
              <span>Android 8.0+ / iOS 16.4+ · Sin archivos .apk de terceros</span>
            </div>
          </div>

          {/* Card B: Link Universal Web & PWA (iPhone & Android) */}
          <div
            className={`p-6 rounded-3xl border transition-all ${
              isVibrant
                ? 'bg-[#080d26] border-cyan-500/30 shadow-lg'
                : 'bg-slate-900 border-slate-800'
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/25">
                  <Smartphone className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                    Enlace de Acceso Rápido & PWA Standalone
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      iOS & Android
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Abre en Safari (iPhone) o Chrome (Android) y pulsa "Agregar a pantalla de inicio" para tener la app nativa instalada.
                  </p>
                </div>
              </div>
            </div>

            {/* Link Box with Copy Button */}
            <div className="mt-4 flex items-center gap-2 p-2 rounded-2xl bg-slate-950 border border-slate-800">
              <div className="px-2.5 py-1 text-slate-400 text-xs font-mono truncate flex-1 select-all">
                {appWebUrl}
              </div>
              <button
                type="button"
                onClick={handleCopyLink}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 text-xs font-bold transition-all shrink-0 active:scale-95"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Copiado' : 'Copiar'}</span>
              </button>
            </div>

            {/* Quick Share Buttons: WhatsApp, Telegram, Native Share */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleShareNative}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
              >
                <Share2 className="w-3.5 h-3.5 text-cyan-400" />
                <span>Compartir Link</span>
              </button>

              <a
                href={`https://wa.me/?text=${encodeURIComponent(`Descarga y prueba AuraFin AI, el asistente financiero móvil en tiempo real: ${appWebUrl}`)}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition-colors"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>WhatsApp</span>
              </a>

              <a
                href={`https://t.me/share/url?url=${encodeURIComponent(appWebUrl)}&text=${encodeURIComponent('AuraFin AI - Asistente Financiero Móvil y APK en tiempo real')}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-950/60 hover:bg-sky-900/60 text-sky-300 border border-sky-500/30 text-xs font-semibold transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Telegram</span>
              </a>

              <a
                href={`mailto:?subject=Descarga AuraFin AI Mobile&body=Te comparto el enlace de la aplicación móvil y APK de AuraFin AI: ${appWebUrl}`}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Email</span>
              </a>
            </div>
          </div>
        </div>

        {/* Right Column: Interactive QR Code for Instant Phone Scanning (5 Cols) */}
        <div className="lg:col-span-5">
          <div
            className={`p-6 rounded-3xl border h-full flex flex-col items-center justify-between text-center transition-all ${
              isVibrant
                ? 'bg-[#080d26] border-cyan-500/30 shadow-[0_0_25px_rgba(0,210,255,0.1)]'
                : 'bg-slate-900 border-slate-800'
            }`}
          >
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 text-xs font-bold">
                <QrCode className="w-3.5 h-3.5" />
                <span>Escaneo Rápido</span>
              </div>
              <h3 className="text-lg font-bold text-white">Escanea con la Cámara de tu Móvil</h3>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                Apunta la cámara de tu iPhone o Android al código para abrir la app y descargar el APK al instante.
              </p>
            </div>

            {/* QR Code Container */}
            <div className="my-5 p-3 rounded-2xl bg-[#070a1e] border border-cyan-500/30 shadow-2xl relative group">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="Código QR para descargar AuraFin AI"
                  className="w-52 h-52 sm:w-56 sm:h-56 rounded-xl transition-transform group-hover:scale-105 duration-300"
                />
              ) : (
                <div className="w-56 h-56 flex items-center justify-center text-slate-500 text-xs">
                  Generando código QR...
                </div>
              )}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-slate-950/70 rounded-xl backdrop-blur-xs">
                <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                  <ExternalLink className="w-4 h-4" /> Abrir en Teléfono
                </span>
              </div>
            </div>

            <div className="w-full flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/80 pt-3">
              <span className="flex items-center gap-1 text-cyan-300 font-semibold">
                <Zap className="w-3.5 h-3.5" /> Conexión Inmediata
              </span>
              <span>Cero configuración requerida</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. DEDICATED MOBILE APP INTERFACE ("Interfaz Propio de la App Móvil") */}
      <div className="space-y-4 pt-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-500/30 text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Interfaz Propio & Integración en Tiempo Real</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-1">
              Simulador Interactivo de la App Móvil
            </h3>
            <p className="text-xs text-slate-400">
              Prueba la interfaz nativa del teléfono directamente aquí: los pagos y notas que registres en este móvil se sincronizan en vivo con tu dashboard web y viceversa.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsFullscreenPhone(!isFullscreenPhone)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-colors"
            >
              {isFullscreenPhone ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              <span>{isFullscreenPhone ? 'Vista Normal' : 'Modo Celular Ampliado'}</span>
            </button>
          </div>
        </div>

        {/* Success notification for mobile actions */}
        {quickSuccessToast && (
          <div className="p-3 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{quickSuccessToast}</span>
          </div>
        )}

        {/* Mobile Mockup Screen Container */}
        <div className="flex justify-center py-4">
          <div
            className={`w-full ${
              isFullscreenPhone ? 'max-w-md' : 'max-w-sm'
            } rounded-[48px] bg-slate-950 border-[10px] border-slate-800 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col transition-all duration-300 ring-2 ${
              isVibrant ? 'ring-cyan-500/40 shadow-[0_0_40px_rgba(0,210,255,0.15)]' : 'ring-indigo-500/20'
            }`}
            style={{ minHeight: '620px' }}
          >
            {/* Phone Top Notch / Dynamic Island */}
            <div className="pt-3 pb-2 px-6 bg-slate-900/90 flex items-center justify-between text-[11px] font-semibold text-slate-300 border-b border-slate-800/60 select-none">
              <span>9:41</span>
              {/* Dynamic Island Pill */}
              <div className="w-24 h-4 rounded-full bg-black flex items-center justify-center gap-1.5 px-2">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                <span className="text-[9px] text-cyan-300 font-bold tracking-wider">AuraFin</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Wifi className="w-3 h-3 text-slate-300" />
                <Battery className="w-3.5 h-3.5 text-emerald-400" />
              </div>
            </div>

            {/* Mobile In-App Header */}
            <div className="p-4 bg-gradient-to-b from-slate-900 to-slate-950 border-b border-slate-800/80 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center text-white shadow-md">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white tracking-tight leading-none">AuraFin Mobile</h4>
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-semibold mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Sincronizado en tiempo real
                  </span>
                </div>
              </div>

              {onOpenVoiceAssistant && (
                <button
                  onClick={onOpenVoiceAssistant}
                  className="p-2 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:scale-105 active:scale-95 transition-transform"
                  title="Hablar con el asistente de voz"
                >
                  <Sparkles className="w-4 h-4 text-cyan-300 animate-pulse" />
                </button>
              )}
            </div>

            {/* Mobile Viewports according to sub-tab */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 custom-scrollbar text-xs">
              {/* Tab 1: Finanzas Móvil */}
              {mobileViewTab === 'finances' && (
                <div className="space-y-3 animate-fadeIn">
                  {/* Balance Card */}
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-cyan-950/80 via-slate-900 to-slate-900 border border-cyan-500/30 shadow-md">
                    <span className="text-[10px] uppercase font-bold text-cyan-300 tracking-wider">Capacidad de Ahorro</span>
                    <div className="text-2xl font-black text-white mt-1">
                      {profile.currencySymbol}{netSavings.toLocaleString()}
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-slate-300 border-t border-slate-800/80 pt-2">
                      <span>Ingresos: <strong className="text-emerald-400">{profile.currencySymbol}{totalIncome.toLocaleString()}</strong></span>
                      <span>Gastos: <strong className="text-rose-400">{profile.currencySymbol}{totalExpenses.toLocaleString()}</strong></span>
                    </div>
                  </div>

                  {/* Quick Action in Mobile: Add payment trigger */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setMobileViewTab('quick-add')}
                      className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-transform"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Nuevo Gasto Móvil</span>
                    </button>
                    {onOpenScanner && (
                      <button
                        onClick={onOpenScanner}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 active:scale-95 transition-transform"
                        title="Escanear recibo con la cámara"
                      >
                        <Camera className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* List of Payments inside Mobile App */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
                      <span>Tus Transacciones ({payments.length})</span>
                      <span className="text-cyan-400 text-[10px]">Toca para marcar pagado</span>
                    </div>

                    <div className="space-y-1.5 max-h-56 overflow-y-auto no-scrollbar">
                      {payments.slice(0, 8).map((p) => (
                        <div
                          key={p.id}
                          onClick={() => onTogglePaymentStatus(p.id)}
                          className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all active:scale-98 ${
                            p.status === 'pagado'
                              ? 'bg-slate-900/60 border-slate-800 text-slate-300'
                              : 'bg-slate-900 border-cyan-500/30 text-white shadow-xs'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${
                                p.status === 'pagado' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-slate-800 text-slate-500'
                              }`}
                            >
                              {p.status === 'pagado' ? '✓' : ''}
                            </span>
                            <div>
                              <span className={`block font-semibold leading-tight ${p.status === 'pagado' ? 'line-through text-slate-400' : ''}`}>
                                {p.title}
                              </span>
                              <span className="text-[9px] text-slate-500 uppercase">{p.category}</span>
                            </div>
                          </div>
                          <span className={`font-black ${p.type === 'ingreso' ? 'text-emerald-400' : 'text-slate-200'}`}>
                            {p.type === 'ingreso' ? '+' : '-'}{profile.currencySymbol}{p.amount}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Notas Móvil */}
              {mobileViewTab === 'notes' && (
                <div className="space-y-3 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-xs">Notas de Voz Móvil ({notes.length})</span>
                    {onOpenVoiceAssistant && (
                      <button
                        onClick={onOpenVoiceAssistant}
                        className="text-[10px] text-cyan-300 font-bold bg-cyan-500/10 px-2 py-1 rounded-lg border border-cyan-500/20"
                      >
                        + Dictar por Voz
                      </button>
                    )}
                  </div>

                  <div className="space-y-2 max-h-72 overflow-y-auto no-scrollbar">
                    {notes.map((n) => (
                      <div key={n.id} className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white text-xs">{n.title}</span>
                          <span className="text-[9px] text-slate-500">{n.intent}</span>
                        </div>
                        <p className="text-[11px] text-slate-300 line-clamp-2 leading-relaxed">
                          {n.content}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tab 3: Quick Add Payment in Mobile */}
              {mobileViewTab === 'quick-add' && (
                <form onSubmit={handleMobileSubmitPayment} className="space-y-3 animate-fadeIn bg-slate-900 p-3.5 rounded-2xl border border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-xs">Añadir Transacción Móvil</span>
                    <button
                      type="button"
                      onClick={() => setMobileViewTab('finances')}
                      className="text-[10px] text-slate-400 hover:text-white"
                    >
                      ✕ Cancelar
                    </button>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 font-semibold block mb-1">Concepto o Descripción</label>
                    <input
                      type="text"
                      required
                      value={quickTitle}
                      onChange={(e) => setQuickTitle(e.target.value)}
                      placeholder="Ej. Supermercado, Alquiler..."
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-400 font-semibold block mb-1">Monto ({profile.currencySymbol})</label>
                      <input
                        type="number"
                        step="any"
                        required
                        value={quickAmount}
                        onChange={(e) => setQuickAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 font-semibold block mb-1">Tipo</label>
                      <select
                        value={quickType}
                        onChange={(e) => setQuickType(e.target.value as any)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2 py-1.5 text-xs text-white focus:outline-none cursor-pointer"
                      >
                        <option value="gasto">Gasto</option>
                        <option value="ingreso">Ingreso</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 font-semibold block mb-1">Categoría</label>
                    <select
                      value={quickCategory}
                      onChange={(e) => setQuickCategory(e.target.value as PaymentItem['category'])}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2 py-1.5 text-xs text-white focus:outline-none cursor-pointer"
                    >
                      <option value="alimentacion">Alimentación</option>
                      <option value="transporte">Transporte</option>
                      <option value="alquiler">Alquiler / Vivienda</option>
                      <option value="servicios">Servicios Básicos</option>
                      <option value="ocio">Ocio & Salidas</option>
                      <option value="salud">Salud</option>
                      <option value="otro">Otro</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 text-white font-extrabold text-xs shadow-md active:scale-95 transition-transform"
                  >
                    Guardar & Sincronizar en Vivo
                  </button>
                </form>
              )}

              {/* Tab 4: Radar Autos y Vivienda */}
              {mobileViewTab === 'radar' && (
                <div className="space-y-3 animate-fadeIn">
                  <span className="font-bold text-white text-xs">Radar de Mercado en {profile.country}</span>
                  <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                    <span className="text-[11px] font-bold text-cyan-300 block">Autos y Viviendas Inteligentes</span>
                    <p className="text-[10px] text-slate-400">
                      Monitoreo activo para optimizar transporte y compra de vivienda con créditos comparados.
                    </p>
                    {onNavigateToTab && (
                      <button
                        onClick={() => onNavigateToTab('radar')}
                        className="w-full py-1.5 rounded-xl bg-indigo-500/20 text-indigo-300 text-[10px] font-bold border border-indigo-500/30"
                      >
                        Abrir Radar Completo
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Mobile Native Bottom Nav Bar */}
            <div className="p-2 bg-slate-900/95 border-t border-slate-800 flex items-center justify-around select-none">
              <button
                type="button"
                onClick={() => setMobileViewTab('finances')}
                className={`flex flex-col items-center gap-0.5 p-1 transition-colors ${
                  mobileViewTab === 'finances' ? 'text-cyan-400 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <DollarSign className="w-4 h-4" />
                <span className="text-[9px]">Finanzas</span>
              </button>

              <button
                type="button"
                onClick={() => setMobileViewTab('notes')}
                className={`flex flex-col items-center gap-0.5 p-1 transition-colors ${
                  mobileViewTab === 'notes' ? 'text-cyan-400 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span className="text-[9px]">Notas</span>
              </button>

              <button
                type="button"
                onClick={() => setMobileViewTab('quick-add')}
                className="w-9 h-9 -mt-3 rounded-full bg-gradient-to-tr from-cyan-500 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-cyan-500/30 border-2 border-slate-950 active:scale-90 transition-transform"
                title="Añadir rápido"
              >
                <Plus className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setMobileViewTab('radar')}
                className={`flex flex-col items-center gap-0.5 p-1 transition-colors ${
                  mobileViewTab === 'radar' ? 'text-cyan-400 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Compass className="w-4 h-4" />
                <span className="text-[9px]">Radar</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
