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
  DollarSign,
  Plus,
  Zap,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Layers,
} from 'lucide-react';
import { SavingsGoal, UserFinancialProfile } from '../types';
import { useTheme } from '../context/ThemeContext';

interface CumulativeSavingsProjectionLineChartProps {
  goals: SavingsGoal[];
  profile: UserFinancialProfile;
  totalIncome: number;
  fixedExpenses: number;
  variableExpenses: number;
  netSavings: number;
  onOpenAddGoal?: () => void;
  onOpenVoiceAssistant?: (prompt?: string) => void;
}

export const CumulativeSavingsProjectionLineChart: React.FC<CumulativeSavingsProjectionLineChartProps> = ({
  goals,
  profile,
  totalIncome,
  fixedExpenses,
  variableExpenses,
  netSavings,
  onOpenAddGoal,
  onOpenVoiceAssistant,
}) => {
  const { isNitido, isVibrant } = useTheme();
  const [horizonMonths, setHorizonMonths] = useState<number>(12);
  const [includeInitialCapital, setIncludeInitialCapital] = useState<boolean>(true);

  const currSym = profile.currencySymbol || '$';

  // Base financial calculations
  const effectiveIncome = Math.max(0, totalIncome || profile.monthlyIncome || 0);
  const totalExpenses = Math.max(0, fixedExpenses + variableExpenses);
  const realMonthlySavings = Math.max(0, netSavings); // monthly surplus capacity

  // Goals data
  const goalsMonthlySum = useMemo(() => {
    return goals.reduce((acc, g) => acc + (Number(g.monthlyContribution) || 0), 0);
  }, [goals]);

  const totalGoalsTarget = useMemo(() => {
    return goals.reduce((acc, g) => acc + (Number(g.targetAmount) || 0), 0);
  }, [goals]);

  const initialSavingsCapital = useMemo(() => {
    return goals.reduce((acc, g) => acc + (Number(g.currentAmount) || 0), 0);
  }, [goals]);

  // Suggested 20% savings rule
  const rule20Monthly = Math.round(effectiveIncome * 0.2);

  // Month names generator starting from next month
  const projectionData = useMemo(() => {
    const data = [];
    const currentDate = new Date();
    const baseInitial = includeInitialCapital ? initialSavingsCapital : 0;

    // Track simulated progress of individual goals
    const simulatedGoals = goals.map((g) => ({
      id: g.id,
      title: g.title,
      target: Number(g.targetAmount) || 0,
      current: includeInitialCapital ? Number(g.currentAmount) || 0 : 0,
      monthly: Number(g.monthlyContribution) || 0,
      completedInMonth: null as number | null,
    }));

    for (let m = 1; m <= horizonMonths; m++) {
      // Calculate date for label
      const d = new Date(currentDate.getFullYear(), currentDate.getMonth() + m, 1);
      const monthLabel = d.toLocaleDateString('es-ES', { month: 'short' });
      const yearShort = d.getFullYear().toString().slice(-2);
      const formattedLabel = `${monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)} '${yearShort}`;

      // 1. Real Capacity Projection (actual net savings from income minus expenses)
      const ahorroRealAcumulado = Math.round(baseInitial + m * realMonthlySavings);

      // 2. Goal Programmed Contributions Projection (clamped by individual goal target amounts)
      let metasAcumulado = 0;
      const completedGoalsThisMonth: string[] = [];

      simulatedGoals.forEach((sg) => {
        const previousAmount = sg.current + (m - 1) * sg.monthly;
        const currentAmountWithGrowth = sg.current + m * sg.monthly;
        const clampedAmount = sg.target > 0 ? Math.min(sg.target, currentAmountWithGrowth) : currentAmountWithGrowth;
        metasAcumulado += clampedAmount;

        // Check if goal completed in this specific month
        if (sg.target > 0 && previousAmount < sg.target && currentAmountWithGrowth >= sg.target) {
          if (sg.completedInMonth === null) {
            sg.completedInMonth = m;
            completedGoalsThisMonth.push(sg.title);
          }
        }
      });

      // 3. Recommended 50/30/20 benchmark line (20% of net income)
      const regla20Acumulado = Math.round(baseInitial + m * rule20Monthly);

      data.push({
        monthIndex: m,
        label: formattedLabel,
        fullDateName: d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }),
        ahorroRealAcumulado,
        metasAcumulado: Math.round(metasAcumulado),
        regla20Acumulado,
        completedMilestones: completedGoalsThisMonth,
      });
    }

    return data;
  }, [
    horizonMonths,
    includeInitialCapital,
    initialSavingsCapital,
    realMonthlySavings,
    goals,
    rule20Monthly,
  ]);

  // Final month values for metrics
  const finalMonth = projectionData[projectionData.length - 1] || {
    ahorroRealAcumulado: 0,
    metasAcumulado: 0,
    regla20Acumulado: 0,
  };

  // Goals that will be completed within the selected horizon
  const goalsCompletedWithinHorizon = useMemo(() => {
    return goals.filter((g) => {
      const remaining = Math.max(0, g.targetAmount - (includeInitialCapital ? g.currentAmount : 0));
      if (remaining <= 0) return true;
      if (g.monthlyContribution <= 0) return false;
      const monthsNeeded = Math.ceil(remaining / g.monthlyContribution);
      return monthsNeeded <= horizonMonths;
    });
  }, [goals, horizonMonths, includeInitialCapital]);

  // Custom High-Contrast Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0]?.payload;
    if (!data) return null;

    return (
      <div
        className={`p-4 rounded-2xl shadow-xl border text-xs space-y-2.5 min-w-[260px] ${
          isNitido
            ? 'bg-white border-slate-200 text-slate-900 shadow-slate-300/60'
            : 'bg-slate-900/95 border-slate-700 text-slate-100 shadow-black/60'
        }`}
      >
        <div className="pb-1.5 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
          <span className="font-bold text-sm text-slate-900 dark:text-white capitalize">
            {data.fullDateName}
          </span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
            isNitido ? 'bg-indigo-50 text-indigo-800' : 'bg-slate-800 text-slate-300'
          }`}>
            Mes {data.monthIndex}
          </span>
        </div>

        <div className="space-y-2 pt-0.5">
          {/* Series 1: Ahorro Real */}
          <div className="flex items-center justify-between">
            <span className="text-slate-600 dark:text-slate-300 font-semibold flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 inline-block" />
              Ahorro Real Proyectado:
            </span>
            <strong className={`font-black ${isNitido ? 'text-indigo-900' : 'text-indigo-300'}`}>
              {currSym}{data.ahorroRealAcumulado.toLocaleString()}
            </strong>
          </div>

          {/* Series 2: Metas */}
          <div className="flex items-center justify-between">
            <span className="text-slate-600 dark:text-slate-300 font-semibold flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block" />
              Compromiso en Metas:
            </span>
            <strong className={`font-black ${isNitido ? 'text-emerald-800' : 'text-emerald-300'}`}>
              {currSym}{data.metasAcumulado.toLocaleString()}
            </strong>
          </div>

          {/* Series 3: Regla 20% */}
          <div className="flex items-center justify-between">
            <span className="text-slate-600 dark:text-slate-300 font-semibold flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-600 inline-block" />
              Regla 50/30/20 (20%):
            </span>
            <strong className={`font-bold ${isNitido ? 'text-sky-800' : 'text-sky-300'}`}>
              {currSym}{data.regla20Acumulado.toLocaleString()}
            </strong>
          </div>

          {/* Milestone notice */}
          {data.completedMilestones && data.completedMilestones.length > 0 && (
            <div className={`p-2 rounded-xl border mt-2 flex items-center gap-1.5 text-[11px] ${
              isNitido ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-amber-950/40 border-amber-800/40 text-amber-200'
            }`}>
              <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>
                <strong>¡Meta Cumplida!:</strong> {data.completedMilestones.join(', ')}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      className={`p-5 sm:p-6 rounded-3xl border shadow-sm space-y-6 transition-all ${
        isNitido
          ? 'bg-white border-slate-200 text-slate-900'
          : 'bg-slate-900 border-slate-800 text-white'
      }`}
    >
      {/* Header with Title and Time Horizon Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-slate-200/80 dark:border-slate-800">
        <div className="flex items-start gap-3.5">
          <div
            className={`p-2.5 rounded-2xl shrink-0 border ${
              isNitido
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                : 'bg-indigo-500/15 border-indigo-500/30 text-indigo-400'
            }`}
          >
            <TrendingUp className="w-6 h-6" />
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className={`text-base sm:text-lg font-bold tracking-tight ${isNitido ? 'text-slate-900' : 'text-white'}`}>
                Proyección de Ahorro Acumulado Mensual
              </h3>
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                  isNitido
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                }`}
              >
                Horizonte {horizonMonths} Meses
              </span>
            </div>

            <p className={`text-xs mt-1 leading-relaxed max-w-2xl ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
              Gráfico de líneas Recharts que proyecta el crecimiento patrimonial mensual acumulado cruzando tu{' '}
              <strong>ingreso mensual neto ({currSym}{effectiveIncome.toLocaleString()})</strong>, tu{' '}
              <strong>ahorro real ({currSym}{realMonthlySavings.toLocaleString()}/mes)</strong> y tus{' '}
              <strong>{goals.length} metas de ahorro programadas</strong>.
            </p>
          </div>
        </div>

        {/* Horizon Selector and Capital Toggle */}
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* Horizon Pills */}
          <div className={`p-1 rounded-2xl border flex items-center gap-1 ${
            isNitido ? 'bg-slate-100 border-slate-200' : 'bg-slate-950 border-slate-800'
          }`}>
            {[
              { m: 6, label: '6M' },
              { m: 12, label: '12M (1 Año)' },
              { m: 24, label: '24M (2 Años)' },
              { m: 36, label: '36M (3 Años)' },
            ].map(({ m, label }) => (
              <button
                key={m}
                type="button"
                onClick={() => setHorizonMonths(m)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  horizonMonths === m
                    ? isNitido
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-indigo-600 text-white shadow-sm'
                    : isNitido
                    ? 'text-slate-600 hover:text-slate-900'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {onOpenAddGoal && (
            <button
              onClick={onOpenAddGoal}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs ${
                isNitido
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Añadir Meta</span>
            </button>
          )}
        </div>
      </div>

      {/* 4 KPI Summary Cards for Fast Insights */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* KPI 1: Ingreso Neto y Capacidad */}
        <div
          className={`p-4 rounded-2xl border flex flex-col justify-between shadow-xs ${
            isNitido ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/60 border-slate-800'
          }`}
        >
          <span className={`text-[11px] font-bold uppercase tracking-wider ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
            Ingreso Neto Disponible
          </span>
          <div className="my-1.5">
            <span className={`text-xl sm:text-2xl font-black ${isNitido ? 'text-slate-900' : 'text-white'}`}>
              {currSym}{effectiveIncome.toLocaleString()}
            </span>
            <span className={`text-[11px] block mt-0.5 ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
              Gastos Totales: {currSym}{totalExpenses.toLocaleString()}
            </span>
          </div>
          <span className={`text-[10px] ${isNitido ? 'text-slate-500' : 'text-slate-500'}`}>
            Base de solvencia mensual
          </span>
        </div>

        {/* KPI 2: Capacidad Real Mensual de Ahorro */}
        <div
          className={`p-4 rounded-2xl border flex flex-col justify-between shadow-xs ${
            isNitido ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/60 border-slate-800'
          }`}
        >
          <span className={`text-[11px] font-bold uppercase tracking-wider ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
            Capacidad Real Mensual
          </span>
          <div className="my-1.5">
            <span className={`text-xl sm:text-2xl font-black ${
              isNitido ? 'text-indigo-800' : 'text-indigo-400'
            }`}>
              {currSym}{realMonthlySavings.toLocaleString()}
            </span>
            <span className={`text-[11px] block mt-0.5 font-semibold ${
              isNitido ? 'text-indigo-700' : 'text-indigo-300'
            }`}>
              {effectiveIncome > 0 ? `${Math.round((realMonthlySavings / effectiveIncome) * 100)}%` : '0%'} de tu ingreso
            </span>
          </div>
          <span className={`text-[10px] ${isNitido ? 'text-slate-500' : 'text-slate-500'}`}>
            Excedente mensual tras gastos
          </span>
        </div>

        {/* KPI 3: Compromiso en Metas */}
        <div
          className={`p-4 rounded-2xl border flex flex-col justify-between shadow-xs ${
            isNitido ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/60 border-slate-800'
          }`}
        >
          <span className={`text-[11px] font-bold uppercase tracking-wider ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
            Cuota Mensual en Metas
          </span>
          <div className="my-1.5">
            <span className={`text-xl sm:text-2xl font-black ${
              isNitido ? 'text-emerald-800' : 'text-emerald-400'
            }`}>
              {currSym}{goalsMonthlySum.toLocaleString()}
            </span>
            <span className={`text-[11px] block mt-0.5 ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
              {goals.length} meta{goals.length === 1 ? '' : 's'} activas ({currSym}{initialSavingsCapital.toLocaleString()} acumulados)
            </span>
          </div>
          <span className={`text-[10px] ${isNitido ? 'text-slate-500' : 'text-slate-500'}`}>
            Compromiso mensual programado
          </span>
        </div>

        {/* KPI 4: Ahorro Acumulado Final Proyectado */}
        <div
          className={`p-4 rounded-2xl border flex flex-col justify-between shadow-xs ${
            isNitido ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/60 border-slate-800'
          }`}
        >
          <span className={`text-[11px] font-bold uppercase tracking-wider ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
            Ahorro Proyectado ({horizonMonths}M)
          </span>
          <div className="my-1.5">
            <span className={`text-xl sm:text-2xl font-black ${
              isNitido ? 'text-slate-900' : 'text-white'
            }`}>
              {currSym}{finalMonth.ahorroRealAcumulado.toLocaleString()}
            </span>
            <span className={`text-[11px] block mt-0.5 font-bold ${
              isNitido ? 'text-emerald-700' : 'text-emerald-400'
            }`}>
              {goalsCompletedWithinHorizon.length} de {goals.length} meta(s) lograda(s)
            </span>
          </div>
          <span className={`text-[10px] ${isNitido ? 'text-slate-500' : 'text-slate-500'}`}>
            Capital total acumulado en {horizonMonths} meses
          </span>
        </div>
      </div>

      {/* Recharts Line Chart Container */}
      <div
        className={`p-3 sm:p-5 rounded-2xl border space-y-3 ${
          isNitido ? 'bg-slate-50/50 border-slate-200' : 'bg-slate-950/70 border-slate-800'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold ${isNitido ? 'text-slate-800' : 'text-white'}`}>
              Evolución Mensual Acumulada
            </span>
            <span className={`text-[11px] ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
              (Mes 1 a Mes {horizonMonths})
            </span>
          </div>

          <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeInitialCapital}
              onChange={(e) => setIncludeInitialCapital(e.target.checked)}
              className="rounded accent-indigo-600 cursor-pointer"
            />
            <span className={isNitido ? 'text-slate-700 font-medium' : 'text-slate-300'}>
              Incluir capital inicial actual ({currSym}{initialSavingsCapital.toLocaleString()})
            </span>
          </label>
        </div>

        <div className="h-72 sm:h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={projectionData}
              margin={{ top: 20, right: 20, left: 10, bottom: 25 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke={isNitido ? '#e2e8f0' : '#1e293b'}
              />

              <XAxis
                dataKey="label"
                axisLine={{ stroke: isNitido ? '#cbd5e1' : '#334155' }}
                tickLine={false}
                tick={{
                  fill: isNitido ? '#334155' : '#94a3b8',
                  fontSize: 11,
                  fontWeight: 600,
                }}
                interval={horizonMonths > 12 ? 1 : 0}
                angle={-20}
                textAnchor="end"
                height={40}
              />

              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{
                  fill: isNitido ? '#475569' : '#94a3b8',
                  fontSize: 10,
                  fontWeight: 600,
                }}
                tickFormatter={(val) => `${currSym}${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
              />

              <Tooltip content={<CustomTooltip />} />

              <Legend
                verticalAlign="top"
                align="right"
                wrapperStyle={{ paddingBottom: 15, fontSize: 11, fontWeight: 700 }}
                formatter={(value) => {
                  if (value === 'ahorroRealAcumulado') return 'Ahorro Real (Capacidad Neta)';
                  if (value === 'metasAcumulado') return 'Compromiso en Metas';
                  if (value === 'regla20Acumulado') return 'Regla 50/30/20 (20% Ingreso)';
                  return value;
                }}
              />

              {/* Target benchmark reference line for total active goals */}
              {totalGoalsTarget > 0 && (
                <ReferenceLine
                  y={totalGoalsTarget}
                  stroke={isNitido ? '#f59e0b' : '#fbbf24'}
                  strokeDasharray="4 4"
                  label={{
                    value: `Meta Total Objetivos: ${currSym}${totalGoalsTarget.toLocaleString()}`,
                    position: 'insideTopRight',
                    fill: isNitido ? '#92400e' : '#fbbf24',
                    fontSize: 10,
                    fontWeight: 700,
                  }}
                />
              )}

              {/* Line 1: Ahorro Real Acumulado (Solid Indigo) */}
              <Line
                type="monotone"
                dataKey="ahorroRealAcumulado"
                name="ahorroRealAcumulado"
                stroke={isNitido ? '#4f46e5' : '#818cf8'}
                strokeWidth={3}
                dot={{
                  r: 3,
                  fill: isNitido ? '#4f46e5' : '#818cf8',
                  strokeWidth: 1,
                  stroke: '#ffffff',
                }}
                activeDot={{ r: 6 }}
              />

              {/* Line 2: Metas Acumulado (Solid Emerald) */}
              <Line
                type="monotone"
                dataKey="metasAcumulado"
                name="metasAcumulado"
                stroke={isNitido ? '#059669' : '#34d399'}
                strokeWidth={3}
                dot={{
                  r: 3,
                  fill: isNitido ? '#059669' : '#34d399',
                  strokeWidth: 1,
                  stroke: '#ffffff',
                }}
                activeDot={{ r: 6 }}
              />

              {/* Line 3: Regla 50/30/20 benchmark (Dashed Sky) */}
              <Line
                type="monotone"
                dataKey="regla20Acumulado"
                name="regla20Acumulado"
                stroke={isNitido ? '#0284c7' : '#38bdf8'}
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Milestone Completion Badges Ribbon */}
        {goalsCompletedWithinHorizon.length > 0 && (
          <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800">
            <span className={`text-[11px] font-bold block mb-2 ${isNitido ? 'text-slate-700' : 'text-slate-300'}`}>
              Metas que alcanzarás en los próximos {horizonMonths} meses con tu ritmo actual:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {goalsCompletedWithinHorizon.map((goal) => {
                const remaining = Math.max(0, goal.targetAmount - (includeInitialCapital ? goal.currentAmount : 0));
                const monthsToGoal = goal.monthlyContribution > 0 ? Math.ceil(remaining / goal.monthlyContribution) : 0;

                return (
                  <div
                    key={goal.id}
                    className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 ${
                      isNitido
                        ? 'bg-white border-slate-200 shadow-2xs'
                        : 'bg-slate-900 border-slate-800'
                    }`}
                  >
                    <div className="min-w-0">
                      <span className={`text-xs font-bold block truncate ${isNitido ? 'text-slate-900' : 'text-white'}`}>
                        {goal.title}
                      </span>
                      <span className={`text-[10px] block ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
                        Objetivo: {currSym}{goal.targetAmount.toLocaleString()}
                      </span>
                    </div>

                    <div className="text-right shrink-0">
                      <span className={`text-[11px] font-extrabold px-2 py-0.5 rounded-full border ${
                        monthsToGoal <= 3
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : 'bg-indigo-100 text-indigo-800 border-indigo-300'
                      }`}>
                        {monthsToGoal <= 0 ? '¡Alcanzada!' : `Mes ${monthsToGoal}`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
