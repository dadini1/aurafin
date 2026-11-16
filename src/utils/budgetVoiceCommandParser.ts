// Deterministic bilingual (English & Spanish) voice-command intent parser for category budgets

export type BudgetCommandAction = 'set' | 'increase' | 'decrease';

export type BudgetCategoryKey =
  | 'alquiler'
  | 'alimentacion'
  | 'transporte'
  | 'servicios'
  | 'ocio'
  | 'salud'
  | 'educacion'
  | 'otro';

export interface ParsedBudgetCommand {
  matched: boolean;
  rawText: string;
  action: BudgetCommandAction;
  category?: BudgetCategoryKey;
  categoryLabel?: string;
  previousAmount?: number;
  newAmount?: number;
  delta?: number;
  isPercentage?: boolean;
  percentageValue?: number;
  confidence: number;
  errorReason?: string;
}

interface CategoryAliasGroup {
  key: BudgetCategoryKey;
  label: string;
  aliases: string[];
}

export const BUDGET_CATEGORY_ALIAS_GROUPS: CategoryAliasGroup[] = [
  {
    key: 'alimentacion',
    label: 'Alimentación / Supermercado',
    aliases: [
      'alimentacion',
      'alimentos',
      'comida',
      'comidas',
      'supermercado',
      'super',
      'despensa',
      'mercado',
      'mandado',
      'food',
      'foods',
      'groceries',
      'grocery',
      'supermarket',
      'pantry',
      'meals',
      'meal',
    ],
  },
  {
    key: 'alquiler',
    label: 'Vivienda / Alquiler',
    aliases: [
      'alquiler',
      'renta',
      'vivienda',
      'hipoteca',
      'casa',
      'departamento',
      'hogar',
      'arriendo',
      'rent',
      'housing',
      'mortgage',
      'apartment',
      'home',
      'house',
    ],
  },
  {
    key: 'transporte',
    label: 'Transporte / Movilidad',
    aliases: [
      'transporte',
      'movilidad',
      'gasolina',
      'combustible',
      'auto',
      'carro',
      'coche',
      'pasaje',
      'transport',
      'transportation',
      'commute',
      'gas',
      'gasoline',
      'fuel',
      'uber',
      'taxi',
      'transit',
      'bus',
      'metro',
      'car',
      'mobility',
    ],
  },
  {
    key: 'servicios',
    label: 'Servicios Básicos',
    aliases: [
      'servicios',
      'servicio',
      'luz',
      'agua',
      'electricidad',
      'telefonia',
      'telefono',
      'celular',
      'internet',
      'wifi',
      'utilities',
      'utility',
      'bills',
      'bill',
      'electricity',
      'power',
      'water',
      'phone',
      'mobile',
    ],
  },
  {
    key: 'ocio',
    label: 'Ocio y Restaurantes',
    aliases: [
      'ocio',
      'entretenimiento',
      'restaurante',
      'restaurantes',
      'salidas',
      'diversion',
      'cine',
      'entertainment',
      'leisure',
      'fun',
      'dining',
      'restaurant',
      'restaurants',
      'eating out',
      'movies',
      'streaming',
      'games',
      'nightlife',
    ],
  },
  {
    key: 'salud',
    label: 'Salud y Farmacia',
    aliases: [
      'salud',
      'farmacia',
      'medico',
      'medicina',
      'medicinas',
      'doctor',
      'clinica',
      'gimnasio',
      'health',
      'healthcare',
      'medical',
      'medicine',
      'pharmacy',
      'clinic',
      'wellness',
      'gym',
    ],
  },
  {
    key: 'educacion',
    label: 'Educación y Desarrollo',
    aliases: [
      'educacion',
      'escuela',
      'colegio',
      'universidad',
      'curso',
      'cursos',
      'libros',
      'estudio',
      'estudios',
      'capacitacion',
      'education',
      'school',
      'tuition',
      'courses',
      'course',
      'books',
      'learning',
      'training',
      'study',
    ],
  },
  {
    key: 'otro',
    label: 'Otros Gastos',
    aliases: [
      'otro',
      'otros',
      'varios',
      'miscelaneo',
      'imprevistos',
      'other',
      'others',
      'misc',
      'miscellaneous',
      'unexpected',
      'general',
    ],
  },
];

