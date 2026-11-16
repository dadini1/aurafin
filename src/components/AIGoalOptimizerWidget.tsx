import React, { useMemo, useState } from 'react';
import {
  Rocket,
  Sparkles,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Check,
  RotateCcw,
  Calendar,
  Zap,
  Loader2,
  CheckCircle2,
  Plus,
  Minus,
} from 'lucide-react';
import { PaymentItem, SavingsGoal, UserFinancialProfile } from '../types';
import { calculateSixMonthExpensePrediction } from '../services/predictiveExpenseService';
import { analyzeBudgetPatternsWithAI } from '../services/geminiService';
import { useTheme } from '../context/ThemeContext';

interface AIGoalOptimizerWidgetProps {
  goals: SavingsGoal[];
  payments: PaymentItem[];
  categoryBudgets: Record<string, number>;
  profile: UserFinancialProfile;
  netSavings: number;
  onUpdateGoalMonthlyContribution: (id: string, newMonthlyContribution: number) => void;
  onOpenAddGoal?: () => void;
}

type OptimizerPaceMode = 'gentle' | 'balanced' | 'accelerated';

interface GoalOptimizationSuggestion {
  goal: SavingsGoal;
  remaining: number;
  currentMonthly: number;
  suggestedIncrement: number;
  suggestedMonthly: number;
  currentMonths: number;
  acceleratedMonths: number;
  monthsSaved: number;
  currentEtaLabel: string;
  acceleratedEtaLabel: string;
  fundingSource: string;
}

interface AppliedGoalRecord {
  previousMonthly: number;
  appliedMonthly: number;
}

const PACE_CONFIG: Record<
  OptimizerPaceMode,
  { label: string; incrementPct: number; minStep: number; maxShareOfSlack: number }
> = {
  gentle: {
    label: 'Gradual (+10%)',
    incrementPct: 0.12,
    minStep: 15,
    maxShareOfSlack: 0.55,
  },
  balanced: {
    label: 'Equilibrado (+20%)',
    incrementPct: 0.22,
    minStep: 25,
    maxShareOfSlack: 0.85,
  },
  accelerated: {
    label: 'Acelerado (+35%)',
    incrementPct: 0.35,
    minStep: 40,
    maxShareOfSlack: 1.15,
  },
};

const MONTH_SHORT_ES = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];

function formatEtaFromMonths(months: number): string {
  if (months <= 0) return 'Completada';
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return `${MONTH_SHORT_ES[d.getMonth()]} ${d.getFullYear()}`;
}

