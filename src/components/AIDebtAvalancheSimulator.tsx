import React, { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import {
  TrendingDown,
  Flame,
  Sparkles,
  Plus,
  Trash2,
  RotateCcw,
  Calendar,
  ArrowRight,
  CheckCircle2,
  Percent,
} from 'lucide-react';
import { PaymentItem, UserFinancialProfile } from '../types';
import { useTheme } from '../context/ThemeContext';

interface AIDebtAvalancheSimulatorProps {
  payments: PaymentItem[];
  profile: UserFinancialProfile;
  netSavings: number;
  onOpenVoiceAssistant?: (prompt: string) => void;
}

export interface DebtAccountItem {
  id: string;
  sourcePaymentId?: string;
  name: string;
  category: string;
  balance: number;
  apr: number; // Annual percentage rate, e.g. 29.9
  minPayment: number;
  isCustom?: boolean;
}

interface PersistedDebtConfig {
  overrides: Record<string, { balance: number; apr: number; minPayment: number }>;
  customDebts: DebtAccountItem[];
  hiddenPaymentIds: string[];
}

interface PayoffSimulationSummary {
  totalMonths: number;
  totalInterestPaid: number;
  totalPaid: number;
  payoffMonthById: Record<string, number>;
  interestById: Record<string, number>;
  monthlySeries: Array<{ month: number; balance: number; cumulativeInterest: number }>;
}

const STORAGE_KEY = 'aurafin_ai_debt_avalanche_v1';

const MONTH_SHORT_ES = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];

function formatFutureMonthLabel(monthsAhead: number): string {
  if (monthsAhead <= 0) return 'Hoy';
  if (monthsAhead >= 180) return '> 15 años';
  const d = new Date();
  d.setMonth(d.getMonth() + monthsAhead);
  return `${MONTH_SHORT_ES[d.getMonth()]} ${d.getFullYear()}`;
}

function inferDefaultDebtMetrics(payment: PaymentItem): {
  balance: number;
  apr: number;
  minPayment: number;
} {
  const titleLower = payment.title.toLowerCase();
  const baseAmt = Math.max(25, Math.round(Number(payment.amount) || 50));

  // Assign realistic APRs based on payment keywords / category
  let apr = 16.5;
  let multiplier = 4;

  if (
    titleLower.includes('tarjeta') ||
    titleLower.includes('crédito') ||
    titleLower.includes('credito') ||
    payment.category === 'ocio'
  ) {
    apr = 32.4;
    multiplier = 6;
  } else if (
    titleLower.includes('uber') ||
    titleLower.includes('taxi') ||
    titleLower.includes('auto') ||
    payment.category === 'transporte'
  ) {
    apr = 21.8;
    multiplier = 5;
  } else if (payment.category === 'alimentacion') {
    apr = 24.5;
    multiplier = 3;
  } else if (payment.category === 'servicios') {
    apr = 12.0;
    multiplier = 3;
  } else if (payment.category === 'salud' || payment.category === 'educacion') {
    apr = 14.9;
    multiplier = 4;
  } else if (payment.category === 'alquiler') {
    apr = 9.5;
    multiplier = 2;
  }

  const balance = Math.max(baseAmt, Math.round(baseAmt * multiplier));
  const minPayment = Math.max(15, Math.round(Math.min(balance, Math.max(baseAmt * 0.35, balance * 0.08))));

  return { balance, apr, minPayment };
}

