import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  AlertCircle,
  AlertOctagon,
  CheckCircle2,
  Bell,
  Sliders,
  ArrowRight,
  TrendingUp,
  Sparkles,
  Car,
  Home,
  Coffee,
  Zap,
  ShoppingBag,
  HeartPulse,
  BookOpen,
  DollarSign,
  X,
  ChevronDown,
  ChevronUp,
  Calendar,
  Clock,
  Check,
  RotateCcw,
  Layers,
  Filter,
  CreditCard,
  Moon
} from 'lucide-react';
import { PaymentItem, UserFinancialProfile, CategoryAlert } from '../types';
import { AlertThresholdConfigModal } from './AlertThresholdConfigModal';
import { autocompleteCategoryBudgets } from '../services/budgetAutocompleteService';
import { useTheme } from '../context/ThemeContext';

interface BudgetAlertsPanelProps {
  payments: PaymentItem[];
  profile: UserFinancialProfile;
  categoryBudgets: Record<string, number>;
  onUpdateCategoryBudgets: (updated: Record<string, number>) => void;
  alertThresholds?: Record<string, number>;
  globalAlertThreshold?: number;
  onUpdateAlertThresholds?: (thresholds: Record<string, number>, globalThreshold: number) => void;
  onTogglePaymentStatus?: (id: string) => void;
  onNavigateToRadar?: () => void;
  onOpenVoiceAssistant?: (prompt: string) => void;
  onOpenNotificationCenter?: () => void;
  onOpenOptimizer?: () => void;
  onOpenAutocomplete?: () => void;
  onOpenUserSettings?: (tab?: 'dnd' | 'priorities' | 'profile') => void;
  isDndActive?: boolean;
}

