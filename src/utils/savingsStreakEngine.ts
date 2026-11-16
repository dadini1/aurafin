import { UserFinancialProfile } from '../types';

export type StreakTrackingMode = 'daily' | 'weekly';

export interface DailySavingEntry {
  date: string; // YYYY-MM-DD (local date)
  amount: number;
  note?: string;
  source?: 'checkin' | 'goal_deposit' | 'seed';
}

export interface PersistedSavingsStreakState {
  mode: StreakTrackingMode;
  customDailyTarget: number | null;
  customWeeklyTarget: number | null;
  entries: Record<string, DailySavingEntry>; // keyed by YYYY-MM-DD
  unlockedAt: Record<string, string>; // badgeId -> ISO date unlocked
}

export interface AchievementBadge {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  requiredDays: number;
  kind: 'streak' | 'weekly_target';
  iconName: 'flame' | 'zap' | 'award' | 'star' | 'shield' | 'trophy';
  accent: 'amber' | 'cyan' | 'emerald' | 'teal' | 'indigo' | 'violet';
  unlocked: boolean;
  unlockedDate?: string;
  progressCurrent: number;
  progressTarget: number;
  progressPercent: number;
}

export interface DayStreakTile {
  date: string;
  dayShort: string;
  dayNumber: string;
  isToday: boolean;
  amount: number;
  target: number;
  hitTarget: boolean;
  percent: number;
}

export interface SavingsStreakSummary {
  mode: StreakTrackingMode;
  dailyTarget: number;
  weeklyTarget: number;
  activeTarget: number;
  todayDate: string;
  todaySaved: number;
  todayHit: boolean;
  todayPercent: number;
  weekSaved: number;
  weekDaysHit: number;
  weekPercent: number;
  weeklyTargetHit: boolean;
  currentStreakDays: number;
  bestStreakDays: number;
  consecutiveWeeksHit: number;
  isThreeDayStreakActive: boolean;
  last14Days: DayStreakTile[];
  achievements: AchievementBadge[];
  unlockedCount: number;
  nextAchievement: AchievementBadge | null;
}

const STORAGE_KEY = 'aurafin_savings_streak_v1';
export const STREAK_UPDATED_EVENT = 'aurafin-savings-streak-updated';

export function formatLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getOffsetDateKey(daysOffset: number, baseDate: Date = new Date()): string {
  const d = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
  d.setDate(d.getDate() + daysOffset);
  return formatLocalDateKey(d);
}

export function computeDefaultTargets(profile: UserFinancialProfile): {
  dailyTarget: number;
  weeklyTarget: number;
} {
  const monthlyIncome = Math.max(0, Number(profile.monthlyIncome) || 2400);
  const savingsPct = Math.max(5, Math.min(80, Number(profile.savingsGoalPercent) || 20));
  const monthlyGoal = Math.round((monthlyIncome * savingsPct) / 100);
  const dailyTarget = Math.max(10, Math.round(monthlyGoal / 30));
  const weeklyTarget = Math.max(50, dailyTarget * 7);
  return { dailyTarget, weeklyTarget };
}

function createInitialSeedState(profile: UserFinancialProfile): PersistedSavingsStreakState {
  const { dailyTarget } = computeDefaultTargets(profile);
  const today = new Date();

  // Seed 3 consecutive days ending yesterday so the 3+ consecutive days achievement
  // is visibly demonstrated out of the box, while Today remains ready for check-in to reach 4+ days.
  const entries: Record<string, DailySavingEntry> = {};
  const seedOffsets: Array<{ offset: number; multiplier: number; note: string }> = [
    { offset: -10, multiplier: 1.1, note: 'Ahorro diario cumplido' },
    { offset: -9, multiplier: 1.0, note: 'Ahorro diario cumplido' },
    { offset: -6, multiplier: 1.25, note: 'Transferencia a meta' },
    { offset: -3, multiplier: 1.15, note: 'Día bajo presupuesto' },
    { offset: -2, multiplier: 1.3, note: 'Aporte a fondo de emergencia' },
    { offset: -1, multiplier: 1.05, note: 'Ahorro diario cumplido' },
  ];

  for (const s of seedOffsets) {
    const key = getOffsetDateKey(s.offset, today);
    entries[key] = {
      date: key,
      amount: Math.max(10, Math.round(dailyTarget * s.multiplier)),
      note: s.note,
      source: 'seed',
    };
  }

  return {
    mode: 'daily',
    customDailyTarget: null,
    customWeeklyTarget: null,
    entries,
    unlockedAt: {
      'chispa-3': getOffsetDateKey(-1, today),
    },
  };
}

