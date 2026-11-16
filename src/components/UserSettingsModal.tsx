import React, { useState, useMemo } from 'react';
import {
  X,
  Moon,
  Briefcase,
  BellOff,
  Bell,
  Clock,
  Sliders,
  ShieldAlert,
  ShieldCheck,
  Plus,
  Trash2,
  Check,
  CheckCircle2,
  RotateCcw,
  Sparkles,
  User,
  Zap,
  AlertTriangle,
  Inbox,
  Play,
  Calendar,
  DollarSign,
} from 'lucide-react';
import {
  AlertPriorityLevel,
  NotificationPreferences,
  QuietHoursBlock,
  UserFinancialProfile,
} from '../types';
import { DEFAULT_NOTIFICATION_PREFERENCES, POPULAR_COUNTRIES } from '../data/mockDeviceData';
import {
  isWithinQuietHours,
  evaluateNotificationDelivery,
  ProactiveNotificationItem,
  clearQueuedDndNotifications,
} from '../utils/notificationService';
import { useTheme } from '../context/ThemeContext';

export type UserSettingsTab = 'dnd' | 'priorities' | 'profile';

interface UserSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: UserSettingsTab;
  preferences: NotificationPreferences;
  onUpdatePreferences: (updated: NotificationPreferences) => void;
  profile: UserFinancialProfile;
  onUpdateProfile: (updated: Partial<UserFinancialProfile>) => void;
  queuedDndAlerts?: ProactiveNotificationItem[];
  onClearQueuedDnd?: () => void;
  onOpenPushSettings?: () => void;
}

const DAYS_OF_WEEK = [
  { idx: 1, short: 'L', full: 'Lunes' },
  { idx: 2, short: 'M', full: 'Martes' },
  { idx: 3, short: 'X', full: 'Miércoles' },
  { idx: 4, short: 'J', full: 'Jueves' },
  { idx: 5, short: 'V', full: 'Viernes' },
  { idx: 6, short: 'S', full: 'Sábado' },
  { idx: 0, short: 'D', full: 'Domingo' },
];

const PRIORITY_OPTIONS: Array<{
  value: AlertPriorityLevel;
  label: string;
  nitidoActive: string;
  darkActive: string;
  dotColor: string;
}> = [
  {
    value: 'critica',
    label: 'Crítica',
    nitidoActive: 'bg-rose-600 text-white border-rose-600 shadow-xs',
    darkActive: 'bg-rose-600 text-white border-rose-500',
    dotColor: 'bg-rose-500',
  },
  {
    value: 'alta',
    label: 'Alta',
    nitidoActive: 'bg-amber-500 text-white border-amber-500 shadow-xs',
    darkActive: 'bg-amber-500 text-slate-950 border-amber-400',
    dotColor: 'bg-amber-500',
  },
  {
    value: 'media',
    label: 'Media',
    nitidoActive: 'bg-indigo-600 text-white border-indigo-600 shadow-xs',
    darkActive: 'bg-indigo-600 text-white border-indigo-500',
    dotColor: 'bg-indigo-500',
  },
  {
    value: 'baja',
    label: 'Baja',
    nitidoActive: 'bg-slate-600 text-white border-slate-600 shadow-xs',
    darkActive: 'bg-slate-600 text-white border-slate-500',
    dotColor: 'bg-slate-400',
  },
];

const EXPENSE_CATEGORIES = [
  { key: 'alquiler', label: 'Vivienda / Alquiler' },
  { key: 'servicios', label: 'Servicios Básicos' },
  { key: 'salud', label: 'Salud y Farmacia' },
  { key: 'alimentacion', label: 'Alimentación' },
  { key: 'transporte', label: 'Transporte' },
  { key: 'educacion', label: 'Educación' },
  { key: 'ocio', label: 'Ocio y Salidas' },
  { key: 'otro', label: 'Otros Gastos' },
];

