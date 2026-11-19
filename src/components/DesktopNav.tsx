import React from 'react';
import { MAIN_TABS, type MainTabKey, type TabDefinition } from '../config/navigation';

interface DesktopNavProps {
  activeTab: MainTabKey;
  onTabChange: (tab: MainTabKey) => void;
  notesCount: number;
  paymentsCount: number;
  filesCount: number;
  activeAlertsCount?: number;
  country: string;
  /** Pestañas permitidas por la suscripción (por defecto todas). */
  tabs?: TabDefinition[];
}

/**
 * Navegación principal de escritorio (≥1024px). En móvil y tablet se usa
 * MobileBottomNav. Data-driven desde src/config/navigation.tsx (fuente única
 * de verdad compartida con MobileBottomNav). Scroll horizontal sin desbordes.
 */
export const DesktopNav: React.FC<DesktopNavProps> = ({
  activeTab,
  onTabChange,
  notesCount,
  paymentsCount,
  filesCount,
  activeAlertsCount = 0,
  country,
  tabs = MAIN_TABS,
}) => {
  const countFor = (key: MainTabKey): number | null => {
    if (key === 'notes') return notesCount;
    if (key === 'finances') return paymentsCount;
    if (key === 'gallery') return filesCount;
    return null;
  };

  return (
    <div className="hidden lg:block sticky top-16 z-20 backdrop-blur-xl bg-[var(--surface-glass)] border-b border-[var(--border-subtle)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav aria-label="Secciones principales" className="flex gap-1.5 overflow-x-auto py-2 no-scrollbar">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            const count = countFor(tab.key);
            const label = tab.key === 'radar' ? `Radar · ${country}` : tab.label;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => onTabChange(tab.key)}
                title={tab.description}
                aria-current={isActive ? 'page' : undefined}
                className={`chip shrink-0 ${isActive ? 'chip-active' : ''}`}
              >
                <Icon className="w-4 h-4" aria-hidden />
                <span>{label}</span>
                {tab.key === 'finances' && activeAlertsCount > 0 && (
                  <span
                    className={`min-w-[16px] h-4 px-1 rounded-full text-[9px] font-black flex items-center justify-center ${
                      isActive ? 'bg-white/25 text-white' : 'bg-[var(--expense)] text-white'
                    }`}
                  >
                    {activeAlertsCount}
                  </span>
                )}
                {count !== null && (
                  <span
                    className={`min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center ${
                      isActive ? 'bg-white/25 text-white' : 'bg-[var(--surface-3)] text-secondary'
                    }`}
                  >
                    {count}
                  </span>
                )}
                {tab.key === 'voice-analytics' && (
                  <span className={`badge !px-1.5 !py-0 text-[9px] ${isActive ? '!bg-white/25 !text-white !border-transparent' : 'badge-ai'}`}>
                    IA
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
};