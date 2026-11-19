/**
 * Cliente HTTP del ecosistema AuraFin (empresas, sesiones y diagnóstico).
 * Un único punto de acceso a la API del servidor Express.
 *
 * BASE: en Render/servido por Express usa el mismo origen ('/api'); si el
 * front se despliega en Cloudflare Pages se define VITE_API_URL con la URL
 * pública del servicio (ej. https://aurafin-ai.onrender.com/api).
 */

const BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

export interface MarcaEmpresa {
  id?: string;
  slug: string;
  nombre: string;
  eslogan?: string;
  logo_url?: string;
  colores: { primario: string; secundario: string; acento: string };
}

export interface UsuarioSesion {
  id: string;
  nombre: string;
  correo: string;
  usuario?: string;
  rol: 'superadmin' | 'dueno' | 'admin_empresa' | 'empleado' | 'lectura';
  debeCambiarPassword?: boolean;
}

/** Funciones activadas por el plan de suscripción de la empresa. */
export type FuncionesPlan = Record<string, boolean>;

export interface PlanSuscripcion {
  id: string;
  slug: string;
  nombre: string;
  precio: number;
  moneda: string;
  duracionDias?: number;
  features: FuncionesPlan;
}

const CLAVES = {
  token: 'aurafin_sesion_token',
  usuario: 'aurafin_sesion_usuario',
  empresa: 'aurafin_sesion_empresa',
  slugActivo: 'aurafin_empresa_activa',
  funciones: 'aurafin_sesion_funciones',
  plan: 'aurafin_sesion_plan',
};

function leer<T>(clave: string): T | null {
  try {
    const crudo = localStorage.getItem(clave);
    return crudo ? (JSON.parse(crudo) as T) : null;
  } catch {
    return null;
  }
}

function guardar(clave: string, valor: unknown): void {
  try {
    if (valor === null) localStorage.removeItem(clave);
    else localStorage.setItem(clave, JSON.stringify(valor));
  } catch {
    // almacenamiento no disponible (navegación privada)
  }
}

/* ---------------- Sesión persistente ---------------- */

export const sesion = {
  obtenerToken: () => leer<string>(CLAVES.token),
  obtenerUsuario: () => leer<UsuarioSesion>(CLAVES.usuario),
  obtenerEmpresa: () => leer<MarcaEmpresa>(CLAVES.empresa),
  /** undefined = sin datos (modo local, sin gating). {} = sin suscripción activa. */
  obtenerFunciones: () => leer<FuncionesPlan>(CLAVES.funciones),
  obtenerPlan: () => leer<PlanSuscripcion>(CLAVES.plan),
  obtenerSlugActivo: () => {
    try {
      return localStorage.getItem(CLAVES.slugActivo);
    } catch {
      return null;
    }
  },
  guardar: (token: string, usuario: UsuarioSesion, empresa: MarcaEmpresa, funciones?: FuncionesPlan, plan?: PlanSuscripcion | null) => {
    guardar(CLAVES.token, token);
    guardar(CLAVES.usuario, usuario);
    guardar(CLAVES.empresa, empresa);
    if (funciones !== undefined) guardar(CLAVES.funciones, funciones);
    if (plan !== undefined) guardar(CLAVES.plan, plan);
    try {
      localStorage.setItem(CLAVES.slugActivo, empresa.slug);
    } catch {
      // ignore
    }
  },
  limpiar: () => {
    guardar(CLAVES.token, null);
    guardar(CLAVES.usuario, null);
    guardar(CLAVES.empresa, null);
    guardar(CLAVES.funciones, null);
    guardar(CLAVES.plan, null);
  },
};

export function cabecerasSesion(extra: Record<string, string> = {}): Record<string, string> {
  const token = sesion.obtenerToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

/* ---------------- Llamadas ---------------- */

async function pedir<T>(ruta: string, opciones: RequestInit = {}): Promise<T> {
  const respuesta = await fetch(`${BASE}${ruta}`, opciones);
  const cuerpo = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    const mensaje = (cuerpo as { error?: string }).error || `Error HTTP ${respuesta.status}`;
    throw new Error(mensaje);
  }
  return cuerpo as T;
}

