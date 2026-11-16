import { jsPDF } from 'jspdf';
import {
  UserFinancialProfile,
  PaymentItem,
  SavingsGoal,
  FinancialAdviceReport,
  DeviceContact,
} from '../types';

interface PDFReportData {
  profile: UserFinancialProfile;
  payments: PaymentItem[];
  goals: SavingsGoal[];
  adviceReport?: FinancialAdviceReport | null;
  transportExpense: number;
  rentExpense: number;
  contacts?: DeviceContact[];
}

export function generateFinancialReportPDF({
  profile,
  payments,
  goals,
  adviceReport,
  transportExpense,
  rentExpense,
  contacts = [],
}: PDFReportData): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  let y = 16;

  // Colors
  const darkNavy = [15, 23, 42]; // #0f172a
  const cyanColor = [14, 165, 233]; // #0ea5e9
  const emeraldColor = [16, 185, 129]; // #10b981
  const amberColor = [245, 158, 11]; // #f59e0b
  const slateDark = [51, 65, 85]; // #334155
  const slateLight = [241, 245, 249]; // #f1f5f9
  const textMuted = [100, 116, 139]; // #64748b

  // Calculations
  const totalIncome =
    payments
      .filter((p) => p.type === 'ingreso')
      .reduce((sum, p) => sum + p.amount, 0) || profile.monthlyIncome;

  const fixedExpenses = payments
    .filter((p) => p.type === 'gasto' && p.isFixed)
    .reduce((sum, p) => sum + p.amount, 0);

  const variableExpenses = payments
    .filter((p) => p.type === 'gasto' && !p.isFixed)
    .reduce((sum, p) => sum + p.amount, 0);

  const totalExpenses = fixedExpenses + variableExpenses;
  const netSavings = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? Math.round((netSavings / totalIncome) * 100) : 0;
  const annualSavings = Math.max(0, netSavings) * 12;

  const needsRate = totalIncome > 0 ? Math.round((fixedExpenses / totalIncome) * 100) : 0;
  const wantsRate = totalIncome > 0 ? Math.round((variableExpenses / totalIncome) * 100) : 0;

  // 1. Header Banner
  doc.setFillColor(darkNavy[0], darkNavy[1], darkNavy[2]);
  doc.roundedRect(margin, y, contentWidth, 26, 3, 3, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('AuraFin AI · Reporte Financiero & Patrimonio', margin + 6, y + 10);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(cyanColor[0], cyanColor[1], cyanColor[2]);
  doc.text(
    `País: ${profile.country} | Moneda: ${profile.currency} (${profile.currencySymbol}) | Fecha: ${new Date().toLocaleDateString('es-ES')}`,
    margin + 6,
    y + 17
  );

  y += 32;

  // 2. Executive Summary Metrics (4 boxes)
  const boxWidth = (contentWidth - 9) / 4;
  const boxHeight = 20;

  const metricBoxes = [
    { title: 'Ingreso Mensual', val: `${profile.currencySymbol}${totalIncome.toLocaleString()}`, color: cyanColor },
    { title: 'Gastos Fijos', val: `${profile.currencySymbol}${fixedExpenses.toLocaleString()}`, color: amberColor },
    { title: 'Gastos Variables', val: `${profile.currencySymbol}${variableExpenses.toLocaleString()}`, color: amberColor },
    { title: 'Ahorro Neto', val: `${profile.currencySymbol}${netSavings.toLocaleString()} (${savingsRate}%)`, color: emeraldColor },
  ];

  metricBoxes.forEach((box, i) => {
    const bx = margin + i * (boxWidth + 3);
    doc.setFillColor(slateLight[0], slateLight[1], slateLight[2]);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(bx, y, boxWidth, boxHeight, 2, 2, 'FD');

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text(box.title.toUpperCase(), bx + 3, y + 6);

    doc.setFontSize(10.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(box.color[0], box.color[1], box.color[2]);
    doc.text(box.val, bx + 3, y + 15);
  });

  y += boxHeight + 8;

  // 3. 50/30/20 Rule Diagnosis & Proactive Financial Health Badge
  const goalsTarget =
    goals.reduce((acc, g) => acc + (g.monthlyContribution || 0), 0) || Math.round(totalIncome * 0.2);
  const goalFulfillment = goalsTarget > 0 ? Math.round((netSavings / goalsTarget) * 100) : 0;
  const healthBadge =
    netSavings <= 0 || goalFulfillment < 50
      ? 'CRÍTICA (D)'
      : goalFulfillment < 80
      ? 'RIESGO LEVE (C)'
      : goalFulfillment < 100
      ? 'MODERADA (B)'
      : goalFulfillment < 120
      ? 'SALUDABLE (A)'
      : 'SOBRESALIENTE (A+)';

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, y, contentWidth, 18, 2, 2, 'FD');

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(darkNavy[0], darkNavy[1], darkNavy[2]);
  doc.text(
    `Diagnóstico de Salud Financiera: ${healthBadge} · Cumplimiento de Meta de Ahorro: ${goalFulfillment}%`,
    margin + 4,
    y + 5.5
  );

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(slateDark[0], slateDark[1], slateDark[2]);
  const statusText =
    goalFulfillment >= 100
      ? `Ahorro mensual real (${profile.currencySymbol}${netSavings.toLocaleString()}) cubre con solvencia la meta definida (${profile.currencySymbol}${goalsTarget.toLocaleString()}/mes).`
      : `Ahorro real (${profile.currencySymbol}${netSavings.toLocaleString()}) presenta una brecha de ${profile.currencySymbol}${Math.abs(goalsTarget - netSavings).toLocaleString()}/mes frente al objetivo (${profile.currencySymbol}${goalsTarget.toLocaleString()}).`;

  doc.text(
    `Fijos: ${needsRate}% (≤50%) | Variables: ${wantsRate}% (≤30%) | Ahorro Neto: ${savingsRate}% (≥20%) · ${statusText}`,
    margin + 4,
    y + 11
  );

  y += 24;

  // 4. Programmed Payments Section
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(darkNavy[0], darkNavy[1], darkNavy[2]);
  doc.text('1. Programación de Pagos y Compromisos', margin, y);
  y += 5;

  // Table header
  doc.setFillColor(darkNavy[0], darkNavy[1], darkNavy[2]);
  doc.rect(margin, y, contentWidth, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('Concepto', margin + 4, y + 4.5);
  doc.text('Tipo', margin + 85, y + 4.5);
  doc.text('Monto', margin + 115, y + 4.5);
  doc.text('Vencimiento', margin + 140, y + 4.5);
  doc.text('Estado', margin + 165, y + 4.5);
  y += 7;

  // Payments Rows
  payments.slice(0, 8).forEach((p, index) => {
    const isEven = index % 2 === 0;
    if (isEven) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y, contentWidth, 6, 'F');
    }

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(slateDark[0], slateDark[1], slateDark[2]);

    const titleStr = p.title.length > 45 ? p.title.substring(0, 42) + '...' : p.title;
    doc.text(titleStr, margin + 4, y + 4);

    const typeStr = p.type === 'ingreso' ? 'Ingreso' : p.isFixed ? 'Gasto Fijo' : 'Gasto Var.';
    doc.text(typeStr, margin + 85, y + 4);

    const prefix = p.type === 'ingreso' ? '+' : '-';
    doc.text(`${prefix}${profile.currencySymbol}${p.amount.toLocaleString()}`, margin + 115, y + 4);

    doc.text(p.dueDate || 'Mensual', margin + 140, y + 4);

    doc.setFont('helvetica', 'bold');
    if (p.status === 'pagado') {
      doc.setTextColor(emeraldColor[0], emeraldColor[1], emeraldColor[2]);
      doc.text('PAGADO', margin + 165, y + 4);
    } else {
      doc.setTextColor(amberColor[0], amberColor[1], amberColor[2]);
      doc.text('PENDIENTE', margin + 165, y + 4);
    }

    y += 6;
  });

  y += 6;

  // 5. Savings Goals Section
  if (goals.length > 0) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(darkNavy[0], darkNavy[1], darkNavy[2]);
    doc.text('2. Metas de Ahorro Activas', margin, y);
    y += 5;

    doc.setFillColor(slateDark[0], slateDark[1], slateDark[2]);
    doc.rect(margin, y, contentWidth, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Meta de Ahorro', margin + 4, y + 4.5);
    doc.text('Categoría', margin + 80, y + 4.5);
    doc.text('Meta', margin + 110, y + 4.5);
    doc.text('Acumulado', margin + 135, y + 4.5);
    doc.text('Progreso', margin + 165, y + 4.5);
    y += 7;

    goals.forEach((g, index) => {
      const isEven = index % 2 === 0;
      if (isEven) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, y, contentWidth, 6, 'F');
      }

      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(slateDark[0], slateDark[1], slateDark[2]);

      const titleStr = g.title.length > 40 ? g.title.substring(0, 38) + '...' : g.title;
      doc.text(titleStr, margin + 4, y + 4);
      doc.text(g.category.toUpperCase(), margin + 80, y + 4);
      doc.text(`${profile.currencySymbol}${g.targetAmount.toLocaleString()}`, margin + 110, y + 4);
      doc.text(`${profile.currencySymbol}${g.currentAmount.toLocaleString()}`, margin + 135, y + 4);

      const percent = Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100));
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(cyanColor[0], cyanColor[1], cyanColor[2]);
      doc.text(`${percent}%`, margin + 165, y + 4);

      y += 6;
    });

    y += 8;
  }

  // 6. Proactive Strategic Recommendations
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(darkNavy[0], darkNavy[1], darkNavy[2]);
  doc.text('3. Recomendaciones Estratégicas y Asesoría Patrimonial', margin, y);
  y += 5;

  // Box 1: Car vs Transport
  doc.setFillColor(254, 243, 199);
  doc.setDrawColor(245, 158, 11);
  doc.roundedRect(margin, y, contentWidth, 18, 2, 2, 'FD');

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(180, 83, 9);
  doc.text('• Análisis de Transporte vs Inversión en Automóvil:', margin + 4, y + 5);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  const carText =
    transportExpense >= profile.transportAlertThreshold
      ? `Tu gasto actual en transporte es de ${profile.currencySymbol}${transportExpense}/mes (${profile.currencySymbol}${transportExpense * 12}/año). Este valor excede el umbral del 10-12% de tus ingresos y ya amortiza la cuota de financiamiento mensual de un automóvil seminuevo en ${profile.country}. Te sugerimos iniciar una meta de enganche para adquirir vehículo propio.`
      : `Tu gasto en transporte (${profile.currencySymbol}${transportExpense}/mes) es razonable frente a tus ingresos totales.`;

  const splitCar = doc.splitTextToSize(carText, contentWidth - 8);
  doc.text(splitCar, margin + 4, y + 10);

  y += 22;

  // Box 2: Rent vs Home Buying
  doc.setFillColor(238, 242, 255);
  doc.setDrawColor(99, 102, 241);
  doc.roundedRect(margin, y, contentWidth, 18, 2, 2, 'FD');

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(67, 56, 202);
  doc.text('• Análisis de Alquiler vs Compra de Vivienda:', margin + 4, y + 5);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  const rentText = `Estás pagando ${profile.currencySymbol}${rentExpense}/mes en alquiler (${profile.currencySymbol}${rentExpense * 12 * 5}/en 5 años a fondo perdido). Una cuota hipotecaria promedio en ${profile.country} permitiría destinar esa liquidez a crear patrimonio propio y plusvalía inmobiliaria garantizada.`;

  const splitRent = doc.splitTextToSize(rentText, contentWidth - 8);
  doc.text(splitRent, margin + 4, y + 10);

  y += 24;

  // --------------------------------------------------------------------------
  // PAGE 2: DIRECTORIO IMPRIMIBLE DE CONTACTOS & PROVEEDORES
  // --------------------------------------------------------------------------
  doc.addPage();
  let y2 = 16;

  // 1. Directory Page Header Banner
  doc.setFillColor(darkNavy[0], darkNavy[1], darkNavy[2]);
  doc.roundedRect(margin, y2, contentWidth, 26, 3, 3, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text('AuraFin AI · Directorio Imprimible de Contactos', margin + 6, y2 + 9.5);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(cyanColor[0], cyanColor[1], cyanColor[2]);
  doc.text(
    'Directorio de Asesores Patrimoniales, Bienes Raíces, Mecánicos y Servicios Clave',
    margin + 6,
    y2 + 16
  );

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225);
  doc.text(
    `Total de contactos: ${contacts.length} | Titular: Perfil Financiero (${profile.country}) | Emisión: ${new Date().toLocaleDateString('es-ES')}`,
    margin + 6,
    y2 + 21.5
  );

  y2 += 32;

  // 2. Summary Metric Boxes by Category
  const realEstateCount = contacts.filter(
    (c) => c.category === 'inmobiliaria' || c.category === 'bienes_raices'
  ).length;
  const mechanicCount = contacts.filter((c) => c.category === 'mecanico').length;
  const servicesCount = contacts.filter((c) => c.category === 'servicios').length;
  const otherCount = contacts.filter(
    (c) => !['inmobiliaria', 'bienes_raices', 'mecanico', 'servicios'].includes(c.category)
  ).length;

  const contactMetricBoxes = [
    { title: 'Inmuebles & Vivienda', count: `${realEstateCount} contact${realEstateCount === 1 ? 'o' : 'os'}`, color: [79, 70, 229] },
    { title: 'Mecánica & Autos', count: `${mechanicCount} contact${mechanicCount === 1 ? 'o' : 'os'}`, color: amberColor },
    { title: 'Servicios & Pagos', count: `${servicesCount} contact${servicesCount === 1 ? 'o' : 'os'}`, color: cyanColor },
    { title: 'Salud & Otros', count: `${otherCount} contact${otherCount === 1 ? 'o' : 'os'}`, color: emeraldColor },
  ];

  const catBoxWidth = (contentWidth - 9) / 4;
  const catBoxHeight = 16;

  contactMetricBoxes.forEach((box, i) => {
    const bx = margin + i * (catBoxWidth + 3);
    doc.setFillColor(slateLight[0], slateLight[1], slateLight[2]);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(bx, y2, catBoxWidth, catBoxHeight, 2, 2, 'FD');

    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text(box.title.toUpperCase(), bx + 3, y2 + 5.5);

    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(box.color[0], box.color[1], box.color[2]);
    doc.text(box.count, bx + 3, y2 + 12);
  });

  y2 += catBoxHeight + 6;

  // 3. Information Notice Callout
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, y2, contentWidth, 12, 2, 2, 'FD');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(darkNavy[0], darkNavy[1], darkNavy[2]);
  doc.text('Directorio Oficial para Consulta y Respaldo:', margin + 4, y2 + 4.5);

  doc.setFontSize(7.2);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(slateDark[0], slateDark[1], slateDark[2]);
  doc.text(
    'Conserva este directorio impreso para emergencias vehiculares, trámites inmobiliarios y servicios recurrentes. Datos sincronizados con tu app AuraFin AI.',
    margin + 4,
    y2 + 9
  );

  y2 += 17;

  // Helper function to draw table header
  const drawContactsTableHeader = (currY: number) => {
    doc.setFillColor(darkNavy[0], darkNavy[1], darkNavy[2]);
    doc.rect(margin, currY, contentWidth, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.text('Contacto & Especialidad', margin + 3, currY + 4.5);
    doc.text('Categoría', margin + 55, currY + 4.5);
    doc.text('Teléfono', margin + 84, currY + 4.5);
    doc.text('Correo Electrónico', margin + 114, currY + 4.5);
    doc.text('Notas / Referencia', margin + 150, currY + 4.5);
  };

  // 4. Section Title
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(darkNavy[0], darkNavy[1], darkNavy[2]);
  doc.text('Directorio Completo de Proveedores y Asesores Registrados', margin, y2);
  y2 += 5;

  drawContactsTableHeader(y2);
  y2 += 7;

  if (contacts.length === 0) {
    doc.setFillColor(248, 250, 252);
    doc.rect(margin, y2, contentWidth, 14, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text(
      'No hay contactos registrados aún en la libreta. Agrega contactos en la aplicación para imprimirlos en este directorio.',
      margin + 6,
      y2 + 8.5
    );
    y2 += 16;
  } else {
    const getCategoryStyle = (cat: string): { label: string; color: number[] } => {
      switch (cat) {
        case 'inmobiliaria':
          return { label: 'INMOBILIARIA', color: [79, 70, 229] };
        case 'bienes_raices':
          return { label: 'BIENES RAÍCES', color: [67, 56, 202] };
        case 'mecanico':
          return { label: 'MECÁNICO', color: [217, 119, 6] };
        case 'servicios':
          return { label: 'SERVICIOS', color: [14, 165, 233] };
        case 'medico':
          return { label: 'SALUD / MÉDICO', color: [225, 29, 72] };
        case 'personal':
          return { label: 'PERSONAL', color: [100, 116, 139] };
        default:
          return { label: (cat || 'GENERAL').toUpperCase(), color: [71, 85, 105] };
      }
    };

    contacts.forEach((contact, index) => {
      // Check for page overflow
      if (y2 > pageHeight - 25) {
        doc.addPage();
        y2 = 16;
        drawContactsTableHeader(y2);
        y2 += 7;
      }

      const rowHeight = 13;
      const isEven = index % 2 === 0;

      if (isEven) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, y2, contentWidth, rowHeight, 'F');
      }

      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.line(margin, y2 + rowHeight, margin + contentWidth, y2 + rowHeight);

      // Col 1: Name & Role
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(darkNavy[0], darkNavy[1], darkNavy[2]);
      const nameText = contact.name.length > 28 ? contact.name.slice(0, 26) + '...' : contact.name;
      doc.text(nameText, margin + 3, y2 + 4.8);

      doc.setFontSize(6.8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
      const roleText = contact.role.length > 33 ? contact.role.slice(0, 31) + '...' : contact.role;
      doc.text(roleText, margin + 3, y2 + 9.5);

      // Col 2: Category
      const catStyle = getCategoryStyle(contact.category);
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(catStyle.color[0], catStyle.color[1], catStyle.color[2]);
      doc.text(catStyle.label, margin + 55, y2 + 7.5);

      // Col 3: Phone
      doc.setFontSize(7.2);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(slateDark[0], slateDark[1], slateDark[2]);
      doc.text(contact.phone || 'No registrado', margin + 84, y2 + 7.5);

      // Col 4: Email
      doc.setFontSize(6.8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(slateDark[0], slateDark[1], slateDark[2]);
      const emailStr = contact.email.length > 25 ? contact.email.slice(0, 23) + '...' : contact.email;
      doc.text(emailStr || '-', margin + 114, y2 + 7.5);

      // Col 5: Notes / Reference
      doc.setFontSize(6.2);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
      const noteLines = doc.splitTextToSize(contact.notes || 'Sin observaciones.', 25);
      doc.text(noteLines.slice(0, 2), margin + 150, y2 + 4.8);

      y2 += rowHeight;
    });
  }

  // Security & Privacy Note at bottom if space permits
  if (y2 < pageHeight - 32) {
    y2 += 6;
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(margin, y2, contentWidth, 14, 2, 2, 'FD');

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(darkNavy[0], darkNavy[1], darkNavy[2]);
    doc.text('Seguridad, Privacidad y Respaldo:', margin + 4, y2 + 5);

    doc.setFontSize(6.8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text(
      'Este directorio proviene exclusivamente de los registros almacenados localmente en tu app. Ningún dato privado es transmitido a entidades externas sin tu consentimiento expreso.',
      margin + 4,
      y2 + 10
    );
  }

  // --------------------------------------------------------------------------
  // GLOBAL FOOTER ACROSS ALL PAGES
  // --------------------------------------------------------------------------
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text(
      `AuraFin AI · Reporte Financiero & Directorio de Contactos · ${profile.country} · Página ${p} de ${totalPages}`,
      margin,
      pageHeight - 8
    );
    doc.text(
      `Emitido: ${new Date().toLocaleDateString('es-ES')} · Confidencial`,
      pageWidth - margin - 48,
      pageHeight - 8
    );
  }

  // Trigger browser download
  const filename = `AuraFin_Reporte_Financiero_y_Directorio_${profile.country.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
}
