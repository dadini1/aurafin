import React, { useEffect, useMemo, useState } from 'react';
import {
  Flag,
  CheckCircle2,
  Clock,
  Trophy,
  DollarSign,
  ShieldCheck,
  Target,
  Sparkles,
  Plus,
  Trash2,
  Calendar,
  ArrowRight,
  Check,
} from 'lucide-react';
import { PaymentItem, SavingsGoal, UserFinancialProfile } from '../types';
import { useTheme } from '../context/ThemeContext';

interface FinancialMilestonesTimelineProps {
  goals: SavingsGoal[];
  payments: PaymentItem[];
  profile: UserFinancialProfile;
  netSavings: number;
  onOpenAddGoal?: () => void;
}

type MilestoneKind = 'savings' | 'debt_free' | 'goal' | 'custom';

interface TimelineMilestone {
  id: string;
  title: string;
  subtitle: string;
  date: string; // YYYY-MM-DD
  kind: MilestoneKind;
  achieved: boolean;
  isCustom?: boolean;
  targetAmount?: number;
  currentAmount?: number;
  progressPercent: number;
  insight: string;
}

interface CustomTimelineMilestone {
  id: string;
  title: string;
  date: string;
  targetAmount?: number;
  kind: MilestoneKind;
  achieved: boolean;
  notes?: string;
}

const CUSTOM_MILESTONES_STORAGE_KEY = 'aurafin_financial_timeline_custom_v1';

function toLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addMonthsToDateKey(months: number, baseDate: Date = new Date()): string {
  const d = new Date(baseDate.getFullYear(), baseDate.getMonth() + Math.max(0, months), baseDate.getDate());
  return toLocalDateKey(d);
}

