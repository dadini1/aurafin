import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import {
  TrendingUp,
  Sparkles,
  Calendar,
  Layers,
  ArrowUpRight,
  ShieldCheck,
  Flame,
  CheckCircle2,
  ChevronRight,
  Info,
} from 'lucide-react';
import { PaymentItem, UserFinancialProfile, SavingsGoal, SixMonthSavingsStrategy } from '../types';
import { generateSavingsStrategy } from '../services/savingsStrategyService';
import { useTheme } from '../context/ThemeContext';

interface SixMonthSavingsProjectionChartProps {
  payments: PaymentItem[];
  profile: UserFinancialProfile;
  goals?: SavingsGoal[];
  categoryBudgets: Record<string, number>;
  onOpenSavingsStrategyModal?: () => void;
}

export const SixMonthSavingsProjectionChart: React.FC<SixMonthSavingsProjectionChartProps> = ({
  payments,
  profile,
  goals = [],
  categoryBudgets,
  onOpenSavingsStrategyModal,
}) => {
  const { isVibrant } = useTheme();
  const [chartType, setChartType] = useState<'accumulated' | 'monthly'>('accumulated');
  const [selectedMonthIdx, setSelectedMonthIdx] = useState<number | null>(null);

  const currSym = profile.currencySymbol || '$';

  // Compute 6-month savings strategy based on payments history and historical averages
  const strategy: SixMonthSavingsStrategy = useMemo(() => {
    return generateSavingsStrategy(payments, categoryBudgets, profile, goals);
  }, [payments, categoryBudgets, profile, goals]);

  // Transform strategy timeline into recharts data series
  const chartData = useMemo(() => {
    let baselineCumulative = 0;
    return strategy.sixMonthTimeline.map((item, index) => {
      baselineCumulative += strategy.baselineMonthlySavings;
      const extraCutMonthly = item.activeCutsTotal;
      const extraCumulative = item.cumulativeSavings - baselineCumulative;

      return {
        monthIndex: item.monthIndex,
        label: `M${item.monthIndex}`,
        fullName: item.monthName,
        milestoneTitle: item.milestoneTitle,
        focusRecommendation: item.focusRecommendation,
        // Monthly breakdown
        baseMonthly: strategy.baselineMonthlySavings,
        cutsGainMonthly: extraCutMonthly,
        totalMonthly: item.projectedMonthlySavings,
        // Cumulative growth
        cumulativeBaseline: baselineCumulative,
        cumulativeOptimized: item.cumulativeSavings,
        extraSavingsCumulative: Math.max(0, extraCumulative),
      };
    });
  }, [strategy]);

  // Cumulative surplus achieved in 6 months thanks to category cuts
  const totalExtraSixMonths = useMemo(() => {
    if (chartData.length === 0) return 0;
    const last = chartData[chartData.length - 1];
    return Math.max(0, last.cumulativeOptimized - last.cumulativeBaseline);
  }, [chartData]);

  const activeMilestone = useMemo(() => {
    if (selectedMonthIdx !== null && chartData[selectedMonthIdx]) {
      return chartData[selectedMonthIdx];
    }
    // Default to the last month (Month 6 milestone)
    return chartData[chartData.length - 1];
  }, [selectedMonthIdx, chartData]);

  // Custom Tooltip component
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0].payload;

    return (
      <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700/80 p-3.5 rounded-2xl shadow-2xl text-xs space-y-2 z-50 min-w-[220px]">
        <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
          <span className="font-bold text-white text-sm">{data.fullName}</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
            Fase {data.monthIndex}
          </span>
        </div>

        {chartType === 'accumulated' ? (
          <div className="space-y-1.5 pt-0.5">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Con Estrategia (Recortes):</span>
              <span className="font-extrabold text-emerald-400 text-sm">
                {currSym}{data.cumulativeOptimized.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Sin Optimización (Base):</span>
              <span className="font-medium text-slate-300">
                {currSym}{data.cumulativeBaseline.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[11px]">
              <span className="text-cyan-400 font-semibold">Excedente Ganado:</span>
              <span className="font-bold text-cyan-300">
                +{currSym}{data.extraSavingsCumulative.toLocaleString()}
              </span>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5 pt-0.5">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Ahorro Mensual Total:</span>
              <span className="font-extrabold text-emerald-400 text-sm">
                {currSym}{data.totalMonthly.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Ahorro Base:</span>
              <span className="font-medium text-slate-300">
                {currSym}{data.baseMonthly.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-cyan-400">Recortes Aplicados:</span>
              <span className="font-bold text-cyan-300">
                +{currSym}{data.cutsGainMonthly}/mes
              </span>
            </div>
          </div>
        )}

        <div className="pt-1.5 border-t border-slate-800 text-[11px] text-slate-300">
          <span className="font-bold text-slate-200 block">{data.milestoneTitle}</span>
          <span className="text-slate-400 line-clamp-2 mt-0.5">{data.focusRecommendation}</span>
        </div>
      </div>
    );
  };

  return (
    <div className={`p-6 rounded-3xl transition-all duration-300 ${
      isVibrant
        ? 'bg-[#080d26] border border-cyan-500/30 shadow-[0_0_30px_rgba(0,210,255,0.08)]'
        : 'bg-slate-900 border border-slate-800 shadow-xl'
    } space-y-6`}>
      {/* Header and Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl ${
              isVibrant
                ? 'bg-gradient-to-tr from-cyan-500/25 to-fuchsia-500/25 text-cyan-200 border border-cyan-400/40 shadow-[0_0_12px_rgba(0,240,255,0.3)]'
                : 'bg-gradient-to-tr from-cyan-500/20 to-emerald-500/20 text-cyan-300 border border-cyan-500/30'
            }`}>
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Proyección de Crecimiento de Ahorro a 6 Meses
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                  isVibrant
                    ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-500/40 shadow-[0_0_8px_rgba(0,240,255,0.25)]'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                }`}>
                  generateSavingsStrategy
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Modelado proyectado aplicando recortes en las categorías que exceden su promedio histórico.
              </p>
            </div>
          </div>
        </div>

        {/* View Mode & Action Toggle */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setChartType('accumulated')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                chartType === 'accumulated'
                  ? 'bg-gradient-to-r from-cyan-500 to-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Patrimonio Acumulado</span>
            </button>
            <button
              type="button"
              onClick={() => setChartType('monthly')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                chartType === 'monthly'
                  ? 'bg-gradient-to-r from-cyan-500 to-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Aporte Mensual</span>
            </button>
          </div>

          {onOpenSavingsStrategyModal && (
            <button
              onClick={onOpenSavingsStrategyModal}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-cyan-300 border border-slate-700 text-xs font-semibold transition-colors"
              title="Abrir desglose completo y aplicar recortes a presupuestos"
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>Ver Plan Detallado</span>
            </button>
          )}
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Capital Proyectado (Mes 6)
          </span>
          <div className="text-xl sm:text-2xl font-black text-white mt-0.5">
            {currSym}{strategy.totalSixMonthProjectedSavings.toLocaleString()}
          </div>
          <span className="text-[11px] text-emerald-400 font-semibold mt-0.5 flex items-center gap-1">
            <ArrowUpRight className="w-3 h-3" /> Con recortes activos
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Ganancia Extra por Recortes
          </span>
          <div className="text-xl sm:text-2xl font-black text-cyan-300 mt-0.5">
            +{currSym}{Math.round(totalExtraSixMonths).toLocaleString()}
          </div>
          <span className="text-[11px] text-cyan-400 font-semibold mt-0.5">
            +{currSym}{strategy.totalMonthlyCutPotential}/mes ahorrados
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Tasa de Ahorro
          </span>
          <div className="text-xl sm:text-2xl font-black text-emerald-400 mt-0.5 flex items-baseline gap-1.5">
            <span>{strategy.optimizedSavingsRate}%</span>
            <span className="text-xs font-semibold text-slate-400 line-through">
              {strategy.currentSavingsRate}%
            </span>
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5">
            +{strategy.optimizedSavingsRate - strategy.currentSavingsRate}% de optimización
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Categorías Excedidas
          </span>
          <div className="text-xl sm:text-2xl font-black text-amber-400 mt-0.5">
            {strategy.exceededCategories.length} con sobregasto
          </div>
          <span className="text-[11px] text-amber-400/80 mt-0.5">
            Superan su promedio histórico
          </span>
        </div>
      </div>

      {/* Main Recharts Graphic Container */}
      <div className="h-72 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'accumulated' ? (
            <AreaChart data={chartData} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="colorOptimized" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={isVibrant ? '#00f0ff' : '#10b981'} stopOpacity={isVibrant ? 0.6 : 0.45} />
                  <stop offset="95%" stopColor={isVibrant ? '#00f0ff' : '#10b981'} stopOpacity={isVibrant ? 0.04 : 0.02} />
                </linearGradient>
                <linearGradient id="colorBaseline" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={isVibrant ? '#d946ef' : '#6366f1'} stopOpacity={isVibrant ? 0.4 : 0.3} />
                  <stop offset="95%" stopColor={isVibrant ? '#d946ef' : '#6366f1'} stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={isVibrant ? '#1e293b' : '#334155'} opacity={0.6} vertical={false} />
              <XAxis
                dataKey="fullName"
                stroke={isVibrant ? '#cbd5e1' : '#94a3b8'}
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: isVibrant ? '#334155' : '#334155' }}
              />
              <YAxis
                stroke={isVibrant ? '#cbd5e1' : '#94a3b8'}
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${currSym}${value}`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="top"
                align="right"
                wrapperStyle={{ paddingBottom: '12px', fontSize: '11px' }}
                formatter={(val) => (
                  <span className="text-slate-200 font-bold">{val}</span>
                )}
              />
              <Area
                type="monotone"
                dataKey="cumulativeOptimized"
                name="Ahorro con Estrategia (Recortes)"
                stroke={isVibrant ? '#00f0ff' : '#10b981'}
                strokeWidth={isVibrant ? 3.5 : 3}
                fillOpacity={1}
                fill="url(#colorOptimized)"
                activeDot={{
                  r: 7,
                  stroke: isVibrant ? '#ffffff' : '#34d399',
                  strokeWidth: 2,
                  fill: isVibrant ? '#00f0ff' : '#10b981',
                }}
              />
              <Area
                type="monotone"
                dataKey="cumulativeBaseline"
                name="Ahorro Base Sin Recortes"
                stroke={isVibrant ? '#d946ef' : '#6366f1'}
                strokeWidth={2.5}
                strokeDasharray="4 4"
                fillOpacity={1}
                fill="url(#colorBaseline)"
                activeDot={{
                  r: 5,
                  stroke: isVibrant ? '#f5d0fe' : '#a5b4fc',
                  strokeWidth: 1.5,
                  fill: isVibrant ? '#d946ef' : '#6366f1',
                }}
              />
            </AreaChart>
          ) : (
            <BarChart data={chartData} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={isVibrant ? '#1e293b' : '#334155'} opacity={0.6} vertical={false} />
              <XAxis
                dataKey="fullName"
                stroke={isVibrant ? '#cbd5e1' : '#94a3b8'}
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#334155' }}
              />
              <YAxis
                stroke={isVibrant ? '#cbd5e1' : '#94a3b8'}
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${currSym}${value}`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="top"
                align="right"
                wrapperStyle={{ paddingBottom: '12px', fontSize: '11px' }}
                formatter={(val) => (
                  <span className="text-slate-200 font-bold">{val}</span>
                )}
              />
              <Bar
                dataKey="baseMonthly"
                name="Ahorro Base"
                stackId="monthly"
                fill={isVibrant ? '#d946ef' : '#6366f1'}
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="cutsGainMonthly"
                name="Recortes de Excesos"
                stackId="monthly"
                fill={isVibrant ? '#00f0ff' : '#06b6d4'}
                radius={[6, 6, 0, 0]}
              />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Interactive Month-by-Month Milestone Navigator */}
      <div className="space-y-3 pt-2 border-t border-slate-800">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-cyan-400" />
            Hitos y Recomendaciones por Mes:
          </span>
          <span className="text-[11px] text-slate-400">
            Haz clic en un mes para ver su fase táctica
          </span>
        </div>

        {/* Buttons strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {chartData.map((m, idx) => {
            const isSelected = (selectedMonthIdx === null && idx === 5) || selectedMonthIdx === idx;
            return (
              <button
                key={m.monthIndex}
                type="button"
                onClick={() => setSelectedMonthIdx(idx)}
                className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'bg-cyan-950/60 border-cyan-500 shadow-md ring-1 ring-cyan-500/30'
                    : 'bg-slate-950/60 border-slate-800 hover:bg-slate-800/60 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className={`text-[11px] font-black ${isSelected ? 'text-cyan-300' : 'text-slate-400'}`}>
                    Mes {m.monthIndex}
                  </span>
                  <span className="text-[10px] text-emerald-400 font-bold">
                    +{currSym}{m.cutsGainMonthly}
                  </span>
                </div>
                <div className="mt-1">
                  <div className="text-xs font-bold text-white truncate">
                    {currSym}{m.cumulativeOptimized.toLocaleString()}
                  </div>
                  <span className="text-[10px] text-slate-400 truncate block">
                    {m.fullName.split(' ')[0]}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Milestone Detail Banner */}
        {activeMilestone && (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-cyan-950/40 via-slate-900 to-indigo-950/40 border border-cyan-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-inner animate-fadeIn">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-cyan-500/20 text-cyan-300 flex items-center justify-center text-xs font-black">
                  M{activeMilestone.monthIndex}
                </span>
                <h4 className="text-sm font-bold text-white">
                  {activeMilestone.fullName} · {activeMilestone.milestoneTitle}
                </h4>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
                {activeMilestone.focusRecommendation}
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Ahorro Acumulado
                </span>
                <span className="text-base font-extrabold text-emerald-400">
                  {currSym}{activeMilestone.cumulativeOptimized.toLocaleString()}
                </span>
              </div>

              {onOpenSavingsStrategyModal && (
                <button
                  type="button"
                  onClick={onOpenSavingsStrategyModal}
                  className="p-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold transition-all shadow-md"
                  title="Ver recortes específicos"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
