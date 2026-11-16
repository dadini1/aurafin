/**
 * AuraFin AI - Sync authentication helper
 * Cuando el servidor define AURAFIN_SYNC_TOKEN, el cliente debe enviar el
 * mismo secreto en la cabecera `x-aurafin-token`. Se guarda localmente en
 * localStorage (clave `aurafin_sync_token`) desde Configuración → Seguridad.
 * En modo local sin token, no se envía nada y todo funciona igual.
 */

export const SYNC_TOKEN_STORAGE_KEY = 'aurafin_sync_token';

export function getSyncToken(): string {
  try {
    return localStorage.getItem(SYNC_TOKEN_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function setSyncToken(token: string): void {
  try {
    if (token.trim()) {
      localStorage.setItem(SYNC_TOKEN_STORAGE_KEY, token.trim());
    } else {
      localStorage.removeItem(SYNC_TOKEN_STORAGE_KEY);
    }
  } catch {
    // almacenamiento no disponible
  }
}

export function syncHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...extra };
  const token = getSyncToken();
  if (token) headers['x-aurafin-token'] = token;
  return headers;
}