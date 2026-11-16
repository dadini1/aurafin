import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Download,
  Share2,
  PlusSquare,
  Check,
  X,
  Sparkles,
  Apple,
  ExternalLink,
} from 'lucide-react';

interface MobileInstallPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MobileInstallPromptModal: React.FC<MobileInstallPromptModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activePlatform, setActivePlatform] = useState<'ios' | 'android'>('android');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Detect device OS
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
    if (/iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream) {
      setActivePlatform('ios');
    } else {
      setActivePlatform('android');
    }

    // Listen for Chromium install prompt
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Check if running in standalone mode (already installed)
    if (window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone) {
      setIsInstalled(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  if (!isOpen) return null;

  const handleNativeInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md overflow-y-auto animate-fadeIn">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-cyan-500 to-indigo-600 text-white shadow-lg shadow-cyan-500/20">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">Instalar App Móvil</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Acceso directo nativo para Android e iPhone
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Platform Selector Tabs */}
        <div className="p-4 sm:p-5 space-y-4">
          <div className="flex items-center p-1 rounded-2xl bg-slate-950 border border-slate-800">
            <button
              type="button"
              onClick={() => setActivePlatform('android')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                activePlatform === 'android'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>Android</span>
            </button>
            <button
              type="button"
              onClick={() => setActivePlatform('ios')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                activePlatform === 'ios'
                  ? 'bg-gradient-to-r from-cyan-500 to-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>iPhone / iOS</span>
            </button>
          </div>

          {/* Android Guide */}
          {activePlatform === 'android' && (
            <div className="space-y-3">
              {deferredPrompt ? (
                <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 text-center space-y-2">
                  <span className="text-xs text-emerald-200 font-semibold block">
                    ¡Tu navegador soporta instalación con un solo toque!
                  </span>
                  <button
                    onClick={handleNativeInstallClick}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs shadow-md transition-all flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>Instalar AuraFin en tu Android</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-start gap-3">
                    <span className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      1
                    </span>
                    <div className="text-xs text-slate-300">
                      <strong className="text-white block mb-0.5">Abre las opciones del navegador:</strong>
                      Toca el menú de <strong>tres puntos (⋮)</strong> en la esquina superior derecha de Google Chrome o Samsung Internet.
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-start gap-3">
                    <span className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      2
                    </span>
                    <div className="text-xs text-slate-300">
                      <strong className="text-white block mb-0.5">Selecciona Instalar:</strong>
                      Toca en <strong>"Instalar aplicación"</strong> o <strong>"Agregar a la pantalla principal"</strong>.
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-start gap-3">
                    <span className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      3
                    </span>
                    <div className="text-xs text-slate-300">
                      <strong className="text-white block mb-0.5">¡Listo!</strong>
                      AuraFin se agregará como una aplicación completa con pantalla completa y sin barras de navegador.
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* iPhone / iOS Guide */}
          {activePlatform === 'ios' && (
            <div className="space-y-2.5">
              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-start gap-3">
                <div className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  1
                </div>
                <div className="text-xs text-slate-300">
                  <strong className="text-white block mb-0.5">Abre en Safari de iPhone:</strong>
                  Asegúrate de estar navegando desde <strong>Safari</strong> (el navegador oficial de Apple).
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-start gap-3">
                <div className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  2
                </div>
                <div className="text-xs text-slate-300">
                  <strong className="text-white block mb-0.5">Toca el botón Compartir:</strong>
                  Presiona el icono de <strong>Compartir (cuadrado con flecha hacia arriba ⎋)</strong> en la barra inferior de Safari.
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-start gap-3">
                <div className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  3
                </div>
                <div className="text-xs text-slate-300">
                  <strong className="text-white block mb-0.5">Agregar a Inicio:</strong>
                  Baja en el menú y selecciona <strong>"Agregar a pantalla de inicio" ➕</strong>, luego pulsa <strong>"Agregar"</strong>.
                </div>
              </div>
            </div>
          )}

          {/* Advantages Callout */}
          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex items-center gap-2.5 text-xs text-slate-400">
            <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>
              Incluye soporte para gestos táctiles, cámara para escanear tickets y acceso directo con un toque.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition-colors"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
