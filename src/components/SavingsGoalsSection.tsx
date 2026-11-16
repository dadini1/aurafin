import React, { useState } from 'react';
import {
  Target,
  Plus,
  Car,
  Home,
  Shield,
  Plane,
  Sparkles,
  TrendingUp,
  Calendar,
  X,
  Trash2,
  DollarSign,
  CheckCircle2,
} from 'lucide-react';
import { SavingsGoal, UserFinancialProfile } from '../types';
import { useTheme } from '../context/ThemeContext';

interface SavingsGoalsSectionProps {
  goals: SavingsGoal[];
  profile: UserFinancialProfile;
  onAddGoal: (goal: Omit<SavingsGoal, 'id' | 'createdAt'>) => void;
  onUpdateGoalAmount: (id: string, newAmount: number) => void;
  onDeleteGoal: (id: string) => void;
  onOpenVoiceAssistantWithPrompt?: (prompt: string) => void;
  onCelebrateMilestone?: (goal: SavingsGoal, tier: 50 | 75 | 100) => void;
}

export const SavingsGoalsSection: React.FC<SavingsGoalsSectionProps> = ({
  goals,
  profile,
  onAddGoal,
  onUpdateGoalAmount,
  onDeleteGoal,
  onOpenVoiceAssistantWithPrompt,
  onCelebrateMilestone,
}) => {
  const { isNitido } = useTheme();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [depositModalGoal, setDepositModalGoal] = useState<SavingsGoal | null>(null);
  const [depositAmount, setDepositAmount] = useState<number | ''>('');

  // Form State
  const [title, setTitle] = useState('');
  const [targetAmount, setTargetAmount] = useState<number | ''>('');
  const [currentAmount, setCurrentAmount] = useState<number | ''>(0);
  const [deadline, setDeadline] = useState(
    new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [category, setCategory] = useState<SavingsGoal['category']>('auto');
  const [notes, setNotes] = useState('');

  const totalTarget = goals.reduce((sum, g) => sum + g.targetAmount, 0);
  const totalSaved = goals.reduce((sum, g) => sum + g.currentAmount, 0);
  const overallProgress = totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0;

  const handleCreateGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !targetAmount || Number(targetAmount) <= 0) return;

    const monthsRemaining = Math.max(
      1,
      Math.round(
        (new Date(deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24 * 30.4)
      )
    );
    const needed = Math.max(0, Number(targetAmount) - Number(currentAmount || 0));
    const monthlyContribution = Math.round(needed / monthsRemaining);

    onAddGoal({
      title: title.trim(),
      targetAmount: Number(targetAmount),
      currentAmount: Number(currentAmount || 0),
      deadline,
      category,
      monthlyContribution,
      notes: notes.trim(),
    });

    setTitle('');
    setTargetAmount('');
    setCurrentAmount(0);
    setNotes('');
    setIsAddOpen(false);
  };

  const handleDeposit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!depositModalGoal || !depositAmount || Number(depositAmount) <= 0) return;
    onUpdateGoalAmount(
      depositModalGoal.id,
      depositModalGoal.currentAmount + Number(depositAmount)
    );
    setDepositModalGoal(null);
    setDepositAmount('');
  };

  const getCategoryIcon = (cat: SavingsGoal['category']) => {
    switch (cat) {
      case 'auto':
        return <Car className="w-5 h-5 text-amber-400" />;
      case 'vivienda':
        return <Home className="w-5 h-5 text-indigo-400" />;
      case 'emergencia':
        return <Shield className="w-5 h-5 text-emerald-400" />;
      case 'viaje':
        return <Plane className="w-5 h-5 text-cyan-400" />;
      default:
        return <Target className="w-5 h-5 text-violet-400" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 rounded-2xl border ${
        isNitido ? 'bg-white border-slate-200 shadow-sm text-slate-900' : 'bg-slate-900/70 border-slate-800 text-white'
      }`}>
        <div>
          <div className="flex items-center gap-2">
            <Target className={`w-5 h-5 ${isNitido ? 'text-indigo-600' : 'text-cyan-400'}`} />
            <h3 className={`text-base font-bold ${isNitido ? 'text-slate-900' : 'text-white'}`}>Metas de Ahorro Programadas</h3>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
              isNitido ? 'bg-indigo-50 text-indigo-800 border-indigo-200' : 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
            }`}>
              {goals.length} activas
            </span>
          </div>
          <p className={`text-xs mt-1 ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
            Total acumulado: <strong className={isNitido ? 'text-slate-900 font-bold' : 'text-white'}>{profile.currencySymbol}{totalSaved.toLocaleString()}</strong> de {profile.currencySymbol}{totalTarget.toLocaleString()} ({overallProgress}% completado)
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onOpenVoiceAssistantWithPrompt && (
            <button
              onClick={() => onOpenVoiceAssistantWithPrompt('Quiero crear una meta de ahorro de')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                isNitido
                  ? 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200 shadow-xs'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
            >
              <Sparkles className={`w-3.5 h-3.5 ${isNitido ? 'text-indigo-600' : 'text-cyan-400'}`} />
              <span>Dictar Meta por Voz</span>
            </button>
          )}

          <button
            data-testid="add-goal-btn"
            onClick={() => setIsAddOpen(true)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-white text-xs font-bold transition-all shadow-xs ${
              isNitido
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white-fixed'
                : 'bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 shadow-md'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Meta</span>
          </button>
        </div>
      </div>

      {/* Goals Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {goals.map((goal) => {
          const percent = Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100));
          const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);

          return (
            <div
              key={goal.id}
              className={`p-5 rounded-2xl border flex flex-col justify-between space-y-4 transition-all ${
                isNitido 
                  ? 'bg-white border-slate-200 hover:border-slate-300 shadow-sm hover:shadow-md' 
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700/80 shadow-md'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${
                      isNitido ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'
                    }`}>
                      {getCategoryIcon(goal.category)}
                    </div>
                    <div>
                      <h4 className={`text-sm font-bold line-clamp-1 ${isNitido ? 'text-slate-900' : 'text-white'}`}>{goal.title}</h4>
                      <span className={`text-[10px] uppercase font-bold ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
                        {goal.category}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => onDeleteGoal(goal.id)}
                    className={`p-1 rounded-md transition-colors ${
                      isNitido ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50' : 'text-slate-500 hover:text-rose-400'
                    }`}
                    title="Eliminar meta"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {goal.notes && (
                  <p className={`text-xs leading-relaxed line-clamp-2 mb-3 p-2 rounded-lg border ${
                    isNitido ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-slate-950/40 border-slate-800/60 text-slate-300'
                  }`}>
                    💡 {goal.notes}
                  </p>
                )}

                {/* Progress Bar & Readout */}
                <div className="space-y-1.5">
                  <div className="flex items-baseline justify-between text-xs">
                    <span className={`font-black text-base ${isNitido ? 'text-slate-900' : 'text-white'}`}>
                      {profile.currencySymbol}{goal.currentAmount.toLocaleString()}
                    </span>
                    <span className={isNitido ? 'text-slate-600' : 'text-slate-400'}>
                      Meta: {profile.currencySymbol}{goal.targetAmount.toLocaleString()}
                    </span>
                  </div>

                  <div className={`h-2.5 w-full rounded-full overflow-hidden border ${
                    isNitido ? 'bg-slate-100 border-slate-200' : 'bg-slate-950 border-slate-800'
                  }`}>
                    <div
                      style={{ width: `${percent}%` }}
                      className={`h-full rounded-full transition-all duration-500 ${
                        isNitido ? 'bg-indigo-600' : 'bg-gradient-to-r from-cyan-500 to-indigo-500'
                      }`}
                    />
                  </div>

                  <div className={`flex items-center justify-between text-[11px] pt-0.5 ${
                    isNitido ? 'text-slate-600 font-medium' : 'text-slate-400'
                  }`}>
                    <span>{percent}% logrado</span>
                    <span>Resta: {profile.currencySymbol}{remaining.toLocaleString()}</span>
                  </div>

                  {/* Interactive 50%, 75%, 100% Milestone Badges */}
                  <div className="flex items-center gap-1.5 pt-1">
                    {([50, 75, 100] as const).map((tier) => {
                      const unlocked = percent >= tier;
                      return (
                        <button
                          key={tier}
                          type="button"
                          disabled={!unlocked}
                          onClick={() => unlocked && onCelebrateMilestone?.(goal, tier)}
                          title={
                            unlocked
                              ? `Hito ${tier}% alcanzado — clic para celebrar con confeti`
                              : `Se desbloquea al alcanzar ${tier}% de la meta`
                          }
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold tabular-nums border transition-colors whitespace-nowrap ${
                            unlocked
                              ? isNitido
                                ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200 cursor-pointer'
                                : 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border-amber-400/35 cursor-pointer'
                              : isNitido
                              ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-default'
                              : 'bg-slate-900/60 text-slate-500 border-slate-800 cursor-default'
                          }`}
                        >
                          {unlocked && <Sparkles className="w-2.5 h-2.5" />}
                          <span>{tier}%</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Footer info & Deposit action */}
              <div className={`pt-3 border-t flex items-center justify-between text-xs ${
                isNitido ? 'border-slate-100 text-slate-600' : 'border-slate-800/80 text-slate-400'
              }`}>
                <div className="flex items-center gap-1 text-[11px]">
                  <Calendar className={`w-3 h-3 ${isNitido ? 'text-slate-400' : 'text-slate-500'}`} />
                  <span>{profile.currencySymbol}{goal.monthlyContribution}/mes</span>
                </div>

                <button
                  onClick={() => {
                    setDepositModalGoal(goal);
                    setDepositAmount('');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors border ${
                    isNitido 
                      ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                      : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/30'
                  }`}
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  <span>Abonar</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Abonar a una meta */}
      {depositModalGoal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={`rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-4 border ${
            isNitido ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-800 text-white'
          }`}>
            <div className="flex items-center justify-between">
              <h3 className={`text-sm font-bold flex items-center gap-2 ${isNitido ? 'text-slate-900' : 'text-white'}`}>
                <DollarSign className="w-4 h-4 text-emerald-600" />
                Abonar a &ldquo;{depositModalGoal.title}&rdquo;
              </h3>
              <button 
                onClick={() => setDepositModalGoal(null)} 
                className={isNitido ? 'text-slate-400 hover:text-slate-700' : 'text-slate-400 hover:text-white'}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleDeposit} className="space-y-4">
              <div>
                <label className={`text-xs block mb-1 font-bold ${isNitido ? 'text-slate-700' : 'text-slate-300'}`}>
                  Monto a Depositar ({profile.currencySymbol})
                </label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  placeholder="Ej: 150"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  className={`w-full px-4 py-2.5 rounded-xl font-bold text-base focus:ring-2 focus:ring-emerald-500/40 focus:outline-none border ${
                    isNitido ? 'bg-slate-50 border-slate-300 text-slate-900 focus:bg-white' : 'bg-slate-950 border-slate-800 text-white'
                  }`}
                  required
                  autoFocus
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDepositModalGoal(null)}
                  className={`px-4 py-2 text-xs font-semibold ${isNitido ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'}`}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md"
                >
                  Confirmar Abono
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Crear Nueva Meta */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={`rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4 border ${
            isNitido ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-800 text-white'
          }`}>
            <div className="flex items-center justify-between">
              <h3 className={`text-base font-bold flex items-center gap-2 ${isNitido ? 'text-slate-900' : 'text-white'}`}>
                <Target className={`w-4 h-4 ${isNitido ? 'text-indigo-600' : 'text-cyan-400'}`} />
                Establecer Nueva Meta de Ahorro
              </h3>
              <button 
                onClick={() => setIsAddOpen(false)} 
                className={isNitido ? 'text-slate-400 hover:text-slate-700' : 'text-slate-400 hover:text-white'}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateGoal} className="space-y-3">
              <div>
                <label className={`text-xs block mb-1 font-bold ${isNitido ? 'text-slate-700' : 'text-slate-300'}`}>
                  Nombre de la Meta
                </label>
                <input
                  type="text"
                  placeholder="Ej: Enganche para Auto Seminuevo, Casa propia..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/40 focus:outline-none border ${
                    isNitido ? 'bg-slate-50 border-slate-300 text-slate-900 focus:bg-white' : 'bg-slate-950 border-slate-800 text-white'
                  }`}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`text-xs block mb-1 font-bold ${isNitido ? 'text-slate-700' : 'text-slate-300'}`}>
                    Monto Objetivo ({profile.currencySymbol})
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="4000"
                    value={targetAmount}
                    onChange={(e) => setTargetAmount(e.target.value === '' ? '' : Number(e.target.value))}
                    className={`w-full px-3 py-2 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/40 focus:outline-none border ${
                      isNitido ? 'bg-slate-50 border-slate-300 text-slate-900 focus:bg-white' : 'bg-slate-950 border-slate-800 text-white'
                    }`}
                    required
                  />
                </div>
                <div>
                  <label className={`text-xs block mb-1 font-bold ${isNitido ? 'text-slate-700' : 'text-slate-300'}`}>
                    Ahorro Inicial ({profile.currencySymbol})
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={currentAmount}
                    onChange={(e) => setCurrentAmount(e.target.value === '' ? '' : Number(e.target.value))}
                    className={`w-full px-3 py-2 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/40 focus:outline-none border ${
                      isNitido ? 'bg-slate-50 border-slate-300 text-slate-900 focus:bg-white' : 'bg-slate-950 border-slate-800 text-white'
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`text-xs block mb-1 font-bold ${isNitido ? 'text-slate-700' : 'text-slate-300'}`}>Categoría</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className={`w-full px-3 py-2 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/40 focus:outline-none border ${
                      isNitido ? 'bg-slate-50 border-slate-300 text-slate-900 focus:bg-white' : 'bg-slate-950 border-slate-800 text-white'
                    }`}
                  >
                    <option value="auto">Automóvil / Vehículo</option>
                    <option value="vivienda">Vivienda / Casa</option>
                    <option value="emergencia">Fondo de Emergencia</option>
                    <option value="retiro">Retiro / Inversión</option>
                    <option value="viaje">Viaje / Estudio</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>

                <div>
                  <label className={`text-xs block mb-1 font-bold ${isNitido ? 'text-slate-700' : 'text-slate-300'}`}>Fecha Límite</label>
                  <input
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/40 focus:outline-none border ${
                      isNitido ? 'bg-slate-50 border-slate-300 text-slate-900 focus:bg-white' : 'bg-slate-950 border-slate-800 text-white'
                    }`}
                    required
                  />
                </div>
              </div>

              <div>
                <label className={`text-xs block mb-1 font-bold ${isNitido ? 'text-slate-700' : 'text-slate-300'}`}>Motivación o Notas</label>
                <textarea
                  rows={2}
                  placeholder="Ej: Ahorro sugerido por AuraFin AI para sustituir gasto en Uber..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/40 focus:outline-none resize-none border ${
                    isNitido ? 'bg-slate-50 border-slate-300 text-slate-900 focus:bg-white' : 'bg-slate-950 border-slate-800 text-white'
                  }`}
                />
              </div>

              <div className={`flex justify-end gap-2 pt-2 border-t ${isNitido ? 'border-slate-100' : 'border-slate-800'}`}>
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className={`px-4 py-2 text-xs font-semibold ${isNitido ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'}`}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md"
                >
                  Guardar Meta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
