import React, { useState, useEffect, useMemo } from 'react';
import {
  Sliders,
  DollarSign,
  CheckCircle2,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  RotateCcw,
  Plus,
  Minus,
  Check,
  Home,
  Car,
  ShoppingBag,
  Zap,
  Coffee,
  HeartPulse,
  BookOpen,
  PieChart,
  HelpCircle,
  Save,
  ArrowRight,
  Bot,
  Percent,
  ShieldCheck,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { PaymentItem, UserFinancialProfile } from '../types';
import { DEFAULT_CATEGORY_BUDGETS } from '../data/mockDeviceData';
import { autocompleteCategoryBudgets } from '../services/budgetAutocompleteService';
import { useTheme } from '../context/ThemeContext';

interface MonthlyBudgetConfigSectionProps {
  categoryBudgets: Record<string, number>;
  onUpdateCategoryBudgets: (updated: Record<string, number>) => void;
  payments: PaymentItem[];
  profile: UserFinancialProfile;
  onOpenOptimizer?: () => void;
  onOpenAutocomplete?: () => void;
}

interface CategoryDefinition {
  key: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  colorClass: string;
  iconBg: string;
}

const CATEGORY_DEFINITIONS: CategoryDefinition[] = [
  {
    key: 'alquiler',
    label: 'Vivienda / Alquiler',
    description: 'Renta, hipoteca, expensas y mantenimiento de hogar',
    icon: Home,
    colorClass: 'text-indigo-600',
    iconBg: 'bg-indigo-50 border-indigo-200 text-indigo-700',
  },
  {
    key: 'alimentacion',
    label: 'Alimentación / Supermercado',
    description: 'Despensa del mes, mercado y alimentos esenciales',
    icon: ShoppingBag,
    colorClass: 'text-emerald-600',
    iconBg: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  },
  {
    key: 'transporte',
    label: 'Transporte / Movilidad',
    description: 'Gasolina, transporte público, taxis y mantenimiento',
    icon: Car,
    colorClass: 'text-amber-600',
    iconBg: 'bg-amber-50 border-amber-200 text-amber-700',
  },
  {
    key: 'servicios',
    label: 'Servicios Básicos',
    description: 'Electricidad, agua, gas, internet y telefonía',
    icon: Zap,
    colorClass: 'text-cyan-600',
    iconBg: 'bg-cyan-50 border-cyan-200 text-cyan-700',
  },
  {
    key: 'ocio',
    label: 'Ocio y Restaurantes',
    description: 'Salidas, entretenimiento, restaurantes y compras personales',
    icon: Coffee,
    colorClass: 'text-purple-600',
    iconBg: 'bg-purple-50 border-purple-200 text-purple-700',
  },
  {
    key: 'salud',
    label: 'Salud y Farmacia',
    description: 'Consultas médicas, medicamentos y seguros de salud',
    icon: HeartPulse,
    colorClass: 'text-rose-600',
    iconBg: 'bg-rose-50 border-rose-200 text-rose-700',
  },
  {
    key: 'educacion',
    label: 'Educación y Desarrollo',
    description: 'Cursos, colegiaturas, libros y formación profesional',
    icon: BookOpen,
    colorClass: 'text-blue-600',
    iconBg: 'bg-blue-50 border-blue-200 text-blue-700',
  },
  {
    key: 'otro',
    label: 'Otros Gastos',
    description: 'Gastos imprevistos y categorías misceláneas',
    icon: DollarSign,
    colorClass: 'text-slate-600',
    iconBg: 'bg-slate-100 border-slate-300 text-slate-700',
  },
];

export const MonthlyBudgetConfigSection: React.FC<MonthlyBudgetConfigSectionProps> = ({
  categoryBudgets,
  onUpdateCategoryBudgets,
  payments,
  profile,
  onOpenOptimizer,
  onOpenAutocomplete,
}) => {
  const { isNitido, isVibrant } = useTheme();

  // Local draft values to allow fluid typing while debouncing/auto-saving
  const [localValues, setLocalValues] = useState<Record<string, string | number>>(() => ({
    ...categoryBudgets,
  }));

  // Auto-save feedback state
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('saved');
  const [savedNotification, setSavedNotification] = useState<string | null>(null);

  // Sync from props if categoryBudgets change externally (e.g. from optimizer or autocomplete)
  useEffect(() => {
    setLocalValues((prev) => {
      let isDifferent = false;
      for (const [k, v] of Object.entries(categoryBudgets)) {
        if (Number(prev[k]) !== v) {
          isDifferent = true;
          break;
        }
      }
      return isDifferent ? { ...categoryBudgets } : prev;
    });
  }, [categoryBudgets]);

  // Calculate actual spending per category from current payments of type 'gasto'
  const spendingByCategory = useMemo(() => {
    const acc: Record<string, number> = {};
    payments
      .filter((p) => p.type === 'gasto')
      .forEach((p) => {
        acc[p.category] = (acc[p.category] || 0) + Number(p.amount || 0);
      });
    return acc;
  }, [payments]);

  // Total allocated budget
  const totalAllocatedBudget = useMemo(() => {
    return Object.values(categoryBudgets).reduce((sum, val) => sum + (Number(val) || 0), 0);
  }, [categoryBudgets]);

  const monthlyIncome = profile.monthlyIncome || 0;
  const projectedSavings = monthlyIncome - totalAllocatedBudget;
  const budgetRatio = monthlyIncome > 0 ? Math.round((totalAllocatedBudget / monthlyIncome) * 100) : 0;

  // Auto-save logic
  const handleInputChange = (categoryKey: string, rawValue: string) => {
    setLocalValues((prev) => ({
      ...prev,
      [categoryKey]: rawValue,
    }));

    setSaveStatus('saving');

    const numValue = rawValue === '' ? 0 : Math.max(0, parseFloat(rawValue) || 0);
    const updated = {
      ...categoryBudgets,
      [categoryKey]: Math.round(numValue * 100) / 100,
    };

    onUpdateCategoryBudgets(updated);

    // Provide visual feedback
    setSaveStatus('saved');
    setSavedNotification(`Presupuesto de ${categoryKey} guardado (${profile.currencySymbol}${numValue.toLocaleString()})`);
    const timer = setTimeout(() => {
      setSavedNotification(null);
    }, 2500);
    return () => clearTimeout(timer);
  };

  const handleStepValue = (categoryKey: string, delta: number) => {
    const current = Number(categoryBudgets[categoryKey]) || 0;
    const nextVal = Math.max(0, current + delta);
    handleInputChange(categoryKey, String(nextVal));
  };

  // Rule 50/30/20 auto-allocation based on net monthly income
  const handleApply503020Rule = () => {
    if (monthlyIncome <= 0) return;

    // 50% Needs: Alquiler (25%), Alimentacion (15%), Servicios (5%), Transporte (5%)
    // 30% Wants: Ocio (15%), Educacion (7%), Salud (5%), Otro (3%)
    const updated: Record<string, number> = {
      alquiler: Math.round(monthlyIncome * 0.25),
      alimentacion: Math.round(monthlyIncome * 0.15),
      servicios: Math.round(monthlyIncome * 0.05),
      transporte: Math.round(monthlyIncome * 0.05),
      ocio: Math.round(monthlyIncome * 0.15),
      educacion: Math.round(monthlyIncome * 0.07),
      salud: Math.round(monthlyIncome * 0.05),
      otro: Math.round(monthlyIncome * 0.03),
    };

    onUpdateCategoryBudgets(updated);
    setLocalValues(updated);
    setSavedNotification('¡Regla 50/30/20 aplicada con éxito!');
    setTimeout(() => setSavedNotification(null), 3000);
  };

  const handleResetDefaults = () => {
    onUpdateCategoryBudgets(DEFAULT_CATEGORY_BUDGETS);
    setLocalValues(DEFAULT_CATEGORY_BUDGETS);
    setSavedNotification('Valores de presupuesto restablecidos a los recomendados.');
    setTimeout(() => setSavedNotification(null), 3000);
  };

  // Autopiloto de Ahorro: Estado de reducción porcentual seleccionada (5%, 8%, 10%)
  const [autopilotReductionPct, setAutopilotReductionPct] = useState<number>(8);
  const [isAutopilotExpanded, setIsAutopilotExpanded] = useState<boolean>(true);
  const [appliedCategories, setAppliedCategories] = useState<Record<string, boolean>>({});

  // Analiza el historial de gastos para detectar las categorías con mayor gasto/volumen
  const autopilotSuggestions = useMemo(() => {
    const ranked = CATEGORY_DEFINITIONS.map((cat) => {
      const spent = spendingByCategory[cat.key] || 0;
      const budget = Number(categoryBudgets[cat.key]) || 0;
      return {
        ...cat,
        spent,
        budget,
      };
    })
      .filter((c) => c.budget > 0)
      .sort((a, b) => b.spent - a.spent || b.budget - a.budget);

    // Toma las 3 categorías con mayor gasto o impacto presupuestario
    const topCategories = ranked.slice(0, 3);

    return topCategories.map((cat) => {
      const reductionAmount = Math.max(5, Math.round(cat.budget * (autopilotReductionPct / 100)));
      const suggestedBudget = Math.max(10, cat.budget - reductionAmount);
      return {
        ...cat,
        reductionPct: autopilotReductionPct,
        reductionAmount,
        suggestedBudget,
      };
    });
  }, [spendingByCategory, categoryBudgets, autopilotReductionPct]);

  const totalAutopilotSavingsMonth = useMemo(() => {
    return autopilotSuggestions.reduce((sum, s) => sum + s.reductionAmount, 0);
  }, [autopilotSuggestions]);

  const totalAutopilotSavingsYear = totalAutopilotSavingsMonth * 12;

  // Aplicar sugerencia completa del autopiloto a todas las categorías sugeridas
  const handleApplyAllAutopilot = () => {
    if (autopilotSuggestions.length === 0) return;

    const updated = { ...categoryBudgets };
    const appliedMap: Record<string, boolean> = {};
    autopilotSuggestions.forEach((s) => {
      updated[s.key] = s.suggestedBudget;
      appliedMap[s.key] = true;
    });

    setAppliedCategories(appliedMap);
    onUpdateCategoryBudgets(updated);
    setLocalValues(updated);
    setSavedNotification(
      `¡Sugerencia del Autopiloto de Ahorro aplicada! Reducción del ${autopilotReductionPct}% en categorías top. Ahorro proyectado: +${profile.currencySymbol}${totalAutopilotSavingsMonth.toLocaleString()}/mes (+${profile.currencySymbol}${totalAutopilotSavingsYear.toLocaleString()}/año).`
    );
    setTimeout(() => setSavedNotification(null), 4000);
  };

  // Aplicar sugerencia individual a una categoría específica
  const handleApplySingleAutopilot = (categoryKey: string, suggestedBudget: number, reductionAmount: number) => {
    const updated = {
      ...categoryBudgets,
      [categoryKey]: suggestedBudget,
    };

    setAppliedCategories((prev) => ({ ...prev, [categoryKey]: true }));
    onUpdateCategoryBudgets(updated);
    setLocalValues((prev) => ({ ...prev, [categoryKey]: suggestedBudget }));
    setSavedNotification(
      `Sugerencia aplicada a ${categoryKey}: nuevo límite ${profile.currencySymbol}${suggestedBudget} (Ahorro: +${profile.currencySymbol}${reductionAmount}/mes).`
    );
    setTimeout(() => setSavedNotification(null), 3500);
  };

  return (
    <div
      className={`rounded-3xl border transition-all ${
        isNitido
          ? 'bg-white border-slate-200/90 shadow-sm'
          : isVibrant
          ? 'bg-gradient-to-br from-slate-900/95 via-[#0b122e] to-[#070b1f] border-indigo-500/30 shadow-xl'
          : 'bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-950 border-slate-800 shadow-xl'
      } p-5 sm:p-6 space-y-6`}
    >
      {/* 1. Header with Title, Auto-save Badge, and Quick Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b pb-5 border-slate-100">
        <div className="flex items-start gap-3.5">
          <div
            className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border ${
              isNitido
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                : 'bg-indigo-950/80 border-indigo-700/60 text-indigo-400'
            }`}
          >
            <Sliders className="w-5 h-5" />
          </div>

          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className={`text-base sm:text-lg font-black tracking-tight ${isNitido ? 'text-slate-900' : 'text-white'}`}>
                Configuración de Presupuesto Mensual
              </h3>
              <span
                className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 border ${
                  saveStatus === 'saving'
                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                    : isNitido
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-emerald-950/70 text-emerald-300 border-emerald-800'
                }`}
              >
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                {saveStatus === 'saving' ? 'Guardando...' : 'Guardado automático'}
              </span>
            </div>

            <p className={`text-xs mt-1 leading-relaxed ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
              Define los límites numéricos de gasto mensual para cada categoría. Todos los cambios se guardan automáticamente en tu almacenamiento local.
            </p>
          </div>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <button
            type="button"
            onClick={handleApply503020Rule}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border active:scale-95 ${
              isNitido
                ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border-indigo-200'
                : 'bg-indigo-950/60 hover:bg-indigo-900 text-indigo-300 border-indigo-700/50'
            }`}
            title="Calcular distribución recomendada 50% necesidades, 30% gustos, 20% ahorro"
          >
            <PieChart className="w-3.5 h-3.5 text-indigo-600" />
            <span>Regla 50/30/20</span>
          </button>

          {onOpenAutocomplete && (
            <button
              type="button"
              onClick={onOpenAutocomplete}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border active:scale-95 ${
                isNitido
                  ? 'bg-teal-50 hover:bg-teal-100 text-teal-900 border-teal-200'
                  : 'bg-teal-950/60 hover:bg-teal-900 text-teal-300 border-teal-700/50'
              }`}
              title="Autocompletar límites de presupuesto usando el promedio de los últimos 3 meses"
            >
              <Sparkles className="w-3.5 h-3.5 text-teal-600" />
              <span>Promedio 3 Meses</span>
            </button>
          )}

          {onOpenOptimizer && (
            <button
              type="button"
              onClick={onOpenOptimizer}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border active:scale-95 ${
                isNitido
                  ? 'bg-violet-50 hover:bg-violet-100 text-violet-900 border-violet-200'
                  : 'bg-violet-950/60 hover:bg-violet-900 text-violet-300 border-violet-700/50'
              }`}
              title="Ajustar límites de gasto con asistencia de IA"
            >
              <Sparkles className="w-3.5 h-3.5 text-violet-600" />
              <span>Optimizar IA</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsAutopilotExpanded((prev) => !prev)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border active:scale-95 ${
              isAutopilotExpanded
                ? 'bg-amber-100 hover:bg-amber-200 text-amber-950 border-amber-300'
                : isNitido
                ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-200'
                : 'bg-amber-950/60 hover:bg-amber-900 text-amber-300 border-amber-700/50'
            }`}
            title="Autopiloto de Ahorro: Sugerencias automáticas del 5-10% en categorías de mayor gasto"
          >
            <Bot className="w-3.5 h-3.5 text-amber-600" />
            <span>Autopiloto -{autopilotReductionPct}%</span>
          </button>

          <button
            type="button"
            onClick={handleResetDefaults}
            className={`p-2 rounded-xl text-xs font-bold transition-colors border ${
              isNitido
                ? 'bg-white hover:bg-slate-100 text-slate-500 hover:text-slate-800 border-slate-200'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border-slate-700'
            }`}
            title="Restablecer valores predeterminados"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Temporary Toast Banner for Auto-Save Feedback */}
      {savedNotification && (
        <div
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-between gap-2 border animate-fadeIn ${
            isNitido
              ? 'bg-emerald-50 text-emerald-950 border-emerald-200 shadow-2xs'
              : 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{savedNotification}</span>
          </div>
          <span className="text-[10px] opacity-75">Auto-guardado en localStorage ✓</span>
        </div>
      )}

      {/* 2. Top Summary Metrics Card */}
      <div
        className={`p-4 sm:p-5 rounded-2xl border ${
          isNitido
            ? 'bg-slate-50/80 border-slate-200/90'
            : 'bg-slate-950/70 border-slate-800/80'
        }`}
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 text-center">
          {/* Total Budget */}
          <div className={`p-3 rounded-xl border ${isNitido ? 'bg-white border-slate-200 shadow-2xs' : 'bg-slate-900 border-slate-800'}`}>
            <span className={`text-[10px] font-bold uppercase tracking-wider block ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
              Presupuesto Total
            </span>
            <span className={`text-base sm:text-lg font-black block mt-0.5 ${isNitido ? 'text-indigo-900' : 'text-white'}`}>
              {profile.currencySymbol}{totalAllocatedBudget.toLocaleString()}
            </span>
            <span className={`text-[10px] font-semibold ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
              {budgetRatio}% del ingreso
            </span>
          </div>

          {/* Monthly Income */}
          <div className={`p-3 rounded-xl border ${isNitido ? 'bg-white border-slate-200 shadow-2xs' : 'bg-slate-900 border-slate-800'}`}>
            <span className={`text-[10px] font-bold uppercase tracking-wider block ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
              Ingreso Mensual
            </span>
            <span className={`text-base sm:text-lg font-black block mt-0.5 ${isNitido ? 'text-emerald-700' : 'text-emerald-400'}`}>
              {profile.currencySymbol}{monthlyIncome.toLocaleString()}
            </span>
            <span className={`text-[10px] font-semibold ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
              Base de cálculo
            </span>
          </div>

          {/* Projected Savings Margin */}
          <div className={`p-3 rounded-xl border ${isNitido ? 'bg-white border-slate-200 shadow-2xs' : 'bg-slate-900 border-slate-800'}`}>
            <span className={`text-[10px] font-bold uppercase tracking-wider block ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
              Margen Disponible
            </span>
            <span
              className={`text-base sm:text-lg font-black block mt-0.5 ${
                projectedSavings >= 0
                  ? isNitido ? 'text-emerald-700' : 'text-emerald-400'
                  : isNitido ? 'text-rose-700' : 'text-rose-400'
              }`}
            >
              {projectedSavings >= 0 ? '+' : ''}{profile.currencySymbol}{projectedSavings.toLocaleString()}
            </span>
            <span className={`text-[10px] font-semibold ${projectedSavings >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {projectedSavings >= 0 ? 'Capacidad de ahorro' : '⚠️ Déficit presupuestario'}
            </span>
          </div>

          {/* Categories Count */}
          <div className={`p-3 rounded-xl border ${isNitido ? 'bg-white border-slate-200 shadow-2xs' : 'bg-slate-900 border-slate-800'}`}>
            <span className={`text-[10px] font-bold uppercase tracking-wider block ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
              Categorías Activas
            </span>
            <span className={`text-base sm:text-lg font-black block mt-0.5 ${isNitido ? 'text-slate-900' : 'text-slate-100'}`}>
              {CATEGORY_DEFINITIONS.length}
            </span>
            <span className={`text-[10px] font-semibold ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
              100% personalizables
            </span>
          </div>
        </div>
      </div>

      {/* 2.5. Autopiloto de Ahorro: Sugerencias Automáticas de Inicio de Mes (5% - 10%) */}
      <div
        className={`rounded-2xl border transition-all ${
          isNitido
            ? 'bg-amber-50/40 border-amber-200/90 shadow-2xs'
            : isVibrant
            ? 'bg-gradient-to-r from-amber-950/30 via-slate-900/60 to-indigo-950/30 border-amber-500/30'
            : 'bg-slate-900/80 border-amber-600/30'
        } p-4 sm:p-5`}
      >
        {/* Autopilot Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                isNitido
                  ? 'bg-amber-100 border-amber-300 text-amber-800'
                  : 'bg-amber-950/80 border-amber-700/60 text-amber-300'
              }`}
            >
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className={`text-sm sm:text-base font-black tracking-tight ${isNitido ? 'text-slate-900' : 'text-white'}`}>
                  Autopiloto de Ahorro
                </h4>
                <span
                  className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider border ${
                    isNitido
                      ? 'bg-amber-100 text-amber-950 border-amber-300'
                      : 'bg-amber-950/90 text-amber-300 border-amber-800'
                  }`}
                >
                  ✦ Sugerencia de Inicio de Mes (-{autopilotReductionPct}%)
                </span>
              </div>
              <p className={`text-xs mt-0.5 ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
                Detecta tus 3 categorías con mayor gasto en el historial y propone una reducción controlada del 5% al 10% para acelerar tu ahorro.
              </p>
            </div>
          </div>

          {/* Controls: Selector de Porcentaje (5%, 8%, 10%) & Toggle */}
          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            <div className={`flex items-center p-0.5 rounded-xl border ${isNitido ? 'bg-white border-slate-200' : 'bg-slate-800 border-slate-700'}`}>
              {[5, 8, 10].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => {
                    setAutopilotReductionPct(pct);
                    setAppliedCategories({});
                  }}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                    autopilotReductionPct === pct
                      ? isNitido
                        ? 'bg-amber-500 text-white shadow-2xs'
                        : 'bg-amber-500 text-slate-950 font-black'
                      : isNitido
                      ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      : 'text-slate-400 hover:text-white hover:bg-slate-700'
                  }`}
                  title={`Sugerir reducción del ${pct}% en categorías con más gasto`}
                >
                  -{pct}%
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setIsAutopilotExpanded(!isAutopilotExpanded)}
              className={`p-1.5 rounded-xl border transition-colors ${
                isNitido
                  ? 'bg-white hover:bg-slate-100 text-slate-600 border-slate-200'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border-slate-700'
              }`}
              title={isAutopilotExpanded ? 'Minimizar panel' : 'Expandir panel'}
            >
              {isAutopilotExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Collapsible Content */}
        {isAutopilotExpanded && (
          <div className="mt-4 pt-4 border-t border-amber-200/60 space-y-4">
            {/* Quick Metrics & Global Apply Banner */}
            <div
              className={`p-3.5 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                isNitido
                  ? 'bg-white border-amber-200/90 shadow-2xs'
                  : 'bg-slate-950/70 border-slate-800'
              }`}
            >
              <div className="flex items-center gap-4 flex-wrap">
                <div>
                  <span className={`text-[10px] font-bold uppercase tracking-wider block ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
                    Categorías Top Analizadas
                  </span>
                  <span className={`text-sm font-black ${isNitido ? 'text-slate-900' : 'text-white'}`}>
                    {autopilotSuggestions.map((s) => s.label.split('/')[0].trim()).join(', ')}
                  </span>
                </div>

                <div className="h-7 w-px bg-slate-200 hidden sm:block" />

                <div>
                  <span className={`text-[10px] font-bold uppercase tracking-wider block ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
                    Ahorro Mensual Proyectado
                  </span>
                  <span className={`text-base font-black ${isNitido ? 'text-emerald-700' : 'text-emerald-400'}`}>
                    +{profile.currencySymbol}{totalAutopilotSavingsMonth.toLocaleString()}/mes
                  </span>
                </div>

                <div className="h-7 w-px bg-slate-200 hidden sm:block" />

                <div>
                  <span className={`text-[10px] font-bold uppercase tracking-wider block ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
                    Ahorro Anual Proyectado
                  </span>
                  <span className={`text-sm font-black ${isNitido ? 'text-indigo-700' : 'text-indigo-400'}`}>
                    +{profile.currencySymbol}{totalAutopilotSavingsYear.toLocaleString()}/año
                  </span>
                </div>
              </div>

              {/* Big Global "Aplicar sugerencia" button */}
              <button
                type="button"
                onClick={handleApplyAllAutopilot}
                disabled={autopilotSuggestions.length === 0}
                className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition-all shadow-2xs active:scale-95 shrink-0 ${
                  isNitido
                    ? 'bg-amber-600 hover:bg-amber-700 text-white'
                    : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                <span>Aplicar Sugerencia (+{profile.currencySymbol}{totalAutopilotSavingsMonth.toLocaleString()}/mes)</span>
              </button>
            </div>

            {/* Top Categories Suggestions Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {autopilotSuggestions.map((cat, idx) => {
                const Icon = cat.icon;
                const isApplied = Boolean(appliedCategories[cat.key]);

                return (
                  <div
                    key={cat.key}
                    className={`p-3.5 rounded-xl border flex flex-col justify-between space-y-3 transition-all ${
                      isNitido
                        ? 'bg-white border-slate-200 shadow-2xs hover:border-amber-300'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                              isNitido ? cat.iconBg : 'bg-slate-900 border-slate-800 text-slate-200'
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                          </div>
                          <div>
                            <span className={`text-xs font-bold block leading-tight ${isNitido ? 'text-slate-900' : 'text-white'}`}>
                              {cat.label}
                            </span>
                            <span className={`text-[10px] font-semibold ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
                              Top #{idx + 1} en volumen
                            </span>
                          </div>
                        </div>

                        <span
                          className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                            isNitido
                              ? 'bg-rose-50 text-rose-800 border-rose-200'
                              : 'bg-rose-950/80 text-rose-300 border-rose-800'
                          }`}
                        >
                          -{cat.reductionPct}%
                        </span>
                      </div>

                      {/* Stat Breakdown */}
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div className={`p-2 rounded-lg border ${isNitido ? 'bg-slate-50 border-slate-100' : 'bg-slate-900 border-slate-800'}`}>
                          <span className={`text-[9px] font-bold uppercase tracking-wider block ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
                            Límite actual
                          </span>
                          <span className={`font-black ${isNitido ? 'text-slate-800' : 'text-slate-200'}`}>
                            {profile.currencySymbol}{cat.budget.toLocaleString()}
                          </span>
                        </div>

                        <div className={`p-2 rounded-lg border ${isNitido ? 'bg-emerald-50/60 border-emerald-200' : 'bg-emerald-950/40 border-emerald-800'}`}>
                          <span className={`text-[9px] font-bold uppercase tracking-wider block ${isNitido ? 'text-emerald-800' : 'text-emerald-400'}`}>
                            Propuesto
                          </span>
                          <span className={`font-black ${isNitido ? 'text-emerald-800' : 'text-emerald-300'}`}>
                            {profile.currencySymbol}{cat.suggestedBudget.toLocaleString()}
                          </span>
                        </div>
                      </div>

                      <div className="mt-2 flex items-center justify-between text-[11px]">
                        <span className={`font-semibold ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
                          Gasto registrado: {profile.currencySymbol}{cat.spent.toLocaleString()}
                        </span>
                        <span className={`font-bold ${isNitido ? 'text-emerald-700' : 'text-emerald-400'}`}>
                          +{profile.currencySymbol}{cat.reductionAmount}/mes
                        </span>
                      </div>
                    </div>

                    {/* Single Apply Button */}
                    <button
                      type="button"
                      onClick={() => handleApplySingleAutopilot(cat.key, cat.suggestedBudget, cat.reductionAmount)}
                      disabled={isApplied}
                      className={`w-full py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border active:scale-95 ${
                        isApplied
                          ? isNitido
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300 cursor-default'
                            : 'bg-emerald-950 text-emerald-300 border-emerald-800 cursor-default'
                          : isNitido
                          ? 'bg-amber-50 hover:bg-amber-100 text-amber-950 border-amber-300'
                          : 'bg-amber-950/60 hover:bg-amber-900 text-amber-300 border-amber-800'
                      }`}
                    >
                      {isApplied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Aplicado con éxito</span>
                        </>
                      ) : (
                        <>
                          <Percent className="w-3.5 h-3.5 text-amber-600" />
                          <span>Aplicar sugerencia (-{profile.currencySymbol}{cat.reductionAmount})</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Financial Hygiene Note */}
            <div className={`p-2.5 rounded-xl border flex items-center gap-2.5 text-xs ${isNitido ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-slate-900 border-slate-800 text-slate-300'}`}>
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                <strong>Inicio de Mes Inteligente:</strong> Un recorte preventivo del 5-10% en tus categorías más costosas transfiere liquidez inmediata a tus metas de ahorro sin comprometer tus compromisos fijos ni tu estilo de vida.
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 3. Category Budgets Grid with Direct Numeric Inputs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {CATEGORY_DEFINITIONS.map((cat) => {
          const Icon = cat.icon;
          const currentLimit = Number(categoryBudgets[cat.key]) || 0;
          const currentSpent = spendingByCategory[cat.key] || 0;
          const sharePercent = totalAllocatedBudget > 0 ? Math.round((currentLimit / totalAllocatedBudget) * 100) : 0;
          const spentRatio = currentLimit > 0 ? Math.round((currentSpent / currentLimit) * 100) : 0;
          const isOverspent = currentSpent > currentLimit;

          return (
            <div
              key={cat.key}
              className={`p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-3 ${
                isNitido
                  ? isOverspent
                    ? 'bg-white border-rose-300 shadow-2xs hover:shadow-xs'
                    : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs hover:shadow-xs'
                  : isOverspent
                  ? 'bg-slate-900/90 border-rose-500/50 shadow-md'
                  : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 shadow-sm'
              }`}
            >
              <div>
                {/* Top: Icon + Name */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${cat.iconBg}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h4 className={`text-xs font-black truncate ${isNitido ? 'text-slate-900' : 'text-white'}`}>
                        {cat.label}
                      </h4>
                      <span className={`text-[10px] block truncate ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
                        {sharePercent}% del presupuesto
                      </span>
                    </div>
                  </div>

                  {isOverspent && (
                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-rose-100 text-rose-900 border border-rose-300 shrink-0">
                      Exceso
                    </span>
                  )}
                </div>

                <p className={`text-[11px] mb-3 line-clamp-1 ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
                  {cat.description}
                </p>

                {/* Editable Numeric Field */}
                <div>
                  <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${isNitido ? 'text-slate-700' : 'text-slate-300'}`}>
                    Límite Asignado ({profile.currency})
                  </label>
                  <div className="relative flex items-center">
                    <span className={`absolute left-3 text-xs font-black select-none pointer-events-none ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
                      {profile.currencySymbol}
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="10"
                      value={localValues[cat.key] !== undefined ? localValues[cat.key] : currentLimit}
                      onChange={(e) => handleInputChange(cat.key, e.target.value)}
                      className={`w-full pl-7 pr-16 py-2 rounded-xl text-xs sm:text-sm font-black border outline-hidden transition-all ${
                        isNitido
                          ? 'bg-slate-50 border-slate-300 text-slate-900 focus:bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100'
                          : 'bg-slate-800 border-slate-700 text-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-900/50'
                      }`}
                      placeholder="0"
                    />
                    {/* Stepper +/- buttons */}
                    <div className="absolute right-1 flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => handleStepValue(cat.key, -25)}
                        className={`p-1 rounded-md transition-colors ${
                          isNitido
                            ? 'hover:bg-slate-200 text-slate-600'
                            : 'hover:bg-slate-700 text-slate-400 hover:text-white'
                        }`}
                        title="Restar 25"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStepValue(cat.key, 25)}
                        className={`p-1 rounded-md transition-colors ${
                          isNitido
                            ? 'hover:bg-slate-200 text-slate-600'
                            : 'hover:bg-slate-700 text-slate-400 hover:text-white'
                        }`}
                        title="Sumar 25"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom: Current Actual Spending vs Assigned Limit Mini Progress */}
              <div className={`pt-2.5 border-t space-y-1.5 ${isNitido ? 'border-slate-100' : 'border-slate-800'}`}>
                <div className={`flex items-center justify-between text-[10px] font-semibold ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
                  <span>Gastado este mes:</span>
                  <span className={`font-black ${isOverspent ? (isNitido ? 'text-rose-700' : 'text-rose-400') : (isNitido ? 'text-slate-900' : 'text-white')}`}>
                    {profile.currencySymbol}{Math.round(currentSpent).toLocaleString()} ({spentRatio}%)
                  </span>
                </div>

                <div className={`h-1.5 w-full rounded-full overflow-hidden border ${isNitido ? 'bg-slate-100 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
                  <div
                    style={{ width: `${Math.min(100, spentRatio)}%` }}
                    className={`h-full rounded-full transition-all duration-300 ${
                      spentRatio >= 100
                        ? 'bg-rose-600'
                        : spentRatio >= 80
                        ? 'bg-amber-500'
                        : 'bg-emerald-600'
                    }`}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
