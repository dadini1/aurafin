/**
 * Panel de empresas afiliadas (solo superadmin/dueno):
 * - Crear / editar empresas con branding editable (logo, colores, eslogan).
 * - Gestionar usuarios y roles independientes por empresa.
 * - Ver diagnóstico del sistema (nube ↔ disco G:).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Building2, Check, ImagePlus, Loader2, Palette, PlusCircle, RefreshCw,
  Trash2, UserPlus, Activity,
} from 'lucide-react';
import { Badge, Button, EmptyState, Field, Input, Modal, Select, SectionHeader } from '../ui';
import { aurafinApi, type MarcaEmpresa } from '../../services/aurafinApi';
import { useEmpresa } from '../../context/EmpresaContext';

interface EmpresaAdmin extends MarcaEmpresa {
  id?: string;
  estado?: string;
}

interface EstadoSistema {
  nube?: { habilitada?: boolean; disponible?: boolean };
  disco?: { baseDir?: string };
  sincronizacion?: { bandajaPendientes?: number };
}

interface UsuarioEmpresa {
  id: string;
  nombre: string;
  correo: string;
  rol: string;
  estado: string;
}

const PALETA_RAPIDA = [
  { nombre: 'Esmeralda', primario: '#0d9488', secundario: '#7c3aed' },
  { nombre: 'Índigo', primario: '#3D47E0', secundario: '#7D85FF' },
  { nombre: 'Ámbar', primario: '#d97706', secundario: '#b45309' },
  { nombre: 'Carmesí', primario: '#e11d48', secundario: '#9f1239' },
  { nombre: 'Cian', primario: '#0891b2', secundario: '#0e7490' },
  { nombre: 'Violeta', primario: '#7c3aed', secundario: '#a855f7' },
];

interface Props {
  abierto: boolean;
  onCerrar: () => void;
}

export const PanelEmpresasModal: React.FC<Props> = ({ abierto, onCerrar }) => {
  const { usuario, empresa: empresaSesion, actualizarMarcaLocal } = useEmpresa();
  const [empresas, setEmpresas] = useState<EmpresaAdmin[]>([]);
  const [seleccionada, setSeleccionada] = useState<EmpresaAdmin | null>(null);
  const [usuarios, setUsuarios] = useState<UsuarioEmpresa[]>([]);
  const [estado, setEstado] = useState<EstadoSistema | null>(null);
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [nueva, setNueva] = useState({ slug: '', nombre: '', eslogan: '' });
  const [nuevoUsuario, setNuevoUsuario] = useState({ nombre: '', correo: '', password: '', rol: 'empleado' });
  const inputLogo = useRef<HTMLInputElement>(null);

  const cargarTodo = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const lista = await aurafinApi.listarEmpresas();
      setEmpresas((lista.empresas || []) as EmpresaAdmin[]);
      try {
        setEstado(await aurafinApi.estadoSistema());
      } catch {
        setEstado(null); // rol insuficiente
      }
      setSeleccionada((prev) => (prev ? (lista.empresas || []).find((e) => e.slug === prev.slug) ?? null : null));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar empresas');
    } finally {
      setCargando(false);
    }
  }, []);

  const cargarUsuarios = useCallback(async (e: EmpresaAdmin) => {
    if (!e.id) return;
    try {
      const r = await aurafinApi.listarUsuarios(e.id);
      setUsuarios(r.usuarios || []);
    } catch {
      setUsuarios([]);
    }
  }, []);

  useEffect(() => {
    if (abierto) cargarTodo();
  }, [abierto, cargarTodo]);

  useEffect(() => {
    if (seleccionada?.id) cargarUsuarios(seleccionada);
  }, [seleccionada, cargarUsuarios]);

  const elegir = (e: EmpresaAdmin) => {
    setSeleccionada(e);
    setMensaje('');
    setError('');
  };

  const alCambiarLogo = (evento: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = evento.target.files?.[0];
    if (!archivo || !seleccionada) return;
    if (archivo.size > 1_000_000) {
      setError('El logo supera 1 MB; comprímelo e inténtalo de nuevo.');
      return;
    }
    const lector = new FileReader();
    lector.onload = () => {
      setSeleccionada({ ...seleccionada, logo_url: String(lector.result) });
      setMensaje('Logo listo — pulsa Guardar cambios para aplicarlo.');
    };
    lector.readAsDataURL(archivo);
  };

  const guardarCambios = async () => {
    if (!seleccionada?.id) return;
    setError('');
    setCargando(true);
    try {
      await aurafinApi.actualizarEmpresa(seleccionada.id, {
        nombre: seleccionada.nombre,
        eslogan: seleccionada.eslogan,
        logo_url: seleccionada.logo_url,
        colores: seleccionada.colores,
      });
      setMensaje('Cambios guardados y replicados.');
      if (seleccionada.slug === empresaSesion.slug) {
        actualizarMarcaLocal({
          slug: seleccionada.slug,
          nombre: seleccionada.nombre,
          eslogan: seleccionada.eslogan,
          logo_url: seleccionada.logo_url,
          colores: seleccionada.colores,
        });
      }
      await cargarTodo();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar');
    } finally {
      setCargando(false);
    }
  };

  const crearEmpresa = async () => {
    setError('');
    setCargando(true);
    try {
      await aurafinApi.crearEmpresa({
        slug: nueva.slug.trim().toLowerCase(),
        nombre: nueva.nombre.trim(),
        eslogan: nueva.eslogan.trim(),
        colores: PALETA_RAPIDA[0],
      });
      setNueva({ slug: '', nombre: '', eslogan: '' });
      setMensaje('Empresa creada con su carpeta propia en disco y en la nube.');
      await cargarTodo();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la empresa');
    } finally {
      setCargando(false);
    }
  };

  const crearUsuario = async () => {
    if (!seleccionada?.id) return;
    setError('');
    setCargando(true);
    try {
      await aurafinApi.crearUsuario(seleccionada.id, nuevoUsuario);
      setNuevoUsuario({ nombre: '', correo: '', password: '', rol: 'empleado' });
      setMensaje('Usuario creado con acceso a esta empresa.');
      await cargarUsuarios(seleccionada);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el usuario');
    } finally {
      setCargando(false);
    }
  };

  const quitarLogo = () => {
    if (seleccionada) setSeleccionada({ ...seleccionada, logo_url: '' });
  };

  return (
    <Modal open={abierto} onClose={onCerrar} title="Empresas afiliadas" icon={<Building2 className="w-5 h-5" />} maxWidth="max-w-3xl">
      <div className="space-y-5">
        {/* Estado del sistema */}
        {estado && (
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <Badge tone={estado.nube?.habilitada ? 'income' : 'expense'}>
              <Activity className="w-3 h-3" /> Nube: {estado.nube?.habilitada ? (estado.nube.disponible ? 'conectada' : 'sin respuesta') : 'no configurada'}
            </Badge>
            <Badge tone="info">Espejo G:: {String(estado.disco?.baseDir ?? '—')}</Badge>
            <Badge tone="neutral">Reenvíos pendientes: {String(estado.sincronizacion?.bandajaPendientes ?? 0)}</Badge>
          </div>
        )}

        {/* Lista de empresas */}
        <SectionHeader title="Cartera de empresas" subtitle={`${empresas.length} afiliada(s)`} />
        {cargando && empresas.length === 0 ? (
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] py-4"><Loader2 className="w-4 h-4 animate-spin" /> Cargando…</div>
        ) : empresas.length === 0 ? (
          <EmptyState icon={<Building2 className="w-6 h-6" />} title="Sin empresas afiliadas" description="Crea la primera empresa con su marca y usuarios propios." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {empresas.map((e) => (
              <button
                key={e.slug}
                type="button"
                onClick={() => elegir(e)}
                className={`text-left rounded-2xl border p-3 transition-colors ${
                  seleccionada?.slug === e.slug
                    ? 'border-[var(--accent-border)] bg-[var(--accent-soft)]'
                    : 'border-[var(--border-subtle)] hover:bg-[var(--surface-hover,rgba(255,255,255,0.03))]'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {e.logo_url ? (
                    <img src={e.logo_url} alt="" className="w-9 h-9 rounded-xl object-cover shrink-0" />
                  ) : (
                    <span className="w-9 h-9 rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] grid place-items-center font-bold text-sm shrink-0">
                      {e.nombre.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{e.nombre}</p>
                    <p className="text-[11px] text-[var(--text-muted)] truncate">{e.slug}</p>
                  </div>
                  {seleccionada?.slug === e.slug && <Check className="w-4 h-4 text-[var(--accent)] ml-auto shrink-0" />}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Crear empresa */}
        {usuario?.rol === 'superadmin' && (
          <div className="rounded-2xl border border-[var(--border-subtle)] p-4 space-y-3">
            <p className="text-xs font-semibold flex items-center gap-1.5"><PlusCircle className="w-4 h-4 text-[var(--accent)]" /> Afiliar nueva empresa</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Input placeholder="slug (ej. acme-bolivia)" value={nueva.slug} onChange={(e) => setNueva({ ...nueva, slug: e.target.value })} />
              <Input placeholder="Nombre comercial" value={nueva.nombre} onChange={(e) => setNueva({ ...nueva, nombre: e.target.value })} />
              <Input placeholder="Eslogan (opcional)" value={nueva.eslogan} onChange={(e) => setNueva({ ...nueva, eslogan: e.target.value })} />
            </div>
            <Button size="sm" variant="secondary" onClick={crearEmpresa} disabled={cargando || !nueva.slug || !nueva.nombre}>
              <PlusCircle className="w-4 h-4" /> Crear empresa
            </Button>
          </div>
        )}

        {/* Editor de branding */}
        {seleccionada && (
          <div className="rounded-2xl border border-[var(--border-subtle)] p-4 space-y-4">
            <SectionHeader title={`Marca · ${seleccionada.nombre}`} subtitle="Editable: logo, colores y textos" />

            <div className="flex items-center gap-4">
              {seleccionada.logo_url ? (
                <img src={seleccionada.logo_url} alt="Logo" className="w-16 h-16 rounded-2xl object-cover border border-[var(--border-subtle)]" />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-[var(--accent-soft)] grid place-items-center text-[var(--accent)]">
                  <Building2 className="w-7 h-7" />
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <input ref={inputLogo} type="file" accept="image/*" hidden onChange={alCambiarLogo} />
                <Button size="sm" variant="secondary" onClick={() => inputLogo.current?.click()}>
                  <ImagePlus className="w-4 h-4" /> Cambiar logo
                </Button>
                {seleccionada.logo_url && (
                  <Button size="sm" variant="ghost" onClick={quitarLogo}><Trash2 className="w-4 h-4" /> Quitar</Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Nombre"><Input value={seleccionada.nombre} onChange={(e) => setSeleccionada({ ...seleccionada, nombre: e.target.value })} /></Field>
              <Field label="Eslogan"><Input value={seleccionada.eslogan || ''} onChange={(e) => setSeleccionada({ ...seleccionada, eslogan: e.target.value })} /></Field>
            </div>

            <div>
              <p className="text-xs font-semibold flex items-center gap-1.5 mb-2"><Palette className="w-4 h-4 text-[var(--accent)]" /> Paleta de la empresa (web y app)</p>
              <div className="flex flex-wrap gap-2">
                {PALETA_RAPIDA.map((p) => (
                  <button
                    key={p.nombre}
                    type="button"
                    title={p.nombre}
                    onClick={() => setSeleccionada({ ...seleccionada, colores: { primario: p.primario, secundario: p.secundario, acento: p.primario } })}
                    className={`w-9 h-9 rounded-xl border-2 transition-transform hover:scale-110 ${
                      seleccionada.colores?.primario === p.primario ? 'border-[var(--accent)]' : 'border-transparent'
                    }`}
                    style={{ background: `linear-gradient(135deg, ${p.primario}, ${p.secundario})` }}
                    aria-label={`Paleta ${p.nombre}`}
                  />
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <Field label="Color primario">
                  <Input type="color" value={seleccionada.colores?.primario || '#0d9488'} onChange={(e) => setSeleccionada({ ...seleccionada, colores: { ...seleccionada.colores, primario: e.target.value, secundario: seleccionada.colores?.secundario || '#7c3aed', acento: seleccionada.colores?.acento || e.target.value } })} className="h-9" />
                </Field>
                <Field label="Color secundario">
                  <Input type="color" value={seleccionada.colores?.secundario || '#7c3aed'} onChange={(e) => setSeleccionada({ ...seleccionada, colores: { ...seleccionada.colores, secundario: e.target.value, primario: seleccionada.colores?.primario || '#0d9488', acento: seleccionada.colores?.acento || '#0f9f7a' } })} className="h-9" />
                </Field>
              </div>
            </div>

            <Button onClick={guardarCambios} disabled={cargando}>
              {cargando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Guardar cambios
            </Button>
          </div>
        )}

        {/* Usuarios de la empresa seleccionada */}
        {seleccionada?.id && (
          <div className="rounded-2xl border border-[var(--border-subtle)] p-4 space-y-3">
            <SectionHeader title={`Usuarios · ${seleccionada.nombre}`} subtitle="Autorizaciones independientes por empresa" />
            <div className="space-y-1.5">
              {usuarios.length === 0 && <p className="text-xs text-[var(--text-muted)]">Sin usuarios adicionales.</p>}
              {usuarios.map((u) => (
                <div key={u.id} className="flex items-center justify-between gap-2 text-xs rounded-xl border border-[var(--border-subtle)] px-3 py-2">
                  <div className="min-w-0"><p className="font-semibold truncate">{u.nombre}</p><p className="text-[var(--text-muted)] truncate">{u.correo}</p></div>
                  <Badge tone={u.rol === 'dueno' ? 'income' : 'neutral'}>{u.rol}</Badge>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <Input placeholder="Nombre" value={nuevoUsuario.nombre} onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, nombre: e.target.value })} />
              <Input type="email" placeholder="Correo" value={nuevoUsuario.correo} onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, correo: e.target.value })} />
              <Input type="password" placeholder="Contraseña (8+)" value={nuevoUsuario.password} onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, password: e.target.value })} />
              <Select value={nuevoUsuario.rol} onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, rol: e.target.value })}>
                <option value="empleado">empleado</option>
                <option value="lectura">lectura</option>
                <option value="admin_empresa">admin_empresa</option>
                <option value="dueno">dueno</option>
              </Select>
            </div>
            <Button size="sm" variant="secondary" onClick={crearUsuario} disabled={cargando}>
              <UserPlus className="w-4 h-4" /> Agregar usuario
            </Button>
          </div>
        )}

        {error && <p role="alert" className="text-xs text-red-500 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{error}</p>}
        {mensaje && <p className="text-xs text-[var(--accent)] bg-[var(--accent-soft)] rounded-xl px-3 py-2 flex items-center gap-1.5"><RefreshCw className="w-3.5 h-3.5" /> {mensaje}</p>}
      </div>
    </Modal>
  );
};
