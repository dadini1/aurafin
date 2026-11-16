import { PaymentItem, UserFinancialProfile } from '../types';

/**
 * Exports payment items to a standard RFC 4180 CSV file with UTF-8 BOM
 * for complete compatibility with Microsoft Excel, Apple Numbers, and Google Sheets.
 */
export interface DateRangeOptions {
  startDate?: string;
  endDate?: string;
  filterLabel?: string;
}

export function exportPaymentsToCSV(
  payments: PaymentItem[],
  profile: UserFinancialProfile,
  dateRange?: DateRangeOptions
): { count: number; filename: string } {
  const headers = [
    'ID',
    'Fecha_Creacion',
    'Fecha_Vencimiento',
    'Concepto',
    'Establecimiento_Comercio',
    'Tipo',
    'Clasificacion',
    'Categoria',
    'Frecuencia',
    'Monto',
    'Moneda',
    'Simbolo_Moneda',
    'Estado',
    'Recibo_Escaneado',
    'Archivos_Vinculados_Cant',
    'Contactos_Vinculados_Cant',
    'Desglose_Articulos',
  ];

  const escapeCSV = (val: string | number | undefined | null): string => {
    if (val === undefined || val === null) return '""';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return `"${str}"`;
  };

  const rows = payments.map((p) => {
    const typeLabel = p.type === 'ingreso' ? 'Ingreso' : 'Gasto';
    const classification =
      p.type === 'ingreso' ? 'Ingreso Fijo' : p.isFixed ? 'Gasto Fijo' : 'Gasto Variable';
    const statusLabel =
      p.status === 'pagado' ? 'Pagado' : p.status === 'vencido' ? 'Vencido' : 'Pendiente';
    const hasReceipt = p.receiptImage ? 'Sí' : 'No';
    const itemsStr =
      p.itemsBreakdown && p.itemsBreakdown.length > 0
        ? p.itemsBreakdown
            .map((item) => `${item.name}${item.price ? ` (${profile.currencySymbol}${item.price})` : ''}`)
            .join('; ')
        : '';

    return [
      escapeCSV(p.id),
      escapeCSV(p.createdAt || ''),
      escapeCSV(p.dueDate || ''),
      escapeCSV(p.title),
      escapeCSV(p.merchant || ''),
      escapeCSV(typeLabel),
      escapeCSV(classification),
      escapeCSV(p.category),
      escapeCSV(p.frequency),
      escapeCSV(p.amount),
      escapeCSV(profile.currency),
      escapeCSV(profile.currencySymbol),
      escapeCSV(statusLabel),
      escapeCSV(hasReceipt),
      escapeCSV(p.matchedFileIds?.length || 0),
      escapeCSV(p.matchedContactIds?.length || 0),
      escapeCSV(itemsStr),
    ].join(',');
  });

  // Prepend UTF-8 Byte Order Mark (BOM) so Excel opens UTF-8 text with accents cleanly
  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);

  const dateStr = new Date().toISOString().split('T')[0];
  const countrySlug = profile.country.replace(/\s+/g, '_');
  const filename = dateRange?.startDate && dateRange?.endDate
    ? `AuraFin_Reporte_Pagos_${dateRange.startDate}_al_${dateRange.endDate}.csv`
    : `AuraFin_Registros_Pagos_${countrySlug}_${dateStr}.csv`;

  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return { count: payments.length, filename };
}
