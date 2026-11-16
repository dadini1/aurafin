import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Mic,
  Volume2,
  VolumeX,
  Globe,
  Wallet,
  FileDown,
  Bell,
  Smartphone,
  Zap,
  Sun,
  Moon,
  Palette,
  Check,
  X,
  Settings,
  MoreHorizontal,
} from 'lucide-react';
import { POPULAR_COUNTRIES } from '../data/mockDeviceData';
import { UserFinancialProfile } from '../types';
import { useTheme, AppTheme, AccentColor } from '../context/ThemeContext';
import { OfflineSyncIndicator } from './OfflineSyncIndicator';

interface HeaderProps {
  profile: UserFinancialProfile;
  onUpdateProfile: (updated: Partial<UserFinancialProfile>) => void;
  voiceAudioEnabled: boolean;
  onToggleVoiceAudio: () => void;
  onOpenVoiceAssistant: () => void;
  onDownloadPDF?: () => void;
  activeAlertsCount?: number;
  onNavigateToFinances?: () => void;
  totalIncome: number;
  totalExpenses: number;
  onOpenNotificationCenter?: () => void;
  pushPermission?: NotificationPermission | 'unsupported';
  onOpenInstallModal?: () => void;
  onNavigateToAppModule?: () => void;
  showFloatingAI?: boolean;
  onToggleFloatingAI?: (show: boolean) => void;
  onOpenUserSettings?: (tab?: 'dnd' | 'priorities' | 'profile') => void;
  isDndActive?: boolean;
}

/** Acción compacta de icono con tooltip accesible. */
const IconAction: React.FC<{
  label: string;
  onClick: () => void;
  active?: boolean;
  pulse?: boolean;
  children: React.ReactNode;
  className?: string;
}> = ({ label, onClick, active = false, pulse = false, children, className = '' }) => (
  <button
    type="button"
    onClick={onClick}
    title={label}
    aria-label={label}
    className={`relative btn btn-icon border transition-colors ${
      active
        ? 'bg-[var(--accent-soft)] border-[var(--accent-border)] text-accent'
        : 'bg-[var(--surface-2)] border-[var(--border-subtle)] text-secondary hover:text-primary hover:border-[var(--border-strong)]'
    } ${pulse ? 'animate-pulse' : ''} ${className}`}
  >
    {children}
  </button>
);

