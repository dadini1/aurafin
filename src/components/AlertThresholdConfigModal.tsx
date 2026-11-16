import React, { useState } from 'react';
import {
  Bell,
  Sliders,
  Check,
  RotateCcw,
  AlertTriangle,
  ShieldCheck,
  Sparkles,
  X,
  Car,
  Home,
  ShoppingBag,
  Zap,
  Coffee,
  HeartPulse,
  BookOpen,
  DollarSign,
  Layers,
} from 'lucide-react';
import { PaymentItem, UserFinancialProfile } from '../types';
import { useTheme } from '../context/ThemeContext';

interface AlertThresholdConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  payments: PaymentItem[];
  profile: UserFinancialProfile;
  categoryBudgets: Record<string, number>;
  alertThresholds: Record<string, number>;
  globalAlertThreshold: number;
  onSaveThresholds: (thresholds: Record<string, number>, globalThreshold: number) => void;
}

export const CATEGORY_ICONS_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  transporte: Car,
  alquiler: Home,
  alimentacion: ShoppingBag,
  servicios: Zap,
  ocio: Coffee,
  salud: HeartPulse,
  educacion: BookOpen,
  otro: DollarSign,
};

export const CATEGORY_LABELS_MAP: Record<string, string> = {
  alquiler: 'Vivienda / Alquiler',
  transporte: 'Transporte / Movilidad',
  alimentacion: 'Alimentación / Despensa',
  servicios: 'Servicios Básicos (Luz/Agua/Net)',
  ocio: 'Ocio y Restaurantes',
  salud: 'Salud y Farmacia',
  educacion: 'Educación y Cursos',
  otro: 'Otros Gastos',
};

