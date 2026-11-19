/**
 * Analizador local de dictados (motor de respaldo, sin IA generativa).
 *
 * AuraFin debe poder registrar un pago dictado aunque Gemini no esté
 * configurado o falle. Este módulo hace el enrutamiento mínimo viable con
 * reglas en español: monto, fecha resuelta, categoría, beneficiario, detalle
 * y si el pago ya se realizó.
 *
 * Devuelve exactamente la misma forma que el esquema de `process-note`, así
 * el cliente no necesita distinguir el motor.
 */

export interface ContactoDisponible {
  id: string;
  name: string;
  phone?: string;
  role?: string;
  notes?: string;
}

export interface ArchivoDisponible {
  id: string;
  name: string;
  type?: string;
  description?: string;
  tags?: string[];
}

export interface PagoDetectado {
  hasPayment: boolean;
  title?: string;
  amount?: number;
  type?: 'gasto' | 'ingreso';
  isFixed?: boolean;
  category?: string;
  frequency?: string;
  dueDate?: string;
  beneficiary?: string;
  detail?: string;
  paid?: boolean;
}

export interface MetaDetectada {
  hasGoal: boolean;
  title?: string;
  targetAmount?: number;
  deadline?: string;
  category?: string;
  monthlyContribution?: number;
}

export interface AnalisisLocal {
  intent: 'nota' | 'transaccion' | 'meta_ahorro' | 'consulta';
  title: string;
  formattedContent: string;
  tags: string[];
  category: string;
  section: 'finanzas' | 'notas' | 'radar' | 'galeria' | 'voz_analitica';
  detectedPayment: PagoDetectado;
  detectedGoal: MetaDetectada;
  matchedFileIds: string[];
  matchedContactIds: string[];
  matchReasons: string[];
  fileMatchDetails: Array<{ fileId: string; confidence: number; reason: string; matchedKeywords: string[] }>;
  contactMatchDetails: Array<{ contactId: string; confidence: number; reason: string }>;
  spokenResponse: string;
  motor: 'local';
}

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/** Palabras capitalizadas que nunca son un beneficiario. */
const NO_BENEFICIARIOS = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'hoy', 'ayer',
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
  'septiembre', 'setiembre', 'octubre', 'noviembre', 'diciembre',
  'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo',
  'dios', 'banco', 'total', 'gracias', 'pero', 'cuando', 'donde',
]);

interface Rango {
  inicio: number;
  fin: number;
}

