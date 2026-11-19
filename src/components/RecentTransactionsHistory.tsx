import React, { useState } from 'react';
import {
  Clock,
  Pencil,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Calendar,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  X,
  Check,
  Home,
  Car,
  Utensils,
  Zap,
  Gamepad2,
  HeartPulse,
  GraduationCap,
  Briefcase,
  Laptop,
  CreditCard,
  Sparkles,
  SlidersHorizontal,
  ChevronRight,
  RefreshCw,
  FileSpreadsheet
} from 'lucide-react';
import { PaymentItem, UserFinancialProfile } from '../types';
import { useTheme } from '../context/ThemeContext';
import { classifyPaymentDescription } from '../utils/paymentCategoryClassifier';

interface RecentTransactionsHistoryProps {
  payments: PaymentItem[];
  profile: UserFinancialProfile;
  onUpdatePayment: (id: string, updated: Partial<PaymentItem>) => void;
  onDeletePayment: (id: string) => void;
  onTogglePaymentStatus?: (id: string) => void;
  onOpenAddModal?: () => void;
  onOpenDateRangeCSV?: () => void;
}

export const RecentTransactionsHistory: React.FC<RecentTransactionsHistoryProps> = ({
  payments,
  profile,
  onUpdatePayment,
  onDeletePayment,
  onTogglePaymentStatus,
  onOpenAddModal,
  onOpenDateRangeCSV,
}) => {
  const { isNitido, isVibrant } = useTheme();

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editAmount, setEditAmount] = useState<number | ''>('');
  const [editType, setEditType] = useState<'gasto' | 'ingreso'>('gasto');
  const [editCategory, setEditCategory] = useState<PaymentItem['category']>('servicios');
  const [editDueDate, setEditDueDate] = useState('');
  const [editStatus, setEditStatus] = useState<'pendiente' | 'pagado' | 'vencido'>('pendiente');
  const [editIsFixed, setEditIsFixed] = useState(true);
  const [editFrequency, setEditFrequency] = useState<PaymentItem['frequency']>('mensual');

  // Deletion confirmation state
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Success toast/feedback message
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // Sort payments by recency (createdAt or dueDate descending) and take top 5
  const sortedPayments = [...payments].sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : new Date(a.dueDate).getTime();
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : new Date(b.dueDate).getTime();
    return timeB - timeA;
  });

  const recentPayments = sortedPayments.slice(0, 5);

  const getCategoryMeta = (category: string) => {
    switch (category?.toLowerCase()) {
      case 'alquiler':
      case 'vivienda':
        return {
          label: 'Alquiler / Vivienda',
          icon: Home,
          colorClass: isNitido 
            ? 'bg-amber-100 text-amber-900 border-amber-300' 
            : 'bg-amber-950/70 text-amber-300 border-amber-700/50',
          iconBg: isNitido ? 'bg-amber-100 text-amber-700' : 'bg-amber-950 text-amber-400'
        };
      case 'transporte':
      case 'vehiculo':
        return {
          label: 'Transporte',
          icon: Car,
          colorClass: isNitido 
            ? 'bg-sky-100 text-sky-900 border-sky-300' 
            : 'bg-sky-950/70 text-sky-300 border-sky-700/50',
          iconBg: isNitido ? 'bg-sky-100 text-sky-700' : 'bg-sky-950 text-sky-400'
        };
      case 'alimentacion':
      case 'comida':
        return {
          label: 'Alimentación',
          icon: Utensils,
          colorClass: isNitido 
            ? 'bg-emerald-100 text-emerald-900 border-emerald-300' 
            : 'bg-emerald-950/70 text-emerald-300 border-emerald-700/50',
          iconBg: isNitido ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-950 text-emerald-400'
        };
      case 'servicios':
      case 'luz':
      case 'agua':
        return {
          label: 'Servicios',
          icon: Zap,
          colorClass: isNitido 
            ? 'bg-indigo-100 text-indigo-900 border-indigo-300' 
            : 'bg-indigo-950/70 text-indigo-300 border-indigo-700/50',
          iconBg: isNitido ? 'bg-indigo-100 text-indigo-700' : 'bg-indigo-950 text-indigo-400'
        };
      case 'ocio':
      case 'entretenimiento':
        return {
          label: 'Ocio y Gustos',
          icon: Gamepad2,
          colorClass: isNitido 
            ? 'bg-purple-100 text-purple-900 border-purple-300' 
            : 'bg-purple-950/70 text-purple-300 border-purple-700/50',
          iconBg: isNitido ? 'bg-purple-100 text-purple-700' : 'bg-purple-950 text-purple-400'
        };
      case 'salud':
      case 'medico':
        return {
          label: 'Salud',
          icon: HeartPulse,
          colorClass: isNitido 
            ? 'bg-rose-100 text-rose-900 border-rose-300' 
            : 'bg-rose-950/70 text-rose-300 border-rose-700/50',
          iconBg: isNitido ? 'bg-rose-100 text-rose-700' : 'bg-rose-950 text-rose-400'
        };
      case 'educacion':
        return {
          label: 'Educación',
          icon: GraduationCap,
          colorClass: isNitido 
            ? 'bg-teal-100 text-teal-900 border-teal-300' 
            : 'bg-teal-950/70 text-teal-300 border-teal-700/50',
          iconBg: isNitido ? 'bg-teal-100 text-teal-700' : 'bg-teal-950 text-teal-400'
        };
      case 'sueldo':
      case 'salario':
        return {
          label: 'Sueldo / Salario',
          icon: Briefcase,
          colorClass: isNitido 
            ? 'bg-green-100 text-green-900 border-green-300' 
            : 'bg-green-950/70 text-green-300 border-green-700/50',
          iconBg: isNitido ? 'bg-green-100 text-green-700' : 'bg-green-950 text-green-400'
        };
      case 'freelance':
      case 'trabajo':
        return {
          label: 'Freelance / Extra',
          icon: Laptop,
          colorClass: isNitido 
            ? 'bg-cyan-100 text-cyan-900 border-cyan-300' 
            : 'bg-cyan-950/70 text-cyan-300 border-cyan-700/50',
          iconBg: isNitido ? 'bg-cyan-100 text-cyan-700' : 'bg-cyan-950 text-cyan-400'
        };
      default:
        return {
          label: category ? category.charAt(0).toUpperCase() + category.slice(1) : 'General',
          icon: CreditCard,
          colorClass: isNitido 
            ? 'bg-slate-100 text-slate-800 border-slate-300' 
            : 'bg-slate-800 text-slate-300 border-slate-700',
          iconBg: isNitido ? 'bg-slate-100 text-slate-700' : 'bg-slate-800 text-slate-300'
        };
    }
  };

  const handleStartEdit = (payment: PaymentItem) => {
    setEditingId(payment.id);
    setEditTitle(payment.title);
    setEditAmount(payment.amount);
    setEditType(payment.type);
    setEditCategory(payment.category);
    setEditDueDate(payment.dueDate);
    setEditStatus(payment.status);
    setEditIsFixed(payment.isFixed ?? true);
    setEditFrequency(payment.frequency ?? 'mensual');
    setConfirmDeleteId(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  const handleSaveEdit = (id: string, e: React.FormEvent) => {
    e.preventDefault();
    if (!editTitle.trim() || !editAmount || Number(editAmount) <= 0) return;

    onUpdatePayment(id, {
      title: editTitle.trim(),
      amount: Number(editAmount),
      type: editType,
      category: editCategory,
      dueDate: editDueDate,
      status: editStatus,
      isFixed: editType === 'ingreso' ? true : editIsFixed,
      frequency: editFrequency,
    });

    setEditingId(null);
    setFeedbackMessage(`Movimiento "${editTitle.trim()}" actualizado con éxito.`);
    setTimeout(() => {
      setFeedbackMessage(null);
    }, 3500);
  };

  const handleDeleteConfirmed = (id: string, title: string) => {
    onDeletePayment(id);
    setConfirmDeleteId(null);
    if (editingId === id) setEditingId(null);
    setFeedbackMessage(`Movimiento "${title}" eliminado.`);
    setTimeout(() => {
      setFeedbackMessage(null);
    }, 3500);
  };

  return (
    <div
      className={`rounded-3xl border transition-all ${
        isNitido
          ? 'bg-white border-slate-200/90 shadow-sm'
          : isVibrant
          ? 'bg-gradient-to-br from-slate-900/90 via-[#0a1228] to-[#060a1e] border-indigo-500/30 shadow-xl'
          : 'bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-950 border-slate-800 shadow-xl'
      } p-5 sm:p-6 space-y-5`}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${
              isNitido
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                : 'bg-indigo-950/70 border-indigo-700/50 text-indigo-400'
            }`}
          >
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className={`text-base sm:text-lg font-black tracking-tight ${isNitido ? 'text-slate-900' : 'text-white'}`}>
                Historial Reciente
              </h3>
              <span
                className={`text-[11px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider border ${
                  isNitido
                    ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                    : 'bg-indigo-950/60 text-indigo-300 border-indigo-800/50'
                }`}
              >
                Últimos 5 movimientos
              </span>
            </div>
            <p className={`text-xs mt-0.5 ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
              Gestiona, edita importes o elimina transacciones directamente desde esta lista rápida.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 flex-wrap">
          {onOpenDateRangeCSV && (
            <button
              onClick={onOpenDateRangeCSV}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-xs border ${
                isNitido
                  ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border-emerald-300'
                  : 'bg-emerald-950/70 hover:bg-emerald-900/80 text-emerald-300 border-emerald-700/60'
              }`}
              title="Descargar reporte CSV detallado por rango de fechas"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Reporte CSV</span>
            </button>
          )}

          {onOpenAddModal && (
            <button
              onClick={onOpenAddModal}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs border ${
                isNitido
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-700'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-500'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nuevo Movimiento</span>
            </button>
          )}
        </div>
      </div>

      {/* Feedback Banner */}
      {feedbackMessage && (
        <div
          className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between gap-3 border animate-fadeIn ${
            isNitido
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-emerald-950/70 text-emerald-300 border-emerald-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{feedbackMessage}</span>
          </div>
          <button
            onClick={() => setFeedbackMessage(null)}
            className="text-xs opacity-70 hover:opacity-100 transition-opacity p-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* List of Recent Movements */}
      {recentPayments.length === 0 ? (
        <div
          className={`p-8 text-center rounded-2xl border ${
            isNitido
              ? 'bg-slate-50 border-slate-200 text-slate-600'
              : 'bg-slate-900/60 border-slate-800 text-slate-400'
          }`}
        >
          <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm font-bold">No hay movimientos financieros registrados aún</p>
          <p className="text-xs mt-1">Registra tu primer gasto o ingreso para comenzar el seguimiento.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {recentPayments.map((payment) => {
            const isEditing = editingId === payment.id;
            const isConfirmingDelete = confirmDeleteId === payment.id;
            const meta = getCategoryMeta(payment.category);
            const CategoryIcon = meta.icon;
            const isIncome = payment.type === 'ingreso';
            const isPaid = payment.status === 'pagado';

            if (isEditing) {
              return (
                <div
                  key={payment.id}
                  className={`p-4 rounded-2xl border shadow-md transition-all ${
                    isNitido
                      ? 'bg-indigo-50/40 border-indigo-300'
                      : 'bg-slate-900 border-indigo-500/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${isNitido ? 'text-indigo-900' : 'text-indigo-300'}`}>
                      <Pencil className="w-3.5 h-3.5 text-indigo-600" />
                      Editando Movimiento
                    </span>
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className={`p-1 rounded-lg ${isNitido ? 'text-slate-500 hover:text-slate-800' : 'text-slate-400 hover:text-white'}`}
                      title="Cancelar edición"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <form onSubmit={(e) => handleSaveEdit(payment.id, e)} className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className={`block text-[11px] font-bold mb-1 ${isNitido ? 'text-slate-700' : 'text-slate-300'}`}>
                          Título / Concepto
                        </label>
                        <input
                          type="text"
                          required
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className={`w-full px-3 py-2 rounded-xl text-xs font-semibold border outline-hidden transition-all ${
                            isNitido
                              ? 'bg-white border-slate-300 text-slate-900 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100'
                              : 'bg-slate-800 border-slate-700 text-white focus:border-indigo-500'
                          }`}
                        />
                      </div>

                      <div>
                        <label className={`block text-[11px] font-bold mb-1 ${isNitido ? 'text-slate-700' : 'text-slate-300'}`}>
                          Monto ({profile.currencySymbol})
                        </label>
                        <input
                          type="number"
                          step="any"
                          required
                          min="0.01"
                          value={editAmount}
                          onChange={(e) => setEditAmount(e.target.value === '' ? '' : Number(e.target.value))}
                          className={`w-full px-3 py-2 rounded-xl text-xs font-semibold border outline-hidden transition-all ${
                            isNitido
                              ? 'bg-white border-slate-300 text-slate-900 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100'
                              : 'bg-slate-800 border-slate-700 text-white focus:border-indigo-500'
                          }`}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className={`block text-[11px] font-bold mb-1 ${isNitido ? 'text-slate-700' : 'text-slate-300'}`}>
                          Tipo
                        </label>
                        <div className="grid grid-cols-2 gap-1 p-0.5 rounded-xl border border-slate-300 bg-white">
                          <button
                            type="button"
                            onClick={() => setEditType('gasto')}
                            className={`py-1 rounded-lg text-xs font-bold transition-all ${
                              editType === 'gasto'
                                ? 'bg-rose-600 text-white shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            Gasto
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditType('ingreso')}
                            className={`py-1 rounded-lg text-xs font-bold transition-all ${
                              editType === 'ingreso'
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            Ingreso
                          </button>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className={`block text-[11px] font-bold ${isNitido ? 'text-slate-700' : 'text-slate-300'}`}>
                            Categoría
                          </label>
                          {(() => {
                            const suggestion = editTitle ? classifyPaymentDescription(editTitle, editType) : null;
                            if (suggestion && suggestion.category !== editCategory) {
                              return (
                                <button
                                  type="button"
                                  onClick={() => setEditCategory(suggestion.category)}
                                  className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold hover:underline flex items-center gap-0.5"
                                  title={`Sugerir: ${suggestion.categoryLabel}`}
                                >
                                  <Sparkles className="w-2.5 h-2.5" />
                                  <span>Sugerir {suggestion.categoryLabel.split('/')[0].trim()}</span>
                                </button>
                              );
                            }
                            return null;
                          })()}
                        </div>
                        <select
                          value={editCategory}
                          onChange={(e) => setEditCategory(e.target.value as PaymentItem['category'])}
                          className={`w-full px-3 py-2 rounded-xl text-xs font-semibold border outline-hidden transition-all capitalize ${
                            isNitido
                              ? 'bg-white border-slate-300 text-slate-900 focus:border-indigo-600'
                              : 'bg-slate-800 border-slate-700 text-white focus:border-indigo-500'
                          }`}
                        >
                          <option value="alimentacion">Alimentación</option>
                          <option value="alquiler">Alquiler / Vivienda</option>
                          <option value="transporte">Transporte</option>
                          <option value="servicios">Servicios</option>
                          <option value="ocio">Ocio</option>
                          <option value="salud">Salud</option>
                          <option value="educacion">Educación</option>
                          <option value="sueldo">Sueldo / Salario</option>
                          <option value="freelance">Freelance</option>
                          <option value="otro">Otro</option>
                        </select>
                      </div>

                      <div>
                        <label className={`block text-[11px] font-bold mb-1 ${isNitido ? 'text-slate-700' : 'text-slate-300'}`}>
                          Fecha de Vencimiento
                        </label>
                        <input
                          type="date"
                          required
                          value={editDueDate}
                          onChange={(e) => setEditDueDate(e.target.value)}
                          className={`w-full px-3 py-2 rounded-xl text-xs font-semibold border outline-hidden transition-all ${
                            isNitido
                              ? 'bg-white border-slate-300 text-slate-900 focus:border-indigo-600'
                              : 'bg-slate-800 border-slate-700 text-white focus:border-indigo-500'
                          }`}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className={`block text-[11px] font-bold mb-1 ${isNitido ? 'text-slate-700' : 'text-slate-300'}`}>
                          Estado del Pago
                        </label>
                        <select
                          value={editStatus}
                          onChange={(e) => setEditStatus(e.target.value as 'pendiente' | 'pagado' | 'vencido')}
                          className={`w-full px-3 py-2 rounded-xl text-xs font-semibold border outline-hidden transition-all ${
                            isNitido
                              ? 'bg-white border-slate-300 text-slate-900 focus:border-indigo-600'
                              : 'bg-slate-800 border-slate-700 text-white focus:border-indigo-500'
                          }`}
                        >
                          <option value="pendiente">Pendiente</option>
                          <option value="pagado">Pagado</option>
                          <option value="vencido">Vencido</option>
                        </select>
                      </div>

                      <div>
                        <label className={`block text-[11px] font-bold mb-1 ${isNitido ? 'text-slate-700' : 'text-slate-300'}`}>
                          Frecuencia
                        </label>
                        <select
                          value={editFrequency}
                          onChange={(e) => setEditFrequency(e.target.value as PaymentItem['frequency'])}
                          className={`w-full px-3 py-2 rounded-xl text-xs font-semibold border outline-hidden transition-all capitalize ${
                            isNitido
                              ? 'bg-white border-slate-300 text-slate-900 focus:border-indigo-600'
                              : 'bg-slate-800 border-slate-700 text-white focus:border-indigo-500'
                          }`}
                        >
                          <option value="unico">Único</option>
                          <option value="mensual">Mensual</option>
                          <option value="quincenal">Quincenal</option>
                          <option value="anual">Anual</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors border ${
                          isNitido
                            ? 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                            : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                        }`}
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-all active:scale-95"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Guardar Cambios
                      </button>
                    </div>
                  </form>
                </div>
              );
            }

            return (
              <div
                key={payment.id}
                className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${
                  isNitido
                    ? 'bg-white border-slate-200/90 hover:border-slate-300 shadow-2xs hover:shadow-xs'
                    : 'bg-slate-900/80 border-slate-800/80 hover:border-slate-700 shadow-sm'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Left: Dynamic Category Icon and Details */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border ${meta.colorClass} shadow-2xs`}
                      title={meta.label}
                    >
                      <CategoryIcon className="w-5 h-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className={`text-sm font-black truncate ${isNitido ? 'text-slate-900' : 'text-white'}`}>
                          {payment.title}
                        </h4>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${meta.colorClass}`}
                        >
                          {meta.label}
                        </span>
                      </div>

                      <div className={`flex items-center gap-2.5 text-xs mt-1 flex-wrap ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-500" />
                          {payment.dueDate}
                        </span>
                        <span>•</span>
                        <span className="capitalize">{payment.frequency || 'Mensual'}</span>
                        <span>•</span>
                        {/* Clickable Status Pill to toggle right away */}
                        <button
                          type="button"
                          onClick={() => onTogglePaymentStatus && onTogglePaymentStatus(payment.id)}
                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full transition-all border cursor-pointer ${
                            isPaid
                              ? isNitido
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200'
                                : 'bg-emerald-950/70 text-emerald-300 border-emerald-700 hover:bg-emerald-900'
                              : isNitido
                              ? 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200'
                              : 'bg-amber-950/70 text-amber-300 border-amber-700 hover:bg-amber-900'
                          }`}
                          title="Haz clic para alternar estado (Pagado / Pendiente)"
                        >
                          {isPaid ? '✓ Pagado' : '⏳ Pendiente'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Right: Amount and Inline Action Buttons */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    <div className="text-left sm:text-right">
                      <span
                        className={`text-base sm:text-lg font-black tracking-tight block ${
                          isIncome
                            ? isNitido ? 'text-emerald-700' : 'text-emerald-400'
                            : isNitido ? 'text-slate-900' : 'text-white'
                        }`}
                      >
                        {isIncome ? '+' : '-'}{profile.currencySymbol}{Number(payment.amount || 0).toLocaleString()}
                      </span>
                      <span className={`text-[10px] font-bold ${isIncome ? 'text-emerald-600' : 'text-slate-500'}`}>
                        {isIncome ? 'Ingreso' : payment.isFixed ? 'Gasto Fijo' : 'Gasto Variable'}
                      </span>
                    </div>

                    {/* Inline Actions */}
                    <div className="flex items-center gap-1.5">
                      {isConfirmingDelete ? (
                        <div className="flex items-center gap-1 bg-rose-50 border border-rose-200 p-1 rounded-xl animate-fadeIn">
                          <span className="text-[10px] font-bold text-rose-800 px-1">¿Eliminar?</span>
                          <button
                            type="button"
                            onClick={() => handleDeleteConfirmed(payment.id, payment.title)}
                            className="p-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-2xs"
                            title="Confirmar eliminación"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="p-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold"
                            title="Cancelar"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => handleStartEdit(payment)}
                            className={`p-2 rounded-xl transition-all border ${
                              isNitido
                                ? 'bg-white hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 border-slate-200 hover:border-indigo-300 shadow-2xs'
                                : 'bg-slate-800 hover:bg-indigo-950 text-slate-300 hover:text-indigo-300 border-slate-700 hover:border-indigo-500'
                            }`}
                            title="Editar movimiento financiero"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(payment.id)}
                            className={`p-2 rounded-xl transition-all border ${
                              isNitido
                                ? 'bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-700 border-slate-200 hover:border-rose-300 shadow-2xs'
                                : 'bg-slate-800 hover:bg-rose-950 text-slate-300 hover:text-rose-300 border-slate-700 hover:border-rose-500'
                            }`}
                            title="Eliminar movimiento"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
