/**
 * Motor de sincronización Supabase (nube) ↔ disco G: (espejo local).
 *
 * Estrategia:
 *  1. Toda escritura llega primero a Supabase (fuente de verdad).
 *  2. Después se replica al disco G: (una carpeta por empresa).
 *  3. Si la nube falla, el cambio entra a una bandaja (outbox) en disco y se
 *     reintenta con espera exponencial hasta confirmar.
 *  4. Un reconciliador periódico compara versiones nube↔disco y repara desfases.
 */
import path from 'path';
import fs from 'fs';
import { config } from '../config.js';
import {
  guardarEstadoLocal,
  leerEstadoLocal,
  escrituraAtomica,
  type EstadoEmpresa,
} from './almacenLocal.js';
import {
  guardarDatosEmpresa,
  leerDatosEmpresa,
  supabaseDisponible,
} from './almacenSupabase.js';

interface EntradaBandaja {
  slug: string;
  empresaId: string;
  estado: EstadoEmpresa;
  intentos: number;
  proximoIntento: number;
}

const ARCHIVO_BANDAJA = path.join(config.almacenamiento.baseDir, 'outbox.json');
const bandaja = new Map<string, EntradaBandaja>();
let temporizadorReconciliacion: NodeJS.Timeout | null = null;

/* ---------------- Bandaja de salida (outbox) ---------------- */

function cargarBandaja(): void {
  try {
    if (fs.existsSync(ARCHIVO_BANDAJA)) {
      const entradas: EntradaBandaja[] = JSON.parse(fs.readFileSync(ARCHIVO_BANDAJA, 'utf-8'));
      entradas.forEach((e) => bandaja.set(`${e.slug}:${e.empresaId}`, e));
    }
  } catch {
    // Arranque con bandaja corrupta: se reconstruye vacía.
  }
}

function persistirBandaja(): void {
  try {
    escrituraAtomica(ARCHIVO_BANDAJA, JSON.stringify([...bandaja.values()], null, 2));
  } catch (error) {
    console.warn('[Sync] No se pudo persistir la bandaja:', error);
  }
}

/* ---------------- Escritura dual ---------------- */

export interface ResultadoEscritura {
  nubeOk: boolean;
  localOk: boolean;
  version: number;
  error?: string;
}

/** Guarda el estado de una empresa en la nube y replica al disco G:. */
export async function guardarEstadoEmpresa(
  empresaId: string,
  slug: string,
  estado: EstadoEmpresa
): Promise<ResultadoEscritura> {
  const local = guardarEstadoLocal(slug, estado);
  let nubeOk = false;
  let error: string | undefined;

  if (supabaseDisponible()) {
    try {
      await guardarDatosEmpresa({ empresa_id: empresaId, payload: estado as unknown as Record<string, unknown>, version: estado.version });
      nubeOk = true;
    } catch (e) {
      error = String(e);
      console.error(`[Sync] Falta nube (${slug}); encolado para reintento:`, error);
      bandaja.set(`${slug}:${empresaId}`, {
        slug,
        empresaId,
        estado,
        intentos: 0,
        proximoIntento: Date.now() + 15_000,
      });
      persistirBandaja();
    }
  } else {
    // Sin nube configurada: el disco G: actúa como almacén primario.
    nubeOk = false;
  }

  return { nubeOk, localOk: local.principalOk, version: estado.version, error };
}

/** Lee el estado más fresco entre nube y disco (gana la versión mayor). */
export async function leerEstadoEmpresa(empresaId: string, slug: string): Promise<EstadoEmpresa | null> {
  const local = leerEstadoLocal(slug);
  if (!supabaseDisponible()) return local;

  try {
    const filas = await leerDatosEmpresa(empresaId);
    const nube = filas?.[0]?.payload as unknown as EstadoEmpresa | undefined;
    if (nube && (!local || Number(nube.version ?? 0) > Number(local.version ?? 0))) {
      guardarEstadoLocal(slug, nube); // repara el espejo local
      return nube;
    }
  } catch (error) {
    console.warn(`[Sync] Lectura nube falló (${slug}), usando disco:`, error);
  }
  return local;
}

/* ---------------- Reconciliador ---------------- */

async function reintentarBandaja(): Promise<void> {
  if (!supabaseDisponible() || bandaja.size === 0) return;
  const ahora = Date.now();
  for (const [clave, entrada] of bandaja) {
    if (entrada.proximoIntento > ahora) continue;
    try {
      await guardarDatosEmpresa({
        empresa_id: entrada.empresaId,
        payload: entrada.estado as unknown as Record<string, unknown>,
        version: entrada.estado.version,
      });
      bandaja.delete(clave);
      console.log(`[Sync] Reenvío exitoso (${clave}); bandaja: ${bandaja.size} pendientes`);
    } catch {
      entrada.intentos += 1;
      entrada.proximoIntento = ahora + Math.min(15_000 * 2 ** entrada.intentos, 600_000);
    }
  }
  persistirBandaja();
}

export function iniciarReconciliacion(intervaloMs = 60_000): void {
  cargarBandaja();
  if (temporizadorReconciliacion) return;
  temporizadorReconciliacion = setInterval(() => {
    reintentarBandaja().catch(() => {});
  }, intervaloMs);
  temporizadorReconciliacion.unref();
}

export function detenerReconciliacion(): void {
  if (temporizadorReconciliacion) clearInterval(temporizadorReconciliacion);
  persistirBandaja();
}

/** Diagnóstico para /api/admin/estado. */
export function estadoSincronizacion() {
  return {
    nubeHabilitada: supabaseDisponible(),
    bandajaPendientes: bandaja.size,
    bandajaArchivo: ARCHIVO_BANDAJA,
  };
}
