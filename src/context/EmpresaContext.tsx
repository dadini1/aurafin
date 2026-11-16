/**
 * Contexto de empresa afiliada: sesión por empresa + branding dinámico.
 *
 * - Aplica los colores de la empresa a los tokens del sistema de diseño
 *   (variables CSS --accent / --accent-2) sin tocar las hojas de estilo.
 * - Expone iniciarSesion/cerrarSesion y valida la sesión al arrancar.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { aurafinApi, sesion, type MarcaEmpresa, type UsuarioSesion } from '../services/aurafinApi';

const MARCA_POR_DEFECTO: MarcaEmpresa = {
  slug: 'aurafin',
  nombre: 'AuraFin',
  eslogan: 'Finanzas personales con IA',
  colores: { primario: '#0d9488', secundario: '#7c3aed', acento: '#0f9f7a' },
};

interface EstadoContexto {
  empresa: MarcaEmpresa;
  usuario: UsuarioSesion | null;
  autenticado: boolean;
  esAdministrador: boolean;
  iniciando: boolean;
  iniciarSesion: (correo: string, password: string) => Promise<void>;
  cerrarSesion: () => void;
  refrescarMarca: (slug?: string) => Promise<void>;
  actualizarMarcaLocal: (marca: MarcaEmpresa) => void;
}

const ContextoEmpresa = createContext<EstadoContexto | null>(null);

/* ---------------- utilidades de color ---------------- */

function hexToRgb(hex: string): [number, number, number] {
  const limpio = hex.replace('#', '');
  const completo = limpio.length === 3 ? limpio.split('').map((c) => c + c).join('') : limpio;
  const n = parseInt(completo || '0d9488', 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function oscurecer(hex: string, porcentaje: number): string {
  const [r, g, b] = hexToRgb(hex).map((c) => Math.round(c * (1 - porcentaje)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function luminancia(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function aplicarMarca(marca: MarcaEmpresa): void {
  const primario = marca.colores?.primario || MARCA_POR_DEFECTO.colores.primario;
  const secundario = marca.colores?.secundario || MARCA_POR_DEFECTO.colores.secundario;
  const raiz = document.documentElement.style;
  raiz.setProperty('--accent', primario);
  raiz.setProperty('--accent-hover', oscurecer(primario, 0.15));
  raiz.setProperty('--accent-soft', rgba(primario, 0.1));
  raiz.setProperty('--accent-border', rgba(primario, 0.35));
  raiz.setProperty('--accent-contrast', luminancia(primario) > 0.55 ? '#04121a' : '#ffffff');
  raiz.setProperty('--accent-2', secundario);
  if (marca.nombre) document.title = `${marca.nombre} · Finanzas con IA`;
  if (marca.logo_url?.startsWith('data:')) {
    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (link) link.href = marca.logo_url;
  }
}

export function ProveedorEmpresa({ children }: { children: ReactNode }) {
  const [empresa, setEmpresa] = useState<MarcaEmpresa>(() => sesion.obtenerEmpresa() || MARCA_POR_DEFECTO);
  const [usuario, setUsuario] = useState<UsuarioSesion | null>(() => sesion.obtenerUsuario());
  const [iniciando, setIniciando] = useState(true);

  // Aplica el branding persistido y refresca la marca desde la nube al arrancar.
  useEffect(() => {
    aplicarMarca(empresa);
    setIniciando(false);
    const slug = sesion.obtenerEmpresa()?.slug || sesion.obtenerSlugActivo();
    if (slug) {
      aurafinApi
        .obtenerMarca(slug)
        .then((r) => {
          if (r.empresa) {
            setEmpresa(r.empresa);
            aplicarMarca(r.empresa);
          }
        })
        .catch(() => {
          // marca por defecto si la nube no responde
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const iniciarSesion = useCallback(async (correo: string, password: string) => {
    const respuesta = await aurafinApi.iniciarSesion(correo, password);
    sesion.guardar(respuesta.token, respuesta.usuario, respuesta.empresa);
    setUsuario(respuesta.usuario);
    setEmpresa(respuesta.empresa);
    aplicarMarca(respuesta.empresa);
  }, []);

  const cerrarSesion = useCallback(() => {
    sesion.limpiar();
    setUsuario(null);
    setEmpresa(MARCA_POR_DEFECTO);
    aplicarMarca(MARCA_POR_DEFECTO);
  }, []);

  const refrescarMarca = useCallback(async (slug?: string) => {
    const objetivo = slug || empresa.slug;
    if (!objetivo) return;
    const r = await aurafinApi.obtenerMarca(objetivo);
    if (r.empresa) {
      setEmpresa(r.empresa);
      aplicarMarca(r.empresa);
    }
  }, [empresa.slug]);

  const actualizarMarcaLocal = useCallback((marca: MarcaEmpresa) => {
    setEmpresa(marca);
    aplicarMarca(marca);
    if (sesion.obtenerEmpresa()) sesion.guardar(sesion.obtenerToken()!, sesion.obtenerUsuario()!, marca);
  }, []);

  const esAdministrador = useMemo(
    () => Boolean(usuario && ['superadmin', 'dueno', 'admin_empresa'].includes(usuario.rol)),
    [usuario]
  );

  const valor = useMemo<EstadoContexto>(
    () => ({
      empresa,
      usuario,
      autenticado: Boolean(usuario),
      esAdministrador,
      iniciando,
      iniciarSesion,
      cerrarSesion,
      refrescarMarca,
      actualizarMarcaLocal,
    }),
    [empresa, usuario, esAdministrador, iniciando, iniciarSesion, cerrarSesion, refrescarMarca, actualizarMarcaLocal]
  );

  return <ContextoEmpresa.Provider value={valor}>{children}</ContextoEmpresa.Provider>;
}

export function useEmpresa(): EstadoContexto {
  const ctx = useContext(ContextoEmpresa);
  if (!ctx) throw new Error('useEmpresa debe usarse dentro de <ProveedorEmpresa>');
  return ctx;
}
