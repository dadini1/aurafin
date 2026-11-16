import React, { useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import {
  TrendingUp,
  PieChart as PieIcon,
  BarChart3,
  Calendar,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  Wallet,
} from 'lucide-react';
import { PaymentItem, UserFinancialProfile } from '../types';

interface FinancialChartsPanelProps {
  payments: PaymentItem[];
  profile: UserFinancialProfile;
  onNavigateToRadar?: () => void;
}

export const FinancialChartsPanel: React.FC<FinancialChartsPanelProps> = ({
  payments,
  profile,
  onNavigateToRadar,
}) => {
  const [activeCategoryView, setActiveCategoryView] = useState<'donut' | 'history'>('donut');
  const [timeRange, setTimeRange] = useState<'6m' | '12m'>('6m');

  // Palette colors for categories
  const CATEGORY_COLORS: Record<string, string> = {
    alquiler: '#6366f1', // Indigo
    transporte: '#f59e0b', // Amber
    alimentacion: '#ec4899', // Pink
    servicios: '#06b6d4', // Cyan
    ocio: '#a855f7', // Purple
    salud: '#10b981', // Emerald
    educacion: '#3b82f6', // Blue
    otro: '#64748b', // Slate
  };

  const CATEGORY_LABELS: Record<string, string> = {
    alquiler: 'Vivienda / Alquiler',
    transporte: 'Transporte / Auto',
    alimentacion: 'Alimentación',
    servicios: 'Servicios Básicos',
    ocio: 'Ocio y Salidas',
    salud: 'Salud',
    educacion: 'Educación',
    otro: 'Otros',
  };

  // 1. Current category breakdown calculation from payments
  const categoryTotals: Record<string, number> = {};
  payments
    .filter((p) => p.type === 'gasto')
    .forEach((p) => {
      categoryTotals[p.category] = (categoryTotals[p.category] || 0) + p.amount;
    });

  const categoryPieData = Object.entries(categoryTotals).map(([cat, total]) => ({
    name: CATEGORY_LABELS[cat] || cat,
    key: cat,
    value: total,
    color: CATEGORY_COLORS[cat] || '#94a3b8',
  }));

  const totalCurrentExpenses = Object.values(categoryTotals).reduce((a, b) => a + b, 0);

  // 2. Historical Monthly Progress Data (Last 6 months simulated based on user's current baseline)
  const baseIncome = profile.monthlyIncome || 2400;
  const baseExpenses = totalCurrentExpenses || 1500;
  const baseSavings = Math.max(0, baseIncome - baseExpenses);

  const monthlyHistoryData = [
    {
      month: 'May',
      ingreso: baseIncome * 0.94,
      gastos: baseExpenses * 1.08,
      ahorro: Math.max(0, baseIncome * 0.94 - baseExpenses * 1.08),
      transporte: 340,
      alquiler: 650,
      alimentacion: 360,
      servicios: 120,
      ocio: 180,
    },
    {
      month: 'Jun',
      ingreso: baseIncome * 0.96,
      gastos: baseExpenses * 1.04,
      ahorro: Math.max(0, baseIncome * 0.96 - baseExpenses * 1.04),
      transporte: 330,
      alquiler: 650,
      alimentacion: 350,
      servicios: 110,
      ocio: 160,
    },
    {
      month: 'Jul',
      ingreso: baseIncome * 0.98,
      gastos: baseExpenses * 1.02,
      ahorro: Math.max(0, baseIncome * 0.98 - baseExpenses * 1.02),
      transporte: 310,
      alquiler: 650,
      alimentacion: 330,
      servicios: 115,
      ocio: 190,
    },
    {
      month: 'Ago',
      ingreso: baseIncome,
      gastos: baseExpenses * 0.98,
      ahorro: Math.max(0, baseIncome - baseExpenses * 0.98),
      transporte: 350,
      alquiler: 650,
      alimentacion: 320,
      servicios: 105,
      ocio: 140,
    },
    {
      month: 'Sep',
      ingreso: baseIncome * 1.05,
      gastos: baseExpenses * 0.96,
      ahorro: Math.max(0, baseIncome * 1.05 - baseExpenses * 0.96),
      transporte: 330,
      alquiler: 650,
      alimentacion: 340,
      servicios: 100,
      ocio: 130,
    },
    {
      month: 'Oct',
      ingreso: baseIncome,
      gastos: baseExpenses,
      ahorro: baseSavings,
      transporte: categoryTotals['transporte'] || 320,
      alquiler: categoryTotals['alquiler'] || 650,
      alimentacion: categoryTotals['alimentacion'] || 340,
      servicios: categoryTotals['servicios'] || 93,
      ocio: categoryTotals['ocio'] || 150,
    },
  ];

  // Custom Tooltip for Area Chart
  const CustomAreaTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const rate = data.ingreso > 0 ? Math.round((data.ahorro / data.ingreso) * 100) : 0;
      return (
        <div className="bg-slate-900 border border-slate-700/80 p-3 rounded-xl shadow-2xl text-xs space-y-1.5 backdrop-blur-md">
          <p className="font-bold text-white border-b border-slate-800 pb-1">Mes de {label}</p>
          <div className="flex items-center justify-between gap-4 text-cyan-300">
            <span>Ingreso:</span>
            <span className="font-bold">{profile.currencySymbol}{Math.round(data.ingreso).toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between gap-4 text-rose-300">
            <span>Gastos:</span>
            <span className="font-bold">{profile.currencySymbol}{Math.round(data.gastos).toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between gap-4 text-emerald-300 border-t border-slate-800 pt-1">
            <span>Ahorro Neto:</span>
            <span className="font-bold">{profile.currencySymbol}{Math.round(data.ahorro).toLocaleString()} ({rate}%)</span>
          </div>
        </div>
      );
    }
    return null;
  };

  // Custom Tooltip for Pie & Stacked Bar
  const CustomBarTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 border border-slate-700/80 p-3 rounded-xl shadow-2xl text-xs space-y-1 backdrop-blur-md">
          <p className="font-bold text-white border-b border-slate-800 pb-1">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-3" style={{ color: entry.color }}>
              <span>{entry.name}:</span>
              <span className="font-bold">{profile.currencySymbol}{Number(entry.value).toLocaleString()}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  // Category with highest expense
  const highestCategory = categoryPieData.reduce(
    (max, item) => (item.value > max.value ? item : max),
    categoryPieData[0] || { name: 'N/A', value: 0 }
  );

  return (
    <div className="space-y-5">
      {/* Header of Analytics Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/90 p-5 rounded-3xl border border-slate-800 shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Análisis Gráfico & Progreso de Ahorro
              </h3>
              <p className="text-xs text-slate-400">
                Visualización de tendencias mensuales y desglose de gastos categorizados en {profile.country}.
              </p>
            </div>
          </div>
        </div>

        {/* Quick Trend Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Ahorro +{Math.round((baseSavings / baseIncome) * 100)}% este mes</span>
          </div>

          {categoryTotals['transporte'] >= profile.transportAlertThreshold && onNavigateToRadar && (
            <button
              onClick={onNavigateToRadar}
              className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Transporte Alto: Ver Radar</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Charts Grid: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* CHART 1: Monthly Savings Progress (Area Chart) */}
        <div className="p-5 sm:p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-400 block">
                Evolución de Ahorro Neto
              </span>
              <h4 className="text-sm font-bold text-white mt-0.5">
                Progreso Mensual: Ingresos vs Gastos vs Ahorro
              </h4>
            </div>
            <span className="text-[11px] text-slate-400 bg-slate-800 px-2.5 py-1 rounded-lg">
              Últimos 6 meses
            </span>
          </div>

          {/* Area Chart Container */}
          <div className="w-full h-64 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyHistoryData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorAhorro" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorIngreso" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={(val) => `${profile.currencySymbol}${val}`}
                />
                <Tooltip content={<CustomAreaTooltip />} />
                <Area
                  type="monotone"
                  dataKey="ingreso"
                  name="Ingreso Total"
                  stroke="#0ea5e9"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorIngreso)"
                />
                <Area
                  type="monotone"
                  dataKey="ahorro"
                  name="Ahorro Neto"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorAhorro)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Legend and Metrics Footer */}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800 text-center">
            <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <span className="text-[10px] text-slate-400 block">Promedio Ahorro</span>
              <span className="text-xs sm:text-sm font-bold text-emerald-400">
                {profile.currencySymbol}
                {Math.round(
                  monthlyHistoryData.reduce((s, d) => s + d.ahorro, 0) / monthlyHistoryData.length
                ).toLocaleString()}
                /mes
              </span>
            </div>
            <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <span className="text-[10px] text-slate-400 block">Mes Pico</span>
              <span className="text-xs sm:text-sm font-bold text-cyan-300">
                Septiembre ({profile.currencySymbol}
                {Math.round(monthlyHistoryData[4].ahorro).toLocaleString()})
              </span>
            </div>
            <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <span className="text-[10px] text-slate-400 block">Meta Anual Proyectada</span>
              <span className="text-xs sm:text-sm font-bold text-white">
                {profile.currencySymbol}{(baseSavings * 12).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* CHART 2: Categorized Expenses Breakdown & History */}
        <div className="p-5 sm:p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 block">
                Histórico & Categorización
              </span>
              <h4 className="text-sm font-bold text-white mt-0.5">
                Distribución de Gastos por Categoría
              </h4>
            </div>

            {/* Toggle Donut vs Stacked Bar */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setActiveCategoryView('donut')}
                title="Vista distribución actual"
                className={`p-1.5 rounded-lg text-xs transition-colors ${
                  activeCategoryView === 'donut'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <PieIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => setActiveCategoryView('history')}
                title="Vista histórico mensual apilado"
                className={`p-1.5 rounded-lg text-xs transition-colors ${
                  activeCategoryView === 'history'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* VIEW A: Donut Chart with Legend */}
          {activeCategoryView === 'donut' ? (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 h-64 sm:h-72">
              <div className="w-full sm:w-1/2 h-full relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryPieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={3}
                    >
                      {categoryPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} stroke="#0f172a" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: any) => [`${profile.currencySymbol}${Number(val).toLocaleString()}`, 'Gasto']}
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        borderRadius: '0.75rem',
                        fontSize: '12px',
                        color: '#f8fafc',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Central Donut Readout */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">Total Gastos</span>
                  <span className="text-sm sm:text-base font-extrabold text-white">
                    {profile.currencySymbol}{totalCurrentExpenses.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Category Legend List */}
              <div className="w-full sm:w-1/2 space-y-1.5 overflow-y-auto max-h-56 pr-1 text-xs">
                {categoryPieData.map((item, idx) => {
                  const pct = totalCurrentExpenses > 0 ? Math.round((item.value / totalCurrentExpenses) * 100) : 0;
                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-1.5 rounded-lg bg-slate-950/40 border border-slate-800/60"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                        <span className="text-slate-300 truncate">{item.name}</span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-bold text-white">
                          {profile.currencySymbol}{item.value.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-slate-500 ml-1">({pct}%)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* VIEW B: Stacked Bar Chart across Months */
            <div className="w-full h-64 sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyHistoryData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
                  <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    tickFormatter={(val) => `${profile.currencySymbol}${val}`}
                  />
                  <Tooltip content={<CustomBarTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                    formatter={(val) => <span className="text-slate-300 capitalize">{val}</span>}
                  />
                  <Bar dataKey="alquiler" name="Alquiler" stackId="a" fill={CATEGORY_COLORS.alquiler} />
                  <Bar dataKey="transporte" name="Transporte" stackId="a" fill={CATEGORY_COLORS.transporte} />
                  <Bar dataKey="alimentacion" name="Alimentos" stackId="a" fill={CATEGORY_COLORS.alimentacion} />
                  <Bar dataKey="servicios" name="Servicios" stackId="a" fill={CATEGORY_COLORS.servicios} />
                  <Bar dataKey="ocio" name="Ocio" stackId="a" fill={CATEGORY_COLORS.ocio} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Quick Alert on Largest Expense Category */}
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-400">
              Categoría con mayor consumo:{' '}
              <strong className="text-white">{highestCategory?.name}</strong> ({profile.currencySymbol}
              {highestCategory?.value.toLocaleString()})
            </span>
            {highestCategory?.key === 'transporte' && (
              <span className="text-amber-400 font-semibold text-[11px]">
                ⚠️ Sugerido evaluar auto propio
              </span>
            )}
            {highestCategory?.key === 'alquiler' && (
              <span className="text-indigo-400 font-semibold text-[11px]">
                💡 Evaluar crédito hipotecario
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
