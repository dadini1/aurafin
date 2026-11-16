import {
  PaymentItem,
  UserFinancialProfile,
  NotificationPreferences,
  AlertPriorityLevel,
  QuietHoursBlock,
} from '../types';
import { DEFAULT_NOTIFICATION_PREFERENCES } from '../data/mockDeviceData';

export interface ProactiveNotificationItem {
  id: string;
  title: string;
  body: string;
  type: 'payment_reminder' | 'budget_warning' | 'test';
  priority?: AlertPriorityLevel;
  suppressedByDnd?: boolean;
  suppressedReason?: string;
  timestamp: string;
  tag: string;
  url?: string;
  tab?: 'notes' | 'finances' | 'radar' | 'gallery';
}

export const NOTIFICATION_PREFS_KEY = 'aurafin_notification_preferences';
export const DND_QUEUE_KEY = 'aurafin_dnd_queued_notifications';

export const PRIORITY_RANK: Record<AlertPriorityLevel, number> = {
  baja: 1,
  media: 2,
  alta: 3,
  critica: 4,
};

export const loadNotificationPreferences = (): NotificationPreferences => {
  try {
    const raw = localStorage.getItem(NOTIFICATION_PREFS_KEY);
    if (!raw) return DEFAULT_NOTIFICATION_PREFERENCES;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      ...parsed,
      quietSchedules: Array.isArray(parsed.quietSchedules)
        ? parsed.quietSchedules
        : DEFAULT_NOTIFICATION_PREFERENCES.quietSchedules,
      expenseRules: Array.isArray(parsed.expenseRules)
        ? parsed.expenseRules
        : DEFAULT_NOTIFICATION_PREFERENCES.expenseRules,
      categoryPriorities: {
        ...DEFAULT_NOTIFICATION_PREFERENCES.categoryPriorities,
        ...(parsed.categoryPriorities || {}),
      },
    };
  } catch {
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }
};

