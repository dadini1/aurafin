import React, { useEffect, useMemo, useState } from 'react';
import {
  Sparkles,
  Check,
  X,
  TrendingUp,
  TrendingDown,
  Minus,
  RotateCcw,
  Home,
  Car,
  ShoppingBag,
  Zap,
  Coffee,
  HeartPulse,
  BookOpen,
  DollarSign,
  CheckCircle2,
  EyeOff,
  Loader2,
  Calendar,
} from 'lucide-react';
import { PaymentItem, SavingsGoal, UserFinancialProfile } from '../types';
import {
  calculateSixMonthExpensePrediction,
  CategoryPredictionAnalysis,
  PredictionStrategy,
} from '../services/predictiveExpenseService';
import { analyzeBudgetPatternsWithAI } from '../services/geminiService';
import { useTheme } from '../context/ThemeContext';

interface AIBudgetForecastWidgetProps {
  payments: PaymentItem[];
  categoryBudgets: Record<string, number>;
  onUpdateCategoryBudgets: (updated: Record<string, number>) => void;
  profile: UserFinancialProfile;
  goals?: SavingsGoal[];
}

type ForecastDecisionStatus = 'pending' | 'confirmed' | 'ignored';

interface PersistedDecisionRecord {
  status: ForecastDecisionStatus;
  previousBudget?: number;
  appliedBudget?: number;
  decidedAt: string;
}

const FORECAST_DECISIONS_STORAGE_KEY = 'aurafin_ai_budget_forecast_decisions_v1';

const CATEGORY_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  alquiler: Home,
  transporte: Car,
  alimentacion: ShoppingBag,
  servicios: Zap,
  ocio: Coffee,
  salud: HeartPulse,
  educacion: BookOpen,
  otro: DollarSign,
};

