import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import {
  TrendingUp,
  Target,
  Sparkles,
  Calendar,
  CheckCircle2,
  Clock,
  Percent,
  DollarSign,
  ChevronRight,
  Plus,
  Car,
  Home,
  Shield,
  Plane,
  Award,
  Layers,
  HelpCircle,
} from 'lucide-react';
import { SavingsGoal, UserFinancialProfile } from '../types';
import { useTheme } from '../context/ThemeContext';

interface SavingsGoalsProgressEvolutionChartProps {
  goals: SavingsGoal[];
  profile: UserFinancialProfile;
  onOpenAddGoal?: () => void;
  onOpenDepositGoal?: (goalId: string) => void;
}

// Consistent and accessible palette for goals
const GOAL_PALETTE = [
  { stroke: '#4f46e5', bg: 'bg-indigo-50 border-indigo-200 text-indigo-700', fill: '#6366f1' }, // Indigo
  { stroke: '#059669', bg: 'bg-emerald-50 border-emerald-200 text-emerald-700', fill: '#10b981' }, // Emerald
  { stroke: '#d97706', bg: 'bg-amber-50 border-amber-200 text-amber-700', fill: '#f59e0b' }, // Amber
  { stroke: '#0891b2', bg: 'bg-cyan-50 border-cyan-200 text-cyan-700', fill: '#06b6d4' }, // Cyan
  { stroke: '#7c3aed', bg: 'bg-violet-50 border-violet-200 text-violet-700', fill: '#8b5cf6' }, // Violet
  { stroke: '#db2777', bg: 'bg-pink-50 border-pink-200 text-pink-700', fill: '#ec4899' }, // Pink
  { stroke: '#2563eb', bg: 'bg-blue-50 border-blue-200 text-blue-700', fill: '#3b82f6' }, // Blue
];