export const Header: React.FC<HeaderProps> = ({
  profile,
  onUpdateProfile,
  voiceAudioEnabled,
  onToggleVoiceAudio,
  onOpenVoiceAssistant,
  onDownloadPDF,
  activeAlertsCount = 0,
  onNavigateToFinances,
  totalIncome,
  totalExpenses,
  onOpenNotificationCenter,
  pushPermission = 'default',
  onOpenInstallModal,
  onNavigateToAppModule,
  showFloatingAI = true,
  onToggleFloatingAI,
  onOpenUserSettings,
  isDndActive = false,
}) => {
  const { theme, isNitido, isVibrant, setTheme, accent, setAccent } = useTheme();
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const themeMenuRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  const savings = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? Math.round((savings / totalIncome) * 100) : 0;

  // Cerrar popovers al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(e.target as Node)) {
        setIsThemeMenuOpen(false);
      }
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setIsMoreMenuOpen(false);
      }
    };
    if (isThemeMenuOpen || isMoreMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isThemeMenuOpen, isMoreMenuOpen]);

  const themesList: { id: AppTheme; name: string; desc: string; icon: typeof Sun }[] = [
    { id: 'nitido', name: 'Nítido', desc: 'Superficies claras, colores vivos y legibles', icon: Sun },
    { id: 'neon', name: 'Neón Eléctrico', desc: 'Cian eléctrico y púrpura de alto contraste', icon: Zap },
    { id: 'dark', name: 'Oscuro Clásico', desc: 'Tinta profunda de bajo brillo', icon: Moon },
  ];

  const accentsList: { id: AccentColor; name: string; swatch: string }[] = [
    { id: 'cyan', name: 'Cian', swatch: '#22d3ee' },
    { id: 'emerald', name: 'Menta', swatch: '#34d399' },
    { id: 'purple', name: 'Púrpura', swatch: '#c084fc' },
    { id: 'amber', name: 'Oro', swatch: '#fbbf24' },
  ];

  const handleCountryChange = (name: string) => {
    const countryItem = POPULAR_COUNTRIES.find((c) => c.name === name);
    onUpdateProfile({
      country: name,
      currency: countryItem?.currency || profile.currency,
      currencySymbol: countryItem?.symbol || profile.currencySymbol,
    });
  };

  const countrySelector = (
    <div className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs bg-[var(--surface-2)] border border-[var(--border-subtle)]">
      <Globe className="w-3.5 h-3.5 text-accent shrink-0" aria-hidden />
      <select
        id="country-select"
        name="country"
        aria-label="Seleccionar país para búsqueda en tiempo real"
        value={profile.country}
        onChange={(e) => handleCountryChange(e.target.value)}
        className="!bg-transparent !border-none text-xs font-semibold focus:outline-none cursor-pointer text-primary max-w-[130px]"
      >
        {POPULAR_COUNTRIES.map((c) => (
          <option key={c.name} value={c.name}>
            {c.name} ({c.symbol})
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <header className="sticky top-0 z-30 backdrop-blur-xl bg-[var(--surface-glass)] border-b border-[var(--border-subtle)] transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">
          {/* Identidad de marca */}
          <div className="flex items-center gap-3 min-w-0 shrink-0">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-aura shadow-[var(--glow-accent)] shrink-0">
              <Sparkles className="w-5 h-5 text-white" aria-hidden />
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[var(--surface-1)] bg-[var(--income)]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-primary truncate" style={{ fontFamily: 'var(--font-display)' }}>
                  AuraFin
                </h1>
                <span className="badge badge-ai !px-1.5 !py-0 text-[10px]">AI</span>
                {theme === 'neon' && (
                  <span className="hidden md:inline-flex badge badge-accent text-[10px]">
                    <Zap className="w-3 h-3" aria-hidden /> Neón
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted hidden md:block truncate">
                Asistente financiero & notas inteligentes
              </p>
            </div>
          </div>

          {/* Capacidad de ahorro (escritorio muy ancho) */}
          <div className="hidden 2xl:flex items-center gap-2.5 inset px-3.5 py-2">
            <span className="w-7 h-7 rounded-lg flex items-center justify-center bg-[var(--income-soft)] text-income">
              <Wallet className="w-4 h-4" aria-hidden />
            </span>
            <div className="text-xs leading-tight">
              <span className="block text-muted font-medium">Capacidad de ahorro</span>
              <span className={`font-bold num ${savings >= 0 ? 'text-income' : 'text-expense'}`}>
                {profile.currencySymbol}
                {savings.toLocaleString()} / mes · {savingsRate}%
              </span>
            </div>
          </div>

          {/* Acciones */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Alertas de presupuesto (siempre visibles si existen) */}
            {activeAlertsCount > 0 && onNavigateToFinances && (
              <button
                onClick={onNavigateToFinances}
                title={`${activeAlertsCount} categoría(s) superaron el umbral del presupuesto`}
                className="btn btn-sm btn-danger !rounded-full animate-pulse"
              >
                <Bell className="w-3.5 h-3.5" aria-hidden />
                <span className="hidden sm:inline">
                  {activeAlertsCount} alerta{activeAlertsCount > 1 ? 's' : ''}
                </span>
                <span className="sm:hidden">{activeAlertsCount}</span>
              </button>
            )}

            {/* Selector de país (escritorio; en móvil/tablet vive en "Más") */}
            <div className="hidden lg:block">{countrySelector}</div>

            {/* Estado de sincronización (escritorio) */}
            <div className="hidden lg:block">
              <OfflineSyncIndicator compact />
            </div>

            {/* App / PWA (escritorio) */}
            {(onNavigateToAppModule || onOpenInstallModal) && (
              <button
                onClick={onNavigateToAppModule || onOpenInstallModal}
                title="Instalar AuraFin como app y sincronizar en tiempo real"
                className="hidden lg:flex btn btn-sm btn-outline"
              >
                <Smartphone className="w-3.5 h-3.5" aria-hidden />
                <span>App</span>
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--income)] animate-pulse" />
              </button>
            )}

            {/* Botón flotante IA on/off (escritorio ancho) */}
            {onToggleFloatingAI && (
              <button
                onClick={() => onToggleFloatingAI(!showFloatingAI)}
                title={showFloatingAI ? 'Ocultar el asistente flotante' : 'Mostrar el asistente flotante'}
                className={`hidden 2xl:flex btn btn-sm ${showFloatingAI ? 'btn-secondary' : 'btn-outline'}`}
              >
                <Sparkles className="w-3.5 h-3.5 text-accent" aria-hidden />
                <span>{showFloatingAI ? 'IA visible' : '+ IA'}</span>
              </button>
            )}

            {/* Reporte PDF (escritorio) */}
            {onDownloadPDF && (
              <IconAction label="Descargar reporte financiero en PDF" onClick={onDownloadPDF} className="hidden lg:inline-flex">
                <FileDown className="w-4 h-4 text-accent" />
              </IconAction>
            )}

            {/* Notificaciones push */}
            {onOpenNotificationCenter && (
              <IconAction
                label={
                  pushPermission === 'granted'
                    ? 'Notificaciones push activas · configurar alertas'
                    : 'Activar notificaciones push y alertas'
                }
                onClick={onOpenNotificationCenter}
                className="hidden lg:inline-flex"
              >
                <Bell className="w-4 h-4" />
                <span
                  className={`absolute top-1 right-1 w-2 h-2 rounded-full ${
                    pushPermission === 'granted' ? 'bg-[var(--income)]' : 'bg-[var(--goal)] animate-ping'
                  }`}
                />
              </IconAction>
            )}

            {/* Configuración de usuario / No Molestar */}
            {onOpenUserSettings && (
              <IconAction
                label={
                  isDndActive
                    ? 'No Molestar activo · configurar horarios y prioridades'
                    : 'Configuración: horarios No Molestar y prioridades'
                }
                onClick={() => onOpenUserSettings('dnd')}
                active={isDndActive}
                className="hidden lg:inline-flex"
              >
                {isDndActive ? <Moon className="w-4 h-4 text-ai" /> : <Settings className="w-4 h-4" />}
                {isDndActive && <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[var(--accent-2)] animate-pulse" />}
              </IconAction>
            )}

            {/* Tema y acento (popover) */}
            <div className="relative" ref={themeMenuRef}>
              <button
                onClick={() => setIsThemeMenuOpen(!isThemeMenuOpen)}
                title="Personalizar tema y color de acento"
                aria-label="Personalizar tema y color de acento"
                aria-expanded={isThemeMenuOpen}
                className="btn btn-icon border bg-[var(--surface-2)] border-[var(--border-subtle)] text-secondary hover:text-primary"
              >
                {isNitido ? (
                  <Sun className="w-4 h-4 text-goal" />
                ) : isVibrant ? (
                  <Zap className="w-4 h-4 text-accent" />
                ) : (
                  <Moon className="w-4 h-4" />
                )}
              </button>

              {isThemeMenuOpen && (
                <div className="absolute right-0 mt-2 w-72 sm:w-80 card p-4 z-50 !shadow-[var(--shadow-pop)]">
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-[var(--border-subtle)]">
                    <span className="flex items-center gap-2 eyebrow !text-[10px]">
                      <Palette className="w-4 h-4 text-accent" aria-hidden />
                      Apariencia
                    </span>
                    <button onClick={() => setIsThemeMenuOpen(false)} aria-label="Cerrar" className="btn btn-ghost btn-icon !p-1">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-1.5 mb-4">
                    {themesList.map((t) => {
                      const Icon = t.icon;
                      const isActive = theme === t.id;
                      return (
                        <button
                          key={t.id}
                          onClick={() => setTheme(t.id)}
                          className={`w-full flex items-start gap-3 p-2.5 rounded-xl text-left border transition-all ${
                            isActive
                              ? 'bg-[var(--accent-soft)] border-[var(--accent-border)]'
                              : 'bg-[var(--surface-2)] border-[var(--border-subtle)] hover:border-[var(--border-strong)]'
                          }`}
                        >
                          <span
                            className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                              isActive ? 'bg-gradient-aura text-white' : 'inset text-muted'
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className="flex items-center justify-between">
                              <span className="text-xs font-bold text-primary">{t.name}</span>
                              {isActive && <Check className="w-3.5 h-3.5 text-accent" aria-hidden />}
                            </span>
                            <span className="block text-[10px] text-muted mt-0.5 leading-snug">{t.desc}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <span className="eyebrow !text-[10px] block mb-2">Color de acento</span>
                  <div className="grid grid-cols-4 gap-2">
                    {accentsList.map((acc) => (
                      <button
                        key={acc.id}
                        onClick={() => setAccent(acc.id)}
                        title={acc.name}
                        className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all ${
                          accent === acc.id
                            ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                            : 'border-[var(--border-subtle)] hover:bg-[var(--surface-2)]'
                        }`}
                      >
                        <span className="w-5 h-5 rounded-full shadow-sm" style={{ background: acc.swatch }} />
                        <span className="text-[9px] font-bold text-secondary">{acc.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Audio TTS (escritorio) */}
            <IconAction
              label={voiceAudioEnabled ? 'Silenciar respuesta de voz' : 'Activar respuesta de voz'}
              onClick={onToggleVoiceAudio}
              active={voiceAudioEnabled}
              className="hidden lg:inline-flex"
            >
              {voiceAudioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </IconAction>

            {/* Menú "Más" en móvil / tablet: acciones secundarias sin desbordar */}
            <div className="relative lg:hidden" ref={moreMenuRef}>
              <IconAction
                label="Más opciones"
                onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                active={isMoreMenuOpen}
              >
                <MoreHorizontal className="w-4 h-4" />
              </IconAction>

              {isMoreMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 card p-2 z-50 !shadow-[var(--shadow-pop)] space-y-0.5">
                  <div className="px-2 py-1.5">{countrySelector}</div>
                  <div className="px-2 py-1.5 flex items-center justify-between">
                    <span className="text-xs font-semibold text-secondary">Sincronización</span>
                    <OfflineSyncIndicator />
                  </div>
                  <div className="divider my-1" />
                  {(onNavigateToAppModule || onOpenInstallModal) && (
                    <MoreItem
                      icon={<Smartphone className="w-4 h-4 text-accent" />}
                      label="App móvil & sincronización"
                      onClick={() => {
                        setIsMoreMenuOpen(false);
                        (onNavigateToAppModule || onOpenInstallModal)?.();
                      }}
                    />
                  )}
                  {onDownloadPDF && (
                    <MoreItem
                      icon={<FileDown className="w-4 h-4 text-accent" />}
                      label="Reporte PDF"
                      onClick={() => {
                        setIsMoreMenuOpen(false);
                        onDownloadPDF();
                      }}
                    />
                  )}
                  {onOpenNotificationCenter && (
                    <MoreItem
                      icon={<Bell className="w-4 h-4 text-accent" />}
                      label={pushPermission === 'granted' ? 'Notificaciones (activas)' : 'Activar notificaciones'}
                      onClick={() => {
                        setIsMoreMenuOpen(false);
                        onOpenNotificationCenter();
                      }}
                    />
                  )}
                  {onOpenUserSettings && (
                    <MoreItem
                      icon={isDndActive ? <Moon className="w-4 h-4 text-ai" /> : <Settings className="w-4 h-4 text-accent" />}
                      label={isDndActive ? 'No Molestar (activo)' : 'Configuración de usuario'}
                      onClick={() => {
                        setIsMoreMenuOpen(false);
                        onOpenUserSettings('dnd');
                      }}
                    />
                  )}
                  <MoreItem
                    icon={voiceAudioEnabled ? <Volume2 className="w-4 h-4 text-accent" /> : <VolumeX className="w-4 h-4 text-muted" />}
                    label={voiceAudioEnabled ? 'Silenciar voz de la IA' : 'Activar voz de la IA'}
                    onClick={() => {
                      setIsMoreMenuOpen(false);
                      onToggleVoiceAudio();
                    }}
                  />
                  {onToggleFloatingAI && (
                    <MoreItem
                      icon={<Sparkles className="w-4 h-4 text-ai" />}
                      label={showFloatingAI ? 'Ocultar asistente flotante' : 'Mostrar asistente flotante'}
                      onClick={() => {
                        setIsMoreMenuOpen(false);
                        onToggleFloatingAI(!showFloatingAI);
                      }}
                    />
                  )}
                </div>
              )}
            </div>

            {/* CTA principal: hablar con la IA */}
            <button
              onClick={onOpenVoiceAssistant}
              className="btn btn-primary !rounded-full px-3.5 sm:px-4"
              title="Abrir el asistente de voz"
            >
              <Mic className="w-4 h-4" aria-hidden />
              <span className="hidden xs:inline sm:inline">Hablar a la IA</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

/** Fila de acción del menú "Más" (móvil). */
const MoreItem: React.FC<{ icon: React.ReactNode; label: string; onClick: () => void }> = ({ icon, label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold text-secondary hover:text-primary hover:bg-[var(--surface-2)] transition-colors text-left"
  >
    {icon}
    <span>{label}</span>
  </button>
);