const normalizar = (texto: string): string =>
  texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const escaparRegex = (texto: string): string => texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const isoDesde = (dia: number, mes: number, anio: number): string => {
  const d = Math.min(Math.max(dia, 1), 31);
  const m = Math.min(Math.max(mes, 1), 12);
  return `${String(anio).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
};

const isoDeFecha = (fecha: Date): string =>
  `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;

interface FechaDetectada {
  iso: string;
  etiqueta: string;
  rango: Rango;
}

/** Resuelve "17 de noviembre", "17/11", "ayer" o "hoy" a fecha ISO. */
function extraerFecha(texto: string, hoy: Date): FechaDetectada | null {
  const larga = /\b(\d{1,2})\s+(?:de|del)\s+([a-záéíóúñ]+)(?:\s+(?:de|del)\s+(\d{4}))?/i.exec(texto);
  if (larga) {
    const nombre = normalizar(larga[2]);
    const indice = MESES.indexOf(nombre === 'setiembre' ? 'septiembre' : nombre);
    if (indice >= 0) {
      const anio = larga[3] ? Number(larga[3]) : hoy.getFullYear();
      return {
        iso: isoDesde(Number(larga[1]), indice + 1, anio),
        etiqueta: larga[3] ? `${larga[1]} de ${nombre} de ${larga[3]}` : `${larga[1]} de ${nombre}`,
        rango: { inicio: larga.index, fin: larga.index + larga[0].length },
      };
    }
  }

  const corta = /\b(\d{1,2})[/\-](\d{1,2})(?:[/\-](\d{2,4}))?\b/.exec(texto);
  if (corta) {
    const anioBruto = corta[3];
    const anio = anioBruto
      ? (anioBruto.length === 2 ? 2000 + Number(anioBruto) : Number(anioBruto))
      : hoy.getFullYear();
    return {
      iso: isoDesde(Number(corta[1]), Number(corta[2]), anio),
      etiqueta: corta[0],
      rango: { inicio: corta.index, fin: corta.index + corta[0].length },
    };
  }

  const relativas: Array<[RegExp, number]> = [
    [/\banteayer\b/i, -2],
    [/\bayer\b/i, -1],
    [/\bhoy\b/i, 0],
  ];
  for (const [patron, desplazamiento] of relativas) {
    const m = patron.exec(texto);
    if (!m) continue;
    const fecha = new Date(hoy.getTime());
    fecha.setDate(fecha.getDate() + desplazamiento);
    return {
      iso: isoDeFecha(fecha),
      etiqueta: m[0],
      rango: { inicio: m.index, fin: m.index + m[0].length },
    };
  }

  return null;
}

/** Convierte "1.500,50" / "1,500.50" / "650" a número. */
function aNumero(bruto: string): number | null {
  let s = bruto.trim().replace(/\s/g, '').replace(/[^\d.,]/g, '');
  if (!s || !/^\d[\d.,]*$/.test(s)) return null;

  const ultimoPunto = s.lastIndexOf('.');
  const ultimaComa = s.lastIndexOf(',');

  if (ultimoPunto >= 0 && ultimaComa >= 0) {
    if (ultimaComa > ultimoPunto) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (ultimaComa >= 0) {
    const partes = s.split(',');
    const ultima = partes[partes.length - 1] || '';
    s = ultima.length === 3 && partes[0].length <= 3 ? s.replace(/,/g, '') : s.replace(',', '.');
  } else if (ultimoPunto >= 0) {
    const partes = s.split('.');
    const ultima = partes[partes.length - 1] || '';
    if (partes.length > 2 || (partes.length === 2 && ultima.length === 3 && partes[0].length <= 3)) {
      s = s.replace(/\./g, '');
    }
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Unidades que acompañan a un número de tiempo, no a un monto. */
const UNIDAD_TIEMPO = /^\s*(mes|meses|dia|dias|ano|anos|semana|semanas|hora|horas|minuto|minutos|%|por\s+ciento)\b/;

/** Busca el monto evitando confundirlo con el día de una fecha. */
function extraerMonto(texto: string, fecha: FechaDetectada | null): number | null {
  const candidatos: Array<{ valor: number; prioridad: number; pos: number }> = [];

  const dentroDeFecha = (pos: number, largo: number): boolean =>
    fecha ? pos < fecha.rango.fin && pos + largo > fecha.rango.inicio : false;

  const empujar = (bruto: string, pos: number, prioridad: number) => {
    if (dentroDeFecha(pos, bruto.length)) return;
    // "en 10 meses" / "3 días" son plazos, no montos.
    if (prioridad === 2 && UNIDAD_TIEMPO.test(texto.slice(pos + bruto.length))) return;
    const n = aNumero(bruto);
    if (n === null || n <= 0) return;
    candidatos.push({ valor: n, prioridad, pos });
  };

  const patrones: Array<[RegExp, number]> = [
    [/(?:US\$|\$|€|£)\s*(\d[\d.,]*)/gi, 0],
    [/(\d[\d.,]*)\s*(?:usd|d[oó]lares?|bolivianos?|bs\.?|pesos?|soles?|mxn|ars|cop|clp|pen|eur)\b/gi, 0],
    [/\b(?:de|por)\s+(\d[\d.,]*)/gi, 1],
    [/(\d[\d.,]*)\s+de\s+(?:alquiler|renta|arriendo|luz|agua|gas|internet|servicio|gasolina|comida|colegio|curso|cuota)/gi, 1],
    [/\b(\d[\d.,]*)\b/g, 2],
  ];

  for (const [patron, prioridad] of patrones) {
    for (const m of texto.matchAll(patron)) {
      empujar(m[1], m.index ?? 0, prioridad);
    }
  }

  if (!candidatos.length) return null;
  candidatos.sort((a, b) => a.prioridad - b.prioridad || b.pos - a.pos);
  return candidatos[0].valor;
}

interface CategoriaDetectada {
  clave: string;
  etiqueta: string;
  fija: boolean;
}

const CATEGORIAS: Array<{ clave: string; etiqueta: string; fija: boolean; palabras: string[] }> = [
  { clave: 'alquiler', etiqueta: 'alquiler', fija: true, palabras: ['alquiler', 'alquileres', 'renta', 'arriendo', 'alquilo', 'alquila', 'alquilar', 'arrendar'] },
  { clave: 'servicios', etiqueta: 'servicios', fija: true, palabras: ['luz', 'agua', 'gas', 'internet', 'telefono', 'celular', 'cable', 'wifi', 'electricidad', 'servicio', 'servicios'] },
  { clave: 'transporte', etiqueta: 'transporte', fija: false, palabras: ['gasolina', 'combustible', 'diesel', 'taxi', 'uber', 'bus', 'pasaje', 'transporte', 'peaje', 'parqueo', 'estacionamiento'] },
  { clave: 'alimentacion', etiqueta: 'alimentación', fija: false, palabras: ['comida', 'almuerzo', 'cena', 'desayuno', 'mercado', 'supermercado', 'restaurante', 'pan', 'cafe', 'viveres', 'almacen'] },
  { clave: 'salud', etiqueta: 'salud', fija: false, palabras: ['medico', 'farmacia', 'doctor', 'clinica', 'medicina', 'dentista', 'salud', 'hospital', 'analisis'] },
  { clave: 'educacion', etiqueta: 'educación', fija: false, palabras: ['curso', 'colegio', 'universidad', 'matricula', 'libro', 'escuela', 'educacion', 'pension'] },
  { clave: 'ocio', etiqueta: 'ocio', fija: false, palabras: ['cine', 'netflix', 'spotify', 'juego', 'fiesta', 'bar', 'cerveza', 'entretenimiento', 'suscripcion', 'viaje'] },
  { clave: 'sueldo', etiqueta: 'sueldo', fija: false, palabras: ['sueldo', 'salario', 'nomina'] },
  { clave: 'freelance', etiqueta: 'freelance', fija: false, palabras: ['freelance', 'honorarios', 'cliente', 'proyecto', 'consultoria'] },
];

function detectarCategoria(textoNorm: string): CategoriaDetectada {
  let mejor: { clave: string; etiqueta: string; fija: boolean; puntos: number } | null = null;

  for (const categoria of CATEGORIAS) {
    let puntos = 0;
    for (const palabra of categoria.palabras) {
      if (new RegExp(`\\b${escaparRegex(palabra)}\\b`, 'i').test(textoNorm)) puntos += 1;
    }
    if (puntos > (mejor?.puntos ?? 0)) {
      mejor = { clave: categoria.clave, etiqueta: categoria.etiqueta, fija: categoria.fija, puntos };
    }
  }

  if (mejor) return { clave: mejor.clave, etiqueta: mejor.etiqueta, fija: mejor.fija };
  return { clave: 'otro', etiqueta: 'otro', fija: false };
}

interface BeneficiarioDetectado {
  nombre: string;
  contactoId?: string;
}

function detectarBeneficiario(texto: string, contactos: ContactoDisponible[]): BeneficiarioDetectado | null {
  const textoNorm = normalizar(texto);

  // 1. La agenda del usuario manda: si el nombre aparece, es el beneficiario.
  for (const contacto of contactos) {
    const nombre = (contacto.name || '').trim();
    if (nombre.length < 3) continue;
    if (textoNorm.includes(normalizar(nombre))) {
      return { nombre, contactoId: contacto.id };
    }
    const primerNombre = nombre.split(/\s+/)[0];
    if (primerNombre.length >= 4 && new RegExp(`\\b${escaparRegex(normalizar(primerNombre))}\\b`, 'i').test(textoNorm)) {
      return { nombre, contactoId: contacto.id };
    }
  }

  // 2. "a Richar", "para el señor Pérez", "a favor de Ana".
  const patrones = [
    /\ba\s+favor\s+de\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñü]{2,}(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñü]{2,})?)/,
    /\b(?:a|para)\s+(?:don|doña|dona|señor|senor|señora|senora|sr\.?|sra\.?)?\s*([A-ZÁÉÍÓÚÑ][a-záéíóúñü]{2,}(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñü]{2,})?)/,
  ];

  for (const patron of patrones) {
    const m = patron.exec(texto);
    if (!m) continue;
    const nombre = m[1].trim().replace(/[.,;]+$/, '');
    const primero = normalizar(nombre.split(/\s+/)[0]);
    if (NO_BENEFICIARIOS.has(primero)) continue;
    const contacto = contactos.find((c) => normalizar(c.name || '') === normalizar(nombre));
    return { nombre, contactoId: contacto?.id };
  }

  return null;
}

