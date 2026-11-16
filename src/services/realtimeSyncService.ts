/**
 * AuraFin AI - Real-Time Bidirectional State Synchronization Engine
 * Keeps Web Dashboard and Mobile App / APK in live sync across tabs, devices & standalone apps
 */

import { syncHeaders } from './syncAuth';

export interface RealtimeSyncPayload {
  source: 'web' | 'mobile_app' | 'server';
  timestamp: string;
  type: 'PAYMENTS' | 'NOTES' | 'GOALS' | 'BUDGETS' | 'PROFILE' | 'FULL_SYNC';
  data: any;
}

export type SyncListener = (payload: RealtimeSyncPayload) => void;

class RealtimeSyncManager {
  private channel: BroadcastChannel | null = null;
  private listeners: Set<SyncListener> = new Set();
  private lastVersion = 0;
  private syncCount = 0;
  private lastSyncTimestamp: string = new Date().toISOString();
  private pollInterval: any = null;

  constructor() {
    this.initBroadcastChannel();
    this.initStorageListener();
    this.startServerPolling();
  }

  private initBroadcastChannel() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel('aurafin_realtime_sync_channel');
        this.channel.onmessage = (event: MessageEvent<RealtimeSyncPayload>) => {
          if (event.data) {
            this.notifyListeners(event.data);
          }
        };
      } catch (e) {
        console.warn('[RealtimeSync] BroadcastChannel error:', e);
      }
    }
  }

  private initStorageListener() {
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (event) => {
        if (!event.key || !event.key.startsWith('aurafin_')) return;
        try {
          const parsed = event.newValue ? JSON.parse(event.newValue) : null;
          let type: RealtimeSyncPayload['type'] = 'FULL_SYNC';
          if (event.key === 'aurafin_payments') type = 'PAYMENTS';
          else if (event.key === 'aurafin_notes') type = 'NOTES';
          else if (event.key === 'aurafin_goals') type = 'GOALS';
          else if (event.key === 'aurafin_category_budgets') type = 'BUDGETS';
          else if (event.key === 'aurafin_profile') type = 'PROFILE';

          this.notifyListeners({
            source: 'web',
            timestamp: new Date().toISOString(),
            type,
            data: parsed,
          });
        } catch {
          // ignore parsing error
        }
      });
    }
  }

  private startServerPolling() {
    if (typeof window === 'undefined') return;

    // Check server state every 5 seconds to sync cross-device in real-time
    this.pollInterval = setInterval(async () => {
      try {
        const res = await fetch('/api/sync/state', { headers: syncHeaders() });
        if (!res.ok) return;
        const json = await res.json();
        if (json.success && json.data && json.data.version > this.lastVersion) {
          this.lastVersion = json.data.version;
          this.syncCount++;
          this.lastSyncTimestamp = json.data.lastUpdated;

          this.notifyListeners({
            source: 'server',
            timestamp: json.data.lastUpdated,
            type: 'FULL_SYNC',
            data: json.data,
          });
        }
      } catch {
        // network offline fallback
      }
    }, 5000);
  }

  public subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(payload: RealtimeSyncPayload) {
    this.syncCount++;
    this.lastSyncTimestamp = payload.timestamp || new Date().toISOString();
    this.listeners.forEach((fn) => {
      try {
        fn(payload);
      } catch (err) {
        console.error('[RealtimeSync] Listener error:', err);
      }
    });
  }

  /**
   * Broadcast state change to all tabs and push to server
   */
  public broadcast(type: RealtimeSyncPayload['type'], data: any, source: 'web' | 'mobile_app' = 'web') {
    const payload: RealtimeSyncPayload = {
      source,
      timestamp: new Date().toISOString(),
      type,
      data,
    };

    // 1. Broadcast locally
    if (this.channel) {
      try {
        this.channel.postMessage(payload);
      } catch (e) {
        console.warn('[RealtimeSync] Channel post error:', e);
      }
    }

    // 2. Push to server for cross-device synchronization
    const serverPayload: any = {};
    if (type === 'PAYMENTS') serverPayload.payments = data;
    else if (type === 'NOTES') serverPayload.notes = data;
    else if (type === 'GOALS') serverPayload.goals = data;
    else if (type === 'BUDGETS') serverPayload.categoryBudgets = data;
    else if (type === 'PROFILE') serverPayload.profile = data;
    else if (type === 'FULL_SYNC') Object.assign(serverPayload, data);

    fetch('/api/sync/state', {
      method: 'POST',
      headers: syncHeaders(),
      body: JSON.stringify(serverPayload),
    }).catch(() => {
      // offline fallback
    });
  }

  public getStats() {
    return {
      syncCount: this.syncCount,
      lastSyncTimestamp: this.lastSyncTimestamp,
      isConnected: true,
    };
  }

  public destroy() {
    if (this.pollInterval) clearInterval(this.pollInterval);
    if (this.channel) this.channel.close();
  }
}

export const realtimeSync = new RealtimeSyncManager();