export function loadSavingsStreakState(profile: UserFinancialProfile): PersistedSavingsStreakState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seeded = createInitialSeedState(profile);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
      return seeded;
    }
    const parsed = JSON.parse(raw) as Partial<PersistedSavingsStreakState>;
    return {
      mode: parsed.mode === 'weekly' ? 'weekly' : 'daily',
      customDailyTarget:
        typeof parsed.customDailyTarget === 'number' && parsed.customDailyTarget > 0
          ? parsed.customDailyTarget
          : null,
      customWeeklyTarget:
        typeof parsed.customWeeklyTarget === 'number' && parsed.customWeeklyTarget > 0
          ? parsed.customWeeklyTarget
          : null,
      entries: parsed.entries && typeof parsed.entries === 'object' ? parsed.entries : {},
      unlockedAt: parsed.unlockedAt && typeof parsed.unlockedAt === 'object' ? parsed.unlockedAt : {},
    };
  } catch {
    return createInitialSeedState(profile);
  }
}

export function saveSavingsStreakState(state: PersistedSavingsStreakState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage quota errors
  }
}

export function recordGoalDepositToStreak(
  depositAmount: number,
  profile: UserFinancialProfile,
  note = 'Abono a meta de ahorro'
): void {
  if (!Number.isFinite(depositAmount) || depositAmount <= 0) return;
  const state = loadSavingsStreakState(profile);
  const todayKey = getOffsetDateKey(0);
  const existing = state.entries[todayKey];
  const nextAmount = Math.round(((existing?.amount || 0) + depositAmount) * 100) / 100;

  const nextState: PersistedSavingsStreakState = {
    ...state,
    entries: {
      ...state.entries,
      [todayKey]: {
        date: todayKey,
        amount: nextAmount,
        note,
        source: 'goal_deposit',
      },
    },
  };

  saveSavingsStreakState(nextState);
  window.dispatchEvent(new CustomEvent(STREAK_UPDATED_EVENT));
}

function getEffectiveDailyThreshold(
  state: PersistedSavingsStreakState,
  dailyTarget: number,
  weeklyTarget: number
): number {
  if (state.mode === 'weekly') {
    return Math.max(1, Math.round(weeklyTarget / 7));
  }
  return Math.max(1, dailyTarget);
}

