/**
 * Configuración central de AuraFin (single source of truth del entorno).
 * - Supabase: base de datos principal en la nube (Postgres + PostgREST).
 * - Disco local (G:): espejo de respaldo por empresa con respaldos diarios.
 * - Seguridad: secreto de sesiones y token heredado de sincronización.
 */
import path from 'path';

const BASE_DIR = path.resolve(process.cwd());

export const config = {
  entorno: process.env.NODE_ENV === 'production' ? 'produccion' : 'desarrollo',
  puerto: Number(process.env.PORT || 3000),
  host: process.env.HOST || '127.0.0.1',

  supabase: {
    url: (process.env.SUPABASE_URL || '').replace(/\/$/, ''),
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    habilitado: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
  },

  almacenamiento: {
    // Directorio principal configurable (por defecto G:\AURAFIN\data)
    baseDir: path.resolve(process.env.AURAFIN_DATA_DIR || path.join(BASE_DIR, 'data')),
    retencionRespaldos: Number(process.env.BACKUP_RETENTION || 7),
  },

  seguridad: {
    secretoSesion: process.env.AURAFIN_SESSION_SECRET || process.env.AURAFIN_SYNC_TOKEN || 'aurafin-desarrollo-inseguro',
    tokenLegado: process.env.AURAFIN_SYNC_TOKEN || '',
    duracionSesionMs: 1000 * 60 * 60 * 12, // 12 horas
  },

  gemini: process.env.GEMINI_API_KEY || '',
};

export type Config = typeof config;
