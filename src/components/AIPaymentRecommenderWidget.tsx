import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import {
  CalendarCheck2,
  Sparkles,
  ShieldAlert,
  ArrowRight,
  Check,
  X,
  RotateCcw,
  CheckCircle2,
  Wallet,
} from 'lucide-react';
import { PaymentItem, UserFinancialProfile } from '../types';
import { useTheme } from '../context/ThemeContext';

interface AIPaymentRecommenderWidgetProps {
  payments: PaymentItem[];
  profile: UserFinancialProfile;
  onUpdatePayment: (id: string, updated: Partial<PaymentItem>) => void;
  onOpenVoiceAssistant?: (prompt: string) => void;
}

type PaydayCyclePreset = 'auto' | 'biweekly_1_15' | 'end_of_month';

interface PaymentDateRecommendation {
  payment: PaymentItem;
  currentDate: string;
  recommendedDate: string;
  reason: string;
  benefitTag: string;
  urgency: 'critical' | 'optimize' | 'aligned';
  lateFeeSaved: number;
  isChanged: boolean;
}

interface AppliedRecommendationState {
  previousDate: string;
  previousStatus: PaymentItem['status'];
  appliedDate: string;
}

function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseLocalDate(dateStr: string): Date {
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return new Date();
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function shiftToPreviousBusinessDay(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay();
  if (day === 6) d.setDate(d.getDate() - 1); // Saturday -> Friday
  else if (day === 0) d.setDate(d.getDate() - 2); // Sunday -> Friday
  return d;
}

function shiftToNextBusinessDay(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay();
  if (day === 6) d.setDate(d.getDate() + 2); // Saturday -> Monday
  else if (day === 0) d.setDate(d.getDate() + 1); // Sunday -> Monday
  return d;
}

function getWeekBucket(dateStr: string): number {
  const day = parseLocalDate(dateStr).getDate();
  if (day <= 7) return 0;
  if (day <= 15) return 1;
  if (day <= 23) return 2;
  return 3;
}

function formatShortEsDate(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  return d.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short' });
}

export const AIPaymentRecommenderWidget: React.FC<AIPaymentRecommenderWidgetProps> = ({
  payments,
  profile,
  onUpdatePayment,
  onOpenVoiceAssistant,
}) => {
  const { isNitido, isVibrant } = useTheme();
  const currSym = profile.currencySymbol || '$';

  const [paydayCycle, setPaydayCycle] = useState<PaydayCyclePreset>('auto');
  const [appliedMap, setAppliedMap] = useState<Record<string, AppliedRecommendationState>>({});
  const [ignoredIds, setIgnoredIds] = useState<Record<string, boolean>>({});

  // Analyze income cycle, spending habit clusters, and generate optimal payment date recommendations
  const analysis = useMemo(() => {
    const today = new Date();
    const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayKey = toLocalDateStr(todayMid);

    // 1. Detect primary income payday
    const incomePayments = payments.filter((p) => p.type === 'ingreso');
    let primaryPaydayDay = 1;
    if (paydayCycle === 'biweekly_1_15') {
      primaryPaydayDay = 1;
    } else if (paydayCycle === 'end_of_month') {
      primaryPaydayDay = 28;
    } else if (incomePayments.length > 0 && incomePayments[0].dueDate) {
      primaryPaydayDay = parseLocalDate(incomePayments[0].dueDate).getDate();
    }

    // 2. Analyze spending habit distribution across the 4 weeks of the month
    const expensePayments = payments.filter((p) => p.type === 'gasto');
    const currentWeekTotals = [0, 0, 0, 0];
    expensePayments.forEach((p) => {
      if (!p.dueDate) return;
      const b = getWeekBucket(p.dueDate);
      currentWeekTotals[b] += Number(p.amount) || 0;
    });

    const variableExpenses = expensePayments.filter((p) => !p.isFixed);
    const variableHeavyWeekIdx = variableExpenses.reduce(
      (acc, p) => {
        if (!p.dueDate) return acc;
        const b = getWeekBucket(p.dueDate);
        acc[b] += Number(p.amount) || 0;
        return acc;
      },
      [0, 0, 0, 0]
    );
    const peakVariableWeek = variableHeavyWeekIdx.indexOf(Math.max(...variableHeavyWeekIdx));

    // 3. Build recommendations for unpaid / recurring expense obligations
    const targetBills = expensePayments
      .filter((p) => p.status !== 'pagado' || p.frequency === 'mensual')
      .slice(0, 6);

    const recommendations: PaymentDateRecommendation[] = targetBills.map((p, idx) => {
      const currentDateStr = p.dueDate || todayKey;
      const parsedDue = parseLocalDate(currentDateStr);
      const isOverdue = p.status !== 'pagado' && currentDateStr < todayKey;
      const dayOfWeek = parsedDue.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      let recommendedObj = new Date(parsedDue.getTime());
      let reason = '';
      let benefitTag = 'Calendario equilibrado';
      let urgency: PaymentDateRecommendation['urgency'] = 'aligned';
      let lateFeeSaved = 0;

      if (isOverdue) {
        // Move overdue bills to today/next safe business day to stop late-fee accumulation
        const safeImmediate = shiftToNextBusinessDay(
          new Date(todayMid.getFullYear(), todayMid.getMonth(), todayMid.getDate() + (idx % 2))
        );
        recommendedObj = safeImmediate;
        lateFeeSaved = p.amount >= 200 ? 25 : 15;
        urgency = 'critical';
        benefitTag = 'Evita recargo por mora';
        reason = `Fecha vencida (${currentDateStr}). Programar liquidación inmediata el ${formatShortEsDate(
          toLocalDateStr(safeImmediate)
        )} protege tu historial y evita cargos estimados de ${currSym}${lateFeeSaved}.`;
      } else if (isWeekend) {
        // Shift weekend dates 1-2 days earlier to Friday so bank clearing doesn't cause late penalties
        recommendedObj = shiftToPreviousBusinessDay(parsedDue);
        lateFeeSaved = 15;
        urgency = 'optimize';
        benefitTag = 'Día hábil sin demora';
        reason = `Cae en fin de semana y puede retrasar la compensación bancaria. Adelantarlo al viernes ${formatShortEsDate(
          toLocalDateStr(recommendedObj)
        )} garantiza acreditación puntual.`;
      } else {
        // Cash-flow balancing: align bills away from heavy variable-spend week or right after payday
        const billWeek = getWeekBucket(currentDateStr);
        const postPaydayAnchorDay =
          primaryPaydayDay >= 25
            ? 2 + (idx % 3) * 2
            : Math.min(27, primaryPaydayDay + 2 + (idx % 3) * 2);

        if (billWeek === peakVariableWeek && !p.isFixed) {
          // Shift variable or clustered bills to a lower-pressure week (around post-payday or mid-month)
          const targetDay = paydayCycle === 'biweekly_1_15' && idx % 2 === 1 ? 17 : postPaydayAnchorDay;
          const candidate = new Date(todayMid.getFullYear(), todayMid.getMonth() + (targetDay < todayMid.getDate() ? 1 : 0), targetDay);
          recommendedObj = shiftToNextBusinessDay(candidate);
          urgency = 'optimize';
          benefitTag = 'Suaviza flujo de caja';
          reason = `Coincide con tu semana de mayor gasto variable (Sem ${peakVariableWeek + 1}). Moverlo al ${formatShortEsDate(
            toLocalDateStr(recommendedObj)
          )} equilibra tu saldo disponible.`;
        } else {
          // Keep aligned or nudge 1 day earlier if within 2 days of end-of-month crunch
          recommendedObj = shiftToPreviousBusinessDay(parsedDue);
          benefitTag = 'Fecha óptima';
          reason = `Tu fecha actual ya cae en día hábil con buen margen respecto a tu ciclo de ingresos.`;
        }
      }

      const recommendedDateStr = toLocalDateStr(recommendedObj);
      const isChanged = recommendedDateStr !== currentDateStr;

      return {
        payment: p,
        currentDate: currentDateStr,
        recommendedDate: recommendedDateStr,
        reason,
        benefitTag,
        urgency,
        lateFeeSaved: isChanged ? lateFeeSaved : 0,
        isChanged,
      };
    });

    // 4. Compute Optimized Weekly Cash-Flow distribution
    const optimizedWeekTotals = [0, 0, 0, 0];
    expensePayments.forEach((p) => {
      if (!p.dueDate) return;
      const rec = recommendations.find((r) => r.payment.id === p.id);
      const dateToUse = rec ? rec.recommendedDate : p.dueDate;
      const b = getWeekBucket(dateToUse);
      optimizedWeekTotals[b] += Number(p.amount) || 0;
    });

    const weeklyComparisonData = ['Sem 1 (1-7)', 'Sem 2 (8-15)', 'Sem 3 (16-23)', 'Sem 4 (24-31)'].map(
      (label, i) => ({
        weekLabel: label,
        actualOutflow: Math.round(currentWeekTotals[i]),
        optimizedOutflow: Math.round(optimizedWeekTotals[i]),
      })
    );

    const calcSmoothness = (arr: number[]) => {
      const mean = arr.reduce((s, v) => s + v, 0) / 4;
      if (mean <= 0) return 100;
      const stdDev = Math.sqrt(arr.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / 4);
      const cv = stdDev / mean;
      return Math.max(35, Math.min(98, Math.round(100 - cv * 38)));
    };

    const currentSmoothness = calcSmoothness(currentWeekTotals);
    const optimizedSmoothness = Math.max(currentSmoothness, calcSmoothness(optimizedWeekTotals));
    const totalPotentialFeesSaved = recommendations.reduce((sum, r) => sum + r.lateFeeSaved, 0);
    const actionableRecs = recommendations.filter((r) => r.isChanged && !ignoredIds[r.payment.id]);

    return {
      primaryPaydayDay,
      peakVariableWeek,
      recommendations,
      actionableCount: actionableRecs.length,
      weeklyComparisonData,
      currentSmoothness,
      optimizedSmoothness,
      totalPotentialFeesSaved,
    };
  }, [payments, paydayCycle, ignoredIds, currSym]);

  const handleApplyRecommendation = (rec: PaymentDateRecommendation) => {
    setAppliedMap((prev) => ({
      ...prev,
      [rec.payment.id]: {
        previousDate: rec.payment.dueDate,
        previousStatus: rec.payment.status,
        appliedDate: rec.recommendedDate,
      },
    }));
    onUpdatePayment(rec.payment.id, {
      dueDate: rec.recommendedDate,
      status: 'pendiente',
    });
  };

  const handleUndoApplied = (paymentId: string) => {
    const rec = appliedMap[paymentId];
    if (!rec) return;
    onUpdatePayment(paymentId, {
      dueDate: rec.previousDate,
      status: rec.previousStatus,
    });
    setAppliedMap((prev) => {
      const next = { ...prev };
      delete next[paymentId];
      return next;
    });
  };

  const handleIgnoreRecommendation = (paymentId: string) => {
    setIgnoredIds((prev) => ({ ...prev, [paymentId]: true }));
  };

  const handleApplyAllRecommendations = () => {
    const nextApplied = { ...appliedMap };
    analysis.recommendations.forEach((rec) => {
      if (rec.isChanged && !ignoredIds[rec.payment.id] && !nextApplied[rec.payment.id]) {
        nextApplied[rec.payment.id] = {
          previousDate: rec.payment.dueDate,
          previousStatus: rec.payment.status,
          appliedDate: rec.recommendedDate,
        };
        onUpdatePayment(rec.payment.id, {
          dueDate: rec.recommendedDate,
          status: 'pendiente',
        });
      }
    });
    setAppliedMap(nextApplied);
  };

  const WeeklyTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    const d = payload[0]?.payload;
    if (!d) return null;

    return (
      <div
        className={`px-3 py-2 rounded-xl border shadow-lg text-xs backdrop-blur-md ${
          isNitido
            ? 'bg-white/95 border-slate-200 text-slate-900'
            : 'bg-slate-900/95 border-slate-700 text-slate-100'
        }`}
      >
        <p className="font-bold mb-1">{label}</p>
        <div className="space-y-1 tabular-nums">
          <div className="flex items-center justify-between gap-4">
            <span className={isNitido ? 'text-slate-600' : 'text-slate-400'}>Calendario actual:</span>
            <span className="font-semibold">{currSym}{d.actualOutflow.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className={isNitido ? 'text-slate-600' : 'text-slate-400'}>Calendario IA:</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">
              {currSym}{d.optimizedOutflow.toLocaleString()}
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

  const visibleRecommendations = analysis.recommendations.filter(
    (r) => !ignoredIds[r.payment.id]
  );

  return (
    <section
      aria-label="AI Payment Recommender · Fechas Óptimas de Pago"
      className={`rounded-2xl border p-5 sm:p-6 transition-colors ${cardSurfaceClass}`}
    >
      {/* Header Row */}
      <div className={`flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-5 border-b ${hairlineBorder}`}>
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <CalendarCheck2 className={`w-5 h-5 shrink-0 ${isNitido ? 'text-cyan-600' : 'text-cyan-400'}`} />
            <h3 className="text-base sm:text-lg font-bold tracking-tight">
              AI Payment Recommender · Fechas Óptimas de Pago
            </h3>
            {analysis.totalPotentialFeesSaved > 0 && (
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border tabular-nums ${
                  isNitido
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-emerald-500/15 text-emerald-300 border-emerald-400/35'
                }`}
              >
                Protección mora: {currSym}{analysis.totalPotentialFeesSaved.toLocaleString()}
              </span>
            )}
          </div>
          <p className={`text-xs mt-1 ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
            Analiza tu ciclo de ingresos y hábitos de gasto semanal para sugerir fechas que maximizan liquidez y evitan recargos por retraso.
          </p>
        </div>

        {/* Payday Cycle Selector & Apply All */}
        <div className="flex flex-wrap items-center gap-2">
          <div
            className={`flex items-center p-1 rounded-lg border ${
              isNitido ? 'bg-slate-100 border-slate-200' : 'bg-slate-800 border-slate-700'
            }`}
          >
            {[
              { id: 'auto' as const, label: 'Auto (Sueldo)' },
              { id: 'biweekly_1_15' as const, label: 'Quincenal (1 y 15)' },
              { id: 'end_of_month' as const, label: 'Fin de mes' },
            ].map((cycle) => (
              <button
                key={cycle.id}
                type="button"
                onClick={() => setPaydayCycle(cycle.id)}
                className={`px-2.5 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                  paydayCycle === cycle.id
                    ? isNitido
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'bg-slate-700 text-white'
                    : isNitido
                    ? 'text-slate-600 hover:text-slate-900'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {cycle.label}
              </button>
            ))}
          </div>

          {analysis.actionableCount > 0 && (
            <button
              type="button"
              onClick={handleApplyAllRecommendations}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold whitespace-nowrap shrink-0 transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Aplicar todas ({analysis.actionableCount})</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Summary + Weekly Cash-Flow Smoothing Chart */}
      <div className={`grid grid-cols-1 xl:grid-cols-12 gap-6 py-5 border-b ${hairlineBorder}`}>
        <div className="xl:col-span-5 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-4">
          <div className="flex items-start justify-between gap-4 pb-3 border-b border-slate-200/70 dark:border-slate-800">
            <div>
              <span className={`text-xs block ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
                Índice de estabilidad de flujo
              </span>
              <div className="flex items-baseline gap-2 mt-0.5 tabular-nums">
                <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {analysis.optimizedSmoothness}/100
                </span>
                <span className={`text-xs ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
                  (actual: {analysis.currentSmoothness}/100)
                </span>
              </div>
            </div>
            <Wallet className={`w-5 h-5 shrink-0 ${isNitido ? 'text-slate-400' : 'text-slate-500'}`} />
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className={isNitido ? 'text-slate-600' : 'text-slate-400'}>
                Ciclo de ingreso detectado:
              </span>
              <strong className="tabular-nums">Día {analysis.primaryPaydayDay} de cada mes</strong>
            </div>
            <div className="flex items-center justify-between">
              <span className={isNitido ? 'text-slate-600' : 'text-slate-400'}>
                Pico de gasto variable:
              </span>
              <strong className="tabular-nums">Semana {analysis.peakVariableWeek + 1} del mes</strong>
            </div>
            <div className="flex items-center justify-between">
              <span className={isNitido ? 'text-slate-600' : 'text-slate-400'}>
                Recargos evitables detectados:
              </span>
              <strong className="tabular-nums text-emerald-600 dark:text-emerald-400">
                {currSym}{analysis.totalPotentialFeesSaved.toLocaleString()}
              </strong>
            </div>
          </div>

          {onOpenVoiceAssistant && (
            <button
              type="button"
              onClick={() =>
                onOpenVoiceAssistant(
                  `Mi pico de gasto variable ocurre en la semana ${analysis.peakVariableWeek + 1} y cobro alrededor del día ${analysis.primaryPaydayDay}. ¿Cómo distribuyo mejor mis fechas de pago este mes?`
                )
              }
              className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border whitespace-nowrap transition-colors ${
                isNitido
                  ? 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                  : 'bg-slate-800/70 hover:bg-slate-800 text-slate-200 border-slate-700'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-500" />
              <span>Consultar distribución óptima con IA</span>
            </button>
          )}
        </div>

        {/* Right 7 cols: Recharts Weekly Cash-Flow Comparison */}
        <div className="xl:col-span-7 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-bold">Carga Semanal de Pagos: Actual vs. Recomendada</span>
            <div className="flex items-center gap-4 text-[11px]">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-slate-400 inline-block" />
                Actual
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 inline-block" />
                Recomendada IA
              </span>
            </div>
          </div>

          <div className="w-full h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={analysis.weeklyComparisonData}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis
                  dataKey="weekLabel"
                  tick={{ fontSize: 11, fill: axisColor }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v) => `${currSym}${v}`}
                  tick={{ fontSize: 11, fill: axisColor }}
                  axisLine={false}
                  tickLine={false}
                  width={52}
                />
                <Tooltip content={<WeeklyTooltip />} />
                <Bar
                  dataKey="actualOutflow"
                  name="Actual"
                  fill={isNitido ? '#94a3b8' : '#475569'}
                  radius={[4, 4, 0, 0]}
                  barSize={18}
                />
                <Bar
                  dataKey="optimizedOutflow"
                  name="Recomendada"
                  fill="#10b981"
                  radius={[4, 4, 0, 0]}
                  barSize={18}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recommendations List */}
      <div className="pt-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-bold">Calendario Sugerido por Pago</h4>
          {Object.keys(ignoredIds).length > 0 && (
            <button
              type="button"
              onClick={() => setIgnoredIds({})}
              className="text-xs font-semibold underline opacity-80 hover:opacity-100"
            >
              Mostrar ignorados ({Object.keys(ignoredIds).length})
            </button>
          )}
        </div>

        {visibleRecommendations.length === 0 ? (
          <div className={`py-8 text-center text-xs rounded-xl border ${hairlineBorder}`}>
            No hay sugerencias pendientes visibles en este momento.
          </div>
        ) : (
          <div className="space-y-2.5">
            {visibleRecommendations.map((rec) => {
              const applied = appliedMap[rec.payment.id];
              const isCritical = rec.urgency === 'critical';

              return (
                <div
                  key={rec.payment.id}
                  className={`p-4 rounded-xl border flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-colors ${
                    applied
                      ? isNitido
                        ? 'bg-emerald-50/70 border-emerald-200'
                        : 'bg-emerald-950/25 border-emerald-500/35'
                      : isCritical
                      ? isNitido
                        ? 'bg-amber-50/60 border-amber-200'
                        : 'bg-amber-950/25 border-amber-500/35'
                      : isNitido
                      ? 'bg-slate-50/70 border-slate-200'
                      : 'bg-slate-950/40 border-slate-800'
                  }`}
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h5 className="text-sm font-bold truncate">{rec.payment.title}</h5>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          isCritical
                            ? isNitido
                              ? 'bg-amber-100 text-amber-900 border-amber-300'
                              : 'bg-amber-500/20 text-amber-300 border-amber-400/35'
                            : isNitido
                            ? 'bg-cyan-50 text-cyan-800 border-cyan-200'
                            : 'bg-cyan-500/15 text-cyan-300 border-cyan-400/30'
                        }`}
                      >
                        {isCritical && <ShieldAlert className="w-3 h-3" />}
                        <span>{rec.benefitTag}</span>
                      </span>
                      <span className="text-xs font-bold tabular-nums">
                        {currSym}{rec.payment.amount.toLocaleString()}
                      </span>
                    </div>

                    <p className={`text-xs leading-relaxed ${isNitido ? 'text-slate-600' : 'text-slate-300'}`}>
                      {rec.reason}
                    </p>
                  </div>

                  {/* Date Shift & Apply/Ignore Actions */}
                  <div className="flex flex-wrap items-center gap-3 shrink-0">
                    <div className="text-left lg:text-right tabular-nums text-xs">
                      {applied ? (
                        <div>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                            Reprogramado: {applied.previousDate}
                          </span>
                          <strong className="text-emerald-600 dark:text-emerald-400">
                            Nueva fecha: {applied.appliedDate}
                          </strong>
                        </div>
                      ) : rec.isChanged ? (
                        <div className="flex items-center gap-1.5">
                          <span className={isNitido ? 'text-slate-500' : 'text-slate-400'}>
                            {rec.currentDate}
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 opacity-60" />
                          <strong className="text-emerald-600 dark:text-emerald-400">
                            {rec.recommendedDate}
                          </strong>
                        </div>
                      ) : (
                        <span className={isNitido ? 'text-slate-600 font-semibold' : 'text-slate-300 font-semibold'}>
                          {rec.currentDate} (Óptima)
                        </span>
                      )}
                    </div>

                    {applied ? (
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border whitespace-nowrap ${
                            isNitido
                              ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                              : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Aplicado</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUndoApplied(rec.payment.id)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border whitespace-nowrap shrink-0 transition-colors ${
                            isNitido
                              ? 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                          }`}
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Deshacer</span>
                        </button>
                      </div>
                    ) : rec.isChanged ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleApplyRecommendation(rec)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold whitespace-nowrap shrink-0 transition-colors"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Aplicar fecha</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleIgnoreRecommendation(rec.payment.id)}
                          aria-label={`Ignorar recomendación para ${rec.payment.title}`}
                          className={`p-1.5 rounded-lg border transition-colors ${
                            isNitido
                              ? 'bg-white hover:bg-slate-100 text-slate-500 border-slate-200'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border-slate-700'
                          }`}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : null}
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