const INCREASE_KEYWORDS = [
  'increase',
  'raise',
  'bump',
  'add',
  'grow',
  'boost',
  'aumenta',
  'aumentar',
  'sube',
  'subir',
  'incrementa',
  'incrementar',
  'agrega',
  'agregar',
  'suma',
  'sumar',
];

const DECREASE_KEYWORDS = [
  'decrease',
  'reduce',
  'lower',
  'cut',
  'drop',
  'shrink',
  'trim',
  'baja',
  'bajar',
  'reducir',
  'recorta',
  'recortar',
  'disminuye',
  'disminuir',
  'quita',
  'quitar',
  'resta',
  'restar',
];

const NUMBER_WORDS: Record<string, number> = {
  zero: 0,
  cero: 0,
  one: 1,
  uno: 1,
  un: 1,
  two: 2,
  dos: 2,
  three: 3,
  tres: 3,
  four: 4,
  cuatro: 4,
  five: 5,
  cinco: 5,
  six: 6,
  seis: 6,
  seven: 7,
  siete: 7,
  eight: 8,
  ocho: 8,
  nine: 9,
  nueve: 9,
  ten: 10,
  diez: 10,
  fifteen: 15,
  quince: 15,
  twenty: 20,
  veinte: 20,
  twentyfive: 25,
  veinticinco: 25,
  thirty: 30,
  treinta: 30,
  forty: 40,
  cuarenta: 40,
  fifty: 50,
  cincuenta: 50,
  sixty: 60,
  sesenta: 60,
  seventy: 70,
  setenta: 70,
  eighty: 80,
  ochenta: 80,
  ninety: 90,
  noventa: 90,
  hundred: 100,
  cien: 100,
  ciento: 100,
  doscientos: 200,
  trescientos: 300,
  cuatrocientos: 400,
  quinientos: 500,
  seiscientos: 600,
  setecientos: 700,
  ochocientos: 800,
  novecientos: 900,
  thousand: 1000,
  mil: 1000,
};

function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractNumericAmount(normalized: string): {
  amount: number | null;
  isPercentage: boolean;
} {
  // 1. Try explicit percentage first (e.g. "10%", "15 percent", "20 por ciento")
  const pctMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*(?:%|percent|por\s*ciento)\b/);
  if (pctMatch) {
    const val = Number(pctMatch[1].replace(',', '.'));
    if (!Number.isNaN(val)) {
      return { amount: val, isPercentage: true };
    }
  }

  // 2. Match numeric literals with optional currency symbol and thousands commas (e.g. "$500", "$1,250.50", "500")
  const numericMatches = normalized.match(/[$€£]?\s*(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?/g);
  if (numericMatches && numericMatches.length > 0) {
    // Pick the last numeric token in the utterance (e.g. "update food budget to $500")
    const rawToken = numericMatches[numericMatches.length - 1].replace(/[$€£\s]/g, '');
    const cleaned = rawToken.replace(/,/g, '');
    const val = Number(cleaned);
    if (!Number.isNaN(val)) {
      return { amount: val, isPercentage: false };
    }
  }

  // 3. Fallback for spoken number words (e.g. "five hundred", "quinientos")
  const tokens = normalized.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  let total = 0;
  let current = 0;
  let foundWord = false;

  for (const token of tokens) {
    const wordVal = NUMBER_WORDS[token];
    if (wordVal === undefined) {
      if (foundWord && token !== 'and' && token !== 'y') {
        break;
      }
      continue;
    }
    foundWord = true;
    if (wordVal === 100) {
      current = (current === 0 ? 1 : current) * 100;
    } else if (wordVal === 1000) {
      total += (current === 0 ? 1 : current) * 1000;
      current = 0;
    } else if (wordVal >= 200) {
      current += wordVal;
    } else {
      current += wordVal;
    }
  }

  if (foundWord) {
    return { amount: total + current, isPercentage: false };
  }

  return { amount: null, isPercentage: false };
}

