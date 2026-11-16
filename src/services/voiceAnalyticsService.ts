import { NoteItem, PaymentItem, SavingsGoal } from '../types';

export type VoiceSentiment = 'positivo' | 'neutral' | 'alerta';

export interface VoiceActionItem {
  id: string;
  noteId: string;
  title: string;
  description: string;
  dueDate?: string;
  urgency: 'alta' | 'media' | 'baja';
  status: 'pendiente' | 'en_progreso' | 'completado';
  topic: string;
  sourceNoteTitle: string;
  createdAt: string;
  linkedPaymentId?: string;
  linkedGoalId?: string;
}

export interface VoiceTopicMetric {
  topic: string;
  label: string;
  count: number;
  totalAmountMentioned: number;
  percentage: number;
  dominantSentiment: VoiceSentiment;
  color: string;
}

export interface SentimentDataPoint {
  date: string;
  displayDate: string;
  positivo: number;
  neutral: number;
  alerta: number;
  totalNotes: number;
  averageScore: number; // 0 - 100
}

export interface VoiceAnalyticsReport {
  periodDays: number;
  totalNotesAnalyzed: number;
  totalWordsDictated: number;
  totalEstimatedAudioMinutes: number;
  sentimentSummary: {
    score: number; // 0 - 100
    label: string;
    positiveCount: number;
    neutralCount: number;
    alertCount: number;
    positivePercent: number;
    neutralPercent: number;
    alertPercent: number;
  };
  sentimentTimeline: SentimentDataPoint[];
  topicMetrics: VoiceTopicMetric[];
  actionItems: VoiceActionItem[];
  commonKeywords: { text: string; count: number; sentiment: VoiceSentiment }[];
  conversionStats: {
    convertedToPayments: number;
    convertedToGoals: number;
    conversionRate: number; // %
  };
}

// Topic classification rules & color scheme
const TOPIC_DEFINITIONS: Record<string, { label: string; keywords: string[]; color: string }> = {
  vivienda: {
    label: 'Vivienda & Alquiler',
    keywords: ['renta', 'alquiler', 'departamento', 'casa', 'arriendo', 'propietario', 'inmobiliaria', 'mudanza', 'condominio', 'hipoteca'],
    color: '#38bdf8', // sky-400
  },
  transporte: {
    label: 'Transporte & Auto',
    keywords: ['auto', 'carro', 'vehiculo', 'uber', 'taxi', 'mecanico', 'aceite', 'gasolina', 'combustible', 'taller', 'frenos', 'llantas', 'reparacion'],
    color: '#06b6d4', // cyan-500
  },
  alimentacion: {
    label: 'Alimentos & Súper',
    keywords: ['supermercado', 'super', 'comida', 'despensa', 'alimentos', 'cena', 'restaurante', 'almuerzo', 'desayuno', 'mercado', 'tienda'],
    color: '#10b981', // emerald-500
  },
  ahorro_inversion: {
    label: 'Metas de Ahorro',
    keywords: ['ahorrar', 'ahorro', 'meta', 'enganche', 'fondo', 'emergencia', 'invertir', 'banco', 'plazo', 'rendimiento', 'capital'],
    color: '#8b5cf6', // violet-500
  },
  servicios: {
    label: 'Servicios & Facturas',
    keywords: ['luz', 'electricidad', 'agua', 'internet', 'telefono', 'cfe', 'gas', 'factura', 'recibo', 'mensualidad', 'subscripcion'],
    color: '#f59e0b', // amber-500
  },
  salud: {
    label: 'Salud & Bienestar',
    keywords: ['medico', 'doctor', 'salud', 'dentista', 'farmacia', 'medicina', 'seguro', 'clinica', 'tratamiento', 'consulta'],
    color: '#ec4899', // pink-500
  },
  ocio: {
    label: 'Ocio & Salidas',
    keywords: ['salida', 'viaje', 'cine', 'bar', 'fiesta', 'ocio', 'vacaciones', 'concierto', 'evento', 'paseo'],
    color: '#f43f5e', // rose-500
  },
  ingresos: {
    label: 'Ingresos & Nómina',
    keywords: ['sueldo', 'nomina', 'salario', 'pago recibido', 'cobro', 'honorarios', 'freelance', 'deposito', 'bono'],
    color: '#00f59b', // neon emerald
  },
};