export const BudgetAlertsPanel: React.FC<BudgetAlertsPanelProps> = ({
  payments,
  profile,
  categoryBudgets,
  onUpdateCategoryBudgets,
  alertThresholds = {},
  globalAlertThreshold = 80,
  onUpdateAlertThresholds,
  onTogglePaymentStatus,
  onNavigateToRadar,
  onOpenVoiceAssistant,
  onOpenNotificationCenter,
  onOpenOptimizer,
  onOpenAutocomplete,
  onOpenUserSettings,
  isDndActive = false,
}) => {
  const { isNitido, isVibrant } = useTheme();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isThresholdModalOpen, setIsThresholdModalOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<'all' | 'recurring' | 'budgets'>('all');
  const [filterMode, setFilterMode] = useState<'alerts' | 'all'>('all');
  const [recurringFilter, setRecurringFilter] = useState<'pending' | 'urgent' | 'all'>('pending');
  const [tempBudgets, setTempBudgets] = useState<Record<string, number>>(categoryBudgets);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const CATEGORY_META: Record<string, { label: string; icon: any; color: string; bg: string }> = {
    transporte: { label: 'Transporte / Movilidad', icon: Car, color: 'text-amber-500', bg: 'bg-amber-50 text-amber-700 border-amber-200' },
    alquiler: { label: 'Vivienda / Alquiler', icon: Home, color: 'text-indigo-500', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    alimentacion: { label: 'Alimentación / Despensa', icon: ShoppingBag, color: 'text-rose-500', bg: 'bg-rose-50 text-rose-700 border-rose-200' },
    servicios: { label: 'Servicios Básicos (Luz/Agua/Net)', icon: Zap, color: 'text-cyan-500', bg: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
    ocio: { label: 'Ocio y Restaurantes', icon: Coffee, color: 'text-purple-500', bg: 'bg-purple-50 text-purple-700 border-purple-200' },
    salud: { label: 'Salud y Farmacia', icon: HeartPulse, color: 'text-emerald-500', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    educacion: { label: 'Educación y Cursos', icon: BookOpen, color: 'text-blue-500', bg: 'bg-blue-50 text-blue-700 border-blue-200' },
    otro: { label: 'Otros Gastos', icon: DollarSign, color: 'text-slate-500', bg: 'bg-slate-100 text-slate-700 border-slate-200' },
  };

  // 1. UPCOMING RECURRING EXPENSES CALCULATION
  const upcomingRecurringExpenses = useMemo(() => {
    return payments
      .filter((p) => p.type === 'gasto' && (p.isFixed || p.frequency !== 'unico'))
      .map((p) => {
        const [year, month, day] = (p.dueDate || '').split('-').map(Number);
        const dueDateObj = year && month && day ? new Date(year, month - 1, day) : new Date();
        dueDateObj.setHours(0, 0, 0, 0);
        const diffDays = Math.round((dueDateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        let urgency: 'overdue' | 'today' | 'soon' | 'upcoming' = 'upcoming';
        if (diffDays < 0) urgency = 'overdue';
        else if (diffDays === 0) urgency = 'today';
        else if (diffDays <= 7) urgency = 'soon';

        return {
          ...p,
          diffDays,
          urgency,
        };
      })
      .sort((a, b) => {
        // Pending first, then by ascending diffDays
        if (a.status === 'pendiente' && b.status === 'pagado') return -1;
        if (a.status === 'pagado' && b.status === 'pendiente') return 1;
        return a.diffDays - b.diffDays;
      });
  }, [payments, today]);

  const pendingRecurring = upcomingRecurringExpenses.filter((p) => p.status === 'pendiente');
  const urgentRecurring = pendingRecurring.filter((p) => p.diffDays <= 7);
  const totalPendingRecurringAmount = pendingRecurring.reduce((sum, p) => sum + p.amount, 0);

  const displayedRecurring = useMemo(() => {
    if (recurringFilter === 'pending') return pendingRecurring;
    if (recurringFilter === 'urgent') return urgentRecurring;
    return upcomingRecurringExpenses;
  }, [upcomingRecurringExpenses, pendingRecurring, urgentRecurring, recurringFilter]);

  // 2. CATEGORY BUDGET WARNING THRESHOLDS CALCULATION
  const spendingByCategory: Record<string, number> = useMemo(() => {
    const acc: Record<string, number> = {};
    payments
      .filter((p) => p.type === 'gasto')
      .forEach((p) => {
        acc[p.category] = (acc[p.category] || 0) + p.amount;
      });
    return acc;
  }, [payments]);

  const allCategoryAlerts: CategoryAlert[] = Object.keys(CATEGORY_META).map((cat) => {
    const spent = spendingByCategory[cat] || 0;
    const budget = categoryBudgets[cat] || 100;
    const percentage = Math.round((spent / budget) * 100);
    const threshold = alertThresholds[cat] || globalAlertThreshold || 80;

    let status: CategoryAlert['status'] = 'safe';
    let message = `Gasto bajo control (${percentage}% consumido, alerta configurada al ${threshold}%).`;
    let aiRecommendation: string | undefined = undefined;

    if (percentage >= 100) {
      status = 'exceeded';
      const excess = spent - budget;
      message = `¡Presupuesto superado en ${percentage}%! Exceso de ${profile.currencySymbol}${excess.toLocaleString()}.`;
      if (cat === 'transporte') {
        aiRecommendation = 'Gasto crítico en transporte: Recomendado evaluar compra de vehículo propio para amortizar cuota mensual.';
      } else if (cat === 'alquiler') {
        aiRecommendation = 'Alquiler elevado: Evaluar opciones de crédito hipotecario para adquirir vivienda propia.';
      } else {
        aiRecommendation = `Has sobrepasado el límite mensual asignado para ${CATEGORY_META[cat]?.label}. Revisa pagos variables programados.`;
      }
    } else if (percentage >= threshold) {
      status = 'warning';
      const remaining = budget - spent;
      message = `¡Atención! Has alcanzado el ${percentage}% de tu presupuesto (superando tu umbral individual de alerta fijado al ${threshold}%). Margen restante: ${profile.currencySymbol}${remaining.toLocaleString()}.`;
      if (cat === 'transporte') {
        aiRecommendation = `Consumo de transporte al ${percentage}% (umbral ${threshold}%). Te sugerimos optimizar traslados o consultar el Radar de Autos.`;
      } else {
        aiRecommendation = `Has alcanzado el límite preventivo del ${threshold}% fijado para ${CATEGORY_META[cat]?.label}. Margen restante: ${profile.currencySymbol}${remaining.toLocaleString()}.`;
      }
    }

    return {
      category: cat,
      categoryLabel: CATEGORY_META[cat]?.label || cat,
      spent,
      budget,
      percentage,
      threshold,
      status,
      message,
      aiRecommendation,
    };
  });

  const activeAlerts = allCategoryAlerts.filter((a) => a.status === 'warning' || a.status === 'exceeded');
  const displayedAlerts = filterMode === 'alerts' ? activeAlerts : allCategoryAlerts;

  // Individual category threshold update handler
  const handleUpdateCategoryThreshold = (category: string, newThreshold: number) => {
    const updated = {
      ...alertThresholds,
      [category]: newThreshold,
    };
    if (onUpdateAlertThresholds) {
      onUpdateAlertThresholds(updated, globalAlertThreshold);
    }
  };

  const handleSaveBudgets = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateCategoryBudgets(tempBudgets);
    setIsEditModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* 1. Main Header of the Alert Management Panel */}
      <div
        className={`p-5 sm:p-6 rounded-3xl border shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-all ${
          isNitido ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-800 text-white'
        }`}
      >
        <div className="flex items-start gap-3.5">
          <div
            className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border ${
              activeAlerts.length > 0 || urgentRecurring.length > 0
                ? isNitido
                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                  : 'bg-amber-500/15 text-amber-400 border-amber-500/30 animate-pulse'
                : isNitido
                ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
            }`}
          >
            <Bell className="w-6 h-6" />
          </div>

          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className={`text-base sm:text-lg font-black tracking-tight ${isNitido ? 'text-slate-900' : 'text-white'}`}>
                Gestión de Alertas Financieras
              </h3>
              <span
                className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                  activeAlerts.length > 0
                    ? isNitido
                      ? 'bg-amber-100 text-amber-900 border-amber-300'
                      : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                    : isNitido
                    ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                    : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                }`}
              >
                {activeAlerts.length > 0
                  ? `${activeAlerts.length} categoría(s) en alerta activa`
                  : 'Presupuestos en rango seguro'}
              </span>
              {pendingRecurring.length > 0 && (
                <span
                  className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                    isNitido
                      ? 'bg-indigo-50 text-indigo-900 border-indigo-200'
                      : 'bg-indigo-950/70 text-indigo-300 border-indigo-700'
                  }`}
                >
                  {pendingRecurring.length} gastos recurrentes próximos
                </span>
              )}
            </div>

            <p className={`text-xs mt-1 leading-relaxed max-w-2xl ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
              Supervisa vencimientos de gastos recurrentes y ajusta individualmente los umbrales de advertencia de presupuesto (50%, 75%, 80%, 90%) para cada categoría.
            </p>
          </div>
        </div>

        {/* Action Controls & Batch Modals */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button
            onClick={() => setIsThresholdModalOpen(true)}
            title="Abrir asistente de umbrales globales y configuración por lotes"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
              isNitido
                ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300'
                : 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border-amber-500/30'
            }`}
          >
            <Sliders className="w-3.5 h-3.5 text-amber-600" />
            <span>Umbral Global ({globalAlertThreshold}%)</span>
          </button>

          {onOpenNotificationCenter && (
            <button
              onClick={onOpenNotificationCenter}
              title="Configurar Notificaciones Web Push y Alertas en Segundo Plano"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                isNitido
                  ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border-indigo-300'
                  : 'bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border-indigo-500/30'
              }`}
            >
              <Bell className="w-3.5 h-3.5 text-indigo-600" />
              <span>Alertas Push</span>
            </button>
          )}

          {onOpenUserSettings && (
            <button
              onClick={() => onOpenUserSettings('dnd')}
              title="Definir horarios de No Molestar (sueño/trabajo) y prioridades de alertas"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                isDndActive
                  ? isNitido
                    ? 'bg-indigo-600 text-white border-indigo-700'
                    : 'bg-indigo-600 text-white border-indigo-500'
                  : isNitido
                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
            >
              <Moon className="w-3.5 h-3.5" />
              <span>{isDndActive ? 'No Molestar Activo' : 'No Molestar y Prioridades'}</span>
            </button>
          )}

          {onOpenOptimizer && (
            <button
              onClick={onOpenOptimizer}
              title="Optimizar límites de presupuesto con IA"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs ${
                isNitido
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Optimizar IA</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Navigation Tabs (Todas / Gastos Recurrentes / Umbrales por Categoría) */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveSection('all')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border shrink-0 ${
            activeSection === 'all'
              ? isNitido
                ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                : 'bg-indigo-600 text-white border-indigo-500 shadow-md'
              : isNitido
              ? 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
              : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Vista Completa de Alertas</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('recurring')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border shrink-0 ${
            activeSection === 'recurring'
              ? isNitido
                ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                : 'bg-indigo-600 text-white border-indigo-500 shadow-md'
              : isNitido
              ? 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
              : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Gastos Recurrentes Próximos ({pendingRecurring.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('budgets')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border shrink-0 ${
            activeSection === 'budgets'
              ? isNitido
                ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                : 'bg-indigo-600 text-white border-indigo-500 shadow-md'
              : isNitido
              ? 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
              : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Ajuste de Umbrales por Categoría ({activeAlerts.length} activas)</span>
        </button>
      </div>

      {/* 3. SECTION A: GASTOS RECURRENTES PRÓXIMOS */}
      {(activeSection === 'all' || activeSection === 'recurring') && (
        <div
          className={`p-5 sm:p-6 rounded-3xl border transition-all ${
            isNitido ? 'bg-white border-slate-200/90 shadow-sm' : 'bg-slate-900/95 border-slate-800 shadow-xl'
          } space-y-4`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${
                  isNitido
                    ? 'bg-amber-50 border-amber-200 text-amber-700'
                    : 'bg-amber-950/70 border-amber-700/50 text-amber-400'
                }`}
              >
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h4 className={`text-base font-black tracking-tight ${isNitido ? 'text-slate-900' : 'text-white'}`}>
                  Gastos Recurrentes Próximos
                </h4>
                <p className={`text-xs mt-0.5 ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
                  Pagos fijos, alquiler, suscripciones y servicios próximos a vencer en tu ciclo financiero.
                </p>
              </div>
            </div>

            {/* Quick Filter for Recurring Payments */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl border border-slate-200 bg-slate-100 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setRecurringFilter('pending')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  recurringFilter === 'pending'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Pendientes ({pendingRecurring.length})
              </button>
              <button
                type="button"
                onClick={() => setRecurringFilter('urgent')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  recurringFilter === 'urgent'
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Próximos 7 días ({urgentRecurring.length})
              </button>
              <button
                type="button"
                onClick={() => setRecurringFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  recurringFilter === 'all'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Todos ({upcomingRecurringExpenses.length})
              </button>
            </div>
          </div>

          {/* Metrics Strip for Recurring Payments */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className={`p-3 rounded-2xl border ${isNitido ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
              <span className={`text-[10px] font-bold uppercase tracking-wider block ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
                Total Pendiente Próximo
              </span>
              <span className={`text-base sm:text-lg font-black block mt-0.5 ${isNitido ? 'text-slate-900' : 'text-white'}`}>
                {profile.currencySymbol}{totalPendingRecurringAmount.toLocaleString()}
              </span>
              <span className="text-[10px] text-slate-500 font-semibold">{pendingRecurring.length} pagos programados</span>
            </div>

            <div className={`p-3 rounded-2xl border ${isNitido ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
              <span className={`text-[10px] font-bold uppercase tracking-wider block ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
                Vencimiento Más Urgente
              </span>
              <span className={`text-base sm:text-lg font-black block mt-0.5 truncate ${
                urgentRecurring.length > 0 ? (isNitido ? 'text-amber-800' : 'text-amber-400') : (isNitido ? 'text-emerald-700' : 'text-emerald-400')
              }`}>
                {pendingRecurring[0]?.title || 'Sin pagos urgentes'}
              </span>
              <span className="text-[10px] text-slate-500 font-semibold">
                {pendingRecurring[0] ? `Vence: ${pendingRecurring[0].dueDate}` : 'Al día con pagos'}
              </span>
            </div>

            <div className={`p-3 rounded-2xl border ${isNitido ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
              <span className={`text-[10px] font-bold uppercase tracking-wider block ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
                Estado de Pagos
              </span>
              <span className={`text-base sm:text-lg font-black block mt-0.5 ${isNitido ? 'text-emerald-700' : 'text-emerald-400'}`}>
                {Math.round(((upcomingRecurringExpenses.length - pendingRecurring.length) / (upcomingRecurringExpenses.length || 1)) * 100)}%
              </span>
              <span className="text-[10px] text-slate-500 font-semibold">Pagados este mes</span>
            </div>
          </div>

          {/* List / Grid of Recurring Payments */}
          {displayedRecurring.length === 0 ? (
            <div className={`p-6 text-center rounded-2xl border ${
              isNitido ? 'bg-slate-50 border-slate-200 text-slate-600' : 'bg-slate-950 border-slate-800 text-slate-400'
            }`}>
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-1.5" />
              <p className="text-xs font-bold">No hay gastos recurrentes que coincidan con este filtro.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {displayedRecurring.map((item) => {
                const meta = CATEGORY_META[item.category] || { label: item.category, icon: DollarSign, color: 'text-slate-400', bg: 'bg-slate-100 text-slate-700 border-slate-200' };
                const CategoryIcon = meta.icon;
                const isPaid = item.status === 'pagado';

                return (
                  <div
                    key={item.id}
                    className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between space-y-3 ${
                      isNitido
                        ? isPaid
                          ? 'bg-slate-50/70 border-slate-200'
                          : item.diffDays < 0
                          ? 'bg-white border-rose-300 shadow-2xs'
                          : item.diffDays <= 3
                          ? 'bg-white border-amber-300 shadow-2xs'
                          : 'bg-white border-slate-200 shadow-2xs'
                        : isPaid
                        ? 'bg-slate-900/60 border-slate-800'
                        : item.diffDays < 0
                        ? 'bg-slate-900 border-rose-500/40'
                        : item.diffDays <= 3
                        ? 'bg-slate-900 border-amber-500/40'
                        : 'bg-slate-900 border-slate-800'
                    }`}
                  >
                    <div>
                      {/* Top: Category and Urgency Badge */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${meta.bg}`}>
                            <CategoryIcon className="w-4 h-4" />
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border truncate ${meta.bg}`}>
                            {meta.label}
                          </span>
                        </div>

                        {/* Relative Countdown Badge */}
                        <span
                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border shrink-0 ${
                            isPaid
                              ? isNitido
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                : 'bg-emerald-950 text-emerald-300 border-emerald-700'
                              : item.diffDays < 0
                              ? isNitido
                                ? 'bg-rose-100 text-rose-900 border-rose-300 animate-pulse'
                                : 'bg-rose-950 text-rose-300 border-rose-700 animate-pulse'
                              : item.diffDays === 0
                              ? isNitido
                                ? 'bg-rose-100 text-rose-900 border-rose-300'
                                : 'bg-rose-950 text-rose-300 border-rose-700'
                              : item.diffDays <= 7
                              ? isNitido
                                ? 'bg-amber-100 text-amber-900 border-amber-300'
                                : 'bg-amber-950 text-amber-300 border-amber-700'
                              : isNitido
                              ? 'bg-slate-100 text-slate-700 border-slate-300'
                              : 'bg-slate-800 text-slate-300 border-slate-700'
                          }`}
                        >
                          {isPaid
                            ? '✓ Pagado'
                            : item.diffDays < 0
                            ? `🚨 Vencido (${Math.abs(item.diffDays)}d)`
                            : item.diffDays === 0
                            ? '⏰ Vence Hoy'
                            : item.diffDays <= 7
                            ? `⏳ En ${item.diffDays} días`
                            : `📅 En ${item.diffDays} días`}
                        </span>
                      </div>

                      {/* Title and Amount */}
                      <div className="mt-1">
                        <h5 className={`text-xs sm:text-sm font-black line-clamp-1 ${isNitido ? 'text-slate-900' : 'text-white'}`}>
                          {item.title}
                        </h5>
                        <div className="flex items-center justify-between mt-1.5">
                          <span className={`text-base font-black ${isNitido ? 'text-slate-900' : 'text-white'}`}>
                            -{profile.currencySymbol}{item.amount.toLocaleString()}
                          </span>
                          <span className={`text-[10px] font-bold capitalize ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
                            {item.frequency || 'Mensual'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom: Due date and quick status toggle */}
                    <div className={`pt-2 border-t flex items-center justify-between gap-2 text-xs ${
                      isNitido ? 'border-slate-100' : 'border-slate-800'
                    }`}>
                      <div className={`flex items-center gap-1 text-[11px] font-semibold ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
                        <Calendar className="w-3 h-3 text-slate-500" />
                        <span>Vence: {item.dueDate}</span>
                      </div>

                      {onTogglePaymentStatus && (
                        <button
                          type="button"
                          onClick={() => onTogglePaymentStatus(item.id)}
                          className={`text-[11px] font-bold px-2.5 py-1 rounded-xl transition-all border ${
                            isPaid
                              ? isNitido
                                ? 'bg-white hover:bg-slate-100 text-slate-600 border-slate-200'
                                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                              : isNitido
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700 shadow-2xs'
                              : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 shadow-2xs'
                          }`}
                        >
                          {isPaid ? 'Marcar Pendiente' : 'Pagar ✓'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 4. SECTION B: AJUSTE INDIVIDUAL DE UMBRALES DE ADVERTENCIA DE PRESUPUESTO POR CATEGORÍA */}
      {(activeSection === 'all' || activeSection === 'budgets') && (
        <div className="space-y-4">
          <div
            className={`p-5 rounded-3xl border ${
              isNitido ? 'bg-white border-slate-200/90 shadow-sm' : 'bg-slate-900/95 border-slate-800 shadow-xl'
            } flex flex-col sm:flex-row sm:items-center justify-between gap-3`}
          >
            <div>
              <h4 className={`text-base font-black tracking-tight ${isNitido ? 'text-slate-900' : 'text-white'}`}>
                Ajuste Individual de Umbrales de Advertencia por Categoría
              </h4>
              <p className={`text-xs mt-0.5 ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
                Personaliza en qué porcentaje de gasto (30% - 95%) deseas que AuraFin dispare alertas de advertencia para cada categoría.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setFilterMode(filterMode === 'alerts' ? 'all' : 'alerts')}
                className={`text-xs px-3 py-1.5 rounded-xl font-bold border transition-colors ${
                  isNitido
                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                }`}
              >
                {filterMode === 'alerts' ? `Ver todas (${allCategoryAlerts.length})` : `Solo alertas activas (${activeAlerts.length})`}
              </button>
            </div>
          </div>

          {/* Alerts Grid with Per-Category Percentage Adjustment Controls */}
          {displayedAlerts.length === 0 ? (
            <div className={`p-8 text-center rounded-3xl border space-y-2 ${
              isNitido ? 'bg-white border-slate-200 text-slate-900 shadow-sm' : 'bg-slate-900/60 border-slate-800 text-white'
            }`}>
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
              <h4 className={`text-sm font-bold ${isNitido ? 'text-slate-900' : 'text-white'}`}>¡Excelente disciplina financiera!</h4>
              <p className={`text-xs max-w-md mx-auto ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
                Ninguna categoría de gasto ha superado sus umbrales de advertencia configurados.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayedAlerts.map((alert) => {
                const meta = CATEGORY_META[alert.category] || {
                  label: alert.category,
                  icon: DollarSign,
                  color: 'text-slate-400',
                  bg: 'bg-slate-100 text-slate-700 border-slate-200',
                };
                const Icon = meta.icon;
                const isExceeded = alert.status === 'exceeded';
                const isWarning = alert.status === 'warning';

                return (
                  <div
                    key={alert.category}
                    className={`p-5 rounded-3xl border transition-all flex flex-col justify-between space-y-3.5 shadow-sm ${
                      isNitido
                        ? isExceeded
                          ? 'bg-white border-rose-300 shadow-rose-100'
                          : isWarning
                          ? 'bg-white border-amber-300 shadow-amber-100'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                        : isExceeded
                        ? 'bg-slate-900 border-rose-500/50 shadow-rose-500/10'
                        : isWarning
                        ? 'bg-slate-900 border-amber-500/50 shadow-amber-500/10'
                        : 'bg-slate-900 border-slate-800/80 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      {/* Category Header */}
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${meta.bg}`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <h4 className={`text-sm font-black truncate ${isNitido ? 'text-slate-900' : 'text-white'}`}>
                              {alert.categoryLabel}
                            </h4>
                            <span className={`text-[10px] uppercase font-bold block ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
                              Límite: {profile.currencySymbol}{alert.budget.toLocaleString()}
                            </span>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <span className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border shrink-0 ${
                          isNitido
                            ? isExceeded
                              ? 'bg-rose-100 text-rose-900 border-rose-300'
                              : isWarning
                              ? 'bg-amber-100 text-amber-900 border-amber-300'
                              : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                            : isExceeded
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                            : isWarning
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                        }`}>
                          {isExceeded
                            ? `🚨 Excedido (${alert.percentage}%)`
                            : isWarning
                            ? `⚠️ Alerta (${alert.percentage}% ≥ ${alert.threshold}%)`
                            : `✓ Seguro (${alert.percentage}%)`}
                        </span>
                      </div>

                      {/* Progress Bar with Configured Threshold Marker */}
                      <div className="space-y-1 mt-3">
                        <div className={`relative h-2.5 w-full rounded-full overflow-hidden border ${
                          isNitido ? 'bg-slate-100 border-slate-200' : 'bg-slate-950 border-slate-800'
                        }`}>
                          <div
                            style={{ width: `${Math.min(100, alert.percentage)}%` }}
                            className={`h-full rounded-full transition-all duration-500 ${
                              isExceeded
                                ? 'bg-rose-600'
                                : isWarning
                                ? 'bg-amber-500'
                                : 'bg-emerald-600'
                            }`}
                          />
                          {/* Configured Threshold Marker */}
                          <div
                            className="absolute top-0 bottom-0 w-0.5 bg-indigo-600 shadow-sm"
                            style={{ left: `${Math.min(98, alert.threshold || 80)}%` }}
                            title={`Umbral de alerta configurado: ${alert.threshold || 80}%`}
                          />
                        </div>

                        <div className={`flex items-center justify-between text-[11px] pt-0.5 ${
                          isNitido ? 'text-slate-600' : 'text-slate-400'
                        }`}>
                          <span>Gastado: <strong className={isNitido ? 'text-slate-900 font-bold' : 'text-white font-bold'}>{profile.currencySymbol}{alert.spent.toLocaleString()}</strong></span>
                          <span className={isNitido ? 'text-slate-700 font-bold' : 'text-cyan-300 font-medium'}>
                            Alerta al {alert.threshold || 80}% ({profile.currencySymbol}{Math.round((alert.budget * (alert.threshold || 80)) / 100)})
                          </span>
                        </div>
                      </div>

                      {/* Specific Percentage-Based Threshold Selector per Category */}
                      <div className={`mt-2.5 p-2.5 rounded-xl border ${
                        isNitido ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/70 border-slate-800'
                      }`}>
                        <div className="flex items-center justify-between gap-1 mb-1.5">
                          <span className={`text-[11px] font-bold flex items-center gap-1 ${isNitido ? 'text-slate-800' : 'text-slate-300'}`}>
                            <Sliders className="w-3 h-3 text-indigo-600" />
                            Ajustar Umbral:
                          </span>
                          <span className={`text-[11px] font-black px-1.5 py-0.5 rounded-md border ${
                            alert.percentage >= (alert.threshold || 80)
                              ? isNitido
                                ? 'bg-amber-100 text-amber-900 border-amber-300'
                                : 'bg-amber-950/80 text-amber-300 border-amber-700/60'
                              : isNitido
                              ? 'bg-slate-200 text-slate-800 border-slate-300'
                              : 'bg-slate-800 text-slate-200 border-slate-700'
                          }`}>
                            {alert.threshold || 80}% ({profile.currencySymbol}{Math.round((alert.budget * (alert.threshold || 80)) / 100)})
                          </span>
                        </div>

                        {/* Quick Percentage Chips */}
                        <div className="grid grid-cols-4 gap-1 mb-2">
                          {[50, 75, 80, 90].map((presetPct) => (
                            <button
                              key={presetPct}
                              type="button"
                              onClick={() => handleUpdateCategoryThreshold(alert.category, presetPct)}
                              className={`py-1 text-[11px] font-bold rounded-lg transition-all border text-center ${
                                (alert.threshold || 80) === presetPct
                                  ? isNitido
                                    ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs'
                                    : 'bg-indigo-600 text-white border-indigo-500 shadow-2xs'
                                  : isNitido
                                  ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                                  : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
                              }`}
                            >
                              {presetPct}%
                            </button>
                          ))}
                        </div>

                        {/* Range slider for fine adjustment */}
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min="30"
                            max="95"
                            step="5"
                            value={alert.threshold || 80}
                            onChange={(e) => handleUpdateCategoryThreshold(alert.category, Number(e.target.value))}
                            className={`w-full h-1.5 rounded-lg cursor-pointer ${
                              isNitido ? 'accent-indigo-600 bg-slate-200' : 'accent-cyan-400 bg-slate-800'
                            }`}
                            title={`Ajustar umbral de alerta para ${alert.categoryLabel}: ${alert.threshold || 80}%`}
                          />
                          <span className={`text-[10px] font-black min-w-[28px] text-right ${isNitido ? 'text-slate-700' : 'text-slate-400'}`}>
                            {alert.threshold || 80}%
                          </span>
                        </div>
                      </div>

                      {/* Diagnostic Message */}
                      <p className={`text-xs mt-2.5 leading-relaxed p-2.5 rounded-xl border ${
                        isNitido
                          ? isExceeded
                            ? 'bg-rose-50 border-rose-200 text-rose-900 font-medium'
                            : isWarning
                            ? 'bg-amber-50 border-amber-200 text-amber-900 font-medium'
                            : 'bg-slate-50 border-slate-200 text-slate-700 font-medium'
                          : isExceeded
                          ? 'bg-rose-950/20 border-rose-800/30 text-rose-200'
                          : isWarning
                          ? 'bg-amber-950/20 border-amber-800/30 text-amber-200'
                          : 'bg-slate-950/40 border-slate-800/60 text-slate-300'
                      }`}>
                        {alert.message}
                      </p>

                      {/* AI Strategic Recommendation */}
                      {alert.aiRecommendation && (
                        <div className={`mt-2 text-[11px] p-2.5 rounded-xl border flex items-start gap-1.5 ${
                          isNitido
                            ? 'bg-indigo-50 border-indigo-200 text-indigo-950 font-medium'
                            : 'text-cyan-300 bg-cyan-950/30 border-cyan-800/30'
                        }`}>
                          <Sparkles className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${isNitido ? 'text-indigo-600' : 'text-cyan-400'}`} />
                          <span>{alert.aiRecommendation}</span>
                        </div>
                      )}
                    </div>

                    {/* Card Action footer */}
                    <div className={`pt-2 border-t flex items-center justify-between text-xs ${
                      isNitido ? 'border-slate-200' : 'border-slate-800/80'
                    }`}>
                      {alert.category === 'transporte' && onNavigateToRadar ? (
                        <button
                          onClick={onNavigateToRadar}
                          className={`font-bold text-[11px] flex items-center gap-1 underline ${
                            isNitido ? 'text-amber-800 hover:text-amber-900' : 'text-amber-400 hover:text-amber-300'
                          }`}
                        >
                          <span>Ver Radar de Autos en {profile.country}</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      ) : alert.category === 'alquiler' && onNavigateToRadar ? (
                        <button
                          onClick={onNavigateToRadar}
                          className={`font-bold text-[11px] flex items-center gap-1 underline ${
                            isNitido ? 'text-indigo-800 hover:text-indigo-950' : 'text-indigo-400 hover:text-indigo-300'
                          }`}
                        >
                          <span>Ver Radar de Vivienda en {profile.country}</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      ) : onOpenVoiceAssistant ? (
                        <button
                          onClick={() =>
                            onOpenVoiceAssistant(
                              `¿Cómo puedo reducir mi consumo en ${alert.categoryLabel} para mantenerme dentro del límite de ${profile.currencySymbol}${alert.budget}?`
                            )
                          }
                          className={`font-bold text-[11px] flex items-center gap-1 ${
                            isNitido ? 'text-indigo-700 hover:text-indigo-950' : 'text-cyan-400 hover:text-cyan-300'
                          }`}
                        >
                          <Sparkles className="w-3 h-3" />
                          <span>Consultar Asistente de Voz</span>
                        </button>
                      ) : (
                        <span className={`text-[10px] ${isNitido ? 'text-slate-400' : 'text-slate-600'}`}>
                          Monitoreo activo
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Global Alert Threshold Config Modal */}
      {isThresholdModalOpen && (
        <AlertThresholdConfigModal
          isOpen={isThresholdModalOpen}
          onClose={() => setIsThresholdModalOpen(false)}
          payments={payments}
          profile={profile}
          categoryBudgets={categoryBudgets}
          alertThresholds={alertThresholds}
          globalAlertThreshold={globalAlertThreshold}
          onSaveThresholds={(thresholds, globalVal) => {
            if (onUpdateAlertThresholds) {
              onUpdateAlertThresholds(thresholds, globalVal);
            }
          }}
        />
      )}
    </div>
  );
};