export function computeSavingsStreakSummary(
  state: PersistedSavingsStreakState,
  profile: UserFinancialProfile,
  referenceDate: Date = new Date()
): { summary: SavingsStreakSummary; newlyUnlockedIds: string[]; updatedUnlockedAt: Record<string, string> } {
  const defaults = computeDefaultTargets(profile);
  const dailyTarget = state.customDailyTarget ?? defaults.dailyTarget;
  const weeklyTarget = state.customWeeklyTarget ?? defaults.weeklyTarget;
  const effectiveDailyThreshold = getEffectiveDailyThreshold(state, dailyTarget, weeklyTarget);
  const activeTarget = state.mode === 'weekly' ? weeklyTarget : dailyTarget;

  const todayKey = formatLocalDateKey(referenceDate);
  const todaySaved = Math.max(0, Number(state.entries[todayKey]?.amount) || 0);
  const todayHit = todaySaved >= effectiveDailyThreshold;
  const todayPercent = Math.min(100, Math.round((todaySaved / effectiveDailyThreshold) * 100));

  // Compute current consecutive day streak:
  // If today already hits the target, count backwards from today (offset 0, -1, -2, ...).
  // Otherwise, check if yesterday (offset -1, -2, ...) is an active unbroken streak still alive for today.
  let currentStreakDays = 0;
  const startOffset = todayHit ? 0 : -1;
  for (let offset = startOffset; offset >= -365; offset--) {
    const key = getOffsetDateKey(offset, referenceDate);
    const saved = Number(state.entries[key]?.amount) || 0;
    if (saved >= effectiveDailyThreshold) {
      currentStreakDays += 1;
    } else {
      break;
    }
  }

  // Compute best streak across all recorded dates (up to 365 days window)
  let bestStreakDays = currentStreakDays;
  let running = 0;
  for (let offset = -365; offset <= 0; offset++) {
    const key = getOffsetDateKey(offset, referenceDate);
    const saved = Number(state.entries[key]?.amount) || 0;
    if (saved >= effectiveDailyThreshold) {
      running += 1;
      if (running > bestStreakDays) bestStreakDays = running;
    } else {
      running = 0;
    }
  }

  // Current 7-day rolling week (last 7 days including today)
  let weekSaved = 0;
  let weekDaysHit = 0;
  for (let offset = -6; offset <= 0; offset++) {
    const key = getOffsetDateKey(offset, referenceDate);
    const saved = Math.max(0, Number(state.entries[key]?.amount) || 0);
    weekSaved += saved;
    if (saved >= effectiveDailyThreshold) {
      weekDaysHit += 1;
    }
  }
  const weekPercent = Math.min(100, Math.round((weekSaved / Math.max(1, weeklyTarget)) * 100));
  const weeklyTargetHit = weekSaved >= weeklyTarget;

  // Consecutive 7-day windows meeting weeklyTarget
  let consecutiveWeeksHit = 0;
  for (let w = 0; w < 12; w++) {
    let wTotal = 0;
    for (let d = 0; d < 7; d++) {
      const key = getOffsetDateKey(-(w * 7 + d), referenceDate);
      wTotal += Math.max(0, Number(state.entries[key]?.amount) || 0);
    }
    if (wTotal >= weeklyTarget) {
      consecutiveWeeksHit += 1;
    } else {
      break;
    }
  }

  // Build 14-day interactive timeline (oldest -> newest ending today)
  const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const last14Days: DayStreakTile[] = [];
  for (let offset = -13; offset <= 0; offset++) {
    const d = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
    d.setDate(d.getDate() + offset);
    const key = formatLocalDateKey(d);
    const saved = Math.max(0, Number(state.entries[key]?.amount) || 0);
    last14Days.push({
      date: key,
      dayShort: dayNames[d.getDay()],
      dayNumber: String(d.getDate()).padStart(2, '0'),
      isToday: offset === 0,
      amount: saved,
      target: effectiveDailyThreshold,
      hitTarget: saved >= effectiveDailyThreshold,
      percent: Math.min(100, Math.round((saved / effectiveDailyThreshold) * 100)),
    });
  }

  const badgeSpecs: Array<{
    id: string;
    title: string;
    subtitle: string;
    description: string;
    requiredDays: number;
    kind: 'streak' | 'weekly_target';
    iconName: AchievementBadge['iconName'];
    accent: AchievementBadge['accent'];
    isConditionMet: boolean;
    progressCurrent: number;
    progressTarget: number;
  }> = [
    {
      id: 'chispa-3',
      title: 'Chispa de 3 Días',
      subtitle: '3+ días consecutivos',
      description: 'Cumple tu meta diaria de ahorro durante 3 días seguidos.',
      requiredDays: 3,
      kind: 'streak',
      iconName: 'flame',
      accent: 'amber',
      isConditionMet: bestStreakDays >= 3 || currentStreakDays >= 3,
      progressCurrent: Math.min(3, Math.max(currentStreakDays, bestStreakDays)),
      progressTarget: 3,
    },
    {
      id: 'impulso-5',
      title: 'Impulso Constante',
      subtitle: '5 días consecutivos',
      description: 'Mantén tu racha activa por 5 días consecutivos sin fallar.',
      requiredDays: 5,
      kind: 'streak',
      iconName: 'zap',
      accent: 'cyan',
      isConditionMet: bestStreakDays >= 5 || currentStreakDays >= 5,
      progressCurrent: Math.min(5, Math.max(currentStreakDays, bestStreakDays)),
      progressTarget: 5,
    },
    {
      id: 'semana-7',
      title: 'Semana Invicta',
      subtitle: '7 días consecutivos',
      description: 'Completa una semana completa (7 días seguidos) alcanzando tu meta.',
      requiredDays: 7,
      kind: 'streak',
      iconName: 'award',
      accent: 'emerald',
      isConditionMet: bestStreakDays >= 7 || currentStreakDays >= 7,
      progressCurrent: Math.min(7, Math.max(currentStreakDays, bestStreakDays)),
      progressTarget: 7,
    },
    {
      id: 'meta-semanal',
      title: 'Meta Semanal 100%',
      subtitle: 'Objetivo semanal',
      description: 'Alcanza el 100% de tu meta de ahorro semanal acumulada.',
      requiredDays: 7,
      kind: 'weekly_target',
      iconName: 'star',
      accent: 'teal',
      isConditionMet: weeklyTargetHit || Boolean(state.unlockedAt['meta-semanal']),
      progressCurrent: Math.min(weeklyTarget, Math.round(weekSaved)),
      progressTarget: weeklyTarget,
    },
    {
      id: 'acero-14',
      title: 'Hábito de Acero',
      subtitle: '14 días consecutivos',
      description: 'Sostén tu disciplina financiera durante 2 semanas consecutivas.',
      requiredDays: 14,
      kind: 'streak',
      iconName: 'shield',
      accent: 'indigo',
      isConditionMet: bestStreakDays >= 14 || currentStreakDays >= 14,
      progressCurrent: Math.min(14, Math.max(currentStreakDays, bestStreakDays)),
      progressTarget: 14,
    },
    {
      id: 'maestro-30',
      title: 'Maestro del Ahorro',
      subtitle: '30 días consecutivos',
      description: 'Un mes entero cumpliendo metas diarias de ahorro consecutivas.',
      requiredDays: 30,
      kind: 'streak',
      iconName: 'trophy',
      accent: 'violet',
      isConditionMet: bestStreakDays >= 30 || currentStreakDays >= 30,
      progressCurrent: Math.min(30, Math.max(currentStreakDays, bestStreakDays)),
      progressTarget: 30,
    },
  ];

  const updatedUnlockedAt = { ...state.unlockedAt };
  const newlyUnlockedIds: string[] = [];

  const achievements: AchievementBadge[] = badgeSpecs.map((spec) => {
    const previouslyUnlocked = Boolean(updatedUnlockedAt[spec.id]);
    const unlocked = previouslyUnlocked || spec.isConditionMet;
    if (unlocked && !previouslyUnlocked) {
      updatedUnlockedAt[spec.id] = todayKey;
      newlyUnlockedIds.push(spec.id);
    }

    return {
      id: spec.id,
      title: spec.title,
      subtitle: spec.subtitle,
      description: spec.description,
      requiredDays: spec.requiredDays,
      kind: spec.kind,
      iconName: spec.iconName,
      accent: spec.accent,
      unlocked,
      unlockedDate: updatedUnlockedAt[spec.id],
      progressCurrent: unlocked ? spec.progressTarget : spec.progressCurrent,
      progressTarget: spec.progressTarget,
      progressPercent: unlocked
        ? 100
        : Math.min(100, Math.round((spec.progressCurrent / Math.max(1, spec.progressTarget)) * 100)),
    };
  });

  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const nextAchievement =
    achievements.find((a) => !a.unlocked && a.kind === 'streak') ||
    achievements.find((a) => !a.unlocked) ||
    null;

  return {
    summary: {
      mode: state.mode,
      dailyTarget,
      weeklyTarget,
      activeTarget,
      todayDate: todayKey,
      todaySaved,
      todayHit,
      todayPercent,
      weekSaved,
      weekDaysHit,
      weekPercent,
      weeklyTargetHit,
      currentStreakDays,
      bestStreakDays,
      consecutiveWeeksHit,
      isThreeDayStreakActive: currentStreakDays >= 3,
      last14Days,
      achievements,
      unlockedCount,
      nextAchievement,
    },
    newlyUnlockedIds,
    updatedUnlockedAt,
  };
}