// Sentiment lexicon
const POSITIVE_WORDS = [
  'ahorro', 'meta', 'descuento', 'excelente', 'bien', 'ingreso', 'sueldo', 'bono', 'logrado',
  'ganancia', 'pagado', 'promocion', 'economico', 'tranquilo', 'gane', 'ganar', 'acuerdo favorable',
  'aprobado', 'exito', 'oportunidad', 'favorable', 'ahorrado'
];

const ALERT_WORDS = [
  'caro', 'costoso', 'excesivo', 'urgente', 'reparar', 'falla', 'descompuesto', 'subio', 'aumento',
  'multa', 'deuda', 'preocupado', 'ajustado', 'vencido', 'limite', 'peligro', 'cuidado', 'imprevisto',
  'frenos', 'urgencia', 'sobregasto', 'cobro extra', 'problema', 'demorado', 'endeudamiento'
];

/**
 * Classifies the sentiment of a note based on keywords, tone, and monetary context
 */
export function analyzeNoteSentiment(content: string, rawTranscript?: string): { sentiment: VoiceSentiment; score: number } {
  const fullText = `${content} ${rawTranscript || ''}`.toLowerCase();

  let positiveScore = 0;
  let alertScore = 0;

  POSITIVE_WORDS.forEach((word) => {
    if (fullText.includes(word)) positiveScore += 1;
  });

  ALERT_WORDS.forEach((word) => {
    if (fullText.includes(word)) alertScore += 1.4; // Slightly higher weight for alerts
  });

  if (alertScore >= 1.5 && alertScore > positiveScore) {
    return { sentiment: 'alerta', score: Math.max(15, 45 - alertScore * 10) };
  }
  if (positiveScore > alertScore) {
    return { sentiment: 'positivo', score: Math.min(95, 65 + positiveScore * 10) };
  }
  return { sentiment: 'neutral', score: 50 };
}

/**
 * Extracts action items from the content of a voice note
 */
export function extractActionItemsFromNote(note: NoteItem): VoiceActionItem[] {
  const text = `${note.title}. ${note.content} ${note.formattedContent || ''}`;
  const lower = text.toLowerCase();
  const items: VoiceActionItem[] = [];

  // Patterns for action items:
  // e.g., "recomendo revisar frenos", "pagar la renta", "ahorrar $4,000", "cotizar departamento", "comprar auto", "revisar condiciones"
  const actionTriggers = [
    { regex: /revisar\s+([^.,;]+)/i, urgency: 'alta' as const, verb: 'Revisar' },
    { regex: /pagar\s+([^.,;]+)/i, urgency: 'alta' as const, verb: 'Pagar' },
    { regex: /cotizar\s+([^.,;]+)/i, urgency: 'media' as const, verb: 'Cotizar' },
    { regex: /ahorrar\s+([^.,;]+)/i, urgency: 'media' as const, verb: 'Ahorrar' },
    { regex: /firmar\s+([^.,;]+)/i, urgency: 'alta' as const, verb: 'Firmar' },
    { regex: /comprar\s+([^.,;]+)/i, urgency: 'media' as const, verb: 'Comprar' },
    { regex: /chequeo\s+de\s+([^.,;]+)/i, urgency: 'alta' as const, verb: 'Chequeo de' },
    { regex: /evaluar\s+([^.,;]+)/i, urgency: 'baja' as const, verb: 'Evaluar' },
    { regex: /programar\s+([^.,;]+)/i, urgency: 'media' as const, verb: 'Programar' },
  ];

  actionTriggers.forEach((trig, idx) => {
    const match = text.match(trig.regex);
    if (match && match[1]) {
      const subject = match[1].trim();
      if (subject.length > 3 && subject.length < 60) {
        // Generate a concise action title
        const title = `${trig.verb} ${subject}`;
        const isCompleted = note.linkedPaymentId !== undefined || lower.includes('completado') || lower.includes('pagado');

        items.push({
          id: `act-${note.id}-${idx}`,
          noteId: note.id,
          title: title.charAt(0).toUpperCase() + title.slice(1),
          description: `Extraído automáticamente de la nota: "${note.title}"`,
          urgency: trig.urgency,
          status: isCompleted ? 'completado' : 'pendiente',
          topic: note.category || 'general',
          sourceNoteTitle: note.title,
          createdAt: note.createdAt,
          linkedPaymentId: note.linkedPaymentId,
          linkedGoalId: note.linkedGoalId,
        });
      }
    }
  });

  // Default fallback action item if none matched specifically but note is pending
  if (items.length === 0 && (note.intent === 'transaccion' || note.intent === 'meta_ahorro')) {
    items.push({
      id: `act-${note.id}-main`,
      noteId: note.id,
      title: `Seguimiento: ${note.title}`,
      description: note.content.slice(0, 90) + '...',
      urgency: 'media',
      status: note.linkedPaymentId ? 'completado' : 'pendiente',
      topic: note.category || 'general',
      sourceNoteTitle: note.title,
      createdAt: note.createdAt,
      linkedPaymentId: note.linkedPaymentId,
      linkedGoalId: note.linkedGoalId,
    });
  }

  return items;
}