function formatReadableDate(dateStr: string): string {
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return dateStr;
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatRelativeTime(dateStr: string, achieved: boolean): string {
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return '';
  const target = new Date(parts[0], parts[1] - 1, parts[2]).getTime();
  const now = new Date();
  const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const diffDays = Math.round((target - todayMid) / (24 * 60 * 60 * 1000));

  if (diffDays === 0) return 'Hoy';
  if (diffDays > 0) {
    if (diffDays < 30) return `En ${diffDays} día${diffDays === 1 ? '' : 's'}`;
    const months = Math.round(diffDays / 30.4);
    return `En ~${months} mes${months === 1 ? '' : 'es'}`;
  }
  const absDays = Math.abs(diffDays);
  if (absDays < 30) return `${achieved ? 'Logrado' : 'Pasó'} hace ${absDays} día${absDays === 1 ? '' : 's'}`;
  const absMonths = Math.round(absDays / 30.4);
  return `${achieved ? 'Logrado' : 'Pasó'} hace ~${absMonths} mes${absMonths === 1 ? '' : 'es'}`;
}

function getKindIcon(kind: MilestoneKind, achieved: boolean) {
  if (achieved && kind === 'savings') return Trophy;
  switch (kind) {
    case 'savings':
      return DollarSign;
    case 'debt_free':
      return ShieldCheck;
    case 'goal':
      return Target;
    case 'custom':
    default:
      return Sparkles;
  }
}

export const FinancialMilestonesTimeline: React.FC<FinancialMilestonesTimelineProps> = ({
  goals,
  payments,
  profile,
  netSavings,
  onOpenAddGoal,
}) => {
  const { isNitido, isVibrant } = useTheme();
  const currSym = profile.currencySymbol || '$';

  const [filterKind, setFilterKind] = useState<'all' | 'achieved' | 'upcoming' | 'milestones'>('all');
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Add custom milestone form state
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState(() => addMonthsToDateKey(3));
  const [newAmount, setNewAmount] = useState('');
  const [newKind, setNewKind] = useState<MilestoneKind>('custom');

  const [customMilestones, setCustomMilestones] = useState<CustomTimelineMilestone[]>(() => {
    try {
      const saved = localStorage.getItem(CUSTOM_MILESTONES_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(CUSTOM_MILESTONES_STORAGE_KEY, JSON.stringify(customMilestones));
    } catch {
      // ignore storage errors
    }
  }, [customMilestones]);

  const timelineData = useMemo(() => {
    const today = new Date();
    const todayKey = toLocalDateKey(today);

    const totalSaved = goals.reduce((sum, g) => sum + Math.max(0, Number(g.currentAmount) || 0), 0);
    const totalGoalsTarget = goals.reduce((sum, g) => sum + Math.max(0, Number(g.targetAmount) || 0), 0);
    const totalMonthlyCommitment = goals.reduce(
      (sum, g) => sum + Math.max(0, Number(g.monthlyContribution) || 0),
      0
    );
    const monthlyPace = Math.max(50, totalMonthlyCommitment || Math.max(0, netSavings));

    const earliestGoalDate =
      goals
        .map((g) => g.createdAt)
        .filter(Boolean)
        .sort()[0] || addMonthsToDateKey(-2, today);

    const items: TimelineMilestone[] = [];

    // 1. Monetary Savings Milestones: First $1,000, $5,000, $10,000, $20,000
    const monetaryCheckpoints = [
      {
        id: 'ms-first-1000',
        amount: 1000,
        title: `Primeros ${currSym}1,000 Ahorrados`,
        subtitle: 'Fondo base inicial consolidado',
      },
      {
        id: 'ms-5000',
        amount: 5000,
        title: `Hito de ${currSym}5,000 Acumulados`,
        subtitle: 'Respaldo sólido de capital personal',
      },
      {
        id: 'ms-10000',
        amount: 10000,
        title: `Hito de ${currSym}10,000 Acumulados`,
        subtitle: 'Nivel de libertad e inversión inicial',
      },
    ];

    if (totalGoalsTarget >= 15000 || totalSaved >= 8000) {
      monetaryCheckpoints.push({
        id: 'ms-20000',
        amount: 20000,
        title: `Meta Patrimonio ${currSym}20,000`,
        subtitle: 'Consolidación de metas patrimoniales',
      });
    }

    monetaryCheckpoints.forEach((cp, idx) => {
      const achieved = totalSaved >= cp.amount;
      const pct = Math.min(100, Math.round((totalSaved / cp.amount) * 100));
      let dateKey = todayKey;

      if (achieved) {
        // Place achieved milestones chronologically in recent history before today
        const monthsAgo = Math.max(0, monetaryCheckpoints.length - 1 - idx);
        const baseD = new Date(today.getFullYear(), today.getMonth() - monthsAgo, Math.min(28, today.getDate()));
        dateKey = idx === 0 && earliestGoalDate < todayKey ? earliestGoalDate : toLocalDateKey(baseD);
      } else {
        const remaining = cp.amount - totalSaved;
        const monthsNeeded = Math.max(1, Math.ceil(remaining / monthlyPace));
        dateKey = addMonthsToDateKey(monthsNeeded, today);
      }

      items.push({
        id: cp.id,
        title: cp.title,
        subtitle: cp.subtitle,
        date: dateKey,
        kind: 'savings',
        achieved,
        targetAmount: cp.amount,
        currentAmount: Math.min(cp.amount, totalSaved),
        progressPercent: pct,
        insight: achieved
          ? `¡Logrado! Tu ahorro acumulado (${currSym}${totalSaved.toLocaleString()}) ya superó el umbral de ${currSym}${cp.amount.toLocaleString()}.`
          : `Te faltan ${currSym}${(cp.amount - totalSaved).toLocaleString()} para este hito. Al ritmo actual (~${currSym}${monthlyPace.toLocaleString()}/mes), lo alcanzarás en ${formatReadableDate(dateKey)}.`,
      });
    });

    // 2. Debt-Free / Zero Pending Obligations Date
    const unpaidBills = payments.filter((p) => p.type === 'gasto' && p.status !== 'pagado');
    const unpaidTotal = unpaidBills.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const debtAchieved = unpaidTotal <= 0;

    let debtFreeDate = todayKey;
    if (!debtAchieved) {
      const latestBillDate = unpaidBills
        .map((p) => p.dueDate)
        .filter(Boolean)
        .sort()
        .pop();
      const capacity = Math.max(100, netSavings > 0 ? netSavings : profile.monthlyIncome * 0.25);
      const monthsToClear = Math.ceil(unpaidTotal / capacity);
      const projectedPayoff = addMonthsToDateKey(monthsToClear, today);
      debtFreeDate =
        latestBillDate && latestBillDate > todayKey && monthsToClear <= 1
          ? latestBillDate
          : projectedPayoff;
    }

    items.push({
      id: 'ms-debt-free-date',
      title: 'Debt-Free Date · Libre de Pagos Pendientes',
      subtitle: debtAchieved
        ? '0 obligaciones pendientes este ciclo'
        : `${unpaidBills.length} compromiso${unpaidBills.length === 1 ? '' : 's'} por liquidar (${currSym}${unpaidTotal.toLocaleString()})`,
      date: debtFreeDate,
      kind: 'debt_free',
      achieved: debtAchieved,
      targetAmount: unpaidTotal > 0 ? unpaidTotal : undefined,
      currentAmount: debtAchieved ? 0 : undefined,
      progressPercent: debtAchieved ? 100 : Math.max(15, Math.min(90, Math.round((Math.max(0, netSavings) / Math.max(1, unpaidTotal)) * 100))),
      insight: debtAchieved
        ? 'No tienes recibos ni compromisos pendientes por liquidar en este momento.'
        : `Liquidando ${currSym}${unpaidTotal.toLocaleString()} en pagos y deudas pendientes con tu flujo neto mensual, quedarías libre de saldo pendiente hacia ${formatReadableDate(debtFreeDate)}.`,
    });

    // 3. Individual Savings Goals completion dates
    goals.forEach((goal) => {
      const target = Math.max(1, Number(goal.targetAmount) || 1);
      const saved = Math.max(0, Number(goal.currentAmount) || 0);
      const pct = Math.min(100, Math.round((saved / target) * 100));
      const achieved = saved >= target;
      const remaining = Math.max(0, target - saved);
      const monthly = Math.max(1, Number(goal.monthlyContribution) || monthlyPace);
      const estimatedMonths = remaining === 0 ? 0 : Math.ceil(remaining / monthly);
      const estimatedDate = addMonthsToDateKey(estimatedMonths, today);

      items.push({
        id: `ms-goal-${goal.id}`,
        title: goal.title,
        subtitle: achieved ? 'Meta completada al 100%' : `Meta programada (${pct}% completado)`,
        date: achieved ? todayKey : goal.deadline || estimatedDate,
        kind: 'goal',
        achieved,
        targetAmount: target,
        currentAmount: saved,
        progressPercent: pct,
        insight: achieved
          ? `¡Felicidades! Alcanzaste el 100% de "${goal.title}" (${currSym}${target.toLocaleString()}).`
          : `Llevas ${currSym}${saved.toLocaleString()} de ${currSym}${target.toLocaleString()}. Aportando ${currSym}${monthly.toLocaleString()}/mes completarías esta meta alrededor de ${formatReadableDate(estimatedDate)}.`,
      });
    });

    // 4. Custom User Milestones
    customMilestones.forEach((cm) => {
      items.push({
        id: cm.id,
        title: cm.title,
        subtitle: cm.achieved ? 'Logro personalizado completado' : 'Hito personalizado programado',
        date: cm.date,
        kind: cm.kind,
        achieved: cm.achieved,
        isCustom: true,
        targetAmount: cm.targetAmount,
        currentAmount: cm.achieved ? cm.targetAmount : 0,
        progressPercent: cm.achieved ? 100 : 0,
        insight:
          cm.notes ||
          (cm.achieved
            ? `Completaste este hito personalizado (${formatReadableDate(cm.date)}).`
            : `Hito personalizado programado para ${formatReadableDate(cm.date)}.`),
      });
    });

    // Sort chronologically (oldest / achieved -> nearest upcoming -> long-term)
    items.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      if (a.achieved !== b.achieved) return a.achieved ? -1 : 1;
      return (a.targetAmount || 0) - (b.targetAmount || 0);
    });

    const achievedCount = items.filter((i) => i.achieved).length;
    const nextUpcoming = items.find((i) => !i.achieved) || null;
    const first1000Item = items.find((i) => i.id === 'ms-first-1000') || null;
    const debtFreeItem = items.find((i) => i.id === 'ms-debt-free-date') || null;

    return {
      items,
      achievedCount,
      upcomingCount: items.length - achievedCount,
      nextUpcoming,
      first1000Item,
      debtFreeItem,
    };
  }, [goals, payments, profile, netSavings, customMilestones, currSym]);

  const filteredMilestones = useMemo(() => {
    return timelineData.items.filter((m) => {
      if (filterKind === 'achieved') return m.achieved;
      if (filterKind === 'upcoming') return !m.achieved;
      if (filterKind === 'milestones') return m.kind === 'savings' || m.kind === 'debt_free';
      return true;
    });
  }, [timelineData.items, filterKind]);

  const selectedMilestone = useMemo(() => {
    if (selectedMilestoneId) {
      const found = filteredMilestones.find((m) => m.id === selectedMilestoneId);
      if (found) return found;
    }
    return (
      filteredMilestones.find((m) => !m.achieved) ||
      filteredMilestones[filteredMilestones.length - 1] ||
      null
    );
  }, [filteredMilestones, selectedMilestoneId]);

  const handleCreateCustomMilestone = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDate) return;
    const parsedAmt = Number(newAmount);
    const created: CustomTimelineMilestone = {
      id: `ms-custom-${Date.now()}`,
      title: newTitle.trim(),
      date: newDate,
      targetAmount: !Number.isNaN(parsedAmt) && parsedAmt > 0 ? parsedAmt : undefined,
      kind: newKind,
      achieved: false,
    };
    setCustomMilestones((prev) => [...prev, created]);
    setSelectedMilestoneId(created.id);
    setNewTitle('');
    setNewAmount('');
    setIsAddOpen(false);
  };

  const handleToggleCustomAchieved = (id: string) => {
    setCustomMilestones((prev) =>
      prev.map((m) => (m.id === id ? { ...m, achieved: !m.achieved } : m))
    );
  };

  const handleDeleteCustom = (id: string) => {
    setCustomMilestones((prev) => prev.filter((m) => m.id !== id));
    if (selectedMilestoneId === id) setSelectedMilestoneId(null);
  };

  const cardSurfaceClass = isNitido
    ? 'bg-white border-slate-200 text-slate-900 shadow-xs'
    : isVibrant
    ? 'bg-slate-900/95 border-cyan-500/30 text-slate-100'
    : 'bg-slate-900 border-slate-800 text-slate-100';

  const hairlineBorder = isNitido ? 'border-slate-200/80' : 'border-slate-800';

  return (
    <section
      aria-label="Línea de Tiempo Interactiva de Hitos Financieros"
      className={`rounded-2xl border p-5 sm:p-6 transition-colors ${cardSurfaceClass}`}
    >
      {/* Header Row */}
      <div className={`flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b ${hairlineBorder}`}>
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Flag className={`w-5 h-5 shrink-0 ${isNitido ? 'text-indigo-600' : 'text-cyan-400'}`} />
            <h3 className="text-base sm:text-lg font-bold tracking-tight">
              Financial Milestones Timeline · Línea de Tiempo de Logros
            </h3>
          </div>
          <p className={`text-xs mt-1 ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
            <span>Visualiza fechas clave hacia tus metas: Primeros {currSym}1,000, Debt-Free Date y cumplimiento de objetivos.</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsAddOpen((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 border transition-colors ${
              isNitido
                ? 'bg-slate-900 hover:bg-slate-800 text-white border-slate-900'
                : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 border-cyan-400'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Agregar hito</span>
          </button>

          {onOpenAddGoal && (
            <button
              type="button"
              onClick={onOpenAddGoal}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border whitespace-nowrap shrink-0 transition-colors ${
                isNitido
                  ? 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
            >
              <Target className="w-3.5 h-3.5" />
              <span>Nueva Meta</span>
            </button>
          )}
        </div>
      </div>

      {/* Add Custom Milestone Form */}
      {isAddOpen && (
        <form
          onSubmit={handleCreateCustomMilestone}
          className={`mt-4 p-4 rounded-xl border grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end ${
            isNitido ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/60 border-slate-800'
          }`}
        >
          <div className="lg:col-span-2">
            <label className="text-[11px] font-bold block mb-1">Nombre del hito</label>
            <input
              type="text"
              required
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Ej: Liquidar tarjeta o Primeros $3,000"
              className={`w-full px-3 py-2 rounded-lg border text-xs focus:outline-none ${
                isNitido
                  ? 'bg-white border-slate-300 text-slate-900'
                  : 'bg-slate-900 border-slate-700 text-white'
              }`}
            />
          </div>

          <div>
            <label className="text-[11px] font-bold block mb-1">Fecha objetivo</label>
            <input
              type="date"
              required
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className={`w-full px-3 py-2 rounded-lg border text-xs tabular-nums focus:outline-none ${
                isNitido
                  ? 'bg-white border-slate-300 text-slate-900'
                  : 'bg-slate-900 border-slate-700 text-white'
              }`}
            />
          </div>

          <div>
            <label className="text-[11px] font-bold block mb-1">Monto (opcional)</label>
            <input
              type="number"
              min={0}
              step="any"
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              placeholder={`${currSym}1,500`}
              className={`w-full px-3 py-2 rounded-lg border text-xs tabular-nums focus:outline-none ${
                isNitido
                  ? 'bg-white border-slate-300 text-slate-900'
                  : 'bg-slate-900 border-slate-700 text-white'
              }`}
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              aria-label="Tipo de hito"
              value={newKind}
              onChange={(e) => setNewKind(e.target.value as MilestoneKind)}
              className={`px-2.5 py-2 rounded-lg border text-xs focus:outline-none flex-1 ${
                isNitido
                  ? 'bg-white border-slate-300 text-slate-900'
                  : 'bg-slate-900 border-slate-700 text-white'
              }`}
            >
              <option value="custom">Personalizado</option>
              <option value="savings">Ahorro</option>
              <option value="debt_free">Libre de Deuda</option>
              <option value="goal">Meta</option>
            </select>
            <button
              type="submit"
              className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold whitespace-nowrap shrink-0"
            >
              Guardar
            </button>
          </div>
        </form>
      )}

      {/* 4-Column Summary Strip */}
      <div className={`grid grid-cols-2 lg:grid-cols-4 gap-4 py-5 border-b ${hairlineBorder}`}>
        <div>
          <span className={`text-xs block ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
            Logros completados
          </span>
          <span className="text-xl sm:text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400 mt-0.5 block">
            {timelineData.achievedCount} / {timelineData.items.length}
          </span>
        </div>

        <div>
          <span className={`text-xs block ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
            First {currSym}1,000 Milestone
          </span>
          <span className="text-base sm:text-lg font-bold tabular-nums mt-0.5 block">
            {timelineData.first1000Item?.achieved
              ? 'Completado'
              : timelineData.first1000Item
              ? formatReadableDate(timelineData.first1000Item.date)
              : 'Pendiente'}
          </span>
        </div>

        <div>
          <span className={`text-xs block ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
            Debt-Free Date estimada
          </span>
          <span className="text-base sm:text-lg font-bold tabular-nums mt-0.5 block">
            {timelineData.debtFreeItem?.achieved
              ? 'Al día (Hoy)'
              : timelineData.debtFreeItem
              ? formatReadableDate(timelineData.debtFreeItem.date)
              : 'Al día'}
          </span>
        </div>

        <div>
          <span className={`text-xs block ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
            Próximo hito en camino
          </span>
          <span className="text-sm font-bold truncate mt-0.5 block" title={timelineData.nextUpcoming?.title}>
            {timelineData.nextUpcoming ? timelineData.nextUpcoming.title : 'Todos los hitos logrados'}
          </span>
          {timelineData.nextUpcoming && (
            <span className={`text-[11px] tabular-nums ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
              {formatReadableDate(timelineData.nextUpcoming.date)} · {formatRelativeTime(timelineData.nextUpcoming.date, false)}
            </span>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-5 pb-4">
        <div
          className={`inline-flex flex-wrap items-center p-1 rounded-lg border ${
            isNitido ? 'bg-slate-100 border-slate-200' : 'bg-slate-800 border-slate-700'
          }`}
        >
          {[
            { id: 'all' as const, label: `Todos (${timelineData.items.length})` },
            { id: 'achieved' as const, label: `Logrados (${timelineData.achievedCount})` },
            { id: 'upcoming' as const, label: `Próximos (${timelineData.upcomingCount})` },
            { id: 'milestones' as const, label: 'Ahorro y Deuda' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterKind(tab.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                filterKind === tab.id
                  ? isNitido
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'bg-slate-700 text-white'
                  : isNitido
                  ? 'text-slate-600 hover:text-slate-900'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <span className={`text-xs ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
          Haz clic en cualquier nodo de la línea de tiempo para inspeccionar su progreso
        </span>
      </div>

      {/* Interactive Chronological Rail */}
      {filteredMilestones.length === 0 ? (
        <div className={`py-8 text-center text-xs rounded-xl border ${hairlineBorder}`}>
          No hay hitos en esta vista.
        </div>
      ) : (
        <div className="space-y-5">
          <div className="overflow-x-auto pb-2">
            <div className="relative flex items-start gap-4 min-w-max px-2 pt-2">
              {/* Connecting Horizontal Track Line */}
              <div
                aria-hidden="true"
                className={`absolute left-8 right-8 top-7 h-0.5 ${
                  isNitido ? 'bg-slate-200' : 'bg-slate-800'
                }`}
              />

              {filteredMilestones.map((item) => {
                const IconComp = getKindIcon(item.kind, item.achieved);
                const isSelected = selectedMilestone?.id === item.id;
                const isNext = timelineData.nextUpcoming?.id === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedMilestoneId(item.id)}
                    className="relative z-10 flex flex-col items-center text-center w-40 shrink-0 group focus:outline-none"
                  >
                    {/* Node Icon Circle */}
                    <div
                      className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all ${
                        isSelected
                          ? isNitido
                            ? 'ring-4 ring-indigo-500/20 scale-105'
                            : 'ring-4 ring-cyan-400/25 scale-105'
                          : 'group-hover:scale-105'
                      } ${
                        item.achieved
                          ? 'bg-emerald-600 border-emerald-500 text-white'
                          : isNext
                          ? isNitido
                            ? 'bg-indigo-600 border-indigo-500 text-white'
                            : 'bg-cyan-500 border-cyan-400 text-slate-950'
                          : isNitido
                          ? 'bg-white border-slate-300 text-slate-600'
                          : 'bg-slate-900 border-slate-700 text-slate-300'
                      }`}
                    >
                      {item.achieved ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <IconComp className="w-4 h-4" />
                      )}
                    </div>

                    {/* Date & Title under node */}
                    <div
                      className={`mt-2.5 px-2.5 py-2 rounded-xl border w-full transition-colors ${
                        isSelected
                          ? isNitido
                            ? 'bg-indigo-50/70 border-indigo-300 text-slate-900'
                            : 'bg-slate-800 border-cyan-400/50 text-white'
                          : isNitido
                          ? 'bg-slate-50/70 border-slate-200 text-slate-700 group-hover:bg-slate-100'
                          : 'bg-slate-950/50 border-slate-800 text-slate-300 group-hover:bg-slate-800/60'
                      }`}
                    >
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wide block tabular-nums ${
                          item.achieved
                            ? isNitido
                              ? 'text-emerald-700'
                              : 'text-emerald-400'
                            : isNext
                            ? isNitido
                              ? 'text-indigo-700'
                              : 'text-cyan-300'
                            : isNitido
                            ? 'text-slate-500'
                            : 'text-slate-400'
                        }`}
                      >
                        {formatReadableDate(item.date)}
                      </span>
                      <span className="text-xs font-bold line-clamp-2 mt-0.5 leading-snug">
                        {item.title}
                      </span>
                      <span className={`text-[10px] mt-1 block tabular-nums ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
                        {item.achieved ? '100% logrado' : `${item.progressPercent}% avance`}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Milestone Inspector Panel */}
          {selectedMilestone && (
            <div
              className={`p-4 sm:p-5 rounded-xl border flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
                selectedMilestone.achieved
                  ? isNitido
                    ? 'bg-emerald-50/70 border-emerald-200'
                    : 'bg-emerald-950/25 border-emerald-500/35'
                  : isNitido
                  ? 'bg-slate-50/80 border-slate-200'
                  : 'bg-slate-950/50 border-slate-800'
              }`}
            >
              <div className="space-y-2 flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                      selectedMilestone.achieved
                        ? isNitido
                          ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                          : 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                        : isNitido
                        ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                        : 'bg-cyan-500/15 text-cyan-300 border-cyan-400/35'
                    }`}
                  >
                    {selectedMilestone.achieved ? (
                      <CheckCircle2 className="w-3 h-3" />
                    ) : (
                      <Clock className="w-3 h-3" />
                    )}
                    <span>{selectedMilestone.achieved ? 'Logrado' : 'En camino'}</span>
                  </span>

                  <span className={`inline-flex items-center gap-1 text-xs font-semibold tabular-nums ${isNitido ? 'text-slate-600' : 'text-slate-300'}`}>
                    <Calendar className="w-3.5 h-3.5 opacity-75" />
                    {formatReadableDate(selectedMilestone.date)} · {formatRelativeTime(selectedMilestone.date, selectedMilestone.achieved)}
                  </span>
                </div>

                <div>
                  <h4 className="text-base font-bold">{selectedMilestone.title}</h4>
                  <p className={`text-xs mt-1 leading-relaxed ${isNitido ? 'text-slate-700' : 'text-slate-300'}`}>
                    {selectedMilestone.insight}
                  </p>
                </div>
              </div>

              {/* Right: Progress Meter & Optional Custom Controls */}
              <div className="w-full lg:w-72 shrink-0 space-y-2.5">
                {selectedMilestone.targetAmount !== undefined && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-semibold tabular-nums">
                      <span>
                        {currSym}{(selectedMilestone.currentAmount ?? 0).toLocaleString()} / {currSym}
                        {selectedMilestone.targetAmount.toLocaleString()}
                      </span>
                      <span>{selectedMilestone.progressPercent}%</span>
                    </div>
                    <div className={`h-2 w-full rounded-full overflow-hidden ${isNitido ? 'bg-slate-200' : 'bg-slate-800'}`}>
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          selectedMilestone.achieved ? 'bg-emerald-500' : 'bg-indigo-500'
                        }`}
                        style={{ width: `${selectedMilestone.progressPercent}%` }}
                      />
                    </div>
                  </div>
                )}

                {selectedMilestone.isCustom && (
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleToggleCustomAchieved(selectedMilestone.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold whitespace-nowrap shrink-0 transition-colors"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                      <span>
                        {selectedMilestone.achieved ? 'Marcar pendiente' : 'Marcar logrado'}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteCustom(selectedMilestone.id)}
                      aria-label="Eliminar hito personalizado"
                      className={`p-1.5 rounded-lg border transition-colors ${
                        isNitido
                          ? 'bg-white hover:bg-rose-50 text-slate-500 hover:text-rose-700 border-slate-200'
                          : 'bg-slate-800 hover:bg-rose-950/50 text-slate-400 hover:text-rose-300 border-slate-700'
                      }`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