/**
 * Las expresiones se evalúan sobre el texto normalizado (sin tildes) porque
 * `\b` no reconoce vocales acentuadas como parte de la palabra: "pagué" no
 * terminaría en un límite de palabra y el verbo no se detectaría.
 */
const VERBOS_PAGADO = /\b(pague|pagamos|pagaron|cancele|cancelo|abone|abono|salde|entregue|gaste|compre|cobre|recibi|me pagaron|se pago|le di)\b/;
/** "pagó el alquiler": el acento distingue el verbo del sustantivo "pago". */
const PAGO_EXPLICITO = /\b(?:se\s+pag[oó]|ya\s+pag[oó]|pag[oó]\s+(?:el|la|los|las|un|una)|le\s+pag[oó]|pagaron)\b/i;
const MARCAS_PENDIENTE = /\b(hay que pagar|tengo que pagar|debo pagar|pendiente|vence|vencio|proxim[oa]|programad[oa]|a pagar|por pagar|falta pagar)\b/;
const MARCAS_INGRESO = /\b(cobre|recibi|me pagaron|ingreso|venta de|honorarios|salario|sueldo|nomina)\b/;
const VERBOS_EGRESO = /\b(pague|pagamos|pagaron|pagar|gaste|gasto|compre|comprar|abone|salde)\b/;
const MARCAS_TRANSACCION = /\b(pague|pagar|pago|pagos|gaste|gasto|compre|cobre|cobrar|alquiler|alquileres|renta|arriendo|factura|recibo|cuota|abono|sueldo|salario|honorarios|servicio|servicios)\b/;
const MARCAS_META = /\b(quiero ahorrar|meta de ahorro|objetivo de ahorro|fondo de emergencia|ahorrar para)\b/;
const MARCAS_RADAR = /\b(buscar|busco|comprar)\s+(?:un\s+|una\s+)?(auto|coche|carro|vehiculo|departamento|casa|terreno|inmueble)\b/;

