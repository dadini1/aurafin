/**
 * Planes de suscripción y activación de funciones.
 *
 * - GET /planes: catálogo público (solo planes activos).
 * - CRUD de planes: solo superadmin (dueño del sistema), desde
 *   Configuración del sistema → Planes.
 * - POST /empresas/:id/suscripcion: activa una suscripción para una empresa
 *   (dueño del sistema o admin de su propia empresa).
 *
 * Cada plan declara su JSONB `features` con las funciones que activa:
 *   finanzas, notas, voz_analitica, radar, galeria, app_movil, ia
 */
import { Router } from 'express';
import {
  autenticar,
  autorizarNivel,
  type RequestConSesion,
} from '../seguridad/auth.js';
import {
  actualizarPlan,
  buscarPlanPorSlug,
  insertarPlan,
  insertarSuscripcion,
  listarEmpresas,
  listarPlanes,
  listarSuscripciones,
  cancelarSuscripcionesActivas,
  suscripcionVigente,
  supabaseDisponible,
} from '../almacenamiento/almacenSupabase.js';

const router = Router();

const SLUG_VALIDO = /^[a-z0-9][a-z0-9-]{1,38}$/;
const FUNCIONES_VALIDAS = ['finanzas', 'notas', 'voz_analitica', 'radar', 'galeria', 'app_movil', 'ia'] as const;
type Funcion = (typeof FUNCIONES_VALIDAS)[number];

function limpiarFeatures(features: unknown): Record<Funcion, boolean> {
  const fuente = (features && typeof features === 'object' ? features : {}) as Record<string, unknown>;
  const limpio = {} as Record<Funcion, boolean>;
  for (const clave of FUNCIONES_VALIDAS) limpio[clave] = fuente[clave] === true;
  return limpio;
}

/* ---------------- Catálogo público ---------------- */

router.get('/planes', async (_req, res) => {
  if (!supabaseDisponible()) return res.json({ success: true, planes: [] });
  try {
    const filas = await listarPlanes();
    return res.json({
      success: true,
      planes: filas
        .filter((p) => p.estado === 'activo')
        .map((p) => ({
          id: p.id,
          slug: p.slug,
          nombre: p.nombre,
          precio: Number(p.precio),
          moneda: p.moneda,
          duracionDias: p.duracion_dias,
          features: p.features || {},
        })),
    });
  } catch (error) {
    console.error('[Planes] Error listando:', error);
    return res.status(500).json({ error: 'Error al listar planes' });
  }
});

/* ---------------- CRUD de planes (solo superadmin) ---------------- */

router.post('/planes', autenticar, autorizarNivel('superadmin'), async (req: RequestConSesion, res) => {
  try {
    const { slug, nombre, precio, moneda, duracionDias, features, estado } = req.body || {};
    if (!SLUG_VALIDO.test(String(slug || ''))) {
      return res.status(400).json({ error: 'Slug inválido: minúsculas/números/guiones (ej. "profesional")' });
    }
    if (!nombre || String(nombre).trim().length < 2) {
      return res.status(400).json({ error: 'El nombre del plan es obligatorio' });
    }
    const existente = await buscarPlanPorSlug(slug);
    if (existente?.length) return res.status(409).json({ error: `El slug "${slug}" ya existe` });

    const [creado] = await insertarPlan({
      slug: String(slug),
      nombre: String(nombre).trim().slice(0, 80),
      precio: Number(precio) || 0,
      moneda: moneda ? String(moneda).slice(0, 4).toUpperCase() : 'USD',
      duracion_dias: Math.max(1, Math.round(Number(duracionDias) || 30)),
      features: limpiarFeatures(features),
      estado: estado === 'inactivo' ? 'inactivo' : 'activo',
    });
    return res.status(201).json({ success: true, plan: creado });
  } catch (error) {
    console.error('[Planes] Error creando:', error);
    return res.status(500).json({ error: 'Error al crear el plan' });
  }
});

router.patch('/planes/:id', autenticar, autorizarNivel('superadmin'), async (req: RequestConSesion, res) => {
  try {
    const cambios = req.body || {};
    const permitidos: Record<string, unknown> = {};
    if (cambios.nombre !== undefined) permitidos.nombre = String(cambios.nombre).trim().slice(0, 80);
    if (cambios.precio !== undefined) permitidos.precio = Number(cambios.precio) || 0;
    if (cambios.moneda !== undefined) permitidos.moneda = String(cambios.moneda).slice(0, 4).toUpperCase();
    if (cambios.duracionDias !== undefined) permitidos.duracion_dias = Math.max(1, Math.round(Number(cambios.duracionDias) || 30));
    if (cambios.features !== undefined) permitidos.features = limpiarFeatures(cambios.features);
    if (cambios.estado !== undefined) permitidos.estado = cambios.estado === 'inactivo' ? 'inactivo' : 'activo';

    const [actualizado] = await actualizarPlan(req.params.id, permitidos);
    if (!actualizado) return res.status(404).json({ error: 'Plan no encontrado' });
    return res.json({ success: true, plan: actualizado });
  } catch (error) {
    console.error('[Planes] Error actualizando:', error);
    return res.status(500).json({ error: 'Error al actualizar el plan' });
  }
});

