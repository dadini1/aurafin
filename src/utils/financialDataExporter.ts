import { PaymentItem, SavingsGoal, NoteItem, UserFinancialProfile, SixMonthSavingsStrategy } from '../types';
import { generateSavingsStrategy } from '../services/savingsStrategyService';

export interface ExportOptions {
  includePayments: boolean;
  includeSavingsGoals: boolean;
  includeNotes: boolean;
  includeSavingsStrategy: boolean;
  includeProfileSummary: boolean;
}

export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  includePayments: true,
  includeSavingsGoals: true,
  includeNotes: true,
  includeSavingsStrategy: true,
  includeProfileSummary: true,
};

const escapeCSV = (val: string | number | boolean | undefined | null): string => {
  if (val === undefined || val === null) return '""';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
};

/**
 * Builds the complete structured JSON payload for external analysis
 */
export function buildFinancialExportJSON(
  payments: PaymentItem[],
  goals: SavingsGoal[],
  notes: NoteItem[] = [],
  profile: UserFinancialProfile,
  categoryBudgets: Record<string, number> = {},
  options: ExportOptions = DEFAULT_EXPORT_OPTIONS
) {
  const strategy: SixMonthSavingsStrategy = generateSavingsStrategy(payments, categoryBudgets, profile, goals);

  const totalIncome =
    payments.filter((p) => p.type === 'ingreso').reduce((sum, p) => sum + p.amount, 0) || profile.monthlyIncome;
  const fixedExpenses = payments
    .filter((p) => p.type === 'gasto' && p.isFixed)
    .reduce((sum, p) => sum + p.amount, 0);
  const variableExpenses = payments
    .filter((p) => p.type === 'gasto' && !p.isFixed)
    .reduce((sum, p) => sum + p.amount, 0);
  const totalExpenses = fixedExpenses + variableExpenses;
  const netSavings = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? Math.round((netSavings / totalIncome) * 100) : 0;

  const totalGoalsTarget = goals.reduce((sum, g) => sum + g.targetAmount, 0);
  const totalGoalsAccumulated = goals.reduce((sum, g) => sum + g.currentAmount, 0);

  const exportPayload: Record<string, any> = {
    metadata: {
      application: 'AuraFin',
      exportVersion: '2.5',
      exportedAt: new Date().toISOString(),
      country: profile.country,
      currency: profile.currency,
      currencySymbol: profile.currencySymbol,
    },
  };

  if (options.includeProfileSummary) {
    exportPayload.financialSummary = {
      monthlyIncome: totalIncome,
      fixedExpenses,
      variableExpenses,
      totalExpenses,
      monthlyNetSavings: netSavings,
      savingsRatePercent: savingsRate,
      definedTargetPercent: profile.savingsGoalPercent,
      annualSavingsProjection: Math.max(0, netSavings) * 12,
      totalGoalsTarget,
      totalGoalsAccumulated,
      overallGoalsProgressPercent:
        totalGoalsTarget > 0 ? Math.round((totalGoalsAccumulated / totalGoalsTarget) * 100) : 0,
      transportAlertThreshold: profile.transportAlertThreshold,
      rentAlertThreshold: profile.rentAlertThreshold,
    };
  }

  if (options.includePayments) {
    exportPayload.paymentsHistory = payments.map((p) => ({
      id: p.id,
      createdAt: p.createdAt,
      dueDate: p.dueDate,
      title: p.title,
      merchant: p.merchant || null,
      type: p.type,
      isFixed: p.isFixed,
      category: p.category,
      frequency: p.frequency,
      amount: p.amount,
      status: p.status,
      hasReceipt: Boolean(p.receiptImage),
      matchedFilesCount: p.matchedFileIds?.length || 0,
      matchedContactsCount: p.matchedContactIds?.length || 0,
      itemsBreakdown: p.itemsBreakdown || [],
    }));
  }

  if (options.includeSavingsGoals) {
    exportPayload.savingsGoals = goals.map((g) => {
      const remaining = Math.max(0, g.targetAmount - g.currentAmount);
      const progressPercent = g.targetAmount > 0 ? Math.round((g.currentAmount / g.targetAmount) * 100) : 0;
      const monthsLeft = g.monthlyContribution > 0 ? Math.ceil(remaining / g.monthlyContribution) : 0;

      return {
        id: g.id,
        createdAt: g.createdAt,
        title: g.title,
        category: g.category,
        targetAmount: g.targetAmount,
        currentAmount: g.currentAmount,
        remainingAmount: remaining,
        progressPercent,
        monthlyContribution: g.monthlyContribution,
        deadline: g.deadline,
        projectedMonthsRemaining: monthsLeft,
        notes: g.notes || null,
      };
    });
  }

  if (options.includeNotes && notes.length > 0) {
    exportPayload.notesAndVoiceRecords = notes.map((n) => ({
      id: n.id,
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
      title: n.title,
      category: n.category,
      intent: n.intent || 'nota',
      content: n.content,
      formattedContent: n.formattedContent,
      tags: n.tags || [],
      isPinned: Boolean(n.isPinned),
      matchedFilesCount: n.matchedFileIds?.length || 0,
      matchedContactsCount: n.matchedContactIds?.length || 0,
      linkedPaymentId: n.linkedPaymentId || null,
      linkedGoalId: n.linkedGoalId || null,
    }));
  }

  if (options.includeSavingsStrategy) {
    exportPayload.sixMonthSavingsStrategy = {
      generatedAt: strategy.generatedAt,
      totalMonthlyCutPotential: strategy.totalMonthlyCutPotential,
      totalSixMonthProjectedSavings: strategy.totalSixMonthProjectedSavings,
      currentSavingsRate: strategy.currentSavingsRate,
      optimizedSavingsRate: strategy.optimizedSavingsRate,
      strategicSummary: strategy.strategicSummary,
      exceededCategories: strategy.exceededCategories.map((c) => ({
        category: c.category,
        label: c.categoryLabel,
        currentSpend: c.currentSpend,
        historicalAverage: c.historicalAverage,
        excessAmount: c.excessAmount,
        excessPercentage: c.excessPercentage,
        suggestedMonthlyCut: c.suggestedMonthlyCut,
        suggestedTargetSpend: c.suggestedTargetSpend,
        priority: c.priority,
        cutRationale: c.cutRationale,
      })),
      timeline: strategy.sixMonthTimeline.map((t) => ({
        monthIndex: t.monthIndex,
        monthName: t.monthName,
        projectedMonthlySavings: t.projectedMonthlySavings,
        cumulativeSavings: t.cumulativeSavings,
        activeCutsTotal: t.activeCutsTotal,
        milestoneTitle: t.milestoneTitle,
        focusRecommendation: t.focusRecommendation,
      })),
      acceleratedGoals: strategy.acceleratedGoals,
      actionPlanSteps: strategy.actionPlanSteps,
    };
  }

  return exportPayload;
}

