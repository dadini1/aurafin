import React, { useState, useRef, useEffect } from 'react';
import { Camera, ScanLine, MoreHorizontal, X } from 'lucide-react';
import { MAIN_TABS, getTab, type MainTabKey, type TabDefinition } from '../config/navigation';

export type { MainTabKey };

interface MobileBottomNavProps {
  activeTab: MainTabKey;
  onTabChange: (tab: MainTabKey) => void;
  onOpenScanner: () => void;
  onOpenVoiceAssistant: () => void;
  activeAlertsCount?: number;
  notesCount?: number;
  paymentsCount?: number;
  showFloatingAI: boolean;
  onToggleFloatingAI: (show: boolean) => void;
  /** Pestañas permitidas por la suscripción (por defecto todas). */
  tabs?: TabDefinition[];
}

/** Pestañas primarias de la barra inferior; el resto vive en "Más". */
const PRIMARY_KEYS: MainTabKey[] = ['finances', 'notes', 'radar'];
const OVERFLOW_KEYS: MainTabKey[] = ['voice-analytics', 'gallery', 'mobile-app'];

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onTabChange,
  onOpenScanner,
  activeAlertsCount = 0,
  notesCount = 0,
  tabs = MAIN_TABS,
}) => {
  const permitidas = new Set(tabs.map((t) => t.key));
  const overflowKeys = [
    ...OVERFLOW_KEYS.filter((k) => permitidas.has(k)),
    ...tabs.map((t) => t.key).filter((k) => !PRIMARY_KEYS.includes(k) && !OVERFLOW_KEYS.includes(k)),
  ];
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const isOverflowActive = overflowKeys.includes(activeTab);

  useEffect(() => {
    if (!isMoreOpen) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setIsMoreOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, [isMoreOpen]);

  const badgeFor = (key: MainTabKey): { value: number; tone: 'danger' | 'neutral' } | null => {
    if (key === 'finances' && activeAlertsCount > 0) return { value: activeAlertsCount, tone: 'danger' };
    if (key === 'notes' && notesCount > 0) return { value: notesCount, tone: 'neutral' };
    return null;
  };

  const TabButton: React.FC<{ tabKey: MainTabKey }> = ({ tabKey }) => {
    const tab = getTab(tabKey);
    const Icon = tab.icon;
    const isActive = activeTab === tabKey;
    const badge = badgeFor(tabKey);
    return (
      <button
        type="button"
        onClick={() => onTabChange(tabKey)}
        aria-label={tab.description}
        aria-current={isActive ? 'page' : undefined}
        className={`relative flex flex-col items-center justify-center flex-1 py-1.5 rounded-xl transition-colors ${
          isActive ? 'text-accent' : 'text-muted hover:text-primary'
        }`}
      >
        {isActive && (
          <span className="absolute -top-1.5 w-8 h-1 rounded-full bg-gradient-aura shadow-[var(--glow-accent)]" />
        )}
        <span className="relative">
          <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`} aria-hidden />
          {badge && (
            <span
              className={`absolute -top-1.5 -right-2 min-w-[15px] h-[15px] px-0.5 rounded-full text-[9px] font-black flex items-center justify-center ${
                badge.tone === 'danger'
                  ? 'bg-[var(--expense)] text-white animate-pulse'
                  : 'bg-[var(--surface-3)] text-secondary border border-[var(--border-default)]'
              }`}
            >
              {badge.value > 99 ? '99+' : badge.value}
            </span>
          )}
        </span>
        <span className={`text-[10px] mt-0.5 tracking-tight ${isActive ? 'font-extrabold' : 'font-semibold'}`}>
          {tab.shortLabel}
        </span>
      </button>
    );
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 lg:hidden backdrop-blur-xl bg-[var(--surface-glass)] border-t border-[var(--border-subtle)] pb-safe">
      {/* Hoja "Más": pestañas restantes para que todo sea alcanzable en móvil */}
      {isMoreOpen && (
        <div className="absolute bottom-full left-3 right-3 mb-2 card p-2 !shadow-[var(--shadow-pop)]">
          <div className="flex items-center justify-between px-2.5 py-1.5">
            <span className="eyebrow !text-[10px]">Más secciones</span>
            <button onClick={() => setIsMoreOpen(false)} aria-label="Cerrar" className="btn btn-ghost btn-icon !p-1">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {overflowKeys.map((key) => {
            const tab = getTab(key);
            const Icon = tab.icon;
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  onTabChange(key);
                  setIsMoreOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-left transition-colors ${
                  isActive ? 'bg-[var(--accent-soft)]' : 'hover:bg-[var(--surface-2)]'
                }`}
              >
                <span className={`w-8 h-8 rounded-lg inset flex items-center justify-center ${isActive ? 'text-accent' : 'text-muted'}`}>
                  <Icon className="w-4 h-4" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className={`block text-xs font-bold ${isActive ? 'text-accent' : 'text-primary'}`}>{tab.label}</span>
                  <span className="block text-[10px] text-muted truncate">{tab.description}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className="max-w-md mx-auto px-3 pt-1.5 pb-1 flex items-end justify-between gap-1" ref={moreRef}>
        {permitidas.has('finances') && <TabButton tabKey="finances" />}
        {permitidas.has('notes') && <TabButton tabKey="notes" />}

        {/* Escáner de recibos (acción central destacada) */}
        <div className="flex flex-col items-center justify-center px-1">
          <button
            id="mobile-bottom-nav-receipt-scanner"
            data-testid="mobile-bottom-nav-receipt-scanner-btn"
            type="button"
            onClick={() => {
              if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                try {
                  navigator.vibrate(25);
                } catch {
                  // ignore
                }
              }
              onOpenScanner();
            }}
            className="group relative w-12 h-12 -mt-5 rounded-2xl bg-gradient-aura text-white flex items-center justify-center active:scale-90 transition-all shadow-[var(--glow-accent)] border-2 border-[var(--surface-1)]"
            title="Escanear recibo o ticket con la cámara"
            aria-label="Escanear recibo con la cámara"
          >
            <span className="relative flex items-center justify-center">
              <Camera className="w-5 h-5 group-hover:scale-110 transition-transform" aria-hidden />
              <ScanLine className="w-3.5 h-3.5 absolute -bottom-1 -right-1 opacity-80" aria-hidden />
            </span>
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5 pointer-events-none">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--income)] opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[var(--income)] border border-[var(--surface-1)]" />
            </span>
          </button>
          <span className="text-[9px] mt-0.5 font-bold uppercase tracking-tight text-accent flex items-center gap-0.5">
            Recibo
            <span className="badge badge-ai !px-1 !py-0 text-[7.5px]">AI</span>
          </span>
        </div>

        {permitidas.has('radar') && <TabButton tabKey="radar" />}

        {/* Más: Analytics, Galería y App (solo las activas por el plan) */}
        {overflowKeys.length > 0 && (
        <button
          type="button"
          onClick={() => setIsMoreOpen(!isMoreOpen)}
          aria-label="Más secciones"
          aria-expanded={isMoreOpen}
          className={`relative flex flex-col items-center justify-center flex-1 py-1.5 rounded-xl transition-colors ${
            isOverflowActive || isMoreOpen ? 'text-accent' : 'text-muted hover:text-primary'
          }`}
        >
          {(isOverflowActive || isMoreOpen) && (
            <span className="absolute -top-1.5 w-8 h-1 rounded-full bg-gradient-aura shadow-[var(--glow-accent)]" />
          )}
          <MoreHorizontal className={`w-5 h-5 ${isOverflowActive ? 'scale-110' : ''}`} aria-hidden />
          <span className={`text-[10px] mt-0.5 tracking-tight ${isOverflowActive ? 'font-extrabold' : 'font-semibold'}`}>
            {isOverflowActive ? getTab(activeTab).shortLabel : 'Más'}
          </span>
        </button>
        )}
      </div>
    </div>
  );
};