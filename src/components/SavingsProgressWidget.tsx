import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  ReferenceLine,
} from 'recharts';
import {
  Target,
  PiggyBank,
  Plus,
  CheckCircle2,
  TrendingUp,
  ArrowUpRight,
  SlidersHorizontal,
} from 'lucide-react';
import { SavingsGoal, UserFinancialProfile } from '../types';
import { useTheme } from '../context/ThemeContext';

interface SavingsProgressWidgetProps {
  goals: SavingsGoal[];
  profile: UserFinancialProfile;
  netSavings: number;
  onUpdateGoalAmount?: (id: string, newAmount: number) => void;
  onOpenAddGoal?: () => void;
}

const GOAL_COLOR_MAP: Record<SavingsGoal['category'], { label: string; color: string; mutedDark: string; mutedLight: string }> = {
  auto: {
    label: 'Vehículo',
    color: '#d97706',
    mutedDark: '#1e293b',
    mutedLight: '#e2e8f0',
  },
  vivienda: {
    label: 'Vivienda',
    color: '#4f46e5',
    mutedDark: '#1e293b',
    mutedLight: '#e2e8f0',
  },
  emergencia: {
    label: 'Emergencia',
    color: '#059669',
    mutedDark: '#1e293b',
    mutedLight: '#e2e8f0',
  },
  viaje: {
    label: 'Viaje',
    color: '#0891b2',
    mutedDark: '#1e293b',
    mutedLight: '#e2e8f0',
  },
  retiro: {
    label: 'Retiro',
    color: '#2563eb',
    mutedDark: '#1e293b',
    mutedLight: '#e2e8f0',
  },
  otro: {
    label: 'Personalizada',
    color: '#7c3aed',
    mutedDark: '#1e293b',
    mutedLight: '#e2e8f0',
  },
};

