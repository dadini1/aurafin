import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Award, CheckCircle2, PartyPopper, Sparkles, Trophy, X } from 'lucide-react';
import { SavingsGoal, UserFinancialProfile } from '../types';
import { useTheme } from '../context/ThemeContext';

export type GoalMilestoneTier = 50 | 75 | 100;

export interface GoalMilestoneEvent {
  id: string;
  goalId: string;
  goalTitle: string;
  milestone: GoalMilestoneTier;
  currentAmount: number;
  targetAmount: number;
  exactPercent: number;
  isReplay?: boolean;
}

interface GoalMilestoneConfettiCelebrationProps {
  goals: SavingsGoal[];
  profile: UserFinancialProfile;
  manualReplayEvent?: GoalMilestoneEvent | null;
  onClearManualReplay?: () => void;
}

interface ConfettiParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
  flutterPhase: number;
  flutterSpeed: number;
  shape: 'ribbon' | 'circle' | 'star';
  alpha: number;
  decay: number;
  gravity: number;
}

const TIER_CONFIG: Record<
  GoalMilestoneTier,
  {
    headline: string;
    subtext: string;
    colors: string[];
    particleCount: number;
    badgeLight: string;
    badgeDark: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  50: {
    headline: '¡50% alcanzado · Mitad del camino!',
    subtext: 'Ya superaste la primera mitad de esta meta de ahorro.',
    colors: ['#06b6d4', '#10b981', '#14b8a6', '#38bdf8', '#6ee7b7'],
    particleCount: 95,
    badgeLight: 'bg-cyan-50 text-cyan-800 border-cyan-200',
    badgeDark: 'bg-cyan-500/20 text-cyan-200 border-cyan-400/40',
    icon: Sparkles,
  },
  75: {
    headline: '¡75% alcanzado · Recta final!',
    subtext: 'Estás a solo un último impulso de completar tu objetivo.',
    colors: ['#6366f1', '#a855f7', '#06b6d4', '#ec4899', '#c4b5fd'],
    particleCount: 135,
    badgeLight: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    badgeDark: 'bg-indigo-500/20 text-indigo-200 border-indigo-400/40',
    icon: Award,
  },
  100: {
    headline: '¡100% completado · Meta cumplida!',
    subtext: 'Felicidades, alcanzaste el 100% del monto objetivo.',
    colors: ['#f59e0b', '#10b981', '#eab308', '#06b6d4', '#ec4899', '#fde047'],
    particleCount: 210,
    badgeLight: 'bg-amber-50 text-amber-900 border-amber-300',
    badgeDark: 'bg-amber-500/20 text-amber-200 border-amber-400/40',
    icon: Trophy,
  },
};

const THRESHOLDS: GoalMilestoneTier[] = [50, 75, 100];

