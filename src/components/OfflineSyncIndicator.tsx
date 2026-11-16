import React, { useState, useEffect, useRef } from 'react';
import {
  Wifi,
  WifiOff,
  RefreshCw,
  CheckCircle2,
  Database,
  CloudOff,
  CloudCheck,
  AlertCircle,
  HelpCircle,
  ChevronDown,
  Layers,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { indexedDbService, PendingOfflineChange } from '../services/indexedDbService';
import { useTheme } from '../context/ThemeContext';

interface OfflineSyncIndicatorProps {
  onSyncComplete?: (syncedCount: number) => void;
  className?: string;
  /** Versión compacta para la barra superior (oculta el sufijo IndexedDB). */
  compact?: boolean;
}

export type NetworkMode = 'online' | 'offline' | 'syncing';

export const OfflineSyncIndicator: React.FC<OfflineSyncIndicatorProps> = ({
  onSyncComplete,
  className = '',
  compact = false,
}) => {
  const { isVibrant } = useTheme();

  // Network & Sync States
  const [isSystemOnline, setIsSystemOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });
  const [isSimulatedOffline, setIsSimulatedOffline] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<NetworkMode>('online');
  const [pendingChanges, setPendingChanges] = useState<PendingOfflineChange[]>([]);
  const [lastSyncTime, setLastSyncTime] = useState<string>('En vivo');
  const [showDetailsDropdown, setShowDetailsDropdown] = useState(false);
  const [syncToastMessage, setSyncToastMessage] = useState<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Effective status
  const effectiveOnline = isSystemOnline && !isSimulatedOffline;

  // Load pending changes count from IndexedDB
  const refreshPendingChanges = async () => {
    try {
      const items = await indexedDbService.getPendingChanges();
      setPendingChanges(items);
    } catch (e) {
      console.warn('Could not read pending changes from IndexedDB:', e);
    }
  };

  // Listen to browser network changes
  useEffect(() => {
    const handleOnline = () => {
      setIsSystemOnline(true);
    };

    const handleOffline = () => {
      setIsSystemOnline(false);
      setSyncStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    refreshPendingChanges();

    // Check periodically for changes stored in IndexedDB
    const interval = setInterval(() => {
      refreshPendingChanges();
    }, 4000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  // When connection switches to online, trigger automatic synchronization of pending IndexedDB changes
  useEffect(() => {
    if (effectiveOnline) {
      if (syncStatus === 'offline' || pendingChanges.length > 0) {
        performSync();
      } else {
        setSyncStatus('online');
      }
    } else {
      setSyncStatus('offline');
    }
  }, [effectiveOnline]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDetailsDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const performSync = async () => {
    setSyncStatus('syncing');
    const countBefore = pendingChanges.length;

    try {
      const { syncedCount } = await indexedDbService.syncPendingChanges();
      await refreshPendingChanges();
      setSyncStatus('online');
      setLastSyncTime(new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

      const totalDone = syncedCount || countBefore;
      if (totalDone > 0) {
        const msg = `¡${totalDone} cambio${totalDone > 1 ? 's' : ''} de IndexedDB sincronizado${totalDone > 1 ? 's' : ''} con éxito!`;
        setSyncToastMessage(msg);
        onSyncComplete && onSyncComplete(totalDone);
        setTimeout(() => setSyncToastMessage(null), 4500);
      }
    } catch (err) {
      console.error('Error during synchronization:', err);
      setSyncStatus(effectiveOnline ? 'online' : 'offline');
    }
  };

  const handleToggleSimulatedOffline = () => {
    const nextState = !isSimulatedOffline;
    setIsSimulatedOffline(nextState);
    if (nextState) {
      setSyncStatus('offline');
      setSyncToastMessage('Modo Offline activado (usando IndexedDB local).');
      setTimeout(() => setSyncToastMessage(null), 3500);
    }
  };

  const handleManualAddTestChange = async () => {
    await indexedDbService.savePendingChange('note', 'create', {
      title: 'Nota guardada en modo offline',
      amount: 50,
      createdAt: new Date().toISOString(),
    });
    await refreshPendingChanges();
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Toast Notification for Sync Events */}
      {syncToastMessage && (
        <div className="fixed top-20 right-4 sm:right-8 z-50 p-3 rounded-2xl bg-slate-900 border border-emerald-500/40 text-emerald-300 text-xs font-bold shadow-2xl flex items-center gap-2 animate-fadeIn max-w-sm">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{syncToastMessage}</span>
          <button
            onClick={() => setSyncToastMessage(null)}
            className="text-slate-400 hover:text-white ml-auto text-xs px-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Status Pill Button */}
      <button
        type="button"
        onClick={() => setShowDetailsDropdown(!showDetailsDropdown)}
        className={`flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition-all border shadow-sm active:scale-95 ${
          syncStatus === 'offline'
            ? 'bg-amber-950/70 border-amber-500/50 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.25)] animate-pulse'
            : syncStatus === 'syncing'
            ? 'bg-cyan-950/70 border-cyan-400 text-cyan-300 shadow-[0_0_12px_rgba(0,210,255,0.3)]'
            : isVibrant
            ? 'bg-[#00f59b]/15 border-[#00f59b]/40 text-[#00f59b] hover:border-[#00f59b]/70 shadow-[0_0_10px_rgba(0,245,155,0.2)]'
            : 'bg-emerald-950/50 border-emerald-500/30 text-emerald-300 hover:border-emerald-500/60'
        }`}
        title="Estado de conexión, almacenamiento local IndexedDB y sincronización"
      >
        {syncStatus === 'offline' ? (
          <>
            <WifiOff className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Modo Offline (IndexedDB)</span>
            <span className="sm:hidden">Offline</span>
            {pendingChanges.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500/30 text-amber-200 text-[10px] font-black border border-amber-500/40">
                {pendingChanges.length}
              </span>
            )}
          </>
        ) : syncStatus === 'syncing' ? (
          <>
            <RefreshCw className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
            <span className="hidden sm:inline">Sincronizando...</span>
            <span className="sm:hidden">Sincro...</span>
            {pendingChanges.length > 0 && (
              <span className="text-[10px] font-bold text-cyan-200">({pendingChanges.length})</span>
            )}
          </>
        ) : (
          <>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="hidden sm:inline">En Línea</span>
            {!compact && <span className="text-[10px] opacity-75 font-normal hidden md:inline">· IndexedDB Listo</span>}
          </>
        )}
        <ChevronDown className="w-3 h-3 opacity-60" />
      </button>

      {/* Details & Controls Popover Dropdown */}
      {showDetailsDropdown && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-4 z-50 text-xs space-y-3.5 animate-fadeIn">
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-cyan-400" />
              <span className="font-black text-white text-sm">Estado de Conexión & IndexedDB</span>
            </div>
            <span
              className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                syncStatus === 'offline'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : syncStatus === 'syncing'
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
              }`}
            >
              {syncStatus === 'offline' ? 'Sin Conexión' : syncStatus === 'syncing' ? 'Sincronizando' : 'Conectado'}
            </span>
          </div>

          {/* Explanation Text */}
          <p className="text-slate-300 text-[11px] leading-relaxed">
            {syncStatus === 'offline'
              ? 'La aplicación está operando en modo offline. Cualquier nota, pago o meta que registres se guardará inmediatamente en IndexedDB y se sincronizará automáticamente al volver a tener conexión.'
              : 'Conexión activa. Los datos están sincronizados en tiempo real y respaldados en la base de datos local IndexedDB para tolerancia a fallos.'}
          </p>

          {/* Metrics summary */}
          <div className="grid grid-cols-2 gap-2 p-2.5 rounded-2xl bg-slate-950 border border-slate-800/80">
            <div>
              <span className="text-[10px] text-slate-400 block font-semibold">Cambios en Cola IndexedDB:</span>
              <span className="text-sm font-black text-white">
                {pendingChanges.length} pendiente{pendingChanges.length === 1 ? '' : 's'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block font-semibold">Última Sincronización:</span>
              <span className="text-xs font-bold text-cyan-300">{lastSyncTime}</span>
            </div>
          </div>

          {/* Pending Items List Preview */}
          {pendingChanges.length > 0 && (
            <div className="space-y-1.5 max-h-32 overflow-y-auto no-scrollbar">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                Operaciones pendientes de sincronizar:
              </span>
              {pendingChanges.slice(0, 4).map((ch) => (
                <div
                  key={ch.id}
                  className="p-2 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-[11px]"
                >
                  <span className="text-slate-200 capitalize font-medium">
                    {ch.action} {ch.entity}
                  </span>
                  <span className="text-[9px] text-slate-500">
                    {new Date(ch.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-2 pt-1 border-t border-slate-800">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={performSync}
                disabled={syncStatus === 'syncing' || !effectiveOnline}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 text-white font-bold text-xs disabled:opacity-40 transition-all active:scale-95 shadow-md"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
                <span>Sincronizar Ahora</span>
              </button>

              <button
                type="button"
                onClick={handleToggleSimulatedOffline}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-colors ${
                  isSimulatedOffline
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 hover:bg-amber-500/30'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                }`}
                title="Permite probar y simular la desconexión para verificar el guardado en IndexedDB"
              >
                {isSimulatedOffline ? 'Reconectar' : 'Simular Offline'}
              </button>
            </div>

            {/* Test quick offline mutation button */}
            {syncStatus === 'offline' && (
              <button
                type="button"
                onClick={handleManualAddTestChange}
                className="w-full py-1.5 px-2 rounded-lg bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-[10px] font-semibold transition-colors flex items-center justify-center gap-1"
              >
                <span>+ Agregar cambio de prueba a IndexedDB</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