export const aurafinApi = {
  listarEmpresas: () => pedir<{ success: boolean; empresas: MarcaEmpresa[] }>('/empresas'),
  obtenerMarca: (slug: string) => pedir<{ success: boolean; empresa: MarcaEmpresa }>(`/empresas/${encodeURIComponent(slug)}`),

  iniciarSesion: (correo: string, password: string) =>
    pedir<{ success: boolean; token: string; usuario: UsuarioSesion; empresa: MarcaEmpresa; funciones: FuncionesPlan; plan: PlanSuscripcion | null }>('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correo, password }),
    }),

  cambiarPassword: (passwordActual: string, passwordNueva: string) =>
    pedir<{ success: boolean }>('/auth/cambiar-password', {
      method: 'POST',
      headers: cabecerasSesion(),
      body: JSON.stringify({ passwordActual, passwordNueva }),
    }),

  crearEmpresa: (datos: Record<string, unknown>) =>
    pedir<{ success: boolean; empresa: unknown }>('/empresas', {
      method: 'POST',
      headers: cabecerasSesion(),
      body: JSON.stringify(datos),
    }),

  actualizarEmpresa: (id: string, cambios: Record<string, unknown>) =>
    pedir<{ success: boolean; empresa: unknown }>(`/empresas/${id}`, {
      method: 'PATCH',
      headers: cabecerasSesion(),
      body: JSON.stringify(cambios),
    }),

  listarUsuarios: (empresaId: string) =>
    pedir<{ success: boolean; usuarios: Array<{ id: string; nombre: string; correo: string; usuario?: string; telefono_whatsapp?: string; rol: string; estado: string; debeCambiarPassword?: boolean }> }>(
      `/empresas/${empresaId}/usuarios`,
      { headers: cabecerasSesion() }
    ),

  crearUsuario: (empresaId: string, datos: Record<string, unknown>) =>
    pedir<{ success: boolean; usuario: unknown; entrega?: EntregaPassword }>(`/empresas/${empresaId}/usuarios`, {
      method: 'POST',
      headers: cabecerasSesion(),
      body: JSON.stringify(datos),
    }),

  restablecerUsuario: (usuarioId: string, telefono_whatsapp?: string) =>
    pedir<{ success: boolean; entrega: EntregaPassword; usuario: { id: string; nombre: string; correo: string } }>(
      `/usuarios/${usuarioId}/restablecer`,
      { method: 'POST', headers: cabecerasSesion(), body: JSON.stringify({ telefono_whatsapp }) }
    ),

  listarPlanes: () =>
    pedir<{ success: boolean; planes: PlanSuscripcion[] }>('/planes'),

  crearPlan: (datos: Record<string, unknown>) =>
    pedir<{ success: boolean; plan: unknown }>('/planes', {
      method: 'POST',
      headers: cabecerasSesion(),
      body: JSON.stringify(datos),
    }),

  actualizarPlan: (id: string, cambios: Record<string, unknown>) =>
    pedir<{ success: boolean; plan: unknown }>(`/planes/${id}`, {
      method: 'PATCH',
      headers: cabecerasSesion(),
      body: JSON.stringify(cambios),
    }),

  asignarSuscripcion: (empresaId: string, planId: string) =>
    pedir<{ success: boolean; plan: PlanSuscripcion }>(`/empresas/${empresaId}/suscripcion`, {
      method: 'POST',
      headers: cabecerasSesion(),
      body: JSON.stringify({ planId }),
    }),

  obtenerSuscripcion: (empresaId: string) =>
    pedir<{ success: boolean; suscripcion: unknown; plan: PlanSuscripcion | null; features: FuncionesPlan }>(
      `/empresas/${empresaId}/suscripcion`,
      { headers: cabecerasSesion() }
    ),

  estadoSistema: () => pedir<Record<string, unknown>>('/admin/estado', { headers: cabecerasSesion() }),
};

export interface EntregaPassword {
  passwordTemporal: string;
  enlaceWhatsApp: string;
  enlaceCorreo: string;
  correoEnviadoReal: boolean;
  detalleEnvio: string;
}
