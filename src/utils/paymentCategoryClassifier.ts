import { PaymentItem } from '../types';

export interface CategoryClassificationResult {
  category: PaymentItem['category'];
  categoryLabel: string;
  userFacingGroup: 'comida' | 'transporte' | 'hogar' | 'ocio' | 'servicios' | 'salud' | 'educacion' | 'ingreso' | 'otro';
  confidence: number; // 0 - 100
  suggestedIsFixed: boolean;
  matchedKeywords: string[];
  explanation: string;
  badgeColor: string;
  iconName: string;
  alternatives: Array<{
    category: PaymentItem['category'];
    label: string;
    confidence: number;
  }>;
}

interface CategoryRule {
  category: PaymentItem['category'];
  label: string;
  userFacingGroup: 'comida' | 'transporte' | 'hogar' | 'ocio' | 'servicios' | 'salud' | 'educacion' | 'ingreso' | 'otro';
  isFixed: boolean;
  badgeColor: string;
  iconName: string;
  keywords: string[];
  merchants: string[];
  strongPhrases: string[];
}

const CATEGORY_RULES: CategoryRule[] = [
  // 1. COMIDA / ALIMENTACIÓN
  {
    category: 'alimentacion',
    label: 'Comida / Alimentación',
    userFacingGroup: 'comida',
    isFixed: false,
    badgeColor: 'bg-rose-50 text-rose-800 border-rose-200',
    iconName: 'Utensils',
    strongPhrases: [
      'uber eats', 'rappi comida', 'didi food', 'pedidos ya', 'compra despensa',
      'supermercado', 'tienda de abarrotes', 'comida corrida', 'menu ejecutivo',
      'desayuno buffet', 'almuerzo de trabajo', 'cena familiar'
    ],
    merchants: [
      'walmart', 'carrefour', 'mercadona', 'soriana', 'chedraui', 'oxxo', 'seven eleven',
      'costco', 'sam club', 'sams club', 'superama', 'aldi', 'lidl', 'dia',
      'starbucks', 'mcdonalds', 'burger king', 'subway', 'dominos', 'pizza hut',
      'kfc', 'taco bell', 'vips', 'sanborns', 'toks', 'chilis', 'applebees', 'uber eats',
      'rappi', 'pedidosya', 'just eat', 'glovo', 'didi food'
    ],
    keywords: [
      'comida', 'almuerzo', 'cena', 'desayuno', 'restaurante', 'despensa', 'mercado',
      'super', 'abarrotes', 'pizza', 'hamburguesa', 'burger', 'sushi', 'tacos', 'taqueria',
      'cafe', 'cafeteria', 'pan', 'panaderia', 'frutas', 'verduras', 'carniceria', 'carne',
      'pollo', 'pescado', 'mariscos', 'helado', 'postre', 'botana', 'snacks', 'cerveceria',
      'alimentos', 'viveres', 'leche', 'huevo', 'tortillas', 'queso', 'abarrote'
    ],
  },

  // 2. TRANSPORTE / MOVILIDAD
  {
    category: 'transporte',
    label: 'Transporte / Movilidad',
    userFacingGroup: 'transporte',
    isFixed: false,
    badgeColor: 'bg-amber-50 text-amber-800 border-amber-200',
    iconName: 'Car',
    strongPhrases: [
      'cambio de aceite', 'taller mecanico', 'estacionamiento centro', 'pago de peaje',
      'recarga tarjeta metro', 'boleto de autobus', 'pasaje colectivo', 'gasolina auto'
    ],
    merchants: [
      'uber', 'cabify', 'didi', 'beat', 'lyft', 'shell', 'bp', 'repsol', 'pemex',
      'totalenergies', 'mobil', 'chevron', 'gulf', 'autozone', 'bridgestone',
      'michelin', 'firestone', 'aeromexico', 'iberia', 'avianca', 'latam', 'vueling',
      'volaris', 'vivaaerobus', 'renfe', 'metro', 'subte', 'ado', 'estrellablanca'
    ],
    keywords: [
      'transporte', 'uber', 'taxi', 'didi', 'cabify', 'gasolina', 'nafta', 'combustible',
      'diesel', 'peaje', 'caseta', 'estacionamiento', 'parking', 'metro', 'subte',
      'autobus', 'camion', 'pasaje', 'boleto', 'colectivo', 'tren', 'avion', 'vuelo',
      'taller', 'mecanico', 'afinacion', 'llantas', 'neumaticos', 'frenos', 'lavado de auto',
      'car wash', 'verificacion', 'tenencia', 'tarjeton', 'peajes', 'movilidad'
    ],
  },

  // 3. HOGAR / VIVIENDA
  {
    category: 'alquiler',
    label: 'Hogar / Vivienda',
    userFacingGroup: 'hogar',
    isFixed: true,
    badgeColor: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    iconName: 'Home',
    strongPhrases: [
      'renta depto', 'alquiler casa', 'cuota de mantenimiento', 'pago de hipoteca',
      'expensas edificio', 'administracion residencial', 'reparacion fuga', 'muebles sala'
    ],
    merchants: [
      'ikea', 'home depot', 'sodimac', 'leroy merlin', 'lowes', 'easy', 'coppel muebles',
      'liverpool hogar', 'inmobiliaria', 'palmas residencial', 'condominio'
    ],
    keywords: [
      'hogar', 'vivienda', 'alquiler', 'renta', 'casa', 'departamento', 'depto', 'apartamento',
      'hipoteca', 'credito hipotecario', 'expensas', 'mantenimiento', 'condominio',
      'edificio', 'cuota residencial', 'muebles', 'cama', 'colchon', 'plomero', 'electricista',
      'cerrajero', 'pintura', 'fase hogar', 'arrendamiento', 'arriendo', 'propietario'
    ],
  },

  // 4. OCIO / ENTRETENIMIENTO
  {
    category: 'ocio',
    label: 'Ocio / Entretenimiento',
    userFacingGroup: 'ocio',
    isFixed: false,
    badgeColor: 'bg-purple-50 text-purple-800 border-purple-200',
    iconName: 'Gamepad2',
    strongPhrases: [
      'salida con amigos', 'entradas al cine', 'boleto de concierto', 'noche de copas',
      'suscripcion streaming', 'videojuegos steam', 'parque de diversiones'
    ],
    merchants: [
      'netflix', 'spotify', 'disney', 'hbo', 'max', 'prime video', 'apple tv',
      'youtube premium', 'cinepolis', 'cinemex', 'yelmo', 'amc', 'steam', 'playstation',
      'psn', 'xbox', 'nintendo', 'ticketmaster', 'live nation', 'airbnb', 'booking'
    ],
    keywords: [
      'ocio', 'entretenimiento', 'cine', 'pelicula', 'concierto', 'recital', 'festival',
      'teatro', 'bar', 'boliche', 'discoteca', 'tragos', 'copas', 'fiesta', 'cervezas',
      'videojuego', 'juegos', 'gaming', 'suscripcion', 'streaming', 'viaje', 'hotel',
      'vacaciones', 'turismo', 'museo', 'boliche', 'parque', 'karaoke', 'diversion'
    ],
  },

  // 5. SERVICIOS BÁSICOS (LUZ / AGUA / INTERNET)
  {
    category: 'servicios',
    label: 'Servicios Básicos',
    userFacingGroup: 'servicios',
    isFixed: true,
    badgeColor: 'bg-cyan-50 text-cyan-800 border-cyan-200',
    iconName: 'Zap',
    strongPhrases: [
      'recibo de luz', 'factura de agua', 'recibo de gas', 'internet fibra optica',
      'plan de telefonia', 'servicio de energia'
    ],
    merchants: [
      'cfe', 'iberdrola', 'enel', 'naturgy', 'telmex', 'totalplay', 'izzi', 'movistar',
      'claro', 'telcel', 'vodafone', 'orange', 'att', 'telefonia', 'agua y drenaje'
    ],
    keywords: [
      'servicio', 'servicios', 'luz', 'electricidad', 'energia', 'agua', 'gas',
      'internet', 'fibra', 'wifi', 'telefono', 'telefonia', 'celular', 'plan movil',
      'recibo', 'factura luz', 'factura agua', 'suministro', 'alumbrado', 'acueducto'
    ],
  },

  // 6. SALUD Y FARMACIA
  {
    category: 'salud',
    label: 'Salud y Farmacia',
    userFacingGroup: 'salud',
    isFixed: true,
    badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    iconName: 'HeartPulse',
    strongPhrases: [
      'consulta medica', 'receta medica', 'limpieza dental', 'analisis clinicos',
      'estudios de sangre', 'seguro de gastos medicos'
    ],
    merchants: [
      'farmacia guadalajara', 'farmacias del ahorro', 'farmacia benavides', 'farmacias similares',
      'boots', 'walgreens', 'cvs', 'san pablo', 'laboratorios chopo', 'salud digna',
      'chopo', 'clinica dental silva'
    ],
    keywords: [
      'salud', 'farmacia', 'medicamento', 'medicina', 'pastillas', 'remedio', 'doctor',
      'medico', 'consulta', 'dentista', 'odontologo', 'dental', 'hospital', 'clinica',
      'laboratorio', 'analisis', 'optica', 'lentes', 'terapia', 'psicologo', 'pediatra',
      'ginecologo', 'urgencias', 'seguro medico', 'inyeccion', 'vacuna'
    ],
  },

  // 7. EDUCACIÓN Y FORMACIÓN
  {
    category: 'educacion',
    label: 'Educación y Cursos',
    userFacingGroup: 'educacion',
    isFixed: true,
    badgeColor: 'bg-blue-50 text-blue-800 border-blue-200',
    iconName: 'BookOpen',
    strongPhrases: [
      'colegiatura escolar', 'matricula universitaria', 'curso online', 'taller intensivo',
      'libros de texto'
    ],
    merchants: [
      'udemy', 'coursera', 'platzi', 'edx', 'domestika', 'crehana', 'colegio',
      'universidad', 'escuela', 'libreria gandhi', 'casa del libro', 'amazon books'
    ],
    keywords: [
      'educacion', 'colegio', 'escuela', 'universidad', 'colegiatura', 'matricula',
      'curso', 'diplomado', 'certificacion', 'capacitacion', 'taller', 'libros',
      'cuadernos', 'utiles escolares', 'idiomas', 'ingles', 'profesor', 'asesoria escolar'
    ],
  },

  // 8. INGRESOS
  {
    category: 'sueldo',
    label: 'Ingreso / Sueldo',
    userFacingGroup: 'ingreso',
    isFixed: true,
    badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    iconName: 'DollarSign',
    strongPhrases: [
      'nomina quincenal', 'sueldo mensual', 'honorarios profesionales', 'pago de cliente',
      'deposito por freelance', 'bono de productividad'
    ],
    merchants: ['nomina', 'transferencia', 'empresa', 'patron'],
    keywords: [
      'sueldo', 'nomina', 'salario', 'honorarios', 'freelance', 'ingreso', 'pago recibido',
      'deposito', 'transferencia recibida', 'bono', 'aguinaldo', 'comision', 'rendimiento',
      'ganancia', 'venta'
    ],
  },
];

