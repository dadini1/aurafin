import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from 'recharts';
import {
  PieChart as PieIcon,
  TrendingDown,
  Filter,
  DollarSign,
  AlertTriangle,
  ArrowUpRight,
  ShieldAlert,
  Car,
  Home,
  Utensils,
  Zap,
  Film,
  HeartPulse,
  GraduationCap,
  Layers,
} from 'lucide-react';
import { PaymentItem, UserFinancialProfile } from '../types';
import { useTheme } from '../context/ThemeContext';

interface ExpenseRingChartProps {
  payments: PaymentItem[];
  profile: UserFinancialProfile;
  categoryBudgets?: Record<string, number>;
  onSelectCategory?: (category: string) => void;
  onNavigateToRadar?: () => void;
}

export const CATEGORY_COLORS: Record<string, string> = {
  alquiler: '#6366f1', // Indigo
  transporte: '#f59e0b', // Amber
  alimentacion: '#ec4899', // Pink
  servicios: '#06b6d4', // Cyan
  ocio: '#a855f7', // Purple
  salud: '#10b981', // Emerald
  educacion: '#3b82f6', // Blue
  otro: '#64748b', // Slate
};

export const VIBRANT_CATEGORY_COLORS: Record<string, string> = {
  alquiler: '#c026d3', // Neon Fuchsia / Purple
  transporte: '#00d2ff', // Electric Blue
  alimentacion: '#f43f5e', // Hot Neon Pink
  servicios: '#06b6d4', // Electric Cyan
  ocio: '#a855f7', // Vivid Neon Violet
  salud: '#00f59b', // Neon Emerald
  educacion: '#3b82f6', // Electric Indigo Blue
  otro: '#94a3b8', // High-contrast Slate
};

export const CATEGORY_LABELS: Record<string, string> = {
  alquiler: 'Alquiler / Vivienda',
  transporte: 'Transporte / Movilidad',
  alimentacion: 'Alimentación & Súper',
  servicios: 'Servicios Básicos & Luz',
  ocio: 'Ocio & Entretenimiento',
  salud: 'Salud & Bienestar',
  educacion: 'Educación & Cursos',
  otro: 'Otros Gastos',
};

export const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  alquiler: Home,
  transporte: Car,
  alimentacion: Utensils,
  servicios: Zap,
  ocio: Film,
  salud: HeartPulse,
  educacion: GraduationCap,
  otro: Layers,
};

