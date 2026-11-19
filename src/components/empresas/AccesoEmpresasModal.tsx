/**
 * Acceso empresarial: selector de empresa afiliada + inicio de sesión.
 * Cada empresa mantiene usuarios y autorizaciones independientes.
 */
import { useEffect, useState } from 'react';
import { Building2, Loader2, LogIn, ShieldCheck } from 'lucide-react';
import { Button, Field, Input, Modal, Select } from '../ui';
import { aurafinApi, type MarcaEmpresa } from '../../services/aurafinApi';
import { useEmpresa } from '../../context/EmpresaContext';

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  onExito: () => void;
}

export const AccesoEmpresasModal: React.FC<Props> = ({ abierto, onCerrar, onExito }) => {
  const { iniciarSesion } = useEmpresa();
  const [empresas, setEmpresas] = useState<MarcaEmpresa[]>([]);
  const [slug, setSlug] = useState('');
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!abierto) return;
    aurafinApi
      .listarEmpresas()
      .then((r) => {
        setEmpresas(r.empresas || []);
        if (r.empresas?.length) setSlug(r.empresas[0].slug);
      })
      .catch(() => setEmpresas([]));
  }, [abierto]);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!correo || !password) {
      setError('Ingresa tu correo y contraseña.');
      return;
    }
    setCargando(true);
    try {
      await iniciarSesion(correo.trim().toLowerCase(), password);
      onExito();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión');
    } finally {
      setCargando(false);
    }
  };

  return (
    <Modal open={abierto} onClose={onCerrar} title="Acceso empresarial" icon={<Building2 className="w-5 h-5" />}>
      <form onSubmit={enviar} className="space-y-4">
        {empresas.length > 0 && (
          <Field label="Empresa afiliada">
            <Select value={slug} onChange={(e) => setSlug(e.target.value)}>
              {empresas.map((e) => (
                <option key={e.slug} value={e.slug}>{e.nombre}</option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Usuario o correo">
          <Input type="text" autoComplete="username" value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="Admin o usuario@empresa.com" />
        </Field>
        <Field label="Contraseña">
          <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        </Field>

        {error && (
          <p role="alert" className="text-xs font-medium text-red-500 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex items-center justify-between gap-3 pt-1">
          <p className="text-[11px] text-[var(--text-muted)] flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" /> Datos aislados por empresa (RLS)
          </p>
          <Button type="submit" disabled={cargando}>
            {cargando ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
            Entrar
          </Button>
        </div>
      </form>
    </Modal>
  );
};
