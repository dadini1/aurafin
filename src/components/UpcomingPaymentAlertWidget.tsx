import React, { useEffect, useMemo, useState } from 'react';
import {
  BellRing,
  Clock,
  CheckCircle2,
  CalendarClock,
  AlertTriangle,
  Plus,
} from 'lucide-react';
import { PaymentItem, UserFinancialProfile } from '../types';
import { useTheme } from '../context/ThemeContext';

interface UpcomingPaymentAlertWidgetProps {
  payments: PaymentItem[];
  profile: UserFinancialProfile;
  onTogglePaymentStatus: (id: string) => void;
  onRescheduleToTomorrow?: (id: string, nextDateStr: string) => void;
  onOpenAddModal?: () => void;
}

interface CountdownParts {
  status: 'within_24h' | 'upcoming' | 'overdue';
  totalMsRemaining: number;
  hours: number;
  minutes: number;
  seconds: number;
  daysAhead: number;
  overdueDays: number;
  overdueHours: number;
  /** 0 to 100 percentage of the 24-hour countdown window remaining */
  countdown24hPercent: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function parseDueEndLocal(dueDateStr: string): number {
  const parts = dueDateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) {
    return Date.now() + DAY_MS;
  }
  const [year, month, day] = parts;
  return new Date(year, month - 1, day, 23, 59, 59, 999).getTime();
}