export const AIBudgetForecastWidget: React.FC<AIBudgetForecastWidgetProps> = ({
  payments,
  categoryBudgets,
  onUpdateCategoryBudgets,
  profile,
  goals = [],
}) => {
  const { isNitido, isVibrant } = useTheme();
  const currSym = profile.currencySymbol || '$';

  const [strategy, setStrategy] = useState<PredictionStrategy>('balanced');
  const [filterView, setFilterView] = useState<'actionable' | 'all'>('actionable');
  const [isRefiningAI, setIsRefiningAI] = useState(false);
  const [aiRationales, setAiRationales] = useState<Record<string, string>>({});
  const [aiOverviewNote, setAiOverviewNote] = useState<string | null>(null);

  const [decisions, setDecisions] = useState<Record<string, PersistedDecisionRecord>>(() => {
    try {
      const saved = localStorage.getItem(FORECAST_DECISIONS_STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(FORECAST_DECISIONS_STORAGE_KEY, JSON.stringify(decisions));
    } catch {
      // ignore storage quota errors
    }
  }, [decisions]);

  const prediction = useMemo(
    () => calculateSixMonthExpensePrediction(payments, categoryBudgets, profile, strategy),
    [payments, categoryBudgets, profile, strategy]
  );

  // Enrich suggestions with AI-generated rationale via analyzeBudgetPatternsWithAI when triggered
  const handleRefineWithAI = async () => {
    setIsRefiningAI(true);
    try {
      const aiResult = await analyzeBudgetPatternsWithAI(
        payments,
        categoryBudgets,
        profile,
        goals
      );
      const nextRationales: Record<string, string> = {};
      aiResult.categories.forEach((cat) => {
        if (cat.optimizationRationale) {
          nextRationales[cat.category] = cat.optimizationRationale;
        }
      });
      setAiRationales(nextRationales);
      if (aiResult.aiStrategicOverview) {
        setAiOverviewNote(aiResult.aiStrategicOverview);
      }
    } catch (err) {
      console.warn('AI Forecast refinement fallback to statistical model:', err);
    } finally {
      setIsRefiningAI(false);
    }
  };

  const getDecisionStatus = (catKey: string): ForecastDecisionStatus => {
    return decisions[catKey]?.status || 'pending';
  };

  const handleConfirmSuggestion = (cat: CategoryPredictionAnalysis) => {
    const previousBudget = Number(categoryBudgets[cat.category] ?? cat.currentBudget);
    const updatedBudgets = {
      ...categoryBudgets,
      [cat.category]: cat.suggestedBudget,
    };
    onUpdateCategoryBudgets(updatedBudgets);

    setDecisions((prev) => ({
      ...prev,
      [cat.category]: {
        status: 'confirmed',
        previousBudget,
        appliedBudget: cat.suggestedBudget,
        decidedAt: new Date().toISOString(),
      },
    }));
  };

  const handleIgnoreSuggestion = (cat: CategoryPredictionAnalysis) => {
    setDecisions((prev) => ({
      ...prev,
      [cat.category]: {
        status: 'ignored',
        previousBudget: Number(categoryBudgets[cat.category] ?? cat.currentBudget),
        decidedAt: new Date().toISOString(),
      },
    }));
  };

  const handleRevertDecision = (catKey: string) => {
    const rec = decisions[catKey];
    if (rec?.status === 'confirmed' && rec.previousBudget !== undefined) {
      onUpdateCategoryBudgets({
        ...categoryBudgets,
        [catKey]: rec.previousBudget,
      });
    }
    setDecisions((prev) => {
      const next = { ...prev };
      delete next[catKey];
      return next;
    });
  };

  const handleConfirmAllPending = () => {
    const nextBudgets = { ...categoryBudgets };
    const nextDecisions = { ...decisions };
    let changed = false;

    prediction.categories.forEach((cat) => {
      const status = nextDecisions[cat.category]?.status || 'pending';
      if (status === 'pending' && cat.actionType !== 'maintain') {
        const previousBudget = Number(categoryBudgets[cat.category] ?? cat.currentBudget);
        nextBudgets[cat.category] = cat.suggestedBudget;
        nextDecisions[cat.category] = {
          status: 'confirmed',
          previousBudget,
          appliedBudget: cat.suggestedBudget,
          decidedAt: new Date().toISOString(),
        };
        changed = true;
      }
    });

    if (changed) {
      onUpdateCategoryBudgets(nextBudgets);
      setDecisions(nextDecisions);
    }
  };

  const handleResetAllDecisions = () => {
    setDecisions({});
  };

  const counts = useMemo(() => {
    let actionable = 0;
    let pendingActionable = 0;
    let confirmed = 0;
    let ignored = 0;

    prediction.categories.forEach((cat) => {
      const status = decisions[cat.category]?.status || 'pending';
      if (cat.actionType !== 'maintain' || status !== 'pending') {
        actionable += 1;
      }
      if (status === 'confirmed') confirmed += 1;
      else if (status === 'ignored') ignored += 1;
      else if (cat.actionType !== 'maintain') pendingActionable += 1;
    });

    return { actionable, pendingActionable, confirmed, ignored };
  }, [prediction.categories, decisions]);

  const visibleCategories = useMemo(() => {
    if (filterView === 'all') return prediction.categories;
    const filtered = prediction.categories.filter(
      (cat) => cat.actionType !== 'maintain' || Boolean(decisions[cat.category])
    );
    return filtered.length > 0 ? filtered : prediction.categories;
  }, [prediction.categories, filterView, decisions]);

  const cardSurfaceClass = isNitido
    ? 'bg-white border-slate-200 text-slate-900 shadow-xs'
    : isVibrant
    ? 'bg-slate-900/95 border-cyan-500/30 text-slate-100'
    : 'bg-slate-900 border-slate-800 text-slate-100';

  const hairlineBorder = isNitido ? 'border-slate-200/80' : 'border-slate-800';

  return (
    <section
      aria-label="Widget Pronóstico de Presupuesto IA"
      className={`rounded-2xl border p-5 sm:p-6 transition-colors ${cardSurfaceClass}`}
    >
      {/* Header Row */}
      <div className={`flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-5 border-b ${hairlineBorder}`}>
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Sparkles className={`w-5 h-5 shrink-0 ${isNitido ? 'text-indigo-600' : 'text-cyan-400'}`} />
            <h3 className="text-base sm:text-lg font-bold tracking-tight">
              AI Budget Forecast · Pronóstico del Próximo Mes
            </h3>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border tabular-nums ${
                isNitido
                  ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                  : 'bg-cyan-500/15 text-cyan-300 border-cyan-400/35'
              }`}
            >
              Confianza {prediction.averageConfidenceScore}%
            </span>
          </div>
          <p className={`text-xs mt-1 flex flex-wrap items-center gap-1.5 ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
            <Calendar className="w-3.5 h-3.5 shrink-0" />
            <span>
              Basado en tus patrones de gasto de los últimos 6 meses para{' '}
              <strong className={isNitido ? 'text-slate-800' : 'text-slate-200'}>
                {prediction.nextMonthLabel}
              </strong>
            </span>
          </p>
        </div>

        {/* Strategy & AI Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div
            className={`flex items-center p-1 rounded-lg border ${
              isNitido ? 'bg-slate-100 border-slate-200' : 'bg-slate-800 border-slate-700'
            }`}
          >
            {[
              { id: 'balanced' as const, label: 'Equilibrado' },
              { id: 'aggressive_savings' as const, label: 'Máximo Ahorro' },
              { id: 'conservative' as const, label: 'Holgado (+10%)' },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setStrategy(item.id)}
                className={`px-2.5 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                  strategy === item.id
                    ? isNitido
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'bg-slate-700 text-white'
                    : isNitido
                    ? 'text-slate-600 hover:text-slate-900'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleRefineWithAI}
            disabled={isRefiningAI}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border whitespace-nowrap shrink-0 transition-colors ${
              isNitido
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-600'
                : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 border-cyan-400'
            } disabled:opacity-60`}
          >
            {isRefiningAI ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Analizando...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Refinar con IA</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Optional AI Executive Summary Banner */}
      {aiOverviewNote && (
        <div
          className={`mt-4 px-4 py-3 rounded-xl border text-xs leading-relaxed ${
            isNitido
              ? 'bg-indigo-50/70 border-indigo-200 text-indigo-950'
              : 'bg-indigo-950/35 border-indigo-500/35 text-indigo-100'
          }`}
        >
          <span className="font-bold mr-1.5">Diagnóstico IA:</span>
          {aiOverviewNote}
        </div>
      )}

      {/* 4-Column Flat KPI Summary Strip */}
      <div className={`grid grid-cols-2 lg:grid-cols-4 gap-4 py-5 border-b ${hairlineBorder}`}>
        <div>
          <span className={`text-xs block ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
            Gasto previsto próximo mes
          </span>
          <span className="text-xl sm:text-2xl font-bold tabular-nums mt-0.5 block">
            {currSym}{prediction.totalPredictedNextMonth.toLocaleString()}
          </span>
          <span className={`text-[11px] tabular-nums ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
            Promedio 6m: {currSym}{prediction.totalHistorical6mAverage.toLocaleString()}
          </span>
        </div>

        <div>
          <span className={`text-xs block ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
            Presupuesto actual vs. sugerido
          </span>
          <div className="flex items-baseline gap-1.5 mt-0.5 tabular-nums">
            <span className="text-xl sm:text-2xl font-bold">
              {currSym}{prediction.totalSuggestedBudget.toLocaleString()}
            </span>
            <span
              className={`text-xs font-bold ${
                prediction.totalDifference <= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-amber-600 dark:text-amber-400'
              }`}
            >
              ({prediction.totalDifference >= 0 ? '+' : '-'}
              {currSym}{Math.abs(prediction.totalDifference).toLocaleString()})
            </span>
          </div>
          <span className={`text-[11px] tabular-nums ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
            Límite vigente: {currSym}{prediction.totalCurrentBudget.toLocaleString()}
          </span>
        </div>

        <div>
          <span className={`text-xs block ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
            Margen proyectado de ahorro
          </span>
          <span
            className={`text-xl sm:text-2xl font-bold tabular-nums mt-0.5 block ${
              prediction.projectedNetSavingsMargin >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {currSym}{prediction.projectedNetSavingsMargin.toLocaleString()}
          </span>
          <span className={`text-[11px] ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
            Ingreso menos presupuesto sugerido
          </span>
        </div>

        <div>
          <span className={`text-xs block ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
            Estado de sugerencias
          </span>
          <div className="flex items-baseline gap-2 mt-0.5 tabular-nums">
            <span className="text-xl sm:text-2xl font-bold">
              {counts.pendingActionable}
            </span>
            <span className={`text-xs ${isNitido ? 'text-slate-600' : 'text-slate-300'}`}>
              pendiente{counts.pendingActionable === 1 ? '' : 's'}
            </span>
          </div>
          <span className={`text-[11px] tabular-nums ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
            {counts.confirmed} confirmada{counts.confirmed === 1 ? '' : 's'} · {counts.ignored} ignorada{counts.ignored === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      {/* Filter & Bulk Action Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-5 pb-4">
        <div
          className={`inline-flex items-center p-1 rounded-lg border self-start ${
            isNitido ? 'bg-slate-100 border-slate-200' : 'bg-slate-800 border-slate-700'
          }`}
        >
          <button
            type="button"
            onClick={() => setFilterView('actionable')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
              filterView === 'actionable'
                ? isNitido
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'bg-slate-700 text-white'
                : isNitido
                ? 'text-slate-600 hover:text-slate-900'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Ajustes sugeridos ({counts.actionable})
          </button>
          <button
            type="button"
            onClick={() => setFilterView('all')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
              filterView === 'all'
                ? isNitido
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'bg-slate-700 text-white'
                : isNitido
                ? 'text-slate-600 hover:text-slate-900'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Todas las categorías ({prediction.categories.length})
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(counts.confirmed > 0 || counts.ignored > 0) && (
            <button
              type="button"
              onClick={handleResetAllDecisions}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border whitespace-nowrap shrink-0 transition-colors ${
                isNitido
                  ? 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restablecer decisiones</span>
            </button>
          )}

          {counts.pendingActionable > 0 && (
            <button
              type="button"
              onClick={handleConfirmAllPending}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold whitespace-nowrap shrink-0 transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Confirmar todas ({counts.pendingActionable})</span>
            </button>
          )}
        </div>
      </div>

      {/* Category Suggestions List with Confirm / Ignore Actions */}
      <div className="space-y-3">
        {visibleCategories.map((cat) => {
          const IconComp = CATEGORY_ICON_MAP[cat.category] || DollarSign;
          const status = getDecisionStatus(cat.category);
          const customRationale = aiRationales[cat.category] || cat.rationale;
          const liveBudget = Number(categoryBudgets[cat.category] ?? cat.currentBudget);
          const isPositiveDelta = cat.budgetDelta > 0;
          const isNeutral = cat.actionType === 'maintain';

          const TrendIcon =
            cat.trendDirection === 'increasing'
              ? TrendingUp
              : cat.trendDirection === 'decreasing'
              ? TrendingDown
              : Minus;

          return (
            <div
              key={cat.category}
              className={`p-4 rounded-xl border transition-colors ${
                status === 'confirmed'
                  ? isNitido
                    ? 'bg-emerald-50/70 border-emerald-200'
                    : 'bg-emerald-950/25 border-emerald-500/35'
                  : status === 'ignored'
                  ? isNitido
                    ? 'bg-slate-50/70 border-slate-200 opacity-75'
                    : 'bg-slate-950/40 border-slate-800 opacity-75'
                  : isNitido
                  ? 'bg-slate-50/60 border-slate-200 hover:border-slate-300'
                  : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Left: Category Identity + Historical Metrics + Rationale */}
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div
                    className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${
                      isNitido
                        ? 'bg-white border-slate-200 text-slate-700'
                        : 'bg-slate-800 border-slate-700 text-slate-200'
                    }`}
                  >
                    <IconComp className="w-5 h-5" />
                  </div>

                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-bold">{cat.categoryLabel}</h4>

                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-semibold tabular-nums ${
                          cat.trendDirection === 'increasing'
                            ? isNitido
                              ? 'text-amber-700'
                              : 'text-amber-300'
                            : cat.trendDirection === 'decreasing'
                            ? isNitido
                              ? 'text-emerald-700'
                              : 'text-emerald-400'
                            : isNitido
                            ? 'text-slate-500'
                            : 'text-slate-400'
                        }`}
                      >
                        <TrendIcon className="w-3.5 h-3.5" />
                        <span>
                          {cat.trendPercentage >= 0 ? `+${cat.trendPercentage}%` : `${cat.trendPercentage}%`} (6m)
                        </span>
                      </span>

                      <span className={`text-[11px] tabular-nums ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
                        · Confianza {cat.confidenceScore}%
                      </span>
                    </div>

                    {/* Mini Historical Sparkline Bars + Numeric Context */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs tabular-nums">
                      <span className={isNitido ? 'text-slate-600' : 'text-slate-400'}>
                        Prom. 6m:{' '}
                        <strong className={isNitido ? 'text-slate-900' : 'text-slate-200'}>
                          {currSym}{cat.sixMonthAverage.toLocaleString()}
                        </strong>
                      </span>
                      <span className={isNitido ? 'text-slate-600' : 'text-slate-400'}>
                        Gasto previsto:{' '}
                        <strong className={isNitido ? 'text-slate-900' : 'text-slate-200'}>
                          {currSym}{cat.predictedNextMonthExpense.toLocaleString()}
                        </strong>
                      </span>

                      {/* 6-month micro bar visualization */}
                      <div
                        className="inline-flex items-end gap-0.5 h-4"
                        title={`Tendencia últimos 6 meses: ${cat.history6Months
                          .map((m) => `${m.monthLabel}: ${currSym}${m.spend}`)
                          .join(', ')}`}
                      >
                        {(() => {
                          const maxVal = Math.max(
                            cat.predictedNextMonthExpense,
                            ...cat.history6Months.map((m) => m.spend),
                            1
                          );
                          return (
                            <>
                              {cat.history6Months.map((pt) => (
                                <span
                                  key={pt.monthKey}
                                  className={`w-1.5 rounded-xs ${
                                    isNitido ? 'bg-slate-300' : 'bg-slate-600'
                                  }`}
                                  style={{
                                    height: `${Math.max(20, Math.round((pt.spend / maxVal) * 100))}%`,
                                  }}
                                />
                              ))}
                              <span
                                className={`w-1.5 rounded-xs ${
                                  isNitido ? 'bg-indigo-600' : 'bg-cyan-400'
                                }`}
                                style={{
                                  height: `${Math.max(
                                    20,
                                    Math.round((cat.predictedNextMonthExpense / maxVal) * 100)
                                  )}%`,
                                }}
                              />
                            </>
                          );
                        })()}
                      </div>
                    </div>

                    <p className={`text-xs leading-relaxed ${isNitido ? 'text-slate-600' : 'text-slate-300'}`}>
                      {customRationale}
                    </p>
                  </div>
                </div>

                {/* Right: Suggested Budget Change + Confirm/Ignore Controls */}
                <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-start sm:items-center lg:items-end xl:items-center gap-3 shrink-0">
                  <div className="text-left lg:text-right xl:text-right tabular-nums">
                    {status === 'confirmed' && decisions[cat.category]?.previousBudget !== undefined ? (
                      <>
                        <div className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                          Anterior {currSym}{decisions[cat.category].previousBudget!.toLocaleString()} → Aplicado
                        </div>
                        <div className="flex items-baseline gap-1.5 sm:justify-end">
                          <span className="text-base font-bold text-emerald-700 dark:text-emerald-300">
                            {currSym}{(decisions[cat.category].appliedBudget ?? cat.suggestedBudget).toLocaleString()}
                          </span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                          Actual {currSym}{liveBudget.toLocaleString()} → Sugerido
                        </div>
                        <div className="flex items-baseline gap-1.5 sm:justify-end">
                          <span className="text-base font-bold">
                            {currSym}{cat.suggestedBudget.toLocaleString()}
                          </span>
                          {!isNeutral && (
                            <span
                              className={`text-xs font-bold ${
                                isPositiveDelta
                                  ? isNitido
                                    ? 'text-amber-700'
                                    : 'text-amber-300'
                                  : isNitido
                                  ? 'text-emerald-700'
                                  : 'text-emerald-400'
                              }`}
                            >
                              ({isPositiveDelta ? '+' : '-'}
                              {currSym}{Math.abs(cat.budgetDelta).toLocaleString()})
                            </span>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Confirm / Ignore Decision Buttons */}
                  {status === 'pending' ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleConfirmSuggestion(cat)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold whitespace-nowrap shrink-0 transition-colors"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Confirmar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleIgnoreSuggestion(cat)}
                        className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border whitespace-nowrap shrink-0 transition-colors ${
                          isNitido
                            ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                        }`}
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Ignorar</span>
                      </button>
                    </div>
                  ) : status === 'confirmed' ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border whitespace-nowrap ${
                          isNitido
                            ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                            : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Confirmado</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRevertDecision(cat.category)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border whitespace-nowrap shrink-0 transition-colors ${
                          isNitido
                            ? 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                        }`}
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Deshacer</span>
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border whitespace-nowrap ${
                          isNitido
                            ? 'bg-slate-100 text-slate-600 border-slate-300'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                      >
                        <EyeOff className="w-3.5 h-3.5" />
                        <span>Ignorado</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRevertDecision(cat.category)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border whitespace-nowrap shrink-0 transition-colors ${
                          isNitido
                            ? 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                        }`}
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Restaurar</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