export const SavingsGoalsProgressEvolutionChart: React.FC<SavingsGoalsProgressEvolutionChartProps> = ({
  goals,
  profile,
  onOpenAddGoal,
  onOpenDepositGoal,
}) => {
  const { isNitido, isVibrant } = useTheme();

  // Controls state
  const [metricMode, setMetricMode] = useState<'percent' | 'amount'>('percent');
  const [selectedGoalId, setSelectedGoalId] = useState<string>('all');
  const [horizonMonths, setHorizonMonths] = useState<number>(12);
  const [includeHistorical, setIncludeHistorical] = useState<boolean>(true);

  const currSym = profile.currencySymbol || '$';

  // Overall current stats
  const totalTarget = useMemo(() => goals.reduce((sum, g) => sum + g.targetAmount, 0), [goals]);
  const totalSaved = useMemo(() => goals.reduce((sum, g) => sum + g.currentAmount, 0), [goals]);
  const currentOverallPercent = totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0;
  const totalMonthlyContribution = useMemo(
    () => goals.reduce((sum, g) => sum + (Number(g.monthlyContribution) || 0), 0),
    [goals]
  );

  // Determine closest goal to completion
  const closestGoal = useMemo(() => {
    if (goals.length === 0) return null;
    return [...goals].sort((a, b) => {
      const pctA = a.targetAmount > 0 ? a.currentAmount / a.targetAmount : 0;
      const pctB = b.targetAmount > 0 ? b.currentAmount / b.targetAmount : 0;
      return pctB - pctA;
    })[0];
  }, [goals]);

  // Generate timeline data points:
  // - Historical points (3 months back: m = -3, -2, -1)
  // - Current month (m = 0)
  // - Future projected points (m = 1 ... horizonMonths)
  const timelineData = useMemo(() => {
    if (goals.length === 0) return [];

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed

    const points = [];
    const startM = includeHistorical ? -3 : 0;
    const endM = horizonMonths;

    for (let offset = startM; offset <= endM; offset++) {
      const pointDate = new Date(currentYear, currentMonth + offset, 1);
      const monthLabel = pointDate.toLocaleDateString('es-ES', { month: 'short' });
      const yearShort = pointDate.getFullYear().toString().slice(-2);
      const isCurrent = offset === 0;
      const isPast = offset < 0;

      // Base point object
      const pointObj: Record<string, any> = {
        monthKey: `${pointDate.getFullYear()}-${pointDate.getMonth() + 1}`,
        displayDate: `${monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)} '${yearShort}`,
        isCurrent,
        isPast,
        offset,
      };

      let sumAccumulatedForMonth = 0;
      let sumTargetForMonth = 0;

      goals.forEach((goal) => {
        const target = Math.max(1, Number(goal.targetAmount) || 1);
        const current = Math.max(0, Number(goal.currentAmount) || 0);
        const monthly = Math.max(0, Number(goal.monthlyContribution) || 0);

        let accumulated = 0;
        if (offset <= 0) {
          // In the past or current month:
          // Simulate backward evolution based on currentAmount and monthly contribution
          accumulated = Math.max(0, current + offset * monthly);
        } else {
          // Future projection:
          // Accumulate monthly contributions up to target
          accumulated = Math.min(target, current + offset * monthly);
        }

        const pct = Math.min(100, Math.round((accumulated / target) * 100));

        // Assign fields for this goal
        pointObj[`goal_${goal.id}_pct`] = pct;
        pointObj[`goal_${goal.id}_amount`] = Math.round(accumulated);
        pointObj[`goal_${goal.id}_target`] = target;
        pointObj[`goal_${goal.id}_isCompleted`] = accumulated >= target;

        sumAccumulatedForMonth += accumulated;
        sumTargetForMonth += target;
      });

      // Portfolio average %
      const avgPct = sumTargetForMonth > 0 ? Math.round((sumAccumulatedForMonth / sumTargetForMonth) * 100) : 0;
      pointObj.portfolioAvgPct = avgPct;
      pointObj.portfolioTotalAmount = Math.round(sumAccumulatedForMonth);
      pointObj.portfolioTargetAmount = sumTargetForMonth;

      points.push(pointObj);
    }

    return points;
  }, [goals, horizonMonths, includeHistorical]);

  // Goals milestone achievements (which goals will be reached within the selected horizon)
  const milestoneAchievements = useMemo(() => {
    return goals
      .map((goal) => {
        const needed = Math.max(0, goal.targetAmount - goal.currentAmount);
        if (needed === 0) {
          return {
            ...goal,
            monthsToFinish: 0,
            completionDateStr: 'Completada',
            isAlreadyCompleted: true,
            willFinishInHorizon: true,
          };
        }
        if (goal.monthlyContribution <= 0) {
          return {
            ...goal,
            monthsToFinish: Infinity,
            completionDateStr: 'Sin aporte mensual',
            isAlreadyCompleted: false,
            willFinishInHorizon: false,
          };
        }
        const months = Math.ceil(needed / goal.monthlyContribution);
        const completionDate = new Date();
        completionDate.setMonth(completionDate.getMonth() + months);
        const monthStr = completionDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

        return {
          ...goal,
          monthsToFinish: months,
          completionDateStr: monthStr.charAt(0).toUpperCase() + monthStr.slice(1),
          isAlreadyCompleted: false,
          willFinishInHorizon: months <= horizonMonths,
        };
      })
      .sort((a, b) => a.monthsToFinish - b.monthsToFinish);
  }, [goals, horizonMonths]);

  // Goal icon resolver
  const getGoalIcon = (cat: SavingsGoal['category']) => {
    switch (cat) {
      case 'auto':
        return Car;
      case 'vivienda':
        return Home;
      case 'emergencia':
        return Shield;
      case 'viaje':
        return Plane;
      default:
        return Target;
    }
  };

  // Custom Chart Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    const dataPoint = payload[0]?.payload;
    const isPast = dataPoint?.isPast;
    const isCurrent = dataPoint?.isCurrent;

    return (
      <div
        className={`p-3.5 rounded-2xl border shadow-xl max-w-xs sm:max-w-sm text-xs z-50 backdrop-blur-md transition-all ${
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
              isCurrent
                ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                : isPast
                ? 'bg-slate-100 text-slate-700 border border-slate-200'
                : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
            }`}
          >
            {isCurrent ? 'Mes Actual' : isPast ? 'Histórico' : 'Proyección'}
          </span>
        </div>

        {/* Global Average row */}
        {selectedGoalId === 'all' && (
          <div className="flex items-center justify-between py-1 px-1.5 mb-1.5 rounded-lg bg-indigo-50/70 border border-indigo-100">
            <span className="font-bold text-indigo-950 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-indigo-600" />
              Promedio de Cumplimiento:
            </span>
            <span className="font-black text-indigo-800 text-sm">
              {metricMode === 'percent'
                ? `${dataPoint?.portfolioAvgPct}%`
                : `${currSym}${dataPoint?.portfolioTotalAmount?.toLocaleString()}`}
            </span>
          </div>
        )}

        {/* Goal items breakdown */}
        <div className="space-y-1.5 max-h-56 overflow-y-auto pr-0.5">
          {goals
            .filter((g) => selectedGoalId === 'all' || g.id === selectedGoalId)
            .map((goal, idx) => {
              const palette = GOAL_PALETTE[idx % GOAL_PALETTE.length];
              const pct = dataPoint[`goal_${goal.id}_pct`] || 0;
              const amount = dataPoint[`goal_${goal.id}_amount`] || 0;
              const target = goal.targetAmount;
              const isCompleted = pct >= 100;

              return (
                <div
                  key={goal.id}
                  className={`p-2 rounded-xl border flex flex-col gap-1 ${
                    isCompleted
                      ? 'bg-emerald-50/70 border-emerald-200'
                      : isNitido
                      ? 'bg-slate-50/80 border-slate-100'
                      : 'bg-slate-800/80 border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: palette.stroke }} />
                      <span className="font-bold truncate text-[11px]">{goal.title}</span>
                    </div>
                    <span className="font-black shrink-0 text-slate-900 dark:text-white">
                      {metricMode === 'percent' ? `${pct}%` : `${currSym}${amount.toLocaleString()}`}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium">
                    <span>
                      {currSym}
                      {amount.toLocaleString()} de {currSym}
                      {target.toLocaleString()}
                    </span>
                    {isCompleted ? (
                      <span className="text-emerald-700 font-black flex items-center gap-0.5">
                        <CheckCircle2 className="w-2.5 h-2.5" /> Meta lograda
                      </span>
                    ) : (
                      <span>Aporte: +{currSym}{goal.monthlyContribution}/mes</span>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    );
  };

  // If no goals exist, render empty state
  if (goals.length === 0) {
    return (
      <div
        className={`rounded-3xl border p-8 text-center space-y-4 ${
          isNitido ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-900 border-slate-800'
        }`}
      >
        <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center">
          <Target className="w-7 h-7" />
        </div>
        <div className="max-w-md mx-auto">
          <h3 className={`text-base font-bold ${isNitido ? 'text-slate-900' : 'text-white'}`}>
            Evolución del Cumplimiento de Metas de Ahorro
          </h3>
          <p className={`text-xs mt-1 text-slate-500`}>
            Aún no tienes metas de ahorro programadas ('SavingsGoal'). Agrega tu primera meta para visualizar la curva de
            cumplimiento mensual proyectada hacia tus objetivos.
          </p>
        </div>
        {onOpenAddGoal && (
          <button
            type="button"
            onClick={onOpenAddGoal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Crear Primera Meta de Ahorro</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className={`rounded-3xl border transition-all ${
        isNitido
          ? 'bg-white border-slate-200/90 shadow-sm'
          : isVibrant
          ? 'bg-gradient-to-br from-slate-900/95 via-[#0a1330] to-[#070c22] border-indigo-500/30 shadow-xl'
          : 'bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-950 border-slate-800 shadow-xl'
      } p-5 sm:p-6 space-y-6`}
    >
      {/* 1. Header with Title, Badges, and View Toggle Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b pb-5 border-slate-100 dark:border-slate-800">
        <div className="flex items-start gap-3.5">
          <div
            className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border ${
              isNitido
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                : 'bg-indigo-950/80 border-indigo-700/60 text-indigo-400'
            }`}
          >
            <TrendingUp className="w-5 h-5" />
          </div>

          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className={`text-base sm:text-lg font-black tracking-tight ${isNitido ? 'text-slate-900' : 'text-white'}`}>
                Evolución del Cumplimiento de Metas ('SavingsGoal')
              </h3>
              <span
                className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 border ${
                  isNitido
                    ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                    : 'bg-indigo-950/80 text-indigo-300 border-indigo-800'
                }`}
              >
                <Award className="w-3 h-3 text-indigo-600" />
                Progreso Temporal
              </span>
            </div>

            <p className={`text-xs mt-1 leading-relaxed ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
              Trayectoria histórica y proyección temporal hacia el 100% de cumplimiento para cada una de tus metas financieras activas.
            </p>
          </div>
        </div>

        {/* Toolbar Controls */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {/* Metric Mode Toggle: % vs $ */}
          <div className={`flex items-center p-0.5 rounded-xl border ${isNitido ? 'bg-slate-100 border-slate-200' : 'bg-slate-800 border-slate-700'}`}>
            <button
              type="button"
              onClick={() => setMetricMode('percent')}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                metricMode === 'percent'
                  ? isNitido
                    ? 'bg-white text-indigo-950 shadow-2xs font-black'
                    : 'bg-indigo-600 text-white font-black'
                  : isNitido
                  ? 'text-slate-600 hover:text-slate-900'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Ver porcentaje de cumplimiento de 0% a 100%"
            >
              <Percent className="w-3.5 h-3.5 text-indigo-600" />
              <span>% Avance</span>
            </button>

            <button
              type="button"
              onClick={() => setMetricMode('amount')}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                metricMode === 'amount'
                  ? isNitido
                    ? 'bg-white text-emerald-950 shadow-2xs font-black'
                    : 'bg-emerald-600 text-white font-black'
                  : isNitido
                  ? 'text-slate-600 hover:text-slate-900'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Ver capital acumulado en moneda"
            >
              <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
              <span>$ Acumulado</span>
            </button>
          </div>

          {/* Time Horizon Selector */}
          <div className={`flex items-center p-0.5 rounded-xl border ${isNitido ? 'bg-slate-100 border-slate-200' : 'bg-slate-800 border-slate-700'}`}>
            {[6, 12, 18, 24].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setHorizonMonths(m)}
                className={`px-2 py-1 text-xs font-bold rounded-lg transition-all ${
                  horizonMonths === m
                    ? isNitido
                      ? 'bg-white text-slate-900 shadow-2xs font-black'
                      : 'bg-slate-700 text-white font-black'
                    : isNitido
                    ? 'text-slate-600 hover:text-slate-900'
                    : 'text-slate-400 hover:text-white'
                }`}
                title={`Proyectar a ${m} meses`}
              >
                {m}m
              </button>
            ))}
          </div>

          {/* Historical Toggle */}
          <button
            type="button"
            onClick={() => setIncludeHistorical(!includeHistorical)}
            className={`px-2.5 py-1 rounded-xl text-xs font-bold border transition-all ${
              includeHistorical
                ? isNitido
                  ? 'bg-indigo-50 text-indigo-900 border-indigo-200'
                  : 'bg-indigo-950/60 text-indigo-300 border-indigo-700'
                : isNitido
                ? 'bg-white text-slate-500 border-slate-200'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
            title="Alternar inclusión de los últimos 3 meses históricos"
          >
            {includeHistorical ? 'Histórico: Sí ✓' : 'Histórico: No'}
          </button>
        </div>
      </div>

      {/* 2. Top Summary Metrics KPI Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {/* Metric 1: Overall Fulfillment Percent */}
        <div className={`p-3.5 rounded-2xl border ${isNitido ? 'bg-slate-50/80 border-slate-200' : 'bg-slate-900/80 border-slate-800'}`}>
          <span className={`text-[10px] font-bold uppercase tracking-wider block ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
            Cumplimiento Global
          </span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className={`text-xl sm:text-2xl font-black ${isNitido ? 'text-indigo-900' : 'text-indigo-400'}`}>
              {currentOverallPercent}%
            </span>
            <span className={`text-[10px] font-semibold ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
              promedio actual
            </span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-1.5 mt-2 overflow-hidden">
            <div
              className="bg-indigo-600 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, currentOverallPercent)}%` }}
            />
          </div>
        </div>

        {/* Metric 2: Total Capital Saved vs Target */}
        <div className={`p-3.5 rounded-2xl border ${isNitido ? 'bg-slate-50/80 border-slate-200' : 'bg-slate-900/80 border-slate-800'}`}>
          <span className={`text-[10px] font-bold uppercase tracking-wider block ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
            Capital Acumulado
          </span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className={`text-xl sm:text-2xl font-black ${isNitido ? 'text-emerald-700' : 'text-emerald-400'}`}>
              {currSym}{totalSaved.toLocaleString()}
            </span>
          </div>
          <span className={`text-[10px] font-semibold block mt-1 ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
            Objetivo: {currSym}{totalTarget.toLocaleString()}
          </span>
        </div>

        {/* Metric 3: Active Monthly Contribution */}
        <div className={`p-3.5 rounded-2xl border ${isNitido ? 'bg-slate-50/80 border-slate-200' : 'bg-slate-900/80 border-slate-800'}`}>
          <span className={`text-[10px] font-bold uppercase tracking-wider block ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
            Aporte Mensual Activo
          </span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className={`text-xl sm:text-2xl font-black ${isNitido ? 'text-cyan-700' : 'text-cyan-400'}`}>
              +{currSym}{totalMonthlyContribution.toLocaleString()}
            </span>
            <span className={`text-[10px] font-semibold ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>/mes</span>
          </div>
          <span className={`text-[10px] font-semibold block mt-1 ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
            En {goals.length} metas activas
          </span>
        </div>

        {/* Metric 4: Nearest Goal Milestone */}
        <div className={`p-3.5 rounded-2xl border ${isNitido ? 'bg-slate-50/80 border-slate-200' : 'bg-slate-900/80 border-slate-800'}`}>
          <span className={`text-[10px] font-bold uppercase tracking-wider block ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
            Próximo Hito (100%)
          </span>
          <span className={`text-xs font-black block mt-0.5 truncate ${isNitido ? 'text-amber-800' : 'text-amber-300'}`}>
            {milestoneAchievements[0]?.title || 'En curso'}
          </span>
          <span className={`text-[10px] font-semibold block mt-1 ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
            {milestoneAchievements[0]?.completionDateStr
              ? `Est: ${milestoneAchievements[0].completionDateStr}`
              : 'Estimando...'}
          </span>
        </div>
      </div>

      {/* 3. Goal Filter Pills Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
        <span className={`text-xs font-bold shrink-0 ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
          Filtrar visualización:
        </span>

        <button
          type="button"
          onClick={() => setSelectedGoalId('all')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 border active:scale-95 ${
            selectedGoalId === 'all'
              ? isNitido
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs font-black'
                : 'bg-indigo-600 text-white border-indigo-500 font-black'
              : isNitido
              ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
          }`}
        >
          Todas las Metas ({goals.length})
        </button>

        {goals.map((g, idx) => {
          const Icon = getGoalIcon(g.category);
          const palette = GOAL_PALETTE[idx % GOAL_PALETTE.length];
          const isSelected = selectedGoalId === g.id;
          const pct = g.targetAmount > 0 ? Math.round((g.currentAmount / g.targetAmount) * 100) : 0;

          return (
            <button
              key={g.id}
              type="button"
              onClick={() => setSelectedGoalId(g.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 border active:scale-95 ${
                isSelected
                  ? isNitido
                    ? 'bg-slate-900 text-white border-slate-900 shadow-2xs font-black'
                    : 'bg-white text-slate-900 border-white font-black'
                  : isNitido
                  ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: palette.stroke }} />
              <Icon className="w-3.5 h-3.5" />
              <span>{g.title}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                  isSelected
                    ? 'bg-white/20 text-white'
                    : isNitido
                    ? 'bg-slate-100 text-slate-600'
                    : 'bg-slate-700 text-slate-300'
                }`}
              >
                {pct}%
              </span>
            </button>
          );
        })}
      </div>

      {/* 4. Interactive Recharts Line Chart */}
      <div className={`p-4 sm:p-5 rounded-2xl border ${isNitido ? 'bg-slate-50/50 border-slate-200' : 'bg-slate-950/70 border-slate-800'}`}>
        <div className="h-80 sm:h-96 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={timelineData} margin={{ top: 20, right: 25, left: 0, bottom: 5 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={isNitido ? '#e2e8f0' : '#1e293b'}
                vertical={false}
              />

              <XAxis
                dataKey="displayDate"
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
                domain={metricMode === 'percent' ? [0, 105] : ['auto', 'auto']}
                tickFormatter={(val) => (metricMode === 'percent' ? `${val}%` : `${currSym}${val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val}`)}
              />

              <Tooltip content={<CustomTooltip />} />

              <Legend
                verticalAlign="top"
                align="right"
                wrapperStyle={{ paddingBottom: 12, fontSize: 11, fontWeight: 700 }}
                formatter={(val) => {
                  if (val === 'portfolioAvgPct') return 'Promedio Global Ponderado (%)';
                  if (val === 'portfolioTotalAmount') return 'Total Cartera Acumulada';
                  const match = val.match(/goal_([^_]+)_(pct|amount)/);
                  if (match) {
                    const g = goals.find((item) => item.id === match[1]);
                    return g ? g.title : val;
                  }
                  return val;
                }}
              />

              {/* 100% Benchmark Reference Line when in Percent Mode */}
              {metricMode === 'percent' && (
                <ReferenceLine
                  y={100}
                  stroke="#10b981"
                  strokeDasharray="4 4"
                  strokeWidth={2}
                  label={{
                    value: '100% Meta Cumplida',
                    position: 'insideTopLeft',
                    fill: isNitido ? '#047857' : '#34d399',
                    fontSize: 10,
                    fontWeight: 800,
                  }}
                />
              )}

              {/* Present Month Vertical Marker */}
              <ReferenceLine
                x={timelineData.find((d) => d.isCurrent)?.displayDate}
                stroke={isNitido ? '#6366f1' : '#818cf8'}
                strokeDasharray="3 3"
                strokeWidth={1.5}
                label={{
                  value: 'Hoy / Mes Actual',
                  position: 'insideTopRight',
                  fill: isNitido ? '#4338ca' : '#a5b4fc',
                  fontSize: 10,
                  fontWeight: 700,
                }}
              />

              {/* Portfolio Global Average Line (when 'all' is selected) */}
              {selectedGoalId === 'all' && (
                <Line
                  type="monotone"
                  dataKey={metricMode === 'percent' ? 'portfolioAvgPct' : 'portfolioTotalAmount'}
                  name={metricMode === 'percent' ? 'portfolioAvgPct' : 'portfolioTotalAmount'}
                  stroke={isNitido ? '#0f766e' : '#2dd4bf'}
                  strokeWidth={3}
                  strokeDasharray="4 4"
                  dot={{
                    r: 3,
                    fill: isNitido ? '#0f766e' : '#2dd4bf',
                    stroke: '#ffffff',
                    strokeWidth: 1.5,
                  }}
                  activeDot={{ r: 6 }}
                />
              )}

              {/* Goal lines */}
              {goals
                .filter((g) => selectedGoalId === 'all' || g.id === selectedGoalId)
                .map((goal, idx) => {
                  const palette = GOAL_PALETTE[idx % GOAL_PALETTE.length];
                  const dataKey = metricMode === 'percent' ? `goal_${goal.id}_pct` : `goal_${goal.id}_amount`;

                  return (
                    <Line
                      key={goal.id}
                      type="monotone"
                      dataKey={dataKey}
                      name={dataKey}
                      stroke={palette.stroke}
                      strokeWidth={selectedGoalId === goal.id ? 3.5 : 2.5}
                      dot={{
                        r: 3,
                        fill: palette.stroke,
                        stroke: '#ffffff',
                        strokeWidth: 1.5,
                      }}
                      activeDot={{ r: 6 }}
                    />
                  );
                })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 5. Projected Completion Dates & Milestones Ribbon */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className={`text-xs font-bold flex items-center gap-1.5 ${isNitido ? 'text-slate-800' : 'text-slate-200'}`}>
            <Award className="w-4 h-4 text-amber-500" />
            Hitos Estimados de Culminación (al ritmo de aporte actual):
          </span>
          <span className={`text-[10px] font-semibold ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
            Horizonte seleccionado: {horizonMonths} meses
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {milestoneAchievements.map((goal, idx) => {
            const Icon = getGoalIcon(goal.category);
            const palette = GOAL_PALETTE[idx % GOAL_PALETTE.length];
            const currentPct = goal.targetAmount > 0 ? Math.round((goal.currentAmount / goal.targetAmount) * 100) : 0;
            const remainingMoney = Math.max(0, goal.targetAmount - goal.currentAmount);

            return (
              <div
                key={goal.id}
                className={`p-3.5 rounded-2xl border flex flex-col justify-between space-y-3 transition-all ${
                  isNitido
                    ? 'bg-white border-slate-200 shadow-2xs hover:border-indigo-300'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${palette.bg}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <span className={`text-xs font-bold block truncate ${isNitido ? 'text-slate-900' : 'text-white'}`}>
                          {goal.title}
                        </span>
                        <span className={`text-[10px] font-semibold ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
                          Plazo: {goal.deadline}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                        currentPct >= 100
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-indigo-50 text-indigo-800 border-indigo-200'
                      }`}
                    >
                      {currentPct}%
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2.5 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, currentPct)}%`,
                        backgroundColor: palette.stroke,
                      }}
                    />
                  </div>

                  {/* Metrics summary */}
                  <div className="mt-2.5 flex items-center justify-between text-[11px]">
                    <span className={`font-semibold ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
                      Faltan: {currSym}{remainingMoney.toLocaleString()}
                    </span>
                    <span className={`font-black ${isNitido ? 'text-emerald-700' : 'text-emerald-400'}`}>
                      +{currSym}{goal.monthlyContribution}/mes
                    </span>
                  </div>
                </div>

                {/* Milestone estimated date */}
                <div
                  className={`p-2 rounded-xl border flex items-center justify-between text-[11px] ${
                    goal.isAlreadyCompleted
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : goal.willFinishInHorizon
                      ? 'bg-amber-50 border-amber-200 text-amber-900'
                      : isNitido
                      ? 'bg-slate-50 border-slate-200 text-slate-700'
                      : 'bg-slate-800 border-slate-700 text-slate-300'
                  }`}
                >
                  <span className="font-semibold flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    {goal.isAlreadyCompleted
                      ? '¡100% Cumplida!'
                      : goal.willFinishInHorizon
                      ? `Llega al 100% en ${goal.monthsToFinish}m`
                      : `Más de ${horizonMonths} meses`}
                  </span>
                  <span className="font-black">{goal.completionDateStr}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
