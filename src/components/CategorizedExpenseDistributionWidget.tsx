import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from 'recharts';
import {
  PieChart as PieChartIcon,
  Calendar,
  ChevronRight,
  Layers,
} from 'lucide-react';
import { PaymentItem, UserFinancialProfile } from '../types';
import { useTheme } from '../context/ThemeContext';

interface CategorizedExpenseDistributionWidgetProps {
  payments: PaymentItem[];
  profile: UserFinancialProfile;
}

const CATEGORY_META: Record<string, { label: string; color: string }> = {
  alquiler: { label: 'Alquiler / Vivienda', color: '#4f46e5' },
  alimentacion: { label: 'Alimentación / Comida', color: '#e11d48' },
  transporte: { label: 'Transporte', color: '#d97706' },
  servicios: { label: 'Servicios', color: '#0891b2' },
  ocio: { label: 'Ocio / Entretenimiento', color: '#9333ea' },
  salud: { label: 'Salud', color: '#059669' },
  educacion: { label: 'Educación', color: '#2563eb' },
  otro: { label: 'Otros', color: '#64748b' },
};

interface CategorySlice {
  category: string;
  label: string;
  amount: number;
  percentage: number;
  exactPercentage: string;
  count: number;
  color: string;
  items: PaymentItem[];
}

