import React, { useEffect, useMemo, useState } from 'react';
import {
  Flame,
  Zap,
  Award,
  Star,
  ShieldCheck,
  Trophy,
  Check,
  Lock,
  Plus,
  SlidersHorizontal,
  CalendarDays,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { UserFinancialProfile } from '../types';
import { useTheme } from '../context/ThemeContext';
import {
  AchievementBadge,
  PersistedSavingsStreakState,
  StreakTrackingMode,
  STREAK_UPDATED_EVENT,
  computeDefaultTargets,
  computeSavingsStreakSummary,
  loadSavingsStreakState,
  saveSavingsStreakState,
} from '../utils/savingsStreakEngine';

interface SavingsStreakWidgetProps {
  profile: UserFinancialProfile;
}

const BADGE_ICON_MAP: Record<AchievementBadge['iconName'], React.ComponentType<{ className?: string }>> = {
  flame: Flame,
  zap: Zap,
  award: Award,
  star: Star,
  shield: ShieldCheck,
  trophy: Trophy,
};

const BADGE_STYLE_MAP: Record<
  AchievementBadge['accent'],
  {
    lightCard: string;
    darkCard: string;
    lightIcon: string;
    darkIcon: string;
    barColor: string;
    labelLight: string;
    labelDark: string;
  }
> = {
  amber: {
    lightCard: 'bg-amber-50/70 border-amber-200',
    darkCard: 'bg-amber-950/25 border-amber-500/35',
    lightIcon: 'bg-amber-100 text-amber-700 border-amber-300',
    darkIcon: 'bg-amber-500/20 text-amber-300 border-amber-400/40',
    barColor: 'bg-amber-500',
    labelLight: 'text-amber-800',
    labelDark: 'text-amber-300',
  },
  cyan: {
    lightCard: 'bg-cyan-50/70 border-cyan-200',
    darkCard: 'bg-cyan-950/25 border-cyan-500/35',
    lightIcon: 'bg-cyan-100 text-cyan-700 border-cyan-300',
    darkIcon: 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40',
    barColor: 'bg-cyan-500',
    labelLight: 'text-cyan-800',
    labelDark: 'text-cyan-300',
  },
  emerald: {
    lightCard: 'bg-emerald-50/70 border-emerald-200',
    darkCard: 'bg-emerald-950/25 border-emerald-500/35',
    lightIcon: 'bg-emerald-100 text-emerald-700 border-emerald-300',
    darkIcon: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40',
    barColor: 'bg-emerald-500',
    labelLight: 'text-emerald-800',
    labelDark: 'text-emerald-300',
  },
  teal: {
    lightCard: 'bg-teal-50/70 border-teal-200',
    darkCard: 'bg-teal-950/25 border-teal-500/35',
    lightIcon: 'bg-teal-100 text-teal-700 border-teal-300',
    darkIcon: 'bg-teal-500/20 text-teal-300 border-teal-400/40',
    barColor: 'bg-teal-500',
    labelLight: 'text-teal-800',
    labelDark: 'text-teal-300',
  },
  indigo: {
    lightCard: 'bg-indigo-50/70 border-indigo-200',
    darkCard: 'bg-indigo-950/25 border-indigo-500/35',
    lightIcon: 'bg-indigo-100 text-indigo-700 border-indigo-300',
    darkIcon: 'bg-indigo-500/20 text-indigo-300 border-indigo-400/40',
    barColor: 'bg-indigo-500',
    labelLight: 'text-indigo-800',
    labelDark: 'text-indigo-300',
  },
  violet: {
    lightCard: 'bg-violet-50/70 border-violet-200',
    darkCard: 'bg-violet-950/25 border-violet-500/35',
    lightIcon: 'bg-violet-100 text-violet-700 border-violet-300',
    darkIcon: 'bg-violet-500/20 text-violet-300 border-violet-400/40',
    barColor: 'bg-violet-500',
    labelLight: 'text-violet-800',
    labelDark: 'text-violet-300',
  },
};

export const SavingsStreakWidget: React.FC<SavingsStreakWidgetProps> = ({ profile }) => {
  const { isNitido, isVibrant } = useTheme();
  const currSym = profile.currencySymbol || '$';

  const [streakState, setStreakState] = useState<PersistedSavingsStreakState>(() =>
    loadSavingsStreakState(profile)
  );
  const [customInputAmount, setCustomInputAmount] = useState('');
  const [isEditingTarget, setIsEditingTarget] = useState(false);
  const [targetInput, setTargetInput] = useState('');
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const [recentUnlockToast, setRecentUnlockToast] = useState<AchievementBadge | null>(null);

  // Listen for goal deposits recorded elsewhere in FinancesTab
  useEffect(() => {
    const syncFromStorage = () => {
      setStreakState(loadSavingsStreakState(profile));
    };
    window.addEventListener(STREAK_UPDATED_EVENT, syncFromStorage);
    return () => {
      window.removeEventListener(STREAK_UPDATED_EVENT, syncFromStorage);
    };
  }, [profile]);

  const { summary, newlyUnlockedIds, updatedUnlockedAt } = useMemo(
    () => computeSavingsStreakSummary(streakState, profile),
    [streakState, profile]
  );

  // Persist newly unlocked achievement timestamps & show celebration banner
  useEffect(() => {
    if (newlyUnlockedIds.length > 0) {
      const nextState: PersistedSavingsStreakState = {
        ...streakState,
        unlockedAt: updatedUnlockedAt,
      };
      setStreakState(nextState);
      saveSavingsStreakState(nextState);

      const firstNewBadge =
        summary.achievements.find((b) => b.id === newlyUnlockedIds[newlyUnlockedIds.length - 1]) ||
        null;
      if (firstNewBadge) {
        setRecentUnlockToast(firstNewBadge);
      }
    }
  }, [newlyUnlockedIds, updatedUnlockedAt, streakState, summary.achievements]);

  const updateAndPersist = (updater: (prev: PersistedSavingsStreakState) => PersistedSavingsStreakState) => {
    setStreakState((prev) => {
      const next = updater(prev);
      saveSavingsStreakState(next);
      return next;
    });
  };

  const handleModeChange = (mode: StreakTrackingMode) => {
    setIsEditingTarget(false);
    updateAndPersist((prev) => ({
      ...prev,
      mode,
    }));
  };

  const handleAddSavingForDate = (dateKey: string, deltaAmount: number) => {
    if (!Number.isFinite(deltaAmount) || deltaAmount <= 0) return;
    updateAndPersist((prev) => {
      const existing = prev.entries[dateKey];
      const nextAmount = Math.round(((existing?.amount || 0) + deltaAmount) * 100) / 100;
      return {
        ...prev,
        entries: {
          ...prev.entries,
          [dateKey]: {
            date: dateKey,
            amount: nextAmount,
            note: 'Registro diario de ahorro',
            source: 'checkin',
          },
        },
      };
    });
  };

  const handleClearDayEntry = (dateKey: string) => {
    updateAndPersist((prev) => {
      const nextEntries = { ...prev.entries };
      delete nextEntries[dateKey];
      return {
        ...prev,
        entries: nextEntries,
      };
    });
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = Number(customInputAmount);
    if (!Number.isFinite(val) || val <= 0) return;
    const targetDateKey = selectedDayKey || summary.todayDate;
    handleAddSavingForDate(targetDateKey, val);
    setCustomInputAmount('');
  };

  const handleOpenTargetEditor = () => {
    const current = summary.mode === 'weekly' ? summary.weeklyTarget : summary.dailyTarget;
    setTargetInput(String(current));
    setIsEditingTarget((prev) => !prev);
  };

  const handleSaveCustomTarget = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = Math.round(Number(targetInput));
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    updateAndPersist((prev) =>
      prev.mode === 'weekly'
        ? { ...prev, customWeeklyTarget: parsed }
        : { ...prev, customDailyTarget: parsed }
    );
    setIsEditingTarget(false);
  };

  const handleResetTargetDefault = () => {
    const defaults = computeDefaultTargets(profile);
    updateAndPersist((prev) =>
      prev.mode === 'weekly'
        ? { ...prev, customWeeklyTarget: null }
        : { ...prev, customDailyTarget: null }
    );
    setTargetInput(String(summary.mode === 'weekly' ? defaults.weeklyTarget : defaults.dailyTarget));
    setIsEditingTarget(false);
  };

  const activeDayTile =
    summary.last14Days.find((d) => d.date === (selectedDayKey || summary.todayDate)) ||
    summary.last14Days[summary.last14Days.length - 1];

  const cardSurfaceClass = isNitido
    ? 'bg-white border-slate-200 text-slate-900 shadow-xs'
    : isVibrant
    ? 'bg-slate-900/95 border-cyan-500/30 text-slate-100'
    : 'bg-slate-900 border-slate-800 text-slate-100';

  const hairlineBorder = isNitido ? 'border-slate-200/80' : 'border-slate-800';

  return (
    <section
      aria-label="Widget de Racha de Ahorro y Logros"
      className={`rounded-2xl border p-5 sm:p-6 transition-colors ${cardSurfaceClass}`}
    >
      {/* Top Header */}
      <div className={`flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b ${hairlineBorder}`}>
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Flame
              className={`w-5 h-5 shrink-0 ${
                summary.isThreeDayStreakActive
                  ? isNitido
                    ? 'text-amber-600'
                    : 'text-amber-400'
                  : isNitido
                  ? 'text-slate-500'
                  : 'text-slate-400'
              }`}
            />
            <h3 className="text-base sm:text-lg font-bold tracking-tight">
              Racha de Ahorro y Logros
            </h3>
            {summary.isThreeDayStreakActive && (
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border tabular-nums ${
                  isNitido
                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                    : 'bg-amber-500/15 text-amber-300 border-amber-400/35'
                }`}
              >
                Racha activa: {summary.currentStreakDays} días
              </span>
            )}
          </div>
          <p className={`text-xs mt-1 ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
            <span>Desbloquea medallas al cumplir tu meta de ahorro 3+ días consecutivos</span>
            <span aria-hidden="true" className="mx-1.5">·</span>
            <span className="tabular-nums font-semibold">
              {summary.unlockedCount} / {summary.achievements.length} logros desbloqueados
            </span>
          </p>
        </div>

        {/* Mode Switcher & Target Config */}
        <div className="flex flex-wrap items-center gap-2">
          <div
            className={`flex items-center p-1 rounded-lg border ${
              isNitido ? 'bg-slate-100 border-slate-200' : 'bg-slate-800 border-slate-700'
            }`}
          >
            <button
              type="button"
              onClick={() => handleModeChange('daily')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                summary.mode === 'daily'
                  ? isNitido
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'bg-slate-700 text-white'
                  : isNitido
                  ? 'text-slate-600 hover:text-slate-900'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Meta Diaria
            </button>
            <button
              type="button"
              onClick={() => handleModeChange('weekly')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                summary.mode === 'weekly'
                  ? isNitido
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'bg-slate-700 text-white'
                  : isNitido
                  ? 'text-slate-600 hover:text-slate-900'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Meta Semanal
            </button>
          </div>

          <button
            type="button"
            onClick={handleOpenTargetEditor}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border whitespace-nowrap shrink-0 transition-colors tabular-nums ${
              isNitido
                ? 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>
              Objetivo: {currSym}
              {(summary.mode === 'weekly' ? summary.weeklyTarget : summary.dailyTarget).toLocaleString()}
              /{summary.mode === 'weekly' ? 'sem' : 'día'}
            </span>
          </button>
        </div>
      </div>

      {/* Inline Custom Target Editor */}
      {isEditingTarget && (
        <form
          onSubmit={handleSaveCustomTarget}
          className={`mt-4 p-3.5 rounded-xl border flex flex-wrap items-center justify-between gap-3 ${
            isNitido ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/60 border-slate-800'
          }`}
        >
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold">
              Ajustar meta {summary.mode === 'weekly' ? 'semanal' : 'diaria'} ({currSym}):
            </span>
            <input
              type="number"
              min={1}
              step="1"
              value={targetInput}
              onChange={(e) => setTargetInput(e.target.value)}
              aria-label="Monto objetivo de ahorro"
              className={`w-28 px-2.5 py-1.5 rounded-lg border text-xs font-bold tabular-nums focus:outline-none ${
                isNitido
                  ? 'bg-white border-slate-300 text-slate-900'
                  : 'bg-slate-900 border-slate-700 text-white'
              }`}
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetTargetDefault}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border whitespace-nowrap shrink-0 ${
                isNitido
                  ? 'bg-white text-slate-600 border-slate-200 hover:text-slate-900'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
              }`}
            >
              <RotateCcw className="w-3 h-3" />
              <span>Automático ({profile.savingsGoalPercent}%)</span>
            </button>
            <button
              type="submit"
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold whitespace-nowrap shrink-0"
            >
              Guardar
            </button>
          </div>
        </form>
      )}

      {/* Newly Unlocked Achievement Banner */}
      {recentUnlockToast && (
        <div
          role="status"
          className={`mt-4 px-4 py-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
            isNitido
              ? 'bg-amber-50 border-amber-200 text-amber-950'
              : 'bg-amber-950/35 border-amber-500/40 text-amber-100'
          }`}
        >
          <div className="flex items-center gap-2.5 text-xs">
            <Sparkles className={`w-4 h-4 shrink-0 ${isNitido ? 'text-amber-600' : 'text-amber-300'}`} />
            <span>
              <strong>¡Logro desbloqueado!</strong> Obtuviste la insignia{' '}
              <strong>{recentUnlockToast.title}</strong> ({recentUnlockToast.subtitle}).
            </span>
          </div>
          <button
            type="button"
            onClick={() => setRecentUnlockToast(null)}
            className="text-xs font-bold underline self-start sm:self-center whitespace-nowrap shrink-0"
          >
            Entendido
          </button>
        </div>
      )}

      {/* 3-Column Flat Summary Strip */}
      <div className={`grid grid-cols-1 md:grid-cols-3 gap-5 py-5 border-b ${hairlineBorder}`}>
        {/* Column 1: Current & Best Streak */}
        <div className="space-y-1.5">
          <span className={`text-xs block ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
            Racha consecutiva actual
          </span>
          <div className="flex items-baseline gap-2.5">
            <span
              className={`text-2xl sm:text-3xl font-bold tabular-nums ${
                summary.currentStreakDays >= 3
                  ? isNitido
                    ? 'text-amber-600'
                    : 'text-amber-400'
                  : ''
              }`}
            >
              {summary.currentStreakDays} {summary.currentStreakDays === 1 ? 'día' : 'días'}
            </span>
            <span className={`text-xs tabular-nums ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
              Mejor racha: <strong className={isNitido ? 'text-slate-800' : 'text-slate-200'}>{summary.bestStreakDays} días</strong>
            </span>
          </div>
          <p className={`text-[11px] ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
            {summary.todayHit
              ? 'Meta de hoy cumplida. Tu racha sigue sumando.'
              : summary.currentStreakDays > 0
              ? `Registra ${currSym}${Math.max(0, activeDayTile.target - summary.todaySaved).toLocaleString()} hoy para extenderla a ${summary.currentStreakDays + 1} días.`
              : `Ahorra ${currSym}${summary.dailyTarget.toLocaleString()} hoy para iniciar una nueva racha.`}
          </p>
        </div>

        {/* Column 2: Daily or Weekly Target Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className={isNitido ? 'text-slate-500' : 'text-slate-400'}>
              {summary.mode === 'weekly' ? 'Progreso semanal (últimos 7 días)' : 'Progreso de hoy'}
            </span>
            <span className="font-bold tabular-nums">
              {summary.mode === 'weekly' ? summary.weekPercent : summary.todayPercent}%
            </span>
          </div>
          <div className="flex items-baseline gap-1.5 tabular-nums">
            <span className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {currSym}
              {(summary.mode === 'weekly' ? summary.weekSaved : summary.todaySaved).toLocaleString()}
            </span>
            <span className={`text-xs ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
              / {currSym}
              {(summary.mode === 'weekly' ? summary.weeklyTarget : summary.dailyTarget).toLocaleString()}
            </span>
          </div>
          <div className={`h-2 w-full rounded-full overflow-hidden ${isNitido ? 'bg-slate-100' : 'bg-slate-800'}`}>
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-300"
              style={{
                width: `${summary.mode === 'weekly' ? summary.weekPercent : summary.todayPercent}%`,
              }}
            />
          </div>
          <p className={`text-[11px] tabular-nums ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
            Semana acumulada: {currSym}{summary.weekSaved.toLocaleString()} ({summary.weekDaysHit}/7 días cumplidos)
          </p>
        </div>

        {/* Column 3: Next Unlockable Achievement */}
        <div className="space-y-1.5">
          <span className={`text-xs block ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
            Próxima recompensa visual
          </span>
          {summary.nextAchievement ? (
            <>
              <div className="flex items-center gap-2.5">
                {(() => {
                  const NextIcon = BADGE_ICON_MAP[summary.nextAchievement.iconName];
                  return (
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center border shrink-0 ${
                        isNitido
                          ? 'bg-slate-100 border-slate-200 text-slate-700'
                          : 'bg-slate-800 border-slate-700 text-slate-200'
                      }`}
                    >
                      <NextIcon className="w-4 h-4" />
                    </div>
                  );
                })()}
                <div className="min-w-0">
                  <p className="text-sm font-bold truncate">{summary.nextAchievement.title}</p>
                  <p className={`text-[11px] tabular-nums ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
                    Faltan{' '}
                    <strong className={isNitido ? 'text-slate-800' : 'text-slate-200'}>
                      {Math.max(
                        1,
                        summary.nextAchievement.progressTarget - summary.nextAchievement.progressCurrent
                      )}
                    </strong>{' '}
                    días para desbloquear
                  </p>
                </div>
              </div>
              <div className={`h-1.5 w-full rounded-full overflow-hidden mt-2 ${isNitido ? 'bg-slate-100' : 'bg-slate-800'}`}>
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                  style={{ width: `${summary.nextAchievement.progressPercent}%` }}
                />
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 pt-1">
              <Trophy className="w-5 h-5 shrink-0" />
              <span className="text-sm font-bold">¡Todas las insignias desbloqueadas!</span>
            </div>
          )}
        </div>
      </div>

      {/* 14-Day Streak Calendar + Quick Savings Check-In */}
      <div className={`py-5 border-b ${hairlineBorder} space-y-4`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CalendarDays className={`w-4 h-4 ${isNitido ? 'text-slate-500' : 'text-slate-400'}`} />
            <h4 className="text-sm font-bold">Historial de últimos 14 días</h4>
            <span className={`text-[11px] ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
              (haz clic en un día para registrar o ajustar su ahorro)
            </span>
          </div>
          <span className={`text-xs font-semibold tabular-nums ${isNitido ? 'text-slate-600' : 'text-slate-300'}`}>
            Umbral diario: {currSym}{activeDayTile.target.toLocaleString()}/día
          </span>
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
          {summary.last14Days.map((day) => {
            const isSelected = activeDayTile.date === day.date;
            return (
              <button
                key={day.date}
                type="button"
                onClick={() => setSelectedDayKey(day.date)}
                title={`${day.date}: ${currSym}${day.amount.toLocaleString()} ahorrado (meta: ${currSym}${day.target})`}
                className={`p-2 rounded-xl border text-center transition-all flex flex-col items-center gap-1 ${
                  isSelected
                    ? isNitido
                      ? 'ring-2 ring-slate-900 border-slate-900'
                      : 'ring-2 ring-cyan-400 border-cyan-400'
                    : ''
                } ${
                  day.hitTarget
                    ? isNitido
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-emerald-950/40 border-emerald-500/40 text-emerald-100'
                    : day.isToday
                    ? isNitido
                      ? 'bg-amber-50/70 border-amber-300 text-slate-900'
                      : 'bg-amber-950/25 border-amber-500/40 text-slate-100'
                    : isNitido
                    ? 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    : 'bg-slate-800/50 border-slate-800 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <span className="text-[10px] font-bold uppercase tracking-wide">
                  {day.isToday ? 'Hoy' : day.dayShort}
                </span>
                <span className="text-xs font-bold tabular-nums">{day.dayNumber}</span>
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center ${
                    day.hitTarget
                      ? 'bg-emerald-600 text-white'
                      : isNitido
                      ? 'bg-slate-200 text-slate-500'
                      : 'bg-slate-700 text-slate-400'
                  }`}
                >
                  {day.hitTarget ? (
                    <Check className="w-3 h-3" />
                  ) : (
                    <span className="text-[9px] font-bold tabular-nums">
                      {day.amount > 0 ? `${day.percent}%` : '–'}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Quick Check-in Controls for Selected Day (Defaults to Today) */}
        <div
          className={`p-3.5 rounded-xl border flex flex-col xl:flex-row xl:items-center justify-between gap-3 ${
            isNitido ? 'bg-slate-50/80 border-slate-200' : 'bg-slate-950/50 border-slate-800'
          }`}
        >
          <div className="text-xs">
            <span className={`font-bold ${isNitido ? 'text-slate-900' : 'text-white'}`}>
              {activeDayTile.isToday ? 'Ahorro de hoy' : `Registro del ${activeDayTile.date}`}:
            </span>{' '}
            <span className="font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              {currSym}{activeDayTile.amount.toLocaleString()}
            </span>{' '}
            <span className={`tabular-nums ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
              / {currSym}{activeDayTile.target.toLocaleString()} ({activeDayTile.hitTarget ? 'Meta cumplida' : 'Pendiente'})
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleAddSavingForDate(activeDayTile.date, activeDayTile.target)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold tabular-nums whitespace-nowrap shrink-0 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Meta diaria ({currSym}{activeDayTile.target})</span>
            </button>

            {[25, 50].map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => handleAddSavingForDate(activeDayTile.date, amt)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold tabular-nums border whitespace-nowrap shrink-0 transition-colors ${
                  isNitido
                    ? 'bg-white hover:bg-emerald-50 text-slate-800 border-slate-200 hover:border-emerald-300'
                    : 'bg-slate-800 hover:bg-emerald-950/60 text-slate-200 border-slate-700 hover:border-emerald-500/40'
                }`}
              >
                +{currSym}{amt}
              </button>
            ))}

            <form onSubmit={handleCustomSubmit} className="flex items-center gap-1.5">
              <input
                type="number"
                min={1}
                step="any"
                value={customInputAmount}
                onChange={(e) => setCustomInputAmount(e.target.value)}
                placeholder={`Otro (${currSym})`}
                aria-label="Registrar monto ahorrado en el día"
                className={`w-24 px-2.5 py-1.5 rounded-lg border text-xs tabular-nums focus:outline-none ${
                  isNitido
                    ? 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400'
                    : 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500'
                }`}
              />
              <button
                type="submit"
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 border transition-colors ${
                  isNitido
                    ? 'bg-slate-900 hover:bg-slate-800 text-white border-slate-900'
                    : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 border-cyan-400'
                }`}
              >
                Registrar
              </button>
            </form>

            {activeDayTile.amount > 0 && (
              <button
                type="button"
                onClick={() => handleClearDayEntry(activeDayTile.date)}
                title="Limpiar registro de este día"
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border whitespace-nowrap shrink-0 transition-colors ${
                  isNitido
                    ? 'bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-700 border-slate-200'
                    : 'bg-slate-800 hover:bg-rose-950/40 text-slate-300 hover:text-rose-300 border-slate-700'
                }`}
              >
                Limpiar día
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Visual Achievements & Badges Grid */}
      <div className="pt-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-bold flex items-center gap-2">
            <Award className={`w-4 h-4 ${isNitido ? 'text-amber-600' : 'text-amber-400'}`} />
            <span>Insignias y Logros por Constancia</span>
          </h4>
          <span className={`text-xs font-semibold tabular-nums ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
            {summary.unlockedCount} de {summary.achievements.length} ganadas
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {summary.achievements.map((badge) => {
            const IconComp = BADGE_ICON_MAP[badge.iconName];
            const styles = BADGE_STYLE_MAP[badge.accent];

            return (
              <div
                key={badge.id}
                className={`p-4 rounded-xl border transition-colors flex flex-col justify-between gap-3 ${
                  badge.unlocked
                    ? isNitido
                      ? styles.lightCard
                      : styles.darkCard
                    : isNitido
                    ? 'bg-slate-50/60 border-slate-200 text-slate-600'
                    : 'bg-slate-950/40 border-slate-800 text-slate-400'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${
                      badge.unlocked
                        ? isNitido
                          ? styles.lightIcon
                          : styles.darkIcon
                        : isNitido
                        ? 'bg-slate-100 border-slate-200 text-slate-400'
                        : 'bg-slate-800 border-slate-700 text-slate-500'
                    }`}
                  >
                    <IconComp className="w-5 h-5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h5
                        className={`text-xs font-bold truncate ${
                          badge.unlocked
                            ? isNitido
                              ? 'text-slate-900'
                              : 'text-white'
                            : isNitido
                            ? 'text-slate-700'
                            : 'text-slate-300'
                        }`}
                      >
                        {badge.title}
                      </h5>
                      {badge.unlocked ? (
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-bold whitespace-nowrap shrink-0 ${
                            isNitido ? styles.labelLight : styles.labelDark
                          }`}
                        >
                          <Check className="w-3 h-3" />
                          Logrado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold whitespace-nowrap shrink-0 opacity-75">
                          <Lock className="w-3 h-3" />
                          Bloqueado
                        </span>
                      )}
                    </div>

                    <p
                      className={`text-[11px] font-semibold mt-0.5 ${
                        badge.unlocked
                          ? isNitido
                            ? styles.labelLight
                            : styles.labelDark
                          : isNitido
                          ? 'text-slate-500'
                          : 'text-slate-400'
                      }`}
                    >
                      {badge.subtitle}
                    </p>
                    <p className={`text-[11px] mt-1 leading-relaxed ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
                      {badge.description}
                    </p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-semibold tabular-nums">
                    <span>
                      {badge.kind === 'weekly_target'
                        ? `${currSym}${badge.progressCurrent.toLocaleString()} / ${currSym}${badge.progressTarget.toLocaleString()}`
                        : `${badge.progressCurrent} / ${badge.progressTarget} días`}
                    </span>
                    <span>
                      {badge.unlocked && badge.unlockedDate
                        ? `Obtenido: ${badge.unlockedDate}`
                        : `${badge.progressPercent}%`}
                    </span>
                  </div>
                  <div
                    className={`h-1.5 w-full rounded-full overflow-hidden ${
                      isNitido ? 'bg-slate-200/80' : 'bg-slate-800'
                    }`}
                  >
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        badge.unlocked
                          ? styles.barColor
                          : isNitido
                          ? 'bg-slate-400'
                          : 'bg-slate-600'
                      }`}
                      style={{ width: `${badge.progressPercent}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
