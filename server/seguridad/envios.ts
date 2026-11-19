/**
 * Generación y entrega de contraseñas temporales.
 *
 * - WhatsApp: enlace `wa.me` real con el mensaje pre-cargado (funciona hoy,
 *   sin credenciales ni API de terceros).
 * - Correo: enlace `mailto:` como respaldo y, si existe RESEND_API_KEY,
 *   envío real vía Resend (https://resend.com).
 *
 * La contraseña temporal solo la recibe el administrador que la generó,
 * dentro de la respuesta de la API (nunca se guarda en texto plano).
 */
import crypto from 'crypto';

/** Contraseña temporal legible y segura: A-z0-9, mínimo 8 (aquí 12). */
export function generarPasswordTemporal(longitud = 12): string {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(longitud);
  let clave = '';
  for (let i = 0; i < longitud; i++) clave += alfabeto[bytes[i] % alfabeto.length];
  // Garantiza al menos una mayúscula, una minúscula y un dígito
  if (!/[A-Z]/.test(clave) || !/[a-z]/.test(clave) || !/[0-9]/.test(clave)) {
    return generarPasswordTemporal(longitud);
  }
  return clave;
}

/** Normaliza un teléfono a formato internacional para wa.me (solo dígitos). */
export function normalizarTelefono(telefono: string): string {
  return String(telefono || '').replace(/[^0-9]/g, '');
}

/** Enlace de WhatsApp con mensaje pre-cargado para la contraseña temporal. */
export function enlaceWhatsApp(destinatario: string, mensaje: string): string {
  const tel = normalizarTelefono(destinatario);
  return `https://wa.me/${tel}?text=${encodeURIComponent(mensaje)}`;
}

/** Enlace mailto: con la contraseña lista para enviar (respaldo universal). */
export function enlaceCorreo(destino: string, asunto: string, cuerpo: string): string {
  return `mailto:${destino}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
}

/** Envío real por Resend si hay RESEND_API_KEY; si no, devuelve false. */
export async function enviarCorreoReal(
  destino: string,
  asunto: string,
  cuerpo: string,
): Promise<{ enviado: boolean; detalle: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { enviado: false, detalle: 'RESEND_API_KEY no configurada; usa el enlace de correo' };
  try {
    const respuesta = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || 'AuraFin <onboarding@resend.dev>',
        to: [destino],
        subject: asunto,
        text: cuerpo,
      }),
    });
    if (!respuesta.ok) {
      const detalle = await respuesta.text().catch(() => '');
      return { enviado: false, detalle: `Resend HTTP ${respuesta.status}: ${detalle.slice(0, 200)}` };
    }
    return { enviado: true, detalle: 'Correo enviado vía Resend' };
  } catch (error) {
    return { enviado: false, detalle: String(error) };
  }
}

/** Mensaje estándar para la entrega de contraseña temporal. */
export function mensajePasswordTemporal(nombre: string, usuario: string, password: string, producto = 'AuraFin'): string {
  return [
    `Hola ${nombre},`,
    '',
    `Tu cuenta en ${producto} ha sido creada / restablecida.`,
    `Usuario: ${usuario}`,
    `Contraseña temporal: ${password}`,
    '',
    'Por seguridad, deberás cambiarla la primera vez que ingreses.',
    '',
    '— Equipo AuraFin',
  ].join('\n');
}