function getLocalTodayKey(nowMs: number): string {
  const d = new Date(nowMs);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getTomorrowKey(nowMs: number): string {
  const d = new Date(nowMs);
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function computeCountdown(dueDateStr: string, nowMs: number): CountdownParts {
  const dueEndMs = parseDueEndLocal(dueDateStr);
  const diff = dueEndMs - nowMs;

  if (diff < 0) {
    const absMs = Math.abs(diff);
    const overdueDays = Math.floor(absMs / DAY_MS);
    const overdueHours = Math.floor((absMs % DAY_MS) / (60 * 60 * 1000));
    return {
      status: 'overdue',
      totalMsRemaining: diff,
      hours: 0,
      minutes: 0,
      seconds: 0,
      daysAhead: 0,
      overdueDays,
      overdueHours,
      countdown24hPercent: 0,
    };
  }

  if (diff <= DAY_MS) {
    const hours = Math.floor(diff / (60 * 60 * 1000));
    const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
    const seconds = Math.floor((diff % (60 * 1000)) / 1000);
    return {
      status: 'within_24h',
      totalMsRemaining: diff,
      hours,
      minutes,
      seconds,
      daysAhead: 0,
      overdueDays: 0,
      overdueHours: 0,
      countdown24hPercent: Math.max(2, Math.min(100, Math.round((diff / DAY_MS) * 100))),
    };
  }

  const daysAhead = Math.floor(diff / DAY_MS);
  const remMs = diff % DAY_MS;
  const hours = Math.floor(remMs / (60 * 60 * 1000));
  const minutes = Math.floor((remMs % (60 * 60 * 1000)) / (60 * 1000));
  const seconds = Math.floor((remMs % (60 * 1000)) / 1000);

  return {
    status: 'upcoming',
    totalMsRemaining: diff,
    hours,
    minutes,
    seconds,
    daysAhead,
    overdueDays: 0,
    overdueHours: 0,
    countdown24hPercent: 100,
  };
}

function pad2(n: number): string {
  return String(Math.max(0, n)).padStart(2, '0');
}

const CATEGORY_LABELS: Record<string, string> = {
  alquiler: 'Vivienda',
  transporte: 'Transporte',
  alimentacion: 'Alimentación',
  servicios: 'Servicios',
  ocio: 'Ocio',
  salud: 'Salud',
  educacion: 'Educación',
  otro: 'Otro',
};

export const UpcomingPaymentAlertWidget: React.FC<UpcomingPaymentAlertWidgetProps> = ({
  payments,
  profile,
  onTogglePaymentStatus,
  onRescheduleToTomorrow,
  onOpenAddModal,
}) => {
  const { isNitido, isVibrant } = useTheme();
  const currSym = profile.currencySymbol || '$';
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  // 1-second live tick for the 24-hour visual countdown
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const todayKey = useMemo(() => getLocalTodayKey(nowMs), [nowMs]);
  const tomorrowKey = useMemo(() => getTomorrowKey(nowMs), [nowMs]);

  // Select the next 3 due unpaid expense bills:
  // 1) Upcoming bills (dueDate >= today) sorted nearest-first
  // 2) If fewer than 3 upcoming bills exist, backfill with most recently due unpaid bills
  const nextThreeDueBills = useMemo(() => {
    const unpaidBills = payments.filter(
      (p) => p.type === 'gasto' && p.status !== 'pagado' && Boolean(p.dueDate)
    );

    const upcoming = unpaidBills
      .filter((p) => p.dueDate >= todayKey)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || b.amount - a.amount);

    const pastDue = unpaidBills
      .filter((p) => p.dueDate < todayKey)
      .sort((a, b) => b.dueDate.localeCompare(a.dueDate) || b.amount - a.amount);

    return [...upcoming, ...pastDue].slice(0, 3);
  }, [payments, todayKey]);

  const totalPendingNext3 = useMemo(
    () => nextThreeDueBills.reduce((sum, b) => sum + (Number(b.amount) || 0), 0),
    [nextThreeDueBills]
  );

  const urgentCount = useMemo(
    () =>
      nextThreeDueBills.filter((b) => {
        const cd = computeCountdown(b.dueDate, nowMs);
        return cd.status === 'within_24h' || cd.status === 'overdue';
      }).length,
    [nextThreeDueBills, nowMs]
  );

  const cardSurfaceClass = isNitido
    ? 'bg-white border-slate-200 text-slate-900 shadow-xs'
    : isVibrant
    ? 'bg-slate-900/95 border-cyan-500/30 text-slate-100'
    : 'bg-slate-900 border-slate-800 text-slate-100';

  const hairlineBorder = isNitido ? 'border-slate-200/80' : 'border-slate-800';

  return (
    <section
      aria-label="Alerta de Próximos Pagos con Cuenta Regresiva de 24 Horas"
      className={`rounded-2xl border p-5 sm:p-6 transition-colors ${cardSurfaceClass}`}
    >
      {/* Header Row */}
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b ${hairlineBorder}`}>
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <BellRing
              className={`w-5 h-5 shrink-0 ${
                urgentCount > 0
                  ? isNitido
                    ? 'text-amber-600'
                    : 'text-amber-400'
                  : isNitido
                  ? 'text-emerald-600'
                  : 'text-emerald-400'
              }`}
            />
            <h3 className="text-base sm:text-lg font-bold tracking-tight">
              Upcoming Payment Alert · Próximos 3 Vencimientos
            </h3>
            {urgentCount > 0 && (
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border tabular-nums ${
                  isNitido
                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                    : 'bg-amber-500/15 text-amber-300 border-amber-400/35'
                }`}
              >
                {urgentCount} prioritario{urgentCount === 1 ? '' : 's'}
              </span>
            )}
          </div>
          <p className={`text-xs mt-1 ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
            Cuenta regresiva visual de 24 horas en tiempo real para tus próximos recibos y facturas por pagar.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {nextThreeDueBills.length > 0 && (
            <div className="text-left sm:text-right tabular-nums">
              <span className={`text-[11px] block ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
                Total próximos 3 pagos
              </span>
              <span className="text-base font-bold">
                {currSym}{totalPendingNext3.toLocaleString()}
              </span>
            </div>
          )}

          {onOpenAddModal && (
            <button
              type="button"
              onClick={onOpenAddModal}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 border transition-colors ${
                isNitido
                  ? 'bg-slate-900 hover:bg-slate-800 text-white border-slate-900'
                  : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 border-cyan-400'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nuevo Pago</span>
            </button>
          )}
        </div>
      </div>

      {/* Body: Next 3 Due Bills */}
      {nextThreeDueBills.length === 0 ? (
        <div className="py-10 text-center space-y-2">
          <div
            className={`w-11 h-11 rounded-2xl mx-auto flex items-center justify-center border ${
              isNitido
                ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
            }`}
          >
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <h4 className="text-sm font-bold">Sin pagos pendientes próximos</h4>
          <p className={`text-xs max-w-md mx-auto ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
            Todos tus recibos y facturas programadas están al día. Cuando agregues nuevos gastos pendientes aparecerán aquí con su alerta y cuenta regresiva de 24h.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pt-5">
          {nextThreeDueBills.map((bill) => {
            const countdown = computeCountdown(bill.dueDate, nowMs);
            const is24h = countdown.status === 'within_24h';
            const isOverdue = countdown.status === 'overdue';

            const ringRadius = 20;
            const ringCircumference = 2 * Math.PI * ringRadius;
            const strokeDashoffset =
              ringCircumference * (1 - countdown.countdown24hPercent / 100);

            const ringColor = isOverdue
              ? '#e11d48'
              : is24h
              ? '#f59e0b'
              : '#06b6d4';

            const cardHighlight = isOverdue
              ? isNitido
                ? 'bg-rose-50/60 border-rose-200'
                : 'bg-rose-950/25 border-rose-500/35'
              : is24h
              ? isNitido
                ? 'bg-amber-50/70 border-amber-200'
                : 'bg-amber-950/25 border-amber-500/35'
              : isNitido
              ? 'bg-slate-50/70 border-slate-200'
              : 'bg-slate-950/50 border-slate-800';

            const countdownClockText = isOverdue
              ? '00:00:00'
              : `${pad2(countdown.hours)}:${pad2(countdown.minutes)}:${pad2(countdown.seconds)}`;

            return (
              <div
                key={bill.id}
                className={`p-4 rounded-xl border flex flex-col justify-between gap-4 transition-colors ${cardHighlight}`}
              >
                {/* Top Row: Bill Info + Circular 24h Visual Ring */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`text-[11px] font-bold ${
                          isOverdue
                            ? isNitido
                              ? 'text-rose-700'
                              : 'text-rose-300'
                            : is24h
                            ? isNitido
                              ? 'text-amber-700'
                              : 'text-amber-300'
                            : isNitido
                            ? 'text-cyan-700'
                            : 'text-cyan-300'
                        }`}
                      >
                        {isOverdue
                          ? countdown.overdueDays > 0
                            ? `Vencido hace ${countdown.overdueDays}d ${countdown.overdueHours}h`
                            : `Vencido hace ${countdown.overdueHours}h`
                          : is24h
                          ? 'Vence en menos de 24h'
                          : `En ${countdown.daysAhead} día${countdown.daysAhead === 1 ? '' : 's'}`}
                      </span>
                      <span className={`text-[11px] ${isNitido ? 'text-slate-400' : 'text-slate-500'}`}>
                        ·
                      </span>
                      <span className={`text-[11px] font-medium ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
                        {CATEGORY_LABELS[bill.category] || bill.category}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold truncate mt-1" title={bill.title}>
                      {bill.title}
                    </h4>

                    <div className="flex items-baseline gap-2 mt-1.5 tabular-nums">
                      <span className="text-lg font-bold">
                        {currSym}{bill.amount.toLocaleString()}
                      </span>
                      <span className={`text-[11px] ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
                        Fecha límite: {bill.dueDate}
                      </span>
                    </div>
                  </div>

                  {/* 24-Hour Circular Visual Countdown Gauge */}
                  <div className="relative w-12 h-12 shrink-0 flex items-center justify-center">
                    <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48" aria-hidden="true">
                      <circle
                        cx="24"
                        cy="24"
                        r={ringRadius}
                        fill="none"
                        stroke={isNitido ? '#e2e8f0' : '#1e293b'}
                        strokeWidth="4"
                      />
                      <circle
                        cx="24"
                        cy="24"
                        r={ringRadius}
                        fill="none"
                        stroke={ringColor}
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeDasharray={ringCircumference}
                        strokeDashoffset={strokeDashoffset}
                        className="transition-all duration-500"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      {isOverdue ? (
                        <AlertTriangle className="w-4 h-4 text-rose-500" />
                      ) : (
                        <span className="text-[10px] font-bold tabular-nums">
                          {is24h ? `${countdown.hours}h` : `${countdown.daysAhead}d`}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Live 24-Hour Digital Countdown Bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs tabular-nums">
                    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${isNitido ? 'text-slate-600' : 'text-slate-300'}`}>
                      <Clock className="w-3.5 h-3.5 opacity-75" />
                      <span>{is24h ? 'Ventana 24h:' : isOverdue ? 'Tiempo límite:' : 'Reloj 24h:'}</span>
                    </span>
                    <span
                      className={`font-mono text-xs font-bold tracking-tight ${
                        isOverdue
                          ? 'text-rose-600 dark:text-rose-400'
                          : is24h
                          ? 'text-amber-700 dark:text-amber-300'
                          : isNitido
                          ? 'text-slate-900'
                          : 'text-white'
                      }`}
                    >
                      {countdownClockText}
                    </span>
                  </div>

                  <div
                    className={`h-1.5 w-full rounded-full overflow-hidden ${
                      isNitido ? 'bg-slate-200/80' : 'bg-slate-800'
                    }`}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${countdown.countdown24hPercent}%`,
                        backgroundColor: ringColor,
                      }}
                    />
                  </div>
                </div>

                {/* Quick Actions: Mark Paid or Snooze to Tomorrow (24h window) */}
                <div className={`pt-2.5 border-t flex items-center justify-between gap-2 ${hairlineBorder}`}>
                  {onRescheduleToTomorrow && isOverdue ? (
                    <button
                      type="button"
                      onClick={() => onRescheduleToTomorrow(bill.id, tomorrowKey)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border whitespace-nowrap shrink-0 transition-colors ${
                        isNitido
                          ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                      }`}
                    >
                      <CalendarClock className="w-3.5 h-3.5" />
                      <span>Reprogramar +24h</span>
                    </button>
                  ) : (
                    <span className={`text-[11px] font-medium ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
                      {bill.frequency === 'mensual' ? 'Recurrente mensual' : 'Pago programado'}
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => onTogglePaymentStatus(bill.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold whitespace-nowrap shrink-0 transition-colors"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Marcar pagado</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
