/**
 * Sincronización del estado financiero por empresa (web ↔ móvil ↔ nube ↔ G:).
 *
 * Compatibilidad:
 *  - Sesión Bearer (multiempresa, aislamiento por empresa).
 *  - Token heredado `x-aurafin-token` (AURAFIN_SYNC_TOKEN) para clientes
 *    antiguos: opera sobre el almacén legado compartido.
 */
import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { config } from '../config.js';
import {
  autenticar,
  tokenLegadoValido,
  type RequestConSesion,
} from '../seguridad/auth.js';
import { leerEstadoLocal, guardarEstadoLocal, type EstadoEmpresa } from '../almacenamiento/almacenLocal.js';
import { guardarEstadoEmpresa, leerEstadoEmpresa } from '../almacenamiento/motorSincronizacion.js';

const router = Router();

const CAMPOS_ARREGLO = ['payments', 'notes', 'goals'] as const;

function validarPayload(body: any): string | null {
  if (!body || typeof body !== 'object') return 'Payload inválido';
  for (const campo of CAMPOS_ARREGLO) {
    if (body[campo] !== undefined) {
      if (!Array.isArray(body[campo])) return `"${campo}" debe ser un arreglo`;
      if (body[campo].length > 10_000) return `"${campo}" excede el máximo de 10.000 registros`;
    }
  }
  if (body.categoryBudgets !== undefined) {
    if (typeof body.categoryBudgets !== 'object' || body.categoryBudgets === null || Array.isArray(body.categoryBudgets)) {
      return '"categoryBudgets" debe ser un objeto';
    }
    for (const [k, v] of Object.entries(body.categoryBudgets)) {
      if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) return `Presupuesto inválido en "${k}"`;
    }
  }
  if (body.profile !== undefined && (typeof body.profile !== 'object' || body.profile === null || Array.isArray(body.profile))) {
    return '"profile" debe ser un objeto';
  }
  return null;
}

function aplicarCambios(base: EstadoEmpresa, cambios: Partial<EstadoEmpresa>): EstadoEmpresa {
  return {
    ...base,
    ...Object.fromEntries(Object.entries(cambios).filter(([, v]) => v !== undefined)),
    version: Number(base.version ?? 0) + 1,
    lastUpdated: new Date().toISOString(),
  };
}

/* ---------------- Modo legado (token compartido) ---------------- */

const archivoLegado = path.join(config.almacenamiento.baseDir, 'aurafin-db.json');
// Almacén legado en memoria (se carga del archivo original data/aurafin-db.json)
let almacenLegado: EstadoEmpresa | { version: number; lastUpdated: string } = { version: 0, lastUpdated: new Date().toISOString() };
let temporizadorLegado: NodeJS.Timeout | null = null;

function cargarLegado(): void {
  try {
    if (fs.existsSync(archivoLegado)) {
      almacenLegado = JSON.parse(fs.readFileSync(archivoLegado, 'utf-8'));
    }
  } catch (error) {
    console.warn('[Legado] No se pudo cargar el almacén heredado:', error);
  }
}

function persistirLegado(): void {
  try {
    const temporal = `${archivoLegado}.tmp`;
    fs.mkdirSync(path.dirname(archivoLegado), { recursive: true });
    fs.writeFileSync(temporal, JSON.stringify(almacenLegado, null, 2), 'utf-8');
    fs.renameSync(temporal, archivoLegado);
  } catch (error) {
    console.error('[Legado] Error al persistir:', error);
  }
}

/* ---------------- Rutas ---------------- */

router.get('/sync/state', async (req: RequestConSesion, res, next) => {
  // Modo legado
  if (tokenLegadoValido(req)) {
    return res.json({ success: true, data: almacenLegado });
  }
  return autenticar(req, res, async () => {
    try {
      const estado = await leerEstadoEmpresa(req.sesion!.empresaId, req.sesion!.slug);
      return res.json({ success: true, data: estado ?? { version: 0, lastUpdated: new Date().toISOString() } });
    } catch (error) {
      console.error('[Sync] Error leyendo estado:', error);
      return res.status(500).json({ error: 'Error al leer el estado sincronizado' });
    }
  });
});

router.post('/sync/state', async (req: RequestConSesion, res) => {
  const errorValidacion = validarPayload(req.body);
  if (errorValidacion) return res.status(400).json({ error: errorValidacion });

  // Modo legado: un solo almacén compartido, igual que la versión anterior.
  if (tokenLegadoValido(req)) {
    almacenLegado = aplicarCambios(almacenLegado as EstadoEmpresa, req.body);
    if (temporizadorLegado) clearTimeout(temporizadorLegado);
    temporizadorLegado = setTimeout(persistirLegado, 400);
    return res.json({ success: true, version: (almacenLegado as EstadoEmpresa).version });
  }

  return autenticar(req, res, async () => {
    try {
      const actual = (await leerEstadoEmpresa(req.sesion!.empresaId, req.sesion!.slug)) ?? {
        version: 0,
        lastUpdated: new Date().toISOString(),
        empresaId: req.sesion!.empresaId,
        empresaSlug: req.sesion!.slug,
      };
      const nuevo = aplicarCambios({ ...actual, empresaId: req.sesion!.empresaId, empresaSlug: req.sesion!.slug }, req.body);
      const resultado = await guardarEstadoEmpresa(req.sesion!.empresaId, req.sesion!.slug, nuevo);
      return res.json({
        success: true,
        version: nuevo.version,
        nubeOk: resultado.nubeOk,
        espejoLocalOk: resultado.localOk,
        lastUpdated: nuevo.lastUpdated,
      });
    } catch (error) {
      console.error('[Sync] Error escribiendo estado:', error);
      return res.status(500).json({ error: 'Error al sincronizar el estado' });
    }
  });
});

export default router;
export { cargarLegado, persistirLegado };