/**
 * Main analytics engine: processes user voice notes for the last N days (default 30)
 */
export function generateVoiceAnalytics(
  notes: NoteItem[],
  daysCount = 30
): VoiceAnalyticsReport {
  const now = new Date();
  const cutoffDate = new Date(now.getTime() - daysCount * 24 * 60 * 60 * 1000);

  // Filter notes in range
  const recentNotes = notes.filter((n) => {
    try {
      const d = new Date(n.createdAt);
      return !isNaN(d.getTime()) && d >= cutoffDate;
    } catch {
      return true;
    }
  });

  // Fallback to all notes if user has very few recent ones so dashboard is immediately insightful
  const notesToAnalyze = recentNotes.length >= 2 ? recentNotes : notes;

  let totalWords = 0;
  let positiveCount = 0;
  let neutralCount = 0;
  let alertCount = 0;
  let totalScoreSum = 0;

  const topicCountMap: Record<string, { count: number; totalAmount: number; sentiments: VoiceSentiment[] }> = {};
  const timelineMap: Record<string, { positivo: number; neutral: number; alerta: number; scores: number[] }> = {};
  const allActionItems: VoiceActionItem[] = [];
  const keywordFrequency: Record<string, { count: number; sentiment: VoiceSentiment }> = {};

  // Build timeline bucket slots for the last 30 days (grouped by 3-4 day intervals for clean recharts display)
  const intervalDays = 3;
  const numBuckets = Math.ceil(daysCount / intervalDays);
  for (let i = numBuckets - 1; i >= 0; i--) {
    const bucketDate = new Date(now.getTime() - i * intervalDays * 24 * 60 * 60 * 1000);
    const key = bucketDate.toISOString().split('T')[0];
    timelineMap[key] = { positivo: 0, neutral: 0, alerta: 0, scores: [] };
  }

  notesToAnalyze.forEach((note) => {
    const text = `${note.title} ${note.content} ${note.formattedContent || ''}`;
    const words = text.trim().split(/\s+/).length;
    totalWords += words;

    // 1. Sentiment
    const { sentiment, score } = analyzeNoteSentiment(note.content, note.rawTranscript);
    totalScoreSum += score;
    if (sentiment === 'positivo') positiveCount++;
    else if (sentiment === 'alerta') alertCount++;
    else neutralCount++;

    // Timeline mapping
    const noteDateStr = note.createdAt ? note.createdAt.split('T')[0] : new Date().toISOString().split('T')[0];
    // Find closest bucket
    const bucketKeys = Object.keys(timelineMap);
    let assignedKey = bucketKeys[bucketKeys.length - 1];
    for (const bKey of bucketKeys) {
      if (noteDateStr <= bKey) {
        assignedKey = bKey;
        break;
      }
    }
    if (timelineMap[assignedKey]) {
      timelineMap[assignedKey][sentiment]++;
      timelineMap[assignedKey].scores.push(score);
    }

    // 2. Topic Detection
    let detectedTopic = 'servicios';
    const lower = text.toLowerCase();
    for (const [topKey, topDef] of Object.entries(TOPIC_DEFINITIONS)) {
      if (topDef.keywords.some((kw) => lower.includes(kw))) {
        detectedTopic = topKey;
        break;
      }
    }

    // Extract money amounts mentioned
    const moneyMatches = text.match(/\$?\s*(\d+([.,]\d{1,2})?)/g);
    let amountSum = 0;
    if (moneyMatches) {
      moneyMatches.forEach((m) => {
        const num = parseFloat(m.replace(/[^\d.]/g, ''));
        if (!isNaN(num) && num > 5 && num < 100000) amountSum += num;
      });
    }

    if (!topicCountMap[detectedTopic]) {
      topicCountMap[detectedTopic] = { count: 0, totalAmount: 0, sentiments: [] };
    }
    topicCountMap[detectedTopic].count += 1;
    topicCountMap[detectedTopic].totalAmount += amountSum;
    topicCountMap[detectedTopic].sentiments.push(sentiment);

    // 3. Action Items
    const extracted = extractActionItemsFromNote(note);
    allActionItems.push(...extracted);

    // 4. Keyword extraction
    const tokens = text.toLowerCase().match(/[a-záéíóúñ]{4,}/gi) || [];
    const stopWords = new Set(['para', 'como', 'este', 'esta', 'pero', 'hablé', 'cobró', 'sobre', 'hacer', 'tener', 'estar', 'dijo']);
    tokens.forEach((tok) => {
      if (!stopWords.has(tok)) {
        if (!keywordFrequency[tok]) keywordFrequency[tok] = { count: 0, sentiment };
        keywordFrequency[tok].count += 1;
      }
    });
  });

  // Calculate sentiment summary
  const totalNotesCount = notesToAnalyze.length || 1;
  const avgSentimentScore = Math.round(totalScoreSum / totalNotesCount);
  let sentimentLabel = 'Neutral y Balanceado';
  if (avgSentimentScore >= 65) sentimentLabel = 'Muy Positivo y Optimista';
  else if (avgSentimentScore <= 40) sentimentLabel = 'Alerta y Cautela Financiera';

  // Construct Sentiment Timeline for Recharts
  const sentimentTimeline: SentimentDataPoint[] = Object.entries(timelineMap).map(([key, data]) => {
    const d = new Date(key);
    const displayDate = d.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' });
    const total = data.positivo + data.neutral + data.alerta;
    const avgScore = data.scores.length > 0 ? Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length) : 50;

    return {
      date: key,
      displayDate,
      positivo: data.positivo,
      neutral: data.neutral,
      alerta: data.alerta,
      totalNotes: total,
      averageScore: avgScore,
    };
  });

  // Construct Topic Metrics for Recharts
  const topicMetrics: VoiceTopicMetric[] = Object.entries(TOPIC_DEFINITIONS).map(([topKey, topDef]) => {
    const data = topicCountMap[topKey] || { count: 0, totalAmount: 0, sentiments: [] };
    const sentiments = data.sentiments;
    const dominant: VoiceSentiment =
      sentiments.filter((s) => s === 'alerta').length > sentiments.filter((s) => s === 'positivo').length
        ? 'alerta'
        : sentiments.filter((s) => s === 'positivo').length > 0
        ? 'positivo'
        : 'neutral';

    return {
      topic: topKey,
      label: topDef.label,
      count: data.count,
      totalAmountMentioned: Math.round(data.totalAmount),
      percentage: totalNotesCount > 0 ? Math.round((data.count / totalNotesCount) * 100) : 0,
      dominantSentiment: dominant,
      color: topDef.color,
    };
  }).filter((tm) => tm.count > 0 || tm.topic === 'vivienda' || tm.topic === 'transporte' || tm.topic === 'alimentacion');

  // Common keywords top 10
  const commonKeywords = Object.entries(keywordFrequency)
    .map(([text, meta]) => ({ text, count: meta.count, sentiment: meta.sentiment }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Conversion stats
  const convertedToPayments = notesToAnalyze.filter((n) => n.linkedPaymentId).length;
  const convertedToGoals = notesToAnalyze.filter((n) => n.linkedGoalId).length;
  const conversionRate = totalNotesCount > 0 ? Math.round(((convertedToPayments + convertedToGoals) / totalNotesCount) * 100) : 0;

  return {
    periodDays: daysCount,
    totalNotesAnalyzed: notesToAnalyze.length,
    totalWordsDictated: totalWords,
    totalEstimatedAudioMinutes: Math.round((totalWords / 120) * 10) / 10, // ~120 words per minute average speaking rate
    sentimentSummary: {
      score: avgSentimentScore,
      label: sentimentLabel,
      positiveCount,
      neutralCount,
      alertCount,
      positivePercent: Math.round((positiveCount / totalNotesCount) * 100),
      neutralPercent: Math.round((neutralCount / totalNotesCount) * 100),
      alertPercent: Math.round((alertCount / totalNotesCount) * 100),
    },
    sentimentTimeline,
    topicMetrics: topicMetrics.sort((a, b) => b.count - a.count),
    actionItems: allActionItems.sort((a, b) => (a.status === 'pendiente' ? -1 : 1)),
    commonKeywords,
    conversionStats: {
      convertedToPayments,
      convertedToGoals,
      conversionRate,
    },
  };
}
