import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  Sparkles,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Car,
  Home,
  ShoppingBag,
  Zap,
  Coffee,
  HeartPulse,
  BookOpen,
  Target,
  Sliders,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Clock,
  Flame,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
} from 'recharts';
import {
  PaymentItem,
  UserFinancialProfile,
  SavingsGoal,
  SixMonthSavingsStrategy,
  CategoryCutRecommendation,
} from '../types';
import { generateSavingsStrategy } from '../services/savingsStrategyService';

interface SavingsStrategyModalProps {
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

export const SavingsStrategyModal: React.FC<SavingsStrategyModalProps> = ({
  isOpen,
  onClose,
  payments,
  profile,
  goals,
  categoryBudgets,
  onApplyCategoryBudgets,
}) => {
  const [activeTab, setActiveTab] = useState<'timeline' | 'exceeded' | 'impact'>('timeline');
  const [showControlled, setShowControlled] = useState(false);
  const [appliedSuccess, setAppliedSuccess] = useState(false);

  // User customizable cuts: initialized from generateSavingsStrategy recommendations
  const [customCuts, setCustomCuts] = useState<Record<string, number>>({});

  // Compute 6-month savings strategy using the function
  const strategy: SixMonthSavingsStrategy = useMemo(() => {
    return generateSavingsStrategy(payments, categoryBudgets, profile, goals);
  }, [payments, categoryBudgets, profile, goals]);

  // Initialize custom cuts when strategy changes
  React.useEffect(() => {
    if (strategy && strategy.exceededCategories) {
      const initial: Record<string, number> = {};
      strategy.exceededCategories.forEach((rec) => {
        initial[rec.category] = rec.suggestedMonthlyCut;
      });
      setCustomCuts(initial);
    }
  }, [strategy]);

  if (!isOpen) return null;

  const currSym = profile.currencySymbol || '$';

  // Compute dynamic cut total based on user customization
  const activeTotalCut = strategy.exceededCategories.reduce((sum, rec) => {
    const cut = customCuts[rec.category] ?? rec.suggestedMonthlyCut;
    return sum + cut;
  }, 0);

  const dynamicSixMonthProjected =
    strategy.sixMonthTimeline.length > 0
      ? strategy.baselineMonthlySavings * 6 + activeTotalCut * 5.8
      : 0;

  const handleApplyAllBudgets = () => {
    const updated = { ...categoryBudgets };
    strategy.exceededCategories.forEach((rec) => {
      const cut = customCuts[rec.category] ?? rec.suggestedMonthlyCut;
      const target = Math.max(20, rec.currentSpend - cut);
      updated[rec.category] = target;
    });

    onApplyCategoryBudgets(updated);
    setAppliedSuccess(true);
    setTimeout(() => {
      setAppliedSuccess(false);
      onClose();
    }, 1800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md overflow-y-auto animate-fadeIn">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/40">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-gradient-to-tr from-cyan-500 to-indigo-600 text-white shadow-lg shadow-cyan-500/20">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
                  Estrategia de Ahorro a 6 Meses
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  Plan Personalizado
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Análisis de pagos y promedios históricos con recorte de sobregastos focalizados.
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

        {/* Modal Body with internal scrolling */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
          {/* Key Metrics Banner */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Recorte Sugerido
              </span>
              <div className="text-xl sm:text-2xl font-black text-emerald-400 mt-1 flex items-baseline gap-1">
                +{currSym}{Math.round(activeTotalCut)}
                <span className="text-xs font-semibold text-slate-400">/mes</span>
              </div>
              <span className="text-[10px] text-emerald-500/80 mt-1 block">
                Fugas de dinero eliminadas
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Proyección 6 Meses
              </span>
              <div className="text-xl sm:text-2xl font-black text-cyan-300 mt-1">
                {currSym}{Math.round(dynamicSixMonthProjected).toLocaleString()}
              </div>
              <span className="text-[10px] text-cyan-400/80 mt-1 block">
                Capital acumulado semestral
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Tasa de Ahorro
              </span>
              <div className="text-xl sm:text-2xl font-black text-white mt-1 flex items-baseline gap-1.5">
                <span>{strategy.currentSavingsRate}%</span>
                <ArrowRight className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-cyan-400">{strategy.optimizedSavingsRate}%</span>
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">
                +{strategy.optimizedSavingsRate - strategy.currentSavingsRate}% de tus ingresos
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Sobregastos Detectados
              </span>
              <div className="text-xl sm:text-2xl font-black text-amber-400 mt-1 flex items-baseline gap-1">
                {strategy.exceededCategories.length}
                <span className="text-xs font-semibold text-slate-400">categorías</span>
              </div>
              <span className="text-[10px] text-amber-500/80 mt-1 block">
                Por encima del promedio histórico
              </span>
            </div>
          </div>

          {/* Strategic Executive Summary Card */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-cyan-950/30 via-slate-900 to-indigo-950/30 border border-cyan-500/20 flex items-start gap-3.5 shadow-sm">
            <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 shrink-0 mt-0.5">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="space-y-1 text-xs sm:text-sm">
              <span className="font-bold text-white block">Diagnóstico Estratégico</span>
              <p className="text-slate-300 leading-relaxed">
                {strategy.strategicSummary}
              </p>
            </div>
          </div>

          {/* Navigation View Switcher */}
          <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
            <button
              onClick={() => setActiveTab('timeline')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                activeTab === 'timeline'
                  ? 'bg-cyan-500 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Cronograma 6 Meses ({strategy.sixMonthTimeline.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('exceeded')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                activeTab === 'exceeded'
                  ? 'bg-cyan-500 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
              <span>Categorías Excedidas ({strategy.exceededCategories.length})</span>
            </button>

            {strategy.acceleratedGoals.length > 0 && (
              <button
                onClick={() => setActiveTab('impact')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                  activeTab === 'impact'
                    ? 'bg-cyan-500 text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Target className="w-4 h-4" />
                <span>Aceleración de Metas ({strategy.acceleratedGoals.length})</span>
              </button>
            )}
          </div>

          {/* TAB 1: 6-MONTH ROADMAP TIMELINE */}
          {activeTab === 'timeline' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-cyan-400" />
                  Ruta de Ahorro Mes a Mes (Proyección a 6 Meses)
                </h3>
                <span className="text-xs text-slate-400">
                  Total Acumulado al Mes 6: <strong className="text-cyan-300">{currSym}{Math.round(dynamicSixMonthProjected).toLocaleString()}</strong>
                </span>
              </div>

              {/* Interactive Recharts 6-Month Area Chart */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-semibold text-slate-300">Curva de Acumulación Semestral</span>
                  <div className="flex items-center gap-3 text-[11px]">
                    <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                      Con Recortes ({currSym}{Math.round(dynamicSixMonthProjected).toLocaleString()})
                    </span>
                    <span className="flex items-center gap-1.5 text-indigo-400">
                      <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                      Base Sin Recortes
                    </span>
                  </div>
                </div>

                <div className="h-44 w-full pt-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={strategy.sixMonthTimeline.map((item, idx) => {
                        const cutAmount = Math.round(
                          activeTotalCut * (item.monthIndex === 1 ? 0.75 : 1 + (item.monthIndex - 2) * 0.03)
                        );
                        let baseCum = (idx + 1) * strategy.baselineMonthlySavings;
                        let optCum = (idx + 1) * strategy.baselineMonthlySavings + cutAmount * (idx + 1);

                        return {
                          name: `Mes ${item.monthIndex}`,
                          monthName: item.monthName.split(' ')[0],
                          optimized: optCum,
                          baseline: baseCum,
                          gain: optCum - baseCum,
                        };
                      })}
                      margin={{ top: 5, right: 10, left: -15, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="modalGradientOpt" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} vertical={false} />
                      <XAxis dataKey="monthName" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `${currSym}${v}`} />
                      <RechartsTooltip
                        content={({ active, payload }: any) => {
                          if (!active || !payload || !payload.length) return null;
                          const d = payload[0].payload;
                          return (
                            <div className="bg-slate-900 border border-slate-700 p-2.5 rounded-xl shadow-xl text-xs space-y-1">
                              <span className="font-bold text-white block">{d.name} ({d.monthName})</span>
                              <div className="flex justify-between gap-3 text-emerald-400 font-bold">
                                <span>Con Recortes:</span>
                                <span>{currSym}{d.optimized.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between gap-3 text-indigo-300">
                                <span>Base:</span>
                                <span>{currSym}{d.baseline.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between gap-3 text-cyan-300 text-[10px] pt-1 border-t border-slate-800">
                                <span>Aporte de Recortes:</span>
                                <span>+{currSym}{d.gain.toLocaleString()}</span>
                              </div>
                            </div>
                          );
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="optimized"
                        name="Con Recortes"
                        stroke="#10b981"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#modalGradientOpt)"
                      />
                      <Area
                        type="monotone"
                        dataKey="baseline"
                        name="Base"
                        stroke="#6366f1"
                        strokeWidth={1.5}
                        strokeDasharray="3 3"
                        fill="none"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {strategy.sixMonthTimeline.map((milestone) => {
                  const cutAmount = Math.round(
                    activeTotalCut * (milestone.monthIndex === 1 ? 0.75 : 1 + (milestone.monthIndex - 2) * 0.03)
                  );
                  const dynamicMonthly = strategy.baselineMonthlySavings + cutAmount;

                  return (
                    <div
                      key={milestone.monthIndex}
                      className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                        milestone.monthIndex === 1
                          ? 'bg-gradient-to-b from-cyan-950/40 to-slate-900 border-cyan-500/40 shadow-md ring-1 ring-cyan-500/20'
                          : milestone.monthIndex === 6
                          ? 'bg-gradient-to-b from-indigo-950/40 to-slate-900 border-indigo-500/40 shadow-md'
                          : 'bg-slate-900 border-slate-800'
                      }`}
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-300 flex items-center justify-center text-xs font-black">
                              M{milestone.monthIndex}
                            </span>
                            <span className="text-xs font-bold text-slate-200">
                              {milestone.monthName}
                            </span>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                            Fase {milestone.monthIndex}
                          </span>
                        </div>

                        <div>
                          <h4 className="text-xs font-bold text-white line-clamp-1">
                            {milestone.milestoneTitle}
                          </h4>
                          <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                            {milestone.focusRecommendation}
                          </p>
                        </div>
                      </div>

                      <div className="pt-3 mt-3 border-t border-slate-800/80 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400">Ahorro del Mes:</span>
                          <span className="font-bold text-emerald-400">
                            +{currSym}{dynamicMonthly.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400">Aporte de Recortes:</span>
                          <span className="font-semibold text-cyan-300">
                            +{currSym}{cutAmount}/mes
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800">
                          <span className="text-slate-300 font-semibold">Acumulado Total:</span>
                          <span className="font-extrabold text-white text-sm">
                            {currSym}{milestone.cumulativeSavings.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Action Steps Checklist */}
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                  Plan de Acción Táctico para Cumplir la Meta:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300">
                  {strategy.actionPlanSteps.map((step, idx) => (
                    <div key={idx} className="flex items-start gap-2 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/60">
                      <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: EXCEEDED CATEGORIES & SPECIFIC CUT SUGGESTIONS */}
          {activeTab === 'exceeded' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    Categorías que Exceden el Promedio Histórico
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Recortes calculados para devolver cada categoría a su nivel histórico óptimo.
                  </p>
                </div>
                <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-xl border border-emerald-500/20">
                  Recorte Total: -{currSym}{activeTotalCut}/mes
                </span>
              </div>

              {strategy.exceededCategories.length === 0 ? (
                <div className="p-8 rounded-2xl bg-slate-950 text-center border border-slate-800 space-y-3">
                  <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                  <h4 className="text-base font-bold text-white">¡Excelente Estado de Pagos!</h4>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Ninguna categoría supera su promedio histórico de gasto. Tus desembolsos están completamente dentro de los rangos controlados.
                  </p>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {strategy.exceededCategories.map((rec) => {
                    const Icon = CATEGORY_ICONS[rec.category] || DollarSign;
                    const style = CATEGORY_COLORS[rec.category] || {
                      bg: 'bg-slate-500/10',
                      text: 'text-slate-400',
                      border: 'border-slate-500/20',
                    };
                    const userCut = customCuts[rec.category] ?? rec.suggestedMonthlyCut;
                    const newTargetSpend = Math.max(15, rec.currentSpend - userCut);

                    return (
                      <div
                        key={rec.category}
                        className="p-4 sm:p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3.5 hover:border-slate-700 transition-all shadow-md"
                      >
                        {/* Header of category */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <div className={`p-2.5 rounded-xl ${style.bg} ${style.text} ${style.border} border shrink-0`}>
                              <Icon className="w-5 h-5" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="text-sm font-bold text-white">{rec.categoryLabel}</h4>
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                                    rec.priority === 'alta'
                                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                                      : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                  }`}
                                >
                                  Prioridad {rec.priority}
                                </span>
                              </div>
                              <span className="text-xs text-slate-400">
                                {rec.isFixed ? 'Gasto Fijo / Semi-fijo' : 'Gasto Variable Discrecional'}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-xs font-extrabold px-2.5 py-1 rounded-xl bg-rose-500/15 text-rose-300 border border-rose-500/30">
                              +{currSym}{rec.excessAmount} (+{rec.excessPercentage}%) sobre histórico
                            </span>
                          </div>
                        </div>

                        {/* Spend vs Historical Average Comparison Bar */}
                        <div className="space-y-1.5 bg-slate-900 p-3 rounded-xl border border-slate-800">
                          <div className="flex items-center justify-between text-xs text-slate-300">
                            <span>
                              Promedio Histórico: <strong className="text-white">{currSym}{rec.historicalAverage}</strong>
                            </span>
                            <span>
                              Gasto Actual: <strong className="text-rose-400">{currSym}{rec.currentSpend}</strong>
                            </span>
                          </div>
                          <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden flex">
                            <div
                              style={{ width: `${Math.min(100, Math.round((rec.historicalAverage / rec.currentSpend) * 100))}%` }}
                              className="bg-cyan-500"
                              title="Promedio histórico"
                            />
                            <div
                              style={{ width: `${Math.max(0, 100 - Math.round((rec.historicalAverage / rec.currentSpend) * 100))}%` }}
                              className="bg-rose-500 animate-pulse"
                              title="Sobregasto"
                            />
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
                            <span className="text-cyan-400">Nivel Histórico Saludable</span>
                            <span className="text-rose-400 font-bold">Exceso Detectado: {currSym}{rec.excessAmount}</span>
                          </div>
                        </div>

                        {/* Rationale & Suggested Cut Action */}
                        <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
                          <p className="text-xs text-slate-300 flex-1 leading-relaxed">
                            {rec.cutRationale}
                          </p>

                          <div className="flex items-center gap-3 shrink-0 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                            <div>
                              <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                                Recorte Mensual:
                              </span>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-sm font-extrabold text-emerald-400">
                                  -{currSym}{userCut}
                                </span>
                                <span className="text-[11px] text-slate-400">
                                  → Meta: {currSym}{newTargetSpend}
                                </span>
                              </div>
                            </div>

                            {/* Quick Cut Adjustment buttons */}
                            <div className="flex items-center gap-1 border-l border-slate-800 pl-2">
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = Math.max(10, userCut - 10);
                                  setCustomCuts((prev) => ({ ...prev, [rec.category]: updated }));
                                }}
                                className="w-6 h-6 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center justify-center transition-colors"
                                title="Reducir recorte por $10"
                              >
                                -
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = Math.min(rec.excessAmount, userCut + 10);
                                  setCustomCuts((prev) => ({ ...prev, [rec.category]: updated }));
                                }}
                                className="w-6 h-6 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center justify-center transition-colors"
                                title="Aumentar recorte por $10"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Controlled Categories Collapsible Accordion */}
              {strategy.controlledCategories.length > 0 && (
                <div className="border border-slate-800 rounded-2xl bg-slate-950/40 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowControlled(!showControlled)}
                    className="w-full p-3.5 flex items-center justify-between text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-900/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>
                        Categorías Bajo Control ({strategy.controlledCategories.length} dentro del promedio histórico)
                      </span>
                    </div>
                    {showControlled ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  {showControlled && (
                    <div className="p-3.5 border-t border-slate-800 space-y-2">
                      {strategy.controlledCategories.map((c) => (
                        <div
                          key={c.category}
                          className="flex items-center justify-between text-xs p-2 rounded-xl bg-slate-900/50 border border-slate-800/60"
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-400" />
                            <span className="font-semibold text-white">{c.categoryLabel}:</span>
                            <span className="text-slate-400">{c.statusMessage}</span>
                          </div>
                          <span className="font-bold text-slate-300">
                            {currSym}{c.currentSpend}/mes
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: ACCELERATED SAVINGS GOALS */}
          {activeTab === 'impact' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Target className="w-4 h-4 text-cyan-400" />
                  Impacto en tus Metas de Ahorro Programadas
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Canalizar los recortes en categorías excedidas acelera el cumplimiento de tus objetivos.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {strategy.acceleratedGoals.map((g) => (
                  <div
                    key={g.goalId}
                    className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 shadow-md"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-white">{g.goalTitle}</h4>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                        <Flame className="w-3 h-3" />
                        ¡Ahorras {g.monthsSaved} meses!
                      </span>
                    </div>

                    <div className="space-y-2 bg-slate-900 p-3 rounded-xl border border-slate-800 text-xs">
                      <div className="flex justify-between text-slate-300">
                        <span>Meta total: <strong className="text-white">{currSym}{g.targetAmount.toLocaleString()}</strong></span>
                        <span>Acumulado: <strong className="text-cyan-400">{currSym}{g.currentAmount.toLocaleString()}</strong></span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-800">
                        <span className="text-slate-400">Tiempo estimado original:</span>
                        <span className="text-slate-300 font-semibold">{g.originalMonthsRemaining} meses</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-emerald-400 font-semibold">Con Plan de Recortes:</span>
                        <span className="text-emerald-300 font-extrabold">{g.acceleratedMonthsRemaining} meses ({g.newEstimatedDate})</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer with Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs text-slate-400">
            {appliedSuccess ? (
              <span className="text-emerald-400 font-bold flex items-center gap-1.5 animate-fadeIn">
                <CheckCircle2 className="w-4 h-4" />
                ¡Presupuestos y recortes aplicados exitosamente!
              </span>
            ) : (
              <span>
                Al aplicar, se ajustarán los límites en las categorías excedidas por un total de{' '}
                <strong className="text-emerald-300">+{currSym}{Math.round(activeTotalCut)}/mes</strong>.
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 text-xs sm:text-sm font-semibold transition-colors"
            >
              Cerrar
            </button>

            {strategy.exceededCategories.length > 0 && (
              <button
                type="button"
                onClick={handleApplyAllBudgets}
                disabled={appliedSuccess}
                className="flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-emerald-950/40 transition-all disabled:opacity-50"
              >
                {appliedSuccess ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>¡Aplicado!</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Aplicar Recortes a Mis Presupuestos</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
