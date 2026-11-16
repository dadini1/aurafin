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
  Cell,
  ReferenceLine,
} from 'recharts';
import {
  BarChart3,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  Sliders,
  Sparkles,
  ArrowUpDown,
  Filter,
  DollarSign,
  Car,
  Home,
  ShoppingBag,
  Zap,
  Coffee,
  HeartPulse,
  BookOpen,
  ArrowRight,
  Flame,
  ShieldCheck,
  Layers,
} from 'lucide-react';
import { PaymentItem, UserFinancialProfile } from '../types';
import { useTheme } from '../context/ThemeContext';

interface CategoryBudgetComparisonChartProps {
  payments: PaymentItem[];
  categoryBudgets: Record<string, number>;
  profile: UserFinancialProfile;
  alertThresholds?: Record<string, number>;
  globalAlertThreshold?: number;
  onOpenOptimizer?: () => void;
  onOpenAutocomplete?: () => void;
}

export const CATEGORY_INFO: Record<string, { label: string; icon: any; color: string }> = {
  transporte: { label: 'Transporte', icon: Car, color: '#f59e0b' },
  alquiler: { label: 'Vivienda', icon: Home, color: '#6366f1' },
  alimentacion: { label: 'Alimentación', icon: ShoppingBag, color: '#f43f5e' },
  servicios: { label: 'Servicios', icon: Zap, color: '#06b6d4' },
  ocio: { label: 'Ocio', icon: Coffee, color: '#a855f7' },
  salud: { label: 'Salud', icon: HeartPulse, color: '#10b981' },
  educacion: { label: 'Educación', icon: BookOpen, color: '#3b82f6' },
  otro: { label: 'Otros', icon: DollarSign, color: '#64748b' },
};

