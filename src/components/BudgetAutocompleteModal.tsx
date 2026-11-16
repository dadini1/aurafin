import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  Calculator,
  Check,
  X,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Sliders,
  Car,
  Home,
  ShoppingBag,
  Zap,
  Coffee,
  HeartPulse,
  BookOpen,
  DollarSign,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { PaymentItem, UserFinancialProfile } from '../types';
import {
  autocompleteCategoryBudgets,
  BudgetAutocompleteResult,
  CategoryThreeMonthAverage,
} from '../services/budgetAutocompleteService';

interface BudgetAutocompleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  payments: PaymentItem[];
  profile: UserFinancialProfile;
  categoryBudgets: Record<string, number>;
  onApplyBudgets: (updatedBudgets: Record<string, number>) => void;
  onSuccessMessage?: (msg: string) => void;
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

export const BudgetAutocompleteModal: React.FC<BudgetAutocompleteModalProps> = ({
  isOpen,
  onClose,
  payments,
  profile,
  categoryBudgets,
  onApplyBudgets,
  onSuccessMessage,
}) => {
  const [strategyMode, setStrategyMode] = useState<'exact' | 'buffer' | 'optimized'>('exact');
  const [customEdits, setCustomEdits] = useState<Record<string, number>>({});
  const [applied, setApplied] = useState(false);

  const currSym = profile.currencySymbol || '$';

  // Run autocomplete calculation
  const autocompleteResult: BudgetAutocompleteResult = useMemo(() => {
    return autocompleteCategoryBudgets(payments, categoryBudgets, profile);
  }, [payments, categoryBudgets, profile]);

  // Determine active targets according to mode
  const activeSuggestedMap = useMemo(() => {
    if (strategyMode === 'buffer') return autocompleteResult.suggestedBudgetsWithBuffer;
    if (strategyMode === 'optimized') return autocompleteResult.suggestedBudgetsOptimized;
    return autocompleteResult.suggestedBudgets;
  }, [strategyMode, autocompleteResult]);

  // Sync edits on open or mode switch
  React.useEffect(() => {
    setCustomEdits(activeSuggestedMap);
  }, [activeSuggestedMap, isOpen]);

  if (!isOpen) return null;

  const totalCalculatedBudget = Object.values(customEdits).reduce((sum, v) => sum + v, 0);
  const totalCurrentBudget = Object.values(categoryBudgets).reduce((sum, v) => sum + v, 0);
  const difference = totalCalculatedBudget - totalCurrentBudget;

  const handleApplyAll = () => {
    const finalBudgets = { ...categoryBudgets, ...customEdits };
    onApplyBudgets(finalBudgets);
    setApplied(true);
    onSuccessMessage &&
      onSuccessMessage(
        `¡Presupuestos autocompletados exitosamente según el promedio de los últimos 3 meses (${autocompleteResult.monthsAnalyzed.join(', ')})!`
      );
    setTimeout(() => {
      setApplied(false);
      onClose();
    }, 1200);
  };

  const handleApplySingleCategory = (cat: string, value: number) => {
    onApplyBudgets({ ...categoryBudgets, [cat]: value });
    onSuccessMessage &&
      onSuccessMessage(`Límite para ${cat} actualizado a ${currSym}${value} según el promedio de 3 meses.`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md overflow-y-auto animate-fadeIn">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
                  Autocompletar Presupuestos
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Promedio 3 Meses
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Calcula y sugiere límites mensuales basados en tu consumo real de{' '}
                <strong className="text-slate-200">
                  {autocompleteResult.monthsAnalyzed.join(', ')}
                </strong>
                .
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
          {/* Strategy Mode Switcher */}
          <div>
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-2">
              Modo de Cálculo de Límites:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setStrategyMode('exact')}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  strategyMode === 'exact'
                    ? 'bg-emerald-950/50 border-emerald-500 ring-1 ring-emerald-500/30 shadow-md'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Promedio Exacto</span>
                  {strategyMode === 'exact' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                </div>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                  Límites ajustados 100% al promedio de consumo histórico real de los últimos 3 meses.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setStrategyMode('buffer')}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  strategyMode === 'buffer'
                    ? 'bg-cyan-950/50 border-cyan-500 ring-1 ring-cyan-500/30 shadow-md'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Con Colchón (+5%)</span>
                  {strategyMode === 'buffer' && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                </div>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                  Añade un margen flexible del 5% para prevenir falsas alertas ante gastos imprevistos.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setStrategyMode('optimized')}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  strategyMode === 'optimized'
                    ? 'bg-indigo-950/50 border-indigo-500 ring-1 ring-indigo-500/30 shadow-md'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Optimizado (-10%)</span>
                  {strategyMode === 'optimized' && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                </div>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                  Fija metas de recorte disciplinado en categorías variables para acelerar tu ahorro.
                </p>
              </button>
            </div>
          </div>

          {/* Metric Comparison Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Presupuesto Actual Total
              </span>
              <div className="text-lg font-black text-white mt-0.5">
                {currSym}{totalCurrentBudget.toLocaleString()}
              </div>
              <span className="text-[10px] text-slate-400 mt-0.5 block">Suma de límites vigentes</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Presupuesto Sugerido 3M
              </span>
              <div className="text-lg font-black text-emerald-400 mt-0.5">
                {currSym}{totalCalculatedBudget.toLocaleString()}
              </div>
              <span className="text-[10px] text-emerald-400/80 mt-0.5 block">
                Basado en histórico
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Ajuste Mensual
              </span>
              <div
                className={`text-lg font-black mt-0.5 ${
                  difference <= 0 ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                {difference > 0 ? `+${currSym}${difference}` : `-${currSym}${Math.abs(difference)}`}
              </div>
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                {difference <= 0 ? 'Liberación de presupuesto' : 'Ampliación realista'}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Meses Considerados
              </span>
              <div className="text-xs font-bold text-cyan-300 mt-1 truncate">
                {autocompleteResult.monthsAnalyzed.join(', ')}
              </div>
              <span className="text-[10px] text-slate-400 mt-0.5 block">Último trimestre cerrado</span>
            </div>
          </div>

          {/* Detailed Categories Breakdown Table / Cards */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Desglose por Categoría y Promedios:
              </span>
              <span className="text-[11px] text-slate-400">
                Puedes ajustar manualmente cualquier valor antes de aplicar
              </span>
            </div>

            <div className="space-y-2.5">
              {autocompleteResult.categoryBreakdown.map((row) => {
                const Icon = CATEGORY_ICONS[row.category] || DollarSign;
                const style = CATEGORY_COLORS[row.category] || {
                  bg: 'bg-slate-500/10',
                  text: 'text-slate-400',
                  border: 'border-slate-500/20',
                };
                const userVal = customEdits[row.category] ?? row.suggestedLimit;
                const isDifferent = userVal !== row.currentBudget;

                return (
                  <div
                    key={row.category}
                    className="p-3.5 sm:p-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition-all space-y-2.5 shadow-sm"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      {/* Left: Category info & 3-month pill */}
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl ${style.bg} ${style.text} ${style.border} border shrink-0`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-white">{row.categoryLabel}</h4>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                row.isFixed
                                  ? 'bg-indigo-500/20 text-indigo-300'
                                  : 'bg-rose-500/20 text-rose-300'
                              }`}
                            >
                              {row.isFixed ? 'Fijo' : 'Variable'}
                            </span>
                            {row.trend === 'increasing' && (
                              <span className="text-[10px] text-amber-300 font-semibold flex items-center gap-0.5">
                                <TrendingUp className="w-3 h-3" /> +{row.trendPercentage}%
                              </span>
                            )}
                          </div>

                          {/* 3-month history line */}
                          <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1 flex-wrap">
                            <span>Historial:</span>
                            <span className="text-slate-300">
                              {autocompleteResult.monthsAnalyzed[0]}: {currSym}{row.month1Spend}
                            </span>
                            <span>•</span>
                            <span className="text-slate-300">
                              {autocompleteResult.monthsAnalyzed[1]}: {currSym}{row.month2Spend}
                            </span>
                            <span>•</span>
                            <span className="text-slate-300">
                              {autocompleteResult.monthsAnalyzed[2]}: {currSym}{row.month3Spend}
                            </span>
                            <span className="text-cyan-400 font-bold ml-1">
                              (Promedio 3M: {currSym}{row.threeMonthAverage})
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Inputs & Suggested Action */}
                      <div className="flex items-center gap-3 justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800">
                        <div className="text-right">
                          <span className="text-[10px] uppercase font-bold text-slate-500 block">
                            Actual
                          </span>
                          <span className="text-xs font-semibold text-slate-400">
                            {currSym}{row.currentBudget}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-400">{currSym}</span>
                          <input
                            type="number"
                            min="10"
                            step="5"
                            value={userVal}
                            onChange={(e) => {
                              const val = Number(e.target.value) || 0;
                              setCustomEdits((prev) => ({ ...prev, [row.category]: val }));
                            }}
                            className="w-24 px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-extrabold text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none text-right shadow-inner"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => handleApplySingleCategory(row.category, userVal)}
                          className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs font-semibold transition-colors"
                          title="Aplicar sólo a esta categoría"
                        >
                          Aplicar
                        </button>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-400 leading-relaxed pt-1 border-t border-slate-800/60">
                      {row.rationale}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs text-slate-400">
            {applied ? (
              <span className="text-emerald-400 font-bold flex items-center gap-1.5 animate-fadeIn">
                <CheckCircle2 className="w-4 h-4" />
                ¡Presupuestos actualizados con éxito según el promedio de 3 meses!
              </span>
            ) : (
              <span>
                Presupuesto mensual propuesto:{' '}
                <strong className="text-white">
                  {currSym}{totalCalculatedBudget.toLocaleString()}
                </strong>{' '}
                ({difference >= 0 ? '+' : ''}{currSym}{difference} vs actual).
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 text-xs sm:text-sm font-semibold transition-colors"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleApplyAll}
              disabled={applied}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-emerald-950/40 transition-all disabled:opacity-50"
            >
              {applied ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>¡Aplicado!</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Autocompletar Todos los Presupuestos</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
