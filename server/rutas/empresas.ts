/**
 * Rutas multiempresa: autenticación, CRUD de empresas afiliadas (branding
 * editable: logo y colores) y gestión de usuarios con roles independientes
 * por empresa.
 */
import { Router } from 'express';
import crypto from 'crypto';
import { config } from '../config.js';
import {
  autenticar,
  autorizarNivel,
  emitirToken,
  hashearPassword,
  verificarPassword,
  tokenLegadoValido,
  type RequestConSesion,
  type Rol,
} from '../seguridad/auth.js';
import {
  actualizarEmpresa,
  buscarEmpresaPorSlug,
  buscarUsuario,
  insertarEmpresa,
  insertarUsuario,
  listarEmpresas,
  listarUsuariosDeEmpresa,
  supabaseDisponible,
} from '../almacenamiento/almacenSupabase.js';
import { guardarEstadoLocal, leerEstadoLocal } from '../almacenamiento/almacenLocal.js';

const router = Router();

const SLUG_VALIDO = /^[a-z0-9][a-z0-9-]{1,38}$/;
const ROLES_VALIDOS: Rol[] = ['superadmin', 'dueno', 'admin_empresa', 'empleado', 'lectura'];
const COLORES_POR_DEFECTO = { primario: '#3D47E0', secundario: '#7D85FF', acento: '#0F9F7A' };

function esCorreoValido(correo: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);
}

/* ============================================================
   POST /api/auth/login  → sesión por empresa
   ============================================================ */
