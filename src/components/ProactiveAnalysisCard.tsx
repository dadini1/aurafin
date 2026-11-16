import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  TrendingUp,
  TrendingDown,
  Target,
  Sparkles,
  Sliders,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  Info,
  FileDown,
} from 'lucide-react';
import { SavingsGoal, UserFinancialProfile } from '../types';
import { useTheme } from '../context/ThemeContext';

export type FinancialHealthTier = 'sobresaliente' | 'saludable' | 'moderada' | 'riesgo' | 'critica';

export interface HealthBadgeInfo {
  tier: FinancialHealthTier;
  badgeLabel: string;
  badgeStatus: string;
  grade: 'A+' | 'A' | 'B' | 'C' | 'D';
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  badgeGlow: string;
  iconBg: string;
  iconColor: string;
  IconComponent: React.ComponentType<{ className?: string }>;
  headline: string;
  diagnostic: string;
  proactiveAdvice: string;
  recommendations: string[];
}

interface ProactiveAnalysisCardProps {
  totalIncome: number;
  fixedExpenses: number;
  variableExpenses: number;
  netSavings: number;
  savingsPercent: number;
  goals: SavingsGoal[];
  profile: UserFinancialProfile;
  onUpdateProfile: (updated: Partial<UserFinancialProfile>) => void;
  onOpenOptimizer?: () => void;
  onOpenSavingsStrategy?: () => void;
  onOpenVoiceAssistant?: (prompt: string) => void;
  onDownloadPDF?: () => void;
}

