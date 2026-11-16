import React, { useState, useEffect } from 'react';
import {
  Bell,
  X,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Send,
  Zap,
  CheckCircle2,
  Calendar,
  DollarSign,
  Smartphone,
  ExternalLink,
  Moon,
  Sliders,
  BellOff,
} from 'lucide-react';
import {
  getNotificationPermission,
  requestNotificationPermission,
  testBackgroundNotification,
  checkAndTriggerProactiveAlerts,
  ProactiveNotificationItem,
  isWithinQuietHours,
  loadNotificationPreferences,
} from '../utils/notificationService';
import { NotificationPreferences, PaymentItem, UserFinancialProfile } from '../types';

interface NotificationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  payments: PaymentItem[];
  categoryBudgets: Record<string, number>;
  profile: UserFinancialProfile;
  notificationLog: ProactiveNotificationItem[];
  onNotificationSent: (item: ProactiveNotificationItem) => void;
  preferences?: NotificationPreferences;
  onOpenDndSettings?: (tab?: 'dnd' | 'priorities') => void;
}

export const NotificationSettingsModal: React.FC<NotificationSettingsModalProps> = ({
  isOpen,
  onClose,
  payments,
  categoryBudgets,
  profile,
  notificationLog,
  onNotificationSent,
  preferences,
  onOpenDndSettings,
}) => {
  const activePrefs = preferences || loadNotificationPreferences();
  const dndStatus = isWithinQuietHours(activePrefs);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(
    getNotificationPermission()
  );
  const [testCountdown, setTestCountdown] = useState<number | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [manualScanResult, setManualScanResult] = useState<string | null>(null);

  // Settings in LocalStorage
  const [enablePaymentAlerts, setEnablePaymentAlerts] = useState<boolean>(() => {
    return localStorage.getItem('aurafin_notify_payments') !== 'false';
  });
  const [enableBudgetAlerts, setEnableBudgetAlerts] = useState<boolean>(() => {
    return localStorage.getItem('aurafin_notify_budgets') !== 'false';
  });
  const [enableBackgroundAutoScan, setEnableBackgroundAutoScan] = useState<boolean>(() => {
    return localStorage.getItem('aurafin_notify_background') !== 'false';
  });

  useEffect(() => {
    localStorage.setItem('aurafin_notify_payments', String(enablePaymentAlerts));
  }, [enablePaymentAlerts]);

  useEffect(() => {
    localStorage.setItem('aurafin_notify_budgets', String(enableBudgetAlerts));
  }, [enableBudgetAlerts]);

  useEffect(() => {
    localStorage.setItem('aurafin_notify_background', String(enableBackgroundAutoScan));
  }, [enableBackgroundAutoScan]);

  useEffect(() => {
    if (isOpen) {
      setPermission(getNotificationPermission());
    }
  }, [isOpen]);

  const handleRequestPermission = async () => {
    const res = await requestNotificationPermission();
    setPermission(res);
  };

  const handleTestNotification = async () => {
    if (permission !== 'granted') {
      const p = await requestNotificationPermission();
      setPermission(p);
      if (p !== 'granted') return;
    }

    setIsTesting(true);
    setTestCountdown(4);

    const timer = setInterval(() => {
      setTestCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          setIsTesting(false);
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    await testBackgroundNotification(4);
    const testItem: ProactiveNotificationItem = {
      id: `test-${Date.now()}`,
      title: '✨ AuraFin AI: Notificación en Segundo Plano',
      body: 'Prueba de push y alertas proactivas en segundo plano ejecutada.',
      type: 'test',
      timestamp: new Date().toISOString(),
      tag: 'test',
    };
    onNotificationSent(testItem);
  };

  const handleManualScan = async () => {
    if (permission !== 'granted') {
      const p = await requestNotificationPermission();
      setPermission(p);
      if (p !== 'granted') return;
    }

    const items = await checkAndTriggerProactiveAlerts(
      payments,
      categoryBudgets,
      profile,
      onNotificationSent,
      undefined,
      undefined,
      activePrefs
    );

    if (items.length === 0) {
      setManualScanResult('No hay pagos venciendo ni presupuestos superando el umbral en este instante.');
    } else {
      const silencedCount = items.filter((i) => i.suppressedByDnd).length;
      const deliveredCount = items.length - silencedCount;
      if (silencedCount > 0 && deliveredCount === 0) {
        setManualScanResult(
          `${silencedCount} alerta(s) detectada(s) pero silenciada(s) por "No Molestar" / filtro de prioridad (enviadas al resumen).`
        );
      } else if (silencedCount > 0) {
        setManualScanResult(
          `Se enviaron ${deliveredCount} alerta(s) y ${silencedCount} se guardaron en el resumen por "No Molestar".`
        );
      } else {
        setManualScanResult(`¡Se enviaron ${deliveredCount} alerta(s) proactiva(s) al sistema!`);
      }
    }

    setTimeout(() => {
      setManualScanResult(null);
    }, 5500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <Bell className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Centro de Notificaciones Push & Proactivas
              </h2>
              <p className="text-xs text-slate-400">
                Alertas nativas de escritorio y móvil incluso con la app minimizada
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar modal de notificaciones"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1 text-sm">
          {/* Status Card */}
          <div
            className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
              permission === 'granted'
                ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
                : permission === 'denied'
                ? 'bg-rose-950/20 border-rose-500/30 text-rose-200'
                : 'bg-amber-950/20 border-amber-500/30 text-amber-200'
            }`}
          >
            <div className="flex items-center gap-3">
              {permission === 'granted' ? (
                <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0" />
              ) : permission === 'denied' ? (
                <AlertTriangle className="w-6 h-6 text-rose-400 shrink-0" />
              ) : (
                <Bell className="w-6 h-6 text-amber-400 shrink-0" />
              )}
              <div>
                <p className="font-bold text-sm">
                  {permission === 'granted'
                    ? 'Notificaciones Web Push Activas'
                    : permission === 'denied'
                    ? 'Notificaciones Bloqueadas en el Navegador'
                    : 'Permiso de Notificaciones Pendiente'}
                </p>
                <p className="text-xs text-slate-400">
                  {permission === 'granted'
                    ? 'Tu dispositivo recibirá alertas de pagos y presupuestos aunque la pestaña esté en segundo plano.'
                    : permission === 'denied'
                    ? 'Debes autorizar las notificaciones en la barra de direcciones de tu navegador para recibirlas.'
                    : 'Activa los permisos para que la IA pueda avisarte en tiempo real.'}
                </p>
              </div>
            </div>

            {permission !== 'granted' && (
              <button
                onClick={handleRequestPermission}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-semibold text-xs shadow-md shadow-cyan-500/20 shrink-0"
              >
                Permitir Notificaciones
              </button>
            )}
          </div>

          {/* DND & Expense Notification Priorities Card */}
          <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            dndStatus.isDnd
              ? 'bg-indigo-950/30 border-indigo-500/40 text-indigo-100'
              : 'bg-slate-800/50 border-slate-700/80 text-slate-200'
          }`}>
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg shrink-0 ${
                dndStatus.isDnd ? 'bg-indigo-500/20 text-indigo-300' : 'bg-slate-700/70 text-cyan-400'
              }`}>
                {dndStatus.isDnd ? <BellOff className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </div>
              <div>
                <p className="font-bold text-xs flex items-center gap-2">
                  <span>
                    {dndStatus.isDnd
                      ? `Modo "No Molestar" activo (${dndStatus.activeBlock?.name || 'Descanso'})`
                      : activePrefs.dndMasterEnabled
                      ? 'Horarios "No Molestar" programados'
                      : 'Horarios "No Molestar" desactivados'}
                  </span>
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {dndStatus.isDnd
                    ? dndStatus.activeBlock?.allowCriticalOverride
                      ? 'Solo pasarán notificaciones de prioridad Crítica; el resto irá al resumen.'
                      : 'Silencio total activo hasta finalizar el bloque horario.'
                    : `Nivel mínimo global: ${activePrefs.minimumActivePriority.toUpperCase()} · Configura sueño, trabajo y prioridades por categoría.`}
                </p>
              </div>
            </div>

            {onOpenDndSettings && (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => {
                    onClose();
                    onOpenDndSettings('dnd');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] transition-colors"
                >
                  <Moon className="w-3.5 h-3.5" />
                  <span>No Molestar</span>
                </button>
                <button
                  onClick={() => {
                    onClose();
                    onOpenDndSettings('priorities');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-100 font-bold text-[11px] transition-colors"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Prioridades</span>
                </button>
              </div>
            )}
          </div>

          {/* Test Background Notification CTA */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-slate-800/80 to-slate-900 border border-slate-700/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-cyan-400" />
                <span className="font-semibold text-white">Prueba en Segundo Plano (Minimizar App)</span>
              </div>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                Service Worker
              </span>
            </div>
            <p className="text-xs text-slate-300">
              Haz clic en el botón y minimiza o cambia de pestaña en los siguientes 4 segundos para comprobar que recibes la notificación emergente del sistema.
            </p>

            <div className="flex items-center gap-3">
              <button
                onClick={handleTestNotification}
                disabled={isTesting}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all ${
                  isTesting
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 cursor-wait'
                    : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-600/30'
                }`}
              >
                <Send className="w-3.5 h-3.5" />
                <span>
                  {isTesting
                    ? `¡Minimiza ahora! Disparando en ${testCountdown}s...`
                    : 'Probar Notificación en Segundo Plano (4s)'}
                </span>
              </button>

              <button
                onClick={handleManualScan}
                className="px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold transition-colors"
              >
                Escanear Alertas Ahora
              </button>
            </div>

            {manualScanResult && (
              <p className="text-xs text-cyan-300 bg-cyan-950/60 p-2.5 rounded-lg border border-cyan-800/60 animate-in fade-in">
                {manualScanResult}
              </p>
            )}
          </div>

          {/* Configuration Toggles */}
          <div className="space-y-3">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400">
              Automatizaciones Proactivas
            </h3>

            {/* Toggle 1: Payments */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-800/40 border border-slate-800">
              <div className="flex items-start gap-3">
                <Calendar className="w-4 h-4 text-indigo-400 mt-0.5" />
                <div>
                  <p className="font-semibold text-slate-200 text-xs">Recordatorios de Pagos Próximos</p>
                  <p className="text-[11px] text-slate-400">
                    Avisar cuando un pago fijo o variable venza hoy, mañana o se encuentre pendiente.
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                aria-label="Activar recordatorios de pagos próximos"
                checked={enablePaymentAlerts}
                onChange={(e) => setEnablePaymentAlerts(e.target.checked)}
                className="w-4 h-4 text-cyan-500 bg-slate-800 border-slate-700 rounded focus:ring-cyan-500 cursor-pointer"
              />
            </div>

            {/* Toggle 2: Budget 80% */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-800/40 border border-slate-800">
              <div className="flex items-start gap-3">
                <DollarSign className="w-4 h-4 text-amber-400 mt-0.5" />
                <div>
                  <p className="font-semibold text-slate-200 text-xs">Alertas de Presupuesto Excedido (&gt;80%)</p>
                  <p className="text-[11px] text-slate-400">
                    Notificar inmediatamente cuando el gasto acumulado alcance o supere el 80% del límite de la categoría.
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                aria-label="Activar alertas de presupuesto mayor al 80%"
                checked={enableBudgetAlerts}
                onChange={(e) => setEnableBudgetAlerts(e.target.checked)}
                className="w-4 h-4 text-cyan-500 bg-slate-800 border-slate-700 rounded focus:ring-cyan-500 cursor-pointer"
              />
            </div>

            {/* Toggle 3: Background auto trigger */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-800/40 border border-slate-800">
              <div className="flex items-start gap-3">
                <Smartphone className="w-4 h-4 text-emerald-400 mt-0.5" />
                <div>
                  <p className="font-semibold text-slate-200 text-xs">Monitoreo al Minimizar o Cambiar Pestaña</p>
                  <p className="text-[11px] text-slate-400">
                    Ejecutar escaneo automático en segundo plano cuando la app pierde el foco.
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                aria-label="Activar monitoreo al minimizar o cambiar de pestaña"
                checked={enableBackgroundAutoScan}
                onChange={(e) => setEnableBackgroundAutoScan(e.target.checked)}
                className="w-4 h-4 text-cyan-500 bg-slate-800 border-slate-700 rounded focus:ring-cyan-500 cursor-pointer"
              />
            </div>
          </div>

          {/* History of Proactive Notifications */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Historial de Alertas Enviadas ({notificationLog.length})
              </h3>
            </div>

            {notificationLog.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800 text-center text-xs text-slate-500">
                Aún no se han disparado alertas proactivas. Haz clic en "Escanear Alertas Ahora" o prueba la notificación.
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                {notificationLog.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-lg bg-slate-800/50 border border-slate-800 flex items-start justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-slate-200">{item.title}</p>
                        {item.suppressedByDnd && (
                          <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold">
                            Silenciada (DND)
                          </span>
                        )}
                      </div>
                      <p className="text-slate-400 text-[11px] mt-0.5">{item.body}</p>
                    </div>
                    <span className="text-[10px] text-slate-500 whitespace-nowrap">
                      {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
};
