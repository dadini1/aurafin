import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  TrendingDown,
  TrendingUp,
  X,
  Check,
  CheckCircle2,
  Sliders,
  DollarSign,
  ArrowRight,
  ShieldAlert,
  Car,
  Home,
  ShoppingBag,
  Zap,
  Coffee,
  HeartPulse,
  BookOpen,
  HelpCircle,
  RotateCcw,
  RefreshCw,
  Target,
  ArrowUpRight,
} from 'lucide-react';
import {
  PaymentItem,
  UserFinancialProfile,
  SavingsGoal,
  CategorySpendingPattern,
  BudgetOptimizationResult,
} from '../types';
import {
  calculate3MonthPatterns,
  analyzeBudgetPatternsWithAI,
} from '../services/geminiService';

interface BudgetOptimizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  payments: PaymentItem[];
  profile: UserFinancialProfile;
  goals: SavingsGoal[];
  categoryBudgets: Record<string, number>;
  onApplyCategoryBudgets: (updatedBudgets: Record<string, number>) => void;
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

const CATEGORY_COLORS: Record<string, string> = {
  transporte: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  alquiler: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
  alimentacion: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
  servicios: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
  ocio: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  salud: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  educacion: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  otro: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
};

export const BudgetOptimizerModal: React.FC<BudgetOptimizerModalProps> = ({
  isOpen,
  onClose,
  payments,
  profile,
  goals,
  categoryBudgets,
  onApplyCategoryBudgets,
}) => {
  const [loading, setLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<BudgetOptimizationResult | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'variables' | 'fixed'>('all');
  
  // Custom edited limits: Record<category, userProposedAmount>
  const [customBudgets, setCustomBudgets] = useState<Record<string, number>>({});
  // Toggles for whether to apply changes for a category
  const [enabledCategories, setEnabledCategories] = useState<Record<string, boolean>>({});
  const [appliedSuccess, setAppliedSuccess] = useState(false);

  // Load initial analysis on modal open
  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      setAppliedSuccess(false);

      // Deterministic baseline first
      const baseline = calculate3MonthPatterns(payments, categoryBudgets, profile, goals);
      setAnalysisResult(baseline);

      const initialBudgets: Record<string, number> = {};
      const initialEnabled: Record<string, boolean> = {};
      baseline.categories.forEach((cat) => {
        initialBudgets[cat.category] = cat.suggestedBudget;
        initialEnabled[cat.category] = cat.potentialMonthlySavings > 0;
      });
      setCustomBudgets(initialBudgets);
      setEnabledCategories(initialEnabled);

      // Async fetch AI enrichment
      analyzeBudgetPatternsWithAI(payments, categoryBudgets, profile, goals)
        .then((aiResult) => {
          setAnalysisResult(aiResult);
          const updatedBudgets: Record<string, number> = {};
          aiResult.categories.forEach((cat) => {
            updatedBudgets[cat.category] = cat.suggestedBudget;
          });
          setCustomBudgets(updatedBudgets);
        })
        .catch((err) => {
          console.warn('AI budget analysis error:', err);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleResetToAI = () => {
    if (!analysisResult) return;
    const resetBudgets: Record<string, number> = {};
    const resetEnabled: Record<string, boolean> = {};
    analysisResult.categories.forEach((cat) => {
      resetBudgets[cat.category] = cat.suggestedBudget;
      resetEnabled[cat.category] = cat.potentialMonthlySavings > 0;
    });
    setCustomBudgets(resetBudgets);
    setEnabledCategories(resetEnabled);
  };

  const handleBudgetChange = (category: string, value: number) => {
    setCustomBudgets((prev) => ({
      ...prev,
      [category]: Math.max(10, value),
    }));
  };

  const handleToggleCategory = (category: string) => {
    setEnabledCategories((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  // Dynamic calculations based on user adjustments
  let calculatedCurrentTotal = 0;
  let calculatedOptimizedTotal = 0;

  analysisResult?.categories.forEach((cat) => {
    const currentLimit = cat.currentBudget;
    calculatedCurrentTotal += currentLimit;
    const isEnabled = enabledCategories[cat.category] ?? false;
    const newLimit = isEnabled ? (customBudgets[cat.category] ?? cat.suggestedBudget) : currentLimit;
    calculatedOptimizedTotal += newLimit;
  });

  const calculatedMonthlySavings = Math.max(0, calculatedCurrentTotal - calculatedOptimizedTotal);
  const calculatedAnnualSavings = calculatedMonthlySavings * 12;

  const monthlyIncome = profile.monthlyIncome || 2400;
  const currentSavingsPercent = Math.round((Math.max(0, monthlyIncome - calculatedCurrentTotal) / monthlyIncome) * 100);
  const optimizedSavingsPercent = Math.round((Math.max(0, monthlyIncome - calculatedOptimizedTotal) / monthlyIncome) * 100);

  const handleApply = () => {
    const finalBudgets: Record<string, number> = { ...categoryBudgets };
    analysisResult?.categories.forEach((cat) => {
      if (enabledCategories[cat.category]) {
        finalBudgets[cat.category] = customBudgets[cat.category] ?? cat.suggestedBudget;
      }
    });

    onApplyCategoryBudgets(finalBudgets);
    setAppliedSuccess(true);
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  const filteredCategories = analysisResult?.categories.filter((cat) => {
    if (filterType === 'variables') return !cat.isFixed;
    if (filterType === 'fixed') return cat.isFixed;
    return true;
  }) || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        
        {/* MODAL HEADER */}
        <div className="p-5 sm:p-6 border-b border-slate-800 flex items-start justify-between gap-4 bg-slate-950/50">
          <div className="flex items-start gap-3.5">
            <div className="p-3 rounded-2xl bg-gradient-to-tr from-cyan-500/20 via-emerald-500/20 to-indigo-500/20 border border-cyan-500/30 text-cyan-300 shrink-0">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-bold text-white">
                  Optimizador de Presupuestos IA (Últimos 3 Meses)
                </h2>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  {analysisResult?.monthsAnalyzed.join(' - ')}
                </span>
                {loading && (
                  <span className="flex items-center gap-1 text-[11px] font-medium text-cyan-400">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    Refinando con Gemini...
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Análisis automático de patrones de gasto histórico. Ajusta límites en <code className="text-cyan-300 bg-slate-800 px-1 py-0.5 rounded">categoryBudgets</code> para maximizar tu capacidad mensual de ahorro.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 text-slate-200">
          
          {/* TOP METRICS CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {/* Ahorro Mensual Adicional */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-500/30 shadow-lg">
              <div className="flex items-center justify-between text-xs text-emerald-400 font-semibold mb-1">
                <span>Ahorro Extra Liberado</span>
                <TrendingUp className="w-4 h-4" />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-black text-emerald-300">
                  +{profile.currencySymbol}{calculatedMonthlySavings.toLocaleString()}
                </span>
                <span className="text-xs text-slate-400">/ mes</span>
              </div>
              <span className="text-[11px] text-emerald-300/80 mt-1 block">
                +{profile.currencySymbol}{calculatedAnnualSavings.toLocaleString()} proyectado a 12 meses
              </span>
            </div>

            {/* Capacidad de Ahorro % */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-cyan-950/40 via-slate-900 to-slate-900 border border-cyan-500/30 shadow-lg">
              <div className="flex items-center justify-between text-xs text-cyan-400 font-semibold mb-1">
                <span>Capacidad de Ahorro</span>
                <Sliders className="w-4 h-4" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold text-slate-400 line-through">
                  {currentSavingsPercent}%
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-2xl sm:text-3xl font-black text-cyan-300">
                  {optimizedSavingsPercent}%
                </span>
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">
                Presupuesto mensual: {profile.currencySymbol}{calculatedOptimizedTotal.toLocaleString()}
              </span>
            </div>

            {/* Aceleración de Metas */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-950/40 via-slate-900 to-slate-900 border border-indigo-500/30 shadow-lg">
              <div className="flex items-center justify-between text-xs text-indigo-400 font-semibold mb-1">
                <span>Aceleración de Metas</span>
                <Target className="w-4 h-4" />
              </div>
              <div className="text-sm font-bold text-white truncate">
                {analysisResult?.goalsImpact[0]?.goalTitle || 'Fondo de Ahorro'}
              </div>
              <span className="text-[11px] text-indigo-300 mt-1 block">
                Cumplimiento{' '}
                <strong className="text-emerald-300">
                  {analysisResult?.goalsImpact[0]?.monthsSaved || 2} meses antes
                </strong>{' '}
                con este ahorro.
              </span>
            </div>
          </div>

          {/* AI STRATEGIC OVERVIEW BANNER */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                Diagnóstico Estratégico de AuraFin AI
              </h4>
              <button
                onClick={handleResetToAI}
                className="text-[11px] text-slate-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
                title="Restaurar sugerencias automáticas de la IA"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Restaurar recomendados</span>
              </button>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {analysisResult?.aiStrategicOverview}
            </p>

            {analysisResult?.keyActionItems && analysisResult.keyActionItems.length > 0 && (
              <div className="pt-2 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-2 gap-2">
                {analysisResult.keyActionItems.map((action, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-[11px] text-slate-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{action}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* FILTER CONTROLS */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setFilterType('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  filterType === 'all' ? 'bg-cyan-500 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                Todas ({analysisResult?.categories.length})
              </button>
              <button
                onClick={() => setFilterType('variables')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  filterType === 'variables' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                Variables / Flexibles
              </button>
              <button
                onClick={() => setFilterType('fixed')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  filterType === 'fixed' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                Fijos / Esenciales
              </button>
            </div>

            <span className="text-xs text-slate-400">
              Marca o desmarca las categorías para incluirlas en el nuevo presupuesto
            </span>
          </div>

          {/* CATEGORIES BREAKDOWN & ADJUSTMENT CARDS */}
          <div className="space-y-3">
            {filteredCategories.map((cat) => {
              const Icon = CATEGORY_ICONS[cat.category] || DollarSign;
              const colorClasses = CATEGORY_COLORS[cat.category] || 'text-slate-400 bg-slate-500/10 border-slate-500/20';
              const isEnabled = enabledCategories[cat.category] ?? true;
              const currentVal = customBudgets[cat.category] ?? cat.suggestedBudget;
              const currentDelta = cat.currentBudget - currentVal;
              const deltaPercent = cat.currentBudget > 0 ? Math.round((currentDelta / cat.currentBudget) * 100) : 0;

              const max3Spend = Math.max(cat.month1Spend, cat.month2Spend, cat.month3Spend, cat.currentBudget, 1);

              return (
                <div
                  key={cat.category}
                  className={`p-4 rounded-2xl border transition-all ${
                    isEnabled
                      ? 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                      : 'bg-slate-950/30 border-slate-900 opacity-60'
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Category Title & Info */}
                    <div className="flex items-start gap-3 min-w-[220px]">
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={() => handleToggleCategory(cat.category)}
                        className="mt-1 w-4 h-4 rounded text-cyan-500 bg-slate-900 border-slate-700 focus:ring-cyan-500 focus:ring-offset-slate-900 cursor-pointer"
                        title="Activar/desactivar optimización de esta categoría"
                      />
                      <div className={`p-2 rounded-xl border shrink-0 ${colorClasses}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h5 className="text-sm font-bold text-white">
                            {cat.categoryLabel}
                          </h5>
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                            cat.isFixed
                              ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                              : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                          }`}>
                            {cat.isFixed ? 'Fijo' : 'Variable'}
                          </span>
                          {cat.trend === 'increasing' && (
                            <span className="text-[10px] font-bold text-rose-400 flex items-center gap-0.5">
                              <TrendingUp className="w-3 h-3" /> +{cat.trendPercentage}% al alza
                            </span>
                          )}
                          {cat.trend === 'decreasing' && (
                            <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-0.5">
                              <TrendingDown className="w-3 h-3" /> {cat.trendPercentage}% a la baja
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Promedio 3 meses: <strong className="text-slate-200">{profile.currencySymbol}{cat.averageSpend}</strong> / mes
                        </div>
                      </div>
                    </div>

                    {/* 3-Month Mini Visualization */}
                    <div className="flex items-center gap-3 bg-slate-900/80 px-3.5 py-2 rounded-xl border border-slate-800 text-xs">
                      <div className="flex flex-col items-center">
                        <span className="text-[10px] text-slate-400 font-semibold">{analysisResult?.monthsAnalyzed[0]}</span>
                        <span className="font-bold text-slate-300">{profile.currencySymbol}{cat.month1Spend}</span>
                        <div className="w-10 h-1.5 bg-slate-800 rounded-full mt-1 overflow-hidden">
                          <div
                            style={{ width: `${Math.min(100, (cat.month1Spend / max3Spend) * 100)}%` }}
                            className="h-full bg-slate-500"
                          />
                        </div>
                      </div>

                      <span className="text-slate-600 font-bold">›</span>

                      <div className="flex flex-col items-center">
                        <span className="text-[10px] text-slate-400 font-semibold">{analysisResult?.monthsAnalyzed[1]}</span>
                        <span className="font-bold text-slate-300">{profile.currencySymbol}{cat.month2Spend}</span>
                        <div className="w-10 h-1.5 bg-slate-800 rounded-full mt-1 overflow-hidden">
                          <div
                            style={{ width: `${Math.min(100, (cat.month2Spend / max3Spend) * 100)}%` }}
                            className="h-full bg-slate-500"
                          />
                        </div>
                      </div>

                      <span className="text-slate-600 font-bold">›</span>

                      <div className="flex flex-col items-center">
                        <span className="text-[10px] text-cyan-400 font-semibold">{analysisResult?.monthsAnalyzed[2]}</span>
                        <span className="font-bold text-cyan-300">{profile.currencySymbol}{cat.month3Spend}</span>
                        <div className="w-10 h-1.5 bg-slate-800 rounded-full mt-1 overflow-hidden">
                          <div
                            style={{ width: `${Math.min(100, (cat.month3Spend / max3Spend) * 100)}%` }}
                            className="h-full bg-cyan-400"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Budget Controls (Current vs Suggested Slider/Input) */}
                    <div className="flex items-center gap-3 justify-between md:justify-end">
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block">Límite Actual</span>
                        <span className="text-xs font-bold text-slate-400 line-through">
                          {profile.currencySymbol}{cat.currentBudget}
                        </span>
                      </div>

                      <ArrowRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />

                      <div className="flex items-center gap-2">
                        <div>
                          <span className="text-[10px] text-cyan-300 font-semibold block">Límite Sugerido</span>
                          <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">
                              {profile.currencySymbol}
                            </span>
                            <input
                              type="number"
                              min="10"
                              step="5"
                              value={currentVal}
                              disabled={!isEnabled}
                              onChange={(e) => handleBudgetChange(cat.category, Number(e.target.value))}
                              className="w-24 pl-6 pr-2 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-bold text-xs focus:ring-2 focus:ring-cyan-500/40 focus:outline-none disabled:opacity-40"
                            />
                          </div>
                        </div>

                        {/* Delta pill */}
                        <div className="min-w-[70px] text-right">
                          {currentDelta > 0 && isEnabled ? (
                            <span className="text-xs font-bold text-emerald-400 block">
                              -{profile.currencySymbol}{currentDelta}
                              <span className="text-[10px] text-emerald-500/80 block">(-{deltaPercent}%)</span>
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-500 block">
                              Sin cambio
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* AI Explanation note */}
                  <div className="mt-2.5 pt-2 border-t border-slate-900 flex items-start gap-2 text-[11px] text-slate-400 leading-relaxed">
                    <Sparkles className="w-3 h-3 text-cyan-400 shrink-0 mt-0.5" />
                    <span>{cat.optimizationRationale}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ACTIVE GOALS ACCELERATION SUMMARY */}
          {analysisResult?.goalsImpact && analysisResult.goalsImpact.length > 0 && (
            <div className="p-4 rounded-2xl bg-indigo-950/30 border border-indigo-800/40 space-y-2">
              <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-indigo-400" />
                Impacto Directo en tus Metas de Ahorro
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {analysisResult.goalsImpact.map((gi, idx) => (
                  <div key={idx} className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-white block truncate">{gi.goalTitle}</span>
                      <span className="text-[11px] text-slate-400">
                        Restan {profile.currencySymbol}{(gi.targetAmount - gi.currentAmount).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-emerald-400 font-extrabold text-xs block">
                        -{gi.monthsSaved} meses
                      </span>
                      <span className="text-[10px] text-slate-500 block">
                        de {gi.originalMonthsRemaining} a {gi.acceleratedMonthsRemaining} meses
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="p-5 sm:p-6 border-t border-slate-800 bg-slate-950/90 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">
              Impacto mensual:{' '}
              <strong className="text-emerald-400 font-bold">
                +{profile.currencySymbol}{calculatedMonthlySavings}/mes
              </strong>{' '}
              ({calculatedCurrentTotal} ➔ {calculatedOptimizedTotal})
            </span>
          </div>

          <div className="flex items-center gap-2.5 justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={appliedSuccess}
              className="px-4 py-2.5 text-xs font-semibold text-slate-400 hover:text-white rounded-xl transition-colors"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleApply}
              disabled={appliedSuccess}
              className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs text-white shadow-xl transition-all ${
                appliedSuccess
                  ? 'bg-emerald-600'
                  : 'bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-600 hover:from-emerald-400 hover:to-cyan-500 shadow-emerald-500/20'
              }`}
            >
              {appliedSuccess ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>¡Presupuesto Optimizado Aplicado!</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>
                    Aplicar Presupuestos Optimizados (+{profile.currencySymbol}{calculatedMonthlySavings}/mes)
                  </span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
