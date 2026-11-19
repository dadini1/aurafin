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
  actualizarUsuario,
  buscarEmpresaPorSlug,
  buscarUsuario,
  buscarUsuarioPorAcceso,
  insertarEmpresa,
  insertarPlan,
  insertarUsuario,
  insertarSuscripcion,
  listarEmpresas,
  listarUsuariosDeEmpresa,
  listarPlanes,
  supabaseDisponible,
} from '../almacenamiento/almacenSupabase.js';
import { guardarEstadoLocal, leerEstadoLocal } from '../almacenamiento/almacenLocal.js';
import {
  generarPasswordTemporal,
  enlaceWhatsApp,
  enlaceCorreo,
  enviarCorreoReal,
  mensajePasswordTemporal,
} from '../seguridad/envios.js';
import { resolverFunciones } from './planes.js';

const router = Router();

const SLUG_VALIDO = /^[a-z0-9][a-z0-9-]{1,38}$/;
const ROLES_VALIDOS: Rol[] = ['superadmin', 'dueno', 'admin_empresa', 'empleado', 'lectura'];
const COLORES_POR_DEFECTO = { primario: '#3D47E0', secundario: '#7D85FF', acento: '#0F9F7A' };

function esCorreoValido(correo: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);
}

/* ============================================================
   POST /api/auth/login  → sesión por empresa
   Acepta correo O nombre de usuario (p. ej. el dueño "Admin").
   ============================================================ */
router.post('/auth/login', async (req, res) => {
  try {
    const { correo, password } = req.body || {};
    if (!correo || !password) {
      return res.status(400).json({ error: 'Correo/usuario y contraseña requeridos' });
    }
    if (!supabaseDisponible()) {
      return res.status(503).json({ error: 'La base de datos en la nube no está configurada (SUPABASE_URL / SERVICE_ROLE_KEY).' });
    }

    const texto = String(correo).trim();
    const encontrados = await buscarUsuarioPorAcceso(texto.toLowerCase());
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

    const { funciones, plan } = await resolverFunciones(usuario.empresa_id);

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
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        correo: usuario.correo,
        usuario: usuario.usuario || '',
        rol: usuario.rol,
        debeCambiarPassword: !!usuario.debe_cambiar_password,
      },
      funciones,
      plan,
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
   POST /api/auth/cambiar-password  → cambio obligatorio u optativo
   ============================================================ */
router.post('/auth/cambiar-password', autenticar, async (req: RequestConSesion, res) => {
  try {
    const { passwordActual, passwordNueva } = req.body || {};
    if (!passwordNueva || String(passwordNueva).length < 8) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres' });
    }
    const encontrados = await buscarUsuario(req.sesion!.correo);
    const usuario = encontrados?.[0];
    if (!usuario || usuario.id !== req.sesion!.usuarioId) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    if (!verificarPassword(String(passwordActual || ''), usuario.password_hash)) {
      return res.status(401).json({ error: 'La contraseña actual es incorrecta' });
    }
    await actualizarUsuario(usuario.id, {
      password_hash: hashearPassword(String(passwordNueva)),
      debe_cambiar_password: false,
    });
    return res.json({ success: true });
  } catch (error) {
    console.error('[Auth] Error cambiando contraseña:', error);
    return res.status(500).json({ error: 'Error al cambiar la contraseña' });
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
      usuarios: usuarios.map((u) => ({
        id: u.id,
        nombre: u.nombre,
        correo: u.correo,
        usuario: u.usuario || '',
        telefono_whatsapp: u.telefono_whatsapp || '',
        rol: u.rol,
        estado: u.estado,
        debeCambiarPassword: !!u.debe_cambiar_password,
      })),
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
    const { nombre, correo, password, rol, usuario: nombreUsuario, telefono_whatsapp, generarPassword } = req.body || {};
    if (!nombre || !esCorreoValido(String(correo || ''))) {
      return res.status(400).json({ error: 'Nombre y correo válidos son obligatorios' });
    }
    if (!ROLES_VALIDOS.includes(rol) || rol === 'superadmin') {
      return res.status(400).json({ error: `Rol inválido. Permitidos: ${ROLES_VALIDOS.filter((r) => r !== 'superadmin').join(', ')}` });
    }
    // Contraseña: la escribe el admin (mín. 8) o se genera temporal (mín. 8 garantizado)
    const claveManual = String(password || '');
    const claveTemporal = generarPassword ? generarPasswordTemporal(12) : '';
    const clave = claveManual || claveTemporal;
    if (clave.length < 8) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    }

    const correoNorm = String(correo).trim().toLowerCase();
    const duplicadoCorreo = await buscarUsuario(correoNorm);
    if (duplicadoCorreo?.length) return res.status(409).json({ error: 'Ya existe un usuario con ese correo' });
    const usuarioLimpio = String(nombreUsuario || '').trim();
    if (usuarioLimpio) {
      const duplicadoUsuario = await buscarUsuarioPorAcceso(usuarioLimpio.toLowerCase());
      if (duplicadoUsuario?.length) return res.status(409).json({ error: 'Ya existe un usuario con ese nombre de usuario' });
    }

    const [creado] = await insertarUsuario({
      empresa_id: req.params.id,
      correo: correoNorm,
      usuario: usuarioLimpio,
      telefono_whatsapp: String(telefono_whatsapp || '').trim(),
      nombre: String(nombre).trim().slice(0, 120),
      password_hash: hashearPassword(clave),
      rol,
      estado: 'activo',
      // Temporal (generada) o manual: fuerza cambio al primer ingreso solo si es temporal
      debe_cambiar_password: !!generarPassword,
    });

    // Entrega de la contraseña temporal (solo al admin que la creó)
    let entrega: Record<string, unknown> | undefined;
    if (generarPassword && claveTemporal) {
      const mensaje = mensajePasswordTemporal(String(nombre).trim(), usuarioLimpio || correoNorm, claveTemporal);
      const asunto = 'Tu contraseña temporal de AuraFin';
      const enlaceWA = enlaceWhatsApp(String(telefono_whatsapp || ''), mensaje);
      const enlaceMail = enlaceCorreo(correoNorm, asunto, mensaje);
      const real = await enviarCorreoReal(correoNorm, asunto, mensaje);
      entrega = {
        passwordTemporal: claveTemporal,
        enlaceWhatsApp: enlaceWA,
        enlaceCorreo: enlaceMail,
        correoEnviadoReal: real.enviado,
        detalleEnvio: real.detalle,
      };
    }

    return res.status(201).json({
      success: true,
      usuario: { id: creado.id, correo: creado.correo, rol: creado.rol, debeCambiarPassword: !!generarPassword },
      ...(entrega ? { entrega } : {}),
    });
  } catch (error) {
    console.error('[Usuarios] Error creando:', error);
    return res.status(500).json({ error: 'Error al crear el usuario' });
  }
});

