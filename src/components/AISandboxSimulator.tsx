import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import {
  Sliders,
  RotateCcw,
  TrendingUp,
  TrendingDown,
  Clock,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Calendar,
  Layers,
} from 'lucide-react';
import { SavingsGoal, UserFinancialProfile } from '../types';
import { useTheme } from '../context/ThemeContext';

interface AISandboxSimulatorProps {
  goals: SavingsGoal[];
  profile: UserFinancialProfile;
  totalIncome: number;
  fixedExpenses: number;
  variableExpenses: number;
  onOpenVoiceAssistant?: (prompt: string) => void;
}

type AllocationMode = 'proportional' | 'snowball';

interface GoalTimelineResult {
  id: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  remaining: number;
  deadline: string;
  baselineMonthly: number;
  simulatedMonthly: number;
  baselineMonths: number | null;
  simulatedMonths: number | null;
  monthsDelta: number | null; // positive = saved months (faster), negative = delayed months
  baselineEtaLabel: string;
  simulatedEtaLabel: string;
}

const MONTH_NAMES_SHORT = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];

function formatFutureMonth(monthsAhead: number | null, baseDate: Date = new Date()): string {
  if (monthsAhead === null) return 'Sin capacidad de ahorro';
  if (monthsAhead === 0) return 'Completada';
  if (monthsAhead > 120) return '> 10 años';
  const d = new Date(baseDate.getFullYear(), baseDate.getMonth() + monthsAhead, 1);
  return `${MONTH_NAMES_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

function simulateGoalsCompletion(
  goals: SavingsGoal[],
  monthlySurplus: number,
  allocationMode: AllocationMode
): {
  perGoalMonths: Record<string, number | null>;
  perGoalInitialMonthly: Record<string, number>;
  allCompletedMonth: number | null;
} {
  const perGoalMonths: Record<string, number | null> = {};
  const perGoalInitialMonthly: Record<string, number> = {};

  if (goals.length === 0) {
    return { perGoalMonths, perGoalInitialMonthly, allCompletedMonth: 0 };
  }

  const state = goals.map((g) => ({
    id: g.id,
    remaining: Math.max(0, (Number(g.targetAmount) || 0) - (Number(g.currentAmount) || 0)),
    deadlineMs: new Date(g.deadline).getTime() || Number.MAX_SAFE_INTEGER,
    plannedMonthly: Math.max(1, Number(g.monthlyContribution) || 100),
    completedMonth:
      (Number(g.currentAmount) || 0) >= (Number(g.targetAmount) || 0) ? 0 : (null as number | null),
  }));

  state.forEach((g) => {
    if (g.completedMonth === 0) {
      perGoalMonths[g.id] = 0;
    }
  });

  if (monthlySurplus <= 0) {
    state.forEach((g) => {
      if (g.completedMonth === null) perGoalMonths[g.id] = null;
      perGoalInitialMonthly[g.id] = 0;
    });
    const anyIncomplete = state.some((g) => g.completedMonth === null);
    return {
      perGoalMonths,
      perGoalInitialMonthly,
      allCompletedMonth: anyIncomplete ? null : 0,
    };
  }

  // Sort copy for snowball order (earliest deadline first, then smallest remaining)
  const sortedIds = [...state]
    .sort((a, b) => a.deadlineMs - b.deadlineMs || a.remaining - b.remaining)
    .map((g) => g.id);

  // Month-by-month simulation up to 120 months (10 years)
  const MAX_MONTHS = 120;
  for (let m = 1; m <= MAX_MONTHS; m++) {
    const activeGoals = state.filter((g) => g.remaining > 0.01);
    if (activeGoals.length === 0) break;

    if (allocationMode === 'snowball') {
      let available = monthlySurplus;
      for (const id of sortedIds) {
        const g = state.find((item) => item.id === id);
        if (!g || g.remaining <= 0.01 || available <= 0) continue;
        const contribution = Math.min(g.remaining, available);
        if (m === 1) {
          perGoalInitialMonthly[g.id] = Math.round(contribution);
        }
        g.remaining -= contribution;
        available -= contribution;
        if (g.remaining <= 0.01 && g.completedMonth === null) {
          g.completedMonth = m;
        }
      }
    } else {
      // Proportional allocation weighted by each active goal's plannedMonthly or remaining share
      let remainingPool = monthlySurplus;
      const totalWeight = activeGoals.reduce((sum, g) => sum + g.plannedMonthly, 0) || activeGoals.length;

      activeGoals.forEach((g) => {
        const share = (g.plannedMonthly / totalWeight) * remainingPool;
        const contribution = Math.min(g.remaining, share);
        if (m === 1) {
          perGoalInitialMonthly[g.id] = Math.round(contribution);
        }
        g.remaining -= contribution;
        if (g.remaining <= 0.01 && g.completedMonth === null) {
          g.completedMonth = m;
        }
      });
    }
  }

  let maxCompletion: number | null = 0;
  state.forEach((g) => {
    perGoalMonths[g.id] = g.completedMonth;
    if (perGoalInitialMonthly[g.id] === undefined) {
      perGoalInitialMonthly[g.id] = 0;
    }
    if (g.completedMonth === null) {
      maxCompletion = null;
    } else if (maxCompletion !== null && g.completedMonth > maxCompletion) {
      maxCompletion = g.completedMonth;
    }
  });

  return {
    perGoalMonths,
    perGoalInitialMonthly,
    allCompletedMonth: maxCompletion,
  };
}

export const AISandboxSimulator: React.FC<AISandboxSimulatorProps> = ({
  goals,
  profile,
  totalIncome,
  fixedExpenses,
  variableExpenses,
  onOpenVoiceAssistant,
}) => {
  const { isNitido, isVibrant } = useTheme();
  const currSym = profile.currencySymbol || '$';

  const baseIncome = Math.max(100, Math.round(totalIncome || profile.monthlyIncome || 2400));
  const baseFixed = Math.max(0, Math.round(fixedExpenses));
  const baseVariable = Math.max(0, Math.round(variableExpenses));

  const [simIncome, setSimIncome] = useState<number>(baseIncome);
  const [simFixed, setSimFixed] = useState<number>(baseFixed);
  const [simVariable, setSimVariable] = useState<number>(baseVariable);
  const [horizonMonths, setHorizonMonths] = useState<12 | 24 | 36 | 60>(24);
  const [allocationMode, setAllocationMode] = useState<AllocationMode>('proportional');
  const [activePreset, setActivePreset] = useState<string>('baseline');

  const baseTotalExpenses = baseFixed + baseVariable;
  const baseMonthlySavings = baseIncome - baseTotalExpenses;
  const simTotalExpenses = simFixed + simVariable;
  const simMonthlySavings = simIncome - simTotalExpenses;

  const baseSavingsRate = baseIncome > 0 ? Math.round((baseMonthlySavings / baseIncome) * 100) : 0;
  const simSavingsRate = simIncome > 0 ? Math.round((simMonthlySavings / simIncome) * 100) : 0;
  const monthlySavingsDiff = simMonthlySavings - baseMonthlySavings;

  const isModified =
    simIncome !== baseIncome || simFixed !== baseFixed || simVariable !== baseVariable;

  const applyPreset = (presetId: string) => {
    setActivePreset(presetId);
    if (presetId === 'baseline') {
      setSimIncome(baseIncome);
      setSimFixed(baseFixed);
      setSimVariable(baseVariable);
    } else if (presetId === 'income_boost') {
      setSimIncome(Math.round(baseIncome * 1.15));
      setSimFixed(baseFixed);
      setSimVariable(baseVariable);
    } else if (presetId === 'cut_variable') {
      setSimIncome(baseIncome);
      setSimFixed(baseFixed);
      setSimVariable(Math.round(baseVariable * 0.75));
    } else if (presetId === 'turbo') {
      setSimIncome(Math.round(baseIncome * 1.1));
      setSimFixed(Math.round(baseFixed * 0.95));
      setSimVariable(Math.round(baseVariable * 0.75));
    } else if (presetId === 'stress') {
      setSimIncome(Math.round(baseIncome * 0.85));
      setSimFixed(baseFixed);
      setSimVariable(baseVariable);
    }
  };

  const simulation = useMemo(() => {
    const initialCapital = goals.reduce((sum, g) => sum + Math.max(0, Number(g.currentAmount) || 0), 0);
    const totalTarget = goals.reduce((sum, g) => sum + Math.max(0, Number(g.targetAmount) || 0), 0);

    const baseSim = simulateGoalsCompletion(goals, Math.max(0, baseMonthlySavings), allocationMode);
    const whatIfSim = simulateGoalsCompletion(goals, Math.max(0, simMonthlySavings), allocationMode);

    const now = new Date();
    const chartData: Array<{
      monthIndex: number;
      monthLabel: string;
      baselineBalance: number;
      simulatedBalance: number;
      totalTarget: number;
    }> = [];

    for (let m = 0; m <= horizonMonths; m++) {
      const d = new Date(now.getFullYear(), now.getMonth() + m, 1);
      const label =
        m === 0 ? 'Hoy' : `${MONTH_NAMES_SHORT[d.getMonth()]} '${String(d.getFullYear()).slice(-2)}`;

      chartData.push({
        monthIndex: m,
        monthLabel: label,
        baselineBalance: Math.max(0, Math.round(initialCapital + baseMonthlySavings * m)),
        simulatedBalance: Math.max(0, Math.round(initialCapital + simMonthlySavings * m)),
        totalTarget,
      });
    }

    const goalTimelines: GoalTimelineResult[] = goals.map((g) => {
      const targetAmount = Math.max(0, Number(g.targetAmount) || 0);
      const currentAmount = Math.max(0, Number(g.currentAmount) || 0);
      const remaining = Math.max(0, targetAmount - currentAmount);
      const bMonths = baseSim.perGoalMonths[g.id] ?? null;
      const sMonths = whatIfSim.perGoalMonths[g.id] ?? null;

      let monthsDelta: number | null = null;
      if (bMonths !== null && sMonths !== null) {
        monthsDelta = bMonths - sMonths; // positive means faster
      }

      return {
        id: g.id,
        title: g.title,
        targetAmount,
        currentAmount,
        remaining,
        deadline: g.deadline,
        baselineMonthly: baseSim.perGoalInitialMonthly[g.id] ?? 0,
        simulatedMonthly: whatIfSim.perGoalInitialMonthly[g.id] ?? 0,
        baselineMonths: bMonths,
        simulatedMonths: sMonths,
        monthsDelta,
        baselineEtaLabel: formatFutureMonth(bMonths, now),
        simulatedEtaLabel: formatFutureMonth(sMonths, now),
      };
    });

    const baselineHorizonTotal = chartData[chartData.length - 1]?.baselineBalance ?? initialCapital;
    const simulatedHorizonTotal = chartData[chartData.length - 1]?.simulatedBalance ?? initialCapital;

    let allGoalsMonthsDelta: number | null = null;
    if (baseSim.allCompletedMonth !== null && whatIfSim.allCompletedMonth !== null) {
      allGoalsMonthsDelta = baseSim.allCompletedMonth - whatIfSim.allCompletedMonth;
    }

    return {
      initialCapital,
      totalTarget,
      chartData,
      goalTimelines,
      baselineAllMonths: baseSim.allCompletedMonth,
      simulatedAllMonths: whatIfSim.allCompletedMonth,
      allGoalsMonthsDelta,
      baselineHorizonTotal,
      simulatedHorizonTotal,
      horizonDiff: simulatedHorizonTotal - baselineHorizonTotal,
    };
  }, [goals, baseMonthlySavings, simMonthlySavings, allocationMode, horizonMonths]);

  // Dynamic AI Sandbox insight text
  const sandboxInsight = useMemo(() => {
    if (simMonthlySavings <= 0) {
      return `Con este escenario hipotético tendrías un déficit de ${currSym}${Math.abs(
        simMonthlySavings
      ).toLocaleString()}/mes, lo que detendría el avance de tus metas. Prueba reducir gastos variables o incrementar ingresos.`;
    }
    if (!isModified) {
      return `Estás viendo tu trayectoria real actual (${currSym}${baseMonthlySavings.toLocaleString()}/mes). Mueve los controles de ingreso o gastos para simular el impacto en tus metas a ${horizonMonths} meses.`;
    }
    if (monthlySavingsDiff > 0) {
      const accelText =
        simulation.allGoalsMonthsDelta !== null && simulation.allGoalsMonthsDelta > 0
          ? `y completarías todas tus metas ${simulation.allGoalsMonthsDelta} ${
              simulation.allGoalsMonthsDelta === 1 ? 'mes' : 'meses'
            } antes`
          : `sumando ${currSym}${simulation.horizonDiff.toLocaleString()} extra en ${horizonMonths} meses`;
      return `Este escenario libera +${currSym}${monthlySavingsDiff.toLocaleString()}/mes adicionales (${simSavingsRate}% tasa de ahorro) ${accelText}.`;
    }
    return `Este ajuste reduce tu ahorro mensual en ${currSym}${Math.abs(
      monthlySavingsDiff
    ).toLocaleString()}/mes, acumulando ${currSym}${Math.abs(
      simulation.horizonDiff
    ).toLocaleString()} menos al cabo de ${horizonMonths} meses.`;
  }, [
    simMonthlySavings,
    isModified,
    monthlySavingsDiff,
    simulation.allGoalsMonthsDelta,
    simulation.horizonDiff,
    horizonMonths,
    simSavingsRate,
    baseMonthlySavings,
    currSym,
  ]);

  const SandboxTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    const pt = payload[0]?.payload;
    if (!pt) return null;
    const diff = pt.simulatedBalance - pt.baselineBalance;

    return (
      <div
        className={`px-3.5 py-2.5 rounded-xl border shadow-lg text-xs backdrop-blur-md ${
          isNitido
            ? 'bg-white/95 border-slate-200 text-slate-900'
            : 'bg-slate-900/95 border-slate-700 text-slate-100'
        }`}
      >
        <p className="font-bold mb-1.5">{label} (Mes {pt.monthIndex})</p>
        <div className="space-y-1 tabular-nums">
          <div className="flex items-center justify-between gap-5">
            <span className={isNitido ? 'text-slate-600' : 'text-slate-400'}>Escenario Simulado:</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">
              {currSym}{pt.simulatedBalance.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center justify-between gap-5">
            <span className={isNitido ? 'text-slate-600' : 'text-slate-400'}>Trayectoria Actual:</span>
            <span className="font-semibold">{currSym}{pt.baselineBalance.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between gap-5 pt-1 border-t border-slate-200/70 dark:border-slate-800">
            <span className={isNitido ? 'text-slate-600' : 'text-slate-400'}>Diferencia neta:</span>
            <span
              className={`font-bold ${
                diff >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {diff >= 0 ? '+' : '-'}
              {currSym}{Math.abs(diff).toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    );
  };

  const cardSurfaceClass = isNitido
    ? 'bg-white border-slate-200 text-slate-900 shadow-xs'
    : isVibrant
    ? 'bg-slate-900/95 border-cyan-500/30 text-slate-100'
    : 'bg-slate-900 border-slate-800 text-slate-100';

  const hairlineBorder = isNitido ? 'border-slate-200/80' : 'border-slate-800';
  const axisColor = isNitido ? '#475569' : '#94a3b8';
  const gridColor = isNitido ? '#f1f5f9' : '#1e293b';

  const maxIncomeSlider = Math.max(baseIncome * 2, 6000);
  const maxFixedSlider = Math.max(baseFixed * 2, 3000);
  const maxVariableSlider = Math.max(baseVariable * 2, 2500);

  return (
    <section
      aria-label="Simulador AI Sandbox de Metas de Ahorro"
      className={`rounded-2xl border p-5 sm:p-6 transition-colors ${cardSurfaceClass}`}
    >
      {/* Header Row */}
      <div className={`flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-5 border-b ${hairlineBorder}`}>
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Sliders className={`w-5 h-5 shrink-0 ${isNitido ? 'text-indigo-600' : 'text-cyan-400'}`} />
            <h3 className="text-base sm:text-lg font-bold tracking-tight">
              AI Sandbox · Simulador de Escenarios y Metas de Ahorro
            </h3>
            {isModified && (
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                  isNitido
                    ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                    : 'bg-cyan-500/15 text-cyan-300 border-cyan-400/35'
                }`}
              >
                Simulación activa
              </span>
            )}
          </div>
          <p className={`text-xs mt-1 ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
            Ajusta tus ingresos o gastos hipotéticos para visualizar en tiempo real el impacto sobre tu línea de tiempo de ahorro.
          </p>
        </div>

        {/* Horizon & Allocation Mode Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div
            className={`flex items-center p-1 rounded-lg border ${
              isNitido ? 'bg-slate-100 border-slate-200' : 'bg-slate-800 border-slate-700'
            }`}
          >
            {([12, 24, 36, 60] as const).map((months) => (
              <button
                key={months}
                type="button"
                onClick={() => setHorizonMonths(months)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold tabular-nums whitespace-nowrap shrink-0 transition-colors ${
                  horizonMonths === months
                    ? isNitido
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'bg-slate-700 text-white'
                    : isNitido
                    ? 'text-slate-600 hover:text-slate-900'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {months}m
              </button>
            ))}
          </div>

          <div
            className={`flex items-center p-1 rounded-lg border ${
              isNitido ? 'bg-slate-100 border-slate-200' : 'bg-slate-800 border-slate-700'
            }`}
          >
            <button
              type="button"
              onClick={() => setAllocationMode('proportional')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                allocationMode === 'proportional'
                  ? isNitido
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'bg-slate-700 text-white'
                  : isNitido
                  ? 'text-slate-600 hover:text-slate-900'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Reparto proporcional
            </button>
            <button
              type="button"
              onClick={() => setAllocationMode('snowball')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                allocationMode === 'snowball'
                  ? isNitido
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'bg-slate-700 text-white'
                  : isNitido
                  ? 'text-slate-600 hover:text-slate-900'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Prioridad fecha (Bola de nieve)
            </button>
          </div>

          {isModified && (
            <button
              type="button"
              onClick={() => applyPreset('baseline')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border whitespace-nowrap shrink-0 transition-colors ${
                isNitido
                  ? 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restablecer</span>
            </button>
          )}
        </div>
      </div>

      {/* Quick What-If Presets */}
      <div className={`flex flex-wrap items-center gap-2 py-4 border-b ${hairlineBorder}`}>
        <span className={`text-[11px] font-bold uppercase tracking-wider mr-1 ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
          Escenarios rápidos:
        </span>
        {[
          { id: 'baseline', label: 'Situación actual' },
          { id: 'income_boost', label: '+15% Ingresos' },
          { id: 'cut_variable', label: '-25% Gastos Variables' },
          { id: 'turbo', label: 'Plan Turbo (+10% Ing / -25% Var)' },
          { id: 'stress', label: 'Contingencia (-15% Ingresos)' },
        ].map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => applyPreset(preset.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border whitespace-nowrap shrink-0 transition-colors ${
              activePreset === preset.id
                ? isNitido
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-cyan-500 text-slate-950 border-cyan-400'
                : isNitido
                ? 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                : 'bg-slate-800/70 hover:bg-slate-800 text-slate-300 border-slate-700'
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Interactive Sliders + Live KPI Output Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 py-5 border-b border-slate-200/80 dark:border-slate-800">
        {/* Left 5 cols: Interactive What-If Controls */}
        <div className="xl:col-span-5 space-y-4">
          {/* Monthly Income Slider */}
          <div
            className={`p-3.5 rounded-xl border space-y-2 ${
              isNitido ? 'bg-slate-50/70 border-slate-200' : 'bg-slate-950/50 border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between gap-2 text-xs">
              <label htmlFor="sandbox-income" className="font-bold">
                Ingreso mensual hipotético
              </label>
              <div className="flex items-center gap-1.5 tabular-nums">
                <span className={`text-[11px] ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
                  Base {currSym}{baseIncome.toLocaleString()}
                </span>
                <input
                  id="sandbox-income"
                  type="number"
                  min={0}
                  step={50}
                  value={simIncome}
                  onChange={(e) => {
                    setActivePreset('custom');
                    setSimIncome(Math.max(0, Number(e.target.value) || 0));
                  }}
                  className={`w-24 px-2 py-1 rounded-lg border text-right text-xs font-bold tabular-nums focus:outline-none ${
                    isNitido
                      ? 'bg-white border-slate-300 text-slate-900'
                      : 'bg-slate-900 border-slate-700 text-white'
                  }`}
                />
              </div>
            </div>
            <input
              type="range"
              aria-label="Deslizador de ingreso mensual hipotético"
              min={0}
              max={maxIncomeSlider}
              step={25}
              value={Math.min(simIncome, maxIncomeSlider)}
              onChange={(e) => {
                setActivePreset('custom');
                setSimIncome(Number(e.target.value));
              }}
              className="w-full accent-emerald-600 cursor-pointer"
            />
          </div>

          {/* Fixed Expenses Slider */}
          <div
            className={`p-3.5 rounded-xl border space-y-2 ${
              isNitido ? 'bg-slate-50/70 border-slate-200' : 'bg-slate-950/50 border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between gap-2 text-xs">
              <label htmlFor="sandbox-fixed" className="font-bold">
                Gastos fijos mensuales
              </label>
              <div className="flex items-center gap-1.5 tabular-nums">
                <span className={`text-[11px] ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
                  Base {currSym}{baseFixed.toLocaleString()}
                </span>
                <input
                  id="sandbox-fixed"
                  type="number"
                  min={0}
                  step={25}
                  value={simFixed}
                  onChange={(e) => {
                    setActivePreset('custom');
                    setSimFixed(Math.max(0, Number(e.target.value) || 0));
                  }}
                  className={`w-24 px-2 py-1 rounded-lg border text-right text-xs font-bold tabular-nums focus:outline-none ${
                    isNitido
                      ? 'bg-white border-slate-300 text-slate-900'
                      : 'bg-slate-900 border-slate-700 text-white'
                  }`}
                />
              </div>
            </div>
            <input
              type="range"
              aria-label="Deslizador de gastos fijos mensuales"
              min={0}
              max={maxFixedSlider}
              step={10}
              value={Math.min(simFixed, maxFixedSlider)}
              onChange={(e) => {
                setActivePreset('custom');
                setSimFixed(Number(e.target.value));
              }}
              className="w-full accent-amber-500 cursor-pointer"
            />
          </div>

          {/* Variable Expenses Slider */}
          <div
            className={`p-3.5 rounded-xl border space-y-2 ${
              isNitido ? 'bg-slate-50/70 border-slate-200' : 'bg-slate-950/50 border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between gap-2 text-xs">
              <label htmlFor="sandbox-variable" className="font-bold">
                Gastos variables mensuales
              </label>
              <div className="flex items-center gap-1.5 tabular-nums">
                <span className={`text-[11px] ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
                  Base {currSym}{baseVariable.toLocaleString()}
                </span>
                <input
                  id="sandbox-variable"
                  type="number"
                  min={0}
                  step={20}
                  value={simVariable}
                  onChange={(e) => {
                    setActivePreset('custom');
                    setSimVariable(Math.max(0, Number(e.target.value) || 0));
                  }}
                  className={`w-24 px-2 py-1 rounded-lg border text-right text-xs font-bold tabular-nums focus:outline-none ${
                    isNitido
                      ? 'bg-white border-slate-300 text-slate-900'
                      : 'bg-slate-900 border-slate-700 text-white'
                  }`}
                />
              </div>
            </div>
            <input
              type="range"
              aria-label="Deslizador de gastos variables mensuales"
              min={0}
              max={maxVariableSlider}
              step={10}
              value={Math.min(simVariable, maxVariableSlider)}
              onChange={(e) => {
                setActivePreset('custom');
                setSimVariable(Number(e.target.value));
              }}
              className="w-full accent-rose-500 cursor-pointer"
            />
          </div>

          {/* AI Sandbox Diagnostic Note */}
          <div
            className={`p-3.5 rounded-xl border text-xs leading-relaxed ${
              simMonthlySavings <= 0
                ? isNitido
                  ? 'bg-rose-50 border-rose-200 text-rose-900'
                  : 'bg-rose-950/35 border-rose-500/40 text-rose-100'
                : monthlySavingsDiff > 0
                ? isNitido
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                  : 'bg-emerald-950/30 border-emerald-500/35 text-emerald-100'
                : isNitido
                ? 'bg-indigo-50/70 border-indigo-200 text-indigo-950'
                : 'bg-indigo-950/30 border-indigo-500/35 text-indigo-100'
            }`}
          >
            <div className="flex items-start gap-2">
              {simMonthlySavings <= 0 ? (
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <Sparkles className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <div className="space-y-2">
                <p>{sandboxInsight}</p>
                {onOpenVoiceAssistant && isModified && (
                  <button
                    type="button"
                    onClick={() =>
                      onOpenVoiceAssistant(
                        `Simulé un ingreso de ${currSym}${simIncome} y gastos de ${currSym}${simTotalExpenses}. ¿Cómo puedo lograr ahorrar ${currSym}${Math.max(
                          0,
                          simMonthlySavings
                        )}/mes para acelerar mis metas?`
                      )
                    }
                    className="inline-flex items-center gap-1 font-bold underline"
                  >
                    <span>Pedir plan de acción al asistente IA</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right 7 cols: KPI Strip + Recharts Dual-Curve Timeline */}
        <div className="xl:col-span-7 flex flex-col justify-between space-y-5">
          {/* 3-Column Simulated Outcome Strip */}
          <div className={`grid grid-cols-1 sm:grid-cols-3 gap-4 pb-4 border-b ${hairlineBorder}`}>
            <div>
              <span className={`text-xs block ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
                Ahorro mensual simulado
              </span>
              <div className="flex items-baseline gap-2 mt-0.5 tabular-nums">
                <span
                  className={`text-xl sm:text-2xl font-bold ${
                    simMonthlySavings > 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {currSym}{simMonthlySavings.toLocaleString()}
                </span>
                {monthlySavingsDiff !== 0 && (
                  <span
                    className={`text-xs font-bold ${
                      monthlySavingsDiff > 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    ({monthlySavingsDiff > 0 ? '+' : '-'}
                    {currSym}{Math.abs(monthlySavingsDiff).toLocaleString()})
                  </span>
                )}
              </div>
              <span className={`text-[11px] tabular-nums ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
                Tasa: {baseSavingsRate}% → <strong>{simSavingsRate}%</strong>
              </span>
            </div>

            <div>
              <span className={`text-xs block ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
                Todas las metas al 100%
              </span>
              <div className="flex items-baseline gap-2 mt-0.5 tabular-nums">
                <span className="text-xl sm:text-2xl font-bold">
                  {simulation.simulatedAllMonths === null
                    ? '> 10 años'
                    : simulation.simulatedAllMonths === 0
                    ? 'Logradas'
                    : `${simulation.simulatedAllMonths} meses`}
                </span>
                {simulation.allGoalsMonthsDelta !== null && simulation.allGoalsMonthsDelta !== 0 && (
                  <span
                    className={`text-xs font-bold ${
                      simulation.allGoalsMonthsDelta > 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {simulation.allGoalsMonthsDelta > 0
                      ? `(${simulation.allGoalsMonthsDelta}m antes)`
                      : `(+${Math.abs(simulation.allGoalsMonthsDelta)}m)`}
                  </span>
                )}
              </div>
              <span className={`text-[11px] tabular-nums ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
                Actual: {formatFutureMonth(simulation.baselineAllMonths)}
              </span>
            </div>

            <div>
              <span className={`text-xs block ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
                Capital acumulado ({horizonMonths}m)
              </span>
              <div className="flex items-baseline gap-2 mt-0.5 tabular-nums">
                <span className="text-xl sm:text-2xl font-bold">
                  {currSym}{simulation.simulatedHorizonTotal.toLocaleString()}
                </span>
              </div>
              <span
                className={`text-[11px] font-semibold tabular-nums ${
                  simulation.horizonDiff >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {simulation.horizonDiff >= 0 ? '+' : '-'}
                {currSym}{Math.abs(simulation.horizonDiff).toLocaleString()} vs. trayectoria actual
              </span>
            </div>
          </div>

          {/* Recharts Dual Area/Line Timeline */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-bold flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                Proyección acumulada vs. Meta combinada ({currSym}{simulation.totalTarget.toLocaleString()})
              </span>
              <div className="flex items-center gap-4 text-[11px]">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-emerald-500 inline-block" />
                  Simulado
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 border-t-2 border-dashed border-slate-400 inline-block" />
                  Actual
                </span>
              </div>
            </div>

            <div className="w-full h-[230px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={simulation.chartData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="sandboxSimFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                  <XAxis
                    dataKey="monthLabel"
                    tick={{ fontSize: 11, fill: axisColor }}
                    axisLine={false}
                    tickLine={false}
                    minTickGap={24}
                  />
                  <YAxis
                    tickFormatter={(v) =>
                      v >= 1000 ? `${currSym}${(Number(v) / 1000).toFixed(1)}k` : `${currSym}${v}`
                    }
                    tick={{ fontSize: 11, fill: axisColor }}
                    axisLine={false}
                    tickLine={false}
                    width={54}
                  />
                  <Tooltip content={<SandboxTooltip />} />
                  {simulation.totalTarget > 0 && (
                    <ReferenceLine
                      y={simulation.totalTarget}
                      stroke="#6366f1"
                      strokeDasharray="4 4"
                      label={{
                        value: `Metas: ${currSym}${simulation.totalTarget.toLocaleString()}`,
                        position: 'insideTopRight',
                        fill: isNitido ? '#4f46e5' : '#a5b4fc',
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    />
                  )}
                  <Area
                    type="monotone"
                    dataKey="baselineBalance"
                    name="Actual"
                    stroke={isNitido ? '#64748b' : '#94a3b8'}
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    fill="none"
                    dot={false}
                    animationDuration={300}
                  />
                  <Area
                    type="monotone"
                    dataKey="simulatedBalance"
                    name="Simulado"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    fill="url(#sandboxSimFill)"
                    dot={false}
                    animationDuration={300}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Per-Goal Long-Term Timeline Impact Breakdown */}
      <div className="pt-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-bold flex items-center gap-2">
            <Layers className={`w-4 h-4 ${isNitido ? 'text-indigo-600' : 'text-cyan-400'}`} />
            <span>Impacto por Meta de Ahorro a Largo Plazo</span>
          </h4>
          <span className={`text-xs ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
            Modo: {allocationMode === 'snowball' ? 'Prioridad fecha límite' : 'Reparto proporcional'}
          </span>
        </div>

        {simulation.goalTimelines.length === 0 ? (
          <p className={`text-xs py-4 ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
            Crea al menos una meta de ahorro para simular su fecha estimada de cumplimiento.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {simulation.goalTimelines.map((item) => {
              const accelerated = item.monthsDelta !== null && item.monthsDelta > 0;
              const delayed = item.monthsDelta !== null && item.monthsDelta < 0;

              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-xl border space-y-2.5 ${
                    isNitido
                      ? 'bg-slate-50/70 border-slate-200'
                      : 'bg-slate-950/40 border-slate-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h5 className="text-xs font-bold truncate" title={item.title}>
                        {item.title}
                      </h5>
                      <p className={`text-[11px] tabular-nums mt-0.5 ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
                        Faltan {currSym}{item.remaining.toLocaleString()} de {currSym}
                        {item.targetAmount.toLocaleString()}
                      </p>
                    </div>
                    {accelerated ? (
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border tabular-nums whitespace-nowrap shrink-0 ${
                          isNitido
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/35'
                        }`}
                      >
                        <TrendingUp className="w-3 h-3" />
                        -{item.monthsDelta}m antes
                      </span>
                    ) : delayed ? (
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border tabular-nums whitespace-nowrap shrink-0 ${
                          isNitido
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : 'bg-amber-500/20 text-amber-300 border-amber-500/35'
                        }`}
                      >
                        <TrendingDown className="w-3 h-3" />
                        +{Math.abs(item.monthsDelta!)}m más
                      </span>
                    ) : (
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border whitespace-nowrap shrink-0 ${
                          isNitido
                            ? 'bg-white text-slate-600 border-slate-200'
                            : 'bg-slate-800 text-slate-300 border-slate-700'
                        }`}
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        Sin cambio
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/80 dark:border-slate-800 text-[11px] tabular-nums">
                    <div>
                      <span className={`block ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
                        Fecha actual
                      </span>
                      <span className="font-semibold flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3 opacity-60 shrink-0" />
                        {item.baselineEtaLabel}
                      </span>
                    </div>
                    <div>
                      <span className={`block ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
                        Fecha simulada
                      </span>
                      <span
                        className={`font-bold flex items-center gap-1 mt-0.5 ${
                          accelerated
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : delayed
                            ? 'text-amber-600 dark:text-amber-400'
                            : ''
                        }`}
                      >
                        <Calendar className="w-3 h-3 opacity-80 shrink-0" />
                        {item.simulatedEtaLabel}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