export const UserSettingsModal: React.FC<UserSettingsModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'dnd',
  preferences,
  onUpdatePreferences,
  profile,
  onUpdateProfile,
  queuedDndAlerts = [],
  onClearQueuedDnd,
  onOpenPushSettings,
}) => {
  const { isNitido } = useTheme();
  const [activeTab, setActiveTab] = useState<UserSettingsTab>(initialTab);
  const [savedBanner, setSavedBanner] = useState<string | null>(null);

  // Add custom quiet hours block form
  const [isAddingBlock, setIsAddingBlock] = useState(false);
  const [newBlockName, setNewBlockName] = useState('');
  const [newBlockStart, setNewBlockStart] = useState('13:00');
  const [newBlockEnd, setNewBlockEnd] = useState('15:00');
  const [newBlockDays, setNewBlockDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [newBlockAllowCritical, setNewBlockAllowCritical] = useState(false);

  // Simulator state
  const [simTime, setSimTime] = useState('23:30');
  const [simDay, setSimDay] = useState<number>(new Date().getDay());
  const [simRuleId, setSimRuleId] = useState('budget_warning');
  const [simCategory, setSimCategory] = useState('ocio');
  const [simAmount, setSimAmount] = useState(65);

  React.useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  const showSavedFeedback = (msg: string) => {
    setSavedBanner(msg);
    setTimeout(() => setSavedBanner(null), 2600);
  };

  const currentDndStatus = useMemo(() => {
    return isWithinQuietHours(preferences, new Date());
  }, [preferences]);

  const simulatorResult = useMemo(() => {
    const [hh, mm] = simTime.split(':').map(Number);
    const simulatedDate = new Date();
    const diffDays = simDay - simulatedDate.getDay();
    simulatedDate.setDate(simulatedDate.getDate() + diffDays);
    simulatedDate.setHours(isNaN(hh) ? 0 : hh, isNaN(mm) ? 0 : mm, 0, 0);

    return evaluateNotificationDelivery(simRuleId, simCategory, simAmount, preferences, simulatedDate);
  }, [simTime, simDay, simRuleId, simCategory, simAmount, preferences]);

  if (!isOpen) return null;

  const updatePrefs = (next: NotificationPreferences, msg = 'Configuración guardada automáticamente') => {
    onUpdatePreferences(next);
    showSavedFeedback(msg);
  };

  const handleToggleBlock = (blockId: string) => {
    const updated = preferences.quietSchedules.map((b) =>
      b.id === blockId ? { ...b, enabled: !b.enabled } : b
    );
    updatePrefs({ ...preferences, quietSchedules: updated }, 'Horario actualizado');
  };

  const handleUpdateBlockField = (blockId: string, patch: Partial<QuietHoursBlock>) => {
    const updated = preferences.quietSchedules.map((b) =>
      b.id === blockId ? { ...b, ...patch } : b
    );
    updatePrefs({ ...preferences, quietSchedules: updated });
  };

  const handleToggleBlockDay = (blockId: string, dayIdx: number) => {
    const target = preferences.quietSchedules.find((b) => b.id === blockId);
    if (!target) return;
    const exists = target.days.includes(dayIdx);
    const nextDays = exists ? target.days.filter((d) => d !== dayIdx) : [...target.days, dayIdx];
    handleUpdateBlockField(blockId, { days: nextDays });
  };

  const handleDeleteBlock = (blockId: string) => {
    const updated = preferences.quietSchedules.filter((b) => b.id !== blockId);
    updatePrefs({ ...preferences, quietSchedules: updated }, 'Horario eliminado');
  };

  const handleAddCustomBlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBlockName.trim()) return;
    const created: QuietHoursBlock = {
      id: `dnd-custom-${Date.now()}`,
      name: newBlockName.trim(),
      presetType: 'custom',
      enabled: true,
      startTime: newBlockStart,
      endTime: newBlockEnd,
      days: newBlockDays.length > 0 ? newBlockDays : [0, 1, 2, 3, 4, 5, 6],
      allowCriticalOverride: newBlockAllowCritical,
    };
    updatePrefs(
      { ...preferences, quietSchedules: [...preferences.quietSchedules, created] },
      `Horario "${created.name}" agregado`
    );
    setNewBlockName('');
    setIsAddingBlock(false);
  };

  const handleApplyQuickPreset = (preset: 'sleep_and_work' | 'sleep_only' | 'strict_focus') => {
    if (preset === 'sleep_only') {
      updatePrefs(
        {
          ...preferences,
          dndMasterEnabled: true,
          quietSchedules: preferences.quietSchedules.map((b) =>
            b.presetType === 'sleep'
              ? { ...b, enabled: true, startTime: '22:30', endTime: '07:00', allowCriticalOverride: false }
              : b.presetType === 'work'
              ? { ...b, enabled: false }
              : b
          ),
        },
        'Perfil "Solo Sueño Nocturno" activado'
      );
    } else if (preset === 'sleep_and_work') {
      updatePrefs(
        {
          ...preferences,
          dndMasterEnabled: true,
          quietSchedules: DEFAULT_NOTIFICATION_PREFERENCES.quietSchedules,
        },
        'Perfil "Sueño + Horario Laboral" activado'
      );
    } else {
      updatePrefs(
        {
          ...preferences,
          dndMasterEnabled: true,
          minimumActivePriority: 'alta',
          quietSchedules: preferences.quietSchedules.map((b) => ({
            ...b,
            enabled: true,
            allowCriticalOverride: b.presetType === 'work',
          })),
        },
        'Perfil "Enfoque Máximo (Alta / Crítica)" activado'
      );
    }
  };

  const handleUpdateRulePriority = (ruleId: string, priority: AlertPriorityLevel) => {
    const updatedRules = preferences.expenseRules.map((r) =>
      r.id === ruleId ? { ...r, priority } : r
    );
    updatePrefs({ ...preferences, expenseRules: updatedRules });
  };

  const handleToggleRuleEnabled = (ruleId: string) => {
    const updatedRules = preferences.expenseRules.map((r) =>
      r.id === ruleId ? { ...r, enabled: !r.enabled } : r
    );
    updatePrefs({ ...preferences, expenseRules: updatedRules });
  };

  const handleUpdateRuleThreshold = (ruleId: string, amount: number) => {
    const updatedRules = preferences.expenseRules.map((r) =>
      r.id === ruleId ? { ...r, minAmountThreshold: Math.max(0, amount) } : r
    );
    updatePrefs({ ...preferences, expenseRules: updatedRules });
  };

  const handleUpdateCategoryPriority = (catKey: string, priority: AlertPriorityLevel) => {
    updatePrefs({
      ...preferences,
      categoryPriorities: {
        ...preferences.categoryPriorities,
        [catKey]: priority,
      },
    });
  };

  const handleResetDefaults = () => {
    updatePrefs(DEFAULT_NOTIFICATION_PREFERENCES, 'Preferencias restablecidas a valores recomendados');
  };

  const handleClearDigest = () => {
    clearQueuedDndNotifications();
    onClearQueuedDnd?.();
    showSavedFeedback('Bandeja de resumen silenciado limpiada');
  };

  const currSym = profile.currencySymbol || '$';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
      <div
        className={`border rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden ${
          isNitido
            ? 'bg-white border-slate-200 text-slate-900'
            : 'bg-slate-900 border-slate-700/80 text-white'
        }`}
      >
        {/* Top Modal Header */}
        <div
          className={`flex items-center justify-between px-5 sm:px-6 py-4 border-b ${
            isNitido ? 'bg-slate-50/90 border-slate-200' : 'bg-slate-950/70 border-slate-800'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center border shrink-0 ${
                isNitido
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                  : 'bg-indigo-950/80 border-indigo-700/60 text-indigo-300'
              }`}
            >
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className={`text-base sm:text-lg font-black tracking-tight ${isNitido ? 'text-slate-900' : 'text-white'}`}>
                  Configuración de Usuario y Alertas
                </h2>
                <span
                  className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                    currentDndStatus.isDnd
                      ? 'bg-indigo-100 text-indigo-900 border-indigo-300'
                      : isNitido
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-emerald-950/70 text-emerald-300 border-emerald-700'
                  }`}
                >
                  {currentDndStatus.isDnd
                    ? `🌙 No Molestar Activo (${currentDndStatus.activeBlock?.name})`
                    : '🔔 Alertas en Horario Activo'}
                </span>
              </div>
              <p className={`text-xs mt-0.5 ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
                Controla horarios de descanso o trabajo y prioriza qué alertas de gastos pueden notificarte
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetDefaults}
              title="Restablecer valores recomendados"
              className={`p-2 rounded-xl border text-xs font-bold transition-colors ${
                isNitido
                  ? 'bg-white hover:bg-slate-100 text-slate-600 border-slate-200'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
              }`}
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar configuración de usuario"
              className={`p-2 rounded-xl transition-colors ${
                isNitido ? 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/70' : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Sub-Tabs */}
        <div
          className={`px-5 sm:px-6 py-2.5 border-b flex items-center gap-2 overflow-x-auto ${
            isNitido ? 'bg-white border-slate-200' : 'bg-slate-900/90 border-slate-800'
          }`}
        >
          <button
            type="button"
            onClick={() => setActiveTab('dnd')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
              activeTab === 'dnd'
                ? isNitido
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                  : 'bg-indigo-600 text-white border-indigo-500'
                : isNitido
                ? 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            <Moon className="w-3.5 h-3.5" />
            <span>Horarios "No Molestar"</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                activeTab === 'dnd'
                  ? 'bg-white/20 text-white'
                  : isNitido
                  ? 'bg-indigo-100 text-indigo-800'
                  : 'bg-slate-700 text-slate-300'
              }`}
            >
              {preferences.quietSchedules.filter((b) => b.enabled).length} activos
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('priorities')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
              activeTab === 'priorities'
                ? isNitido
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                  : 'bg-indigo-600 text-white border-indigo-500'
                : isNitido
                ? 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Prioridades de Notificaciones de Gastos</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
              activeTab === 'profile'
                ? isNitido
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                  : 'bg-indigo-600 text-white border-indigo-500'
                : isNitido
                ? 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Perfil Financiero</span>
          </button>
        </div>

        {/* Auto-save feedback toast */}
        {savedBanner && (
          <div className="mx-5 sm:mx-6 mt-3 px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center justify-between">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              {savedBanner}
            </span>
            <span className="text-[10px] opacity-80">Guardado ✓</span>
          </div>
        )}

        {/* Scrollable Content */}
        <div className="p-5 sm:p-6 space-y-6 overflow-y-auto flex-1">
          {/* ============================================================== */}
          {/* TAB 1: HORARIOS NO MOLESTAR (DND)                              */}
          {/* ============================================================== */}
          {activeTab === 'dnd' && (
            <div className="space-y-5">
              {/* Master Switch Card */}
              <div
                className={`p-4 sm:p-5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  preferences.dndMasterEnabled
                    ? isNitido
                      ? 'bg-indigo-50/60 border-indigo-200'
                      : 'bg-indigo-950/40 border-indigo-700/60'
                    : isNitido
                    ? 'bg-slate-50 border-slate-200'
                    : 'bg-slate-800/50 border-slate-700'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                      preferences.dndMasterEnabled
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : isNitido
                        ? 'bg-white text-slate-500 border-slate-300'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {preferences.dndMasterEnabled ? <BellOff className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className={`text-sm sm:text-base font-black ${isNitido ? 'text-slate-900' : 'text-white'}`}>
                        Modo "No Molestar" Automático
                      </h3>
                      <span
                        className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${
                          preferences.dndMasterEnabled
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {preferences.dndMasterEnabled ? 'Activado' : 'Pausado'}
                      </span>
                    </div>
                    <p className={`text-xs mt-1 ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
                      Silencia automáticamente las alertas no urgentes durante tus horas de sueño, jornada laboral o estudio.
                    </p>
                  </div>
                </div>

                <label className="inline-flex items-center gap-2.5 cursor-pointer shrink-0 select-none">
                  <input
                    type="checkbox"
                    checked={preferences.dndMasterEnabled}
                    onChange={(e) =>
                      updatePrefs(
                        { ...preferences, dndMasterEnabled: e.target.checked },
                        e.target.checked ? 'Modo No Molestar activado' : 'Modo No Molestar desactivado'
                      )
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all relative peer-checked:bg-indigo-600" />
                  <span className={`text-xs font-bold ${isNitido ? 'text-slate-800' : 'text-slate-200'}`}>
                    {preferences.dndMasterEnabled ? 'Activo' : 'Inactivo'}
                  </span>
                </label>
              </div>

              {/* Quick Presets Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <span className={`text-xs font-bold ${isNitido ? 'text-slate-700' : 'text-slate-300'}`}>
                  Perfiles rápidos recomendados:
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleApplyQuickPreset('sleep_and_work')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                      isNitido
                        ? 'bg-white hover:bg-indigo-50 text-indigo-900 border-slate-200 hover:border-indigo-300'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                    }`}
                  >
                    🌙 Sueño + 💼 Trabajo
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyQuickPreset('sleep_only')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                      isNitido
                        ? 'bg-white hover:bg-indigo-50 text-slate-800 border-slate-200 hover:border-indigo-300'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                    }`}
                  >
                    🛌 Solo Sueño (22:30–07:00)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyQuickPreset('strict_focus')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                      isNitido
                        ? 'bg-white hover:bg-amber-50 text-amber-900 border-slate-200 hover:border-amber-300'
                        : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-slate-700'
                    }`}
                  >
                    🎯 Enfoque Estricto
                  </button>
                </div>
              </div>

              {/* Quiet Hours Blocks List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className={`text-xs font-black uppercase tracking-wider ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
                    Franjas Horarias Configuradas ({preferences.quietSchedules.length})
                  </h4>
                  <button
                    type="button"
                    onClick={() => setIsAddingBlock(!isAddingBlock)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                      isNitido
                        ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border-indigo-200'
                        : 'bg-indigo-950/60 hover:bg-indigo-900 text-indigo-300 border-indigo-700'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Agregar Horario</span>
                  </button>
                </div>

                {/* Add New Custom Quiet Block Form */}
                {isAddingBlock && (
                  <form
                    onSubmit={handleAddCustomBlock}
                    className={`p-4 rounded-2xl border space-y-3 ${
                      isNitido ? 'bg-indigo-50/40 border-indigo-200' : 'bg-slate-800/60 border-indigo-700/50'
                    }`}
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-1">
                        <label className={`text-[11px] font-bold block mb-1 ${isNitido ? 'text-slate-700' : 'text-slate-300'}`}>
                          Nombre del Horario
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Ej: Siesta, Clases, Gimnasio..."
                          value={newBlockName}
                          onChange={(e) => setNewBlockName(e.target.value)}
                          className={`w-full px-3 py-2 rounded-xl text-xs font-semibold border outline-none ${
                            isNitido ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-900 border-slate-700 text-white'
                          }`}
                        />
                      </div>
                      <div>
                        <label className={`text-[11px] font-bold block mb-1 ${isNitido ? 'text-slate-700' : 'text-slate-300'}`}>
                          Hora Inicio
                        </label>
                        <input
                          type="time"
                          value={newBlockStart}
                          onChange={(e) => setNewBlockStart(e.target.value)}
                          className={`w-full px-3 py-2 rounded-xl text-xs font-bold border outline-none ${
                            isNitido ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-900 border-slate-700 text-white'
                          }`}
                        />
                      </div>
                      <div>
                        <label className={`text-[11px] font-bold block mb-1 ${isNitido ? 'text-slate-700' : 'text-slate-300'}`}>
                          Hora Fin
                        </label>
                        <input
                          type="time"
                          value={newBlockEnd}
                          onChange={(e) => setNewBlockEnd(e.target.value)}
                          className={`w-full px-3 py-2 rounded-xl text-xs font-bold border outline-none ${
                            isNitido ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-900 border-slate-700 text-white'
                          }`}
                        />
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[11px] font-bold mr-1 ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
                          Días:
                        </span>
                        {DAYS_OF_WEEK.map((d) => {
                          const active = newBlockDays.includes(d.idx);
                          return (
                            <button
                              key={d.idx}
                              type="button"
                              onClick={() =>
                                setNewBlockDays((prev) =>
                                  prev.includes(d.idx) ? prev.filter((x) => x !== d.idx) : [...prev, d.idx]
                                )
                              }
                              className={`w-7 h-7 rounded-lg text-[11px] font-black border transition-all ${
                                active
                                  ? 'bg-indigo-600 text-white border-indigo-600'
                                  : isNitido
                                  ? 'bg-white text-slate-600 border-slate-200'
                                  : 'bg-slate-900 text-slate-400 border-slate-700'
                              }`}
                            >
                              {d.short}
                            </button>
                          );
                        })}
                      </div>

                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                          <input
                            type="checkbox"
                            checked={newBlockAllowCritical}
                            onChange={(e) => setNewBlockAllowCritical(e.target.checked)}
                            className="rounded text-indigo-600"
                          />
                          <span>Permitir alertas Críticas</span>
                        </label>

                        <button
                          type="submit"
                          className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold"
                        >
                          Guardar Horario
                        </button>
                      </div>
                    </div>
                  </form>
                )}

                {/* Existing Schedule Blocks */}
                <div className="space-y-3">
                  {preferences.quietSchedules.map((block) => {
                    const isSleep = block.presetType === 'sleep';
                    const isWork = block.presetType === 'work';
                    const isCurrentlyActive =
                      currentDndStatus.isDnd && currentDndStatus.activeBlock?.id === block.id;

                    return (
                      <div
                        key={block.id}
                        className={`p-4 rounded-2xl border transition-all space-y-3 ${
                          block.enabled && preferences.dndMasterEnabled
                            ? isNitido
                              ? 'bg-white border-slate-200 shadow-2xs'
                              : 'bg-slate-950/60 border-slate-800'
                            : isNitido
                            ? 'bg-slate-50/80 border-slate-200 opacity-75'
                            : 'bg-slate-900/40 border-slate-800 opacity-70'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                                isSleep
                                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                  : isWork
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : 'bg-cyan-50 text-cyan-700 border-cyan-200'
                              }`}
                            >
                              {isSleep ? (
                                <Moon className="w-4 h-4" />
                              ) : isWork ? (
                                <Briefcase className="w-4 h-4" />
                              ) : (
                                <Clock className="w-4 h-4" />
                              )}
                            </div>

                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <input
                                  type="text"
                                  value={block.name}
                                  onChange={(e) => handleUpdateBlockField(block.id, { name: e.target.value })}
                                  aria-label="Nombre del bloque de no molestar"
                                  className={`text-sm font-black bg-transparent border-b border-transparent focus:border-indigo-400 outline-none ${
                                    isNitido ? 'text-slate-900' : 'text-white'
                                  }`}
                                />
                                {isCurrentlyActive && (
                                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-600 text-white">
                                    En curso ahora
                                  </span>
                                )}
                              </div>
                              <p className={`text-[11px] ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
                                {block.startTime > block.endTime
                                  ? 'Tramo nocturno (cruza medianoche)'
                                  : 'Tramo diurno'}
                                {' · '}
                                {block.allowCriticalOverride
                                  ? 'Solo deja pasar alertas Críticas'
                                  : 'Silencio total (sin excepciones)'}
                              </p>
                            </div>
                          </div>

                          {/* Time Range & Toggle Controls */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="flex items-center gap-1.5">
                              <input
                                type="time"
                                value={block.startTime}
                                onChange={(e) => handleUpdateBlockField(block.id, { startTime: e.target.value })}
                                aria-label={`Hora inicio ${block.name}`}
                                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border outline-none ${
                                  isNitido
                                    ? 'bg-slate-50 border-slate-200 text-slate-900'
                                    : 'bg-slate-900 border-slate-700 text-white'
                                }`}
                              />
                              <span className="text-xs font-bold text-slate-400">a</span>
                              <input
                                type="time"
                                value={block.endTime}
                                onChange={(e) => handleUpdateBlockField(block.id, { endTime: e.target.value })}
                                aria-label={`Hora fin ${block.name}`}
                                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border outline-none ${
                                  isNitido
                                    ? 'bg-slate-50 border-slate-200 text-slate-900'
                                    : 'bg-slate-900 border-slate-700 text-white'
                                }`}
                              />
                            </div>

                            <button
                              type="button"
                              onClick={() => handleToggleBlock(block.id)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                                block.enabled
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : isNitido
                                  ? 'bg-slate-100 text-slate-500 border-slate-200'
                                  : 'bg-slate-800 text-slate-400 border-slate-700'
                              }`}
                            >
                              {block.enabled ? 'Activo ✓' : 'Pausado'}
                            </button>

                            {block.presetType === 'custom' && (
                              <button
                                type="button"
                                onClick={() => handleDeleteBlock(block.id)}
                                title="Eliminar horario personalizado"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Days of Week + Critical Override Toggle */}
                        <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`text-[11px] font-bold mr-1 ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
                              Días activos:
                            </span>
                            {DAYS_OF_WEEK.map((d) => {
                              const isDayActive = block.days.includes(d.idx);
                              return (
                                <button
                                  key={d.idx}
                                  type="button"
                                  title={d.full}
                                  onClick={() => handleToggleBlockDay(block.id, d.idx)}
                                  className={`w-7 h-7 rounded-lg text-[11px] font-black border transition-all ${
                                    isDayActive
                                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                                      : isNitido
                                      ? 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                                      : 'bg-slate-900 text-slate-400 border-slate-700 hover:bg-slate-800'
                                  }`}
                                >
                                  {d.short}
                                </button>
                              );
                            })}
                          </div>

                          <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                            <input
                              type="checkbox"
                              checked={block.allowCriticalOverride}
                              onChange={(e) =>
                                handleUpdateBlockField(block.id, { allowCriticalOverride: e.target.checked })
                              }
                              className="w-4 h-4 rounded text-rose-600 cursor-pointer"
                            />
                            <span className={isNitido ? 'text-slate-700' : 'text-slate-300'}>
                              Permitir excepción para alertas <strong className="text-rose-600">Críticas</strong>
                            </span>
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Digest Mode & Silenced Notifications Queue */}
              <div
                className={`p-4 rounded-2xl border space-y-3 ${
                  isNitido ? 'bg-slate-50/80 border-slate-200' : 'bg-slate-950/60 border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <Inbox className="w-5 h-5 text-indigo-500 mt-0.5 shrink-0" />
                    <div>
                      <h4 className={`text-xs sm:text-sm font-bold ${isNitido ? 'text-slate-900' : 'text-white'}`}>
                        Resumen Post-Silencio (Digest de Alertas Retenidas)
                      </h4>
                      <p className={`text-[11px] mt-0.5 ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
                        Las alertas silenciadas durante tus horas de sueño o trabajo se guardan en silencio para que puedas revisarlas después sin perder información importante.
                      </p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    aria-label="Activar resumen de alertas retenidas durante No Molestar"
                    checked={preferences.digestModeDuringDnd}
                    onChange={(e) =>
                      updatePrefs({ ...preferences, digestModeDuringDnd: e.target.checked })
                    }
                    className="w-4 h-4 rounded text-indigo-600 cursor-pointer shrink-0"
                  />
                </div>

                {queuedDndAlerts.length > 0 && (
                  <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300">
                        Alertas retenidas en silencio ({queuedDndAlerts.length}):
                      </span>
                      <button
                        type="button"
                        onClick={handleClearDigest}
                        className="text-[11px] font-bold text-slate-500 hover:text-rose-600"
                      >
                        Marcar como revisadas
                      </button>
                    </div>
                    <div className="space-y-1.5 max-h-36 overflow-y-auto">
                      {queuedDndAlerts.map((q) => (
                        <div
                          key={q.id}
                          className={`p-2.5 rounded-xl border text-xs flex items-start justify-between gap-2 ${
                            isNitido ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
                          }`}
                        >
                          <div>
                            <p className="font-bold">{q.title}</p>
                            <p className="text-[11px] text-slate-500">{q.body}</p>
                            {q.suppressedReason && (
                              <span className="text-[10px] text-indigo-600 font-semibold block mt-0.5">
                                {q.suppressedReason}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 shrink-0">
                            {new Date(q.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 2: PRIORIDADES DE NOTIFICACIONES AUTOMÁTICAS DE GASTOS     */}
          {/* ============================================================== */}
          {activeTab === 'priorities' && (
            <div className="space-y-6">
              {/* Minimum Priority Filter in Active Hours */}
              <div
                className={`p-4 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  isNitido ? 'bg-slate-50/80 border-slate-200' : 'bg-slate-950/60 border-slate-800'
                }`}
              >
                <div>
                  <h4 className={`text-sm font-black ${isNitido ? 'text-slate-900' : 'text-white'}`}>
                    Umbral Mínimo de Prioridad (Horario Normal)
                  </h4>
                  <p className={`text-xs mt-0.5 ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
                    Define desde qué nivel de importancia deseas recibir notificaciones automáticas incluso fuera de "No Molestar".
                  </p>
                </div>

                <div className={`flex items-center p-1 rounded-xl border shrink-0 ${isNitido ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-700'}`}>
                  {PRIORITY_OPTIONS.slice().reverse().map((opt) => {
                    const isSelected = preferences.minimumActivePriority === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() =>
                          updatePrefs(
                            { ...preferences, minimumActivePriority: opt.value },
                            `Filtro mínimo establecido en: ${opt.label}`
                          )
                        }
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                          isSelected
                            ? isNitido
                              ? opt.nitidoActive
                              : opt.darkActive
                            : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        {opt.value === 'baja' ? 'Todas (Baja+)' : `${opt.label}+`}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Section A: Automated Expense Rules Priorities */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className={`text-xs font-black uppercase tracking-wider ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
                    Prioridad por Tipo de Evento Financiero
                  </h4>
                  <span className={`text-[11px] font-semibold ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
                    Solo alertas "Críticas" pueden cruzar franjas con excepción
                  </span>
                </div>

                <div className="space-y-2.5">
                  {preferences.expenseRules.map((rule) => (
                    <div
                      key={rule.id}
                      className={`p-3.5 sm:p-4 rounded-2xl border flex flex-col lg:flex-row lg:items-center justify-between gap-3 transition-all ${
                        rule.enabled
                          ? isNitido
                            ? 'bg-white border-slate-200 shadow-2xs'
                            : 'bg-slate-950/60 border-slate-800'
                          : isNitido
                          ? 'bg-slate-50 border-slate-200 opacity-65'
                          : 'bg-slate-900/40 border-slate-800 opacity-60'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={rule.enabled}
                          onChange={() => handleToggleRuleEnabled(rule.id)}
                          aria-label={`Activar regla ${rule.label}`}
                          className="w-4 h-4 mt-1 rounded text-indigo-600 cursor-pointer shrink-0"
                        />
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-xs sm:text-sm font-bold ${isNitido ? 'text-slate-900' : 'text-white'}`}>
                              {rule.label}
                            </span>
                            {rule.minAmountThreshold > 0 && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                                Desde {currSym}{rule.minAmountThreshold}
                              </span>
                            )}
                          </div>
                          <p className={`text-[11px] mt-0.5 ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
                            {rule.description}
                          </p>
                        </div>
                      </div>

                      {/* Controls: Min Amount + Priority Selector */}
                      <div className="flex items-center gap-2.5 flex-wrap shrink-0 justify-end">
                        <div className="flex items-center gap-1" title="Monto mínimo del gasto para notificar">
                          <span className={`text-[10px] font-bold ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
                            Mín ({currSym}):
                          </span>
                          <input
                            type="number"
                            min={0}
                            step={5}
                            value={rule.minAmountThreshold}
                            onChange={(e) => handleUpdateRuleThreshold(rule.id, Number(e.target.value) || 0)}
                            className={`w-16 px-2 py-1 rounded-lg text-xs font-bold border outline-none ${
                              isNitido
                                ? 'bg-slate-50 border-slate-200 text-slate-900'
                                : 'bg-slate-900 border-slate-700 text-white'
                            }`}
                          />
                        </div>

                        <div className={`flex items-center p-0.5 rounded-xl border ${isNitido ? 'bg-slate-100 border-slate-200' : 'bg-slate-900 border-slate-700'}`}>
                          {PRIORITY_OPTIONS.map((opt) => {
                            const active = rule.priority === opt.value;
                            return (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => handleUpdateRulePriority(rule.id, opt.value)}
                                className={`px-2 py-1 rounded-lg text-[11px] font-bold border transition-all ${
                                  active
                                    ? isNitido
                                      ? opt.nitidoActive
                                      : opt.darkActive
                                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-white'
                                }`}
                              >
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section B: Category-Specific Priority Matrix */}
              <div className="space-y-3">
                <div>
                  <h4 className={`text-xs font-black uppercase tracking-wider ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
                    Prioridad Específica por Categoría de Gasto
                  </h4>
                  <p className={`text-[11px] mt-0.5 ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
                    Asigna mayor urgencia a rubros esenciales (Vivienda, Salud) y baja prioridad a categorías flexibles (Ocio) para evitar distracciones.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {EXPENSE_CATEGORIES.map((cat) => {
                    const currentPriority = preferences.categoryPriorities[cat.key] || 'media';
                    return (
                      <div
                        key={cat.key}
                        className={`p-3 rounded-2xl border space-y-2 ${
                          isNitido ? 'bg-white border-slate-200 shadow-2xs' : 'bg-slate-950/60 border-slate-800'
                        }`}
                      >
                        <span className={`text-xs font-black block ${isNitido ? 'text-slate-900' : 'text-white'}`}>
                          {cat.label}
                        </span>
                        <div className="grid grid-cols-4 gap-1">
                          {PRIORITY_OPTIONS.map((opt) => {
                            const active = currentPriority === opt.value;
                            return (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => handleUpdateCategoryPriority(cat.key, opt.value)}
                                className={`py-1 rounded-lg text-[10px] font-bold border transition-all ${
                                  active
                                    ? isNitido
                                      ? opt.nitidoActive
                                      : opt.darkActive
                                    : isNitido
                                    ? 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800'
                                }`}
                              >
                                {opt.label.slice(0, 4)}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Section C: Interactive Policy Simulator ("¿Me notificaría?") */}
              <div
                className={`p-4 rounded-2xl border space-y-3 ${
                  isNitido ? 'bg-indigo-50/50 border-indigo-200' : 'bg-indigo-950/30 border-indigo-800/60'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Play className="w-4 h-4 text-indigo-600" />
                  <h4 className={`text-xs sm:text-sm font-black ${isNitido ? 'text-slate-900' : 'text-white'}`}>
                    Simulador de Reglas: ¿Me interrumpiría esta alerta?
                  </h4>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Hora Simulada</label>
                    <input
                      type="time"
                      value={simTime}
                      onChange={(e) => setSimTime(e.target.value)}
                      className={`w-full px-2.5 py-1.5 rounded-xl text-xs font-bold border ${
                        isNitido ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-700 text-white'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Día</label>
                    <select
                      value={simDay}
                      onChange={(e) => setSimDay(Number(e.target.value))}
                      className={`w-full px-2.5 py-1.5 rounded-xl text-xs font-bold border ${
                        isNitido ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-700 text-white'
                      }`}
                    >
                      {DAYS_OF_WEEK.map((d) => (
                        <option key={d.idx} value={d.idx}>
                          {d.full}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Tipo de Evento</label>
                    <select
                      value={simRuleId}
                      onChange={(e) => setSimRuleId(e.target.value)}
                      className={`w-full px-2.5 py-1.5 rounded-xl text-xs font-bold border ${
                        isNitido ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-700 text-white'
                      }`}
                    >
                      {preferences.expenseRules.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Categoría</label>
                    <select
                      value={simCategory}
                      onChange={(e) => setSimCategory(e.target.value)}
                      className={`w-full px-2.5 py-1.5 rounded-xl text-xs font-bold border ${
                        isNitido ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-700 text-white'
                      }`}
                    >
                      {EXPENSE_CATEGORIES.map((c) => (
                        <option key={c.key} value={c.key}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Simulator Outcome Banner */}
                <div
                  className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs ${
                    simulatorResult.allow
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : simulatorResult.suppressedByDnd
                      ? 'bg-indigo-100/80 border-indigo-300 text-indigo-950'
                      : 'bg-slate-100 border-slate-300 text-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {simulatorResult.allow ? (
                      <Bell className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <BellOff className="w-4 h-4 text-indigo-700 shrink-0" />
                    )}
                    <div>
                      <span className="font-black">
                        {simulatorResult.allow
                          ? '🔔 SÍ notifica en tiempo real'
                          : simulatorResult.suppressedByDnd
                          ? simulatorResult.queuedForDigest
                            ? '🌙 SILENCIADA — Guardada para Resumen Post-DND'
                            : '🌙 BLOQUEADA — Silencio total por No Molestar'
                          : '🔕 FILTRADA — No interrumpe'}
                      </span>
                      <p className="text-[11px] opacity-85">{simulatorResult.reason}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-white/80 border border-current shrink-0">
                    Prioridad efectiva: {simulatorResult.effectivePriority}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 3: PERFIL FINANCIERO Y UMBRALES BASE                       */}
          {/* ============================================================== */}
          {activeTab === 'profile' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={`text-xs font-bold block mb-1.5 ${isNitido ? 'text-slate-700' : 'text-slate-300'}`}>
                    País y Moneda
                  </label>
                  <select
                    value={profile.country}
                    onChange={(e) => {
                      const c = POPULAR_COUNTRIES.find((x) => x.name === e.target.value);
                      onUpdateProfile({
                        country: e.target.value,
                        currency: c?.currency || profile.currency,
                        currencySymbol: c?.symbol || profile.currencySymbol,
                      });
                      showSavedFeedback('País y moneda actualizados');
                    }}
                    className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-semibold border outline-none ${
                      isNitido ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-950 border-slate-700 text-white'
                    }`}
                  >
                    {POPULAR_COUNTRIES.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name} ({c.currency} · {c.symbol})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={`text-xs font-bold block mb-1.5 ${isNitido ? 'text-slate-700' : 'text-slate-300'}`}>
                    Ciudad de Residencia
                  </label>
                  <input
                    type="text"
                    value={profile.city}
                    onChange={(e) => {
                      onUpdateProfile({ city: e.target.value });
                      showSavedFeedback('Ciudad actualizada');
                    }}
                    className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-semibold border outline-none ${
                      isNitido ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-950 border-slate-700 text-white'
                    }`}
                  />
                </div>

                <div>
                  <label className={`text-xs font-bold block mb-1.5 ${isNitido ? 'text-slate-700' : 'text-slate-300'}`}>
                    Ingreso Mensual Neto ({profile.currencySymbol})
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={profile.monthlyIncome}
                    onChange={(e) => {
                      onUpdateProfile({ monthlyIncome: Math.max(0, Number(e.target.value) || 0) });
                      showSavedFeedback('Ingreso mensual actualizado');
                    }}
                    className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-bold border outline-none ${
                      isNitido ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-950 border-slate-700 text-white'
                    }`}
                  />
                </div>

                <div>
                  <label className={`text-xs font-bold block mb-1.5 ${isNitido ? 'text-slate-700' : 'text-slate-300'}`}>
                    Meta de Ahorro Objetivo (%)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={80}
                    value={profile.savingsGoalPercent}
                    onChange={(e) => {
                      onUpdateProfile({ savingsGoalPercent: Math.min(80, Math.max(1, Number(e.target.value) || 20)) });
                      showSavedFeedback('Meta de ahorro actualizada');
                    }}
                    className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-bold border outline-none ${
                      isNitido ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-950 border-slate-700 text-white'
                    }`}
                  />
                </div>

                <div>
                  <label className={`text-xs font-bold block mb-1.5 ${isNitido ? 'text-slate-700' : 'text-slate-300'}`}>
                    Umbral Alerta Transporte ({profile.currencySymbol})
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={profile.transportAlertThreshold}
                    onChange={(e) => {
                      onUpdateProfile({ transportAlertThreshold: Math.max(0, Number(e.target.value) || 0) });
                      showSavedFeedback('Umbral de transporte actualizado');
                    }}
                    className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-bold border outline-none ${
                      isNitido ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-950 border-slate-700 text-white'
                    }`}
                  />
                </div>

                <div>
                  <label className={`text-xs font-bold block mb-1.5 ${isNitido ? 'text-slate-700' : 'text-slate-300'}`}>
                    Umbral Alerta Alquiler ({profile.currencySymbol})
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={profile.rentAlertThreshold}
                    onChange={(e) => {
                      onUpdateProfile({ rentAlertThreshold: Math.max(0, Number(e.target.value) || 0) });
                      showSavedFeedback('Umbral de alquiler actualizado');
                    }}
                    className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-bold border outline-none ${
                      isNitido ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-950 border-slate-700 text-white'
                    }`}
                  />
                </div>
              </div>

              {onOpenPushSettings && (
                <div
                  className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isNitido ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/60 border-slate-800'
                  }`}
                >
                  <div>
                    <p className={`text-xs font-bold ${isNitido ? 'text-slate-900' : 'text-white'}`}>
                      Permisos Web Push e Historial de Notificaciones
                    </p>
                    <p className={`text-[11px] ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
                      Gestiona el permiso del navegador, realiza pruebas en segundo plano y consulta el registro de envíos.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenPushSettings();
                    }}
                    className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shrink-0"
                  >
                    Abrir Centro Push
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className={`px-5 sm:px-6 py-3.5 border-t flex items-center justify-between ${
            isNitido ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'
          }`}
        >
          <span className={`text-[11px] font-semibold flex items-center gap-1.5 ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            Todos los cambios se aplican y guardan automáticamente
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-colors"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
};