/* ---------------- Suscripciones ---------------- */

/** Activa (o renueva) la suscripción de una empresa a un plan. */
router.post('/empresas/:id/suscripcion', autenticar, autorizarNivel('dueno'), async (req: RequestConSesion, res) => {
  try {
    const { planId, planSlug } = req.body || {};
    // El dueño de una empresa afiliada solo gestiona su propia suscripción;
    // el superadmin (dueño del sistema) gestiona todas.
    if (req.sesion!.rol !== 'superadmin' && req.sesion!.empresaId !== req.params.id) {
      return res.status(403).json({ error: 'Solo puedes gestionar la suscripción de tu propia empresa' });
    }

    const empresas = await listarEmpresas();
    const empresa = empresas.find((e) => e.id === req.params.id);
    if (!empresa) return res.status(404).json({ error: 'Empresa no encontrada' });

    const planes = await listarPlanes();
    const plan = planes.find((p) => (planId && p.id === planId) || (planSlug && p.slug === planSlug));
    if (!plan || plan.estado !== 'activo') return res.status(404).json({ error: 'Plan no encontrado o inactivo' });

    // Cancela la suscripción activa previa y crea la nueva
    await cancelarSuscripcionesActivas(empresa.id);
    const fechaFin = new Date(Date.now() + plan.duracion_dias * 24 * 60 * 60 * 1000).toISOString();
    const [creada] = await insertarSuscripcion({
      empresa_id: empresa.id,
      plan_id: plan.id,
      estado: 'activa',
      fecha_inicio: new Date().toISOString(),
      fecha_fin: fechaFin,
    });

    return res.status(201).json({
      success: true,
      suscripcion: creada,
      plan: { id: plan.id, slug: plan.slug, nombre: plan.nombre, features: plan.features },
    });
  } catch (error) {
    console.error('[Planes] Error asignando suscripción:', error);
    return res.status(500).json({ error: 'Error al activar la suscripción' });
  }
});

/** Suscripción vigente de una empresa (con plan y funciones activas). */
router.get('/empresas/:id/suscripcion', autenticar, async (req: RequestConSesion, res) => {
  try {
    if (req.sesion!.rol !== 'superadmin' && req.sesion!.empresaId !== req.params.id) {
      return res.status(403).json({ error: 'Solo puedes consultar la suscripción de tu propia empresa' });
    }
    const vigente = await suscripcionVigente(req.params.id);
    if (!vigente) return res.json({ success: true, suscripcion: null, plan: null, features: {} });

    const planes = await listarPlanes();
    const plan = planes.find((p) => p.id === vigente.plan_id);
    return res.json({
      success: true,
      suscripcion: vigente,
      plan: plan ? { id: plan.id, slug: plan.slug, nombre: plan.nombre, precio: Number(plan.precio), moneda: plan.moneda } : null,
      features: plan?.features || {},
    });
  } catch (error) {
    console.error('[Planes] Error consultando suscripción:', error);
    return res.status(500).json({ error: 'Error al consultar la suscripción' });
  }
});

/** Todas las suscripciones (superadmin): panel de administración. */
router.get('/suscripciones', autenticar, autorizarNivel('superadmin'), async (_req, res) => {
  try {
    const [suscripciones, empresas, planes] = await Promise.all([
      listarSuscripciones(),
      listarEmpresas(),
      listarPlanes(),
    ]);
    return res.json({
      success: true,
      suscripciones: suscripciones.map((s) => ({
        ...s,
        empresaNombre: empresas.find((e) => e.id === s.empresa_id)?.nombre || s.empresa_id,
        planNombre: planes.find((p) => p.id === s.plan_id)?.nombre || s.plan_id,
      })),
    });
  } catch (error) {
    console.error('[Planes] Error listando suscripciones:', error);
    return res.status(500).json({ error: 'Error al listar suscripciones' });
  }
});

export default router;

/**
 * Resuelve las funciones activas de una empresa a partir de su suscripción
 * vigente. Sin suscripción activa devuelve funciones vacías (paywall).
 */
export async function resolverFunciones(empresaId: string): Promise<{
  funciones: Record<string, boolean>;
  plan: { id: string; slug: string; nombre: string; precio: number; moneda: string } | null;
}> {
  if (!supabaseDisponible()) return { funciones: {}, plan: null };
  try {
    const vigente = await suscripcionVigente(empresaId);
    if (!vigente) return { funciones: {}, plan: null };
    const planes = await listarPlanes();
    const plan = planes.find((p) => p.id === vigente.plan_id);
    if (!plan) return { funciones: {}, plan: null };
    return {
      funciones: plan.features || {},
      plan: { id: plan.id, slug: plan.slug, nombre: plan.nombre, precio: Number(plan.precio), moneda: plan.moneda },
    };
  } catch {
    return { funciones: {}, plan: null };
  }
}
