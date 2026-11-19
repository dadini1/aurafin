import React, { useState } from 'react';
import { KeyRound, Loader2, ShieldCheck, X } from 'lucide-react';
import { useEmpresa } from '../../context/EmpresaContext';

interface CambioPasswordModalProps {
  /** Obligatorio: no se puede cerrar hasta cambiar la contraseña temporal. */
  obligatorio?: boolean;
  onClose?: () => void;
}

/**
 * Cambio de contraseña (forzado cuando la cuenta usa una temporal).
 * Mínimo 8 caracteres, con confirmación y validación en el servidor.
 */
export const CambioPasswordModal: React.FC<CambioPasswordModalProps> = ({ obligatorio = false, onClose }) => {
  const { cambiarPassword } = useEmpresa();
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState(false);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (nueva.length < 8) {
      setError('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (nueva !== confirmar) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setEnviando(true);
    try {
      await cambiarPassword(actual, nueva);
      setListo(true);
      if (!obligatorio) setTimeout(() => onClose?.(), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar la contraseña');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md card p-6 space-y-4" role="dialog" aria-modal="true" aria-label="Cambiar contraseña">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl inset flex items-center justify-center text-accent">
              <KeyRound className="w-5 h-5" aria-hidden />
            </span>
            <div>
              <h2 className="text-base font-black text-primary">Cambiar contraseña</h2>
              <p className="text-xs text-muted">
                {obligatorio
                  ? 'Tu contraseña es temporal. Crea una nueva de al menos 8 caracteres para continuar.'
                  : 'Actualiza tu contraseña de acceso.'}
              </p>
            </div>
          </div>
          {!obligatorio && (
            <button type="button" onClick={onClose} className="btn btn-ghost btn-icon !p-1.5" aria-label="Cerrar">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {listo ? (
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--income)]">
            <ShieldCheck className="w-5 h-5" /> Contraseña actualizada correctamente.
          </div>
        ) : (
          <form onSubmit={enviar} className="space-y-3">
            <label className="block">
              <span className="eyebrow !text-[10px]">Contraseña actual (temporal)</span>
              <input
                type="password"
                value={actual}
                onChange={(e) => setActual(e.target.value)}
                required
                autoComplete="current-password"
                className="input w-full mt-1"
                placeholder="••••••••"
              />
            </label>
            <label className="block">
              <span className="eyebrow !text-[10px]">Nueva contraseña (mín. 8)</span>
              <input
                type="password"
                value={nueva}
                onChange={(e) => setNueva(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className="input w-full mt-1"
                placeholder="••••••••"
              />
            </label>
            <label className="block">
              <span className="eyebrow !text-[10px]">Confirmar nueva contraseña</span>
              <input
                type="password"
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className="input w-full mt-1"
                placeholder="••••••••"
              />
            </label>
            {error && <p className="text-xs font-semibold text-[var(--expense)]">{error}</p>}
            <button type="submit" disabled={enviando} className="btn btn-primary w-full">
              {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              {enviando ? 'Guardando…' : 'Guardar contraseña'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