/**
 * Normalizes input string (lowercase, accents stripped, punctuation replaced by spaces)
 */
function cleanText(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9\s]/g, ' ') // replace special chars with spaces
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Automatically classifies a payment title/description and returns the suggested category.
 */
export function classifyPaymentDescription(
  rawText: string,
  paymentType: 'gasto' | 'ingreso' = 'gasto'
): CategoryClassificationResult | null {
  const text = cleanText(rawText);
  if (!text || text.length < 2) return null;

  // If user selected 'ingreso', prioritize 'sueldo' or 'freelance'
  if (paymentType === 'ingreso') {
    const isFreelance = /freelance|proyecto|cliente|honorarios|consultoria|extra/.test(text);
    return {
      category: isFreelance ? 'freelance' : 'sueldo',
      categoryLabel: isFreelance ? 'Ingreso Freelance' : 'Sueldo / Nómina',
      userFacingGroup: 'ingreso',
      confidence: 95,
      suggestedIsFixed: true,
      matchedKeywords: ['ingreso'],
      explanation: isFreelance
        ? 'Detectado como ingreso variable por proyecto o freelance'
        : 'Detectado como ingreso fijo mensual por nómina o sueldo principal',
      badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      iconName: 'DollarSign',
      alternatives: [
        { category: isFreelance ? 'sueldo' : 'freelance', label: isFreelance ? 'Sueldo Fijo' : 'Freelance', confidence: 70 },
      ],
    };
  }

  const scores: Array<{
    rule: CategoryRule;
    score: number;
    matchedKeywords: string[];
  }> = [];

  for (const rule of CATEGORY_RULES) {
    if (rule.category === 'sueldo' && paymentType === 'gasto') continue;

    let score = 0;
    const matchedKeywords: string[] = [];

    // 1. Strong phrases check (highest priority: +60 pts)
    for (const phrase of rule.strongPhrases) {
      const cleanPhrase = cleanText(phrase);
      if (text.includes(cleanPhrase)) {
        score += 65;
        matchedKeywords.push(phrase);
      }
    }

    // 2. Merchants check (+50 pts)
    for (const merchant of rule.merchants) {
      const cleanMerchant = cleanText(merchant);
      // Word boundary match
      const regex = new RegExp(`\\b${cleanMerchant}\\b`, 'i');
      if (regex.test(text)) {
        score += 55;
        matchedKeywords.push(merchant);
      }
    }

    // 3. Keywords check (+25 pts each)
    for (const kw of rule.keywords) {
      const cleanKw = cleanText(kw);
      const regex = new RegExp(`\\b${cleanKw}\\b`, 'i');
      if (regex.test(text)) {
        score += 25;
        matchedKeywords.push(kw);
      }
    }

    if (score > 0) {
      scores.push({ rule, score, matchedKeywords });
    }
  }

  // Sort by highest score
  scores.sort((a, b) => b.score - a.score);

  if (scores.length === 0) {
    return null;
  }

  const best = scores[0];
  const maxPossible = 100;
  const confidence = Math.min(98, Math.max(55, Math.round((best.score / 80) * 100)));

  const alternatives = scores.slice(1, 4).map((s) => ({
    category: s.rule.category,
    label: s.rule.label,
    confidence: Math.min(90, Math.round((s.score / best.score) * confidence)),
  }));

  const uniqueMatches = Array.from(new Set(best.matchedKeywords)).slice(0, 3);
  const matchedListStr = uniqueMatches.map((m) => `"${m}"`).join(', ');

  const explanation = uniqueMatches.length > 0
    ? `Sugerido automáticamente por coincidencia con ${matchedListStr}`
    : `Clasificado como ${best.rule.label}`;

  return {
    category: best.rule.category,
    categoryLabel: best.rule.label,
    userFacingGroup: best.rule.userFacingGroup,
    confidence,
    suggestedIsFixed: best.rule.isFixed,
    matchedKeywords: uniqueMatches,
    explanation,
    badgeColor: best.rule.badgeColor,
    iconName: best.rule.iconName,
    alternatives,
  };
}