export const AIGoalOptimizerWidget: React.FC<AIGoalOptimizerWidgetProps> = ({
  goals,
  payments,
  categoryBudgets,
  profile,
  netSavings,
  onUpdateGoalMonthlyContribution,
  onOpenAddGoal,
}) => {
  const { isNitido, isVibrant } = useTheme();
  const currSym = profile.currencySymbol || '$';

  const [paceMode, setPaceMode] = useState<OptimizerPaceMode>('balanced');
  const [customIncrements, setCustomIncrements] = useState<Record<string, number>>({});
  const [appliedRecords, setAppliedRecords] = useState<Record<string, AppliedGoalRecord>>({});
  const [isRefiningAI, setIsRefiningAI] = useState(false);
  const [aiSummaryBanner, setAiSummaryBanner] = useState<string | null>(null);

  // 1. Analyze spending trends across categories to locate optimizable monthly cashflow
  const spendingTrendAnalysis = useMemo(() => {
    const prediction = calculateSixMonthExpensePrediction(
      payments,
      categoryBudgets,
      profile,
      'aggressive_savings'
    );

    const reclaimableSources: Array<{
      category: string;
      label: string;
      monthlyCut: number;
      trendPct: number;
    }> = [];

    prediction.categories.forEach((cat) => {
      if (cat.isFixed) return;
      const actualVsSuggested = Math.max(0, cat.predictedNextMonthExpense - cat.suggestedBudget);
      const bufferCut =
        cat.trendDirection === 'increasing'
          ? Math.max(15, Math.round((cat.predictedNextMonthExpense * 0.12) / 5) * 5)
          : Math.max(10, Math.round((cat.predictedNextMonthExpense * 0.08) / 5) * 5);
      const monthlyCut = Math.max(actualVsSuggested, bufferCut);
      reclaimableSources.push({
        category: cat.category,
        label: cat.categoryLabel,
        monthlyCut,
        trendPct: cat.trendPercentage,
      });
    });

    reclaimableSources.sort((a, b) => b.monthlyCut - a.monthlyCut);

    const totalReclaimable = reclaimableSources.reduce((sum, s) => sum + s.monthlyCut, 0);
    const currentGoalsCommitment = goals.reduce(
      (sum, g) => sum + Math.max(0, Number(g.monthlyContribution) || 0),
      0
    );
    const unallocatedSurplus = Math.max(0, Math.round(netSavings - currentGoalsCommitment));

    return {
      reclaimableSources: reclaimableSources.slice(0, 3),
      totalReclaimable,
      unallocatedSurplus,
      totalOptimizableCapacity: totalReclaimable + Math.round(unallocatedSurplus * 0.5),
      currentGoalsCommitment,
    };
  }, [payments, categoryBudgets, profile, goals, netSavings]);

  // 2. Build specific incremental contribution recommendations for each active SavingsGoal
  const suggestions: GoalOptimizationSuggestion[] = useMemo(() => {
    const cfg = PACE_CONFIG[paceMode];
    const activeGoals = goals.filter(
      (g) => (Number(g.currentAmount) || 0) < (Number(g.targetAmount) || 0)
    );

    const sources = spendingTrendAnalysis.reclaimableSources;

    return activeGoals.map((goal, idx) => {
      const target = Math.max(1, Number(goal.targetAmount) || 1);
      const current = Math.max(0, Number(goal.currentAmount) || 0);
      const remaining = Math.max(0, target - current);
      const currentMonthly = Math.max(25, Number(goal.monthlyContribution) || 100);

      // Compute suggested increment rounded to nearest $5
      const rawStep = Math.max(cfg.minStep, Math.round((currentMonthly * cfg.incrementPct) / 5) * 5);
      const maxSensible = Math.max(cfg.minStep, Math.min(remaining, Math.round(rawStep * 1.5)));
      const baseIncrement = Math.min(remaining, Math.max(cfg.minStep, Math.min(rawStep, maxSensible)));
      const effectiveIncrement =
        customIncrements[goal.id] !== undefined ? customIncrements[goal.id] : baseIncrement;

      const suggestedMonthly = currentMonthly + effectiveIncrement;
      const currentMonths = Math.ceil(remaining / currentMonthly);
      const acceleratedMonths = Math.ceil(remaining / Math.max(1, suggestedMonthly));
      const monthsSaved = Math.max(0, currentMonths - acceleratedMonths);

      const src = sources[idx % Math.max(1, sources.length)];
      const fundingSource = src
        ? `Reasignando ${currSym}${Math.min(effectiveIncrement, src.monthlyCut).toLocaleString()}/mes de ${src.label} (${src.trendPct >= 0 ? `+${src.trendPct}%` : `${src.trendPct}%`} tend.)`
        : 'Optimización de flujo mensual variable';

      return {
        goal,
        remaining,
        currentMonthly,
        suggestedIncrement: effectiveIncrement,
        suggestedMonthly,
        currentMonths,
        acceleratedMonths,
        monthsSaved,
        currentEtaLabel: formatEtaFromMonths(currentMonths),
        acceleratedEtaLabel: formatEtaFromMonths(acceleratedMonths),
        fundingSource,
      };
    });
  }, [goals, paceMode, spendingTrendAnalysis.reclaimableSources, customIncrements, currSym]);

  const totals = useMemo(() => {
    const totalIncrement = suggestions.reduce((sum, s) => sum + s.suggestedIncrement, 0);
    const totalCurrentMonthly = suggestions.reduce((sum, s) => sum + s.currentMonthly, 0);
    const totalOptimizedMonthly = totalCurrentMonthly + totalIncrement;
    const maxMonthsSaved = suggestions.reduce((max, s) => Math.max(max, s.monthsSaved), 0);
    const pendingToApply = suggestions.filter((s) => !appliedRecords[s.goal.id]);

    return {
      totalIncrement,
      totalCurrentMonthly,
      totalOptimizedMonthly,
      maxMonthsSaved,
      pendingCount: pendingToApply.length,
    };
  }, [suggestions, appliedRecords]);

  const handleAdjustIncrement = (goalId: string, currentInc: number, delta: number, remaining: number) => {
    const next = Math.max(5, Math.min(remaining, currentInc + delta));
    setCustomIncrements((prev) => ({ ...prev, [goalId]: next }));
    if (appliedRecords[goalId]) {
      setAppliedRecords((prev) => {
        const copy = { ...prev };
        delete copy[goalId];
        return copy;
      });
    }
  };

  const handleApplySuggestion = (s: GoalOptimizationSuggestion) => {
    const previousMonthly = s.goal.monthlyContribution;
    onUpdateGoalMonthlyContribution(s.goal.id, s.suggestedMonthly);
    setAppliedRecords((prev) => ({
      ...prev,
      [s.goal.id]: {
        previousMonthly,
        appliedMonthly: s.suggestedMonthly,
      },
    }));
  };

  const handleUndoSuggestion = (goalId: string) => {
    const rec = appliedRecords[goalId];
    if (!rec) return;
    onUpdateGoalMonthlyContribution(goalId, rec.previousMonthly);
    setAppliedRecords((prev) => {
      const next = { ...prev };
      delete next[goalId];
      return next;
    });
  };

  const handleApplyAll = () => {
    const nextRecords = { ...appliedRecords };
    suggestions.forEach((s) => {
      if (!nextRecords[s.goal.id] && s.suggestedIncrement > 0) {
        nextRecords[s.goal.id] = {
          previousMonthly: s.goal.monthlyContribution,
          appliedMonthly: s.suggestedMonthly,
        };
        onUpdateGoalMonthlyContribution(s.goal.id, s.suggestedMonthly);
      }
    });
    setAppliedRecords(nextRecords);
  };

  const handleRefineWithAI = async () => {
    setIsRefiningAI(true);
    try {
      const res = await analyzeBudgetPatternsWithAI(payments, categoryBudgets, profile, goals);
      if (res.aiStrategicOverview) {
        setAiSummaryBanner(res.aiStrategicOverview);
      }
    } catch {
      setAiSummaryBanner(
        `Al optimizar ${currSym}${spendingTrendAnalysis.totalReclaimable.toLocaleString()}/mes en gastos variables, puedes acelerar tus metas hasta ${totals.maxMonthsSaved} meses sin afectar gastos fijos.`
      );
    } finally {
      setIsRefiningAI(false);
    }
  };

  const cardSurfaceClass = isNitido
    ? 'bg-white border-slate-200 text-slate-900 shadow-xs'
    : isVibrant
    ? 'bg-slate-900/95 border-cyan-500/30 text-slate-100'
    : 'bg-slate-900 border-slate-800 text-slate-100';

  const hairlineBorder = isNitido ? 'border-slate-200/80' : 'border-slate-800';

  return (
    <section
      aria-label="AI Goal Optimizer · Acelerador de Metas de Ahorro"
      className={`rounded-2xl border p-5 sm:p-6 transition-colors ${cardSurfaceClass}`}
    >
      {/* Header Row */}
      <div className={`flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-5 border-b ${hairlineBorder}`}>
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Rocket className={`w-5 h-5 shrink-0 ${isNitido ? 'text-emerald-600' : 'text-emerald-400'}`} />
            <h3 className="text-base sm:text-lg font-bold tracking-tight">
              AI Goal Optimizer · Acelerador Incremental de Metas
            </h3>
            {totals.maxMonthsSaved > 0 && (
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border tabular-nums ${
                  isNitido
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-emerald-500/15 text-emerald-300 border-emerald-400/35'
                }`}
              >
                Hasta {totals.maxMonthsSaved} mes{totals.maxMonthsSaved === 1 ? '' : 'es'} antes
              </span>
            )}
          </div>
          <p className={`text-xs mt-1 ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
            Analiza tus tendencias de gasto variable y propone incrementos específicos a cada meta para adelantar su fecha de cumplimiento.
          </p>
        </div>

        {/* Pace Switcher & AI Analysis Trigger */}
        <div className="flex flex-wrap items-center gap-2">
          <div
            className={`flex items-center p-1 rounded-lg border ${
              isNitido ? 'bg-slate-100 border-slate-200' : 'bg-slate-800 border-slate-700'
            }`}
          >
            {(['gentle', 'balanced', 'accelerated'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => {
                  setPaceMode(mode);
                  setCustomIncrements({});
                }}
                className={`px-2.5 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                  paceMode === mode
                    ? isNitido
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'bg-slate-700 text-white'
                    : isNitido
                    ? 'text-slate-600 hover:text-slate-900'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {PACE_CONFIG[mode].label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleRefineWithAI}
            disabled={isRefiningAI}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border whitespace-nowrap shrink-0 transition-colors ${
              isNitido
                ? 'bg-slate-900 hover:bg-slate-800 text-white border-slate-900'
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
                <span>Diagnóstico IA</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Optional AI Summary Note */}
      {aiSummaryBanner && (
        <div
          className={`mt-4 px-4 py-3 rounded-xl border text-xs leading-relaxed ${
            isNitido
              ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
              : 'bg-emerald-950/30 border-emerald-500/35 text-emerald-100'
          }`}
        >
          <span className="font-bold mr-1.5">Análisis de Tendencias IA:</span>
          {aiSummaryBanner}
        </div>
      )}

      {/* 4-Column Flat Optimization Summary Strip */}
      <div className={`grid grid-cols-2 lg:grid-cols-4 gap-4 py-5 border-b ${hairlineBorder}`}>
        <div>
          <span className={`text-xs block ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
            Margen detectable en gastos
          </span>
          <span className="text-xl sm:text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400 mt-0.5 block">
            {currSym}{spendingTrendAnalysis.totalReclaimable.toLocaleString()}/mes
          </span>
          <span className={`text-[11px] ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
            En categorías variables
          </span>
        </div>

        <div>
          <span className={`text-xs block ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
            Incremento sugerido a metas
          </span>
          <span className="text-xl sm:text-2xl font-bold tabular-nums mt-0.5 block">
            +{currSym}{totals.totalIncrement.toLocaleString()}/mes
          </span>
          <span className={`text-[11px] tabular-nums ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
            Para {suggestions.length} meta{suggestions.length === 1 ? '' : 's'} activa{suggestions.length === 1 ? '' : 's'}
          </span>
        </div>

        <div>
          <span className={`text-xs block ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
            Aporte mensual combinado
          </span>
          <div className="flex items-baseline gap-1.5 mt-0.5 tabular-nums">
            <span className="text-xl sm:text-2xl font-bold">
              {currSym}{totals.totalOptimizedMonthly.toLocaleString()}
            </span>
            <span className={`text-xs ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
              (antes {currSym}{totals.totalCurrentMonthly.toLocaleString()})
            </span>
          </div>
        </div>

        <div className="flex flex-col justify-between">
          <span className={`text-xs block ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
            Aceleración rápida
          </span>
          {suggestions.length > 0 && totals.pendingCount > 0 ? (
            <button
              type="button"
              onClick={handleApplyAll}
              className="mt-1 inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold whitespace-nowrap shrink-0 transition-colors"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Aplicar todo (+{currSym}{totals.totalIncrement})</span>
            </button>
          ) : (
            <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              {suggestions.length === 0 ? 'Sin metas pendientes' : 'Todas las mejoras aplicadas'}
            </span>
          )}
        </div>
      </div>

      {/* Detected Spending Trend Sources Strip */}
      {spendingTrendAnalysis.reclaimableSources.length > 0 && (
        <div className={`py-3.5 border-b flex flex-wrap items-center gap-2 text-xs ${hairlineBorder}`}>
          <span className={`text-[11px] font-bold uppercase tracking-wider mr-1 ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
            Fuentes de recorte detectadas:
          </span>
          {spendingTrendAnalysis.reclaimableSources.map((src) => (
            <span
              key={src.category}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold tabular-nums ${
                isNitido
                  ? 'bg-slate-50 border-slate-200 text-slate-700'
                  : 'bg-slate-800/70 border-slate-700 text-slate-200'
              }`}
            >
              {src.trendPct >= 0 ? (
                <TrendingUp className="w-3.5 h-3.5 text-amber-500" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5 text-emerald-500" />
              )}
              <span>{src.label}:</span>
              <strong className="text-emerald-600 dark:text-emerald-400">
                +{currSym}{src.monthlyCut}/mes
              </strong>
            </span>
          ))}
        </div>
      )}

      {/* Per-Goal Incremental Acceleration Cards */}
      {suggestions.length === 0 ? (
        <div className="py-10 text-center space-y-2">
          <p className={`text-xs ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
            Todas tus metas actuales están al 100% o aún no tienes metas activas registradas.
          </p>
          {onOpenAddGoal && (
            <button
              type="button"
              onClick={onOpenAddGoal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Crear Meta de Ahorro</span>
            </button>
          )}
        </div>
      ) : (
        <div className="pt-5 space-y-3">
          {suggestions.map((s) => {
            const applied = appliedRecords[s.goal.id];

            return (
              <div
                key={s.goal.id}
                className={`p-4 rounded-xl border transition-colors ${
                  applied
                    ? isNitido
                      ? 'bg-emerald-50/70 border-emerald-200'
                      : 'bg-emerald-950/25 border-emerald-500/35'
                    : isNitido
                    ? 'bg-slate-50/60 border-slate-200'
                    : 'bg-slate-950/40 border-slate-800'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left: Goal Info + Funding Source + Timeline Shift */}
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-bold">{s.goal.title}</h4>
                      {s.monthsSaved > 0 && (
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border tabular-nums ${
                            isNitido
                              ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                              : 'bg-emerald-500/20 text-emerald-300 border-emerald-400/35'
                          }`}
                        >
                          <Zap className="w-3 h-3" />
                          -{s.monthsSaved} mes{s.monthsSaved === 1 ? '' : 'es'}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs tabular-nums">
                      <span className={isNitido ? 'text-slate-600' : 'text-slate-400'}>
                        Faltante: <strong>{currSym}{s.remaining.toLocaleString()}</strong>
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 opacity-70" />
                        <span className={isNitido ? 'text-slate-600' : 'text-slate-400'}>
                          {s.currentEtaLabel} ({s.currentMonths}m)
                        </span>
                        <ArrowRight className="w-3 h-3 opacity-60" />
                        <strong className="text-emerald-600 dark:text-emerald-400">
                          {s.acceleratedEtaLabel} ({s.acceleratedMonths}m)
                        </strong>
                      </span>
                    </div>

                    <p className={`text-[11px] ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
                      {s.fundingSource}
                    </p>
                  </div>

                  {/* Right: Increment Stepper + Apply / Undo Action */}
                  <div className="flex flex-wrap items-center gap-3 shrink-0">
                    <div className="text-left lg:text-right tabular-nums">
                      <div className={`text-[11px] ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
                        {applied
                          ? `Aplicado: ${currSym}${applied.previousMonthly.toLocaleString()} → ${currSym}${applied.appliedMonthly.toLocaleString()}/mes`
                          : `Aporte: ${currSym}${s.currentMonthly.toLocaleString()} → ${currSym}${s.suggestedMonthly.toLocaleString()}/mes`}
                      </div>
                      <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                        +{currSym}{s.suggestedIncrement.toLocaleString()}/mes
                      </div>
                    </div>

                    {/* Fine-tune increment stepper */}
                    {!applied && (
                      <div
                        className={`inline-flex items-center rounded-lg border p-0.5 ${
                          isNitido
                            ? 'bg-white border-slate-200'
                            : 'bg-slate-900 border-slate-700'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            handleAdjustIncrement(s.goal.id, s.suggestedIncrement, -10, s.remaining)
                          }
                          aria-label={`Reducir incremento sugerido para ${s.goal.title}`}
                          className={`p-1.5 rounded-md transition-colors ${
                            isNitido
                              ? 'hover:bg-slate-100 text-slate-600'
                              : 'hover:bg-slate-800 text-slate-300'
                          }`}
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="px-2 text-xs font-bold tabular-nums">
                          +{currSym}{s.suggestedIncrement}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            handleAdjustIncrement(s.goal.id, s.suggestedIncrement, 10, s.remaining)
                          }
                          aria-label={`Aumentar incremento sugerido para ${s.goal.title}`}
                          className={`p-1.5 rounded-md transition-colors ${
                            isNitido
                              ? 'hover:bg-slate-100 text-slate-600'
                              : 'hover:bg-slate-800 text-slate-300'
                          }`}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {applied ? (
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border whitespace-nowrap ${
                            isNitido
                              ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                              : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Aplicado</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUndoSuggestion(s.goal.id)}
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
                      <button
                        type="button"
                        onClick={() => handleApplySuggestion(s)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold whitespace-nowrap shrink-0 transition-colors"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Aplicar (+{currSym}{s.suggestedIncrement})</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
