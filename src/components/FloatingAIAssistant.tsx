import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  Sparkles,
  X,
  Move,
  Camera,
  TrendingUp,
  Sliders,
  Zap,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface FloatingAIAssistantProps {
  onOpenVoiceAssistant: (initialPrompt?: string) => void;
  onOpenScanner?: () => void;
  isVisible: boolean;
  onToggleVisibility: (visible: boolean) => void;
}

export type DockCorner = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';

export const FloatingAIAssistant: React.FC<FloatingAIAssistantProps> = ({
  onOpenVoiceAssistant,
  onOpenScanner,
  isVisible,
  onToggleVisibility,
}) => {
  const { theme, toggleTheme } = useTheme();
  const isNeon = theme === 'neon';

  const [corner, setCorner] = useState<DockCorner>(() => {
    try {
      const saved = localStorage.getItem('aurafin_ai_dock_corner');
      if (saved && ['bottom-right', 'bottom-left', 'top-right', 'top-left'].includes(saved)) {
        return saved as DockCorner;
      }
    } catch {
      // ignore
    }
    return 'bottom-right';
  });

  const [position, setPosition] = useState<{ x: number; y: number } | null>(() => {
    try {
      const saved = localStorage.getItem('aurafin_ai_custom_pos');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return null;
  });

  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [hasMoved, setHasMoved] = useState(false);
  const [showQuickMenu, setShowQuickMenu] = useState(false);
  const [isMinimizedAtEdge, setIsMinimizedAtEdge] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem('aurafin_ai_dock_corner', corner);
      if (position) {
        localStorage.setItem('aurafin_ai_custom_pos', JSON.stringify(position));
      }
    } catch {
      // ignore
    }
  }, [corner, position]);

  const handleStartDrag = (clientX: number, clientY: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setDragOffset({ x: clientX - rect.left, y: clientY - rect.top });
    setIsDragging(true);
    setHasMoved(false);
  };

  const handleMoveDrag = (clientX: number, clientY: number) => {
    if (!isDragging) return;
    setHasMoved(true);
    const newX = Math.max(12, Math.min(window.innerWidth - 75, clientX - dragOffset.x));
    const newY = Math.max(70, Math.min(window.innerHeight - 130, clientY - dragOffset.y));
    setPosition({ x: newX, y: newY });
  };

  const handleEndDrag = () => {
    if (!isDragging) return;
    setIsDragging(false);
    if (position) {
      const midX = window.innerWidth / 2;
      const midY = window.innerHeight / 2;
      let snappedCorner: DockCorner = 'bottom-right';
      if (position.x < midX && position.y < midY) snappedCorner = 'top-left';
      else if (position.x >= midX && position.y < midY) snappedCorner = 'top-right';
      else if (position.x < midX && position.y >= midY) snappedCorner = 'bottom-left';
      else snappedCorner = 'bottom-right';
      setCorner(snappedCorner);
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) handleMoveDrag(e.clientX, e.clientY);
    };
    const handleMouseUp = () => {
      if (isDragging) handleEndDrag();
    };
    const handleTouchMove = (e: TouchEvent) => {
      if (isDragging && e.touches[0]) {
        handleMoveDrag(e.touches[0].clientX, e.touches[0].clientY);
      }
    };
    const handleTouchEnd = () => {
      if (isDragging) handleEndDrag();
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove, { passive: false });
      window.addEventListener('touchend', handleTouchEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, dragOffset]);

  const handleOrbClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasMoved) return;
    onOpenVoiceAssistant();
  };

  // Oculto por completo: pastilla para restaurarlo
  if (!isVisible) {
    return (
      <div className="fixed bottom-24 right-3 z-40 lg:bottom-6 lg:right-6">
        <button
          onClick={() => onToggleVisibility(true)}
          className="btn btn-sm btn-outline !rounded-full backdrop-blur-md bg-[var(--surface-glass)]"
          title="Agregar el asistente IA a la pantalla"
        >
          <Sparkles className="w-3.5 h-3.5" aria-hidden />
          <span>+ Asistente IA</span>
        </button>
      </div>
    );
  }

  // Minimizado a una pestaña en el borde
  if (isMinimizedAtEdge) {
    return (
      <div
        className={`fixed z-40 transition-all ${corner.includes('left') ? 'left-0' : 'right-0'} ${
          corner.includes('top') ? 'top-28' : 'bottom-28 lg:bottom-8'
        }`}
      >
        <button
          onClick={() => setIsMinimizedAtEdge(false)}
          className={`flex items-center gap-1.5 py-2 px-2.5 bg-gradient-aura text-white font-bold text-xs shadow-[var(--glow-accent)] transition-all hover:brightness-110 ${
            corner.includes('left') ? 'rounded-r-2xl pr-3' : 'rounded-l-2xl pl-3'
          }`}
          title="Restaurar asistente IA"
        >
          <Sparkles className="w-4 h-4 animate-spin" style={{ animationDuration: '4s' }} aria-hidden />
          <span className="text-[10px] uppercase font-black tracking-wider">AuraFin</span>
        </button>
      </div>
    );
  }

  const cornerClasses = !position
    ? corner === 'bottom-right'
      ? 'fixed bottom-[92px] lg:bottom-6 right-4 lg:right-6'
      : corner === 'bottom-left'
      ? 'fixed bottom-[92px] lg:bottom-6 left-4 lg:left-6'
      : corner === 'top-right'
      ? 'fixed top-20 right-4 lg:right-6'
      : 'fixed top-20 left-4 lg:left-6'
    : 'fixed';

  const QuickAction: React.FC<{ icon: React.ReactNode; label: string; onClick: () => void }> = ({
    icon,
    label,
    onClick,
  }) => (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs text-left text-secondary hover:text-primary hover:bg-[var(--surface-2)] font-semibold transition-colors"
    >
      {icon}
      <span>{label}</span>
    </button>
  );

  return (
    <div
      ref={containerRef}
      style={
        position
          ? { left: `${position.x}px`, top: `${position.y}px`, bottom: 'auto', right: 'auto' }
          : undefined
      }
      className={`${cornerClasses} z-40 select-none touch-none`}
    >
      <div className="relative group">
        {/* Menú rápido */}
        {showQuickMenu && (
          <div
            className={`absolute mb-2 ${corner.includes('right') ? 'right-0' : 'left-0'} ${
              corner.includes('top') ? 'top-16' : 'bottom-16'
            } w-60 card p-2 z-50 !shadow-[var(--shadow-pop)] space-y-0.5`}
          >
            <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-[var(--border-subtle)]">
              <span className="flex items-center gap-1.5 text-xs font-bold text-primary">
                <Sparkles className="w-3.5 h-3.5 text-accent" aria-hidden />
                Acciones IA
              </span>
              <button
                onClick={() => setShowQuickMenu(false)}
                aria-label="Cerrar menú"
                className="btn btn-ghost btn-icon !p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <QuickAction
              icon={<Mic className="w-4 h-4 text-accent" />}
              label="Hablar con el asistente"
              onClick={() => {
                setShowQuickMenu(false);
                onOpenVoiceAssistant();
              }}
            />
            {onOpenScanner && (
              <QuickAction
                icon={<Camera className="w-4 h-4 text-income" />}
                label="Escanear recibo / ticket"
                onClick={() => {
                  setShowQuickMenu(false);
                  onOpenScanner();
                }}
              />
            )}
            <QuickAction
              icon={<TrendingUp className="w-4 h-4 text-goal" />}
              label="Diagnóstico financiero"
              onClick={() => {
                setShowQuickMenu(false);
                onOpenVoiceAssistant('¿Cómo está mi salud financiera actual y qué me recomiendas para optimizarla?');
              }}
            />
            <button
              onClick={toggleTheme}
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs text-left font-bold transition-all ${
                isNeon
                  ? 'bg-[var(--accent-soft)] text-accent border border-[var(--accent-border)]'
                  : 'text-secondary hover:text-primary hover:bg-[var(--surface-2)]'
              }`}
            >
              <span className="flex items-center gap-2">
                <Zap className={`w-4 h-4 ${isNeon ? 'text-accent animate-pulse' : 'text-muted'}`} aria-hidden />
                <span>{isNeon ? 'Modo Neón activo' : 'Activar modo Neón'}</span>
              </span>
              <span className={`w-2 h-2 rounded-full ${isNeon ? 'bg-[var(--accent)]' : 'bg-[var(--border-strong)]'}`} />
            </button>

            {/* Posición en esquinas */}
            <div className="pt-1.5 border-t border-[var(--border-subtle)] px-2 py-1 flex items-center justify-between text-[11px] text-muted">
              <span>Posición:</span>
              <div className="flex items-center gap-1">
                {(['top-left', 'top-right', 'bottom-left', 'bottom-right'] as DockCorner[]).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      setPosition(null);
                      setCorner(c);
                    }}
                    className={`w-5 h-5 rounded text-[9px] font-bold flex items-center justify-center border transition-colors ${
                      corner === c
                        ? 'bg-gradient-aura text-white border-transparent'
                        : 'inset text-muted hover:text-primary'
                    }`}
                    title={`Mover a esquina ${c}`}
                  >
                    {c === 'top-left' ? 'TL' : c === 'top-right' ? 'TR' : c === 'bottom-left' ? 'BL' : 'BR'}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-1 border-t border-[var(--border-subtle)] flex items-center justify-between gap-1 text-[11px]">
              <button
                type="button"
                onClick={() => {
                  setShowQuickMenu(false);
                  setIsMinimizedAtEdge(true);
                }}
                className="text-muted hover:text-primary px-2 py-1 rounded hover:bg-[var(--surface-2)] font-semibold"
                title="Minimizar al borde de la pantalla"
              >
                Minimizar
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowQuickMenu(false);
                  onToggleVisibility(false);
                }}
                className="text-expense font-bold px-2 py-1 rounded hover:bg-[var(--expense-soft)]"
                title="Eliminar de la pantalla"
              >
                Quitar
              </button>
            </div>
          </div>
        )}

        {/* Orbe principal */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleVisibility(false);
            }}
            className="w-6 h-6 rounded-full flex items-center justify-center shadow-md backdrop-blur-md transition-all active:scale-90 border bg-[var(--surface-glass)] text-muted hover:text-expense border-[var(--border-default)]"
            title="Quitar el asistente de la pantalla"
            aria-label="Quitar el asistente de la pantalla"
          >
            <X className="w-3.5 h-3.5" />
          </button>

          <div
            onMouseDown={(e) => handleStartDrag(e.clientX, e.clientY)}
            onTouchStart={(e) => {
              if (e.touches[0]) handleStartDrag(e.touches[0].clientX, e.touches[0].clientY);
            }}
            className="cursor-grab active:cursor-grabbing p-1 rounded-full text-muted hover:text-primary opacity-70 hover:opacity-100"
            title="Arrastra para mover el asistente"
          >
            <Move className="w-3.5 h-3.5" aria-hidden />
          </div>

          <div className="relative">
            <div className="absolute -inset-1 rounded-full blur-md bg-gradient-aura opacity-50 group-hover:opacity-80 animate-pulse transition-opacity duration-500" />
            <button
              type="button"
              onClick={handleOrbClick}
              onContextMenu={(e) => {
                e.preventDefault();
                setShowQuickMenu(!showQuickMenu);
              }}
              className="relative flex items-center gap-2.5 px-4 sm:px-5 py-3 rounded-full bg-gradient-aura text-white font-extrabold text-xs sm:text-sm active:scale-95 transition-all shadow-[var(--glow-accent)] hover:brightness-110"
              title="Hablar con el asistente IA (clic derecho para opciones)"
            >
              <span className="relative flex items-center justify-center">
                <Mic className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden />
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[var(--income)] rounded-full border-2 border-[var(--surface-1)] animate-ping" />
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[var(--income)] rounded-full border-2 border-[var(--surface-1)]" />
              </span>
              <span className="tracking-tight hidden sm:inline font-black">Asistente IA</span>
            </button>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowQuickMenu(!showQuickMenu);
            }}
            className="w-7 h-7 rounded-full bg-[var(--surface-glass)] hover:bg-[var(--surface-2)] text-accent border border-[var(--border-default)] flex items-center justify-center shadow-md backdrop-blur-md transition-all active:scale-90"
            title="Opciones rápidas"
            aria-label="Opciones rápidas del asistente"
          >
            <Sliders className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};