export const CategoryBudgetComparisonChart: React.FC<CategoryBudgetComparisonChartProps> = ({
  payments,
  categoryBudgets,
  profile,
  alertThresholds,
  globalAlertThreshold,
  onOpenOptimizer,
  onOpenAutocomplete,
}) => {
  const { isNitido, isVibrant } = useTheme();
  const [filterMode, setFilterMode] = useState<'all' | 'active' | 'only_exceeded' | 'warning'>('all');
  const [chartMode, setChartMode] = useState<'comparison' | 'excess_focus'>('comparison');
  const [sortBy, setSortBy] = useState<'spent' | 'excess' | 'budget' | 'ratio' | 'default'>('spent');

  const currSym = profile.currencySymbol || '$';

  // Calculate actual spending per category from current payments of type 'gasto'
  const spendingByCategory = useMemo(() => {
    const acc: Record<string, number> = {};
    payments
      .filter((p) => p.type === 'gasto')
      .forEach((p) => {
        acc[p.category] = (acc[p.category] || 0) + Number(p.amount || 0);
      });
    return acc;
  }, [payments]);

  // Build the dataset for all categories with explicit excess calculations
  const fullChartData = useMemo(() => {
    return Object.keys(CATEGORY_INFO).map((catKey) => {
      const meta = CATEGORY_INFO[catKey];
      const gastoReal = Math.round(spendingByCategory[catKey] || 0);
      const presupuesto = Math.round(categoryBudgets[catKey] || 100);
      const ratio = presupuesto > 0 ? (gastoReal / presupuesto) * 100 : 0;
      const diferencia = presupuesto - gastoReal; // positive = remaining margin, negative = excess
      const catThreshold = alertThresholds?.[catKey] || globalAlertThreshold || 80;
      const isExceeded = gastoReal > presupuesto;
      const isWarning = !isExceeded && ratio >= catThreshold;

      // Excess specifics
      const excesoMonto = Math.max(0, gastoReal - presupuesto);
      const dentroPresupuesto = Math.min(gastoReal, presupuesto);
      const margenRestante = Math.max(0, presupuesto - gastoReal);
      const porcentajeExceso = presupuesto > 0 ? Math.max(0, Math.round(((gastoReal - presupuesto) / presupuesto) * 100)) : 0;

      return {
        key: catKey,
        name: meta.label,
        fullName: meta.label,
        IconComponent: meta.icon,
        gastoReal,
        presupuesto,
        diferencia,
        excesoMonto,
        dentroPresupuesto,
        margenRestante,
        porcentajeExceso,
        ratio: Math.round(ratio),
        threshold: catThreshold,
        isExceeded,
        isWarning,
        color: meta.color,
      };
    });
  }, [spendingByCategory, categoryBudgets, alertThresholds, globalAlertThreshold]);

  // Aggregate metrics
  const totals = useMemo(() => {
    const totalBudget = fullChartData.reduce((sum, item) => sum + item.presupuesto, 0);
    const totalSpent = fullChartData.reduce((sum, item) => sum + item.gastoReal, 0);
    const totalExcess = fullChartData.reduce((sum, item) => sum + item.excesoMonto, 0);
    const totalMargin = Math.max(0, totalBudget - totalSpent);
    const exceededList = fullChartData.filter((item) => item.isExceeded);
    const warningList = fullChartData.filter((item) => item.isWarning);

    return {
      totalBudget,
      totalSpent,
      totalExcess,
      totalMargin,
      exceededCount: exceededList.length,
      warningCount: warningList.length,
      exceededList,
    };
  }, [fullChartData]);

  // Apply filters and sorting
  const processedData = useMemo(() => {
    let result = [...fullChartData];

    // Filter
    if (filterMode === 'active') {
      result = result.filter((item) => item.gastoReal > 0);
    } else if (filterMode === 'only_exceeded') {
      result = result.filter((item) => item.isExceeded);
    } else if (filterMode === 'warning') {
      result = result.filter((item) => item.isExceeded || item.isWarning);
    }

    // Sort
    if (sortBy === 'spent') {
      result.sort((a, b) => b.gastoReal - a.gastoReal);
    } else if (sortBy === 'excess') {
      result.sort((a, b) => b.excesoMonto - a.excesoMonto);
    } else if (sortBy === 'budget') {
      result.sort((a, b) => b.presupuesto - a.presupuesto);
    } else if (sortBy === 'ratio') {
      result.sort((a, b) => b.ratio - a.ratio);
    }

    return result;
  }, [fullChartData, filterMode, sortBy]);

  // Custom Recharts Tooltip focused on spending excesses
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0]?.payload;
    if (!data) return null;

    const isExceeded = data.isExceeded;

    return (
      <div
        className={`p-4 rounded-2xl shadow-xl border text-xs space-y-2.5 min-w-[240px] transition-all ${
          isNitido
            ? 'bg-white border-slate-200 text-slate-900 shadow-slate-300/60'
            : 'bg-slate-900/95 border-slate-700 text-slate-100 shadow-black/70'
        }`}
      >
        <div className="flex items-center justify-between pb-2 border-b border-slate-200/80 dark:border-slate-800">
          <span className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
            {data.fullName}
          </span>
          <span
            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
              isExceeded
                ? 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse'
                : data.isWarning
                ? 'bg-amber-100 text-amber-800 border-amber-300'
                : 'bg-emerald-100 text-emerald-800 border-emerald-300'
            }`}
          >
            {isExceeded ? `¡Exceso del ${data.porcentajeExceso}%!` : `${data.ratio}% consumido`}
          </span>
        </div>

        <div className="space-y-1.5 pt-0.5">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-medium flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-sm inline-block ${isExceeded ? 'bg-rose-600' : 'bg-indigo-600'}`} />
              Gasto Real:
            </span>
            <strong className={`font-black ${isExceeded ? 'text-rose-700' : 'text-slate-900 dark:text-white'}`}>
              {currSym}{data.gastoReal.toLocaleString()}
            </strong>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-medium flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-slate-400 inline-block" />
              Presupuesto Mensual:
            </span>
            <strong className="font-bold text-slate-700 dark:text-slate-300">
              {currSym}{data.presupuesto.toLocaleString()}
            </strong>
          </div>

          {isExceeded ? (
            <div className="p-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 flex items-center justify-between font-bold mt-1">
              <span className="flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                Monto Excedido:
              </span>
              <span className="font-black text-rose-800">
                +{currSym}{data.excesoMonto.toLocaleString()}
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800 text-[11px]">
              <span className="text-slate-500 font-medium">Margen Restante:</span>
              <span className="font-extrabold text-emerald-700">
                +{currSym}{data.margenRestante.toLocaleString()}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      className={`p-5 sm:p-6 rounded-3xl border shadow-sm space-y-5 transition-all ${
        isNitido
          ? 'bg-white border-slate-200 text-slate-900'
          : 'bg-slate-900 border-slate-800 text-white'
      }`}
    >
      {/* Header with Title and Mode Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-slate-200/80 dark:border-slate-800">
        <div className="flex items-start gap-3.5">
          <div
            className={`p-2.5 rounded-2xl shrink-0 border ${
              totals.exceededCount > 0
                ? isNitido
                  ? 'bg-rose-50 border-rose-200 text-rose-700'
                  : 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                : isNitido
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                : 'bg-indigo-500/15 border-indigo-500/30 text-indigo-400'
            }`}
          >
            {totals.exceededCount > 0 ? (
              <AlertOctagon className="w-6 h-6 animate-pulse" />
            ) : (
              <BarChart3 className="w-6 h-6" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className={`text-base sm:text-lg font-bold tracking-tight ${isNitido ? 'text-slate-900' : 'text-white'}`}>
                Comparativa de Gastos vs Presupuesto Mensual
              </h3>
              <span
                className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${
                  totals.exceededCount > 0
                    ? isNitido
                      ? 'bg-rose-100 text-rose-900 border-rose-300'
                      : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                    : isNitido
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                }`}
              >
                {totals.exceededCount > 0
                  ? `🚨 ${totals.exceededCount} exceso(s) detectado(s)`
                  : '✓ Sin excesos de gasto'}
              </span>
            </div>

            <p className={`text-xs mt-1 leading-relaxed max-w-2xl ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
              Gráfico de barras interactivo con Recharts que identifica visualmente los excesos de gasto por categoría frente al límite mensual configurado en {profile.country}.
            </p>
          </div>
        </div>

        {/* View Mode Toggle & Fast Optimizers */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          {/* Mode Switcher */}
          <div className={`p-1 rounded-2xl border flex items-center gap-1 ${
            isNitido ? 'bg-slate-100 border-slate-200' : 'bg-slate-950 border-slate-800'
          }`}>
            <button
              type="button"
              onClick={() => setChartMode('comparison')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                chartMode === 'comparison'
                  ? isNitido
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-indigo-600 text-white shadow-sm'
                  : isNitido
                  ? 'text-slate-600 hover:text-slate-900'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Comparativa Completa
            </button>
            <button
              type="button"
              onClick={() => setChartMode('excess_focus')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                chartMode === 'excess_focus'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : isNitido
                  ? 'text-slate-600 hover:text-slate-900'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Foco en Excesos
            </button>
          </div>

          {onOpenOptimizer && (
            <button
              onClick={onOpenOptimizer}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs ${
                isNitido
                  ? 'bg-teal-600 hover:bg-teal-700 text-white'
                  : 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
              }`}
              title="Optimizar límites de gasto con IA"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Optimizar</span>
            </button>
          )}
        </div>
      </div>

      {/* 4 Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Presupuesto Total */}
        <div
          className={`p-4 rounded-2xl border flex flex-col justify-between shadow-xs ${
            isNitido ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/60 border-slate-800'
          }`}
        >
          <span className={`text-[11px] font-bold uppercase tracking-wider ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
            Presupuesto Asignado
          </span>
          <div className="my-1.5">
            <span className={`text-xl sm:text-2xl font-black ${isNitido ? 'text-slate-900' : 'text-white'}`}>
              {currSym}{totals.totalBudget.toLocaleString()}
            </span>
          </div>
          <span className={`text-[10px] ${isNitido ? 'text-slate-500' : 'text-slate-500'}`}>
            Meta mensual de gasto planificado
          </span>
        </div>

        {/* Gasto Real Total */}
        <div
          className={`p-4 rounded-2xl border flex flex-col justify-between shadow-xs ${
            isNitido ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/60 border-slate-800'
          }`}
        >
          <span className={`text-[11px] font-bold uppercase tracking-wider ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
            Gasto Real Total
          </span>
          <div className="my-1.5">
            <span className={`text-xl sm:text-2xl font-black ${
              totals.totalSpent > totals.totalBudget ? 'text-rose-700' : isNitido ? 'text-indigo-800' : 'text-indigo-400'
            }`}>
              {currSym}{totals.totalSpent.toLocaleString()}
            </span>
          </div>
          <span className={`text-[10px] ${isNitido ? 'text-slate-500' : 'text-slate-500'}`}>
            {totals.totalBudget > 0
              ? `${Math.round((totals.totalSpent / totals.totalBudget) * 100)}% del límite total`
              : 'Sin presupuestos'}
          </span>
        </div>

        {/* Exceso Total de Gasto (HIGHLIGHTED) */}
        <div
          className={`p-4 rounded-2xl border flex flex-col justify-between shadow-xs ${
            totals.totalExcess > 0
              ? isNitido
                ? 'bg-rose-50/70 border-rose-300'
                : 'bg-rose-950/30 border-rose-800/60'
              : isNitido
              ? 'bg-slate-50 border-slate-200'
              : 'bg-slate-950/60 border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${
              totals.totalExcess > 0 ? 'text-rose-800 dark:text-rose-300' : isNitido ? 'text-slate-500' : 'text-slate-400'
            }`}>
              Exceso Total de Gasto
            </span>
            {totals.totalExcess > 0 && <Flame className="w-4 h-4 text-rose-600 animate-pulse" />}
          </div>
          <div className="my-1.5">
            <span className={`text-xl sm:text-2xl font-black ${
              totals.totalExcess > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'
            }`}>
              {totals.totalExcess > 0 ? `+${currSym}${totals.totalExcess.toLocaleString()}` : `$0`}
            </span>
          </div>
          <span className={`text-[10px] ${
            totals.totalExcess > 0 ? 'text-rose-700 dark:text-rose-400 font-semibold' : isNitido ? 'text-slate-500' : 'text-slate-500'
          }`}>
            {totals.totalExcess > 0
              ? `${totals.exceededCount} categoría(s) rebasaron su cuota`
              : 'Dentro de los límites planificados'}
          </span>
        </div>

        {/* Margen Disponible */}
        <div
          className={`p-4 rounded-2xl border flex flex-col justify-between shadow-xs ${
            isNitido ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/60 border-slate-800'
          }`}
        >
          <span className={`text-[11px] font-bold uppercase tracking-wider ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
            Margen de Maniobra
          </span>
          <div className="my-1.5">
            <span className={`text-xl sm:text-2xl font-black ${
              totals.totalMargin > 0 ? 'text-emerald-700' : 'text-slate-700 dark:text-slate-300'
            }`}>
              +{currSym}{totals.totalMargin.toLocaleString()}
            </span>
          </div>
          <span className={`text-[10px] ${isNitido ? 'text-slate-500' : 'text-slate-500'}`}>
            Excedente utilizable para ahorro
          </span>
        </div>
      </div>

      {/* Filter and Sorting Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs pt-1">
        {/* Quick Filter Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`font-bold mr-1 ${isNitido ? 'text-slate-700' : 'text-slate-400'}`}>Filtrar:</span>
          {[
            { id: 'all', label: `Todas (${fullChartData.length})` },
            { id: 'only_exceeded', label: `⚠️ Solo con Exceso (${totals.exceededCount})` },
            { id: 'warning', label: `Alertas (≥80%) (${totals.exceededCount + totals.warningCount})` },
            { id: 'active', label: `Con Gasto (${fullChartData.filter((i) => i.gastoReal > 0).length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterMode(tab.id as any)}
              className={`px-3 py-1 rounded-xl font-bold transition-all border ${
                filterMode === tab.id
                  ? tab.id === 'only_exceeded'
                    ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                    : isNitido
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                    : 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                  : isNitido
                  ? 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Sort Select */}
        <div className="flex items-center gap-1.5">
          <span className={`font-bold mr-1 ${isNitido ? 'text-slate-700' : 'text-slate-400'}`}>Ordenar:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className={`px-2.5 py-1 rounded-xl font-semibold border focus:outline-none ${
              isNitido
                ? 'bg-white border-slate-300 text-slate-800 focus:border-indigo-600'
                : 'bg-slate-900 border-slate-700 text-slate-200 focus:border-cyan-400'
            }`}
          >
            <option value="spent">Mayor Gasto Real</option>
            <option value="excess">Mayor Exceso de Gasto</option>
            <option value="ratio">Mayor % Consumo</option>
            <option value="budget">Mayor Presupuesto</option>
            <option value="default">Categoría (A-Z)</option>
          </select>
        </div>
      </div>

      {/* Main Recharts Bar Chart Area */}
      <div
        className={`p-3 sm:p-5 rounded-2xl border ${
          isNitido ? 'bg-slate-50/50 border-slate-200' : 'bg-slate-950/70 border-slate-800'
        }`}
      >
        <div className="h-72 sm:h-84 w-full">
          <ResponsiveContainer width="100%" height="100%">
            {chartMode === 'comparison' ? (
              /* MODE 1: Dual Bars - Gasto Real vs Presupuesto Asignado */
              <BarChart
                data={processedData}
                margin={{ top: 20, right: 15, left: 10, bottom: 25 }}
                barGap={4}
                barCategoryGap={16}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke={isNitido ? '#e2e8f0' : '#1e293b'}
                />

                <XAxis
                  dataKey="name"
                  axisLine={{ stroke: isNitido ? '#cbd5e1' : '#334155' }}
                  tickLine={false}
                  tick={{
                    fill: isNitido ? '#334155' : '#94a3b8',
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                  interval={0}
                  angle={-20}
                  textAnchor="end"
                  height={45}
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
                  formatter={(value) => (
                    <span className={isNitido ? 'text-slate-800' : 'text-slate-200'}>
                      {value === 'gastoReal' ? 'Gasto Real Ejecutado' : 'Presupuesto Asignado'}
                    </span>
                  )}
                />

                {/* Presupuesto Asignado Bar */}
                <Bar
                  dataKey="presupuesto"
                  name="presupuesto"
                  fill={isNitido ? '#94a3b8' : '#475569'}
                  radius={[6, 6, 0, 0]}
                  maxBarSize={38}
                />

                {/* Gasto Real Bar with dynamic alert coloring */}
                <Bar
                  dataKey="gastoReal"
                  name="gastoReal"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={38}
                >
                  {processedData.map((entry, index) => {
                    let barColor = isNitido ? '#4f46e5' : '#6366f1'; // Normal Indigo
                    if (entry.isExceeded) {
                      barColor = isNitido ? '#dc2626' : '#f43f5e'; // Crimson excess
                    } else if (entry.isWarning) {
                      barColor = isNitido ? '#d97706' : '#f59e0b'; // Amber warning
                    }
                    return <Cell key={`cell-${index}`} fill={barColor} />;
                  })}
                </Bar>
              </BarChart>
            ) : (
              /* MODE 2: Excess Focus - Directly Visualizes Overspending Over Budget */
              <BarChart
                data={processedData}
                margin={{ top: 20, right: 15, left: 10, bottom: 25 }}
                barCategoryGap={20}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke={isNitido ? '#e2e8f0' : '#1e293b'}
                />

                <XAxis
                  dataKey="name"
                  axisLine={{ stroke: isNitido ? '#cbd5e1' : '#334155' }}
                  tickLine={false}
                  tick={{
                    fill: isNitido ? '#334155' : '#94a3b8',
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                  interval={0}
                  angle={-20}
                  textAnchor="end"
                  height={45}
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
                  formatter={(value) => (
                    <span className={isNitido ? 'text-slate-800' : 'text-slate-200'}>
                      {value === 'dentroPresupuesto' ? 'Gasto Dentro de Presupuesto' : 'Exceso de Gasto (>100%)'}
                    </span>
                  )}
                />

                {/* Stacked portion 1: within budget */}
                <Bar
                  dataKey="dentroPresupuesto"
                  name="dentroPresupuesto"
                  stackId="gastoStack"
                  fill={isNitido ? '#6366f1' : '#818cf8'}
                  maxBarSize={45}
                />

                {/* Stacked portion 2: pure excess over budget */}
                <Bar
                  dataKey="excesoMonto"
                  name="excesoMonto"
                  stackId="gastoStack"
                  fill={isNitido ? '#dc2626' : '#f43f5e'}
                  radius={[6, 6, 0, 0]}
                  maxBarSize={45}
                />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* Legend color guide & footnotes */}
        <div className="flex items-center justify-between flex-wrap gap-2 pt-3 border-t border-slate-200/80 dark:border-slate-800 text-[11px]">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1.5 font-semibold text-slate-600 dark:text-slate-400">
              <span className="w-2.5 h-2.5 rounded-xs bg-slate-400 inline-block" />
              Presupuesto Base
            </span>
            <span className="flex items-center gap-1.5 font-semibold text-indigo-700 dark:text-indigo-400">
              <span className="w-2.5 h-2.5 rounded-xs bg-indigo-600 inline-block" />
              Gasto en Rango
            </span>
            <span className="flex items-center gap-1.5 font-semibold text-amber-700 dark:text-amber-400">
              <span className="w-2.5 h-2.5 rounded-xs bg-amber-500 inline-block" />
              Alerta (≥80%)
            </span>
            <span className="flex items-center gap-1.5 font-semibold text-rose-700 dark:text-rose-400">
              <span className="w-2.5 h-2.5 rounded-xs bg-rose-600 inline-block" />
              Exceso Superado (&gt;100%)
            </span>
          </div>

          <span className={`text-[10px] ${isNitido ? 'text-slate-500' : 'text-slate-500'}`}>
            Reactivo a cada pago registrado en tiempo real
          </span>
        </div>
      </div>

      {/* DEDICATED OVERSPENDING / EXCESS BREAKOUT PANEL */}
      {totals.exceededCount > 0 ? (
        <div className={`p-4 sm:p-5 rounded-2xl border space-y-3 ${
          isNitido ? 'bg-rose-50/50 border-rose-200' : 'bg-rose-950/20 border-rose-800/40'
        }`}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-rose-600 shrink-0" />
              <h4 className={`text-xs font-bold uppercase tracking-wider ${isNitido ? 'text-rose-900' : 'text-rose-200'}`}>
                Desglose Detallado de Excesos de Gasto ({totals.exceededCount} categorías sobre el límite)
              </h4>
            </div>
            <span className={`text-xs font-black ${isNitido ? 'text-rose-800' : 'text-rose-300'}`}>
              Exceso Acumulado: +{currSym}{totals.totalExcess.toLocaleString()}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {totals.exceededList.map((item) => {
              const Icon = item.IconComponent;
              return (
                <div
                  key={item.key}
                  className={`p-3 rounded-xl border flex items-center justify-between gap-3 shadow-2xs ${
                    isNitido ? 'bg-white border-rose-200' : 'bg-slate-900 border-rose-900/40'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      isNitido ? 'bg-rose-100 text-rose-700' : 'bg-rose-500/20 text-rose-400'
                    }`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <span className={`text-xs font-bold block truncate ${isNitido ? 'text-slate-900' : 'text-white'}`}>
                        {item.fullName}
                      </span>
                      <span className={`text-[10px] block ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
                        Gasto: {currSym}{item.gastoReal.toLocaleString()} / Límite: {currSym}{item.presupuesto.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-xs font-black text-rose-700 block">
                      +{currSym}{item.excesoMonto.toLocaleString()}
                    </span>
                    <span className="text-[10px] font-extrabold text-rose-800 block">
                      {item.ratio}% ({item.porcentajeExceso}% exceso)
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
          isNitido ? 'bg-emerald-50/60 border-emerald-200' : 'bg-emerald-950/20 border-emerald-800/30'
        }`}>
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className={`text-xs font-bold ${isNitido ? 'text-emerald-950' : 'text-emerald-200'}`}>
              ¡Excelente control! Todos los gastos registrados se mantienen dentro de los presupuestos asignados.
            </span>
          </div>
          <span className={`text-xs font-bold ${isNitido ? 'text-emerald-800' : 'text-emerald-300'}`}>
            Margen de Ahorro: +{currSym}{totals.totalMargin.toLocaleString()}
          </span>
        </div>
      )}
    </div>
  );
};