function detectCategory(normalized: string): {
  category?: BudgetCategoryKey;
  categoryLabel?: string;
  confidence: number;
} {
  let bestMatch: { key: BudgetCategoryKey; label: string; score: number } | null = null;

  for (const group of BUDGET_CATEGORY_ALIAS_GROUPS) {
    for (const alias of group.aliases) {
      const pattern = new RegExp(`\\b${escapeRegExp(alias)}\\b`, 'i');
      if (pattern.test(normalized)) {
        const score = alias.length + (alias.includes(' ') ? 10 : 0);
        if (!bestMatch || score > bestMatch.score) {
          bestMatch = { key: group.key, label: group.label, score };
        }
      }
    }
  }

  if (!bestMatch) {
    return { confidence: 0 };
  }

  return {
    category: bestMatch.key,
    categoryLabel: bestMatch.label,
    confidence: 0.95,
  };
}

function detectAction(normalized: string, isPercentage: boolean): BudgetCommandAction {
  const hasIncrease = INCREASE_KEYWORDS.some((kw) =>
    new RegExp(`\\b${escapeRegExp(kw)}\\b`, 'i').test(normalized)
  );
  const hasDecrease = DECREASE_KEYWORDS.some((kw) =>
    new RegExp(`\\b${escapeRegExp(kw)}\\b`, 'i').test(normalized)
  );

  // Check if user said "to $X" or "a $X" (target absolute value) vs "by $X" or "en $X" (relative delta)
  const hasAbsolutePreposition = /\b(to|a|hasta)\s+[$€£]?\s*\d/i.test(normalized);
  const hasRelativePreposition = /\b(by|en|por)\s+[$€£]?\s*\d/i.test(normalized);

  if (hasDecrease && (!hasAbsolutePreposition || hasRelativePreposition || isPercentage)) {
    return 'decrease';
  }
  if (hasIncrease && (!hasAbsolutePreposition || hasRelativePreposition || isPercentage)) {
    return 'increase';
  }

  return 'set';
}

export function parseBudgetVoiceCommand(
  rawText: string,
  currentBudgets: Record<string, number>
): ParsedBudgetCommand {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return {
      matched: false,
      rawText,
      action: 'set',
      confidence: 0,
      errorReason: 'Escribe o dicta un comando, por ejemplo: "Update my food budget to $500".',
    };
  }

  const normalized = normalizeText(trimmed);
  const { amount, isPercentage } = extractNumericAmount(normalized);
  const { category, categoryLabel, confidence } = detectCategory(normalized);
  const action = detectAction(normalized, isPercentage);

  if (!category || !categoryLabel) {
    return {
      matched: false,
      rawText,
      action,
      confidence: 0.2,
      errorReason:
        'No se reconoció la categoría. Prueba con food/comida, rent/alquiler, transport/transporte, utilities/servicios, entertainment/ocio, health/salud o education/educación.',
    };
  }

  if (amount === null || Number.isNaN(amount) || amount < 0) {
    return {
      matched: false,
      rawText,
      action,
      category,
      categoryLabel,
      confidence: 0.5,
      errorReason: `Categoría detectada (${categoryLabel}), pero falta indicar el monto (ej. "$500").`,
    };
  }

  const previousAmount = Math.max(0, Number(currentBudgets[category] ?? 0));
  let newAmount = amount;

  if (action === 'increase') {
    newAmount = isPercentage
      ? Math.round(previousAmount * (1 + amount / 100))
      : Math.round(previousAmount + amount);
  } else if (action === 'decrease') {
    newAmount = isPercentage
      ? Math.max(0, Math.round(previousAmount * (1 - amount / 100)))
      : Math.max(0, Math.round(previousAmount - amount));
  } else {
    if (isPercentage) {
      return {
        matched: false,
        rawText,
        action,
        category,
        categoryLabel,
        confidence: 0.6,
        errorReason: 'Para asignar un presupuesto nuevo indica un monto fijo (ej. "$500") o usa "increase/reduce by 10%".',
      };
    }
    newAmount = Math.max(0, Math.round(amount));
  }

  return {
    matched: true,
    rawText,
    action,
    category,
    categoryLabel,
    previousAmount,
    newAmount,
    delta: newAmount - previousAmount,
    isPercentage,
    percentageValue: isPercentage ? amount : undefined,
    confidence,
  };
}