/**
 * Trigger download of structured JSON file
 */
export function exportFinancialDataToJSON(
  payments: PaymentItem[],
  goals: SavingsGoal[],
  notes: NoteItem[] = [],
  profile: UserFinancialProfile,
  categoryBudgets: Record<string, number> = {},
  options: ExportOptions = DEFAULT_EXPORT_OPTIONS
): { filename: string; sizeKB: number; totalRecords: number } {
  const data = buildFinancialExportJSON(payments, goals, notes, profile, categoryBudgets, options);
  const jsonString = JSON.stringify(data, null, 2);

  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  const dateStr = new Date().toISOString().split('T')[0];
  const countrySlug = profile.country.replace(/\s+/g, '_');
  const filename = `AuraFin_Finanzas_Notas_Metas_${countrySlug}_${dateStr}.json`;

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  const totalRecords =
    (options.includePayments ? payments.length : 0) +
    (options.includeSavingsGoals ? goals.length : 0) +
    (options.includeNotes ? notes.length : 0);

  return {
    filename,
    sizeKB: Math.round((blob.size / 1024) * 10) / 10,
    totalRecords,
  };
}

/**
 * Exports consolidated financial history (payments, savings goals, notes, and 6-month plan) to RFC 4180 CSV
 * formatted with UTF-8 BOM for full compatibility with Microsoft Excel, Google Sheets, Apple Numbers, Python, R, and BI tools.
 */