/** true si el dictado describe un pago ya realizado (no uno programado). */
function esPagoRealizado(texto: string, textoNorm: string): boolean {
  if (MARCAS_PENDIENTE.test(textoNorm)) return false;
  return VERBOS_PAGADO.test(textoNorm) || PAGO_EXPLICITO.test(texto);
}

const PALABRAS_ARCHIVO: Record<string, string[]> = {
  alquiler: ['alquiler', 'renta', 'arriendo', 'contrato', 'departamento', 'casa', 'recibo'],
  servicios: ['luz', 'agua', 'gas', 'internet', 'factura', 'recibo', 'servicio'],
  transporte: ['gasolina', 'combustible', 'factura', 'recibo', 'vehiculo', 'auto'],
  alimentacion: ['factura', 'ticket', 'recibo', 'compra', 'mercado'],
  salud: ['factura', 'recibo', 'farmacia', 'medico', 'receta'],
  educacion: ['factura', 'recibo', 'matricula', 'curso', 'colegio'],
  ocio: ['factura', 'ticket', 'recibo', 'suscripcion'],
  sueldo: ['nomina', 'recibo', 'salario'],
  freelance: ['factura', 'contrato', 'cotizacion', 'honorarios'],
  otro: ['factura', 'recibo', 'ticket'],
};

