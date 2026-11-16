/**
 * Almacén local en disco (G:) — una carpeta por empresa afiliada.
 *
 * Estructura:
 *   data/empresas/<slug>/database.json        → principal
 *   data/empresas/<slug>/mirror/database.json → espejo en caliente
 *   data/backups/<slug>/database-AAAA-MM-DD.json → respaldo diario (retención N)
 *
 * Todas las escrituras son atómicas (tmp + rename). Si la lectura de la base
 * principal falla, se recupera desde el espejo. El modo degradado se registra
 * sin impedir el arranque.
 */
import fs from 'fs';
import path from 'path';
import { config } from '../config.js';

export interface EstadoEmpresa {
  version: number;
  lastUpdated: string;
  empresaId?: string;
  empresaSlug?: string;
  payments?: unknown[];
  notes?: unknown[];
  goals?: unknown[];
  categoryBudgets?: Record<string, number>;
  profile?: unknown;
  [clave: string]: unknown;
}

interface RutasEmpresa {
  principal: string;
  espejo: string;
  respaldoDir: string;
}

function rutasEmpresa(slug: string): RutasEmpresa {
  const dirEmpresa = path.join(config.almacenamiento.baseDir, 'empresas', slug);
  return {
    principal: path.join(dirEmpresa, 'database.json'),
    espejo: path.join(dirEmpresa, 'mirror', 'database.json'),
    respaldoDir: path.join(config.almacenamiento.baseDir, 'backups', slug),
  };
}

export function escrituraAtomica(archivo: string, contenido: string): void {
  fs.mkdirSync(path.dirname(archivo), { recursive: true });
  const temporal = `${archivo}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(temporal, contenido, 'utf-8');
  try {
    fs.renameSync(temporal, archivo);
  } catch {
    // Windows puede bloquear el reemplazo si otro proceso leyó el archivo.
    fs.rmSync(archivo, { force: true });
    fs.renameSync(temporal, archivo);
  }
}

function rotarRespaldos(dir: string, retencion: number): void {
  try {
    const archivos = fs
      .readdirSync(dir)
      .filter((n) => /^database-\d{4}-\d{2}-\d{2}\.json$/.test(n))
      .sort()
      .reverse();
    for (const nombre of archivos.slice(retencion)) {
      fs.rmSync(path.join(dir, nombre), { force: true });
    }
  } catch {
    // La rotación es best-effort.
  }
}

function leerJson(archivo: string): EstadoEmpresa | null {
  if (!fs.existsSync(archivo)) return null;
  return JSON.parse(fs.readFileSync(archivo, 'utf-8')) as EstadoEmpresa;
}

/** Carga el estado local de una empresa; recupera desde el espejo si la base principal está corrupta. */
export function leerEstadoLocal(slug: string): EstadoEmpresa | null {
  const rutas = rutasEmpresa(slug);
  try {
    const principal = leerJson(rutas.principal);
    if (principal) return principal;
  } catch (error) {
    console.warn(`[AlmacénLocal] Principal ilegible (${slug}), intentando espejo:`, error);
  }
  try {
    return leerJson(rutas.espejo);
  } catch {
    return null;
  }
}

/** Persiste en principal + espejo + respaldo diario. Devuelve el diagnóstico. */
export function guardarEstadoLocal(slug: string, estado: EstadoEmpresa): { principalOk: boolean; espejoOk: boolean } {
  const rutas = rutasEmpresa(slug);
  const contenido = JSON.stringify(estado, null, 2);
  let principalOk = false;
  let espejoOk = false;

  try {
    escrituraAtomica(rutas.principal, contenido);
    principalOk = true;
  } catch (error) {
    console.error(`[AlmacénLocal] Error escribiendo principal (${slug}):`, error);
  }
  try {
    escrituraAtomica(rutas.espejo, contenido);
    espejoOk = true;
  } catch (error) {
    console.warn(`[AlmacénLocal] Espejo no actualizado (${slug}):`, error);
  }

  if (principalOk) {
    try {
      const fecha = new Date().toISOString().slice(0, 10);
      const destino = path.join(rutas.respaldoDir, `database-${fecha}.json`);
      if (!fs.existsSync(destino)) {
        escrituraAtomica(destino, contenido);
        rotarRespaldos(rutas.respaldoDir, config.almacenamiento.retencionRespaldos);
      }
    } catch (error) {
      console.warn('[AlmacénLocal] Respaldo diario falló:', error);
    }
  }

  return { principalOk, espejoOk };
}

/** Diagnóstico de almacenamiento local (usado por /api/health y /api/admin/estado). */
export function diagnosticoLocal(): Record<string, unknown> {
  const base = config.almacenamiento.baseDir;
  const dirEmpresas = path.join(base, 'empresas');
  let empresas: string[] = [];
  try {
    empresas = fs.existsSync(dirEmpresas) ? fs.readdirSync(dirEmpresas) : [];
  } catch {
    empresas = [];
  }
  return {
    modo: 'disco-local',
    baseDir: base,
    empresasRegistradas: empresas,
    retencionRespaldos: config.almacenamiento.retencionRespaldos,
  };
}

export { rutasEmpresa };
