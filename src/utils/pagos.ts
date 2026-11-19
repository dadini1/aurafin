import type { PaymentItem } from '../types';

/**
 * Normaliza pagos de cualquier origen (localStorage, espejo local, Supabase,
 * versiones antiguas con `monto`/`fecha`/`tipo`).
 *
 * Sin esto un registro heredado con `monto` en lugar de `amount` deja
 * `payment.amount` en `undefined` y rompe el render (`toLocaleString`).
 */
type PagoCrudo = Record<string, unknown>;

const CATEGORIAS = ['alquiler', 'transporte', 'alimentacion', 'servicios', 'ocio', 'salud', 'educacion', 'sueldo', 'freelance', 'otro'];
const FRECUENCIAS = ['unico', 'mensual', 'quincenal', 'anual'];
const ESTADOS = ['pendiente', 'pagado', 'vencido'];

function aNumero(valor: unknown): number {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : 0;
  if (typeof valor === 'string') {
    const limpio = valor.replace(/[^\d.,-]/g, '');
    // "1.500,50" → 1500.50 · "1500.50" → 1500.50
    const normalizado = limpio.includes(',') && limpio.lastIndexOf(',') > limpio.lastIndexOf('.')
      ? limpio.replace(/\./g, '').replace(',', '.')
      : limpio.replace(/,/g, '');
    const n = Number(normalizado);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function aTexto(valor: unknown): string | undefined {
  if (typeof valor === 'string' && valor.trim()) return valor;
  if (typeof valor === 'number') return String(valor);
  return undefined;
}

function aFecha(valor: unknown): string {
  const texto = aTexto(valor);
  if (!texto) return new Date().toISOString().split('T')[0];
  return texto.includes('T') ? texto.slice(0, 10) : texto;
}

export function normalizarPago(crudo: unknown): PaymentItem {
  const p = (crudo && typeof crudo === 'object' ? crudo : {}) as PagoCrudo;

  const categoria = aTexto(p.category ?? p.categoria) || 'otro';
  const frecuencia = aTexto(p.frequency ?? p.frecuencia) || 'unico';
  const estado = aTexto(p.status ?? p.estado) || 'pendiente';
  const tipo = aTexto(p.type ?? p.tipo) || 'gasto';

  return {
    id: aTexto(p.id) || `pay-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: aTexto(p.title ?? p.titulo ?? p.descripcion) || 'Pago',
    amount: aNumero(p.amount ?? p.monto),
    type: tipo === 'ingreso' ? 'ingreso' : 'gasto',
    isFixed: Boolean(p.isFixed ?? p.esFijo ?? p.fijo ?? false),
    category: (CATEGORIAS.includes(categoria) ? categoria : 'otro') as PaymentItem['category'],
    frequency: (FRECUENCIAS.includes(frecuencia) ? frecuencia : 'unico') as PaymentItem['frequency'],
    dueDate: aFecha(p.dueDate ?? p.fecha ?? p.fechaVencimiento),
    status: (ESTADOS.includes(estado) ? estado : 'pendiente') as PaymentItem['status'],
    noteId: aTexto(p.noteId),
    matchedFileIds: Array.isArray(p.matchedFileIds) ? p.matchedFileIds.map(String) : undefined,
    matchedContactIds: Array.isArray(p.matchedContactIds) ? p.matchedContactIds.map(String) : undefined,
    receiptImage: aTexto(p.receiptImage),
    merchant: aTexto(p.merchant ?? p.comercio),
    beneficiary: aTexto(p.beneficiary ?? p.beneficiario),
    detail: aTexto(p.detail ?? p.detalle),
    itemsBreakdown: Array.isArray(p.itemsBreakdown) ? (p.itemsBreakdown as PaymentItem['itemsBreakdown']) : undefined,
    createdAt: aTexto(p.createdAt ?? p.creadoEn) || new Date().toISOString(),
  };
}

export function normalizarPagos(crudos: unknown): PaymentItem[] {
  return Array.isArray(crudos) ? crudos.map(normalizarPago) : [];
}