function runPayoffSimulation(
  debts: DebtAccountItem[],
  extraMonthlyPayment: number,
  strategy: 'avalanche' | 'snowball' | 'minimums_only'
): PayoffSimulationSummary {
  if (debts.length === 0) {
    return {
      totalMonths: 0,
      totalInterestPaid: 0,
      totalPaid: 0,
      payoffMonthById: {},
      interestById: {},
      monthlySeries: [{ month: 0, balance: 0, cumulativeInterest: 0 }],
    };
  }

  const working = debts.map((d) => ({
    ...d,
    remaining: Math.max(0, Number(d.balance) || 0),
    monthlyRate: Math.max(0, Number(d.apr) || 0) / 100 / 12,
    minPay: Math.max(5, Number(d.minPayment) || 15),
    paidOffMonth: 0,
    interestAccrued: 0,
  }));

  const initialTotal = working.reduce((sum, d) => sum + d.remaining, 0);
  const monthlySeries: Array<{ month: number; balance: number; cumulativeInterest: number }> = [
    { month: 0, balance: Math.round(initialTotal), cumulativeInterest: 0 },
  ];

  const baseMinSum = working.reduce((sum, d) => sum + d.minPay, 0);
  const monthlyBudget =
    strategy === 'minimums_only' ? baseMinSum : baseMinSum + Math.max(0, extraMonthlyPayment);

  let totalInterestPaid = 0;
  let totalPaid = 0;
  let monthsElapsed = 0;
  const MAX_MONTHS = 180;

  while (monthsElapsed < MAX_MONTHS) {
    const active = working.filter((d) => d.remaining > 0.01);
    if (active.length === 0) break;

    monthsElapsed += 1;

    // 1. Accrue monthly interest on each active debt
    for (const d of active) {
      const interest = d.remaining * d.monthlyRate;
      d.remaining += interest;
      d.interestAccrued += interest;
      totalInterestPaid += interest;
    }

    // 2. Determine available payment pool for this month
    let budgetLeft =
      strategy === 'minimums_only'
        ? active.reduce((sum, d) => sum + Math.min(d.remaining, d.minPay), 0)
        : monthlyBudget;

    // Pay minimum on each active debt first
    for (const d of active) {
      const minDue = Math.min(d.remaining, d.minPay, budgetLeft);
      d.remaining -= minDue;
      budgetLeft -= minDue;
      totalPaid += minDue;
      if (d.remaining <= 0.01 && d.paidOffMonth === 0) {
        d.remaining = 0;
        d.paidOffMonth = monthsElapsed;
      }
    }

    // 3. Apply remaining snowball/avalanche surplus in priority order
    if (budgetLeft > 0.01 && strategy !== 'minimums_only') {
      const priorityQueue = [...working]
        .filter((d) => d.remaining > 0.01)
        .sort((a, b) => {
          if (strategy === 'avalanche') {
            return b.apr - a.apr || a.remaining - b.remaining;
          }
          return a.remaining - b.remaining || b.apr - a.apr;
        });

      for (const target of priorityQueue) {
        if (budgetLeft <= 0.01) break;
        const extra = Math.min(target.remaining, budgetLeft);
        target.remaining -= extra;
        budgetLeft -= extra;
        totalPaid += extra;
        if (target.remaining <= 0.01 && target.paidOffMonth === 0) {
          target.remaining = 0;
          target.paidOffMonth = monthsElapsed;
        }
      }
    }

    const endBalance = working.reduce((sum, d) => sum + d.remaining, 0);
    monthlySeries.push({
      month: monthsElapsed,
      balance: Math.round(endBalance),
      cumulativeInterest: Math.round(totalInterestPaid),
    });

    if (endBalance <= 0.01) break;
  }

  const payoffMonthById: Record<string, number> = {};
  const interestById: Record<string, number> = {};
  working.forEach((d) => {
    payoffMonthById[d.id] = d.paidOffMonth || monthsElapsed;
    interestById[d.id] = Math.round(d.interestAccrued);
  });

  return {
    totalMonths: monthsElapsed,
    totalInterestPaid: Math.round(totalInterestPaid),
    totalPaid: Math.round(totalPaid),
    payoffMonthById,
    interestById,
    monthlySeries,
  };
}

