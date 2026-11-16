/**
 * Cliente Supabase vía REST (PostgREST) — sin dependencias externas.
 * La clave de servicio SOLO vive en el servidor; nunca se expone al cliente.
 *
 * Supabase es la fuente de verdad en la nube; el disco G: es el espejo local.
 */
import { config } from '../config.js';

interface PostgrestOpciones {
  filtro?: string; // ej. "slug=eq.aurafin-central"
  limite?: number;
  orden?: string; // ej. "created_at.desc"
  columnas?: string; // proyección
}

function cabeceras(extra: Record<string, string> = {}): Record<string, string> {
  return {
    apikey: config.supabase.serviceKey,
    Authorization: `Bearer ${config.supabase.serviceKey}`,
    'Content-Type': 'application/json',
    // Supabase rechaza secret keys con User-Agent de navegador; declaramos el servidor.
    'User-Agent': 'aurafin-server/1.0',
    ...extra,
  };
}

function url(tabla: string, opciones: PostgrestOpciones = {}): string {
  const params = new URLSearchParams();
  if (opciones.filtro) params.set(opciones.filtro.split('=')[0], opciones.filtro.slice(opciones.filtro.split('=')[0].length + 1));
  if (opciones.limite) params.set('limit', String(opciones.limite));
  if (opciones.orden) params.set('order', opciones.orden);
  if (opciones.columnas) params.set('select', opciones.columnas);
  const qs = params.toString();
  return `${config.supabase.url}/rest/v1/${tabla}${qs ? `?${qs}` : ''}`;
}

async function llamada<T>(metodo: string, urlCompleta: string, cuerpo?: unknown, cabecerasExtra: Record<string, string> = {}): Promise<T[]> {
  const respuesta = await fetch(urlCompleta, {
    method: metodo,
    headers: cabeceras(metodo === 'POST' || metodo === 'PATCH' ? { Prefer: 'return=representation', ...cabecerasExtra } : cabecerasExtra),
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  if (!respuesta.ok) {
    const detalle = await respuesta.text().catch(() => '');
    throw new Error(`Supabase ${metodo} ${respuesta.status}: ${detalle.slice(0, 300)}`);
  }
  if (respuesta.status === 204) return [];
  return (await respuesta.json()) as T[];
}

export const supabaseDisponible = (): boolean => config.supabase.habilitado;

/** Diagnóstico rápido: alcanza la API REST de Supabase. */
export async function saludSupabase(): Promise<{ disponible: boolean; detalle: string }> {
  if (!config.supabase.habilitado) return { disponible: false, detalle: 'SUPABASE_URL o SERVICE_ROLE_KEY ausentes' };
  try {
    const respuesta = await fetch(`${config.supabase.url}/rest/v1/`, { headers: cabeceras() });
    return { disponible: respuesta.ok, detalle: `HTTP ${respuesta.status}` };
  } catch (error) {
    return { disponible: false, detalle: String(error) };
  }
}

/* ---------------- Empresas ---------------- */

export interface EmpresaNube {
  id: string;
  slug: string;
  nombre: string;
  eslogan?: string;
  logo_url?: string;
  colores: { primario: string; secundario: string; acento: string };
  config: Record<string, unknown>;
  estado: 'activa' | 'suspendida';
  created_at?: string;
  updated_at?: string;
}

export const listarEmpresas = () => llamada<EmpresaNube>('GET', url('empresas', { orden: 'created_at.asc' }));

export const buscarEmpresaPorSlug = (slug: string) =>
  // URLSearchParams codifica el valor; no pre-encode (evita doble %40)
  llamada<EmpresaNube>('GET', url('empresas', { filtro: `slug=eq.${slug}`, limite: 1 }));

export const insertarEmpresa = (empresa: Partial<EmpresaNube>) => llamada<EmpresaNube>('POST', url('empresas'), empresa);

export const actualizarEmpresa = (id: string, cambios: Partial<EmpresaNube>) =>
  llamada<EmpresaNube>('PATCH', url('empresas', { filtro: `id=eq.${id}` }), cambios);

/* ---------------- Usuarios por empresa ---------------- */

export interface UsuarioNube {
  id: string;
  empresa_id: string;
  correo: string;
  password_hash: string;
  rol: 'superadmin' | 'dueno' | 'admin_empresa' | 'empleado' | 'lectura';
  nombre: string;
  estado: 'activo' | 'inactivo';
  created_at?: string;
}

export const listarUsuariosDeEmpresa = (empresaId: string) =>
  llamada<UsuarioNube>('GET', url('usuarios_empresa', { filtro: `empresa_id=eq.${empresaId}` }));

export const buscarUsuario = (correo: string) =>
  llamada<UsuarioNube>('GET', url('usuarios_empresa', { filtro: `correo=eq.${correo}`, limite: 1 }));

export const insertarUsuario = (usuario: Partial<UsuarioNube>) => llamada<UsuarioNube>('POST', url('usuarios_empresa'), usuario);

/* ---------------- Datos financieros (carpeta de datos por empresa) ---------------- */

export interface DatosFinancierosNube {
  empresa_id: string;
  payload: Record<string, unknown>;
  version: number;
  updated_at?: string;
}

export const leerDatosEmpresa = (empresaId: string) =>
  llamada<DatosFinancierosNube>('GET', url('datos_financieros', { filtro: `empresa_id=eq.${empresaId}`, limite: 1 }));

export const guardarDatosEmpresa = (datos: DatosFinancierosNube) => {
  // Upsert por clave primaria empresa_id (definido en supabase_schema.sql)
  return llamada<DatosFinancierosNube>('POST', url('datos_financieros'), {
    ...datos,
    updated_at: new Date().toISOString(),
  }, { Prefer: 'resolution=merge-duplicates,return=representation' });
};

export const eliminarEmpresa = (id: string) => llamada<never>('DELETE', url('empresas', { filtro: `id=eq.${id}` }));