/* ============================================================
   POST /usuarios/:id/restablecer → contraseña temporal por
   correo o WhatsApp (entrega al admin que la solicita)
   ============================================================ */
router.post('/usuarios/:id/restablecer', autenticar, autorizarNivel('admin_empresa'), async (req: RequestConSesion, res) => {
  try {
    const { telefono_whatsapp } = req.body || {};
    // Localiza al usuario en cualquier empresa; el admin solo puede
    // restablecer usuarios de su propia empresa (superadmin: todas).
    const empresas = await listarEmpresas();
    const empresasAlcance = req.sesion!.rol === 'superadmin'
      ? empresas
      : empresas.filter((e) => e.id === req.sesion!.empresaId);
    const idsEmpresas = new Set(empresasAlcance.map((e) => e.id));

    // Busca al usuario objetivo por id
    const { buscarUsuarioPorId } = await import('../almacenamiento/almacenSupabase.js');
    const filas = await buscarUsuarioPorId(req.params.id);
    const usuario = filas?.[0];
    if (!usuario || !idsEmpresas.has(usuario.empresa_id)) {
      return res.status(404).json({ error: 'Usuario no encontrado o fuera de tu alcance' });
    }

    const claveTemporal = generarPasswordTemporal(12);
    await actualizarUsuario(usuario.id, {
      password_hash: hashearPassword(claveTemporal),
      debe_cambiar_password: true,
    });

    const telefono = String(telefono_whatsapp || '').trim() || usuario.telefono_whatsapp || '';
    const mensaje = mensajePasswordTemporal(usuario.nombre, usuario.usuario || usuario.correo, claveTemporal);
    const asunto = 'Tu contraseña temporal de AuraFin';
    const enlaceWA = enlaceWhatsApp(telefono, mensaje);
    const enlaceMail = enlaceCorreo(usuario.correo, asunto, mensaje);
    const real = await enviarCorreoReal(usuario.correo, asunto, mensaje);

    return res.json({
      success: true,
      entrega: {
        passwordTemporal: claveTemporal,
        enlaceWhatsApp: enlaceWA,
        enlaceCorreo: enlaceMail,
        correoEnviadoReal: real.enviado,
        detalleEnvio: real.detalle,
      },
      usuario: { id: usuario.id, nombre: usuario.nombre, correo: usuario.correo },
    });
  } catch (error) {
    console.error('[Usuarios] Error restableciendo:', error);
    return res.status(500).json({ error: 'Error al restablecer la contraseña' });
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
   Arranque: bootstrap idempotente
   1) Dueño del sistema: superadmin con usuario 'Admin' y contraseña
      temporal 'Admin123!' (solo si aún no tiene nombre de usuario).
   2) Planes por defecto (Gratuito / Profesional / Empresarial).
   3) Suscripción de la empresa matriz al plan superior.
   ============================================================ */
