import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ReferenceLine,
  Cell,
  Line,
  ComposedChart,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Sparkles,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Sliders,
  DollarSign,
  Check,
  ShieldCheck,
  Zap,
  Target,
  Car,
  Home,
  ShoppingBag,
  Coffee,
  HeartPulse,
  BookOpen,
  PieChart,
  Clock,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { PaymentItem, UserFinancialProfile } from '../types';
import {
  calculateSixMonthExpensePrediction,
  PredictionStrategy,
  SixMonthPredictionSummary,
  CategoryPredictionAnalysis,
} from '../services/predictiveExpenseService';
import { useTheme } from '../context/ThemeContext';

interface SixMonthPredictiveBudgetSectionProps {
  payments: PaymentItem[];
  categoryBudgets: Record<string, number>;
  onUpdateCategoryBudgets: (updated: Record<string, number>) => void;
  profile: UserFinancialProfile;
}

const CATEGORY_ICONS_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  alquiler: Home,
  transporte: Car,
  alimentacion: ShoppingBag,
  servicios: Zap,
  ocio: Coffee,
  salud: HeartPulse,
  educacion: BookOpen,
  otro: DollarSign,
};

const CATEGORY_COLORS: Record<string, string> = {
  alquiler: '#6366f1', // Indigo
  transporte: '#f59e0b', // Amber
  alimentacion: '#f43f5e', // Rose
  servicios: '#06b6d4', // Cyan
  ocio: '#a855f7', // Purple
  salud: '#10b981', // Emerald
  educacion: '#3b82f6', // Blue
  otro: '#64748b', // Slate
};

