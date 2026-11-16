/**
 * Autenticación y autorización multiempresa.
 *
 * - Contraseñas: scrypt con sal aleatoria (formato `scrypt:sal:hash`).
 * - Sesiones: token HMAC firmado por el servidor (sin dependencias), con
 *   expiración y alcance a una empresa. El cliente lo envía como Bearer.
 * - Roles jerárquicos por empresa: superadmin > dueno > admin_empresa > empleado > lectura.
 */
import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { config } from '../config.js';

export type Rol = 'superadmin' | 'dueno' | 'admin_empresa' | 'empleado' | 'lectura';

const JERARQUIA: Record<Rol, number> = {
  superadmin: 50,
  dueno: 40,
  admin_empresa: 30,
  empleado: 20,
  lectura: 10,
};

export interface Sesion {
  usuarioId: string;
  empresaId: string;
  slug: string;
  rol: Rol;
  correo: string;
  exp: number;
}

/* ---------------- Contraseñas ---------------- */

export function hashearPassword(password: string): string {
  const sal = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, sal, 64).toString('hex');
  return `scrypt:${sal}:${hash}`;
}

export function verificarPassword(password: string, almacenado: string): boolean {
  const [esquema, sal, hash] = (almacenado || '').split(':');
  if (esquema !== 'scrypt' || !sal || !hash) return false;
  const calculado = crypto.scryptSync(password, sal, 64);
  const esperado = Buffer.from(hash, 'hex');
  return calculado.length === esperado.length && crypto.timingSafeEqual(calculado, esperado);
}

/* ---------------- Tokens de sesión (HMAC) ---------------- */

function firmar(cuerpo: string): string {
  return crypto.createHmac('sha256', config.seguridad.secretoSesion).update(cuerpo).digest('base64url');
}

export function emitirToken(sesion: Omit<Sesion, 'exp'>, duracionMs = config.seguridad.duracionSesionMs): string {
  const payload: Sesion = { ...sesion, exp: Date.now() + duracionMs };
  const cuerpo = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${cuerpo}.${firmar(cuerpo)}`;
}

export function verificarToken(token: string): Sesion | null {
  const [cuerpo, firma] = (token || '').split('.');
  if (!cuerpo || !firma) return null;
  const firmaEsperada = firmar(cuerpo);
  const a = Buffer.from(firma);
  const b = Buffer.from(firmaEsperada);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const sesion = JSON.parse(Buffer.from(cuerpo, 'base64url').toString()) as Sesion;
    if (!sesion.exp || sesion.exp < Date.now()) return null;
    return sesion;
  } catch {
    return null;
  }
}

/* ---------------- Middleware ---------------- */

export interface RequestConSesion extends Request {
  sesion?: Sesion;
}

export function autenticar(req: RequestConSesion, res: Response, next: NextFunction): void {
  const cabecera = req.header('authorization') || '';
  const token = cabecera.startsWith('Bearer ') ? cabecera.slice(7) : '';
  const sesion = verificarToken(token);
  if (!sesion) {
    res.status(401).json({ error: 'Sesión inválida o expirada. Inicia sesión de nuevo.' });
    return;
  }
  req.sesion = sesion;
  next();
}

/** Exige al menos uno de los roles indicados (se admiten roles superiores). */
export function autorizarNivel(nivelMinimo: Rol) {
  return (req: RequestConSesion, res: Response, next: NextFunction): void => {
    if (!req.sesion) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }
    if (JERARQUIA[req.sesion.rol] < JERARQUIA[nivelMinimo]) {
      res.status(403).json({ error: `Permiso insuficiente (requiere ${nivelMinimo} o superior)` });
      return;
    }
    next();
  };
}

/** Token heredado (AURAFIN_SYNC_TOKEN). Si el servidor no define token,
 *  el modo local queda abierto (igual que la versión anterior); con token,
 *  solo la cabecera exacta activa el modo heredado. */
export function tokenLegadoValido(req: Request): boolean {
  if (!config.seguridad.tokenLegado) return !req.header('authorization');
  return req.header('x-aurafin-token') === config.seguridad.tokenLegado;
}