export const ExpenseRingChart: React.FC<ExpenseRingChartProps> = ({
  payments,
  profile,
  categoryBudgets = {},
  onSelectCategory,
  onNavigateToRadar,
}) => {
  const { isVibrant } = useTheme();
  const activeColors = isVibrant ? VIBRANT_CATEGORY_COLORS : CATEGORY_COLORS;

  // Filter mode: 'todos' | 'fijos' | 'variables'
  const [filterMode, setFilterMode] = useState<'todos' | 'fijos' | 'variables'>('todos');
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  // Filter payments
  const expensePayments = useMemo(() => {
    return payments.filter((p) => {
      if (p.type !== 'gasto') return false;
      if (filterMode === 'fijos') return p.isFixed;
      if (filterMode === 'variables') return !p.isFixed;
      return true;
    });
  }, [payments, filterMode]);

  // Aggregate by category
  const categoryData = useMemo(() => {
    const totals: Record<string, { total: number; count: number }> = {};

    expensePayments.forEach((p) => {
      const cat = p.category || 'otro';
      if (!totals[cat]) {
        totals[cat] = { total: 0, count: 0 };
      }
      totals[cat].total += p.amount;
      totals[cat].count += 1;
    });

    const totalSum = Object.values(totals).reduce((acc, curr) => acc + curr.total, 0);

    return Object.entries(totals)
      .map(([cat, info]) => {
        const percent = totalSum > 0 ? (info.total / totalSum) * 100 : 0;
        const budgetLimit = categoryBudgets[cat];
        const budgetPercent = budgetLimit && budgetLimit > 0 ? (info.total / budgetLimit) * 100 : null;

        return {
          category: cat,
          name: CATEGORY_LABELS[cat] || cat,
          value: info.total,
          count: info.count,
          percent: Math.round(percent),
          rawPercent: percent,
          color: activeColors[cat] || '#94a3b8',
          budgetLimit,
          budgetPercent: budgetPercent ? Math.round(budgetPercent) : null,
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [expensePayments, categoryBudgets, activeColors]);

  const totalExpenseAmount = useMemo(() => {
    return categoryData.reduce((acc, curr) => acc + curr.value, 0);
  }, [categoryData]);

  // Active slice data (hovered or default)
  const activeItem = activeIndex !== null && categoryData[activeIndex] ? categoryData[activeIndex] : null;

  // Largest category
  const largestCategory = categoryData[0] || null;

  // Fixed vs Variable proportions for whole dataset
  const fixedSum = payments
    .filter((p) => p.type === 'gasto' && p.isFixed)
    .reduce((s, p) => s + p.amount, 0);
  const variableSum = payments
    .filter((p) => p.type === 'gasto' && !p.isFixed)
    .reduce((s, p) => s + p.amount, 0);
  const totalAllExpenses = fixedSum + variableSum;
  const fixedRate = totalAllExpenses > 0 ? Math.round((fixedSum / totalAllExpenses) * 100) : 0;
  const variableRate = totalAllExpenses > 0 ? Math.round((variableSum / totalAllExpenses) * 100) : 0;

  return (
    <div className={`p-5 sm:p-6 rounded-3xl transition-all duration-300 ${
      isVibrant
        ? 'bg-[#080d26] border border-cyan-500/30 shadow-[0_0_30px_rgba(0,210,255,0.08)]'
        : 'bg-slate-900 border border-slate-800 shadow-xl'
    } space-y-6`}>
      {/* 1. Header with Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <PieIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                Distribución de Gastos por Categoría
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800/40">
                  Gráfico de Anillos
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Visualización proporcional de tus gastos para identificar categorías de alto impacto en {profile.country}
              </p>
            </div>
          </div>
        </div>

        {/* Filter Switcher: Todos | Solo Fijos | Solo Variables */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => {
              setFilterMode('todos');
              setActiveIndex(null);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterMode === 'todos'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Todos ({payments.filter((p) => p.type === 'gasto').length})
          </button>
          <button
            type="button"
            onClick={() => {
              setFilterMode('fijos');
              setActiveIndex(null);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterMode === 'fijos'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Fijos ({fixedRate}%)
          </button>
          <button
            type="button"
            onClick={() => {
              setFilterMode('variables');
              setActiveIndex(null);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterMode === 'variables'
                ? 'bg-rose-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Variables ({variableRate}%)
          </button>
        </div>
      </div>

      {/* 2. Main Ring Chart + Interactive Breakdown Row */}
      {categoryData.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Ring Chart Area (7 Cols on desktop) */}
          <div className="lg:col-span-6 relative flex items-center justify-center min-h-[280px] sm:min-h-[320px]">
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={categoryData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={75}
                  outerRadius={115}
                  paddingAngle={3}
                  onMouseEnter={(_, index) => setActiveIndex(index)}
                  onMouseLeave={() => setActiveIndex(null)}
                  onClick={(entry: any) => onSelectCategory && onSelectCategory(entry?.payload?.category || entry?.category || '')}
                  className="cursor-pointer transition-all duration-300"
                >
                  {categoryData.map((entry, index) => {
                    const isCurrent = activeIndex === index;
                    return (
                      <Cell
                        key={`ring-cell-${index}`}
                        fill={entry.color}
                        stroke={isCurrent ? '#ffffff' : '#0f172a'}
                        strokeWidth={isCurrent ? 3 : 2}
                        className="transition-all duration-300"
                        style={{
                          filter: isCurrent ? 'drop-shadow(0 0 8px rgba(255,255,255,0.4))' : undefined,
                        }}
                      />
                    );
                  })}
                </Pie>
                <Tooltip
                  formatter={(val: any, name: any) => [
                    `${profile.currencySymbol}${Number(val).toLocaleString()}`,
                    String(name),
                  ]}
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '0.75rem',
                    fontSize: '12px',
                    color: '#f8fafc',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Dynamic Center Readout of Ring Chart */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4">
              {activeItem ? (
                <div className="animate-in fade-in zoom-in-95 duration-200 space-y-0.5">
                  <span
                    className="text-[11px] font-bold uppercase tracking-wider block truncate max-w-[140px]"
                    style={{ color: activeItem.color }}
                  >
                    {activeItem.name}
                  </span>
                  <div className="text-xl sm:text-2xl font-black text-white">
                    {profile.currencySymbol}{activeItem.value.toLocaleString()}
                  </div>
                  <div className="text-[11px] font-semibold text-slate-300">
                    {activeItem.percent}% del total
                  </div>
                </div>
              ) : (
                <div className="space-y-0.5">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                    {filterMode === 'fijos'
                      ? 'Total Fijos'
                      : filterMode === 'variables'
                      ? 'Total Variables'
                      : 'Total Gastos'}
                  </span>
                  <div className="text-xl sm:text-2xl font-black text-white">
                    {profile.currencySymbol}{totalExpenseAmount.toLocaleString()}
                  </div>
                  <span className="text-[10px] text-slate-500 font-medium block">
                    {expensePayments.length} transacciones
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Interactive Legend & Category List (6 Cols on desktop) */}
          <div className="lg:col-span-6 space-y-2 max-h-[340px] overflow-y-auto pr-1">
            <div className="flex items-center justify-between text-xs text-slate-400 px-2 pb-1 border-b border-slate-800">
              <span className="font-semibold uppercase tracking-wider text-[10px]">Categoría</span>
              <span className="font-semibold uppercase tracking-wider text-[10px]">Monto / Proporción</span>
            </div>

            {categoryData.map((item, idx) => {
              const Icon = CATEGORY_ICONS[item.category] || Layers;
              const isHovered = activeIndex === idx;

              return (
                <div
                  key={item.category}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onMouseLeave={() => setActiveIndex(null)}
                  onClick={() => onSelectCategory && onSelectCategory(item.category)}
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isHovered
                      ? 'bg-slate-800/90 border-slate-600 shadow-md scale-[1.01]'
                      : 'bg-slate-950/50 border-slate-800/70 hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border border-white/10"
                      style={{ backgroundColor: `${item.color}20`, color: item.color }}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="truncate">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-white truncate">{item.name}</span>
                        {item.budgetPercent && item.budgetPercent >= 80 && (
                          <span
                            className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                              item.budgetPercent >= 100
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            }`}
                            title={`Gasto consumió el ${item.budgetPercent}% del presupuesto de ${profile.currencySymbol}${item.budgetLimit}`}
                          >
                            {item.budgetPercent}% pres.
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 block truncate">
                        {item.count} transacción{item.count === 1 ? '' : 'es'}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-xs sm:text-sm font-extrabold text-white block">
                      {profile.currencySymbol}{item.value.toLocaleString()}
                    </span>
                    <span
                      className="text-[10px] font-bold"
                      style={{ color: item.color }}
                    >
                      {item.percent}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="p-8 rounded-2xl bg-slate-950 border border-slate-800 text-center space-y-2">
          <p className="text-xs text-slate-400">
            No hay gastos registrados en esta categoría de filtro para generar el gráfico de anillos.
          </p>
        </div>
      )}

      {/* 3. Bottom Summary Insights Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-800">
        {/* Insight 1: Largest Category */}
        <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Mayor Gasto Individual
            </span>
            <span className="text-xs sm:text-sm font-extrabold text-white truncate max-w-[150px] block mt-0.5">
              {largestCategory ? largestCategory.name : 'N/A'}
            </span>
            <span className="text-[11px] text-indigo-400 font-semibold">
              {largestCategory ? `${largestCategory.percent}% del total (${profile.currencySymbol}${largestCategory.value.toLocaleString()})` : '-'}
            </span>
          </div>
          {largestCategory && largestCategory.category === 'transporte' && onNavigateToRadar && (
            <button
              onClick={onNavigateToRadar}
              className="text-[10px] font-bold px-2 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg hover:bg-amber-500/30 transition-colors flex items-center gap-1"
            >
              <span>Ver Radar</span>
              <ArrowUpRight className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Insight 2: Fixed vs Variable Distribution */}
        <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            Distribución Fijo vs Variable
          </span>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs font-bold text-amber-400">
              Fijos: {fixedRate}%
            </span>
            <span className="text-slate-600">|</span>
            <span className="text-xs font-bold text-rose-400">
              Variables: {variableRate}%
            </span>
          </div>
          <span className="text-[10px] text-slate-500">
            Regla saludable: Fijos ≤ 50%, Variables ≤ 30%
          </span>
        </div>

        {/* Insight 3: Average Ticket */}
        <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            Ticket Promedio por Gasto
          </span>
          <div className="text-xs sm:text-sm font-extrabold text-emerald-400 mt-1">
            {profile.currencySymbol}
            {expensePayments.length > 0
              ? Math.round(totalExpenseAmount / expensePayments.length).toLocaleString()
              : '0'}
          </div>
          <span className="text-[10px] text-slate-500">
            Basado en {expensePayments.length} transacciones activas
          </span>
        </div>
      </div>
    </div>
  );
};
