import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calendar,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  PieChart,
  BarChart3,
  Sliders,
  Car,
  Home,
  ShoppingBag,
  Zap,
  Coffee,
  HeartPulse,
  BookOpen,
  Plus,
  ShieldCheck,
  ChevronRight,
  Flame,
  Award,
} from 'lucide-react';
import { PaymentItem, UserFinancialProfile } from '../types';
import { useTheme } from '../context/ThemeContext';

interface FinancialSummaryWidgetsDashboardProps {
  payments: PaymentItem[];
  profile: UserFinancialProfile;
  categoryBudgets: Record<string, number>;
  onOpenAddModal?: () => void;
}

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  alquiler: Home,
  transporte: Car,
  alimentacion: ShoppingBag,
  servicios: Zap,
  ocio: Coffee,
  salud: HeartPulse,
  educacion: BookOpen,
  otro: DollarSign,
};

const CATEGORY_COLORS: Record<string, { stroke: string; fill: string; text: string; bg: string }> = {
  alquiler: { stroke: '#6366f1', fill: '#818cf8', text: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200' },
  transporte: { stroke: '#f59e0b', fill: '#fbbf24', text: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  alimentacion: { stroke: '#f43f5e', fill: '#fb7185', text: 'text-rose-700', bg: 'bg-rose-50 border-rose-200' },
  servicios: { stroke: '#06b6d4', fill: '#38bdf8', text: 'text-cyan-700', bg: 'bg-cyan-50 border-cyan-200' },
  ocio: { stroke: '#a855f7', fill: '#c084fc', text: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
  salud: { stroke: '#10b981', fill: '#34d399', text: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  educacion: { stroke: '#3b82f6', fill: '#60a5fa', text: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  otro: { stroke: '#64748b', fill: '#94a3b8', text: 'text-slate-700', bg: 'bg-slate-100 border-slate-200' },
};

const CATEGORY_LABELS: Record<string, string> = {
  alquiler: 'Vivienda',
  transporte: 'Transporte',
  alimentacion: 'Alimentación',
  servicios: 'Servicios',
  ocio: 'Ocio',
  salud: 'Salud',
  educacion: 'Educación',
  otro: 'Otros',
};

export const FinancialSummaryWidgetsDashboard: React.FC<FinancialSummaryWidgetsDashboardProps> = ({
  payments,
  profile,
  categoryBudgets,
  onOpenAddModal,
}) => {
  const { isNitido, isVibrant } = useTheme();

  // Date selection for the Daily Cashflow widget (defaults to today)
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [categoryViewMode, setCategoryViewMode] = useState<'bars' | 'donut'>('bars');

  const currSym = profile.currencySymbol || '$';

  // 1. Total Monthly Budgets & Incomes
  const totalMonthlyBudget = useMemo(() => {
    return Object.values(categoryBudgets).reduce((sum, val) => sum + (Number(val) || 0), 0);
  }, [categoryBudgets]);

  const dailyRecommendedBudget = useMemo(() => {
    return totalMonthlyBudget > 0 ? Math.round((totalMonthlyBudget / 30) * 10) / 10 : 75;
  }, [totalMonthlyBudget]);

  // 2. Calculations for Widget 1: Gasto vs Ingreso del Día
  const dailyData = useMemo(() => {
    const dayPayments = payments.filter((p) => p.dueDate === selectedDate);
    const dayIncome = dayPayments
      .filter((p) => p.type === 'ingreso')
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const dayExpense = dayPayments
      .filter((p) => p.type === 'gasto')
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const dayNet = dayIncome - dayExpense;

    // Daily budget utilization ratio
    const expenseRatio = dailyRecommendedBudget > 0 ? Math.round((dayExpense / dailyRecommendedBudget) * 100) : 0;
    const isOverDailyBudget = dayExpense > dailyRecommendedBudget;

    return {
      dayPayments,
      dayIncome,
      dayExpense,
      dayNet,
      expenseRatio,
      isOverDailyBudget,
      remainingDailyAllowance: Math.max(0, dailyRecommendedBudget - dayExpense),
    };
  }, [payments, selectedDate, dailyRecommendedBudget]);

  // Available unique dates in payments history to quick pick
  const availableDates = useMemo(() => {
    const datesSet = new Set<string>();
    datesSet.add(todayStr);
    payments.forEach((p) => {
      if (p.dueDate) datesSet.add(p.dueDate);
    });
    return Array.from(datesSet).sort().reverse().slice(0, 7);
  }, [payments, todayStr]);

  // 3. Calculations for Widget 2: Gasto por Categoría
  const categorySpendingData = useMemo(() => {
    const spendingMap: Record<string, number> = {};
    const countMap: Record<string, number> = {};

    payments
      .filter((p) => p.type === 'gasto')
      .forEach((p) => {
        const cat = p.category || 'otro';
        spendingMap[cat] = (spendingMap[cat] || 0) + Number(p.amount || 0);
        countMap[cat] = (countMap[cat] || 0) + 1;
      });

    const totalSpending = Object.values(spendingMap).reduce((sum, val) => sum + val, 0);

    const categoriesList = Object.keys(categoryBudgets).map((catKey) => {
      const spent = spendingMap[catKey] || 0;
      const budget = Number(categoryBudgets[catKey]) || 0;
      const percentOfTotal = totalSpending > 0 ? Math.round((spent / totalSpending) * 100) : 0;
      const budgetUtilization = budget > 0 ? Math.round((spent / budget) * 100) : 0;
      const isOverBudget = spent > budget;
      const colors = CATEGORY_COLORS[catKey] || CATEGORY_COLORS.otro;
      const label = CATEGORY_LABELS[catKey] || catKey;

      return {
        key: catKey,
        label,
        spent,
        budget,
        count: countMap[catKey] || 0,
        percentOfTotal,
        budgetUtilization,
        isOverBudget,
        color: colors.stroke,
        colors,
      };
    });

    // Sort descending by spend
    categoriesList.sort((a, b) => b.spent - a.spent);

    const topCategory = categoriesList[0] || null;

    return {
      totalSpending,
      categoriesList,
      topCategory,
    };
  }, [payments, categoryBudgets]);

  // 4. Monthly Run-Rate and Pacing
  const runRateMetrics = useMemo(() => {
    const now = new Date();
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const monthProgressPercent = Math.round((dayOfMonth / daysInMonth) * 100);

    const totalSpentSoFar = categorySpendingData.totalSpending;
    const budgetSpentPercent = totalMonthlyBudget > 0 ? Math.round((totalSpentSoFar / totalMonthlyBudget) * 100) : 0;

    const projectedMonthEndSpend = dayOfMonth > 0 ? Math.round((totalSpentSoFar / dayOfMonth) * daysInMonth) : totalSpentSoFar;
    const isPacingSafe = budgetSpentPercent <= monthProgressPercent + 5;

    return {
      dayOfMonth,
      daysInMonth,
      monthProgressPercent,
      budgetSpentPercent,
      projectedMonthEndSpend,
      isPacingSafe,
    };
  }, [categorySpendingData, totalMonthlyBudget]);

  // Custom Recharts Tooltip for Category Donut
  const CustomDonutTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0]?.payload;

    return (
      <div
        className={`p-3 rounded-xl border shadow-xl text-xs backdrop-blur-md ${
          isNitido ? 'bg-white/95 border-slate-200 text-slate-800' : 'bg-slate-900/95 border-slate-700 text-slate-100'
        }`}
      >
        <div className="flex items-center gap-1.5 font-bold mb-1">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: data.color }} />
          <span>{data.label}</span>
        </div>
        <div className="flex items-center justify-between gap-4 text-xs font-black">
          <span>Gasto:</span>
          <span>{currSym}{data.spent.toLocaleString()} ({data.percentOfTotal}%)</span>
        </div>
        <div className="flex items-center justify-between gap-4 text-[10px] text-slate-500 mt-1">
          <span>Presupuesto:</span>
          <span>{currSym}{data.budget.toLocaleString()} ({data.budgetUtilization}% uso)</span>
        </div>
      </div>
    );
  };

  return (
    <div
      className={`rounded-3xl border transition-all ${
        isNitido
          ? 'bg-white border-slate-200/90 shadow-sm'
          : isVibrant
          ? 'bg-gradient-to-br from-slate-900/95 via-[#0b1330] to-[#070b20] border-indigo-500/30 shadow-xl'
          : 'bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-950 border-slate-800 shadow-xl'
      } p-5 sm:p-6 space-y-6`}
    >
      {/* 1. Header with Title, Badge, and Action buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5 border-slate-100 dark:border-slate-800">
        <div className="flex items-start gap-3.5">
          <div
            className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border ${
              isNitido
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                : 'bg-indigo-950/80 border-indigo-700/60 text-indigo-400'
            }`}
          >
            <BarChart3 className="w-5 h-5" />
          </div>

          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className={`text-base sm:text-lg font-black tracking-tight ${isNitido ? 'text-slate-900' : 'text-white'}`}>
                Dashboard de Resumen Financiero
              </h3>
              <span
                className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 border ${
                  isNitido
                    ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                    : 'bg-indigo-950/80 text-indigo-300 border-indigo-800'
                }`}
              >
                <Sparkles className="w-3 h-3 text-indigo-600" />
                Widgets en Tiempo Real
              </span>
            </div>

            <p className={`text-xs mt-1 leading-relaxed ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
              Monitorea el balance diario de gastos versus ingresos y la distribución porcentual del gasto por categoría frente al presupuesto mensual.
            </p>
          </div>
        </div>

        {onOpenAddModal && (
          <button
            type="button"
            onClick={onOpenAddModal}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-2xs shrink-0 active:scale-95 ${
              isNitido
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                : 'bg-indigo-500 hover:bg-indigo-400 text-slate-950'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Movimiento</span>
          </button>
        )}
      </div>

      {/* 2. Main Two-Column Widgets Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
        {/* WIDGET 1: Gasto vs Ingreso del Día */}
        <div
          className={`p-5 rounded-2xl border flex flex-col justify-between space-y-4 transition-all ${
            isNitido
              ? 'bg-slate-50/60 border-slate-200/90 shadow-2xs'
              : 'bg-slate-950/70 border-slate-800'
          }`}
        >
          {/* Widget 1 Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                  isNitido
                    ? 'bg-amber-50 border-amber-200 text-amber-700'
                    : 'bg-amber-950/60 border-amber-700/50 text-amber-300'
                }`}
              >
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <h4 className={`text-sm font-black tracking-tight ${isNitido ? 'text-slate-900' : 'text-white'}`}>
                  Gasto vs Ingreso del Día
                </h4>
                <span className={`text-[11px] ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
                  Flujo de caja y control de límite diario
                </span>
              </div>
            </div>

            {/* Quick Date Picker / Selector */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
              <button
                type="button"
                onClick={() => setSelectedDate(todayStr)}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all ${
                  selectedDate === todayStr
                    ? isNitido
                      ? 'bg-slate-900 text-white border-slate-900 font-black'
                      : 'bg-white text-slate-900 border-white font-black'
                    : isNitido
                    ? 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                }`}
              >
                Hoy
              </button>

              <select
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className={`px-2 py-1 text-xs font-semibold rounded-lg border outline-none cursor-pointer ${
                  isNitido
                    ? 'bg-white border-slate-200 text-slate-800'
                    : 'bg-slate-800 border-slate-700 text-white'
                }`}
              >
                {availableDates.map((d) => (
                  <option key={d} value={d}>
                    {d === todayStr ? `Hoy (${d})` : d}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Daily Cashflow Comparison Cards */}
          <div className="grid grid-cols-3 gap-2.5 text-center">
            {/* Daily Inflow */}
            <div
              className={`p-3 rounded-xl border ${
                isNitido ? 'bg-white border-slate-200 shadow-2xs' : 'bg-slate-900 border-slate-800'
              }`}
            >
              <div className="flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                <ArrowUpRight className="w-3 h-3" />
                <span>Ingreso</span>
              </div>
              <span className={`text-base sm:text-lg font-black block mt-1 ${isNitido ? 'text-emerald-700' : 'text-emerald-400'}`}>
                +{currSym}{dailyData.dayIncome.toLocaleString()}
              </span>
              <span className={`text-[10px] font-semibold ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
                Entradas hoy
              </span>
            </div>

            {/* Daily Outflow */}
            <div
              className={`p-3 rounded-xl border ${
                isNitido ? 'bg-white border-slate-200 shadow-2xs' : 'bg-slate-900 border-slate-800'
              }`}
            >
              <div className="flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-wider text-rose-600">
                <ArrowDownRight className="w-3 h-3" />
                <span>Gasto</span>
              </div>
              <span className={`text-base sm:text-lg font-black block mt-1 ${isNitido ? 'text-rose-700' : 'text-rose-400'}`}>
                -{currSym}{dailyData.dayExpense.toLocaleString()}
              </span>
              <span className={`text-[10px] font-semibold ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
                Salidas hoy
              </span>
            </div>

            {/* Daily Net Flow */}
            <div
              className={`p-3 rounded-xl border ${
                isNitido ? 'bg-white border-slate-200 shadow-2xs' : 'bg-slate-900 border-slate-800'
              }`}
            >
              <div className="flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                <DollarSign className="w-3 h-3" />
                <span>Balance</span>
              </div>
              <span
                className={`text-base sm:text-lg font-black block mt-1 ${
                  dailyData.dayNet >= 0
                    ? isNitido ? 'text-emerald-700' : 'text-emerald-400'
                    : isNitido ? 'text-rose-700' : 'text-rose-400'
                }`}
              >
                {dailyData.dayNet >= 0 ? '+' : ''}{currSym}{dailyData.dayNet.toLocaleString()}
              </span>
              <span className={`text-[10px] font-semibold ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
                Flujo neto
              </span>
            </div>
          </div>

          {/* Daily Burn-Rate Progress Bar vs Recommended Budget */}
          <div
            className={`p-3.5 rounded-xl border space-y-2 ${
              isNitido ? 'bg-white border-slate-200 shadow-2xs' : 'bg-slate-900 border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between text-xs">
              <span className={`font-bold flex items-center gap-1.5 ${isNitido ? 'text-slate-800' : 'text-slate-200'}`}>
                <Clock className="w-3.5 h-3.5 text-indigo-500" />
                Consumo vs. Presupuesto Diario Recomendado:
              </span>
              <span
                className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                  dailyData.isOverDailyBudget
                    ? 'bg-rose-50 text-rose-800 border-rose-200'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                }`}
              >
                {dailyData.isOverDailyBudget ? '⚠️ Exceso Diario' : '✓ Dentro de Cuota'}
              </span>
            </div>

            {/* Visual Gauge Bar */}
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  dailyData.isOverDailyBudget ? 'bg-rose-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, Math.max(4, dailyData.expenseRatio))}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] pt-0.5">
              <span className={`font-semibold ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
                Gastado: <strong>{currSym}{dailyData.dayExpense.toLocaleString()}</strong> de {currSym}{dailyRecommendedBudget.toLocaleString()} / día
              </span>
              <span
                className={`font-black ${
                  dailyData.isOverDailyBudget ? 'text-rose-600' : 'text-emerald-700'
                }`}
              >
                {dailyData.isOverDailyBudget
                  ? `Excedido por +${currSym}${(dailyData.dayExpense - dailyRecommendedBudget).toFixed(1)}`
                  : `Margen disponible: +${currSym}${dailyData.remainingDailyAllowance.toFixed(1)}`}
              </span>
            </div>
          </div>

          {/* List of Today's Movements */}
          <div className="space-y-1.5">
            <span className={`text-[11px] font-bold block ${isNitido ? 'text-slate-700' : 'text-slate-300'}`}>
              Movimientos registrados el {selectedDate} ({dailyData.dayPayments.length}):
            </span>

            {dailyData.dayPayments.length === 0 ? (
              <div
                className={`p-3 rounded-xl border text-center text-xs ${
                  isNitido ? 'bg-slate-50 border-slate-200 text-slate-500' : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}
              >
                <span>No hay pagos registrados para esta fecha. Tu cupo diario de {currSym}{dailyRecommendedBudget.toLocaleString()} está 100% intacto.</span>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-0.5">
                {dailyData.dayPayments.map((p) => {
                  const isInc = p.type === 'ingreso';
                  const Icon = CATEGORY_ICONS[p.category] || DollarSign;

                  return (
                    <div
                      key={p.id}
                      className={`p-2 rounded-xl border flex items-center justify-between text-xs transition-all ${
                        isNitido ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                            isInc
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <span className={`font-bold truncate ${isNitido ? 'text-slate-900' : 'text-white'}`}>
                          {p.title}
                        </span>
                      </div>

                      <span
                        className={`font-black shrink-0 ${
                          isInc
                            ? isNitido ? 'text-emerald-700' : 'text-emerald-400'
                            : isNitido ? 'text-slate-900' : 'text-white'
                        }`}
                      >
                        {isInc ? '+' : '-'}{currSym}{p.amount.toLocaleString()}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* WIDGET 2: Gasto por Categoría */}
        <div
          className={`p-5 rounded-2xl border flex flex-col justify-between space-y-4 transition-all ${
            isNitido
              ? 'bg-slate-50/60 border-slate-200/90 shadow-2xs'
              : 'bg-slate-950/70 border-slate-800'
          }`}
        >
          {/* Widget 2 Header */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                  isNitido
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                    : 'bg-indigo-950/60 border-indigo-700/50 text-indigo-300'
                }`}
              >
                <PieChart className="w-4 h-4" />
              </div>
              <div>
                <h4 className={`text-sm font-black tracking-tight ${isNitido ? 'text-slate-900' : 'text-white'}`}>
                  Gasto por Categoría
                </h4>
                <span className={`text-[11px] ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
                  Distribución visual y consumo del presupuesto
                </span>
              </div>
            </div>

            {/* Toggle View: Bars vs Donut */}
            <div className={`flex items-center p-0.5 rounded-xl border ${isNitido ? 'bg-white border-slate-200' : 'bg-slate-800 border-slate-700'}`}>
              <button
                type="button"
                onClick={() => setCategoryViewMode('bars')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                  categoryViewMode === 'bars'
                    ? isNitido
                      ? 'bg-slate-900 text-white font-black'
                      : 'bg-white text-slate-900 font-black'
                    : isNitido
                    ? 'text-slate-600 hover:text-slate-900'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Barras
              </button>

              <button
                type="button"
                onClick={() => setCategoryViewMode('donut')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                  categoryViewMode === 'donut'
                    ? isNitido
                      ? 'bg-slate-900 text-white font-black'
                      : 'bg-white text-slate-900 font-black'
                    : isNitido
                    ? 'text-slate-600 hover:text-slate-900'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Anillo
              </button>
            </div>
          </div>

          {/* Top Spending Category Ribbon */}
          {categorySpendingData.topCategory && (
            <div
              className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                isNitido ? 'bg-white border-slate-200 shadow-2xs' : 'bg-slate-900 border-slate-800'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="p-1 rounded-lg bg-rose-50 text-rose-600 border border-rose-200">
                  <Flame className="w-4 h-4" />
                </span>
                <div>
                  <span className={`text-[10px] font-bold uppercase tracking-wider block ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
                    Categoría con Mayor Gasto
                  </span>
                  <span className={`text-xs font-black ${isNitido ? 'text-slate-900' : 'text-white'}`}>
                    {categorySpendingData.topCategory.label} ({categorySpendingData.topCategory.percentOfTotal}% del total)
                  </span>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className={`text-sm font-black block ${isNitido ? 'text-slate-900' : 'text-white'}`}>
                  {currSym}{categorySpendingData.topCategory.spent.toLocaleString()}
                </span>
                <span className={`text-[10px] font-semibold ${categorySpendingData.topCategory.isOverBudget ? 'text-rose-600 font-bold' : 'text-slate-500'}`}>
                  {categorySpendingData.topCategory.budgetUtilization}% del presupuesto
                </span>
              </div>
            </div>
          )}

          {/* View Mode: Donut Chart */}
          {categoryViewMode === 'donut' ? (
            <div className={`p-3 rounded-xl border flex items-center justify-center ${isNitido ? 'bg-white border-slate-200 shadow-2xs' : 'bg-slate-900 border-slate-800'}`}>
              <div className="h-56 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Tooltip content={<CustomDonutTooltip />} />
                    <Pie
                      data={categorySpendingData.categoriesList.filter((c) => c.spent > 0)}
                      dataKey="spent"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                    >
                      {categorySpendingData.categoriesList
                        .filter((c) => c.spent > 0)
                        .map((entry, idx) => (
                          <Cell key={`cell-${idx}`} fill={entry.color} stroke="#ffffff" strokeWidth={1.5} />
                        ))}
                    </Pie>
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            /* View Mode: Proportional Category Bars */
            <div className="space-y-2.5 max-h-56 overflow-y-auto pr-0.5">
              {categorySpendingData.categoriesList.map((cat) => {
                const Icon = CATEGORY_ICONS[cat.key] || DollarSign;

                return (
                  <div
                    key={cat.key}
                    className={`p-2.5 rounded-xl border transition-all ${
                      isNitido ? 'bg-white border-slate-200 shadow-2xs' : 'bg-slate-900 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <div
                          className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
                          style={{
                            backgroundColor: `${cat.color}20`,
                            color: cat.color,
                          }}
                        >
                          <Icon className="w-3 h-3" />
                        </div>
                        <span className={`font-bold ${isNitido ? 'text-slate-900' : 'text-white'}`}>
                          {cat.label}
                        </span>
                        <span className={`text-[10px] font-semibold text-slate-500`}>
                          ({cat.percentOfTotal}%)
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`font-black ${isNitido ? 'text-slate-900' : 'text-white'}`}>
                          {currSym}{cat.spent.toLocaleString()}
                        </span>
                        <span className={`text-[10px] font-semibold ${cat.isOverBudget ? 'text-rose-600 font-bold' : 'text-slate-500'}`}>
                          / {currSym}{cat.budget.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(100, cat.budgetUtilization)}%`,
                          backgroundColor: cat.isOverBudget ? '#f43f5e' : cat.color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer Metrics Callout */}
          <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/80 dark:border-slate-800">
            <span className={`font-semibold ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
              Gasto total acumulado: <strong className={isNitido ? 'text-slate-900' : 'text-white'}>{currSym}{categorySpendingData.totalSpending.toLocaleString()}</strong>
            </span>
            <span className={`font-bold ${isNitido ? 'text-indigo-700' : 'text-indigo-400'}`}>
              Presupuesto global: {currSym}{totalMonthlyBudget.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Bottom Run-Rate & Operational Pacing Bar */}
      <div
        className={`p-4 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
          isNitido ? 'bg-slate-50/80 border-slate-200' : 'bg-slate-950/70 border-slate-800'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
              runRateMetrics.isPacingSafe
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-amber-50 border-amber-200 text-amber-700'
            }`}
          >
            <ShieldCheck className="w-5 h-5" />
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs font-bold ${isNitido ? 'text-slate-900' : 'text-white'}`}>
                Ritmo Operativo del Mes (Día {runRateMetrics.dayOfMonth} de {runRateMetrics.daysInMonth})
              </span>
              <span
                className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                  runRateMetrics.isPacingSafe
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}
              >
                {runRateMetrics.isPacingSafe ? 'Ritmo Sostenible ✓' : 'Aceleración Detectada ⚠️'}
              </span>
            </div>
            <p className={`text-[11px] mt-0.5 ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
              Ha transcurrido el {runRateMetrics.monthProgressPercent}% del mes y has consumido el {runRateMetrics.budgetSpentPercent}% de tu presupuesto mensual. Proyección a fin de mes: {currSym}{runRateMetrics.projectedMonthEndSpend.toLocaleString()}.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 shrink-0 text-right">
          <div>
            <span className={`text-[10px] font-bold uppercase tracking-wider block ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
              Cuota Diaria Segura
            </span>
            <span className={`text-sm font-black ${isNitido ? 'text-slate-900' : 'text-white'}`}>
              {currSym}{dailyRecommendedBudget.toLocaleString()} / día
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