export const SixMonthPredictiveBudgetSection: React.FC<SixMonthPredictiveBudgetSectionProps> = ({
  payments,
  categoryBudgets,
  onUpdateCategoryBudgets,
  profile,
}) => {
  const { isNitido, isVibrant } = useTheme();

  // Strategy Selector state: 'balanced' | 'aggressive_savings' | 'conservative'
  const [strategy, setStrategy] = useState<PredictionStrategy>('balanced');
  const [selectedChartCategory, setSelectedChartCategory] = useState<string>('total');
  const [appliedCategories, setAppliedCategories] = useState<Record<string, boolean>>({});
  const [toastNotification, setToastNotification] = useState<string | null>(null);
  const [isSectionExpanded, setIsSectionExpanded] = useState<boolean>(true);

  const currSym = profile.currencySymbol || '$';

  // Compute 6-month prediction model
  const prediction: SixMonthPredictionSummary = useMemo(() => {
    return calculateSixMonthExpensePrediction(payments, categoryBudgets, profile, strategy);
  }, [payments, categoryBudgets, profile, strategy]);

  // Handle applying all automatic suggested budget adjustments
  const handleApplyAllAdjustments = () => {
    const updatedBudgets: Record<string, number> = { ...categoryBudgets };
    const appliedMap: Record<string, boolean> = {};

    prediction.categories.forEach((cat) => {
      updatedBudgets[cat.category] = cat.suggestedBudget;
      appliedMap[cat.category] = true;
    });

    onUpdateCategoryBudgets(updatedBudgets);
    setAppliedCategories(appliedMap);

    const deltaSign = prediction.totalDifference >= 0 ? '+' : '';
    setToastNotification(
      `¡Presupuesto del próximo mes actualizado con éxito! Nuevo límite total: ${currSym}${prediction.totalSuggestedBudget.toLocaleString()} (${deltaSign}${currSym}${prediction.totalDifference.toLocaleString()}). Guardado en almacenamiento local.`
    );

    setTimeout(() => {
      setToastNotification(null);
    }, 4500);
  };

  // Handle applying a single category suggestion
  const handleApplySingleCategory = (cat: CategoryPredictionAnalysis) => {
    const updatedBudgets = {
      ...categoryBudgets,
      [cat.category]: cat.suggestedBudget,
    };

    onUpdateCategoryBudgets(updatedBudgets);
    setAppliedCategories((prev) => ({ ...prev, [cat.category]: true }));

    const deltaSign = cat.budgetDelta >= 0 ? '+' : '';
    setToastNotification(
      `Presupuesto de ${cat.categoryLabel} ajustado a ${currSym}${cat.suggestedBudget.toLocaleString()} (${deltaSign}${currSym}${cat.budgetDelta.toLocaleString()}).`
    );

    setTimeout(() => {
      setToastNotification(null);
    }, 3500);
  };

  // Prepare chart data for selected view (either 'total' or specific category)
  const chartData = useMemo(() => {
    return prediction.chartSeries.map((point) => {
      if (selectedChartCategory === 'total') {
        return {
          monthLabel: point.monthLabel,
          spend: point.total,
          budgetBenchmark: prediction.totalCurrentBudget,
          isPredicted: point.isPredicted,
        };
      } else {
        const catAnalysis = prediction.categories.find((c) => c.category === selectedChartCategory);
        const spend = Number(point[selectedChartCategory]) || 0;
        return {
          monthLabel: point.monthLabel,
          spend,
          budgetBenchmark: catAnalysis ? catAnalysis.currentBudget : 0,
          isPredicted: point.isPredicted,
        };
      }
    });
  }, [prediction, selectedChartCategory]);

  // Selected category analysis object
  const activeCategoryObj = useMemo(() => {
    if (selectedChartCategory === 'total') return null;
    return prediction.categories.find((c) => c.category === selectedChartCategory) || null;
  }, [prediction, selectedChartCategory]);

  // Custom Chart Tooltip
  const CustomPredictionTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    const dataPoint = payload[0]?.payload;
    const isPredicted = dataPoint?.isPredicted;
    const spend = dataPoint?.spend || 0;
    const benchmark = dataPoint?.budgetBenchmark || 0;
    const diff = spend - benchmark;

    return (
      <div
        className={`p-3.5 rounded-2xl border shadow-xl max-w-xs text-xs z-50 backdrop-blur-md transition-all ${
          isNitido
            ? 'bg-white/95 border-slate-200 text-slate-800 shadow-slate-200/80'
            : 'bg-slate-900/95 border-slate-700 text-slate-100 shadow-2xl'
        }`}
      >
        <div className="flex items-center justify-between border-b pb-2 mb-2 border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center gap-1.5 font-black text-sm">
            <Calendar className="w-3.5 h-3.5 text-indigo-500" />
            <span>{label}</span>
          </div>
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
              isPredicted
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                : 'bg-slate-100 text-slate-700 border border-slate-200'
            }`}
          >
            {isPredicted ? 'Predicción 6M' : 'Histórico Real'}
          </span>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-semibold">
              {selectedChartCategory === 'total' ? 'Gasto Total:' : 'Gasto Categoría:'}
            </span>
            <span className="text-sm font-black text-slate-900 dark:text-white">
              {currSym}{spend.toLocaleString()}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-semibold">Presupuesto Actual:</span>
            <span className="font-bold text-slate-700 dark:text-slate-300">
              {currSym}{benchmark.toLocaleString()}
            </span>
          </div>

          <div className="pt-1 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">Diferencia:</span>
            <span
              className={`font-black ${
                diff > 0
                  ? 'text-rose-600'
                  : diff < 0
                  ? 'text-emerald-600'
                  : 'text-slate-600'
              }`}
            >
              {diff > 0 ? `+${currSym}${diff.toLocaleString()} (Exceso)` : `${currSym}${diff.toLocaleString()} (Holgura)`}
            </span>
          </div>
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
          ? 'bg-gradient-to-br from-slate-900/95 via-[#0b1433] to-[#070b22] border-indigo-500/30 shadow-xl'
          : 'bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-950 border-slate-800 shadow-xl'
      } p-5 sm:p-6 space-y-6`}
    >
      {/* 1. Header with Title, Badges, Strategy Controls and Expand Toggle */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b pb-5 border-slate-100 dark:border-slate-800">
        <div className="flex items-start gap-3.5">
          <div
            className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border ${
              isNitido
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                : 'bg-indigo-950/80 border-indigo-700/60 text-indigo-400'
            }`}
          >
            <Sparkles className="w-5 h-5" />
          </div>

          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className={`text-base sm:text-lg font-black tracking-tight ${isNitido ? 'text-slate-900' : 'text-white'}`}>
                Predicción de Gastos y Ajuste Presupuestario (6 Meses)
              </h3>
              <span
                className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 border ${
                  isNitido
                    ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                    : 'bg-indigo-950/80 text-indigo-300 border-indigo-800'
                }`}
              >
                <Layers className="w-3 h-3 text-indigo-600" />
                Modelo Series Temporales 6M
              </span>
            </div>

            <p className={`text-xs mt-1 leading-relaxed ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
              Estima matemáticamente el gasto del próximo mes analizando la tendencia y media ponderada de los últimos 6 meses, y sugiere ajustes automáticos al presupuesto mensual.
            </p>
          </div>
        </div>

        {/* Strategy Selector Toolbar & Toggle */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <div className={`flex items-center p-0.5 rounded-xl border ${isNitido ? 'bg-slate-100 border-slate-200' : 'bg-slate-800 border-slate-700'}`}>
            <button
              type="button"
              onClick={() => {
                setStrategy('balanced');
                setAppliedCategories({});
              }}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                strategy === 'balanced'
                  ? isNitido
                    ? 'bg-white text-indigo-950 shadow-2xs font-black'
                    : 'bg-indigo-600 text-white font-black'
                  : isNitido
                  ? 'text-slate-600 hover:text-slate-900'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Ajuste equilibrado: proyecta gasto real con 4% de holgura en variables"
            >
              🎯 Balanceado
            </button>

            <button
              type="button"
              onClick={() => {
                setStrategy('aggressive_savings');
                setAppliedCategories({});
              }}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                strategy === 'aggressive_savings'
                  ? isNitido
                    ? 'bg-white text-emerald-950 shadow-2xs font-black'
                    : 'bg-emerald-600 text-white font-black'
                  : isNitido
                  ? 'text-slate-600 hover:text-slate-900'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Máximo ahorro: recorta 6% en categorías variables para acelerar metas"
            >
              ⚡ Máximo Ahorro
            </button>

            <button
              type="button"
              onClick={() => {
                setStrategy('conservative');
                setAppliedCategories({});
              }}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                strategy === 'conservative'
                  ? isNitido
                    ? 'bg-white text-amber-950 shadow-2xs font-black'
                    : 'bg-amber-600 text-slate-950 font-black'
                  : isNitido
                  ? 'text-slate-600 hover:text-slate-900'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Conservador: colchón preventivo del +10% en todas las categorías"
            >
              🛡️ Prudente (+10%)
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsSectionExpanded(!isSectionExpanded)}
            className={`p-1.5 rounded-xl border transition-colors ${
              isNitido
                ? 'bg-white hover:bg-slate-100 text-slate-600 border-slate-200'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border-slate-700'
            }`}
            title={isSectionExpanded ? 'Minimizar sección' : 'Expandir sección'}
          >
            {isSectionExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Temporary Toast Banner for Auto-Save Feedback */}
      {toastNotification && (
        <div
          className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between gap-2 border animate-fadeIn ${
            isNitido
              ? 'bg-emerald-50 text-emerald-950 border-emerald-200 shadow-2xs'
              : 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{toastNotification}</span>
          </div>
          <span className="text-[10px] opacity-75">Auto-guardado en localStorage ✓</span>
        </div>
      )}

      {/* 2. Top Summary Metrics KPI Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {/* Metric 1: Total Predicted Next Month */}
        <div className={`p-3.5 rounded-2xl border ${isNitido ? 'bg-slate-50/80 border-slate-200' : 'bg-slate-900/80 border-slate-800'}`}>
          <span className={`text-[10px] font-bold uppercase tracking-wider block ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
            Gasto Estimado Próximo Mes
          </span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className={`text-xl sm:text-2xl font-black ${isNitido ? 'text-indigo-900' : 'text-indigo-400'}`}>
              {currSym}{prediction.totalPredictedNextMonth.toLocaleString()}
            </span>
          </div>
          <span className={`text-[10px] font-semibold block mt-1 ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
            Promedio 6M: {currSym}{prediction.totalHistorical6mAverage.toLocaleString()}
          </span>
        </div>

        {/* Metric 2: Current vs Suggested Budget */}
        <div className={`p-3.5 rounded-2xl border ${isNitido ? 'bg-slate-50/80 border-slate-200' : 'bg-slate-900/80 border-slate-800'}`}>
          <span className={`text-[10px] font-bold uppercase tracking-wider block ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
            Presupuesto Sugerido
          </span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className={`text-xl sm:text-2xl font-black ${isNitido ? 'text-emerald-700' : 'text-emerald-400'}`}>
              {currSym}{prediction.totalSuggestedBudget.toLocaleString()}
            </span>
          </div>
          <span className={`text-[10px] font-semibold block mt-1 ${prediction.totalDifference <= 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
            {prediction.totalDifference > 0 ? `+${currSym}${prediction.totalDifference} vs actual` : `${currSym}${prediction.totalDifference} vs actual`}
          </span>
        </div>

        {/* Metric 3: Projected Savings Capacity */}
        <div className={`p-3.5 rounded-2xl border ${isNitido ? 'bg-slate-50/80 border-slate-200' : 'bg-slate-900/80 border-slate-800'}`}>
          <span className={`text-[10px] font-bold uppercase tracking-wider block ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
            Margen de Ahorro Neto
          </span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span
              className={`text-xl sm:text-2xl font-black ${
                prediction.projectedNetSavingsMargin >= 0
                  ? isNitido ? 'text-emerald-700' : 'text-emerald-400'
                  : 'text-rose-600'
              }`}
            >
              {prediction.projectedNetSavingsMargin >= 0 ? '+' : ''}{currSym}{prediction.projectedNetSavingsMargin.toLocaleString()}
            </span>
            <span className={`text-[10px] font-semibold ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>/mes</span>
          </div>
          <span className={`text-[10px] font-semibold block mt-1 ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
            Capacidad sobre ingreso neto
          </span>
        </div>

        {/* Metric 4: Statistical Confidence */}
        <div className={`p-3.5 rounded-2xl border ${isNitido ? 'bg-slate-50/80 border-slate-200' : 'bg-slate-900/80 border-slate-800'}`}>
          <span className={`text-[10px] font-bold uppercase tracking-wider block ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
            Fiabilidad del Modelo
          </span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className={`text-xl sm:text-2xl font-black ${isNitido ? 'text-indigo-700' : 'text-cyan-400'}`}>
              {prediction.averageConfidenceScore}%
            </span>
            <span className={`text-[10px] font-semibold ${isNitido ? 'text-emerald-600' : 'text-emerald-400'}`}>
              Alta certeza
            </span>
          </div>
          <span className={`text-[10px] font-semibold block mt-1 ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
            WMA + Regresión 6 meses
          </span>
        </div>
      </div>

      {isSectionExpanded && (
        <div className="space-y-6">
          {/* 3. Global Action Callout Banner */}
          <div
            className={`p-4 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
              isNitido
                ? 'bg-indigo-50/50 border-indigo-200/80 shadow-2xs'
                : 'bg-indigo-950/40 border-indigo-800/80'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                <Sliders className="w-4 h-4" />
              </div>
              <div>
                <h4 className={`text-sm font-bold ${isNitido ? 'text-slate-900' : 'text-white'}`}>
                  Sugerencia de Ajuste Automático al Presupuesto Mensual
                </h4>
                <p className={`text-xs mt-0.5 ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
                  Ajusta los límites numéricos de gasto para el próximo mes con base en tu historial de 6 meses.
                  Presupuesto propuesto: <strong>{currSym}{prediction.totalSuggestedBudget.toLocaleString()}</strong> (
                  {prediction.totalDifference >= 0 ? `+${currSym}${prediction.totalDifference}` : `${currSym}${prediction.totalDifference}`}/mes).
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleApplyAllAdjustments}
              className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all shadow-sm active:scale-95 shrink-0 ${
                isNitido
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  : 'bg-indigo-500 hover:bg-indigo-400 text-slate-950 font-black'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>Aplicar Presupuesto Predictivo al Próximo Mes</span>
            </button>
          </div>

          {/* 4. Interactive 6-Month + Next Month Prediction Chart */}
          <div className={`p-4 sm:p-5 rounded-2xl border ${isNitido ? 'bg-slate-50/50 border-slate-200' : 'bg-slate-950/70 border-slate-800'}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <span className={`text-xs font-bold block ${isNitido ? 'text-slate-900' : 'text-white'}`}>
                  Serie Temporal: 6 Meses de Historial vs. Próximo Mes Estimado
                </span>
                <span className={`text-[11px] ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
                  La última barra destaca el gasto proyectado por el modelo estadístico.
                </span>
              </div>

              {/* Category Filter for the Chart */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                <button
                  type="button"
                  onClick={() => setSelectedChartCategory('total')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all shrink-0 border ${
                    selectedChartCategory === 'total'
                      ? isNitido
                        ? 'bg-indigo-600 text-white border-indigo-600 font-black'
                        : 'bg-indigo-600 text-white border-indigo-500 font-black'
                      : isNitido
                      ? 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  Gasto Total
                </button>

                {prediction.categories.map((cat) => {
                  const isSelected = selectedChartCategory === cat.category;
                  const Icon = CATEGORY_ICONS_MAP[cat.category] || DollarSign;

                  return (
                    <button
                      key={cat.category}
                      type="button"
                      onClick={() => setSelectedChartCategory(cat.category)}
                      className={`flex items-center gap-1 px-2 py-1 text-xs font-bold rounded-lg transition-all shrink-0 border ${
                        isSelected
                          ? isNitido
                            ? 'bg-slate-900 text-white border-slate-900 font-black'
                            : 'bg-white text-slate-900 border-white font-black'
                          : isNitido
                          ? 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                          : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: CATEGORY_COLORS[cat.category] || '#6366f1' }}
                      />
                      <Icon className="w-3 h-3" />
                      <span>{cat.categoryLabel.split('/')[0].split('(')[0].trim()}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Recharts Bar/Line Visualizer */}
            <div className="h-72 sm:h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 20, right: 25, left: 0, bottom: 5 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={isNitido ? '#e2e8f0' : '#1e293b'}
                    vertical={false}
                  />

                  <XAxis
                    dataKey="monthLabel"
                    stroke={isNitido ? '#64748b' : '#94a3b8'}
                    fontSize={11}
                    fontWeight={600}
                    tickLine={false}
                    axisLine={{ stroke: isNitido ? '#cbd5e1' : '#334155' }}
                  />

                  <YAxis
                    stroke={isNitido ? '#64748b' : '#94a3b8'}
                    fontSize={11}
                    fontWeight={600}
                    tickLine={false}
                    axisLine={{ stroke: isNitido ? '#cbd5e1' : '#334155' }}
                    tickFormatter={(val) => `${currSym}${val}`}
                  />

                  <Tooltip content={<CustomPredictionTooltip />} />

                  <Legend
                    verticalAlign="top"
                    align="right"
                    wrapperStyle={{ paddingBottom: 10, fontSize: 11, fontWeight: 700 }}
                    formatter={(val) => {
                      if (val === 'spend') {
                        return selectedChartCategory === 'total'
                          ? 'Gasto Histórico & Predicción'
                          : `Gasto: ${activeCategoryObj?.categoryLabel || selectedChartCategory}`;
                      }
                      if (val === 'budgetBenchmark') return 'Presupuesto Actual Asignado';
                      return val;
                    }}
                  />

                  {/* Reference line for current budget benchmark */}
                  <ReferenceLine
                    y={chartData[0]?.budgetBenchmark || 0}
                    stroke={isNitido ? '#f59e0b' : '#fbbf24'}
                    strokeDasharray="4 4"
                    strokeWidth={2}
                    label={{
                      value: `Límite Actual: ${currSym}${(chartData[0]?.budgetBenchmark || 0).toLocaleString()}`,
                      position: 'insideTopRight',
                      fill: isNitido ? '#b45309' : '#fbbf24',
                      fontSize: 10,
                      fontWeight: 800,
                    }}
                  />

                  {/* Bars for historical and predicted spend */}
                  <Bar dataKey="spend" radius={[8, 8, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          entry.isPredicted
                            ? '#10b981' // Highlight predicted column in emerald
                            : selectedChartCategory === 'total'
                            ? isNitido ? '#4f46e5' : '#6366f1'
                            : CATEGORY_COLORS[selectedChartCategory] || '#4f46e5'
                        }
                        stroke={entry.isPredicted ? '#059669' : 'transparent'}
                        strokeWidth={entry.isPredicted ? 2 : 0}
                      />
                    ))}
                  </Bar>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 5. Category Prediction & Budget Adjustment Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className={`text-xs font-bold flex items-center gap-1.5 ${isNitido ? 'text-slate-800' : 'text-slate-200'}`}>
                <Sliders className="w-4 h-4 text-indigo-500" />
                Desglose Predictivo por Categoría y Ajustes Recomendados:
              </span>
              <span className={`text-[10px] font-semibold ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
                {prediction.categories.length} categorías analizadas
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
              {prediction.categories.map((cat) => {
                const Icon = CATEGORY_ICONS_MAP[cat.category] || DollarSign;
                const isApplied = Boolean(appliedCategories[cat.category]);
                const delta = cat.budgetDelta;

                return (
                  <div
                    key={cat.category}
                    className={`p-4 rounded-2xl border flex flex-col justify-between space-y-3 transition-all ${
                      isNitido
                        ? 'bg-white border-slate-200 shadow-2xs hover:border-indigo-300'
                        : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      {/* Category Header */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                            style={{
                              backgroundColor: `${CATEGORY_COLORS[cat.category]}18`,
                              color: CATEGORY_COLORS[cat.category],
                            }}
                          >
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <span className={`text-xs font-bold block truncate ${isNitido ? 'text-slate-900' : 'text-white'}`}>
                              {cat.categoryLabel.split('/')[0].trim()}
                            </span>
                            <span className={`text-[10px] font-semibold ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
                              {cat.isFixed ? 'Gasto Fijo' : 'Gasto Variable'}
                            </span>
                          </div>
                        </div>

                        {/* Trend badge */}
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border ${
                            cat.trendDirection === 'increasing'
                              ? isNitido
                                ? 'bg-rose-50 text-rose-800 border-rose-200'
                                : 'bg-rose-950/80 text-rose-300 border-rose-800'
                              : cat.trendDirection === 'decreasing'
                              ? isNitido
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                              : isNitido
                              ? 'bg-slate-100 text-slate-700 border-slate-200'
                              : 'bg-slate-800 text-slate-300 border-slate-700'
                          }`}
                        >
                          {cat.trendDirection === 'increasing' ? (
                            <>
                              <TrendingUp className="w-3 h-3 text-rose-600" />
                              <span>+{Math.abs(cat.trendPercentage)}%</span>
                            </>
                          ) : cat.trendDirection === 'decreasing' ? (
                            <>
                              <TrendingDown className="w-3 h-3 text-emerald-600" />
                              <span>-{Math.abs(cat.trendPercentage)}%</span>
                            </>
                          ) : (
                            <span>Estable</span>
                          )}
                        </span>
                      </div>

                      {/* Mini 6-Month Spark Dots */}
                      <div className="mt-3 flex items-center justify-between text-[10px] text-slate-500 font-semibold px-0.5">
                        <span>Historial 6m:</span>
                        <div className="flex items-center gap-1">
                          {cat.history6Months.map((h, i) => (
                            <span
                              key={i}
                              title={`${h.monthLabel}: ${currSym}${h.spend}`}
                              className="w-1.5 h-3.5 rounded-xs bg-slate-300 dark:bg-slate-700"
                            />
                          ))}
                          <span
                            title={`Estimado próximo mes: ${currSym}${cat.predictedNextMonthExpense}`}
                            className="w-2 h-4.5 rounded-xs bg-emerald-500"
                          />
                        </div>
                      </div>

                      {/* Comparison: Current vs Predicted vs Suggested */}
                      <div className="mt-2.5 grid grid-cols-2 gap-2 text-xs">
                        <div className={`p-2 rounded-xl border ${isNitido ? 'bg-slate-50 border-slate-100' : 'bg-slate-950/50 border-slate-800'}`}>
                          <span className={`text-[9px] font-bold uppercase tracking-wider block ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
                            Estimado 6M
                          </span>
                          <span className={`text-sm font-black ${isNitido ? 'text-slate-900' : 'text-white'}`}>
                            {currSym}{cat.predictedNextMonthExpense.toLocaleString()}
                          </span>
                        </div>

                        <div className={`p-2 rounded-xl border ${isNitido ? 'bg-indigo-50/60 border-indigo-200' : 'bg-indigo-950/40 border-indigo-800'}`}>
                          <span className={`text-[9px] font-bold uppercase tracking-wider block ${isNitido ? 'text-indigo-900' : 'text-indigo-300'}`}>
                            Sugerido
                          </span>
                          <span className={`text-sm font-black ${isNitido ? 'text-indigo-900' : 'text-indigo-300'}`}>
                            {currSym}{cat.suggestedBudget.toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {/* Rationale explanation */}
                      <p className={`text-[11px] mt-2 leading-relaxed ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
                        {cat.rationale}
                      </p>
                    </div>

                    {/* Single Category Apply Button */}
                    <button
                      type="button"
                      onClick={() => handleApplySingleCategory(cat)}
                      disabled={isApplied || delta === 0}
                      className={`w-full py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border active:scale-95 ${
                        isApplied
                          ? isNitido
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300 cursor-default'
                            : 'bg-emerald-950 text-emerald-300 border-emerald-800 cursor-default'
                          : delta === 0
                          ? isNitido
                            ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-default'
                            : 'bg-slate-800 text-slate-500 border-slate-700 cursor-default'
                          : isNitido
                          ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-950 border-indigo-300'
                          : 'bg-indigo-950/60 hover:bg-indigo-900 text-indigo-300 border-indigo-800'
                      }`}
                    >
                      {isApplied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Ajuste aplicado</span>
                        </>
                      ) : delta === 0 ? (
                        <span>Presupuesto óptimo</span>
                      ) : (
                        <>
                          <Sliders className="w-3.5 h-3.5 text-indigo-600" />
                          <span>
                            Ajustar ({delta > 0 ? `+${currSym}${delta}` : `${currSym}${delta}`})
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Scientific Modeling Note */}
            <div className={`p-3 rounded-xl border flex items-center gap-2.5 text-xs ${isNitido ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-slate-900 border-slate-800 text-slate-300'}`}>
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                <strong>Metodología Predictiva:</strong> Combina Media Móvil Ponderada Exponencial (WMA con mayor peso a meses recientes) y Regresión Lineal de Mínimos Cuadrados para modelar tendencias de aceleración o enfriamiento del gasto por categoría.
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