export const SavingsProgressWidget: React.FC<SavingsProgressWidgetProps> = ({
  goals,
  profile,
  netSavings,
  onUpdateGoalAmount,
  onOpenAddGoal,
}) => {
  const { isNitido, isVibrant } = useTheme();
  const currSym = profile.currencySymbol || '$';

  const [displayUnit, setDisplayUnit] = useState<'percent' | 'amount'>('percent');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [sortBy, setSortBy] = useState<'progress' | 'deadline' | 'target'>('progress');
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [hoveredGoalId, setHoveredGoalId] = useState<string | null>(null);
  const [customDeposit, setCustomDeposit] = useState<string>('');

  const summary = useMemo(() => {
    const totalSaved = goals.reduce((acc, g) => acc + Math.max(0, Number(g.currentAmount) || 0), 0);
    const totalTarget = goals.reduce((acc, g) => acc + Math.max(0, Number(g.targetAmount) || 0), 0);
    const totalRemaining = Math.max(0, totalTarget - totalSaved);
    const overallPercent = totalTarget > 0 ? Math.min(100, Math.round((totalSaved / totalTarget) * 100)) : 0;
    const rawPercent = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0;
    const totalMonthlyCommitment = goals.reduce(
      (acc, g) => acc + Math.max(0, Number(g.monthlyContribution) || 0),
      0
    );
    const completedCount = goals.filter((g) => g.currentAmount >= g.targetAmount && g.targetAmount > 0).length;
    const effectiveMonthlyPace = totalMonthlyCommitment > 0 ? totalMonthlyCommitment : Math.max(0, netSavings);
    const estimatedMonthsLeft =
      totalRemaining === 0
        ? 0
        : effectiveMonthlyPace > 0
        ? Math.ceil(totalRemaining / effectiveMonthlyPace)
        : null;

    const monthlyGoalTarget = Math.round((profile.monthlyIncome || 0) * ((profile.savingsGoalPercent || 20) / 100));
    const monthlyCoveragePct =
      monthlyGoalTarget > 0 ? Math.min(150, Math.round((Math.max(0, netSavings) / monthlyGoalTarget) * 100)) : 0;

    return {
      totalSaved,
      totalTarget,
      totalRemaining,
      overallPercent,
      rawPercent,
      totalMonthlyCommitment,
      completedCount,
      estimatedMonthsLeft,
      monthlyGoalTarget,
      monthlyCoveragePct,
    };
  }, [goals, netSavings, profile.monthlyIncome, profile.savingsGoalPercent]);

  // Consolidated Recharts stacked horizontal progress bar dataset
  const consolidatedBarData = useMemo(() => {
    if (displayUnit === 'percent') {
      const savedPct = summary.totalTarget > 0 ? Math.min(100, Number(((summary.totalSaved / summary.totalTarget) * 100).toFixed(1))) : 0;
      const remainingPct = Math.max(0, Number((100 - savedPct).toFixed(1)));
      return [
        {
          name: 'Progreso Global',
          savedVal: savedPct,
          remainingVal: remainingPct,
          savedAmount: summary.totalSaved,
          remainingAmount: summary.totalRemaining,
          targetAmount: summary.totalTarget,
          percent: savedPct,
        },
      ];
    }

    return [
      {
        name: 'Progreso Global',
        savedVal: summary.totalSaved,
        remainingVal: summary.totalRemaining,
        savedAmount: summary.totalSaved,
        remainingAmount: summary.totalRemaining,
        targetAmount: summary.totalTarget,
        percent: summary.overallPercent,
      },
    ];
  }, [displayUnit, summary]);

  // Individual goals dataset for interactive Recharts progress bars
  const filteredGoalsData = useMemo(() => {
    const mapped = goals
      .map((goal) => {
        const target = Math.max(1, Number(goal.targetAmount) || 1);
        const saved = Math.max(0, Number(goal.currentAmount) || 0);
        const remaining = Math.max(0, target - saved);
        const percent = Math.min(100, Math.round((saved / target) * 100));
        const exactPercent = Math.min(100, Number(((saved / target) * 100).toFixed(1)));
        const isCompleted = saved >= target;
        const monthly = Math.max(0, Number(goal.monthlyContribution) || 0);
        const monthsLeft = remaining === 0 ? 0 : monthly > 0 ? Math.ceil(remaining / monthly) : null;
        const meta = GOAL_COLOR_MAP[goal.category] || GOAL_COLOR_MAP.otro;
        const shortTitle = goal.title.length > 22 ? `${goal.title.slice(0, 20)}…` : goal.title;

        return {
          ...goal,
          shortTitle,
          target,
          saved,
          remaining,
          percent,
          exactPercent,
          isCompleted,
          monthsLeft,
          categoryLabel: meta.label,
          barColor: isCompleted ? '#16a34a' : meta.color,
          savedPlot: displayUnit === 'percent' ? exactPercent : saved,
          remainingPlot: displayUnit === 'percent' ? Math.max(0, Number((100 - exactPercent).toFixed(1))) : remaining,
        };
      })
      .filter((item) => {
        if (statusFilter === 'active') return !item.isCompleted;
        if (statusFilter === 'completed') return item.isCompleted;
        return true;
      });

    mapped.sort((a, b) => {
      if (sortBy === 'progress') return b.exactPercent - a.exactPercent;
      if (sortBy === 'target') return b.target - a.target;
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    });

    return mapped;
  }, [goals, statusFilter, sortBy, displayUnit]);

  const activeGoal = useMemo(() => {
    const targetId = selectedGoalId || hoveredGoalId;
    if (targetId) {
      const found = filteredGoalsData.find((g) => g.id === targetId);
      if (found) return found;
    }
    return filteredGoalsData[0] || null;
  }, [filteredGoalsData, selectedGoalId, hoveredGoalId]);

  const handleQuickDeposit = (goalId: string, currentAmount: number, addAmount: number) => {
    if (!onUpdateGoalAmount || addAmount <= 0) return;
    onUpdateGoalAmount(goalId, currentAmount + addAmount);
  };

  const handleCustomDepositSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGoal || !onUpdateGoalAmount) return;
    const parsed = Number(customDeposit);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    onUpdateGoalAmount(activeGoal.id, activeGoal.saved + parsed);
    setCustomDeposit('');
  };

  // Custom Recharts Tooltip for Consolidated Bar
  const ConsolidatedTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const d = payload[0]?.payload;
    if (!d) return null;

    return (
      <div
        className={`px-3.5 py-2.5 rounded-xl border shadow-lg text-xs backdrop-blur-md ${
          isNitido
            ? 'bg-white/95 border-slate-200 text-slate-900'
            : 'bg-slate-900/95 border-slate-700 text-slate-100'
        }`}
      >
        <p className="font-bold mb-1.5">Resumen Consolidado de Metas</p>
        <div className="space-y-1 tabular-nums">
          <div className="flex items-center justify-between gap-6">
            <span className={isNitido ? 'text-slate-600' : 'text-slate-400'}>Total ahorrado:</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">
              {currSym}{d.savedAmount.toLocaleString()} ({d.percent}%)
            </span>
          </div>
          <div className="flex items-center justify-between gap-6">
            <span className={isNitido ? 'text-slate-600' : 'text-slate-400'}>Meta combinada:</span>
            <span className="font-semibold">{currSym}{d.targetAmount.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between gap-6">
            <span className={isNitido ? 'text-slate-600' : 'text-slate-400'}>Faltante por ahorrar:</span>
            <span className="font-semibold">{currSym}{d.remainingAmount.toLocaleString()}</span>
          </div>
        </div>
      </div>
    );
  };

  // Custom Recharts Tooltip for Individual Goal Bars
  const GoalBarTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const item = payload[0]?.payload;
    if (!item) return null;

    return (
      <div
        className={`px-3.5 py-2.5 rounded-xl border shadow-lg text-xs backdrop-blur-md max-w-xs ${
          isNitido
            ? 'bg-white/95 border-slate-200 text-slate-900'
            : 'bg-slate-900/95 border-slate-700 text-slate-100'
        }`}
      >
        <div className="flex items-center justify-between gap-3 mb-1">
          <span className="font-bold truncate">{item.title}</span>
          <span className="text-[11px] font-semibold tabular-nums" style={{ color: item.barColor }}>
            {item.exactPercent}%
          </span>
        </div>
        <p className={`text-[11px] mb-2 ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
          {item.categoryLabel} · Vence {new Date(item.deadline).toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })}
        </p>
        <div className="space-y-1 tabular-nums">
          <div className="flex items-center justify-between gap-5">
            <span className={isNitido ? 'text-slate-600' : 'text-slate-400'}>Ahorrado:</span>
            <span className="font-bold">{currSym}{item.saved.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between gap-5">
            <span className={isNitido ? 'text-slate-600' : 'text-slate-400'}>Meta definida:</span>
            <span className="font-semibold">{currSym}{item.target.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between gap-5">
            <span className={isNitido ? 'text-slate-600' : 'text-slate-400'}>Restante:</span>
            <span className="font-semibold">{currSym}{item.remaining.toLocaleString()}</span>
          </div>
          {item.monthsLeft !== null && (
            <div className="flex items-center justify-between gap-5 pt-1 border-t border-slate-200/70 dark:border-slate-800">
              <span className={isNitido ? 'text-slate-600' : 'text-slate-400'}>Ritmo estimado:</span>
              <span className="font-semibold">
                {item.monthsLeft === 0 ? 'Meta alcanzada' : `${item.monthsLeft} mes${item.monthsLeft === 1 ? '' : 'es'}`}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const trackFill = isNitido ? '#e2e8f0' : '#1e293b';
  const axisColor = isNitido ? '#475569' : '#94a3b8';
  const gridColor = isNitido ? '#f1f5f9' : '#1e293b';

  return (
    <section
      aria-label="Widget de Progreso de Ahorro"
      className={`rounded-2xl border p-5 sm:p-6 transition-colors ${
        isNitido
          ? 'bg-white border-slate-200 text-slate-900 shadow-xs'
          : isVibrant
          ? 'bg-slate-900/95 border-cyan-500/30 text-slate-100'
          : 'bg-slate-900 border-slate-800 text-slate-100'
      }`}
    >
      {/* Top Header Row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <PiggyBank className={`w-5 h-5 shrink-0 ${isNitido ? 'text-emerald-600' : 'text-emerald-400'}`} />
            <h3 className="text-base sm:text-lg font-bold tracking-tight">
              Progreso de Ahorro vs. Metas Definidas
            </h3>
          </div>
          <p className={`text-xs mt-1 ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
            <span>{goals.length} meta{goals.length === 1 ? '' : 's'} configurada{goals.length === 1 ? '' : 's'}</span>
            <span aria-hidden="true" className="mx-1.5">·</span>
            <span>{summary.completedCount} completada{summary.completedCount === 1 ? '' : 's'}</span>
            <span aria-hidden="true" className="mx-1.5">·</span>
            <span className="tabular-nums">
              Aporte mensual programado: {currSym}{summary.totalMonthlyCommitment.toLocaleString()}
            </span>
          </p>
        </div>

        {/* Interactive Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Unit Switcher: % vs $ */}
          <div
            className={`flex items-center p-1 rounded-lg border ${
              isNitido ? 'bg-slate-100 border-slate-200' : 'bg-slate-800 border-slate-700'
            }`}
          >
            <button
              type="button"
              onClick={() => setDisplayUnit('percent')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                displayUnit === 'percent'
                  ? isNitido
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'bg-slate-700 text-white'
                  : isNitido
                  ? 'text-slate-600 hover:text-slate-900'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Porcentaje (%)
            </button>
            <button
              type="button"
              onClick={() => setDisplayUnit('amount')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                displayUnit === 'amount'
                  ? isNitido
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'bg-slate-700 text-white'
                  : isNitido
                  ? 'text-slate-600 hover:text-slate-900'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Monto ({currSym})
            </button>
          </div>

          {/* Sort selector */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs ${
              isNitido
                ? 'bg-white border-slate-200 text-slate-700'
                : 'bg-slate-800 border-slate-700 text-slate-200'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              aria-label="Ordenar metas de ahorro"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'progress' | 'deadline' | 'target')}
              className="bg-transparent text-xs font-semibold focus:outline-none cursor-pointer"
            >
              <option value="progress" className={isNitido ? 'bg-white text-slate-900' : 'bg-slate-900 text-slate-100'}>
                Orden: Mayor avance
              </option>
              <option value="deadline" className={isNitido ? 'bg-white text-slate-900' : 'bg-slate-900 text-slate-100'}>
                Orden: Fecha límite
              </option>
              <option value="target" className={isNitido ? 'bg-white text-slate-900' : 'bg-slate-900 text-slate-100'}>
                Orden: Mayor monto
              </option>
            </select>
          </div>

          {onOpenAddGoal && (
            <button
              type="button"
              onClick={onOpenAddGoal}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${
                isNitido
                  ? 'bg-slate-900 hover:bg-slate-800 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nueva Meta</span>
            </button>
          )}
        </div>
      </div>

      {/* Empty State */}
      {goals.length === 0 ? (
        <div className="py-12 text-center space-y-3">
          <div
            className={`w-12 h-12 rounded-2xl mx-auto flex items-center justify-center border ${
              isNitido ? 'bg-slate-50 border-slate-200 text-slate-500' : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            <Target className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h4 className="text-sm font-bold">Aún no tienes metas de ahorro definidas</h4>
            <p className={`text-xs ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
              Crea tu primera meta (fondo de emergencia, vivienda, vehículo o viaje) para visualizar aquí la barra de progreso interactiva y tu cobertura mensual.
            </p>
          </div>
          {onOpenAddGoal && (
            <button
              type="button"
              onClick={onOpenAddGoal}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Crear Primera Meta</span>
            </button>
          )}
        </div>
      ) : (
        <div className="pt-5 space-y-6">
          {/* 4-Column Flat Summary KPI Strip (Single-elevation, hairline dividers, tabular numerals) */}
          <div
            className={`grid grid-cols-2 lg:grid-cols-4 gap-4 pb-5 border-b ${
              isNitido ? 'border-slate-200/80' : 'border-slate-800'
            }`}
          >
            <div>
              <span className={`text-xs block ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
                Total ahorrado en metas
              </span>
              <span className="text-xl sm:text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                {currSym}{summary.totalSaved.toLocaleString()}
              </span>
            </div>

            <div>
              <span className={`text-xs block ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
                Suma de metas definidas
              </span>
              <span className="text-xl sm:text-2xl font-bold tabular-nums mt-0.5 block">
                {currSym}{summary.totalTarget.toLocaleString()}
              </span>
            </div>

            <div>
              <span className={`text-xs block ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
                Cumplimiento global
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-xl sm:text-2xl font-bold tabular-nums">
                  {summary.overallPercent}%
                </span>
                <span className={`text-xs tabular-nums ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
                  Faltan {currSym}{summary.totalRemaining.toLocaleString()}
                </span>
              </div>
            </div>

            <div>
              <span className={`text-xs block ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
                Ahorro neto del mes vs. objetivo ({profile.savingsGoalPercent}%)
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span
                  className={`text-xl sm:text-2xl font-bold tabular-nums ${
                    netSavings >= summary.monthlyGoalTarget
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : netSavings > 0
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {currSym}{Math.max(0, netSavings).toLocaleString()}
                </span>
                <span className={`text-xs tabular-nums ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
                  / {currSym}{summary.monthlyGoalTarget.toLocaleString()} ({summary.monthlyCoveragePct}%)
                </span>
              </div>
            </div>
          </div>

          {/* Primary Consolidated Recharts Interactive Progress Bar */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 font-semibold">
                <span>Barra de Progreso Consolidada</span>
                <span aria-hidden="true" className={isNitido ? 'text-slate-300' : 'text-slate-600'}>
                  ·
                </span>
                <span className={`tabular-nums ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
                  {summary.estimatedMonthsLeft === 0
                    ? 'Todas las metas alcanzadas'
                    : summary.estimatedMonthsLeft !== null
                    ? `Ritmo estimado: ${summary.estimatedMonthsLeft} meses restantes`
                    : 'Define un aporte mensual para estimar fecha'}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs tabular-nums">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 inline-block" />
                  Ahorrado ({displayUnit === 'percent' ? `${summary.overallPercent}%` : `${currSym}${summary.totalSaved.toLocaleString()}`})
                </span>
                <span className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-xs inline-block"
                    style={{ backgroundColor: trackFill }}
                  />
                  Pendiente ({displayUnit === 'percent' ? `${Math.max(0, 100 - summary.overallPercent)}%` : `${currSym}${summary.totalRemaining.toLocaleString()}`})
                </span>
              </div>
            </div>

            <div className="w-full h-[78px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={consolidatedBarData}
                  layout="vertical"
                  margin={{ top: 6, right: 16, left: 4, bottom: 4 }}
                  barSize={26}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={gridColor} />
                  <XAxis
                    type="number"
                    domain={displayUnit === 'percent' ? [0, 100] : [0, Math.max(1, summary.totalTarget)]}
                    tickFormatter={(v) => (displayUnit === 'percent' ? `${v}%` : `${currSym}${Number(v).toLocaleString()}`)}
                    tick={{ fontSize: 11, fill: axisColor }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis type="category" dataKey="name" hide />
                  <Tooltip
                    content={<ConsolidatedTooltip />}
                    cursor={{ fill: isNitido ? 'rgba(15,23,42,0.04)' : 'rgba(255,255,255,0.04)' }}
                  />
                  {displayUnit === 'percent' && (
                    <ReferenceLine
                      x={50}
                      stroke={isNitido ? '#94a3b8' : '#475569'}
                      strokeDasharray="3 3"
                    />
                  )}
                  <Bar
                    dataKey="savedVal"
                    stackId="total"
                    fill="#10b981"
                    radius={[6, summary.totalRemaining === 0 ? 6 : 0, summary.totalRemaining === 0 ? 6 : 0, 6]}
                    animationDuration={450}
                  />
                  <Bar
                    dataKey="remainingVal"
                    stackId="total"
                    fill={trackFill}
                    radius={[summary.totalSaved === 0 ? 6 : 0, 6, 6, summary.totalSaved === 0 ? 6 : 0]}
                    animationDuration={450}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Interactive Per-Goal Recharts Progress Bars + Detail & Quick Deposit Panel */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 pt-2 border-t border-slate-200/80 dark:border-slate-800 items-start">
            {/* Left 7 Cols: Recharts Interactive Per-Goal Horizontal Progress Bars */}
            <div className="xl:col-span-7 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-bold">
                  Desglose Interactivo por Meta
                </h4>

                {/* Status Filter Segmented Control */}
                <div
                  className={`flex items-center p-1 rounded-lg border ${
                    isNitido ? 'bg-slate-100 border-slate-200' : 'bg-slate-800 border-slate-700'
                  }`}
                >
                  {[
                    { id: 'all', label: `Todas (${goals.length})` },
                    { id: 'active', label: `En curso (${goals.length - summary.completedCount})` },
                    { id: 'completed', label: `Logradas (${summary.completedCount})` },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setStatusFilter(tab.id as 'all' | 'active' | 'completed')}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap shrink-0 transition-colors ${
                        statusFilter === tab.id
                          ? isNitido
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'bg-slate-700 text-white'
                          : isNitido
                          ? 'text-slate-600 hover:text-slate-900'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {filteredGoalsData.length === 0 ? (
                <div
                  className={`py-10 text-center text-xs rounded-xl border ${
                    isNitido ? 'border-slate-200 text-slate-500' : 'border-slate-800 text-slate-400'
                  }`}
                >
                  No hay metas que coincidan con este filtro.
                </div>
              ) : (
                <>
                  <p className={`text-[11px] ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
                    Pasa el cursor o haz clic sobre cualquier barra para inspeccionar la meta y registrar un aporte rápido.
                  </p>
                  <div
                    className="w-full"
                    style={{ height: Math.max(190, filteredGoalsData.length * 52) }}
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={filteredGoalsData}
                        layout="vertical"
                        margin={{ top: 4, right: 20, left: 6, bottom: 4 }}
                        barSize={20}
                        onMouseMove={(state: any) => {
                          const idx = state?.activeTooltipIndex;
                          if (typeof idx === 'number' && filteredGoalsData[idx]) {
                            setHoveredGoalId(filteredGoalsData[idx].id);
                          }
                        }}
                        onMouseLeave={() => setHoveredGoalId(null)}
                        onClick={(state: any) => {
                          const idx = state?.activeTooltipIndex;
                          if (typeof idx === 'number' && filteredGoalsData[idx]) {
                            setSelectedGoalId(filteredGoalsData[idx].id);
                          }
                        }}
                      >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={gridColor} />
                        <XAxis
                          type="number"
                          domain={displayUnit === 'percent' ? [0, 100] : [0, 'dataMax']}
                          tickFormatter={(v) =>
                            displayUnit === 'percent' ? `${v}%` : `${currSym}${Number(v).toLocaleString()}`
                          }
                          tick={{ fontSize: 11, fill: axisColor }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          type="category"
                          dataKey="shortTitle"
                          width={132}
                          tick={{ fontSize: 11, fill: axisColor, fontWeight: 600 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          content={<GoalBarTooltip />}
                          cursor={{ fill: isNitido ? 'rgba(15,23,42,0.04)' : 'rgba(255,255,255,0.04)' }}
                        />
                        <Bar
                          dataKey="savedPlot"
                          stackId="goal"
                          radius={[5, 0, 0, 5]}
                          cursor="pointer"
                          animationDuration={400}
                        >
                          {filteredGoalsData.map((entry) => {
                            const isSelected = activeGoal?.id === entry.id;
                            return (
                              <Cell
                                key={`saved-${entry.id}`}
                                fill={entry.barColor}
                                fillOpacity={activeGoal && !isSelected ? 0.55 : 1}
                                onClick={() => setSelectedGoalId(entry.id)}
                              />
                            );
                          })}
                        </Bar>
                        <Bar
                          dataKey="remainingPlot"
                          stackId="goal"
                          fill={trackFill}
                          radius={[0, 5, 5, 0]}
                          cursor="pointer"
                          animationDuration={400}
                          onClick={(data: any) => {
                            if (data?.id) setSelectedGoalId(data.id);
                          }}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </>
              )}
            </div>

            {/* Right 5 Cols: Selected Goal Inspector & Quick Savings Action */}
            <div className="xl:col-span-5">
              {activeGoal ? (
                <div
                  className={`rounded-xl border p-4 space-y-4 ${
                    isNitido
                      ? 'bg-slate-50/70 border-slate-200'
                      : 'bg-slate-950/50 border-slate-800'
                  }`}
                >
                  {/* Goal Selector Pills */}
                  {filteredGoalsData.length > 1 && (
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                      {filteredGoalsData.map((g) => (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => setSelectedGoalId(g.id)}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap shrink-0 border transition-colors ${
                            activeGoal.id === g.id
                              ? isNitido
                                ? 'bg-white border-slate-300 text-slate-900 shadow-xs'
                                : 'bg-slate-800 border-slate-600 text-white'
                              : isNitido
                              ? 'bg-transparent border-transparent text-slate-500 hover:text-slate-800'
                              : 'bg-transparent border-transparent text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {g.shortTitle}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className={`text-[11px] ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
                        {activeGoal.categoryLabel} · Fecha meta {new Date(activeGoal.deadline).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                      <h5 className="text-base font-bold truncate mt-0.5">{activeGoal.title}</h5>
                    </div>
                    <div className="text-right shrink-0">
                      <span
                        className="text-xl font-bold tabular-nums"
                        style={{ color: activeGoal.barColor }}
                      >
                        {activeGoal.exactPercent}%
                      </span>
                    </div>
                  </div>

                  {/* Precision Numeric Grid */}
                  <div className="grid grid-cols-3 gap-3 py-3 border-y border-slate-200/80 dark:border-slate-800 text-xs">
                    <div>
                      <span className={`block text-[11px] ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
                        Ahorrado
                      </span>
                      <span className="font-bold tabular-nums text-sm">
                        {currSym}{activeGoal.saved.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className={`block text-[11px] ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
                        Objetivo
                      </span>
                      <span className="font-bold tabular-nums text-sm">
                        {currSym}{activeGoal.target.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className={`block text-[11px] ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
                        Faltante
                      </span>
                      <span className="font-bold tabular-nums text-sm">
                        {currSym}{activeGoal.remaining.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Pace & Projection Insight */}
                  <div className={`flex items-center justify-between text-xs ${isNitido ? 'text-slate-600' : 'text-slate-300'}`}>
                    <span className="flex items-center gap-1.5">
                      {activeGoal.isCompleted ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      ) : (
                        <TrendingUp className="w-4 h-4 text-indigo-500 shrink-0" />
                      )}
                      <span>
                        {activeGoal.isCompleted
                          ? 'Meta completada al 100%'
                          : activeGoal.monthsLeft !== null
                          ? `A ${currSym}${activeGoal.monthlyContribution.toLocaleString()}/mes: ~${activeGoal.monthsLeft} mes${activeGoal.monthsLeft === 1 ? '' : 'es'}`
                          : 'Sin aporte mensual asignado'}
                      </span>
                    </span>
                    <span className="tabular-nums text-[11px] text-slate-500">
                      Peso: {summary.totalTarget > 0 ? Math.round((activeGoal.target / summary.totalTarget) * 100) : 0}% del total
                    </span>
                  </div>

                  {/* Quick Deposit Actions */}
                  {onUpdateGoalAmount && !activeGoal.isCompleted && (
                    <div className="space-y-2 pt-1">
                      <span className={`text-[11px] font-semibold block ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
                        Registrar abono directo a esta meta
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        {[50, 100, 250].map((amt) => (
                          <button
                            key={amt}
                            type="button"
                            onClick={() => handleQuickDeposit(activeGoal.id, activeGoal.saved, amt)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold tabular-nums border transition-colors whitespace-nowrap shrink-0 ${
                              isNitido
                                ? 'bg-white hover:bg-emerald-50 text-slate-800 hover:text-emerald-800 border-slate-200 hover:border-emerald-300'
                                : 'bg-slate-800 hover:bg-emerald-950/60 text-slate-200 hover:text-emerald-300 border-slate-700 hover:border-emerald-500/40'
                            }`}
                          >
                            +{currSym}{amt}
                          </button>
                        ))}

                        <form onSubmit={handleCustomDepositSubmit} className="flex items-center gap-1.5 flex-1 min-w-[140px]">
                          <input
                            type="number"
                            min={1}
                            step="any"
                            value={customDeposit}
                            onChange={(e) => setCustomDeposit(e.target.value)}
                            placeholder={`Otro (${currSym})`}
                            aria-label="Monto personalizado de abono a meta"
                            className={`w-full px-2.5 py-1.5 rounded-lg border text-xs tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500/40 ${
                              isNitido
                                ? 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400'
                                : 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500'
                            }`}
                          />
                          <button
                            type="submit"
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold whitespace-nowrap shrink-0 transition-colors"
                          >
                            <span>Abonar</span>
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </button>
                        </form>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div
                  className={`rounded-xl border p-6 text-center text-xs ${
                    isNitido ? 'border-slate-200 text-slate-500' : 'border-slate-800 text-slate-400'
                  }`}
                >
                  Selecciona una meta para ver el detalle.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
