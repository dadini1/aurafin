import React, { useState } from 'react';
import {
  FileSpreadsheet,
  FileCode,
  Download,
  Copy,
  Check,
  X,
  CheckSquare,
  Square,
  ShieldCheck,
  Sparkles,
  Info,
  Layers,
  Database,
  ArrowRight,
} from 'lucide-react';
import { PaymentItem, SavingsGoal, NoteItem, UserFinancialProfile } from '../types';
import {
  ExportOptions,
  DEFAULT_EXPORT_OPTIONS,
  exportFinancialDataToCSV,
  exportFinancialDataToJSON,
  buildFinancialExportJSON,
} from '../utils/financialDataExporter';

interface ExportDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  payments: PaymentItem[];
  goals: SavingsGoal[];
  notes?: NoteItem[];
  profile: UserFinancialProfile;
  categoryBudgets: Record<string, number>;
  onExportSuccess?: (message: string) => void;
}

export const ExportDataModal: React.FC<ExportDataModalProps> = ({
  isOpen,
  onClose,
  payments,
  goals,
  notes = [],
  profile,
  categoryBudgets,
  onExportSuccess,
}) => {
  const [format, setFormat] = useState<'csv' | 'json'>('csv');
  const [options, setOptions] = useState<ExportOptions>(DEFAULT_EXPORT_OPTIONS);
  const [copied, setCopied] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  if (!isOpen) return null;

  const dateStr = new Date().toISOString().split('T')[0];
  const countrySlug = profile.country.replace(/\s+/g, '_');
  const targetExtension = format === 'csv' ? 'csv' : 'json';
  const previewFilename = `AuraFin_Finanzas_Notas_Metas_${countrySlug}_${dateStr}.${targetExtension}`;

  const selectedCount =
    (options.includePayments ? payments.length : 0) +
    (options.includeSavingsGoals ? goals.length : 0) +
    (options.includeNotes ? notes.length : 0);

  const toggleOption = (key: keyof ExportOptions) => {
    setOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleDownload = () => {
    setIsExporting(true);
    try {
      if (format === 'csv') {
        const { filename, totalRecords } = exportFinancialDataToCSV(
          payments,
          goals,
          notes,
          profile,
          categoryBudgets,
          options
        );
        onExportSuccess &&
          onExportSuccess(`¡${totalRecords} registros exportados exitosamente a ${filename}!`);
      } else {
        const { filename, totalRecords, sizeKB } = exportFinancialDataToJSON(
          payments,
          goals,
          notes,
          profile,
          categoryBudgets,
          options
        );
        onExportSuccess &&
          onExportSuccess(`¡${totalRecords} registros estructurados (${sizeKB} KB) exportados a ${filename}!`);
      }
      onClose();
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyJSON = () => {
    try {
      const data = buildFinancialExportJSON(payments, goals, notes, profile, categoryBudgets, options);
      navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Clipboard copy error:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md overflow-y-auto animate-fadeIn">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/20">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white tracking-tight">
                Exportar Historial de Pagos y Ahorros
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Genera archivos para análisis externo en Excel, Google Sheets, Python o BI.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 custom-scrollbar">
          {/* Format Selection Cards */}
          <div>
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-2">
              1. Selecciona el Formato de Exportación
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* CSV Card */}
              <button
                type="button"
                onClick={() => setFormat('csv')}
                className={`p-4 rounded-2xl border text-left transition-all relative flex flex-col justify-between ${
                  format === 'csv'
                    ? 'bg-emerald-950/40 border-emerald-500 ring-1 ring-emerald-500/40 shadow-lg'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <span
                    className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      format === 'csv' ? 'border-emerald-400 bg-emerald-500 text-slate-950' : 'border-slate-700'
                    }`}
                  >
                    {format === 'csv' && <Check className="w-3 h-3 stroke-[3]" />}
                  </span>
                </div>
                <div className="mt-3">
                  <h4 className="text-sm font-bold text-white">Formato CSV (.csv)</h4>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    Compatible con Microsoft Excel, Google Sheets y Apple Numbers. Formato RFC 4180 con UTF-8 BOM.
                  </p>
                </div>
              </button>

              {/* JSON Card */}
              <button
                type="button"
                onClick={() => setFormat('json')}
                className={`p-4 rounded-2xl border text-left transition-all relative flex flex-col justify-between ${
                  format === 'json'
                    ? 'bg-cyan-950/40 border-cyan-500 ring-1 ring-cyan-500/40 shadow-lg'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="p-2.5 rounded-xl bg-cyan-500/20 text-cyan-400">
                    <FileCode className="w-5 h-5" />
                  </div>
                  <span
                    className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      format === 'json' ? 'border-cyan-400 bg-cyan-500 text-slate-950' : 'border-slate-700'
                    }`}
                  >
                    {format === 'json' && <Check className="w-3 h-3 stroke-[3]" />}
                  </span>
                </div>
                <div className="mt-3">
                  <h4 className="text-sm font-bold text-white">Formato JSON (.json)</h4>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    Estructura de datos completa y tipada. Ideal para Python (Pandas), Claude, Jupyter Notebooks o BI.
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Options Checklist */}
          <div>
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-2">
              2. Datos a Incluir en la Exportación
            </label>
            <div className="space-y-2 bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
              <button
                type="button"
                onClick={() => toggleOption('includePayments')}
                className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-slate-900/60 transition-colors text-left text-xs"
              >
                <div className="flex items-center gap-2.5">
                  {options.includePayments ? (
                    <CheckSquare className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-600" />
                  )}
                  <span className="text-slate-200 font-semibold">Historial de Pagos y Gastos</span>
                </div>
                <span className="text-[11px] text-slate-400 font-medium">
                  {payments.length} transacciones
                </span>
              </button>

              <button
                type="button"
                onClick={() => toggleOption('includeSavingsGoals')}
                className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-slate-900/60 transition-colors text-left text-xs"
              >
                <div className="flex items-center gap-2.5">
                  {options.includeSavingsGoals ? (
                    <CheckSquare className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-600" />
                  )}
                  <span className="text-slate-200 font-semibold">Metas de Ahorro y Progreso Acumulado</span>
                </div>
                <span className="text-[11px] text-slate-400 font-medium">
                  {goals.length} metas programadas
                </span>
              </button>

              <button
                type="button"
                onClick={() => toggleOption('includeNotes')}
                className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-slate-900/60 transition-colors text-left text-xs"
              >
                <div className="flex items-center gap-2.5">
                  {options.includeNotes ? (
                    <CheckSquare className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-600" />
                  )}
                  <span className="text-slate-200 font-semibold">Notas Financieras y Recordatorios de Voz</span>
                </div>
                <span className="text-[11px] text-slate-400 font-medium">
                  {notes.length} notas
                </span>
              </button>

              <button
                type="button"
                onClick={() => toggleOption('includeSavingsStrategy')}
                className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-slate-900/60 transition-colors text-left text-xs"
              >
                <div className="flex items-center gap-2.5">
                  {options.includeSavingsStrategy ? (
                    <CheckSquare className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-600" />
                  )}
                  <span className="text-slate-200 font-semibold">
                    Estrategia de Ahorro a 6 Meses y Recortes Sugeridos
                  </span>
                </div>
                <span className="text-[11px] text-cyan-400 font-bold">Plan Personalizado</span>
              </button>

              <button
                type="button"
                onClick={() => toggleOption('includeProfileSummary')}
                className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-slate-900/60 transition-colors text-left text-xs"
              >
                <div className="flex items-center gap-2.5">
                  {options.includeProfileSummary ? (
                    <CheckSquare className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-600" />
                  )}
                  <span className="text-slate-200 font-semibold">
                    Resumen de Salud Financiera y Ratios de Ahorro
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 font-medium">Métricas Globales</span>
              </button>
            </div>
          </div>

          {/* Target File Preview */}
          <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold text-slate-300">Archivo de Salida:</span>
              <span className="font-bold text-white text-[11px] font-mono">{previewFilename}</span>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-800">
              <span>Registros principales seleccionados:</span>
              <span className="font-bold text-emerald-400">{selectedCount} elementos</span>
            </div>

            {format === 'json' && (
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleCopyJSON}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold transition-colors"
                  title="Copiar JSON directamente al portapapeles"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">¡Copiado al Portapapeles!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Copiar JSON a Portapapeles</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 text-xs sm:text-sm font-semibold transition-colors"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleDownload}
            disabled={isExporting || selectedCount === 0}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm shadow-lg transition-all disabled:opacity-50 ${
              format === 'csv'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-950/40'
                : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-cyan-950/40'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>Descargar Archivo {format.toUpperCase()}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