router.post('/auth/login', async (req, res) => {
  try {
    const { correo, password } = req.body || {};
    if (!correo || !password) {
      return res.status(400).json({ error: 'Correo y contraseña requeridos' });
    }
    if (!supabaseDisponible()) {
      return res.status(503).json({ error: 'La base de datos en la nube no está configurada (SUPABASE_URL / SERVICE_ROLE_KEY).' });
    }

    const encontrados = await buscarUsuario(String(correo).trim().toLowerCase());
    const usuario = encontrados?.[0];
    if (!usuario || usuario.estado !== 'activo' || !verificarPassword(password, usuario.password_hash)) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Recupera la empresa del usuario por id
    const empresasTodas = await listarEmpresas();
    const empresa = empresasTodas.find((e) => e.id === usuario.empresa_id);
    if (!empresa || empresa.estado !== 'activa') {
      return res.status(403).json({ error: 'La empresa asociada no está activa' });
    }

    const token = emitirToken({
      usuarioId: usuario.id,
      empresaId: usuario.empresa_id,
      slug: empresa.slug,
      rol: usuario.rol,
      correo: usuario.correo,
    });

    return res.json({
      success: true,
      token,
      usuario: { id: usuario.id, nombre: usuario.nombre, correo: usuario.correo, rol: usuario.rol },
      empresa: {
        id: empresa.id,
        slug: empresa.slug,
        nombre: empresa.nombre,
        eslogan: empresa.eslogan,
        logo_url: empresa.logo_url,
        colores: empresa.colores,
      },
    });
  } catch (error) {
    console.error('[Auth] Error en login:', error);
    return res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

/* ============================================================
   GET /api/empresas → lista pública mínima (para pantalla de acceso)
   GET /api/empresas/:slug → marca pública (logo, colores, nombre)
   ============================================================ */
router.get('/empresas', async (_req, res) => {
  if (!supabaseDisponible()) return res.json({ success: true, empresas: [] });
  try {
    const filas = await listarEmpresas();
    return res.json({
      success: true,
      empresas: filas
        .filter((e) => e.estado === 'activa')
        .map((e) => ({ slug: e.slug, nombre: e.nombre, eslogan: e.eslogan, logo_url: e.logo_url, colores: e.colores })),
    });
  } catch (error) {
    console.error('[Empresas] Error listando:', error);
    return res.status(500).json({ error: 'Error al listar empresas' });
  }
});

router.get('/empresas/:slug', async (req, res) => {
  try {
    const filas = await buscarEmpresaPorSlug(req.params.slug);
    const e = filas?.[0];
    if (!e) return res.status(404).json({ error: 'Empresa no encontrada' });
    return res.json({
      success: true,
      empresa: { slug: e.slug, nombre: e.nombre, eslogan: e.eslogan, logo_url: e.logo_url, colores: e.colores, estado: e.estado },
    });
  } catch (error) {
    console.error('[Empresas] Error obteniendo marca:', error);
    return res.status(500).json({ error: 'Error al obtener la empresa' });
  }
});

/* ============================================================
   CRUD de empresas (solo superadmin / dueno autenticado)
   ============================================================ */
router.post('/empresas', autenticar, autorizarNivel('superadmin'), async (req: RequestConSesion, res) => {
  try {
    const { slug, nombre, eslogan, logo_url, colores, config: cfg } = req.body || {};
    if (!SLUG_VALIDO.test(String(slug || ''))) {
      return res.status(400).json({ error: 'Slug inválido: 2-39 caracteres, minúsculas/números/guiones (ej. "acme-bolivia")' });
    }
    if (!nombre || String(nombre).trim().length < 2) {
      return res.status(400).json({ error: 'El nombre de la empresa es obligatorio' });
    }
    if (typeof logo_url === 'string' && logo_url.length > 1_500_000) {
      return res.status(413).json({ error: 'Logo demasiado grande (máx ~1 MB); usa una imagen comprimida' });
    }

    const existente = await buscarEmpresaPorSlug(slug);
    if (existente?.length) return res.status(409).json({ error: `El slug "${slug}" ya está en uso` });

    const [creada] = await insertarEmpresa({
      slug,
      nombre: String(nombre).trim(),
      eslogan: eslogan ? String(eslogan).slice(0, 200) : '',
      logo_url: logo_url || '',
      colores: { ...COLORES_POR_DEFECTO, ...(colores || {}) },
      config: cfg || {},
      estado: 'activa',
    });

    // Carpeta propia en el disco G:
    guardarEstadoLocal(slug, {
      version: 0,
      lastUpdated: new Date().toISOString(),
      empresaId: creada.id,
      empresaSlug: slug,
      payments: [],
      notes: [],
      goals: [],
      categoryBudgets: {},
      profile: {},
    });

    return res.status(201).json({ success: true, empresa: creada });
  } catch (error) {
    console.error('[Empresas] Error creando:', error);
    return res.status(500).json({ error: 'Error al crear la empresa' });
  }
});

router.patch('/empresas/:id', autenticar, autorizarNivel('dueno'), async (req: RequestConSesion, res) => {
  try {
    const cambios = req.body || {};
    const permitidos: Record<string, unknown> = {};
    for (const campo of ['nombre', 'eslogan', 'logo_url', 'colores', 'config', 'estado'] as const) {
      if (cambios[campo] !== undefined) permitidos[campo] = cambios[campo];
    }
    if (typeof permitidos.logo_url === 'string' && (permitidos.logo_url as string).length > 1_500_000) {
      return res.status(413).json({ error: 'Logo demasiado grande' });
    }
    const [actualizada] = await actualizarEmpresa(req.params.id, permitidos);
    if (!actualizada) return res.status(404).json({ error: 'Empresa no encontrada' });

    // Refresca espejo local con la marca nueva
    const local = leerEstadoLocal(actualizada.slug);
    if (local) guardarEstadoLocal(actualizada.slug, { ...local, lastUpdated: new Date().toISOString() });

    return res.json({ success: true, empresa: actualizada });
  } catch (error) {
    console.error('[Empresas] Error actualizando:', error);
    return res.status(500).json({ error: 'Error al actualizar la empresa' });
  }
});

/* ============================================================
   Usuarios por empresa (autorizaciones independientes)
   ============================================================ */
router.get('/empresas/:id/usuarios', autenticar, autorizarNivel('admin_empresa'), async (req: RequestConSesion, res) => {
  try {
    if (req.sesion!.rol !== 'superadmin' && req.sesion!.empresaId !== req.params.id) {
      return res.status(403).json({ error: 'Solo puedes administrar usuarios de tu propia empresa' });
    }
    const usuarios = await listarUsuariosDeEmpresa(req.params.id);
    return res.json({
      success: true,
      usuarios: usuarios.map((u) => ({ id: u.id, nombre: u.nombre, correo: u.correo, rol: u.rol, estado: u.estado })),
    });
  } catch (error) {
    console.error('[Usuarios] Error listando:', error);
    return res.status(500).json({ error: 'Error al listar usuarios' });
  }
});

router.post('/empresas/:id/usuarios', autenticar, autorizarNivel('admin_empresa'), async (req: RequestConSesion, res) => {
  try {
    if (req.sesion!.rol !== 'superadmin' && req.sesion!.empresaId !== req.params.id) {
      return res.status(403).json({ error: 'Solo puedes crear usuarios en tu propia empresa' });
    }
    const { nombre, correo, password, rol } = req.body || {};
    if (!nombre || !esCorreoValido(String(correo || ''))) {
      return res.status(400).json({ error: 'Nombre y correo válidos son obligatorios' });
    }
    if (String(password || '').length < 8) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    }
    if (!ROLES_VALIDOS.includes(rol) || rol === 'superadmin') {
      return res.status(400).json({ error: `Rol inválido. Permitidos: ${ROLES_VALIDOS.filter((r) => r !== 'superadmin').join(', ')}` });
    }
    const correoNorm = String(correo).trim().toLowerCase();
    const duplicado = await buscarUsuario(correoNorm);
    if (duplicado?.length) return res.status(409).json({ error: 'Ya existe un usuario con ese correo' });

    const [creado] = await insertarUsuario({
      empresa_id: req.params.id,
      correo: correoNorm,
      nombre: String(nombre).trim().slice(0, 120),
      password_hash: hashearPassword(String(password)),
      rol,
      estado: 'activo',
    });
    return res.status(201).json({ success: true, usuario: { id: creado.id, correo: creado.correo, rol: creado.rol } });
  } catch (error) {
    console.error('[Usuarios] Error creando:', error);
    return res.status(500).json({ error: 'Error al crear el usuario' });
  }
});

/* ============================================================
   Diagnóstico (superadmin): nube, disco G: y bandaja de reenvío
   ============================================================ */
router.get('/admin/estado', autenticar, autorizarNivel('superadmin'), async (_req, res) => {
  const { diagnosticoLocal } = await import('../almacenamiento/almacenLocal.js');
  const { estadoSincronizacion, } = await import('../almacenamiento/motorSincronizacion.js');
  const { saludSupabase } = await import('../almacenamiento/almacenSupabase.js');
  const salud = await saludSupabase();
  return res.json({
    success: true,
    nube: { habilitada: supabaseDisponible(), ...salud },
    disco: diagnosticoLocal(),
    sincronizacion: estadoSincronizacion(),
    entorno: config.entorno,
  });
});

/* ============================================================
   Arranque: bootstrap del primer superadmin (idempotente)
   ============================================================ */
export async function asegurarSuperadminInicial(): Promise<void> {
  if (!supabaseDisponible()) return;
  try {
    const correoBase = (process.env.AURAFIN_ADMIN_EMAIL || 'admin@aurafin.app').toLowerCase();
    const passwordBase = process.env.AURAFIN_ADMIN_PASSWORD || 'AuraFin2026!';
    const yaExiste = await buscarUsuario(correoBase);
    if (yaExiste?.length) return;

    const slugBase = 'aurafin-central';
    let central = (await buscarEmpresaPorSlug(slugBase))?.[0];
    if (!central) {
      const [creada] = await insertarEmpresa({
        slug: slugBase,
        nombre: 'AuraFin Central',
        eslogan: 'Matriz del ecosistema financiero',
        logo_url: '',
        colores: COLORES_POR_DEFECTO,
        config: {},
        estado: 'activa',
      });
      central = creada;
      console.log(`[Bootstrap] Empresa matriz creada: ${slugBase} (id ${creada.id})`);
    }

    await insertarUsuario({
      empresa_id: central.id,
      correo: correoBase,
      nombre: 'Administrador AuraFin',
      password_hash: hashearPassword(passwordBase),
      rol: 'superadmin',
      estado: 'activo',
    });
    console.log(`[Bootstrap] Superadmin inicial: ${correoBase} — CAMBIA LA CONTRASEÑA en producción`);
  } catch (error) {
    console.warn('[Bootstrap] No se pudo crear el superadmin inicial:', error);
  }
}

export default router;
