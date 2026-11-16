import React, { useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Check,
  Plus,
  Filter,
  List,
  CalendarDays,
  Sparkles,
  Receipt,
  X,
  ExternalLink,
  Car,
  Home,
  ShoppingBag,
  Zap,
  Coffee,
  HeartPulse,
  BookOpen,
  DollarSign,
  Maximize2,
  Repeat,
  GripVertical,
  Undo2,
} from 'lucide-react';
import { PaymentItem, UserFinancialProfile } from '../types';
import { useTheme } from '../context/ThemeContext';

interface FinancialCalendarViewProps {
  payments: PaymentItem[];
  profile: UserFinancialProfile;
  onTogglePaymentStatus: (id: string) => void;
  onAddPaymentOnDate?: (dateStr: string) => void;
  onReschedulePayment?: (id: string, newDueDate: string) => void;
}

const CATEGORY_ICONS: Record<string, any> = {
  transporte: Car,
  alquiler: Home,
  alimentacion: ShoppingBag,
  servicios: Zap,
  ocio: Coffee,
  salud: HeartPulse,
  educacion: BookOpen,
  otro: DollarSign,
};

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  transporte: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
  alquiler: { bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/20' },
  alimentacion: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/20' },
  servicios: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/20' },
  ocio: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20' },
  salud: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
  educacion: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
  otro: { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/20' },
};

export const FinancialCalendarView: React.FC<FinancialCalendarViewProps> = ({
  payments,
  profile,
  onTogglePaymentStatus,
  onAddPaymentOnDate,
  onReschedulePayment,
}) => {
  const { isNitido } = useTheme();

  // Real current date reference (YYYY-MM-DD)
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Current view year & month (default: current month)
  const [currentDate, setCurrentDate] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  // Selected date filter (YYYY-MM-DD)
  const [selectedDate, setSelectedDate] = useState<string | null>(todayStr);

  // Drag & Drop rescheduling state
  const [draggedPaymentId, setDraggedPaymentId] = useState<string | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [rescheduleBanner, setRescheduleBanner] = useState<{
    id: string;
    title: string;
    oldDate: string;
    newDate: string;
  } | null>(null);

  // Day detail popover/modal state
  const [isDayModalOpen, setIsDayModalOpen] = useState(false);
  const [previewReceiptImage, setPreviewReceiptImage] = useState<string | null>(null);

  // Filter mode inside calendar
  const [calendarFilter, setCalendarFilter] = useState<'todos' | 'recurrentes' | 'fijos' | 'variables' | 'ingresos'>('todos');

  // Month navigation
  const prevMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const goToToday = () => {
    const [y, m] = todayStr.split('-').map(Number);
    setCurrentDate(new Date(y, m - 1, 1));
    setSelectedDate(todayStr);
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Filtered payments by current filter
  const activePayments = useMemo(() => {
    return payments.filter((p) => {
      if (calendarFilter === 'recurrentes') return p.frequency !== 'unico';
      if (calendarFilter === 'fijos') return p.type === 'gasto' && p.isFixed;
      if (calendarFilter === 'variables') return p.type === 'gasto' && !p.isFixed;
      if (calendarFilter === 'ingresos') return p.type === 'ingreso';
      return true;
    });
  }, [payments, calendarFilter]);

  // Map payments by dueDate (YYYY-MM-DD)
  const paymentsByDate = useMemo(() => {
    const map = new Map<string, PaymentItem[]>();
    activePayments.forEach((p) => {
      if (!p.dueDate) return;
      const list = map.get(p.dueDate) || [];
      list.push(p);
      map.set(p.dueDate, list);
    });
    return map;
  }, [activePayments]);

  // Calculate monthly stats for the currently viewed month
  const monthStats = useMemo(() => {
    const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    const monthPayments = payments.filter((p) => p.dueDate && p.dueDate.startsWith(monthPrefix));

    const totalIncome = monthPayments
      .filter((p) => p.type === 'ingreso')
      .reduce((sum, p) => sum + p.amount, 0);

    const pendingExpenses = monthPayments
      .filter((p) => p.type === 'gasto' && p.status !== 'pagado')
      .reduce((sum, p) => sum + p.amount, 0);

    const paidExpenses = monthPayments
      .filter((p) => p.type === 'gasto' && p.status === 'pagado')
      .reduce((sum, p) => sum + p.amount, 0);

    const upcomingCount = monthPayments.filter(
      (p) => p.status !== 'pagado' && p.dueDate >= todayStr
    ).length;

    return { totalIncome, pendingExpenses, paidExpenses, upcomingCount, totalCount: monthPayments.length };
  }, [payments, year, month, todayStr]);

  // Calendar matrix generation
  const calendarDays = useMemo(() => {
    const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7; // Monday = 0
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days: Array<{
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      items: PaymentItem[];
    }> = [];

    // Previous month padding days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const prevDay = daysInPrevMonth - i;
      const prevDate = new Date(year, month - 1, prevDay);
      const mStr = String(prevDate.getMonth() + 1).padStart(2, '0');
      const dStr = String(prevDay).padStart(2, '0');
      const dateStr = `${prevDate.getFullYear()}-${mStr}-${dStr}`;
      days.push({
        dateStr,
        dayNumber: prevDay,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        items: paymentsByDate.get(dateStr) || [],
      });
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const mStr = String(month + 1).padStart(2, '0');
      const dStr = String(day).padStart(2, '0');
      const dateStr = `${year}-${mStr}-${dStr}`;
      days.push({
        dateStr,
        dayNumber: day,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
        items: paymentsByDate.get(dateStr) || [],
      });
    }

    // Next month padding days to complete 35 or 42 cells (6 rows)
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const nextDate = new Date(year, month + 1, i);
      const mStr = String(nextDate.getMonth() + 1).padStart(2, '0');
      const dStr = String(i).padStart(2, '0');
      const dateStr = `${nextDate.getFullYear()}-${mStr}-${dStr}`;
      days.push({
        dateStr,
        dayNumber: i,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        items: paymentsByDate.get(dateStr) || [],
      });
    }

    return days;
  }, [year, month, paymentsByDate, todayStr]);

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];

  const currentMonthTitle = `${monthNames[month]} ${year}`;

  // Payments for selected date
  const selectedDatePayments = useMemo(() => {
    if (!selectedDate) return [];
    return payments.filter((p) => p.dueDate === selectedDate);
  }, [payments, selectedDate]);

  // Selected date financial breakdown
  const selectedDateStats = useMemo(() => {
    const totalIncomes = selectedDatePayments
      .filter((p) => p.type === 'ingreso')
      .reduce((sum, p) => sum + p.amount, 0);

    const totalExpenses = selectedDatePayments
      .filter((p) => p.type === 'gasto')
      .reduce((sum, p) => sum + p.amount, 0);

    const pendingCount = selectedDatePayments.filter((p) => p.status !== 'pagado').length;
    const paidCount = selectedDatePayments.filter((p) => p.status === 'pagado').length;

    return { totalIncomes, totalExpenses, net: totalIncomes - totalExpenses, pendingCount, paidCount };
  }, [selectedDatePayments]);

  // Next upcoming payments (next 5 upcoming from today)
  const upcomingPaymentsList = useMemo(() => {
    return payments
      .filter((p) => p.dueDate && p.dueDate >= todayStr && p.status !== 'pagado')
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .slice(0, 5);
  }, [payments, todayStr]);

  const getDaysDiffLabel = (dateStr: string) => {
    if (dateStr === todayStr) return 'Vence hoy';
    if (dateStr < todayStr) return 'Vencido';
    const [y1, m1, d1] = dateStr.split('-').map(Number);
    const [y2, m2, d2] = todayStr.split('-').map(Number);
    const dt1 = new Date(y1, m1 - 1, d1).getTime();
    const dt2 = new Date(y2, m2 - 1, d2).getTime();
    const diffDays = Math.round((dt1 - dt2) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) return 'Vence mañana';
    return `En ${diffDays} días`;
  };

  const formatFriendlyDate = (dateStr: string) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-').map(Number);
    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const dateObj = new Date(y, m - 1, d);
    return `${dayNames[dateObj.getDay()]}, ${d} de ${monthNames[m - 1]} de ${y}`;
  };

  const handleDayCellClick = (cellDateStr: string, hasItems: boolean) => {
    setSelectedDate(cellDateStr);
    if (hasItems) {
      setIsDayModalOpen(true);
    }
  };

  const handlePerformReschedule = (paymentId: string, newDateStr: string) => {
    if (!onReschedulePayment || !newDateStr) return;
    const target = payments.find((p) => p.id === paymentId);
    if (!target || target.dueDate === newDateStr) return;

    const oldDate = target.dueDate;
    onReschedulePayment(paymentId, newDateStr);
    setSelectedDate(newDateStr);
    setRescheduleBanner({
      id: paymentId,
      title: target.title,
      oldDate,
      newDate: newDateStr,
    });
  };

  return (
    <div className={`p-5 sm:p-6 rounded-3xl border shadow-sm space-y-6 ${
      isNitido ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-800 text-white shadow-xl'
    }`}>
      {/* 1. Header with Controls & Summary Stats */}
      <div className={`flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b ${
        isNitido ? 'border-slate-100 text-slate-900' : 'border-slate-800 text-white'
      }`}>
        <div>
          <div className="flex items-center gap-2.5">
            <div className={`p-2.5 rounded-2xl border ${
              isNitido ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
            }`}>
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className={`text-base font-bold flex items-center gap-2 ${isNitido ? 'text-slate-900' : 'text-white'}`}>
                Calendario Mensual de Pagos Programados
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                  isNitido ? 'bg-indigo-50 text-indigo-800 border-indigo-200' : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                }`}>
                  {monthStats.totalCount} eventos
                </span>
              </h3>
              <p className={`text-xs mt-0.5 ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
                Haz clic en cualquier día para ver detalles o arrastra y suelta un pago sobre otra fecha para reprogramarlo.
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className={`flex items-center p-1 rounded-xl border ${
            isNitido ? 'bg-slate-100 border-slate-200 text-slate-900' : 'bg-slate-950 border-slate-800 text-white'
          }`}>
            <button
              onClick={prevMonth}
              className={`p-1.5 rounded-lg transition-colors ${
                isNitido ? 'text-slate-600 hover:text-slate-900 hover:bg-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title="Mes anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className={`px-3 text-xs font-bold min-w-[125px] text-center ${
              isNitido ? 'text-slate-900' : 'text-white'
            }`}>
              {currentMonthTitle}
            </span>
            <button
              onClick={nextMonth}
              className={`p-1.5 rounded-lg transition-colors ${
                isNitido ? 'text-slate-600 hover:text-slate-900 hover:bg-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title="Mes siguiente"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={goToToday}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors border ${
              isNitido 
                ? 'bg-white hover:bg-slate-100 text-slate-800 border-slate-200 shadow-xs' 
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-cyan-300 border-slate-700'
            }`}
            title="Ir al mes y día actual"
          >
            Hoy
          </button>
        </div>
      </div>

      {/* 2. Monthly Summary Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className={`p-3.5 rounded-2xl border ${isNitido ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/70 border-slate-800/80'}`}>
          <span className={`text-[10px] uppercase font-bold tracking-wider block ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
            Ingresos del Mes
          </span>
          <div className={`text-lg font-black mt-0.5 ${isNitido ? 'text-emerald-700' : 'text-emerald-400'}`}>
            +{profile.currencySymbol}{monthStats.totalIncome.toLocaleString()}
          </div>
          <span className={`text-[10px] mt-0.5 block ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>Sueldo y cobros programados</span>
        </div>

        <div className={`p-3.5 rounded-2xl border ${isNitido ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/70 border-slate-800/80'}`}>
          <span className={`text-[10px] uppercase font-bold tracking-wider block ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
            Pagos Pendientes
          </span>
          <div className={`text-lg font-black mt-0.5 ${isNitido ? 'text-amber-800' : 'text-amber-400'}`}>
            {profile.currencySymbol}{monthStats.pendingExpenses.toLocaleString()}
          </div>
          <span className={`text-[10px] mt-0.5 block ${isNitido ? 'text-amber-800/80 font-medium' : 'text-amber-400/80'}`}>
            {monthStats.upcomingCount} por vencer
          </span>
        </div>

        <div className={`p-3.5 rounded-2xl border ${isNitido ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/70 border-slate-800/80'}`}>
          <span className={`text-[10px] uppercase font-bold tracking-wider block ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
            Pagos Realizados
          </span>
          <div className={`text-lg font-black mt-0.5 ${isNitido ? 'text-slate-800' : 'text-slate-300'}`}>
            {profile.currencySymbol}{monthStats.paidExpenses.toLocaleString()}
          </div>
          <span className={`text-[10px] mt-0.5 block ${isNitido ? 'text-emerald-700 font-medium' : 'text-emerald-400'}`}>Al día</span>
        </div>

        <div className={`p-3.5 rounded-2xl border ${isNitido ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/70 border-slate-800/80'}`}>
          <span className={`text-[10px] uppercase font-bold tracking-wider block ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
            Total Compromisos
          </span>
          <div className={`text-lg font-black mt-0.5 ${isNitido ? 'text-slate-900' : 'text-white'}`}>
            {profile.currencySymbol}{(monthStats.pendingExpenses + monthStats.paidExpenses).toLocaleString()}
          </div>
          <span className={`text-[10px] mt-0.5 block ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>Gasto mensual planificado</span>
        </div>
      </div>

      {/* Reschedule Undo Confirmation Banner */}
      {rescheduleBanner && (
        <div
          className={`p-3 rounded-xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 animate-fadeIn ${
            isNitido
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-emerald-950/50 border-emerald-500/40 text-emerald-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>
              <strong>Pago reprogramado:</strong> &ldquo;{rescheduleBanner.title}&rdquo; movido del{' '}
              <span className="font-mono font-semibold">{rescheduleBanner.oldDate}</span> al{' '}
              <span className="font-mono font-semibold">{rescheduleBanner.newDate}</span>.
            </span>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            {onReschedulePayment && (
              <button
                type="button"
                onClick={() => {
                  onReschedulePayment(rescheduleBanner.id, rescheduleBanner.oldDate);
                  setSelectedDate(rescheduleBanner.oldDate);
                  setRescheduleBanner(null);
                }}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold border transition-colors ${
                  isNitido
                    ? 'bg-white hover:bg-emerald-100 text-emerald-800 border-emerald-300'
                    : 'bg-slate-900 hover:bg-slate-800 text-emerald-300 border-emerald-500/40'
                }`}
              >
                <Undo2 className="w-3 h-3" />
                <span>Deshacer</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setRescheduleBanner(null)}
              className="p-1 rounded-md hover:bg-black/10"
              aria-label="Cerrar aviso"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* 3. Filter Buttons & Legend */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div className={`flex items-center gap-1.5 p-1 rounded-xl border w-fit flex-wrap ${
          isNitido ? 'bg-slate-100 border-slate-200' : 'bg-slate-950 border-slate-800'
        }`}>
          <button
            onClick={() => setCalendarFilter('todos')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
              calendarFilter === 'todos' 
                ? 'bg-indigo-600 text-white shadow-xs' 
                : isNitido ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => setCalendarFilter('recurrentes')}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
              calendarFilter === 'recurrentes' 
                ? 'bg-cyan-600 text-white shadow-xs' 
                : isNitido ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Repeat className="w-3 h-3" />
            <span>Recurrentes</span>
          </button>
          <button
            onClick={() => setCalendarFilter('fijos')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
              calendarFilter === 'fijos' 
                ? 'bg-amber-600 text-white shadow-xs' 
                : isNitido ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'
            }`}
          >
            Fijos
          </button>
          <button
            onClick={() => setCalendarFilter('variables')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
              calendarFilter === 'variables' 
                ? 'bg-rose-600 text-white shadow-xs' 
                : isNitido ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'
            }`}
          >
            Variables
          </button>
          <button
            onClick={() => setCalendarFilter('ingresos')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
              calendarFilter === 'ingresos' 
                ? 'bg-emerald-600 text-white shadow-xs' 
                : isNitido ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'
            }`}
          >
            Ingresos
          </button>
        </div>

        {/* Legend */}
        <div className={`flex items-center gap-3 text-[11px] flex-wrap ${isNitido ? 'text-slate-600 font-medium' : 'text-slate-400'}`}>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>Ingreso</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span>Gasto Fijo</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span>Gasto Variable</span>
          </div>
          <div className="flex items-center gap-1">
            <Repeat className="w-3 h-3 text-indigo-500" />
            <span>Recurrente</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
            <span>Pagado</span>
          </div>
        </div>
      </div>

      {/* 4. Calendar Matrix Grid */}
      <div className={`rounded-2xl border overflow-hidden shadow-xs ${
        isNitido ? 'bg-white border-slate-200' : 'bg-slate-950 border-slate-800 shadow-inner'
      }`}>
        {/* Day Name Header Row */}
        <div className={`grid grid-cols-7 border-b text-center ${
          isNitido ? 'bg-slate-50 border-slate-200' : 'bg-slate-900 border-slate-800'
        }`}>
          {['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'].map((d, idx) => (
            <div
              key={d}
              className={`py-2 text-[11px] font-bold tracking-wider ${
                isNitido 
                  ? idx >= 5 ? 'text-slate-400' : 'text-slate-700'
                  : idx >= 5 ? 'text-slate-500' : 'text-slate-400'
              }`}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Days Matrix */}
        <div className={`grid grid-cols-7 divide-x divide-y ${
          isNitido ? 'divide-slate-200 border-slate-200' : 'divide-slate-800/80'
        }`}>
          {calendarDays.map((cell) => {
            const isSelected = selectedDate === cell.dateStr;
            const hasItems = cell.items.length > 0;
            const pendingItems = cell.items.filter((p) => p.status !== 'pagado');
            const hasPending = pendingItems.length > 0;
            const isPastDue = hasPending && cell.dateStr < todayStr;
            const isDueToday = hasPending && cell.dateStr === todayStr;

            const netAmount = cell.items.reduce((sum, p) => {
              return p.type === 'ingreso' ? sum + p.amount : sum - p.amount;
            }, 0);

            const isDragTarget = dragOverDate === cell.dateStr;

            return (
              <div
                key={cell.dateStr}
                onClick={() => handleDayCellClick(cell.dateStr, hasItems)}
                onDragOver={(e) => {
                  if (!onReschedulePayment) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (dragOverDate !== cell.dateStr) {
                    setDragOverDate(cell.dateStr);
                  }
                }}
                onDragEnter={(e) => {
                  if (!onReschedulePayment) return;
                  e.preventDefault();
                  setDragOverDate(cell.dateStr);
                }}
                onDragLeave={(e) => {
                  if (dragOverDate === cell.dateStr && !e.currentTarget.contains(e.relatedTarget as Node)) {
                    setDragOverDate(null);
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (!onReschedulePayment) return;
                  const droppedId = e.dataTransfer.getData('text/plain') || draggedPaymentId;
                  setDragOverDate(null);
                  setDraggedPaymentId(null);
                  if (droppedId) {
                    handlePerformReschedule(droppedId, cell.dateStr);
                  }
                }}
                className={`min-h-[96px] sm:min-h-[112px] p-1.5 sm:p-2 cursor-pointer transition-all flex flex-col justify-between group relative ${
                  cell.isCurrentMonth
                    ? isNitido ? 'bg-white hover:bg-slate-50/80' : 'bg-slate-950/70 hover:bg-slate-800/50'
                    : isNitido ? 'bg-slate-50/60 opacity-60' : 'bg-slate-900/30 opacity-40'
                } ${
                  isDragTarget
                    ? isNitido
                      ? 'ring-2 ring-dashed ring-emerald-600 bg-emerald-50/80 z-20'
                      : 'ring-2 ring-dashed ring-emerald-400 bg-emerald-950/60 z-20'
                    : isSelected
                    ? isNitido ? 'ring-2 ring-indigo-600 bg-indigo-50/40 z-10' : 'ring-2 ring-cyan-400 bg-cyan-950/40 z-10'
                    : cell.isToday
                    ? isNitido ? 'bg-slate-50 border-t-2 border-t-indigo-600' : 'bg-slate-900/80 border-t-2 border-t-cyan-500'
                    : ''
                }`}
                title={`Haz clic para ver detalles del día ${cell.dateStr} (${cell.items.length} pagos). Puedes soltar un pago aquí para reprogramarlo.`}
              >
                {/* Day Header (Number and Today Badge) */}
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                      cell.isToday
                        ? isNitido ? 'bg-indigo-600 text-white font-black shadow-xs' : 'bg-cyan-500 text-slate-950 font-black shadow-sm'
                        : isSelected
                        ? isNitido ? 'text-indigo-700 font-extrabold bg-indigo-100' : 'text-cyan-300 font-extrabold bg-cyan-950/80'
                        : cell.isCurrentMonth
                        ? isNitido ? 'text-slate-800 group-hover:text-slate-950' : 'text-slate-300 group-hover:text-white'
                        : 'text-slate-400'
                    }`}
                  >
                    {cell.dayNumber}
                  </span>

                  {/* Warning / Alert Badge for Pending Vencimiento or Drop Hint */}
                  <div className="flex items-center gap-1">
                    {isDragTarget ? (
                      <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-emerald-600 text-white">
                        Soltar aquí
                      </span>
                    ) : (
                      <>
                        {isDueToday && (
                          <span className={`text-[9px] px-1 py-0.2 rounded font-bold border ${
                            isNitido ? 'bg-amber-100 text-amber-900 border-amber-300' : 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                          }`}>
                            ¡Hoy!
                          </span>
                        )}
                        {isPastDue && (
                          <span className={`text-[9px] px-1 py-0.2 rounded font-bold border ${
                            isNitido ? 'bg-rose-100 text-rose-900 border-rose-300' : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                          }`}>
                            Vencido
                          </span>
                        )}
                        {hasItems && (
                          <span className={`text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold ${
                            isNitido ? 'bg-slate-100 text-slate-700' : 'bg-slate-800 text-slate-300'
                          }`}>
                            {cell.items.length}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Day Payment Items Pills (Draggable) */}
                <div className="space-y-1 my-1">
                  {cell.items.slice(0, 3).map((item) => {
                    const isIncome = item.type === 'ingreso';
                    const isPaid = item.status === 'pagado';
                    const isRecurring = item.frequency !== 'unico';
                    const isBeingDragged = draggedPaymentId === item.id;
                    const dotColor = isIncome
                      ? 'bg-emerald-500'
                      : item.isFixed
                      ? 'bg-amber-500'
                      : 'bg-rose-500';

                    return (
                      <div
                        key={item.id}
                        draggable={Boolean(onReschedulePayment)}
                        onDragStart={(e) => {
                          if (!onReschedulePayment) return;
                          e.stopPropagation();
                          e.dataTransfer.setData('text/plain', item.id);
                          e.dataTransfer.effectAllowed = 'move';
                          setDraggedPaymentId(item.id);
                        }}
                        onDragEnd={() => {
                          setDraggedPaymentId(null);
                          setDragOverDate(null);
                        }}
                        className={`text-[10px] leading-tight px-1.5 py-0.5 rounded flex items-center justify-between gap-1 truncate transition-all border ${
                          onReschedulePayment ? 'cursor-grab active:cursor-grabbing' : ''
                        } ${
                          isBeingDragged ? 'opacity-40 scale-95' : ''
                        } ${
                          isPaid
                            ? isNitido ? 'bg-slate-100 text-slate-500 border-slate-200 line-through' : 'bg-slate-800/60 text-slate-400 border-transparent line-through'
                            : isIncome
                            ? isNitido ? 'bg-emerald-50 text-emerald-900 border-emerald-200 font-semibold' : 'bg-emerald-950/80 text-emerald-300 border-emerald-800/50'
                            : item.isFixed
                            ? isNitido ? 'bg-amber-50 text-amber-900 border-amber-200 font-semibold' : 'bg-amber-950/80 text-amber-300 border-amber-800/50'
                            : isNitido ? 'bg-rose-50 text-rose-900 border-rose-200 font-semibold' : 'bg-rose-950/80 text-rose-300 border-rose-800/50'
                        }`}
                        title={`${item.title} (${item.frequency}) - ${isIncome ? '+' : '-'}${profile.currencySymbol}${item.amount}${onReschedulePayment ? ' · Arrastra para reprogramar fecha' : ''}`}
                      >
                        <div className="flex items-center gap-1 truncate">
                          {onReschedulePayment && (
                            <GripVertical className="w-2.5 h-2.5 opacity-40 shrink-0 hidden sm:inline" />
                          )}
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
                          {isRecurring && <Repeat className="w-2.5 h-2.5 shrink-0 opacity-75" />}
                          <span className="truncate">{item.title}</span>
                        </div>
                        <span className="font-bold shrink-0 tabular-nums">
                          {profile.currencySymbol}{Math.round(item.amount)}
                        </span>
                      </div>
                    );
                  })}

                  {cell.items.length > 3 && (
                    <div className={`text-[9px] font-bold px-1 flex items-center justify-between ${
                      isNitido ? 'text-indigo-700' : 'text-cyan-400'
                    }`}>
                      <span>+{cell.items.length - 3} más...</span>
                      <Maximize2 className="w-2.5 h-2.5 opacity-60 group-hover:opacity-100" />
                    </div>
                  )}
                </div>

                {/* Daily Total Summary Footer */}
                {hasItems ? (
                  <div className={`text-right text-[10px] font-extrabold pt-0.5 border-t tabular-nums ${
                    isNitido ? 'border-slate-100' : 'border-slate-800/60'
                  }`}>
                    <span className={
                      netAmount >= 0 
                        ? isNitido ? 'text-emerald-700' : 'text-emerald-400' 
                        : isNitido ? 'text-slate-800' : 'text-slate-300'
                    }>
                      {netAmount >= 0 ? '+' : ''}{profile.currencySymbol}{Math.abs(Math.round(netAmount)).toLocaleString()}
                    </span>
                  </div>
                ) : (
                  <div className="h-3" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. Inline Selected Day Detail Panel */}
      <div className={`p-5 rounded-2xl border space-y-4 shadow-sm ${
        isNitido ? 'bg-white border-slate-200' : 'bg-slate-950 border-slate-800 shadow-md'
      }`}>
        <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b ${
          isNitido ? 'border-slate-100' : 'border-slate-800'
        }`}>
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl ${
              isNitido ? 'bg-indigo-50 text-indigo-700' : 'bg-cyan-500/10 text-cyan-400'
            }`}>
              <CalendarDays className="w-4 h-4" />
            </div>
            <div>
              <h4 className={`text-sm font-bold flex items-center gap-2 ${isNitido ? 'text-slate-900' : 'text-white'}`}>
                <span>Detalle del Día:</span>
                <span className={`font-extrabold ${isNitido ? 'text-indigo-700' : 'text-cyan-300'}`}>
                  {selectedDate ? formatFriendlyDate(selectedDate) : 'Selecciona un día'}
                </span>
                {selectedDate === todayStr && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                    isNitido ? 'bg-indigo-50 text-indigo-800 border-indigo-200 font-bold' : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  }`}>
                    Hoy
                  </span>
                )}
              </h4>
              <p className={`text-xs mt-0.5 ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
                {selectedDatePayments.length > 0
                  ? `${selectedDatePayments.length} transacciones programadas para esta fecha.`
                  : 'No hay pagos ni cobros programados para este día.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            {selectedDatePayments.length > 0 && (
              <button
                type="button"
                onClick={() => setIsDayModalOpen(true)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors border ${
                  isNitido
                    ? 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200 shadow-xs'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border-slate-700'
                }`}
                title="Abrir vista detallada en ventana emergente"
              >
                <Maximize2 className={`w-3.5 h-3.5 ${isNitido ? 'text-indigo-600' : 'text-cyan-400'}`} />
                <span>Ver en Modal</span>
              </button>
            )}

            {selectedDate && onAddPaymentOnDate && (
              <button
                onClick={() => onAddPaymentOnDate(selectedDate)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white text-xs font-bold transition-all shadow-xs ${
                  isNitido
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white-fixed'
                    : 'bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 shadow-sm'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Programar en este día</span>
              </button>
            )}
          </div>
        </div>

        {/* Selected Day Payments List */}
        {selectedDatePayments.length > 0 ? (
          <div className="space-y-3">
            {/* Daily balance summary strip */}
            <div className={`flex items-center justify-between text-xs p-2.5 rounded-xl border ${
              isNitido ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-slate-900 border-slate-800'
            }`}>
              <span className={`font-semibold ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>Balance del Día:</span>
              <div className="flex items-center gap-3">
                <span className={`font-bold ${isNitido ? 'text-emerald-700' : 'text-emerald-400'}`}>
                  Ingresos: +{profile.currencySymbol}{selectedDateStats.totalIncomes.toLocaleString()}
                </span>
                <span className={`font-bold ${isNitido ? 'text-rose-700' : 'text-rose-400'}`}>
                  Gastos: -{profile.currencySymbol}{selectedDateStats.totalExpenses.toLocaleString()}
                </span>
                <span className={`font-black border-l pl-3 ${
                  isNitido ? 'text-slate-900 border-slate-300' : 'text-white border-slate-800'
                }`}>
                  Neto: {selectedDateStats.net >= 0 ? '+' : ''}{profile.currencySymbol}{selectedDateStats.net.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="space-y-2.5">
              {selectedDatePayments.map((p) => {
                const isIncome = p.type === 'ingreso';
                const isPaid = p.status === 'pagado';
                const diffText = getDaysDiffLabel(p.dueDate);
                const IconComponent = CATEGORY_ICONS[p.category] || DollarSign;
                const catStyle = CATEGORY_COLORS[p.category] || {
                  bg: 'bg-slate-500/10',
                  text: 'text-slate-400',
                  border: 'border-slate-500/20',
                };

                return (
                  <div
                    key={p.id}
                    draggable={Boolean(onReschedulePayment)}
                    onDragStart={(e) => {
                      if (!onReschedulePayment) return;
                      e.dataTransfer.setData('text/plain', p.id);
                      e.dataTransfer.effectAllowed = 'move';
                      setDraggedPaymentId(p.id);
                    }}
                    onDragEnd={() => {
                      setDraggedPaymentId(null);
                      setDragOverDate(null);
                    }}
                    className={`p-3.5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                      onReschedulePayment ? 'cursor-grab active:cursor-grabbing' : ''
                    } ${
                      isPaid
                        ? isNitido ? 'bg-slate-50 border-slate-200 opacity-80' : 'bg-slate-900/50 border-slate-800/80 opacity-80'
                        : isIncome
                        ? isNitido ? 'bg-emerald-50/70 border-emerald-200' : 'bg-emerald-950/20 border-emerald-500/30'
                        : p.isFixed
                        ? isNitido ? 'bg-amber-50/70 border-amber-200' : 'bg-amber-950/20 border-amber-500/30'
                        : isNitido ? 'bg-rose-50/70 border-rose-200' : 'bg-rose-950/20 border-rose-500/30'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => onTogglePaymentStatus(p.id)}
                        title={isPaid ? 'Marcar como pendiente' : 'Marcar como pagado'}
                        className={`w-7 h-7 rounded-xl border flex items-center justify-center shrink-0 transition-all ${
                          isPaid
                            ? 'bg-emerald-600 border-emerald-500 text-white shadow-xs'
                            : isNitido ? 'border-slate-300 hover:border-slate-500 text-transparent' : 'border-slate-600 hover:border-slate-400 text-transparent'
                        }`}
                      >
                        <Check className="w-4 h-4 stroke-[3]" />
                      </button>

                      <div className={`p-2 rounded-xl ${catStyle.bg} ${catStyle.text} ${catStyle.border} border shrink-0`}>
                        <IconComponent className="w-4 h-4" />
                      </div>

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-sm font-bold ${
                            isPaid 
                              ? 'line-through text-slate-400' 
                              : isNitido ? 'text-slate-900' : 'text-white'
                          }`}>
                            {p.title}
                          </span>
                          <span
                            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                              isIncome
                                ? isNitido ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : p.isFixed
                                ? isNitido ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : isNitido ? 'bg-rose-100 text-rose-800 border border-rose-200' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            }`}
                          >
                            {isIncome ? 'Ingreso' : p.isFixed ? 'Gasto Fijo' : 'Gasto Variable'}
                          </span>
                          {p.frequency !== 'unico' && (
                            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                              isNitido ? 'bg-indigo-50 text-indigo-800 border-indigo-200' : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                            }`}>
                              <Repeat className="w-2.5 h-2.5" />
                              {p.frequency}
                            </span>
                          )}
                          {p.merchant && (
                            <span className={`text-[10px] px-2 py-0.5 rounded-md border ${
                              isNitido ? 'text-cyan-800 bg-cyan-50 border-cyan-200' : 'text-cyan-300 bg-cyan-950/60 border-cyan-800/40'
                            }`}>
                              {p.merchant}
                            </span>
                          )}
                          {p.receiptImage && (
                            <button
                              type="button"
                              onClick={() => setPreviewReceiptImage(p.receiptImage || null)}
                              className="text-[10px] text-emerald-300 bg-emerald-950/60 border border-emerald-800/40 px-2 py-0.5 rounded-md hover:bg-emerald-900/60 transition-colors flex items-center gap-1"
                            >
                              <Receipt className="w-3 h-3" />
                              <span>Ticket adjunto</span>
                            </button>
                          )}
                        </div>
                        <span className={`text-xs mt-0.5 block ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
                          Categoría: {p.category} · Frecuencia: {p.frequency} · {diffText}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-2.5 self-end sm:self-auto flex-wrap">
                      {onReschedulePayment && (
                        <label className={`flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-lg border ${
                          isNitido ? 'bg-white border-slate-200 text-slate-700' : 'bg-slate-900 border-slate-700 text-slate-300'
                        }`}>
                          <span className="font-semibold">Mover:</span>
                          <input
                            type="date"
                            aria-label={`Reprogramar fecha de ${p.title}`}
                            value={p.dueDate}
                            onChange={(e) => handlePerformReschedule(p.id, e.target.value)}
                            className="bg-transparent text-[11px] font-semibold focus:outline-none cursor-pointer"
                          />
                        </label>
                      )}
                      <span
                        className={`text-base sm:text-lg font-black tabular-nums ${
                          isIncome
                            ? isNitido ? 'text-emerald-700' : 'text-emerald-400'
                            : isPaid
                            ? 'text-slate-400'
                            : isNitido ? 'text-slate-900' : 'text-white'
                        }`}
                      >
                        {isIncome ? '+' : '-'}{profile.currencySymbol}{p.amount.toLocaleString()}
                      </span>
                      <button
                        onClick={() => onTogglePaymentStatus(p.id)}
                        className={`text-xs px-3 py-1.5 rounded-xl font-bold transition-all ${
                          isPaid
                            ? isNitido ? 'bg-slate-200 text-slate-700 hover:bg-slate-300' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md'
                        }`}
                      >
                        {isPaid ? 'Pagado' : 'Pagar ahora'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800/60 text-center space-y-3">
            <p className="text-xs text-slate-400">
              No hay pagos programados para el <strong className="text-slate-200">{selectedDate}</strong>.
            </p>
            {upcomingPaymentsList.length > 0 && (
              <div className="pt-3 border-t border-slate-800 text-left">
                <span className="text-[11px] font-bold text-cyan-300 uppercase tracking-wider block mb-2">
                  Próximos Vencimientos Cercanos:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {upcomingPaymentsList.slice(0, 4).map((up) => (
                    <div
                      key={up.id}
                      onClick={() => setSelectedDate(up.dueDate)}
                      className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-cyan-500/50 cursor-pointer transition-all flex items-center justify-between"
                    >
                      <div className="truncate mr-2">
                        <span className="text-xs font-semibold text-white block truncate">{up.title}</span>
                        <span className="text-[10px] text-slate-400">{up.dueDate} · {getDaysDiffLabel(up.dueDate)}</span>
                      </div>
                      <span className="text-xs font-bold text-amber-300 shrink-0">
                        {profile.currencySymbol}{up.amount.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 6. DAY PAYMENTS MODAL (Opened upon clicking a day with payments or through "Ver en Modal") */}
      {isDayModalOpen && selectedDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-sm overflow-y-auto animate-fadeIn">
          <div className={`relative w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[90vh] border ${
            isNitido ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-800 text-white'
          }`}>
            {/* Modal Header */}
            <div className={`p-5 sm:p-6 border-b flex items-center justify-between ${
              isNitido 
                ? 'bg-slate-50 border-slate-100 text-slate-900' 
                : 'border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950/40 text-white'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-2xl border ${
                  isNitido ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                }`}>
                  <CalendarDays className="w-5 h-5" />
                </div>
                <div>
                  <h3 className={`text-base sm:text-lg font-black ${isNitido ? 'text-slate-900' : 'text-white'}`}>
                    {formatFriendlyDate(selectedDate)}
                  </h3>
                  <div className={`flex items-center gap-2 mt-0.5 text-xs ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
                    <span>{selectedDatePayments.length} pagos programados</span>
                    {selectedDate === todayStr && (
                      <span className={`px-2 py-0.2 rounded-full text-[10px] font-bold border ${
                        isNitido ? 'bg-indigo-50 text-indigo-800 border-indigo-200' : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                      }`}>
                        Fecha actual
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsDayModalOpen(false)}
                className={`p-2 rounded-xl transition-colors ${
                  isNitido ? 'text-slate-400 hover:text-slate-800 hover:bg-slate-200' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-4 custom-scrollbar">
              {/* Daily Balance Strip */}
              <div className={`grid grid-cols-3 gap-2.5 p-3 rounded-2xl border text-center ${
                isNitido ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border border-slate-800'
              }`}>
                <div>
                  <span className={`text-[10px] uppercase font-bold block ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>Ingresos</span>
                  <span className={`text-sm font-extrabold ${isNitido ? 'text-emerald-700' : 'text-emerald-400'}`}>
                    +{profile.currencySymbol}{selectedDateStats.totalIncomes.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className={`text-[10px] uppercase font-bold block ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>Gastos</span>
                  <span className={`text-sm font-extrabold ${isNitido ? 'text-rose-700' : 'text-rose-400'}`}>
                    -{profile.currencySymbol}{selectedDateStats.totalExpenses.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className={`text-[10px] uppercase font-bold block ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>Balance Neto</span>
                  <span className={`text-sm font-black ${
                    selectedDateStats.net >= 0 
                      ? isNitido ? 'text-emerald-700' : 'text-emerald-300' 
                      : isNitido ? 'text-slate-900' : 'text-slate-200'
                  }`}>
                    {selectedDateStats.net >= 0 ? '+' : ''}{profile.currencySymbol}{selectedDateStats.net.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Payments Detailed Cards */}
              <div className="space-y-3">
                {selectedDatePayments.map((p) => {
                  const isIncome = p.type === 'ingreso';
                  const isPaid = p.status === 'pagado';
                  const IconComponent = CATEGORY_ICONS[p.category] || DollarSign;
                  const catStyle = CATEGORY_COLORS[p.category] || {
                    bg: 'bg-slate-500/10',
                    text: 'text-slate-400',
                    border: 'border-slate-500/20',
                  };

                  return (
                    <div
                      key={p.id}
                      className={`p-4 rounded-2xl border space-y-3 transition-all shadow-xs ${
                        isNitido ? 'bg-white border-slate-200 hover:border-slate-300' : 'bg-slate-950 border border-slate-800 hover:border-slate-700 shadow-md'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className={`p-2.5 rounded-xl ${catStyle.bg} ${catStyle.text} ${catStyle.border} border shrink-0`}>
                            <IconComponent className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className={`text-sm font-bold ${isPaid ? 'line-through text-slate-400' : 'text-white'}`}>
                                {p.title}
                              </h4>
                              <span
                                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                  isIncome
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                    : p.isFixed
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                }`}
                              >
                                {isIncome ? 'Ingreso' : p.isFixed ? 'Gasto Fijo' : 'Gasto Variable'}
                              </span>
                            </div>
                            <span className="text-xs text-slate-400 mt-0.5 block">
                              Categoría: {p.category} · Frecuencia: {p.frequency}
                            </span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span
                            className={`text-lg font-black block ${
                              isIncome ? 'text-emerald-400' : isPaid ? 'text-slate-400' : 'text-white'
                            }`}
                          >
                            {isIncome ? '+' : '-'}{profile.currencySymbol}{p.amount.toLocaleString()}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block mt-0.5 ${
                              isPaid
                                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                            }`}
                          >
                            {isPaid ? 'Completado' : 'Pendiente'}
                          </span>
                        </div>
                      </div>

                      {/* Merchant and Items Breakdown */}
                      {(p.merchant || (p.itemsBreakdown && p.itemsBreakdown.length > 0)) && (
                        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-1.5">
                          {p.merchant && (
                            <div className="flex items-center gap-2 text-slate-300">
                              <span className="text-slate-500">Establecimiento:</span>
                              <span className="font-semibold text-white">📍 {p.merchant}</span>
                            </div>
                          )}
                          {p.itemsBreakdown && p.itemsBreakdown.length > 0 && (
                            <div>
                              <span className="text-slate-500 block mb-1">Artículos registrados:</span>
                              <div className="flex flex-wrap gap-1.5">
                                {p.itemsBreakdown.map((item, i) => (
                                  <span key={i} className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[11px]">
                                    {item.name} {item.price ? `(${profile.currencySymbol}${item.price})` : ''}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Receipt Preview Thumbnail */}
                      {p.receiptImage && (
                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs">
                          <div className="flex items-center gap-2">
                            <Receipt className="w-4 h-4 text-emerald-400" />
                            <span className="text-slate-300 font-medium">Recibo o ticket digitalizado adjunto</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setPreviewReceiptImage(p.receiptImage || null)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 border border-emerald-500/40 font-semibold transition-all"
                          >
                            Ver Recibo
                          </button>
                        </div>
                      )}

                      {/* Actions footer */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
                        <span className="text-slate-500">
                          {p.status === 'pagado' ? 'Marcado como pagado' : 'Pendiente de cobro / pago'}
                        </span>
                        <button
                          type="button"
                          onClick={() => onTogglePaymentStatus(p.id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all ${
                            isPaid
                              ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                              : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                          <span>{isPaid ? 'Desmarcar pago' : 'Marcar como Pagado'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setIsDayModalOpen(false)}
                className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 text-xs sm:text-sm font-semibold transition-colors"
              >
                Cerrar
              </button>

              {onAddPaymentOnDate && (
                <button
                  type="button"
                  onClick={() => {
                    setIsDayModalOpen(false);
                    onAddPaymentOnDate(selectedDate);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm shadow-md transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>Programar Nuevo Pago</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 7. RECEIPT IMAGE MODAL */}
      {previewReceiptImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fadeIn">
          <div className="relative max-w-lg w-full bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl p-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Receipt className="w-4 h-4 text-emerald-400" />
                <span>Foto del Recibo o Ticket Digitalizado</span>
              </h4>
              <button
                onClick={() => setPreviewReceiptImage(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="py-4 flex justify-center max-h-[70vh] overflow-y-auto">
              <img
                src={previewReceiptImage}
                alt="Recibo"
                className="max-h-[60vh] object-contain rounded-xl border border-slate-800 shadow-md"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