export const CategorizedExpenseDistributionWidget: React.FC<CategorizedExpenseDistributionWidgetProps> = ({
  payments,
  profile,
}) => {
  const { isNitido, isVibrant } = useTheme();
  const currSym = profile.currencySymbol || '$';

  const [statusFilter, setStatusFilter] = useState<'all' | 'pagado' | 'pendiente'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'fixed' | 'variable'>('all');
  const [timeframeFilter, setTimeframeFilter] = useState<'all' | '30d' | 'month'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

  // Filter expense items according to controls
  const filteredExpenses = useMemo(() => {
    const now = new Date();
    const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    return payments.filter((p) => {
      if (p.type !== 'gasto') return false;

      if (statusFilter === 'pagado' && p.status !== 'pagado') return false;
      if (statusFilter === 'pendiente' && p.status === 'pagado') return false;

      if (typeFilter === 'fixed' && !p.isFixed) return false;
      if (typeFilter === 'variable' && p.isFixed) return false;

      if (timeframeFilter === 'month') {
        if (!p.dueDate?.startsWith(currentMonthPrefix)) return false;
      } else if (timeframeFilter === '30d') {
        const dt = new Date(p.dueDate);
        if (isNaN(dt.getTime()) || dt < thirtyDaysAgo) return false;
      }

      return true;
    });
  }, [payments, statusFilter, typeFilter, timeframeFilter]);

  // Group into Donut chart slices with percentages
  const { slices, totalAmount } = useMemo(() => {
    const grouped: Record<string, { amount: number; items: PaymentItem[] }> = {};

    filteredExpenses.forEach((p) => {
      const cat = p.category || 'otro';
      if (!grouped[cat]) {
        grouped[cat] = { amount: 0, items: [] };
      }
      grouped[cat].amount += Number(p.amount) || 0;
      grouped[cat].items.push(p);
    });

    const total = Object.values(grouped).reduce((acc, g) => acc + g.amount, 0);

    const list: CategorySlice[] = Object.entries(grouped)
      .map(([cat, info]) => {
        const pct = total > 0 ? (info.amount / total) * 100 : 0;
        const meta = CATEGORY_META[cat] || CATEGORY_META.otro;
        return {
          category: cat,
          label: meta.label,
          amount: Math.round(info.amount * 100) / 100,
          percentage: Math.round(pct * 10) / 10,
          exactPercentage: pct.toFixed(1),
          count: info.items.length,
          color: meta.color,
          items: info.items.sort((a, b) => b.amount - a.amount),
        };
      })
      .sort((a, b) => b.amount - a.amount);

    return { slices: list, totalAmount: Math.round(total * 100) / 100 };
  }, [filteredExpenses]);

  const activeCategoryKey = hoveredCategory || selectedCategory;
  const activeSlice = useMemo(() => {
    if (!activeCategoryKey) return null;
    return slices.find((s) => s.category === activeCategoryKey) || null;
  }, [slices, activeCategoryKey]);

  const topSlice = slices[0] || null;
  const inspectedSlice = selectedCategory
    ? slices.find((s) => s.category === selectedCategory) || null
    : activeSlice || topSlice;

  // Custom Recharts Tooltip
  const CustomDonutTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const d: CategorySlice = payload[0]?.payload;
    if (!d) return null;

    const incomeShare =
      profile.monthlyIncome > 0
        ? ((d.amount / profile.monthlyIncome) * 100).toFixed(1)
        : null;

    return (
      <div
        className={`p-3 rounded-xl border shadow-xl text-xs backdrop-blur-md min-w-[200px] ${
          isNitido
            ? 'bg-white/95 border-slate-200 text-slate-900'
            : 'bg-slate-900/95 border-slate-700 text-slate-100'
        }`}
      >
        <div className="flex items-center justify-between gap-3 pb-1.5 mb-1.5 border-b border-slate-200/80 dark:border-slate-800">
          <span className="flex items-center gap-2 font-bold">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: d.color }}
            />
            <span>{d.label}</span>
          </span>
          <span className="font-bold tabular-nums" style={{ color: d.color }}>
            {d.exactPercentage}%
          </span>
        </div>
        <div className="space-y-1 tabular-nums">
          <div className="flex items-center justify-between gap-4">
            <span className={isNitido ? 'text-slate-500' : 'text-slate-400'}>Total gastado:</span>
            <span className="font-bold">{currSym}{d.amount.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className={isNitido ? 'text-slate-500' : 'text-slate-400'}>Movimientos:</span>
            <span className="font-semibold">{d.count} registro{d.count === 1 ? '' : 's'}</span>
          </div>
          {incomeShare && (
            <div className="flex items-center justify-between gap-4">
              <span className={isNitido ? 'text-slate-500' : 'text-slate-400'}>% de tu ingreso:</span>
              <span className="font-semibold">{incomeShare}%</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <section
      aria-label="Distribución Categorizada de Gastos"
      className={`rounded-2xl border p-5 sm:p-6 transition-colors ${
        isNitido
          ? 'bg-white border-slate-200 text-slate-900 shadow-xs'
          : isVibrant
          ? 'bg-slate-900/95 border-cyan-500/30 text-slate-100'
          : 'bg-slate-900 border-slate-800 text-slate-100'
      }`}
    >
      {/* Header Row */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-5 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <PieChartIcon className={`w-5 h-5 shrink-0 ${isNitido ? 'text-rose-600' : 'text-rose-400'}`} />
            <h3 className="text-base sm:text-lg font-bold tracking-tight">
              Distribución Categorizada de Gastos
            </h3>
          </div>
          <p className={`text-xs mt-1 ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
            <span>Desglose porcentual por categoría (Alimentación, Alquiler, Ocio y más)</span>
            <span aria-hidden="true" className="mx-1.5">·</span>
            <span className="tabular-nums">
              {filteredExpenses.length} movimiento{filteredExpenses.length === 1 ? '' : 's'} · Total {currSym}{totalAmount.toLocaleString()}
            </span>
          </p>
        </div>

        {/* Interactive Filter Bar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Fixed / Variable segmented control */}
          <div
            className={`flex items-center p-1 rounded-lg border ${
              isNitido ? 'bg-slate-100 border-slate-200' : 'bg-slate-800 border-slate-700'
            }`}
          >
            {[
              { id: 'all', label: 'Todos' },
              { id: 'fixed', label: 'Fijos' },
              { id: 'variable', label: 'Variables' },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTypeFilter(item.id as 'all' | 'fixed' | 'variable')}
                className={`px-2.5 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                  typeFilter === item.id
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

          {/* Payment status segmented control */}
          <div
            className={`flex items-center p-1 rounded-lg border ${
              isNitido ? 'bg-slate-100 border-slate-200' : 'bg-slate-800 border-slate-700'
            }`}
          >
            {[
              { id: 'all', label: 'Todos estados' },
              { id: 'pagado', label: 'Pagados' },
              { id: 'pendiente', label: 'Pendientes' },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setStatusFilter(item.id as 'all' | 'pagado' | 'pendiente')}
                className={`px-2.5 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                  statusFilter === item.id
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

          {/* Timeframe dropdown */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs ${
              isNitido
                ? 'bg-white border-slate-200 text-slate-700'
                : 'bg-slate-800 border-slate-700 text-slate-200'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              aria-label="Filtrar periodo de gastos categorizados"
              value={timeframeFilter}
              onChange={(e) => setTimeframeFilter(e.target.value as 'all' | '30d' | 'month')}
              className="bg-transparent text-xs font-semibold focus:outline-none cursor-pointer"
            >
              <option value="all" className={isNitido ? 'bg-white text-slate-900' : 'bg-slate-900 text-slate-100'}>
                Todo el historial
              </option>
              <option value="30d" className={isNitido ? 'bg-white text-slate-900' : 'bg-slate-900 text-slate-100'}>
                Últimos 30 días
              </option>
              <option value="month" className={isNitido ? 'bg-white text-slate-900' : 'bg-slate-900 text-slate-100'}>
                Mes actual
              </option>
            </select>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {slices.length === 0 ? (
        <div className="py-12 text-center space-y-2">
          <Layers className="w-8 h-8 mx-auto text-slate-400" />
          <h4 className="text-sm font-bold">No hay gastos registrados para los filtros seleccionados</h4>
          <p className={`text-xs max-w-md mx-auto ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
            Ajusta los filtros de tipo, estado o periodo para visualizar la distribución porcentual de tus categorías de gasto.
          </p>
        </div>
      ) : (
        <div className="pt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Left 5 Cols: Recharts Donut Chart with Center Readout */}
          <div className="lg:col-span-5 flex flex-col items-center">
            <div className="relative w-full h-[270px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={slices}
                    dataKey="amount"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    innerRadius={74}
                    outerRadius={112}
                    paddingAngle={3}
                    stroke={isNitido ? '#ffffff' : '#0f172a'}
                    strokeWidth={2}
                    onMouseEnter={(_, idx) => {
                      if (slices[idx]) setHoveredCategory(slices[idx].category);
                    }}
                    onMouseLeave={() => setHoveredCategory(null)}
                    onClick={(entry: any) => {
                      if (!entry?.category) return;
                      setSelectedCategory((prev) => (prev === entry.category ? null : entry.category));
                    }}
                    animationDuration={450}
                  >
                    {slices.map((entry) => {
                      const isDimmed =
                        activeCategoryKey !== null && activeCategoryKey !== entry.category;
                      return (
                        <Cell
                          key={entry.category}
                          fill={entry.color}
                          fillOpacity={isDimmed ? 0.35 : 1}
                          cursor="pointer"
                        />
                      );
                    })}
                  </Pie>
                  <Tooltip content={<CustomDonutTooltip />} />
                </PieChart>
              </ResponsiveContainer>

              {/* Center Metric Readout */}
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center px-6">
                {activeSlice ? (
                  <>
                    <span
                      className="text-[11px] font-semibold truncate max-w-[125px]"
                      style={{ color: activeSlice.color }}
                    >
                      {activeSlice.label.split(' / ')[0]}
                    </span>
                    <span className="text-2xl font-bold tabular-nums tracking-tight mt-0.5">
                      {activeSlice.exactPercentage}%
                    </span>
                    <span className={`text-xs font-semibold tabular-nums ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
                      {currSym}{activeSlice.amount.toLocaleString()}
                    </span>
                  </>
                ) : (
                  <>
                    <span className={`text-[11px] font-semibold ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
                      Gasto Total
                    </span>
                    <span className="text-2xl font-bold tabular-nums tracking-tight mt-0.5">
                      {currSym}{totalAmount.toLocaleString()}
                    </span>
                    <span className={`text-[11px] tabular-nums ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
                      {slices.length} categoría{slices.length === 1 ? '' : 's'}
                    </span>
                  </>
                )}
              </div>
            </div>

            <p className={`text-[11px] text-center mt-1 ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
              Haz clic en un segmento o categoría para filtrar su detalle.
            </p>
          </div>

          {/* Right 7 Cols: Interactive Percentage Breakdown Table */}
          <div className="lg:col-span-7 space-y-4">
            <div className="divide-y divide-slate-200/80 dark:divide-slate-800 border-y border-slate-200/80 dark:border-slate-800">
              {slices.map((slice) => {
                const isSelected = selectedCategory === slice.category;
                const isHovered = hoveredCategory === slice.category;

                return (
                  <button
                    key={slice.category}
                    type="button"
                    onMouseEnter={() => setHoveredCategory(slice.category)}
                    onMouseLeave={() => setHoveredCategory(null)}
                    onClick={() =>
                      setSelectedCategory((prev) =>
                        prev === slice.category ? null : slice.category
                      )
                    }
                    className={`w-full py-2.5 px-2 text-left transition-colors flex flex-col gap-1.5 ${
                      isSelected
                        ? isNitido
                          ? 'bg-slate-100/90'
                          : 'bg-slate-800/70'
                        : isHovered
                        ? isNitido
                          ? 'bg-slate-50'
                          : 'bg-slate-800/40'
                        : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: slice.color }}
                        />
                        <span className="font-semibold truncate">{slice.label}</span>
                        <span className={`text-[11px] tabular-nums shrink-0 ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
                          {slice.count} mov.
                        </span>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 tabular-nums">
                        <span className="font-semibold">
                          {currSym}{slice.amount.toLocaleString()}
                        </span>
                        <span
                          className="font-bold w-12 text-right"
                          style={{ color: slice.color }}
                        >
                          {slice.exactPercentage}%
                        </span>
                        <ChevronRight
                          className={`w-3.5 h-3.5 transition-transform ${
                            isSelected
                              ? 'rotate-90 text-slate-900 dark:text-white'
                              : 'text-slate-400'
                          }`}
                        />
                      </div>
                    </div>

                    {/* Thin Proportional Share Bar */}
                    <div
                      className={`w-full h-1.5 rounded-full overflow-hidden ${
                        isNitido ? 'bg-slate-100' : 'bg-slate-800'
                      }`}
                    >
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.max(2, slice.percentage)}%`,
                          backgroundColor: slice.color,
                        }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Category Drill-down Preview */}
            {inspectedSlice && (
              <div className="pt-1 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold">
                    {selectedCategory ? 'Detalle seleccionado: ' : 'Mayor concentración: '}
                    <span style={{ color: inspectedSlice.color }}>{inspectedSlice.label}</span>
                  </span>
                  {selectedCategory && (
                    <button
                      type="button"
                      onClick={() => setSelectedCategory(null)}
                      className={`text-[11px] font-semibold underline ${
                        isNitido ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Ver total general
                    </button>
                  )}
                </div>

                <div className="space-y-1.5">
                  {inspectedSlice.items.slice(0, 3).map((item) => (
                    <div
                      key={item.id}
                      className={`flex items-center justify-between gap-3 text-xs py-1 px-2.5 rounded-lg ${
                        isNitido ? 'bg-slate-50 text-slate-700' : 'bg-slate-800/50 text-slate-300'
                      }`}
                    >
                      <span className="truncate">{item.title}</span>
                      <span className="font-semibold tabular-nums whitespace-nowrap shrink-0">
                        {currSym}{item.amount.toLocaleString()} · {item.status === 'pagado' ? 'Pagado' : 'Pendiente'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