export const AIDebtAvalancheSimulator: React.FC<AIDebtAvalancheSimulatorProps> = ({
  payments,
  profile,
  netSavings,
  onOpenVoiceAssistant,
}) => {
  const { isNitido, isVibrant } = useTheme();
  const currSym = profile.currencySymbol || '$';

  const [config, setConfig] = useState<PersistedDebtConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved) as PersistedDebtConfig;
    } catch {
      // ignore
    }
    return { overrides: {}, customDebts: [], hiddenPaymentIds: [] };
  });

  const [extraPayment, setExtraPayment] = useState<number>(() =>
    Math.max(50, Math.min(500, Math.round(Math.max(100, netSavings * 0.25) / 10) * 10))
  );
  const [compareWith, setCompareWith] = useState<'minimums_only' | 'snowball'>('minimums_only');
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Add custom debt state
  const [newName, setNewName] = useState('');
  const [newBalance, setNewBalance] = useState('');
  const [newApr, setNewApr] = useState('28.5');
  const [newMin, setNewMin] = useState('');

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch {
      // ignore
    }
  }, [config]);

  // Build debt accounts from existing payment obligations + custom debt entries
  const debtAccounts: DebtAccountItem[] = useMemo(() => {
    const candidatePayments = payments
      .filter((p) => p.type === 'gasto' && !config.hiddenPaymentIds.includes(p.id))
      .sort((a, b) => {
        // Prioritize pending/overdue obligations and higher amounts
        const aUnpaid = a.status !== 'pagado' ? 1 : 0;
        const bUnpaid = b.status !== 'pagado' ? 1 : 0;
        if (aUnpaid !== bUnpaid) return bUnpaid - aUnpaid;
        return b.amount - a.amount;
      })
      .slice(0, 5);

    const mappedFromPayments: DebtAccountItem[] = candidatePayments.map((p) => {
      const defaults = inferDefaultDebtMetrics(p);
      const ov = config.overrides[p.id];
      return {
        id: `debt-${p.id}`,
        sourcePaymentId: p.id,
        name: p.title,
        category: p.category,
        balance: ov?.balance ?? defaults.balance,
        apr: ov?.apr ?? defaults.apr,
        minPayment: ov?.minPayment ?? defaults.minPayment,
        isCustom: false,
      };
    });

    return [...mappedFromPayments, ...config.customDebts].filter((d) => d.balance > 0);
  }, [payments, config]);

  // Optimal Avalanche repayment sequence (highest APR first)
  const orderedAvalancheDebts = useMemo(() => {
    return [...debtAccounts].sort((a, b) => b.apr - a.apr || a.balance - b.balance);
  }, [debtAccounts]);

  const simResults = useMemo(() => {
    const avalanche = runPayoffSimulation(orderedAvalancheDebts, extraPayment, 'avalanche');
    const snowball = runPayoffSimulation(orderedAvalancheDebts, extraPayment, 'snowball');
    const minimums = runPayoffSimulation(orderedAvalancheDebts, 0, 'minimums_only');

    const totalDebt = orderedAvalancheDebts.reduce((s, d) => s + d.balance, 0);
    const totalMinimums = orderedAvalancheDebts.reduce((s, d) => s + d.minPayment, 0);
    const weightedApr =
      totalDebt > 0
        ? Number(
            (
              orderedAvalancheDebts.reduce((s, d) => s + d.balance * d.apr, 0) / totalDebt
            ).toFixed(1)
          )
        : 0;

    const comparator = compareWith === 'snowball' ? snowball : minimums;
    const interestSaved = Math.max(0, comparator.totalInterestPaid - avalanche.totalInterestPaid);
    const monthsSaved = Math.max(0, comparator.totalMonths - avalanche.totalMonths);

    const maxLen = Math.max(avalanche.monthlySeries.length, comparator.monthlySeries.length);
    const chartData: Array<{
      monthLabel: string;
      monthIndex: number;
      avalancheBalance: number;
      comparatorBalance: number;
    }> = [];

    for (let i = 0; i < maxLen; i++) {
      const aPt = avalanche.monthlySeries[i];
      const cPt = comparator.monthlySeries[i];
      chartData.push({
        monthIndex: i,
        monthLabel: i === 0 ? 'Hoy' : `M${i}`,
        avalancheBalance: aPt ? aPt.balance : 0,
        comparatorBalance: cPt ? cPt.balance : 0,
      });
    }

    return {
      avalanche,
      snowball,
      minimums,
      comparator,
      totalDebt,
      totalMinimums,
      weightedApr,
      interestSaved,
      monthsSaved,
      chartData,
    };
  }, [orderedAvalancheDebts, extraPayment, compareWith]);

  const handleUpdateDebtField = (
    debt: DebtAccountItem,
    field: 'balance' | 'apr' | 'minPayment',
    rawValue: number
  ) => {
    const val = Math.max(0, rawValue);
    if (debt.isCustom) {
      setConfig((prev) => ({
        ...prev,
        customDebts: prev.customDebts.map((cd) =>
          cd.id === debt.id ? { ...cd, [field]: val } : cd
        ),
      }));
    } else if (debt.sourcePaymentId) {
      const payId = debt.sourcePaymentId;
      setConfig((prev) => ({
        ...prev,
        overrides: {
          ...prev.overrides,
          [payId]: {
            balance: field === 'balance' ? val : debt.balance,
            apr: field === 'apr' ? val : debt.apr,
            minPayment: field === 'minPayment' ? val : debt.minPayment,
          },
        },
      }));
    }
  };

  const handleRemoveDebt = (debt: DebtAccountItem) => {
    if (debt.isCustom) {
      setConfig((prev) => ({
        ...prev,
        customDebts: prev.customDebts.filter((cd) => cd.id !== debt.id),
      }));
    } else if (debt.sourcePaymentId) {
      const pid = debt.sourcePaymentId;
      setConfig((prev) => ({
        ...prev,
        hiddenPaymentIds: [...prev.hiddenPaymentIds, pid],
      }));
    }
  };

  const handleAddCustomDebt = (e: React.FormEvent) => {
    e.preventDefault();
    const bal = Number(newBalance);
    const aprVal = Number(newApr);
    const minVal = Number(newMin) || Math.max(20, Math.round(bal * 0.05));
    if (!newName.trim() || Number.isNaN(bal) || bal <= 0) return;

    const created: DebtAccountItem = {
      id: `debt-custom-${Date.now()}`,
      name: newName.trim(),
      category: 'otro',
      balance: Math.round(bal),
      apr: Number.isNaN(aprVal) ? 24 : Math.max(0, aprVal),
      minPayment: Math.max(10, Math.round(minVal)),
      isCustom: true,
    };

    setConfig((prev) => ({
      ...prev,
      customDebts: [...prev.customDebts, created],
    }));

    setNewName('');
    setNewBalance('');
    setNewMin('');
    setIsAddOpen(false);
  };

  const handleResetDefaults = () => {
    setConfig({ overrides: {}, customDebts: [], hiddenPaymentIds: [] });
  };

  const AvalancheTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const pt = payload[0]?.payload;
    if (!pt) return null;

    return (
      <div
        className={`px-3.5 py-2.5 rounded-xl border shadow-lg text-xs backdrop-blur-md ${
          isNitido
            ? 'bg-white/95 border-slate-200 text-slate-900'
            : 'bg-slate-900/95 border-slate-700 text-slate-100'
        }`}
      >
        <p className="font-bold mb-1.5">
          Mes {pt.monthIndex} ({formatFutureMonthLabel(pt.monthIndex)})
        </p>
        <div className="space-y-1 tabular-nums">
          <div className="flex items-center justify-between gap-5">
            <span className={isNitido ? 'text-slate-600' : 'text-slate-400'}>AI Debt Avalanche:</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">
              {currSym}{pt.avalancheBalance.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center justify-between gap-5">
            <span className={isNitido ? 'text-slate-600' : 'text-slate-400'}>
              {compareWith === 'snowball' ? 'Método Snowball:' : 'Solo pagos mínimos:'}
            </span>
            <span className="font-semibold">{currSym}{pt.comparatorBalance.toLocaleString()}</span>
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

  const topPriorityDebt = orderedAvalancheDebts[0];
  const hasCustomizations =
    Object.keys(config.overrides).length > 0 ||
    config.customDebts.length > 0 ||
    config.hiddenPaymentIds.length > 0;

  return (
    <section
      aria-label="Simulador AI Debt Avalanche para Minimizar Intereses"
      className={`rounded-2xl border p-5 sm:p-6 transition-colors ${cardSurfaceClass}`}
    >
      {/* Header Row */}
      <div className={`flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-5 border-b ${hairlineBorder}`}>
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <TrendingDown className={`w-5 h-5 shrink-0 ${isNitido ? 'text-rose-600' : 'text-rose-400'}`} />
            <h3 className="text-base sm:text-lg font-bold tracking-tight">
              AI Debt Avalanche · Orden Óptimo de Liquidación
            </h3>
            {simResults.interestSaved > 0 && (
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border tabular-nums ${
                  isNitido
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-emerald-500/15 text-emerald-300 border-emerald-400/35'
                }`}
              >
                Ahorras {currSym}{simResults.interestSaved.toLocaleString()} en intereses
              </span>
            )}
          </div>
          <p className={`text-xs mt-1 ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
            Usa tus obligaciones de pago actuales para ordenar la liquidación de mayor a menor tasa de interés (APR) y minimizar intereses totales.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            className={`flex items-center p-1 rounded-lg border ${
              isNitido ? 'bg-slate-100 border-slate-200' : 'bg-slate-800 border-slate-700'
            }`}
          >
            <button
              type="button"
              onClick={() => setCompareWith('minimums_only')}
              className={`px-2.5 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                compareWith === 'minimums_only'
                  ? isNitido
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'bg-slate-700 text-white'
                  : isNitido
                  ? 'text-slate-600 hover:text-slate-900'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              vs. Mínimos
            </button>
            <button
              type="button"
              onClick={() => setCompareWith('snowball')}
              className={`px-2.5 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                compareWith === 'snowball'
                  ? isNitido
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'bg-slate-700 text-white'
                  : isNitido
                  ? 'text-slate-600 hover:text-slate-900'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              vs. Bola de Nieve
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsAddOpen((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border whitespace-nowrap shrink-0 transition-colors ${
              isNitido
                ? 'bg-slate-900 hover:bg-slate-800 text-white border-slate-900'
                : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 border-cyan-400'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Agregar deuda</span>
          </button>

          {hasCustomizations && (
            <button
              type="button"
              onClick={handleResetDefaults}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border whitespace-nowrap shrink-0 transition-colors ${
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

      {/* Add Custom Debt Form */}
      {isAddOpen && (
        <form
          onSubmit={handleAddCustomDebt}
          className={`mt-4 p-4 rounded-xl border grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end ${
            isNitido ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/60 border-slate-800'
          }`}
        >
          <div className="lg:col-span-2">
            <label className="text-[11px] font-bold block mb-1">Tarjeta / Crédito / Deuda</label>
            <input
              type="text"
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Ej: Tarjeta Visa Oro o Préstamo Personal"
              className={`w-full px-3 py-2 rounded-lg border text-xs focus:outline-none ${
                isNitido
                  ? 'bg-white border-slate-300 text-slate-900'
                  : 'bg-slate-900 border-slate-700 text-white'
              }`}
            />
          </div>
          <div>
            <label className="text-[11px] font-bold block mb-1">Saldo ({currSym})</label>
            <input
              type="number"
              required
              min={1}
              step="any"
              value={newBalance}
              onChange={(e) => setNewBalance(e.target.value)}
              placeholder="1500"
              className={`w-full px-3 py-2 rounded-lg border text-xs tabular-nums focus:outline-none ${
                isNitido
                  ? 'bg-white border-slate-300 text-slate-900'
                  : 'bg-slate-900 border-slate-700 text-white'
              }`}
            />
          </div>
          <div>
            <label className="text-[11px] font-bold block mb-1">Interés APR (%)</label>
            <input
              type="number"
              required
              min={0}
              max={150}
              step="0.1"
              value={newApr}
              onChange={(e) => setNewApr(e.target.value)}
              className={`w-full px-3 py-2 rounded-lg border text-xs tabular-nums focus:outline-none ${
                isNitido
                  ? 'bg-white border-slate-300 text-slate-900'
                  : 'bg-slate-900 border-slate-700 text-white'
              }`}
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label className="text-[11px] font-bold block mb-1">Pago mín.</label>
              <input
                type="number"
                min={5}
                step="any"
                value={newMin}
                onChange={(e) => setNewMin(e.target.value)}
                placeholder="75"
                className={`w-full px-3 py-2 rounded-lg border text-xs tabular-nums focus:outline-none ${
                  isNitido
                    ? 'bg-white border-slate-300 text-slate-900'
                    : 'bg-slate-900 border-slate-700 text-white'
                }`}
              />
            </div>
            <button
              type="submit"
              className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold whitespace-nowrap shrink-0 self-end"
            >
              Añadir
            </button>
          </div>
        </form>
      )}

      {/* 4-Column Flat KPI Strip */}
      <div className={`grid grid-cols-2 lg:grid-cols-4 gap-4 py-5 border-b ${hairlineBorder}`}>
        <div>
          <span className={`text-xs block ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
            Saldo total analizado
          </span>
          <span className="text-xl sm:text-2xl font-bold tabular-nums mt-0.5 block">
            {currSym}{simResults.totalDebt.toLocaleString()}
          </span>
          <span className={`text-[11px] tabular-nums ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
            APR promedio ponderado: {simResults.weightedApr}%
          </span>
        </div>

        <div>
          <span className={`text-xs block ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
            Interés total (Avalanche)
          </span>
          <span className="text-xl sm:text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400 mt-0.5 block">
            {currSym}{simResults.avalanche.totalInterestPaid.toLocaleString()}
          </span>
          <span className={`text-[11px] tabular-nums ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
            {compareWith === 'snowball' ? 'Snowball:' : 'Solo mínimos:'}{' '}
            {currSym}{simResults.comparator.totalInterestPaid.toLocaleString()}
          </span>
        </div>

        <div>
          <span className={`text-xs block ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
            Interés ahorrado
          </span>
          <span className="text-xl sm:text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400 mt-0.5 block">
            {currSym}{simResults.interestSaved.toLocaleString()}
          </span>
          <span className={`text-[11px] tabular-nums ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
            {simResults.monthsSaved > 0
              ? `${simResults.monthsSaved} mes${simResults.monthsSaved === 1 ? '' : 'es'} menos de deuda`
              : 'Orden óptimo de menor costo'}
          </span>
        </div>

        <div>
          <span className={`text-xs block ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
            Fecha libre de deudas
          </span>
          <span className="text-xl sm:text-2xl font-bold tabular-nums mt-0.5 block">
            {formatFutureMonthLabel(simResults.avalanche.totalMonths)}
          </span>
          <span className={`text-[11px] tabular-nums ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
            {simResults.avalanche.totalMonths} meses ({currSym}
            {(simResults.totalMinimums + extraPayment).toLocaleString()}/mes)
          </span>
        </div>
      </div>

      {/* Extra Payment Control + Recharts Comparison Chart */}
      <div className={`grid grid-cols-1 xl:grid-cols-12 gap-6 py-5 border-b ${hairlineBorder}`}>
        <div className="xl:col-span-5 space-y-4">
          <div
            className={`p-4 rounded-xl border space-y-2.5 ${
              isNitido ? 'bg-slate-50/70 border-slate-200' : 'bg-slate-950/50 border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between gap-2 text-xs">
              <label htmlFor="avalanche-extra-input" className="font-bold">
                Abono extra mensual a deuda (#1 APR)
              </label>
              <span className="font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                +{currSym}{extraPayment.toLocaleString()}/mes
              </span>
            </div>

            <input
              id="avalanche-extra-input"
              type="range"
              min={0}
              max={Math.max(800, Math.round(simResults.totalDebt * 0.5))}
              step={10}
              value={extraPayment}
              onChange={(e) => setExtraPayment(Number(e.target.value))}
              className="w-full accent-emerald-600 cursor-pointer"
            />

            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {[0, 50, 100, 200, 350].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setExtraPayment(amt)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold tabular-nums border whitespace-nowrap transition-colors ${
                    extraPayment === amt
                      ? isNitido
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-cyan-500 text-slate-950 border-cyan-400'
                      : isNitido
                      ? 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                  }`}
                >
                  +{currSym}{amt}
                </button>
              ))}
            </div>
          </div>

          {/* AI Recommendation Callout */}
          {topPriorityDebt ? (
            <div
              className={`p-4 rounded-xl border text-xs leading-relaxed space-y-2 ${
                isNitido
                  ? 'bg-indigo-50/70 border-indigo-200 text-indigo-950'
                  : 'bg-indigo-950/30 border-indigo-500/35 text-indigo-100'
              }`}
            >
              <div className="flex items-start gap-2">
                <Sparkles className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p>
                    <strong>Prioridad #1 recomendada:</strong> Dirige el pago mínimo al resto y concentra{' '}
                    <strong className="tabular-nums">
                      {currSym}{(topPriorityDebt.minPayment + extraPayment).toLocaleString()}/mes
                    </strong>{' '}
                    en <strong>{topPriorityDebt.name}</strong> ({topPriorityDebt.apr}% APR). Al liquidarla,
                    su cuota se transfiere en cascada a la siguiente tasa más alta.
                  </p>
                  {onOpenVoiceAssistant && (
                    <button
                      type="button"
                      onClick={() =>
                        onOpenVoiceAssistant(
                          `Usando Debt Avalanche con ${currSym}${extraPayment} extra al mes sobre ${currSym}${simResults.totalDebt} de deuda, mi prioridad #1 es ${topPriorityDebt.name} (${topPriorityDebt.apr}% APR). ¿Cómo puedo acelerar aún más este plan?`
                        )
                      }
                      className="inline-flex items-center gap-1 font-bold underline mt-2"
                    >
                      <span>Consultar estrategia con IA</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-500/30 text-xs flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>¡No tienes deudas activas registradas para liquidar!</span>
            </div>
          )}
        </div>

        {/* Right 7 cols: Recharts Payoff Curve */}
        <div className="xl:col-span-7 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-bold">Curva de Reducción de Saldo Total</span>
            <div className="flex items-center gap-4 text-[11px]">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-emerald-500 inline-block" />
                AI Debt Avalanche
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 border-t-2 border-dashed border-rose-500 inline-block" />
                {compareWith === 'snowball' ? 'Snowball' : 'Solo Mínimos'}
              </span>
            </div>
          </div>

          <div className="w-full h-[210px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={simResults.chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="avalancheFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis
                  dataKey="monthLabel"
                  tick={{ fontSize: 11, fill: axisColor }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={20}
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
                <Tooltip content={<AvalancheTooltip />} />
                <Area
                  type="monotone"
                  dataKey="comparatorBalance"
                  stroke="#f43f5e"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  fill="none"
                  dot={false}
                  animationDuration={300}
                />
                <Area
                  type="monotone"
                  dataKey="avalancheBalance"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fill="url(#avalancheFill)"
                  dot={false}
                  animationDuration={300}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Optimal Repayment Order List (Editable APR, Balance, Minimum) */}
      <div className="pt-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-bold flex items-center gap-2">
            <Flame className={`w-4 h-4 ${isNitido ? 'text-rose-600' : 'text-rose-400'}`} />
            <span>Orden Óptimo Sugerido (Mayor Tasa APR Primero)</span>
          </h4>
          <span className={`text-[11px] ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
            Puedes ajustar Saldo, APR% o Pago Mínimo de cada obligación
          </span>
        </div>

        <div className="space-y-2.5">
          {orderedAvalancheDebts.map((debt, index) => {
            const payoffMonth = simResults.avalanche.payoffMonthById[debt.id] || 0;
            const interestCost = simResults.avalanche.interestById[debt.id] || 0;
            const isFirst = index === 0;

            return (
              <div
                key={debt.id}
                className={`p-3.5 sm:p-4 rounded-xl border flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
                  isFirst
                    ? isNitido
                      ? 'bg-rose-50/50 border-rose-200'
                      : 'bg-rose-950/20 border-rose-500/35'
                    : isNitido
                    ? 'bg-slate-50/70 border-slate-200'
                    : 'bg-slate-950/40 border-slate-800'
                }`}
              >
                {/* Priority Rank + Name + Payoff ETA */}
                <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold tabular-nums shrink-0 border ${
                      isFirst
                        ? 'bg-rose-600 text-white border-rose-500'
                        : isNitido
                        ? 'bg-white text-slate-800 border-slate-200'
                        : 'bg-slate-800 text-slate-200 border-slate-700'
                    }`}
                  >
                    #{index + 1}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h5 className="text-sm font-bold truncate" title={debt.name}>
                        {debt.name}
                      </h5>
                      {isFirst && (
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            isNitido
                              ? 'bg-rose-100 text-rose-800 border-rose-200'
                              : 'bg-rose-500/20 text-rose-300 border-rose-400/35'
                          }`}
                        >
                          Atacar primero
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] tabular-nums mt-1">
                      <span className={`inline-flex items-center gap-1 ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
                        <Calendar className="w-3 h-3" />
                        Liquidación estimada: <strong>{formatFutureMonthLabel(payoffMonth)}</strong> ({payoffMonth}m)
                      </span>
                      <span className={isNitido ? 'text-slate-600' : 'text-slate-400'}>
                        Interés proyectado: <strong>{currSym}{interestCost.toLocaleString()}</strong>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Inline Editable Balance, APR, Min Payment */}
                <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                  <label className="text-[11px] flex flex-col gap-0.5">
                    <span className={isNitido ? 'text-slate-500' : 'text-slate-400'}>Saldo ({currSym})</span>
                    <input
                      type="number"
                      min={1}
                      step="any"
                      value={debt.balance}
                      onChange={(e) =>
                        handleUpdateDebtField(debt, 'balance', Number(e.target.value) || 0)
                      }
                      className={`w-24 px-2 py-1 rounded-lg border text-xs font-bold tabular-nums focus:outline-none ${
                        isNitido
                          ? 'bg-white border-slate-200 text-slate-900'
                          : 'bg-slate-900 border-slate-700 text-white'
                      }`}
                    />
                  </label>

                  <label className="text-[11px] flex flex-col gap-0.5">
                    <span className={`inline-flex items-center gap-0.5 ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
                      <Percent className="w-3 h-3" /> APR
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={150}
                      step="0.1"
                      value={debt.apr}
                      onChange={(e) =>
                        handleUpdateDebtField(debt, 'apr', Number(e.target.value) || 0)
                      }
                      className={`w-20 px-2 py-1 rounded-lg border text-xs font-bold tabular-nums focus:outline-none ${
                        isNitido
                          ? 'bg-white border-slate-200 text-rose-700'
                          : 'bg-slate-900 border-slate-700 text-rose-300'
                      }`}
                    />
                  </label>

                  <label className="text-[11px] flex flex-col gap-0.5">
                    <span className={isNitido ? 'text-slate-500' : 'text-slate-400'}>Mínimo ({currSym})</span>
                    <input
                      type="number"
                      min={5}
                      step="any"
                      value={debt.minPayment}
                      onChange={(e) =>
                        handleUpdateDebtField(debt, 'minPayment', Number(e.target.value) || 5)
                      }
                      className={`w-20 px-2 py-1 rounded-lg border text-xs font-bold tabular-nums focus:outline-none ${
                        isNitido
                          ? 'bg-white border-slate-200 text-slate-900'
                          : 'bg-slate-900 border-slate-700 text-white'
                      }`}
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => handleRemoveDebt(debt)}
                    aria-label={`Ocultar o eliminar ${debt.name}`}
                    className={`p-1.5 rounded-lg border self-end transition-colors ${
                      isNitido
                        ? 'bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-700 border-slate-200'
                        : 'bg-slate-800 hover:bg-rose-950/50 text-slate-400 hover:text-rose-300 border-slate-700'
                    }`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