export const ProactiveAnalysisCard: React.FC<ProactiveAnalysisCardProps> = ({
  totalIncome,
  fixedExpenses,
  variableExpenses,
  netSavings,
  savingsPercent,
  goals,
  profile,
  onUpdateProfile,
  onOpenOptimizer,
  onOpenSavingsStrategy,
  onOpenVoiceAssistant,
  onDownloadPDF,
}) => {
  const { isNitido } = useTheme();
  // Target mode: 'goals' (sum of goals monthly contributions), 'percent' (profile savingsGoalPercent of income), or 'custom'
  const [targetMode, setTargetMode] = useState<'goals' | 'percent' | 'custom'>(() => {
    try {
      const saved = localStorage.getItem('aurafin_analysis_target_mode');
      if (saved === 'goals' || saved === 'percent' || saved === 'custom') return saved;
    } catch {
      // ignore
    }
    return goals.length > 0 ? 'goals' : 'percent';
  });

  const [customTarget, setCustomTarget] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('aurafin_analysis_custom_target');
      if (saved) return Number(saved);
    } catch {
      // ignore
    }
    return 500;
  });

  const [isEditingTarget, setIsEditingTarget] = useState(false);
  const [tempGoalPercent, setTempGoalPercent] = useState<number>(profile.savingsGoalPercent || 20);

  useEffect(() => {
    try {
      localStorage.setItem('aurafin_analysis_target_mode', targetMode);
    } catch {
      // ignore
    }
  }, [targetMode]);

  useEffect(() => {
    try {
      localStorage.setItem('aurafin_analysis_custom_target', customTarget.toString());
    } catch {
      // ignore
    }
  }, [customTarget]);

  // Sum of active goals monthly contributions
  const goalsMonthlySum = goals.reduce((acc, g) => acc + (g.monthlyContribution || 0), 0);

  // Percent target from income
  const percentTargetAmount = Math.max(0, Math.round((totalIncome * (profile.savingsGoalPercent || 20)) / 100));

  // Determine current defined target amount based on active mode
  let definedTarget = percentTargetAmount;
  if (targetMode === 'goals') {
    definedTarget = goalsMonthlySum > 0 ? goalsMonthlySum : percentTargetAmount;
  } else if (targetMode === 'custom') {
    definedTarget = customTarget;
  }

  // Calculate fulfillment rate against defined target
  const rawFulfillment = definedTarget > 0 ? (netSavings / definedTarget) * 100 : 0;
  const fulfillmentRate = Math.round(rawFulfillment);
  const diffAmount = netSavings - definedTarget;
  const isSurplus = diffAmount >= 0;

  // Determine Financial Health Tier and Badge Data
  const getHealthBadgeData = (): HealthBadgeInfo => {
    if (netSavings <= 0 || fulfillmentRate < 50) {
      return {
        tier: 'critica',
        badgeLabel: 'Salud Financiera Crítica',
        badgeStatus: 'Alerta de Déficit',
        grade: 'D',
        badgeBg: 'bg-rose-500/10',
        badgeBorder: 'border-rose-500/40',
        badgeText: 'text-rose-400',
        badgeGlow: 'shadow-rose-950/40',
        iconBg: 'bg-rose-500/20',
        iconColor: 'text-rose-400',
        IconComponent: AlertOctagon,
        headline: netSavings <= 0
          ? 'Tus gastos mensuales superan o igualan tus ingresos netos.'
          : `Cumplimiento crítico del ${fulfillmentRate}% respecto a tu meta mensual.`,
        diagnostic: netSavings <= 0
          ? `Estás operando en déficit de ${profile.currencySymbol}${Math.abs(netSavings).toLocaleString()}/mes. No hay margen de ahorro para cubrir tus compromisos.`
          : `Tu ahorro real (${profile.currencySymbol}${netSavings.toLocaleString()}) presenta una brecha de ${profile.currencySymbol}${Math.abs(diffAmount).toLocaleString()}/mes frente al objetivo (${profile.currencySymbol}${definedTarget.toLocaleString()}).`,
        proactiveAdvice:
          'Es prioritario congelar gastos variables prescindibles (ocio, suscripciones repetidas) y auditar pagos fijos para restaurar la liquidez básica.',
        recommendations: [
          'Activa el Optimizador de Presupuestos IA para ajustar límites en categorías con sobregasto.',
          'Considera pausar temporalmente aportes no urgentes hasta nivelar gastos fijos.',
          `Revisa compromisos de alquiler y transporte en ${profile.country} para detectar fugas de capital.`,
        ],
      };
    }

    if (fulfillmentRate >= 50 && fulfillmentRate < 80) {
      return {
        tier: 'riesgo',
        badgeLabel: 'Salud Financiera en Riesgo Leve',
        badgeStatus: 'Ahorro Insuficiente',
        grade: 'C',
        badgeBg: 'bg-orange-500/10',
        badgeBorder: 'border-orange-500/40',
        badgeText: 'text-orange-400',
        badgeGlow: 'shadow-orange-950/40',
        iconBg: 'bg-orange-500/20',
        iconColor: 'text-orange-400',
        IconComponent: AlertTriangle,
        headline: `Ahorro por debajo del ritmo proyectado (${fulfillmentRate}% de cumplimiento).`,
        diagnostic: `Has logrado retener ${profile.currencySymbol}${netSavings.toLocaleString()}, pero tienes un faltante de ${profile.currencySymbol}${Math.abs(diffAmount).toLocaleString()}/mes para llegar a tu meta de ${profile.currencySymbol}${definedTarget.toLocaleString()}.`,
        proactiveAdvice:
          'A este ritmo tus metas programadas podrían demorarse entre 3 y 6 meses adicionales. Un ajuste moderado en gastos variables te devolverá al carril seguro.',
        recommendations: [
          'Revisa las categorías que han superado el 80% de su presupuesto mensual.',
          'Programa pagos de servicios con anticipación para evitar recargos por mora.',
          'Explora micro-ahorros semanales para cerrar la brecha sin sacrificar bienestar.',
        ],
      };
    }

    if (fulfillmentRate >= 80 && fulfillmentRate < 100) {
      return {
        tier: 'moderada',
        badgeLabel: 'Salud Financiera Moderada',
        badgeStatus: 'Cerca del Objetivo',
        grade: 'B',
        badgeBg: 'bg-amber-500/10',
        badgeBorder: 'border-amber-500/40',
        badgeText: 'text-amber-300',
        badgeGlow: 'shadow-amber-950/40',
        iconBg: 'bg-amber-500/20',
        iconColor: 'text-amber-400',
        IconComponent: TrendingUp,
        headline: `Muy cerca de la meta (${fulfillmentRate}% de cumplimiento).`,
        diagnostic: `Tu ahorro de ${profile.currencySymbol}${netSavings.toLocaleString()} cubre casi la totalidad del plan. La brecha es mínima: solo ${profile.currencySymbol}${Math.abs(diffAmount).toLocaleString()} pendientes.`,
        proactiveAdvice:
          'Un esfuerzo puntual en los días restantes del ciclo te permitirá alcanzar el 100% de cumplimiento. Tu disciplina financiera es sólida.',
        recommendations: [
          `Una reducción de solo ${profile.currencySymbol}${Math.ceil(Math.abs(diffAmount) / 4)} por semana te llevará al 100%.`,
          'Asegura primero el depósito a tus metas de alta prioridad (fondo de emergencia o vivienda).',
          'Aprovecha promociones y compras inteligentes en alimentación.',
        ],
      };
    }

    if (fulfillmentRate >= 100 && fulfillmentRate < 120) {
      return {
        tier: 'saludable',
        badgeLabel: 'Salud Financiera Saludable',
        badgeStatus: 'Objetivo Cumplido',
        grade: 'A',
        badgeBg: 'bg-cyan-500/10',
        badgeBorder: 'border-cyan-500/40',
        badgeText: 'text-cyan-300',
        badgeGlow: 'shadow-cyan-950/40',
        iconBg: 'bg-cyan-500/20',
        iconColor: 'text-cyan-400',
        IconComponent: CheckCircle2,
        headline: `Meta mensual cumplida con éxito (${fulfillmentRate}% de cumplimiento).`,
        diagnostic: `Tu ahorro neto de ${profile.currencySymbol}${netSavings.toLocaleString()} cumple satisfactoriamente la meta de ${profile.currencySymbol}${definedTarget.toLocaleString()} fijada para este mes.`,
        proactiveAdvice:
          'Tus metas de ahorro avanzan al ritmo cronometrado. Mantener este hábito garantiza la materialización de tus metas de compra e inversión en los plazos fijados.',
        recommendations: [
          'Mantén este ritmo sostenido durante el próximo trimestre para consolidar patrimonio.',
          'Automatiza transferencias a tus metas apenas recibas tus ingresos.',
          'Considera asignar excedentes al fondo de reserva de liquidez.',
        ],
      };
    }

    // >= 120%
    return {
      tier: 'sobresaliente',
      badgeLabel: 'Salud Financiera Sobresaliente',
      badgeStatus: 'Nivel Óptimo con Superávit',
      grade: 'A+',
      badgeBg: 'bg-emerald-500/10',
      badgeBorder: 'border-emerald-500/40',
      badgeText: 'text-emerald-300',
      badgeGlow: 'shadow-emerald-950/40',
      iconBg: 'bg-emerald-500/20',
      iconColor: 'text-emerald-400',
      IconComponent: ShieldCheck,
      headline: `Rendimiento sobresaliente: superas tu meta en un +${fulfillmentRate - 100}%.`,
      diagnostic: `Generas ${profile.currencySymbol}${netSavings.toLocaleString()} de ahorro mensual frente a una meta de ${profile.currencySymbol}${definedTarget.toLocaleString()}. Tienes un superávit neto de +${profile.currencySymbol}${diffAmount.toLocaleString()}.`,
      proactiveAdvice:
        'Tu solvencia financiera es excelente. Este excedente te brinda la oportunidad estratégica de acelerar metas patrimoniales (vivienda, auto propio) o diversificar en inversiones con rendimiento real.',
      recommendations: [
        `Puedes acelerar la meta de automóvil o vivienda con una aportación extra de ${profile.currencySymbol}${diffAmount.toLocaleString()}.`,
        `Revisa opciones de inversión en ${profile.country} protegidas contra inflación.`,
        'Tu capacidad de ahorro te sitúa en el percentil superior de salud financiera personal.',
      ],
    };
  };

  const badge = getHealthBadgeData();
  const Icon = badge.IconComponent;

  // Calculate visual progress percentage (clamped 0 to 150 for bar rendering)
  const visualPercent = Math.max(0, Math.min(150, fulfillmentRate));

  const handleSavePercentGoal = () => {
    onUpdateProfile({ savingsGoalPercent: tempGoalPercent });
    setIsEditingTarget(false);
  };

  return (
    <section
      aria-label="Análisis Proactivo de Salud Financiera"
      className={`p-5 sm:p-6 rounded-3xl border shadow-sm space-y-6 transition-all ${
        isNitido ? 'bg-white border-slate-200 text-slate-900' : 'bg-gradient-to-b from-slate-900 to-slate-950 border-slate-800 text-white'
      }`}
    >
      {/* 1. Header with Title & Health Badge */}
      <div className={`flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b ${
        isNitido ? 'border-slate-200' : 'border-slate-800/80'
      }`}>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg border ${
              isNitido ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
            }`}>
              <Zap className="w-4 h-4" />
            </div>
            <h3 className={`text-base sm:text-lg font-bold tracking-tight ${isNitido ? 'text-slate-900' : 'text-white'}`}>
              Análisis Proactivo de Salud Financiera
            </h3>
          </div>
          <p className={`text-xs leading-relaxed max-w-2xl ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
            Comparativa continua entre tu <strong>ahorro mensual real</strong> y tu <strong>meta definida</strong>, con diagnóstico proactivo y alertas para optimizar tu patrimonio en {profile.country}.
          </p>
        </div>

        {/* PROMINENT HEALTH BADGE */}
        <div
          className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl border shadow-sm backdrop-blur-sm self-start lg:self-auto transition-transform ${
            isNitido
              ? fulfillmentRate >= 100
                ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                : fulfillmentRate >= 75
                ? 'bg-amber-50 border-amber-300 text-amber-950'
                : 'bg-rose-50 border-rose-300 text-rose-950'
              : `${badge.badgeBg} ${badge.badgeBorder} ${badge.badgeGlow}`
          }`}
          title={`Diagnóstico: ${badge.badgeLabel} (${fulfillmentRate}% cumplido)`}
        >
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
            isNitido
              ? fulfillmentRate >= 100
                ? 'bg-emerald-100 border-emerald-200 text-emerald-800'
                : fulfillmentRate >= 75
                ? 'bg-amber-100 border-amber-200 text-amber-800'
                : 'bg-rose-100 border-rose-200 text-rose-800'
              : `${badge.iconBg} ${badge.iconColor} border-white/10`
          }`}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] uppercase font-bold tracking-wider ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
                Estado de Salud
              </span>
              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded border ${
                isNitido
                  ? 'bg-white border-slate-300 text-slate-800'
                  : `border-current ${badge.badgeText}`
              }`}>
                {badge.grade}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <h4 className={`text-sm sm:text-base font-extrabold tracking-tight ${
                isNitido
                  ? fulfillmentRate >= 100 ? 'text-emerald-900' : fulfillmentRate >= 75 ? 'text-amber-900' : 'text-rose-900'
                  : badge.badgeText
              }`}>
                {badge.badgeLabel}
              </h4>
              <span className={`text-xs font-bold ${isNitido ? 'text-slate-700' : 'text-slate-300'}`}>
                ({fulfillmentRate}%)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Target Mode Selector & Configuration Bar */}
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-2xl border ${
        isNitido ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/80 border-slate-800'
      }`}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs font-bold flex items-center gap-1.5 mr-1 ${isNitido ? 'text-slate-700' : 'text-slate-400'}`}>
            <Target className={`w-3.5 h-3.5 ${isNitido ? 'text-indigo-600' : 'text-cyan-400'}`} />
            Base de Meta:
          </span>

          <button
            type="button"
            onClick={() => setTargetMode('goals')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              targetMode === 'goals'
                ? isNitido
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : isNitido
                ? 'text-slate-700 hover:text-slate-900 hover:bg-slate-200/70 border border-slate-200'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            Metas Programadas ({profile.currencySymbol}{goalsMonthlySum}/mes)
          </button>

          <button
            type="button"
            onClick={() => setTargetMode('percent')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              targetMode === 'percent'
                ? isNitido
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : isNitido
                ? 'text-slate-700 hover:text-slate-900 hover:bg-slate-200/70 border border-slate-200'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            Regla {profile.savingsGoalPercent}% Ingresos ({profile.currencySymbol}{percentTargetAmount}/mes)
          </button>

          <button
            type="button"
            onClick={() => setTargetMode('custom')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              targetMode === 'custom'
                ? isNitido
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : isNitido
                ? 'text-slate-700 hover:text-slate-900 hover:bg-slate-200/70 border border-slate-200'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            Personalizada ({profile.currencySymbol}{customTarget}/mes)
          </button>
        </div>

        {/* Quick Edit Target Button */}
        <div className="flex items-center gap-2">
          {targetMode === 'percent' && (
            <button
              onClick={() => setIsEditingTarget(!isEditingTarget)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-colors border ${
                isNitido
                  ? 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300'
                  : 'text-slate-300 hover:text-cyan-300 hover:bg-slate-800 border-slate-700/60'
              }`}
              title="Ajustar porcentaje de meta de ahorro"
            >
              <Sliders className="w-3.5 h-3.5 text-indigo-600" />
              <span>Ajustar % ({profile.savingsGoalPercent}%)</span>
            </button>
          )}

          {targetMode === 'custom' && (
            <div className="flex items-center gap-1.5">
              <span className={`text-xs font-bold ${isNitido ? 'text-slate-700' : 'text-slate-400'}`}>{profile.currencySymbol}</span>
              <input
                type="number"
                min="0"
                step="25"
                value={customTarget}
                onChange={(e) => setCustomTarget(Math.max(0, Number(e.target.value) || 0))}
                className={`w-24 px-2.5 py-1 rounded-xl text-xs font-bold text-right border focus:outline-none ${
                  isNitido
                    ? 'bg-white border-slate-300 text-slate-900 focus:border-indigo-600'
                    : 'bg-slate-950 border-slate-700 text-white focus:border-cyan-400'
                }`}
                placeholder="500"
              />
            </div>
          )}
        </div>
      </div>

      {/* Inline edit for percentage goal */}
      {isEditingTarget && targetMode === 'percent' && (
        <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn ${
          isNitido ? 'bg-indigo-50/50 border-indigo-200' : 'bg-slate-900 border-cyan-800/40'
        }`}>
          <div className="space-y-1">
            <span className={`text-xs font-bold ${isNitido ? 'text-indigo-950' : 'text-cyan-300'}`}>
              Modificar Porcentaje de Ahorro Mensual Sugerido
            </span>
            <p className={`text-[11px] ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
              La regla 50/30/20 recomienda 20% ({profile.currencySymbol}{Math.round(totalIncome * 0.2)}). Ajusta según tu momento vital.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="5"
              max="50"
              step="1"
              value={tempGoalPercent}
              onChange={(e) => setTempGoalPercent(Number(e.target.value))}
              className="w-28 accent-indigo-600 cursor-pointer"
            />
            <span className={`text-xs font-black w-10 text-right ${isNitido ? 'text-slate-900' : 'text-white'}`}>{tempGoalPercent}%</span>
            <button
              onClick={handleSavePercentGoal}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors"
            >
              Guardar
            </button>
          </div>
        </div>
      )}

      {/* 3. Four Core Comparison Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {/* Metric 1: Real Monthly Savings */}
        <div className={`p-4 rounded-2xl border flex flex-col justify-between shadow-sm ${
          isNitido ? 'bg-white border-slate-200' : 'bg-slate-900/90 border-slate-800'
        }`}>
          <span className={`text-[11px] font-bold uppercase tracking-wider ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
            Ahorro Real
          </span>
          <div className="my-1.5">
            <div className={`text-xl sm:text-2xl font-black ${
              isNitido
                ? netSavings >= 0 ? 'text-emerald-800' : 'text-rose-800'
                : netSavings >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}>
              {profile.currencySymbol}{netSavings.toLocaleString()}
            </div>
            <div className="text-[11px] flex items-center gap-1 pt-0.5">
              {netSavings >= 0 ? (
                <>
                  <ArrowUpRight className={`w-3.5 h-3.5 ${isNitido ? 'text-emerald-700' : 'text-emerald-400'}`} />
                  <span className={`font-bold ${isNitido ? 'text-emerald-800' : 'text-emerald-400'}`}>{savingsPercent}%</span>
                  <span className={isNitido ? 'text-slate-600' : 'text-slate-400'}>del ingreso neto</span>
                </>
              ) : (
                <>
                  <ArrowDownRight className={`w-3.5 h-3.5 ${isNitido ? 'text-rose-700' : 'text-rose-400'}`} />
                  <span className={`font-bold ${isNitido ? 'text-rose-800' : 'text-rose-400'}`}>Déficit</span>
                  <span className={isNitido ? 'text-slate-600' : 'text-slate-400'}>en gastos</span>
                </>
              )}
            </div>
          </div>
          <span className={`text-[10px] ${isNitido ? 'text-slate-500' : 'text-slate-500'}`}>
            Ingreso ({profile.currencySymbol}{totalIncome.toLocaleString()}) - Gastos ({profile.currencySymbol}{(fixedExpenses + variableExpenses).toLocaleString()})
          </span>
        </div>

        {/* Metric 2: Defined Target */}
        <div className={`p-4 rounded-2xl border flex flex-col justify-between shadow-sm ${
          isNitido ? 'bg-white border-slate-200' : 'bg-slate-900/90 border-slate-800'
        }`}>
          <span className={`text-[11px] font-bold uppercase tracking-wider ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
            Meta Definida
          </span>
          <div className="my-1.5">
            <div className={`text-xl sm:text-2xl font-black ${isNitido ? 'text-slate-900' : 'text-cyan-300'}`}>
              {profile.currencySymbol}{definedTarget.toLocaleString()}
            </div>
            <div className={`text-[11px] ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
              {targetMode === 'goals'
                ? `${goals.length} meta${goals.length === 1 ? '' : 's'} de ahorro activa${goals.length === 1 ? '' : 's'}`
                : targetMode === 'percent'
                ? `${profile.savingsGoalPercent}% de tus ingresos`
                : 'Objetivo manual fijo'}
            </div>
          </div>
          <span className={`text-[10px] ${isNitido ? 'text-slate-500' : 'text-slate-500'}`}>
            Compromiso mensual para alcanzar metas
          </span>
        </div>

        {/* Metric 3: Fulfillment Percentage */}
        <div className={`p-4 rounded-2xl border flex flex-col justify-between shadow-sm ${
          isNitido ? 'bg-white border-slate-200' : 'bg-slate-900/90 border-slate-800'
        }`}>
          <span className={`text-[11px] font-bold uppercase tracking-wider ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
            Cumplimiento
          </span>
          <div className="my-1.5">
            <div className={`text-xl sm:text-2xl font-black ${
              isNitido
                ? fulfillmentRate >= 100 ? 'text-emerald-800' : fulfillmentRate >= 75 ? 'text-amber-800' : 'text-rose-800'
                : badge.badgeText
            }`}>
              {fulfillmentRate}%
            </div>
            <div className={`text-[11px] ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
              {fulfillmentRate >= 100 ? 'Meta mensual superada' : `Falta ${Math.max(0, 100 - fulfillmentRate)}% para 100%`}
            </div>
          </div>
          <span className={`text-[10px] ${isNitido ? 'text-slate-500' : 'text-slate-500'}`}>
            Proporción respecto al objetivo
          </span>
        </div>

        {/* Metric 4: Differential / Gap */}
        <div className={`p-4 rounded-2xl border flex flex-col justify-between shadow-sm ${
          isNitido ? 'bg-white border-slate-200' : 'bg-slate-900/90 border-slate-800'
        }`}>
          <span className={`text-[11px] font-bold uppercase tracking-wider ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
            Diferencial (Brecha)
          </span>
          <div className="my-1.5">
            <div className={`text-xl sm:text-2xl font-black ${
              isNitido
                ? isSurplus ? 'text-emerald-800' : 'text-amber-800'
                : isSurplus ? 'text-emerald-400' : 'text-amber-400'
            }`}>
              {isSurplus ? '+' : ''}{profile.currencySymbol}{diffAmount.toLocaleString()}
            </div>
            <div className={`text-[11px] ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
              {isSurplus ? 'Superávit disponible' : 'Faltante para cubrir cuota'}
            </div>
          </div>
          <span className={`text-[10px] ${isNitido ? 'text-slate-500' : 'text-slate-500'}`}>
            {isSurplus ? 'Liquidez excedente invertible' : 'Ajustable con optimización'}
          </span>
        </div>
      </div>

      {/* 4. Visual Comparison Gauge / Milestone Bar */}
      <div className={`space-y-2 p-4 rounded-2xl border ${
        isNitido ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/70 border-slate-800/90'
      }`}>
        <div className="flex items-center justify-between text-xs">
          <span className={`font-bold flex items-center gap-1.5 ${isNitido ? 'text-slate-700' : 'text-slate-300'}`}>
            <Target className={`w-3.5 h-3.5 ${isNitido ? 'text-indigo-600' : 'text-cyan-400'}`} />
            Progreso frente a la Meta Mensual (Objetivo = 100%)
          </span>
          <span className={`font-black ${isNitido ? 'text-slate-900' : 'text-white'}`}>
            {profile.currencySymbol}{Math.max(0, netSavings).toLocaleString()} / {profile.currencySymbol}{definedTarget.toLocaleString()} ({fulfillmentRate}%)
          </span>
        </div>

        {/* Progress Track */}
        <div className={`relative h-4 w-full rounded-full overflow-hidden p-0.5 border ${
          isNitido ? 'bg-slate-200 border-slate-300' : 'bg-slate-800/90 border-slate-700/60'
        }`}>
          {/* 100% Milestone Marker Line */}
          <div
            className={`absolute top-0 bottom-0 w-0.5 z-20 shadow-sm ${isNitido ? 'bg-slate-900' : 'bg-white'}`}
            style={{ left: `${(100 / 150) * 100}%` }}
            title="Meta 100%"
          />

          {/* Active fill bar */}
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              fulfillmentRate >= 120
                ? 'bg-emerald-600'
                : fulfillmentRate >= 100
                ? 'bg-teal-600'
                : fulfillmentRate >= 80
                ? 'bg-amber-500'
                : fulfillmentRate >= 50
                ? 'bg-orange-500'
                : 'bg-rose-600'
            }`}
            style={{ width: `${(visualPercent / 150) * 100}%` }}
          />
        </div>

        {/* Milestone Labels */}
        <div className={`flex items-center justify-between text-[10px] pt-1 ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
          <span>0%</span>
          <span>50% (Crítico)</span>
          <span>80% (Alerta)</span>
          <span className={`font-bold underline ${isNitido ? 'text-slate-900 decoration-indigo-600' : 'text-white decoration-cyan-400'}`}>100% Meta</span>
          <span className={isNitido ? 'text-emerald-800 font-bold' : 'text-emerald-400 font-semibold'}>120%+ (Superávit)</span>
        </div>
      </div>

      {/* 5. Proactive AI Diagnostic & Recommendations */}
      <div className={`p-5 rounded-2xl border space-y-3.5 ${
        isNitido
          ? 'bg-slate-50 border-slate-200'
          : `${badge.badgeBg} ${badge.badgeBorder}`
      }`}>
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${
            isNitido
              ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
              : `${badge.iconBg} ${badge.iconColor}`
          }`}>
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="space-y-1.5 flex-1">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h4 className={`text-sm font-bold ${isNitido ? 'text-slate-900' : 'text-white'}`}>
                Diagnóstico Proactivo de IA: {badge.badgeStatus}
              </h4>
              <span className={`text-[11px] font-bold ${
                isNitido
                  ? fulfillmentRate >= 100 ? 'text-emerald-800' : fulfillmentRate >= 75 ? 'text-amber-800' : 'text-rose-800'
                  : badge.badgeText
              }`}>
                {badge.headline}
              </span>
            </div>
            <p className={`text-xs leading-relaxed ${isNitido ? 'text-slate-700' : 'text-slate-300'}`}>
              {badge.diagnostic} {badge.proactiveAdvice}
            </p>
          </div>
        </div>

        {/* Actionable Recommendations Bullet Points */}
        <div className={`pt-2 border-t grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs ${
          isNitido ? 'border-slate-200' : 'border-slate-800/60'
        }`}>
          {badge.recommendations.map((rec, i) => (
            <div key={i} className={`flex items-start gap-2 p-2.5 rounded-xl border ${
              isNitido
                ? 'bg-white border-slate-200 text-slate-800 shadow-sm'
                : 'bg-slate-900/60 border-slate-800/80 text-slate-300'
            }`}>
              <span className={`font-black shrink-0 ${isNitido ? 'text-indigo-600' : 'text-cyan-400'}`}>{i + 1}.</span>
              <span className="leading-snug">{rec}</span>
            </div>
          ))}
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap pt-2 justify-end">
          {onOpenSavingsStrategy && (
            <button
              onClick={onOpenSavingsStrategy}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm ${
                isNitido
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  : 'bg-gradient-to-r from-cyan-600/40 to-blue-600/40 hover:from-cyan-600/60 hover:to-blue-600/60 text-cyan-200 border border-cyan-500/40'
              }`}
              title="Analizar historial y proyectar estrategia de ahorro personalizada a 6 meses"
            >
              <TrendingUp className="w-3.5 h-3.5 text-white" />
              <span>Plan de Ahorro 6M</span>
            </button>
          )}

          {onOpenOptimizer && (
            <button
              onClick={onOpenOptimizer}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm ${
                isNitido
                  ? 'bg-teal-600 hover:bg-teal-700 text-white'
                  : 'bg-violet-600/30 hover:bg-violet-600/50 text-violet-200 border border-violet-500/30'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-white" />
              <span>Optimizar Presupuestos</span>
            </button>
          )}

          {onOpenVoiceAssistant && (
            <button
              onClick={() =>
                onOpenVoiceAssistant(
                  `Realiza un análisis detallado de mi salud financiera actual en ${profile.country}. Mi cumplimiento es del ${fulfillmentRate}% con un ahorro real de ${profile.currencySymbol}${netSavings} frente a mi meta de ${profile.currencySymbol}${definedTarget}. ¿Qué ajustes me recomiendas para optimizar mis finanzas?`
                )
              }
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                isNitido
                  ? 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300'
                  : 'bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-200 border border-cyan-500/30'
              }`}
            >
              <Zap className={`w-3.5 h-3.5 ${isNitido ? 'text-indigo-600' : 'text-cyan-300'}`} />
              <span>Analizar con Asistente de Voz</span>
            </button>
          )}

          {onDownloadPDF && (
            <button
              onClick={onDownloadPDF}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                isNitido
                  ? 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700'
              }`}
              title="Descargar reporte completo en PDF con directorio imprimible"
            >
              <FileDown className={`w-3.5 h-3.5 ${isNitido ? 'text-indigo-600' : 'text-cyan-400'}`} />
              <span>Exportar Reporte PDF</span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
};