export const saveNotificationPreferences = (prefs: NotificationPreferences): void => {
  try {
    localStorage.setItem(NOTIFICATION_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // ignore storage quota errors
  }
};

export const getQueuedDndNotifications = (): ProactiveNotificationItem[] => {
  try {
    const raw = localStorage.getItem(DND_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const queueDndNotification = (item: ProactiveNotificationItem): void => {
  try {
    const existing = getQueuedDndNotifications();
    const updated = [item, ...existing.filter((x) => x.tag !== item.tag)].slice(0, 30);
    localStorage.setItem(DND_QUEUE_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
};

export const clearQueuedDndNotifications = (): void => {
  try {
    localStorage.removeItem(DND_QUEUE_KEY);
  } catch {
    // ignore
  }
};

const timeToMinutes = (hhmm: string): number => {
  const [h, m] = (hhmm || '00:00').split(':').map(Number);
  return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
};

/**
 * Determines whether a given Date falls inside any active Quiet Hours ("No Molestar") schedule.
 */
export const isWithinQuietHours = (
  prefs: NotificationPreferences,
  now: Date = new Date()
): { isDnd: boolean; activeBlock?: QuietHoursBlock } => {
  if (!prefs.dndMasterEnabled) {
    return { isDnd: false };
  }

  const currentDay = now.getDay(); // 0 (Dom) - 6 (Sab)
  const prevDay = (currentDay + 6) % 7;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  for (const block of prefs.quietSchedules) {
    if (!block.enabled) continue;
    const startMin = timeToMinutes(block.startTime);
    const endMin = timeToMinutes(block.endTime);

    if (startMin === endMin) {
      // 24h block if enabled on today
      if (block.days.includes(currentDay)) {
        return { isDnd: true, activeBlock: block };
      }
      continue;
    }

    if (startMin < endMin) {
      // Same-day range, e.g., 09:00 - 18:00
      if (block.days.includes(currentDay) && currentMinutes >= startMin && currentMinutes < endMin) {
        return { isDnd: true, activeBlock: block };
      }
    } else {
      // Overnight range, e.g., 22:00 - 07:00
      const inEveningPart = block.days.includes(currentDay) && currentMinutes >= startMin;
      const inMorningPart = block.days.includes(prevDay) && currentMinutes < endMin;
      if (inEveningPart || inMorningPart) {
        return { isDnd: true, activeBlock: block };
      }
    }
  }

  return { isDnd: false };
};

export interface DeliveryEvaluation {
  allow: boolean;
  effectivePriority: AlertPriorityLevel;
  suppressedByDnd: boolean;
  queuedForDigest: boolean;
  reason: string;
}

/**
 * Evaluates whether an automated expense notification should be delivered right now,
 * silenced/queued during DND, or ignored due to priority/amount filters.
 */
export const evaluateNotificationDelivery = (
  ruleId: string,
  category: string | undefined,
  amount: number | undefined,
  prefs: NotificationPreferences,
  now: Date = new Date()
): DeliveryEvaluation => {
  const rule = prefs.expenseRules.find((r) => r.id === ruleId);
  if (rule && !rule.enabled) {
    return {
      allow: false,
      effectivePriority: rule.priority,
      suppressedByDnd: false,
      queuedForDigest: false,
      reason: `Regla "${rule.label}" desactivada por el usuario.`,
    };
  }

  if (rule && rule.minAmountThreshold > 0 && amount !== undefined && amount < rule.minAmountThreshold) {
    return {
      allow: false,
      effectivePriority: rule.priority,
      suppressedByDnd: false,
      queuedForDigest: false,
      reason: `Monto menor al mínimo configurado (${rule.minAmountThreshold}).`,
    };
  }

  const rulePriority: AlertPriorityLevel = rule?.priority || 'media';
  const catPriority: AlertPriorityLevel | undefined = category ? prefs.categoryPriorities[category] : undefined;

  // Combine rule priority and category priority:
  // If category is explicitly 'baja' and rule isn't 'critica', respect lower urgency;
  // If either is 'critica', keep higher urgency unless rule itself is 'baja'.
  let effectivePriority: AlertPriorityLevel = rulePriority;
  if (catPriority) {
    if (rulePriority === 'critica' || catPriority === 'critica') {
      effectivePriority = rulePriority === 'baja' ? 'media' : 'critica';
    } else {
      effectivePriority = PRIORITY_RANK[catPriority] > PRIORITY_RANK[rulePriority] ? catPriority : rulePriority;
    }
  }

  // Check global minimum priority filter
  if (PRIORITY_RANK[effectivePriority] < PRIORITY_RANK[prefs.minimumActivePriority]) {
    return {
      allow: false,
      effectivePriority,
      suppressedByDnd: false,
      queuedForDigest: false,
      reason: `Prioridad "${effectivePriority}" inferior al filtro mínimo ("${prefs.minimumActivePriority}").`,
    };
  }

  // Check Quiet Hours ("No Molestar")
  const dndStatus = isWithinQuietHours(prefs, now);
  if (dndStatus.isDnd && dndStatus.activeBlock) {
    const canOverride = dndStatus.activeBlock.allowCriticalOverride && effectivePriority === 'critica';
    if (!canOverride) {
      return {
        allow: false,
        effectivePriority,
        suppressedByDnd: true,
        queuedForDigest: prefs.digestModeDuringDnd,
        reason: `Pausada por horario "No Molestar": ${dndStatus.activeBlock.name} (${dndStatus.activeBlock.startTime}–${dndStatus.activeBlock.endTime}).`,
      };
    }
    return {
      allow: true,
      effectivePriority,
      suppressedByDnd: false,
      queuedForDigest: false,
      reason: `Excepción crítica permitida durante "${dndStatus.activeBlock.name}".`,
    };
  }

  return {
    allow: true,
    effectivePriority,
    suppressedByDnd: false,
    queuedForDigest: false,
    reason: `Permitida en horario activo (Prioridad: ${effectivePriority}).`,
  };
};

let swRegistration: ServiceWorkerRegistration | null = null;

/**
 * Check if the browser supports standard Web Notifications
 */
export const isNotificationSupported = (): boolean => {
  return typeof window !== 'undefined' && 'Notification' in window;
};

/**
 * Check if Service Worker is supported
 */
export const isServiceWorkerSupported = (): boolean => {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator;
};

/**
 * Current notification permission status
 */
export const getNotificationPermission = (): NotificationPermission | 'unsupported' => {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
};

/**
 * Register Service Worker for background capabilities and push events
 */
export const registerServiceWorker = async (): Promise<ServiceWorkerRegistration | null> => {
  if (!isServiceWorkerSupported()) {
    console.warn('[AuraFin Push] Service Worker no es soportado en este navegador.');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });
    swRegistration = registration;
    console.log('[AuraFin Push] Service Worker registrado exitosamente:', registration.scope);
    return registration;
  } catch (error) {
    console.error('[AuraFin Push] Error al registrar Service Worker:', error);
    return null;
  }
};

/**
 * Request user permission for Web Push & System Notifications
 */
export const requestNotificationPermission = async (): Promise<NotificationPermission> => {
  if (!isNotificationSupported()) {
    return 'denied';
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted' && isServiceWorkerSupported()) {
      await registerServiceWorker();
    }
    return permission;
  } catch (error) {
    console.error('[AuraFin Push] Error al solicitar permiso:', error);
    return 'denied';
  }
};

export interface ExtendedNotificationOptions extends NotificationOptions {
  renotify?: boolean;
  vibrate?: number[];
  data?: any;
  actions?: Array<{ action: string; title: string; icon?: string }>;
}

/**
 * Send an immediate native Web / System Notification
 */
export const sendSystemNotification = async (
  title: string,
  options: ExtendedNotificationOptions = {}
): Promise<boolean> => {
  if (!isNotificationSupported()) return false;
  if (Notification.permission !== 'granted') return false;

  const defaultOptions: ExtendedNotificationOptions = {
    icon: '/icon.svg',
    badge: '/icon.svg',
    tag: options.tag || 'aurafin-notification',
    renotify: true,
    ...options,
  };

  try {
    // 1. Try via Service Worker registration (Works in background & minimized tabs)
    if (swRegistration && 'showNotification' in swRegistration) {
      await (swRegistration as any).showNotification(title, defaultOptions);
      return true;
    }

    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg && 'showNotification' in reg) {
      await (reg as any).showNotification(title, defaultOptions);
      return true;
    }

    // 2. Fallback to standard window Notification
    new Notification(title, defaultOptions);
    return true;
  } catch (err) {
    console.warn('[AuraFin Push] Error enviando notificación:', err);
    try {
      new Notification(title, defaultOptions);
      return true;
    } catch {
      return false;
    }
  }
};

/**
 * Schedule a background notification using the Service Worker message channel
 * Even if the user switches tabs or minimizes the browser, the SW timer will trigger!
 */
export const scheduleBackgroundNotification = async (
  title: string,
  options: ExtendedNotificationOptions,
  delayMs: number
): Promise<boolean> => {
  if (!isNotificationSupported() || Notification.permission !== 'granted') {
    return false;
  }

  const payload = {
    type: 'SCHEDULE_NOTIFICATION',
    title,
    options: {
      icon: '/icon.svg',
      badge: '/icon.svg',
      ...options,
    },
    delayMs,
  };

  // Dispatch to active Service Worker controller
  if (navigator.serviceWorker && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage(payload);
  } else if (swRegistration && swRegistration.active) {
    swRegistration.active.postMessage(payload);
  }

  // Also set a client timer fallback in case SW message was queued
  setTimeout(() => {
    sendSystemNotification(title, options);
  }, delayMs);

  return true;
};

/**
 * Send a quick test notification delayed by N seconds to test minimizing the app
 */
export const testBackgroundNotification = async (delaySeconds = 3): Promise<boolean> => {
  const perm = await requestNotificationPermission();
  if (perm !== 'granted') return false;

  return scheduleBackgroundNotification(
    '✨ AuraFin AI: Notificación en Segundo Plano',
    {
      body: `¡Excelente! El asistente virtual puede enviarte alertas proactivas de pagos próximos y presupuesto excedido incluso con la app minimizada.`,
      tag: 'test-notification-' + Date.now(),
      data: { url: '/', tab: 'finances' },
    },
    delaySeconds * 1000
  );
};

// Internal key for deduplicating proactive notifications within 3 hours
const getDedupeKey = (tag: string) => `aurafin_notif_sent_${tag}`;
const isRecentlySent = (tag: string, cooldownHours = 3): boolean => {
  try {
    const raw = localStorage.getItem(getDedupeKey(tag));
    if (!raw) return false;
    const sentTime = parseInt(raw, 10);
    const diffHours = (Date.now() - sentTime) / (1000 * 60 * 60);
    return diffHours < cooldownHours;
  } catch {
    return false;
  }
};
const markAsSent = (tag: string) => {
  try {
    localStorage.setItem(getDedupeKey(tag), Date.now().toString());
  } catch {
    // Ignore storage errors
  }
};

/**
 * Scans payments and category budgets to generate and trigger proactive notifications
 */
export const checkAndTriggerProactiveAlerts = async (
  payments: PaymentItem[],
  categoryBudgets: Record<string, number>,
  profile: UserFinancialProfile,
  onNotificationSent?: (notif: ProactiveNotificationItem) => void,
  alertThresholds: Record<string, number> = {},
  globalAlertThreshold: number = 80,
  preferences?: NotificationPreferences
): Promise<ProactiveNotificationItem[]> => {
  if (getNotificationPermission() !== 'granted') {
    return [];
  }

  const prefs = preferences || loadNotificationPreferences();
  const enablePayments = localStorage.getItem('aurafin_notify_payments') !== 'false';
  const enableBudgets = localStorage.getItem('aurafin_notify_budgets') !== 'false';

  const triggered: ProactiveNotificationItem[] = [];
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  // 1. Check Upcoming & Overdue Pending Payments
  if (enablePayments) {
    for (const payment of payments) {
      if (payment.status !== 'pendiente' || payment.type !== 'gasto') continue;

      const [year, month, day] = payment.dueDate.split('-').map(Number);
      const dueDate = new Date(year, (month || 1) - 1, day || 1);
      dueDate.setHours(0, 0, 0, 0);

      const diffDays = Math.round((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const tag = `payment-${payment.id}-${payment.dueDate}`;

      let ruleId = '';
      let title = '';
      let body = '';

      if (diffDays < 0) {
        ruleId = 'payment_overdue';
        title = `🚨 Pago Vencido: ${payment.title}`;
        body = `El pago de ${profile.currencySymbol}${payment.amount.toLocaleString()} venció hace ${Math.abs(diffDays)} día(s). Recuerda regularizarlo.`;
      } else if (diffDays === 0) {
        ruleId = 'payment_due_today';
        title = `📅 Pago Pendiente Hoy: ${payment.title}`;
        body = `Tu pago de ${profile.currencySymbol}${payment.amount.toLocaleString()} vence hoy. ¡Mantén tu récord financiero al día!`;
      } else if (diffDays === 1) {
        ruleId = 'payment_upcoming';
        title = `⏳ Recordatorio de Pago Mañana: ${payment.title}`;
        body = `Mañana vence el pago de ${profile.currencySymbol}${payment.amount.toLocaleString()} (${payment.isFixed ? 'Gasto Fijo' : 'Gasto Variable'}).`;
      }

      if (ruleId && !isRecentlySent(tag)) {
        const evaluation = evaluateNotificationDelivery(
          ruleId,
          payment.category,
          payment.amount,
          prefs,
          now
        );

        if (!evaluation.allow) {
          if (evaluation.queuedForDigest) {
            markAsSent(tag);
            const silencedItem: ProactiveNotificationItem = {
              id: `notif-dnd-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              title,
              body,
              type: 'payment_reminder',
              priority: evaluation.effectivePriority,
              suppressedByDnd: true,
              suppressedReason: evaluation.reason,
              timestamp: new Date().toISOString(),
              tag,
              tab: 'finances',
            };
            queueDndNotification(silencedItem);
            onNotificationSent?.(silencedItem);
          }
          continue;
        }

        markAsSent(tag);
        const notifItem: ProactiveNotificationItem = {
          id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          title,
          body,
          type: 'payment_reminder',
          priority: evaluation.effectivePriority,
          timestamp: new Date().toISOString(),
          tag,
          tab: 'finances',
        };

        sendSystemNotification(title, {
          body,
          tag,
          data: { url: '/', tab: 'finances' },
        });

        triggered.push(notifItem);
        onNotificationSent?.(notifItem);
      }
    }
  }

  // 2. Check Budget Alerts based on specific percentage-based notification thresholds
  if (enableBudgets) {
    for (const [categoryKey, budgetLimit] of Object.entries(categoryBudgets)) {
      if (!budgetLimit || budgetLimit <= 0) continue;

      const spent = payments
        .filter((p) => p.type === 'gasto' && p.category === categoryKey)
        .reduce((sum, p) => sum + p.amount, 0);

      const percent = (spent / budgetLimit) * 100;
      const catThreshold = alertThresholds[categoryKey] || globalAlertThreshold || 80;
      const tag = `budget-warning-${categoryKey}-${Math.floor(percent / 5)}`; // changes every 5% jump

      if (percent >= catThreshold && !isRecentlySent(tag)) {
        const isExceeded = percent >= 100;
        const ruleId = isExceeded ? 'budget_exceeded' : 'budget_warning';

        const title = isExceeded
          ? `🚨 Presupuesto Excedido (${Math.round(percent)}%): ${categoryKey.toUpperCase()}`
          : `⚠️ Umbral de Alerta (${catThreshold}%): ${categoryKey.toUpperCase()} al ${Math.round(percent)}%`;

        const body = `Has gastado ${profile.currencySymbol}${spent.toLocaleString()} de ${profile.currencySymbol}${budgetLimit.toLocaleString()} (${Math.round(percent)}%), superando tu umbral fijado del ${catThreshold}%.`;

        const evaluation = evaluateNotificationDelivery(
          ruleId,
          categoryKey,
          spent,
          prefs,
          now
        );

        if (!evaluation.allow) {
          if (evaluation.queuedForDigest) {
            markAsSent(tag);
            const silencedItem: ProactiveNotificationItem = {
              id: `notif-dnd-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              title,
              body,
              type: 'budget_warning',
              priority: evaluation.effectivePriority,
              suppressedByDnd: true,
              suppressedReason: evaluation.reason,
              timestamp: new Date().toISOString(),
              tag,
              tab: 'finances',
            };
            queueDndNotification(silencedItem);
            onNotificationSent?.(silencedItem);
          }
          continue;
        }

        markAsSent(tag);
        const notifItem: ProactiveNotificationItem = {
          id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          title,
          body,
          type: 'budget_warning',
          priority: evaluation.effectivePriority,
          timestamp: new Date().toISOString(),
          tag,
          tab: 'finances',
        };

        sendSystemNotification(title, {
          body,
          tag,
          data: { url: '/', tab: 'finances' },
        });

        triggered.push(notifItem);
        onNotificationSent?.(notifItem);
      }
    }
  }

  return triggered;
};