export function exportFinancialDataToCSV(
  payments: PaymentItem[],
  goals: SavingsGoal[],
  notes: NoteItem[] = [],
  profile: UserFinancialProfile,
  categoryBudgets: Record<string, number> = {},
  options: ExportOptions = DEFAULT_EXPORT_OPTIONS
): { filename: string; totalRecords: number } {
  const lines: string[] = [];
  const currSym = profile.currencySymbol || '$';
  const strategy = generateSavingsStrategy(payments, categoryBudgets, profile, goals);

  // 1. Profile and Financial Health Summary
  if (options.includeProfileSummary) {
    const totalIncome =
      payments.filter((p) => p.type === 'ingreso').reduce((sum, p) => sum + p.amount, 0) || profile.monthlyIncome;
    const totalExpenses = payments.filter((p) => p.type === 'gasto').reduce((sum, p) => sum + p.amount, 0);
    const netSavings = totalIncome - totalExpenses;
    const rate = totalIncome > 0 ? Math.round((netSavings / totalIncome) * 100) : 0;

    lines.push('--- REPORTE DE SALUD FINANCIERA Y PERFIL AURAFIN ---');
    lines.push(
      ['Pais', 'Moneda', 'Ingreso_Mensual', 'Gastos_Totales', 'Ahorro_Neto', 'Tasa_Ahorro_Actual', 'Tasa_Optimizada_6M']
        .map(escapeCSV)
        .join(',')
    );
    lines.push(
      [
        profile.country,
        profile.currency,
        `${currSym}${totalIncome}`,
        `${currSym}${totalExpenses}`,
        `${currSym}${netSavings}`,
        `${rate}%`,
        `${strategy.optimizedSavingsRate}%`,
      ]
        .map(escapeCSV)
        .join(',')
    );
    lines.push('');
  }

  // 2. Payments & Financial Transactions History
  if (options.includePayments && payments.length > 0) {
    lines.push('--- HISTORIAL DE REGISTROS FINANCIEROS Y GASTOS ---');
    const paymentHeaders = [
      'ID_Registro',
      'Fecha_Vencimiento',
      'Concepto_Titulo',
      'Establecimiento_Comercio',
      'Tipo_Flujo',
      'Clasificacion',
      'Categoria',
      'Frecuencia',
      'Monto',
      'Moneda',
      'Estado',
      'Tiene_Recibo_Foto',
      'Archivos_Vinculados_Cant',
      'Contactos_Vinculados_Cant',
      'Desglose_Articulos',
    ];
    lines.push(paymentHeaders.map(escapeCSV).join(','));

    payments.forEach((p) => {
      const typeLabel = p.type === 'ingreso' ? 'Ingreso' : 'Gasto';
      const classification = p.type === 'ingreso' ? 'Ingreso Fijo' : p.isFixed ? 'Gasto Fijo' : 'Gasto Variable';
      const statusLabel = p.status === 'pagado' ? 'Pagado' : p.status === 'vencido' ? 'Vencido' : 'Pendiente';
      const itemsStr =
        p.itemsBreakdown?.map((i) => `${i.name}${i.price ? ` (${currSym}${i.price})` : ''}`).join('; ') || '';

      lines.push(
        [
          p.id,
          p.dueDate || '',
          p.title,
          p.merchant || '',
          typeLabel,
          classification,
          p.category,
          p.frequency,
          p.amount,
          profile.currency,
          statusLabel,
          p.receiptImage ? 'Si' : 'No',
          p.matchedFileIds?.length || 0,
          p.matchedContactIds?.length || 0,
          itemsStr,
        ]
          .map(escapeCSV)
          .join(',')
      );
    });
    lines.push('');
  }

  // 3. Savings Goals and History
  if (options.includeSavingsGoals && goals.length > 0) {
    lines.push('--- HISTORIAL Y METAS DE AHORRO PROGRAMADAS ---');
    const goalHeaders = [
      'ID_Meta',
      'Titulo_Meta',
      'Categoria',
      'Monto_Objetivo',
      'Monto_Ahorrado_Actual',
      'Monto_Restante',
      'Porcentaje_Cumplimiento',
      'Aporte_Mensual_Programado',
      'Fecha_Limite',
      'Meses_Restantes_Estimados',
      'Notas',
    ];
    lines.push(goalHeaders.map(escapeCSV).join(','));

    goals.forEach((g) => {
      const remaining = Math.max(0, g.targetAmount - g.currentAmount);
      const pct = g.targetAmount > 0 ? Math.round((g.currentAmount / g.targetAmount) * 100) : 0;
      const monthsLeft = g.monthlyContribution > 0 ? Math.ceil(remaining / g.monthlyContribution) : 0;

      lines.push(
        [
          g.id,
          g.title,
          g.category,
          g.targetAmount,
          g.currentAmount,
          remaining,
          `${pct}%`,
          g.monthlyContribution,
          g.deadline,
          monthsLeft,
          g.notes || '',
        ]
          .map(escapeCSV)
          .join(',')
      );
    });
    lines.push('');
  }

  // 4. Notes & Voice Dictation History
  if (options.includeNotes && notes.length > 0) {
    lines.push('--- NOTAS FINANCIERAS Y RECORDATORIOS DE VOZ ---');
    const noteHeaders = [
      'ID_Nota',
      'Fecha_Creacion',
      'Titulo_Nota',
      'Categoria',
      'Intencion_Detectada',
      'Contenido_Texto',
      'Etiquetas_Tags',
      'Fijada_Pin',
      'Archivos_Vinculados_Cant',
      'Contactos_Vinculados_Cant',
      'ID_Pago_Vinculado',
      'ID_Meta_Vinculada',
    ];
    lines.push(noteHeaders.map(escapeCSV).join(','));

    notes.forEach((n) => {
      const tagsStr = (n.tags || []).join('; ');
      // Sanitize multi-line text for clean CSV representation
      const cleanContent = (n.content || '').replace(/\r?\n/g, ' ');

      lines.push(
        [
          n.id,
          n.createdAt,
          n.title,
          n.category,
          n.intent || 'nota',
          cleanContent,
          tagsStr,
          n.isPinned ? 'Si' : 'No',
          n.matchedFileIds?.length || 0,
          n.matchedContactIds?.length || 0,
          n.linkedPaymentId || '',
          n.linkedGoalId || '',
        ]
          .map(escapeCSV)
          .join(',')
      );
    });
    lines.push('');
  }

  // 5. Six-Month Savings Strategy & Exceeded Categories
  if (options.includeSavingsStrategy) {
    lines.push('--- ESTRATEGIA DE AHORRO A 6 MESES (generateSavingsStrategy) ---');
    lines.push(
      [
        'Mes_Indice',
        'Nombre_Mes',
        'Ahorro_Proyectado_Mes',
        'Ahorro_Acumulado_Total',
        'Aporte_Por_Recortes',
        'Hito_Fase',
        'Recomendacion_Tactica',
      ]
        .map(escapeCSV)
        .join(',')
    );

    strategy.sixMonthTimeline.forEach((t) => {
      lines.push(
        [
          t.monthIndex,
          t.monthName,
          t.projectedMonthlySavings,
          t.cumulativeSavings,
          t.activeCutsTotal,
          t.milestoneTitle,
          t.focusRecommendation,
        ]
          .map(escapeCSV)
          .join(',')
      );
    });
    lines.push('');

    lines.push('--- CATEGORIAS CON SOBREGASTO SOBRE PROMEDIO HISTORICO ---');
    lines.push(
      [
        'Categoria',
        'Gasto_Actual',
        'Promedio_Historico',
        'Exceso_Monto',
        'Exceso_Porcentaje',
        'Recorte_Sugerido_Mes',
        'Nuevo_Tope_Presupuesto',
        'Prioridad',
        'Justificacion_Recorte',
      ]
        .map(escapeCSV)
        .join(',')
    );

    strategy.exceededCategories.forEach((c) => {
      lines.push(
        [
          c.categoryLabel,
          c.currentSpend,
          c.historicalAverage,
          c.excessAmount,
          `${c.excessPercentage}%`,
          c.suggestedMonthlyCut,
          c.suggestedTargetSpend,
          c.priority,
          c.cutRationale,
        ]
          .map(escapeCSV)
          .join(',')
      );
    });
  }

  // Prepend UTF-8 BOM for Microsoft Excel / Google Sheets compatibility
  const csvContent = '\uFEFF' + lines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  const dateStr = new Date().toISOString().split('T')[0];
  const countrySlug = profile.country.replace(/\s+/g, '_');
  const filename = `AuraFin_Finanzas_Notas_Metas_${countrySlug}_${dateStr}.csv`;

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  const totalRecords =
    (options.includePayments ? payments.length : 0) +
    (options.includeSavingsGoals ? goals.length : 0) +
    (options.includeNotes ? notes.length : 0);

  return { filename, totalRecords };
}