export async function asegurarSuperadminInicial(): Promise<void> {
  if (!supabaseDisponible()) return;
  try {
    await migrarDuenoSistema();
    await asegurarPlanesPorDefecto();
    await asegurarSuscripcionMatriz();
  } catch (error) {
    console.warn('[Bootstrap] Error en arranque (no fatal):', error);
  }
}

/** Migración one-shot: el superadmin hereda el acceso 'Admin' temporal. */
async function migrarDuenoSistema(): Promise<void> {
  const usuarioDueno = process.env.AURAFIN_DUENO_USUARIO || 'Admin';
  const passwordDueno = process.env.AURAFIN_DUENO_PASSWORD || 'Admin123!';

  const correoBase = (process.env.AURAFIN_ADMIN_EMAIL || 'admin@aurafin.app').toLowerCase();
  const actuales = await buscarUsuario(correoBase);
  const superadmin = actuales?.find((u) => u.rol === 'superadmin');

  if (!superadmin) {
    // Instalación nueva: crea empresa matriz + dueño con usuario Admin
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
      usuario: usuarioDueno,
      telefono_whatsapp: '',
      nombre: 'Dueño del sistema',
      password_hash: hashearPassword(passwordDueno),
      rol: 'superadmin',
      estado: 'activo',
      debe_cambiar_password: true,
    });
    console.log(`[Bootstrap] Dueño del sistema creado: usuario "${usuarioDueno}" (contraseña temporal)`);
    return;
  }

  if (!superadmin.usuario) {
    // Migración de superadmin existente: asigna usuario Admin + contraseña temporal
    await actualizarUsuario(superadmin.id, {
      usuario: usuarioDueno,
      password_hash: hashearPassword(passwordDueno),
      debe_cambiar_password: true,
    });
    console.log(`[Bootstrap] Superadmin migrado: ahora ingresa con usuario "${usuarioDueno}" (contraseña temporal)`);
  }
}

/** Planes por defecto (idempotente). */
async function asegurarPlanesPorDefecto(): Promise<void> {
  const planesActuales = await listarPlanes();
  const existentes = new Set(planesActuales.map((p) => p.slug));
  const funciones = {
    finanzas: true, notas: true, voz_analitica: true, radar: true, galeria: true, app_movil: true, ia: true,
  };
  const defecto = [
    {
      slug: 'gratuito',
      nombre: 'Gratuito',
      precio: 0,
      features: { finanzas: true, notas: true, voz_analitica: false, radar: false, galeria: false, app_movil: false, ia: false },
    },
    {
      slug: 'profesional',
      nombre: 'Profesional',
      precio: 19,
      features: { finanzas: true, notas: true, voz_analitica: true, radar: true, galeria: true, app_movil: false, ia: false },
    },
    {
      slug: 'empresarial',
      nombre: 'Empresarial',
      precio: 49,
      features: { ...funciones },
    },
  ];
  for (const plan of defecto) {
    if (existentes.has(plan.slug)) continue;
    await insertarPlan({
      slug: plan.slug,
      nombre: plan.nombre,
      precio: plan.precio,
      moneda: 'USD',
      duracion_dias: 30,
      features: plan.features,
      estado: 'activo',
    });
    console.log(`[Bootstrap] Plan creado: ${plan.nombre}`);
  }
}

/** La empresa matriz queda suscrita al plan más completo (si no lo está ya). */
async function asegurarSuscripcionMatriz(): Promise<void> {
  const central = (await buscarEmpresaPorSlug('aurafin-central'))?.[0];
  if (!central) return;
  const { resolverFunciones } = await import('./planes.js');
  const { plan } = await resolverFunciones(central.id);
  if (plan) return; // ya tiene suscripción vigente

  const planes = await listarPlanes();
  if (!planes.length) return;
  const superior = planes[planes.length - 1]; // orden precio.asc → último es el top
  const { cancelarSuscripcionesActivas, insertarSuscripcion } = await import('../almacenamiento/almacenSupabase.js');
  await cancelarSuscripcionesActivas(central.id);
  await insertarSuscripcion({
    empresa_id: central.id,
    plan_id: superior.id,
    estado: 'activa',
    fecha_inicio: new Date().toISOString(),
    fecha_fin: new Date(Date.now() + superior.duracion_dias * 24 * 60 * 60 * 1000).toISOString(),
  });
  console.log(`[Bootstrap] Empresa matriz suscrita al plan ${superior.nombre}`);
}

export default router;