function capitalizar(texto: string): string {
  if (!texto) return texto;
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function tituloDe(texto: string): string {
  const limpio = texto.replace(/\s+/g, ' ').trim();
  const palabras = limpio.split(' ').slice(0, 8).join(' ');
  return capitalizar(palabras.length < limpio.length ? `${palabras}…` : palabras);
}

/**
 * Analiza un dictado y devuelve la misma forma que `process-note`.
 */
export function analizarEntradaLocal(entrada: {
  text: string;
  availableFiles?: ArchivoDisponible[];
  availableContacts?: ContactoDisponible[];
  hoy?: Date;
}): AnalisisLocal {
  const texto = String(entrada.text || '').trim();
  const archivos = entrada.availableFiles || [];
  const contactos = entrada.availableContacts || [];
  const hoy = entrada.hoy || new Date();
  const textoNorm = normalizar(texto);

  const fecha = extraerFecha(texto, hoy);
  const monto = extraerMonto(texto, fecha);
  const beneficiario = detectarBeneficiario(texto, contactos);
  const categoria = detectarCategoria(textoNorm);

  const pagoRealizado = esPagoRealizado(texto, textoNorm);
  const esMeta = MARCAS_META.test(textoNorm) && !pagoRealizado;
  const esTransaccion = Boolean(monto) && MARCAS_TRANSACCION.test(textoNorm) && !esMeta;
  const esIngreso = MARCAS_INGRESO.test(textoNorm) && !VERBOS_EGRESO.test(textoNorm);

  // --- Meta de ahorro -------------------------------------------------------
  if (esMeta && monto) {
    const meses = /\b(?:en|dentro\s+de)\s+(\d{1,2})\s*(?:mes|meses)\b/i.exec(texto);
    const plazoMeses = meses ? Number(meses[1]) : null;
    const deadline = plazoMeses
      ? isoDeFecha(new Date(hoy.getFullYear(), hoy.getMonth() + plazoMeses, hoy.getDate()))
      : undefined;
    const mensual = plazoMeses && plazoMeses > 0 ? Math.round((monto / plazoMeses) * 100) / 100 : undefined;

    return {
      intent: 'meta_ahorro',
      title: `Meta de ahorro · ${monto}`,
      formattedContent: `**Meta de ahorro**\n- Objetivo: ${monto}${plazoMeses ? `\n- Plazo: ${plazoMeses} meses` : ''}${mensual ? `\n- Aporte mensual sugerido: ${mensual}` : ''}\n\nTexto original: "${texto}"`,
      tags: ['#meta_ahorro', '#finanzas'],
      category: 'meta_ahorro',
      section: 'finanzas',
      detectedPayment: { hasPayment: false },
      detectedGoal: {
        hasGoal: true,
        title: tituloDe(texto),
        targetAmount: monto,
        deadline,
        category: 'otro',
        monthlyContribution: mensual,
      },
      matchedFileIds: [],
      matchedContactIds: beneficiario?.contactoId ? [beneficiario.contactoId] : [],
      matchReasons: [],
      fileMatchDetails: [],
      contactMatchDetails: [],
      spokenResponse: `Listo, creé tu meta de ahorro de ${monto} en Finanzas.`,
      motor: 'local',
    };
  }

  // --- Transacción ---------------------------------------------------------
  if (esTransaccion && monto) {
    const pagado = pagoRealizado;
    const tipo: 'gasto' | 'ingreso' = esIngreso ? 'ingreso' : 'gasto';
    const fechaIso = fecha?.iso || isoDeFecha(hoy);
    const detalle = texto.length > 280 ? `${texto.slice(0, 277)}...` : texto;
    const mesEtiqueta = fecha ? MESES[Number(fechaIso.slice(5, 7)) - 1] : null;
    const titulo = `${tipo === 'ingreso' ? 'Cobro' : 'Pago'} de ${categoria.etiqueta}${mesEtiqueta ? ` · ${mesEtiqueta}` : ''}`;

    // Archivos relacionados por palabras clave del contenido.
    const claves = PALABRAS_ARCHIVO[categoria.clave] || PALABRAS_ARCHIVO.otro;
    const archivosCoincidentes = archivos.filter((archivo) => {
      const contenido = normalizar(`${archivo.name || ''} ${archivo.description || ''} ${(archivo.tags || []).join(' ')}`);
      return claves.some((clave) => contenido.includes(clave));
    });

    const fileMatchDetails = archivosCoincidentes.map((archivo) => {
      const contenido = normalizar(`${archivo.name || ''} ${archivo.description || ''} ${(archivo.tags || []).join(' ')}`);
      return {
        fileId: archivo.id,
        confidence: 70,
        reason: `El archivo menciona datos de ${categoria.etiqueta}.`,
        matchedKeywords: claves.filter((clave) => contenido.includes(clave)),
      };
    });

    const contactMatchDetails = beneficiario?.contactoId
      ? [{
          contactId: beneficiario.contactoId,
          confidence: 95,
          reason: 'El beneficiario del pago coincide con un contacto de la agenda.',
        }]
      : [];

    return {
      intent: 'transaccion',
      title: titulo,
      formattedContent: [
        `**${titulo}**`,
        `- Monto: ${monto}`,
        `- Fecha: ${fecha?.etiqueta || hoy.toISOString().split('T')[0]}`,
        `- Categoría: ${categoria.etiqueta}`,
        beneficiario ? `- Beneficiario: ${beneficiario.nombre}` : null,
        `- Estado: ${pagado ? 'pagado' : 'pendiente'}`,
        '',
        `Texto original: "${texto}"`,
      ].filter(Boolean).join('\n'),
      tags: ['#finanzas', `#${categoria.clave}`, pagado ? '#pagado' : '#pendiente'],
      category: 'finanzas',
      section: 'finanzas',
      detectedPayment: {
        hasPayment: true,
        title: titulo,
        amount: monto,
        type: tipo,
        isFixed: categoria.fija,
        category: categoria.clave,
        frequency: categoria.fija ? 'mensual' : 'unico',
        dueDate: fechaIso,
        beneficiary: beneficiario?.nombre || '',
        detail: detalle,
        paid: pagado,
      },
      detectedGoal: { hasGoal: false },
      matchedFileIds: archivosCoincidentes.map((archivo) => archivo.id),
      matchedContactIds: contactMatchDetails.map((c) => c.contactId),
      matchReasons: [
        ...fileMatchDetails.map((f) => f.reason),
        ...contactMatchDetails.map((c) => c.reason),
      ],
      fileMatchDetails,
      contactMatchDetails,
      spokenResponse: `${
        tipo === 'ingreso'
          ? (pagado ? 'Listo, registré el cobro' : 'Anoté el cobro pendiente')
          : (pagado ? 'Listo, registré el pago' : 'Anoté el pago programado')
      } de ${categoria.etiqueta}${fecha ? ` de ${mesEtiqueta || fecha.etiqueta}` : ''} por ${monto}${beneficiario ? ` a ${beneficiario.nombre}` : ''} en Finanzas.`,
      motor: 'local',
    };
  }

  // --- Nota / consulta -----------------------------------------------------
  const esConsulta = /\?\s*$/.test(texto);
  const contactoMencionado = contactos.find((c) => {
    const nombre = (c.name || '').trim();
    if (nombre.length < 4) return false;
    const primerNombre = nombre.split(/\s+/)[0];
    return primerNombre.length >= 3 && textoNorm.includes(normalizar(primerNombre));
  });

  return {
    intent: esConsulta ? 'consulta' : 'nota',
    title: tituloDe(texto),
    formattedContent: texto,
    tags: ['#nota', ...(MARCAS_RADAR.test(textoNorm) ? ['#radar'] : [])],
    category: 'general',
    section: MARCAS_RADAR.test(textoNorm) ? 'radar' : 'notas',
    detectedPayment: { hasPayment: false },
    detectedGoal: { hasGoal: false },
    matchedFileIds: [],
    matchedContactIds: contactoMencionado ? [contactoMencionado.id] : [],
    matchReasons: contactoMencionado ? ['El contacto se menciona en la nota.'] : [],
    fileMatchDetails: [],
    contactMatchDetails: contactoMencionado
      ? [{ contactId: contactoMencionado.id, confidence: 80, reason: 'El contacto se menciona en la nota.' }]
      : [],
    spokenResponse: esConsulta ? 'Guardé tu consulta en Notas.' : 'Guardé tu nota en Notas.',
    motor: 'local',
  };
}