/**
 * Convenience function for instant 1-click CSV export of all financial records, notes, and goals
 */
export function exportAllDataToStructuredCSV(
  payments: PaymentItem[],
  goals: SavingsGoal[],
  notes: NoteItem[] = [],
  profile: UserFinancialProfile,
  categoryBudgets: Record<string, number> = {}
): { filename: string; totalRecords: number } {
  return exportFinancialDataToCSV(payments, goals, notes, profile, categoryBudgets, DEFAULT_EXPORT_OPTIONS);
}

/**
 * Exports the user's complete transaction history and savings goals to a single downloadable CSV file
 * compatible with Excel, Google Sheets, and Apple Numbers (RFC 4180 + UTF-8 BOM).
 */
export function exportTransactionsAndGoalsToCSV(
  payments: PaymentItem[],
  goals: SavingsGoal[],
  profile: UserFinancialProfile
): { filename: string; transactionsCount: number; goalsCount: number; totalRecords: number } {
  const lines: string[] = [];
  const currSym = profile.currencySymbol || '$';

  const totalIncome = payments
    .filter((p) => p.type === 'ingreso')
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const totalExpenses = payments
    .filter((p) => p.type === 'gasto')
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const totalGoalsTarget = goals.reduce((sum, g) => sum + (Number(g.targetAmount) || 0), 0);
  const totalGoalsSaved = goals.reduce((sum, g) => sum + (Number(g.currentAmount) || 0), 0);
  const goalsPct = totalGoalsTarget > 0 ? Math.round((totalGoalsSaved / totalGoalsTarget) * 100) : 0;

  lines.push('--- RESUMEN DE HISTORIAL FINANCIERO Y METAS DE AHORRO ---');
  lines.push(
    [
      'Fecha_Exportacion',
      'Pais',
      'Moneda',
      'Total_Transacciones',
      'Total_Ingresos_Registrados',
      'Total_Gastos_Registrados',
      'Balance_Neto',
      'Cantidad_Metas_Ahorro',
      'Total_Ahorrado_En_Metas',
      'Objetivo_Total_Metas',
      'Cumplimiento_Global_Metas',
    ]
      .map(escapeCSV)
      .join(',')
  );
  lines.push(
    [
      new Date().toISOString().split('T')[0],
      profile.country,
      profile.currency,
      payments.length,
      totalIncome,
      totalExpenses,
      totalIncome - totalExpenses,
      goals.length,
      totalGoalsSaved,
      totalGoalsTarget,
      `${goalsPct}%`,
    ]
      .map(escapeCSV)
      .join(',')
  );
  lines.push('');

  lines.push('--- HISTORIAL COMPLETO DE TRANSACCIONES (INGRESOS Y GASTOS) ---');
  lines.push(
    [
      'ID_Transaccion',
      'Fecha',
      'Fecha_Creacion',
      'Concepto_Titulo',
      'Comercio',
      'Tipo',
      'Naturaleza',
      'Categoria',
      'Frecuencia',
      'Monto',
      'Moneda',
      'Estado',
      'Desglose_Articulos',
    ]
      .map(escapeCSV)
      .join(',')
  );

  const sortedPayments = [...payments].sort((a, b) =>
    (b.dueDate || b.createdAt || '').localeCompare(a.dueDate || a.createdAt || '')
  );

  sortedPayments.forEach((p) => {
    const typeLabel = p.type === 'ingreso' ? 'Ingreso' : 'Gasto';
    const natureLabel = p.type === 'ingreso' ? 'Ingreso' : p.isFixed ? 'Fijo' : 'Variable';
    const statusLabel = p.status === 'pagado' ? 'Pagado' : p.status === 'vencido' ? 'Vencido' : 'Pendiente';
    const itemsStr =
      p.itemsBreakdown?.map((i) => `${i.name}${i.price ? ` (${currSym}${i.price})` : ''}`).join('; ') || '';

    lines.push(
      [
        p.id,
        p.dueDate || '',
        p.createdAt || '',
        p.title,
        p.merchant || '',
        typeLabel,
        natureLabel,
        p.category,
        p.frequency,
        p.amount,
        profile.currency,
        statusLabel,
        itemsStr,
      ]
        .map(escapeCSV)
        .join(',')
    );
  });
  lines.push('');

  lines.push('--- METAS DE AHORRO DEFINIDAS ---');
  lines.push(
    [
      'ID_Meta',
      'Titulo_Meta',
      'Categoria',
      'Monto_Ahorrado',
      'Monto_Objetivo',
      'Monto_Restante',
      'Porcentaje_Cumplimiento',
      'Aporte_Mensual',
      'Fecha_Limite',
      'Meses_Estimados_Restantes',
      'Fecha_Creacion',
      'Notas',
    ]
      .map(escapeCSV)
      .join(',')
  );

  goals.forEach((g) => {
    const remaining = Math.max(0, g.targetAmount - g.currentAmount);
    const pct = g.targetAmount > 0 ? Math.round((g.currentAmount / g.targetAmount) * 100) : 0;
    const monthsLeft =
      remaining === 0 ? 0 : g.monthlyContribution > 0 ? Math.ceil(remaining / g.monthlyContribution) : 0;

    lines.push(
      [
        g.id,
        g.title,
        g.category,
        g.currentAmount,
        g.targetAmount,
        remaining,
        `${pct}%`,
        g.monthlyContribution,
        g.deadline,
        monthsLeft,
        g.createdAt || '',
        g.notes || '',
      ]
        .map(escapeCSV)
        .join(',')
    );
  });

  const csvContent = '\uFEFF' + lines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  const dateStr = new Date().toISOString().split('T')[0];
  const countrySlug = profile.country.replace(/\s+/g, '_');
  const filename = `AuraFin_Transacciones_y_Metas_${countrySlug}_${dateStr}.csv`;

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return {
    filename,
    transactionsCount: payments.length,
    goalsCount: goals.length,
    totalRecords: payments.length + goals.length,
  };
}