export const AlertThresholdConfigModal: React.FC<AlertThresholdConfigModalProps> = ({
  isOpen,
  onClose,
  payments,
  profile,
  categoryBudgets,
  alertThresholds,
  globalAlertThreshold,
  onSaveThresholds,
}) => {
  const { isNitido } = useTheme();
  const [globalThreshold, setGlobalThreshold] = useState<number>(globalAlertThreshold || 80);
  const [localThresholds, setLocalThresholds] = useState<Record<string, number>>({
    ...alertThresholds,
  });

  // Calculate actual spending per category
  const spendingByCategory: Record<string, number> = {};
  payments
    .filter((p) => p.type === 'gasto')
    .forEach((p) => {
      spendingByCategory[p.category] = (spendingByCategory[p.category] || 0) + p.amount;
    });

  if (!isOpen) return null;

  const handleApplyGlobalToAll = (val: number) => {
    setGlobalThreshold(val);
    const updated: Record<string, number> = {};
    Object.keys(CATEGORY_LABELS_MAP).forEach((cat) => {
      updated[cat] = val;
    });
    setLocalThresholds(updated);
  };

  const handleSetCategoryThreshold = (cat: string, val: number) => {
    setLocalThresholds((prev) => ({
      ...prev,
      [cat]: val,
    }));
  };

  const handleResetDefaults = () => {
    const defaults: Record<string, number> = {
      transporte: 75,
      alquiler: 90,
      alimentacion: 80,
      servicios: 80,
      ocio: 50,
      salud: 75,
      educacion: 80,
      otro: 75,
    };
    setGlobalThreshold(80);
    setLocalThresholds(defaults);
  };

  const handleSave = () => {
    onSaveThresholds(localThresholds, globalThreshold);
    onClose();
  };

  // Count active alerts with current local thresholds
  const triggeredCount = Object.keys(CATEGORY_LABELS_MAP).filter((cat) => {
    const spent = spendingByCategory[cat] || 0;
    const budget = categoryBudgets[cat] || 1;
    const threshold = (localThresholds[cat] || globalThreshold) / 100;
    return spent / budget >= threshold;
  }).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
      <div className={`border rounded-3xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden ${
        isNitido ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-800 text-white'
      }`}>
        {/* 1. Header */}
        <div className={`p-5 sm:p-6 border-b flex items-center justify-between ${
          isNitido ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-slate-950/60 border-slate-800 text-white'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${
              isNitido ? 'bg-amber-100 border-amber-300 text-amber-800' : 'bg-amber-500/15 border-amber-500/30 text-amber-400'
            }`}>
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className={`text-base sm:text-lg font-bold tracking-tight flex items-center gap-2 ${
                isNitido ? 'text-slate-900' : 'text-white'
              }`}>
                Configuración de Límites de Alertas Automáticas
              </h3>
              <p className={`text-xs ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
                Personaliza en qué porcentaje del presupuesto deseas recibir advertencias (50%, 75%, 90%)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-xl transition-colors ${
              isNitido ? 'hover:bg-slate-200 text-slate-400 hover:text-slate-800' : 'hover:bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2. Scrollable Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6">
          {/* Global Threshold Quick Presets Bar */}
          <div className={`p-4 rounded-2xl border space-y-3 ${
            isNitido ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/70 border-slate-800/80'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className={`text-xs font-bold flex items-center gap-1.5 ${
                isNitido ? 'text-slate-900' : 'text-white'
              }`}>
                <Sparkles className={`w-3.5 h-3.5 ${isNitido ? 'text-indigo-600' : 'text-cyan-400'}`} />
                Umbral Predeterminado Global ({globalThreshold}%):
              </span>
              <span className={`text-[11px] ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
                Aplica un límite base a todas las categorías con un clic
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { pct: 50, label: '50% Preventivo', desc: 'Control muy estricto' },
                { pct: 75, label: '75% Equilibrado', desc: 'Aviso con antelación' },
                { pct: 80, label: '80% Estándar IA', desc: 'Recomendado general' },
                { pct: 90, label: '90% Flexible', desc: 'Alerta de última hora' },
              ].map(({ pct, label, desc }) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => handleApplyGlobalToAll(pct)}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    globalThreshold === pct
                      ? isNitido
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                        : 'bg-cyan-500/20 border-cyan-500/50 text-white shadow-md'
                      : isNitido
                      ? 'bg-white border-slate-200 text-slate-800 hover:border-slate-300'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="text-xs font-bold">{label}</div>
                  <div className={`text-[10px] mt-0.5 ${globalThreshold === pct && isNitido ? 'text-indigo-100' : isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
                    {desc}
                  </div>
                </button>
              ))}
            </div>

            {/* Slider for custom global threshold */}
            <div className="flex items-center gap-3 pt-1">
              <input
                type="range"
                min="40"
                max="95"
                step="5"
                value={globalThreshold}
                onChange={(e) => handleApplyGlobalToAll(Number(e.target.value))}
                className={`w-full cursor-pointer h-1.5 rounded-lg ${
                  isNitido ? 'accent-indigo-600 bg-slate-200' : 'accent-cyan-400 bg-slate-800'
                }`}
              />
              <span className={`text-xs font-black min-w-[45px] text-right ${
                isNitido ? 'text-indigo-900' : 'text-cyan-300'
              }`}>
                {globalThreshold}%
              </span>
            </div>
          </div>

          {/* Granular Per-Category Settings */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className={`text-xs font-bold uppercase tracking-wider ${
                isNitido ? 'text-slate-700' : 'text-slate-300'
              }`}>
                Límites Específicos por Categoría de Gasto
              </h4>
              <span className={`text-[11px] ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
                Haz clic en 50%, 75% o 90% para ajustar cada una
              </span>
            </div>

            <div className="space-y-2.5">
              {Object.keys(CATEGORY_LABELS_MAP).map((cat) => {
                const Icon = CATEGORY_ICONS_MAP[cat] || DollarSign;
                const label = CATEGORY_LABELS_MAP[cat] || cat;
                const currentBudget = categoryBudgets[cat] || 100;
                const currentSpent = spendingByCategory[cat] || 0;
                const currentThreshold = localThresholds[cat] || globalThreshold;
                const alertTriggerAmount = Math.round((currentBudget * currentThreshold) / 100);
                const isTriggered = currentSpent >= alertTriggerAmount;
                const spentPercent = Math.round((currentSpent / currentBudget) * 100);

                return (
                  <div
                    key={cat}
                    className={`p-3.5 rounded-2xl border transition-all ${
                      isTriggered
                        ? isNitido
                          ? 'bg-amber-50/60 border-amber-300 shadow-xs'
                          : 'bg-amber-950/20 border-amber-500/40'
                        : isNitido
                        ? 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                        : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      {/* Left: Icon, Category Name and Progress */}
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                            isTriggered
                              ? isNitido
                                ? 'bg-amber-100 border-amber-300 text-amber-800'
                                : 'bg-amber-500/20 border-amber-500/30 text-amber-300'
                              : isNitido
                              ? 'bg-slate-100 border-slate-200 text-slate-700'
                              : 'bg-slate-800 border-slate-700 text-slate-300'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-xs sm:text-sm font-bold ${
                              isNitido ? 'text-slate-900' : 'text-white'
                            }`}>
                              {label}
                            </span>
                            {isTriggered && (
                              <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold border ${
                                isNitido
                                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                                  : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              }`}>
                                Alerta Activa ({spentPercent}%)
                              </span>
                            )}
                          </div>
                          <span className={`text-[11px] block mt-0.5 ${
                            isNitido ? 'text-slate-600' : 'text-slate-400'
                          }`}>
                            Gasto: <strong className={isNitido ? 'text-slate-900 font-bold' : 'text-white font-bold'}>{profile.currencySymbol}{currentSpent.toLocaleString()}</strong> de {profile.currencySymbol}{currentBudget.toLocaleString()}
                            {' · '}Avisar al llegar a: <strong className={isNitido ? 'text-indigo-900 font-bold' : 'text-cyan-300'}>{profile.currencySymbol}{alertTriggerAmount.toLocaleString()}</strong> ({currentThreshold}%)
                          </span>
                        </div>
                      </div>

                      {/* Right: Preset Pills & Slider */}
                      <div className="flex items-center gap-1.5 self-end sm:self-auto flex-wrap">
                        {[50, 75, 80, 90].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => handleSetCategoryThreshold(cat, preset)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                              currentThreshold === preset
                                ? isNitido
                                  ? 'bg-indigo-600 text-white shadow-xs'
                                  : 'bg-cyan-500 text-slate-950 shadow-sm'
                                : isNitido
                                ? 'bg-slate-100 text-slate-700 hover:text-slate-900 hover:bg-slate-200'
                                : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                            }`}
                          >
                            {preset}%
                          </button>
                        ))}

                        <div className="w-16 ml-1">
                          <input
                            type="number"
                            min="30"
                            max="99"
                            step="5"
                            value={currentThreshold}
                            onChange={(e) =>
                              handleSetCategoryThreshold(
                                cat,
                                Math.max(20, Math.min(99, Number(e.target.value) || 50))
                              )
                            }
                            className={`w-full px-2 py-1 rounded-lg text-xs text-center font-bold border focus:outline-none ${
                              isNitido
                                ? 'bg-white border-slate-300 text-slate-900 focus:border-indigo-600'
                                : 'bg-slate-900 border-slate-700 text-white focus:border-cyan-400'
                            }`}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar indicating Spent vs Alert Marker */}
                    <div className={`mt-2.5 relative h-2 rounded-full overflow-hidden ${
                      isNitido ? 'bg-slate-200' : 'bg-slate-800'
                    }`}>
                      {/* Spent fill bar */}
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          spentPercent >= 100
                            ? 'bg-rose-600'
                            : isTriggered
                            ? 'bg-amber-500'
                            : 'bg-emerald-600'
                        }`}
                        style={{ width: `${Math.min(100, spentPercent)}%` }}
                      />
                      {/* Threshold marker vertical line */}
                      <div
                        className={`absolute top-0 bottom-0 w-1 shadow-sm ${
                          isNitido ? 'bg-slate-900' : 'bg-cyan-400'
                        }`}
                        style={{ left: `${Math.min(98, currentThreshold)}%` }}
                        title={`Límite de alerta: ${currentThreshold}%`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 3. Footer with Status & Actions */}
        <div className={`p-4 sm:p-5 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          isNitido ? 'border-slate-200 bg-slate-50 text-slate-800' : 'border-slate-800 bg-slate-950/70 text-slate-300'
        }`}>
          <div className="flex items-center gap-2 text-xs">
            <Bell className={`w-4 h-4 shrink-0 ${isNitido ? 'text-amber-700' : 'text-amber-400'}`} />
            <span>
              Con estos límites se activarán{' '}
              <strong className={isNitido ? 'text-slate-900 font-black' : 'text-white font-bold'}>{triggeredCount} alerta(s) inmediata(s)</strong>.
            </span>
          </div>

          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={handleResetDefaults}
              className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors border ${
                isNitido
                  ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-transparent'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restablecer</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
                isNitido ? 'text-slate-600 hover:text-slate-900' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Guardar Límites</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
