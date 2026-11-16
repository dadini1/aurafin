import React, { useState, useMemo } from 'react';
import {
  Calendar,
  FileSpreadsheet,
  Download,
  X,
  Check,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Filter,
  Layers,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { PaymentItem, UserFinancialProfile } from '../types';
import { exportPaymentsToCSV } from '../utils/csvExporter';
import { useTheme } from '../context/ThemeContext';

interface DateRangeCSVExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  payments: PaymentItem[];
  profile: UserFinancialProfile;
  onExportSuccess?: (message: string) => void;
}

export const DateRangeCSVExportModal: React.FC<DateRangeCSVExportModalProps> = ({
  isOpen,
  onClose,
  payments,
  profile,
  onExportSuccess,
}) => {
  const { isNitido, isVibrant } = useTheme();

  // Helper date calculators
  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => today.toISOString().split('T')[0], [today]);

  const defaultStartOfMonth = useMemo(() => {
    const d = new Date(today.getFullYear(), today.getMonth(), 1);
    return d.toISOString().split('T')[0];
  }, [today]);

  const defaultEndOfMonth = useMemo(() => {
    const d = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return d.toISOString().split('T')[0];
  }, [today]);

  // States
  const [startDate, setStartDate] = useState<string>(defaultStartOfMonth);
  const [endDate, setEndDate] = useState<string>(defaultEndOfMonth);
  const [typeFilter, setTypeFilter] = useState<'todos' | 'gasto' | 'ingreso'>('todos');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'pagado' | 'pendiente'>('todos');
  const [activePreset, setActivePreset] = useState<string>('este_mes');
  const [isExporting, setIsExporting] = useState(false);

  if (!isOpen) return null;

  // Preset Handlers
  const applyPreset = (presetKey: string) => {
    setActivePreset(presetKey);
    const now = new Date();
    
    switch (presetKey) {
      case 'este_mes': {
        const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
        setStartDate(start);
        setEndDate(end);
        break;
      }
      case 'mes_anterior': {
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
        const end = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
        setStartDate(start);
        setEndDate(end);
        break;
      }
      case 'ultimos_30': {
        const startObj = new Date();
        startObj.setDate(startObj.getDate() - 30);
        setStartDate(startObj.toISOString().split('T')[0]);
        setEndDate(now.toISOString().split('T')[0]);
        break;
      }
      case 'ultimos_90': {
        const startObj = new Date();
        startObj.setDate(startObj.getDate() - 90);
        setStartDate(startObj.toISOString().split('T')[0]);
        setEndDate(now.toISOString().split('T')[0]);
        break;
      }
      case 'este_ano': {
        const start = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
        const end = new Date(now.getFullYear(), 11, 31).toISOString().split('T')[0];
        setStartDate(start);
        setEndDate(end);
        break;
      }
      case 'todo': {
        // Find earliest and latest dates in payments
        if (payments.length > 0) {
          const dates = payments.map((p) => p.dueDate || (p.createdAt ? p.createdAt.split('T')[0] : '')).filter(Boolean).sort();
          setStartDate(dates[0] || '2025-01-01');
          setEndDate(dates[dates.length - 1] || todayStr);
        } else {
          setStartDate('2025-01-01');
          setEndDate(todayStr);
        }
        break;
      }
      default:
        break;
    }
  };

  // Filtered payments by date range, type, and status
  const filteredPayments = payments.filter((p) => {
    const itemDate = p.dueDate || (p.createdAt ? p.createdAt.split('T')[0] : '');
    if (startDate && itemDate < startDate) return false;
    if (endDate && itemDate > endDate) return false;
    if (typeFilter !== 'todos' && p.type !== typeFilter) return false;
    if (statusFilter !== 'todos' && p.status !== statusFilter) return false;
    return true;
  });

  // Calculate live preview metrics
  const totalFilteredIncome = filteredPayments
    .filter((p) => p.type === 'ingreso')
    .reduce((sum, p) => sum + p.amount, 0);

  const totalFilteredExpenses = filteredPayments
    .filter((p) => p.type === 'gasto')
    .reduce((sum, p) => sum + p.amount, 0);

  const netBalance = totalFilteredIncome - totalFilteredExpenses;

  const handleDownload = () => {
    setIsExporting(true);
    try {
      const { count, filename } = exportPaymentsToCSV(filteredPayments, profile, {
        startDate,
        endDate,
        filterLabel: typeFilter !== 'todos' ? typeFilter : undefined,
      });

      if (onExportSuccess) {
        onExportSuccess(
          `¡Reporte CSV generado! Se exportaron exitosamente ${count} movimientos en ${filename}.`
        );
      }
      onClose();
    } catch (err) {
      console.error('Error al exportar CSV:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
      <div
        className={`w-full max-w-xl rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[92vh] ${
          isNitido
            ? 'bg-white border-slate-200 text-slate-900'
            : isVibrant
            ? 'bg-[#0b102b] border-indigo-500/40 text-white'
            : 'bg-slate-900 border-slate-800 text-white'
        }`}
      >
        {/* Header */}
        <div
          className={`p-5 sm:p-6 border-b flex items-center justify-between ${
            isNitido
              ? 'bg-slate-50/80 border-slate-200'
              : 'bg-slate-950/50 border-slate-800'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border ${
                isNitido
                  ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
                  : 'bg-emerald-950/80 border-emerald-700/50 text-emerald-400'
              }`}
            >
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className={`text-base sm:text-lg font-black tracking-tight ${isNitido ? 'text-slate-900' : 'text-white'}`}>
                  Exportar CSV por Rango de Fechas
                </h3>
                <span
                  className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider border ${
                    isNitido
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                  }`}
                >
                  Excel / Sheets
                </span>
              </div>
              <p className={`text-xs mt-0.5 ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
                Genera un reporte detallado (RFC 4180 UTF-8 BOM) con los movimientos del período seleccionado.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className={`p-2 rounded-xl transition-colors ${
              isNitido
                ? 'text-slate-400 hover:text-slate-700 hover:bg-slate-200/60'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto">
          {/* Quick Preset Buttons */}
          <div>
            <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${isNitido ? 'text-slate-700' : 'text-slate-300'}`}>
              Atajos Rápidos de Período
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { id: 'este_mes', label: 'Este Mes' },
                { id: 'mes_anterior', label: 'Mes Anterior' },
                { id: 'ultimos_30', label: 'Últimos 30 días' },
                { id: 'ultimos_90', label: 'Últimos 90 días' },
                { id: 'este_ano', label: 'Año en Curso' },
                { id: 'todo', label: 'Todo el Historial' },
              ].map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset.id)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border text-center ${
                    activePreset === preset.id
                      ? isNitido
                        ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                        : 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                      : isNitido
                      ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                      : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Date Pickers (Desde / Hasta) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className={`block text-xs font-bold mb-1.5 flex items-center gap-1.5 ${isNitido ? 'text-slate-800' : 'text-slate-200'}`}>
                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                Fecha Inicial (Desde)
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setActivePreset('custom');
                }}
                className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-bold border outline-hidden transition-all ${
                  isNitido
                    ? 'bg-white border-slate-300 text-slate-900 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100'
                    : 'bg-slate-800 border-slate-700 text-white focus:border-indigo-500'
                }`}
              />
            </div>

            <div>
              <label className={`block text-xs font-bold mb-1.5 flex items-center gap-1.5 ${isNitido ? 'text-slate-800' : 'text-slate-200'}`}>
                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                Fecha Final (Hasta)
              </label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setActivePreset('custom');
                }}
                className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-bold border outline-hidden transition-all ${
                  isNitido
                    ? 'bg-white border-slate-300 text-slate-900 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100'
                    : 'bg-slate-800 border-slate-700 text-white focus:border-indigo-500'
                }`}
              />
            </div>
          </div>

          {/* Secondary Filters: Tipo and Estado */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
            <div>
              <label className={`block text-xs font-bold mb-1.5 flex items-center gap-1.5 ${isNitido ? 'text-slate-800' : 'text-slate-200'}`}>
                <Filter className="w-3.5 h-3.5 text-slate-500" />
                Filtrar por Tipo
              </label>
              <div className="grid grid-cols-3 gap-1 p-0.5 rounded-xl border border-slate-200 bg-slate-100">
                <button
                  type="button"
                  onClick={() => setTypeFilter('todos')}
                  className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                    typeFilter === 'todos'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Todos
                </button>
                <button
                  type="button"
                  onClick={() => setTypeFilter('gasto')}
                  className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                    typeFilter === 'gasto'
                      ? 'bg-rose-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Gastos
                </button>
                <button
                  type="button"
                  onClick={() => setTypeFilter('ingreso')}
                  className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                    typeFilter === 'ingreso'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Ingresos
                </button>
              </div>
            </div>

            <div>
              <label className={`block text-xs font-bold mb-1.5 flex items-center gap-1.5 ${isNitido ? 'text-slate-800' : 'text-slate-200'}`}>
                <Layers className="w-3.5 h-3.5 text-slate-500" />
                Estado del Movimiento
              </label>
              <div className="grid grid-cols-3 gap-1 p-0.5 rounded-xl border border-slate-200 bg-slate-100">
                <button
                  type="button"
                  onClick={() => setStatusFilter('todos')}
                  className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                    statusFilter === 'todos'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Todos
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('pagado')}
                  className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                    statusFilter === 'pagado'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Pagados
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('pendiente')}
                  className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                    statusFilter === 'pendiente'
                      ? 'bg-amber-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Pendientes
                </button>
              </div>
            </div>
          </div>

          {/* Live Preview Summary Card */}
          <div
            className={`p-4 rounded-2xl border transition-all ${
              isNitido
                ? 'bg-slate-50 border-slate-200'
                : 'bg-slate-950/70 border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className={`text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${isNitido ? 'text-slate-800' : 'text-slate-200'}`}>
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                Vista Previa del Reporte
              </span>
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded-md border ${
                  filteredPayments.length > 0
                    ? isNitido
                      ? 'bg-indigo-50 text-indigo-900 border-indigo-200'
                      : 'bg-indigo-950 text-indigo-300 border-indigo-800'
                    : 'bg-slate-200 text-slate-700 border-slate-300'
                }`}
              >
                {filteredPayments.length} movimientos encontrados
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className={`p-2.5 rounded-xl border ${isNitido ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'}`}>
                <span className="text-[10px] font-bold text-emerald-600 block">Total Ingresos</span>
                <span className={`text-xs sm:text-sm font-black ${isNitido ? 'text-emerald-700' : 'text-emerald-400'}`}>
                  +{profile.currencySymbol}{totalFilteredIncome.toLocaleString()}
                </span>
              </div>

              <div className={`p-2.5 rounded-xl border ${isNitido ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'}`}>
                <span className="text-[10px] font-bold text-rose-600 block">Total Gastos</span>
                <span className={`text-xs sm:text-sm font-black ${isNitido ? 'text-rose-700' : 'text-rose-400'}`}>
                  -{profile.currencySymbol}{totalFilteredExpenses.toLocaleString()}
                </span>
              </div>

              <div className={`p-2.5 rounded-xl border ${isNitido ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'}`}>
                <span className="text-[10px] font-bold text-slate-500 block">Balance Neto</span>
                <span
                  className={`text-xs sm:text-sm font-black ${
                    netBalance >= 0
                      ? isNitido ? 'text-indigo-800' : 'text-cyan-400'
                      : isNitido ? 'text-rose-700' : 'text-rose-400'
                  }`}
                >
                  {netBalance >= 0 ? '+' : '-'}{profile.currencySymbol}{Math.abs(netBalance).toLocaleString()}
                </span>
              </div>
            </div>

            {filteredPayments.length === 0 && (
              <div className="flex items-center gap-2 mt-3 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                <span>No hay movimientos registrados en las fechas seleccionadas ({startDate} a {endDate}). Ajusta las fechas o el filtro.</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div
          className={`p-4 sm:p-5 border-t flex items-center justify-between gap-3 ${
            isNitido ? 'bg-slate-50/80 border-slate-200' : 'bg-slate-950/50 border-slate-800'
          }`}
        >
          <button
            type="button"
            onClick={onClose}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors border ${
              isNitido
                ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
            }`}
          >
            Cancelar
          </button>

          <button
            type="button"
            disabled={isExporting || filteredPayments.length === 0}
            onClick={handleDownload}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
              isNitido
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : 'bg-emerald-600 hover:bg-emerald-500'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>
              {isExporting ? 'Generando CSV...' : `Descargar Reporte CSV (${filteredPayments.length})`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