export const GoalMilestoneConfettiCelebration: React.FC<GoalMilestoneConfettiCelebrationProps> = ({
  goals,
  profile,
  manualReplayEvent,
  onClearManualReplay,
}) => {
  const { isNitido } = useTheme();
  const currSym = profile.currencySymbol || '$';

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<ConfettiParticle[]>([]);
  const rafRef = useRef<number | null>(null);
  const prevPercentsRef = useRef<Record<string, number> | null>(null);
  const dismissTimerRef = useRef<number | null>(null);
  const dismissBtnRef = useRef<HTMLButtonElement | null>(null);

  const [activeEvent, setActiveEvent] = useState<GoalMilestoneEvent | null>(null);
  const [burstCount, setBurstCount] = useState(0);

  const spawnBurst = useCallback(
    (originX: number, originY: number, colors: string[], count: number, spread = 1) => {
      const shapes: ConfettiParticle['shape'][] = ['ribbon', 'circle', 'star'];
      for (let i = 0; i < count; i++) {
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.25 * spread;
        const speed = 5 + Math.random() * 11;
        particlesRef.current.push({
          x: originX,
          y: originY,
          vx: Math.cos(angle) * speed + (Math.random() - 0.5) * 3,
          vy: Math.sin(angle) * speed - Math.random() * 3,
          size: 5 + Math.random() * 6,
          color: colors[i % colors.length],
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 0.24,
          flutterPhase: Math.random() * Math.PI * 2,
          flutterSpeed: 0.1 + Math.random() * 0.15,
          shape: shapes[i % shapes.length],
          alpha: 1,
          decay: 0.0055 + Math.random() * 0.005,
          gravity: 0.24 + Math.random() * 0.12,
        });
      }
    },
    []
  );

  const startAnimationLoop = useCallback(() => {
    if (rafRef.current !== null) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const drawStar = (cx: number, cy: number, outerR: number) => {
      const innerR = outerR * 0.45;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const r = i % 2 === 0 ? outerR : innerR;
        const a = (i * Math.PI) / 4;
        const px = cx + Math.cos(a) * r;
        const py = cy + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    };

    const tick = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
        resize();
      }

      ctx.clearRect(0, 0, width, height);

      const nextParticles: ConfettiParticle[] = [];
      for (const p of particlesRef.current) {
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.985;
        p.vy += p.gravity;
        p.rotation += p.rotationSpeed;
        p.flutterPhase += p.flutterSpeed;
        p.alpha -= p.decay;

        if (p.alpha > 0.02 && p.y < height + 40) {
          nextParticles.push(p);

          ctx.save();
          ctx.globalAlpha = Math.max(0, p.alpha);
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.fillStyle = p.color;

          if (p.shape === 'circle') {
            ctx.beginPath();
            ctx.arc(0, 0, p.size * 0.45, 0, Math.PI * 2);
            ctx.fill();
          } else if (p.shape === 'star') {
            drawStar(0, 0, p.size * 0.72);
          } else {
            const scaleY = 0.4 + Math.abs(Math.cos(p.flutterPhase)) * 0.6;
            ctx.scale(1, scaleY);
            ctx.fillRect(-p.size * 0.55, -p.size * 0.3, p.size * 1.1, p.size * 0.6);
          }
          ctx.restore();
        }
      }

      particlesRef.current = nextParticles;
      if (nextParticles.length > 0) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, width, height);
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const triggerCelebration = useCallback(
    (event: GoalMilestoneEvent) => {
      setActiveEvent(event);
      setBurstCount((c) => c + 1);

      if (dismissTimerRef.current !== null) {
        window.clearTimeout(dismissTimerRef.current);
      }
      dismissTimerRef.current = window.setTimeout(() => {
        setActiveEvent(null);
      }, 6500);

      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      if (prefersReducedMotion) return;

      const cfg = TIER_CONFIG[event.milestone];
      const w = window.innerWidth;
      const h = window.innerHeight;

      if (event.milestone === 100) {
        spawnBurst(w * 0.2, h * 0.78, cfg.colors, Math.round(cfg.particleCount * 0.35), 0.9);
        spawnBurst(w * 0.8, h * 0.78, cfg.colors, Math.round(cfg.particleCount * 0.35), 0.9);
        spawnBurst(w * 0.5, h * 0.45, cfg.colors, Math.round(cfg.particleCount * 0.4), 1.3);
      } else {
        spawnBurst(w * 0.5, h * 0.65, cfg.colors, cfg.particleCount, 1.15);
      }

      startAnimationLoop();
    },
    [spawnBurst, startAnimationLoop]
  );

  // Detect upward crossings of 50%, 75%, and 100% on individual SavingsGoal targets
  useEffect(() => {
    const currentPercents: Record<string, number> = {};
    goals.forEach((g) => {
      const target = Math.max(1, Number(g.targetAmount) || 1);
      const saved = Math.max(0, Number(g.currentAmount) || 0);
      currentPercents[g.id] = (saved / target) * 100;
    });

    if (prevPercentsRef.current === null) {
      prevPercentsRef.current = currentPercents;
      return;
    }

    const prevMap = prevPercentsRef.current;
    let highestTriggered: GoalMilestoneEvent | null = null;

    for (const g of goals) {
      const prevPct = prevMap[g.id] ?? 0;
      const currPct = currentPercents[g.id] ?? 0;
      if (currPct <= prevPct) continue;

      for (const tier of THRESHOLDS) {
        if (prevPct < tier && currPct >= tier) {
          if (!highestTriggered || tier >= highestTriggered.milestone) {
            highestTriggered = {
              id: `${g.id}-${tier}-${Date.now()}`,
              goalId: g.id,
              goalTitle: g.title,
              milestone: tier,
              currentAmount: g.currentAmount,
              targetAmount: g.targetAmount,
              exactPercent: Math.min(100, Math.round(currPct)),
            };
          }
        }
      }
    }

    prevPercentsRef.current = currentPercents;

    if (highestTriggered) {
      triggerCelebration(highestTriggered);
    }
  }, [goals, triggerCelebration]);

  // Handle manual replay triggered from goal milestone badges
  useEffect(() => {
    if (!manualReplayEvent) return;
    triggerCelebration(manualReplayEvent);
    onClearManualReplay?.();
  }, [manualReplayEvent, onClearManualReplay, triggerCelebration]);

  // Interactive click-anywhere-to-pop confetti while a milestone celebration is active
  useEffect(() => {
    if (!activeEvent) return;

    const handlePointerBurst = (e: PointerEvent) => {
      if (dismissBtnRef.current && dismissBtnRef.current.contains(e.target as Node)) {
        return;
      }
      const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      if (prefersReducedMotion) return;

      const cfg = TIER_CONFIG[activeEvent.milestone];
      spawnBurst(e.clientX, e.clientY, cfg.colors, 45, 1.35);
      setBurstCount((c) => c + 1);
      startAnimationLoop();
    };

    window.addEventListener('pointerdown', handlePointerBurst);
    return () => {
      window.removeEventListener('pointerdown', handlePointerBurst);
    };
  }, [activeEvent, spawnBurst, startAnimationLoop]);

  // Cleanup animation frame and timer on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (dismissTimerRef.current !== null) window.clearTimeout(dismissTimerRef.current);
    };
  }, []);

  const handleExtraBurst = () => {
    if (!activeEvent) return;
    const cfg = TIER_CONFIG[activeEvent.milestone];
    spawnBurst(window.innerWidth * 0.5, window.innerHeight * 0.55, cfg.colors, 90, 1.35);
    setBurstCount((c) => c + 1);
    startAnimationLoop();

    if (dismissTimerRef.current !== null) {
      window.clearTimeout(dismissTimerRef.current);
    }
    dismissTimerRef.current = window.setTimeout(() => {
      setActiveEvent(null);
    }, 6500);
  };

  const handleClose = () => {
    if (dismissTimerRef.current !== null) {
      window.clearTimeout(dismissTimerRef.current);
    }
    setActiveEvent(null);
  };

  const activeTierCfg = activeEvent ? TIER_CONFIG[activeEvent.milestone] : null;
  const TierIcon = activeTierCfg ? activeTierCfg.icon : PartyPopper;

  return (
    <>
      {/* Full-viewport 60fps Canvas Confetti Layer */}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="fixed inset-0 z-50 pointer-events-none w-full h-full"
      />

      {/* Interactive Celebration Card */}
      {activeEvent && activeTierCfg && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-24 sm:bottom-6 right-4 sm:right-6 z-50 w-[calc(100vw-2rem)] max-w-sm rounded-2xl border p-4 shadow-2xl backdrop-blur-md transition-all animate-in fade-in slide-in-from-bottom-4 ${
            isNitido
              ? 'bg-white/95 border-slate-200 text-slate-900'
              : 'bg-slate-900/95 border-slate-700 text-slate-100'
          }`}
        >
          <div className="flex items-start gap-3">
            <div
              className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${
                isNitido ? activeTierCfg.badgeLight : activeTierCfg.badgeDark
              }`}
            >
              <TierIcon className="w-5 h-5" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border tabular-nums ${
                    isNitido ? activeTierCfg.badgeLight : activeTierCfg.badgeDark
                  }`}
                >
                  <CheckCircle2 className="w-3 h-3" />
                  Hito {activeEvent.milestone}%
                </span>

                <button
                  ref={dismissBtnRef}
                  type="button"
                  onClick={handleClose}
                  aria-label="Cerrar celebración"
                  className={`p-1 rounded-lg transition-colors ${
                    isNitido
                      ? 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <h4 className="text-sm font-bold mt-1.5 leading-snug">{activeTierCfg.headline}</h4>
              <p className={`text-xs mt-0.5 truncate font-semibold ${isNitido ? 'text-slate-800' : 'text-white'}`}>
                {activeEvent.goalTitle}
              </p>
              <p className={`text-[11px] mt-1 tabular-nums ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
                {currSym}{activeEvent.currentAmount.toLocaleString()} de {currSym}
                {activeEvent.targetAmount.toLocaleString()} ({activeEvent.exactPercent}%)
              </p>

              <div className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-slate-200/80 dark:border-slate-800">
                <span className={`text-[11px] ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
                  Haz clic donde quieras ({burstCount})
                </span>
                <button
                  type="button"
                  onClick={handleExtraBurst}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${
                    isNitido
                      ? 'bg-slate-900 hover:bg-slate-800 text-white'
                      : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
                  }`}
                >
                  <PartyPopper className="w-3.5 h-3.5" />
                  <span>+ Más confeti</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
