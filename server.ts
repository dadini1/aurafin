import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { config } from './server/config.js';
import routerEmpresas, { asegurarSuperadminInicial } from './server/rutas/empresas.js';
import routerSincronizacion, { cargarLegado, persistirLegado } from './server/rutas/sincronizacion.js';
import { diagnosticoLocal } from './server/almacenamiento/almacenLocal.js';
import { iniciarReconciliacion, detenerReconciliacion, estadoSincronizacion } from './server/almacenamiento/motorSincronizacion.js';
import { saludSupabase, supabaseDisponible } from './server/almacenamiento/almacenSupabase.js';

dotenv.config();

const app = express();
const PORT = config.puerto;
// Local-first: escucha solo en loopback por defecto. Para publicar en red,
// define HOST=0.0.0.0 junto con AURAFIN_SYNC_TOKEN (ver AUDITORIA.md).
const HOST = config.host;
const IS_PROD = config.entorno === 'produccion';
const SYNC_TOKEN = config.seguridad.tokenLegado;

/* ============================================================
   Motor de sincronización: Supabase (nube, fuente de verdad)
   + espejo por empresa en disco G: (bandaja de reenvío incluida)
   ============================================================ */
cargarLegado();
iniciarReconciliacion();

/* ============================================================
   Seguridad: cabeceras, límite de tasa y autenticación de sync
   ============================================================ */
app.disable('x-powered-by');

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=()');
  if (IS_PROD) {
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; media-src 'self' data: blob:; connect-src 'self'; manifest-src 'self'; worker-src 'self'; frame-ancestors 'self'"
    );
  }
  next();
});

// Rate limiter simple en memoria (ventana deslizante por IP)
const rateBuckets = new Map<string, number[]>();
function rateLimit(maxPerMinute: number) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const key = `${req.ip}:${req.path}`;
    const now = Date.now();
    const hits = (rateBuckets.get(key) || []).filter((t) => now - t < 60_000);
    if (hits.length >= maxPerMinute) {
      return res.status(429).json({ error: 'Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.' });
    }
    hits.push(now);
    rateBuckets.set(key, hits);
    next();
  };
}
// Limpieza periódica de buckets para no crecer sin límite
setInterval(() => {
  const now = Date.now();
  for (const [key, hits] of rateBuckets) {
    const fresh = hits.filter((t) => now - t < 60_000);
    if (fresh.length === 0) rateBuckets.delete(key);
    else rateBuckets.set(key, fresh);
  }
}, 120_000).unref();

function requireSyncToken(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!SYNC_TOKEN) return next(); // modo local sin token
  const provided = req.header('x-aurafin-token');
  if (provided !== SYNC_TOKEN) {
    return res.status(401).json({ error: 'Token de sincronización inválido o ausente' });
  }
  next();
}
void requireSyncToken; // se conserva para compatibilidad de rutas heredadas

// Límite global razonable; las rutas multimedia declaran su propio límite mayor
app.use(express.json({ limit: '2mb' }));
const mediaJson = express.json({ limit: '35mb' });

// Server-side Gemini initialization with user-agent header
const getGeminiClient = () => {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

// Healthcheck con diagnóstico de nube y espejo local
app.get('/api/health', async (_req, res) => {
  const saludNube = supabaseDisponible() ? await saludSupabase() : { disponible: false, detalle: 'no configurada' };
  return res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    entorno: config.entorno,
    almacenamiento: {
      nube: { habilitada: supabaseDisponible(), disponible: saludNube.disponible },
      disco: diagnosticoLocal(),
      sincronizacion: estadoSincronizacion(),
    },
  });
});

/**
 * 1. Process Voice / Text Input (Note, Transaction, Savings Goal, or Query) & Auto-Match Files & Contacts
 */
app.post('/api/assistant/process-note', rateLimit(30), async (req, res) => {
  try {
    const { text, availableFiles = [], availableContacts = [] } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Texto o transcripción requerida' });
    }

    const ai = getGeminiClient();

    const prompt = `Eres AuraFin AI, un asistente virtual avanzado en español para reconocimiento de voz inteligente, organización de notas con auto-adjuntos de galería y asesoría financiera.
El usuario ha dictado o escrito la siguiente entrada:
"${text}"

Archivos disponibles en la galería del dispositivo:
${JSON.stringify(availableFiles.map((f: any) => ({ id: f.id, name: f.name, type: f.type, description: f.description, tags: f.tags })))}

Contactos disponibles en la agenda del dispositivo:
${JSON.stringify(availableContacts.map((c: any) => ({ id: c.id, name: c.name, phone: c.phone, role: c.role, notes: c.notes })))}

Tu tarea es:
1. DIFERENCIAR EL TIPO DE ENTRADA (INTENCIÓN):
   - 'nota': Apuntes, ideas, reuniones, recordatorios o acuerdos.
   - 'transaccion': Registro directo de pagos o gastos fijos/variables ("Pagar 650 de alquiler", "Gasté 40 en gasolina", "Cobré 2000").
   - 'meta_ahorro': Metas de ahorro ("Quiero ahorrar $5,000 para el enganche de un auto", "Crear meta de fondo de emergencia de $3,000 en 6 meses").
   - 'consulta': Pregunta o solicitud de asesoramiento financiero ("¿Me conviene comprar un auto?", "¿Cómo administro mi dinero?").
2. Generar un título conciso, profesional y atractivo.
3. Formatear y limpiar el contenido de la nota (destacando datos clave).
4. Generar etiquetas inteligentes enriquecidas ('#...') incluyendo categorías, estado financiero y palabras clave.
5. Determinar la categoría principal ('finanzas', 'vivienda', 'transporte', 'trabajo', 'personal', 'salud', 'general', 'meta_ahorro').
6. DETECTAR TRANSACCIÓN FINANCIERA (si aplica): monto, tipo ('gasto' | 'ingreso'), si es fijo o variable, periodicidad, fecha límite y categoría.
7. DETECTAR META DE AHORRO (si aplica): monto objetivo, título, categoría ('auto', 'vivienda', 'emergencia', 'retiro', 'viaje', 'otro'), plazo o fecha límite estimada y contribución mensual sugerida.
8. AUTO-ADJUNTAR ARCHIVOS Y CONTACTOS AUTOMÁTICAMENTE:
   - Analiza el texto y selecciona los IDs de archivos de la galería que corresponden al contenido (facturas si habla de taller/compras, cotizaciones de departamentos si habla de alquiler o casa, recibos de servicios, fotos de vehículos).
   - Asigna un puntaje de confianza (0 a 100), palabras clave coincidentes y justificación explícita de por qué se auto-adjuntó cada archivo y contacto.
9. Generar una respuesta conversacional concisa en español (1-2 frases) que el asistente leerá en voz alta.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            intent: {
              type: Type.STRING,
              description: 'nota | transaccion | meta_ahorro | consulta',
            },
            title: { type: Type.STRING, description: 'Título claro y corto' },
            formattedContent: { type: Type.STRING, description: 'Contenido ordenado' },
            tags: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Etiquetas inteligentes',
            },
            category: { type: Type.STRING, description: 'Categoría principal' },
            detectedPayment: {
              type: Type.OBJECT,
              properties: {
                hasPayment: { type: Type.BOOLEAN },
                title: { type: Type.STRING },
                amount: { type: Type.NUMBER },
                type: { type: Type.STRING, description: 'gasto o ingreso' },
                isFixed: { type: Type.BOOLEAN, description: 'true si es fijo, false si es variable' },
                category: { type: Type.STRING, description: 'transporte, alquiler, alimentacion, servicios, etc.' },
                frequency: { type: Type.STRING, description: 'unico, mensual, quincenal, anual' },
                dueDate: { type: Type.STRING, description: 'YYYY-MM-DD' },
              },
              required: ['hasPayment'],
            },
            detectedGoal: {
              type: Type.OBJECT,
              properties: {
                hasGoal: { type: Type.BOOLEAN },
                title: { type: Type.STRING },
                targetAmount: { type: Type.NUMBER },
                deadline: { type: Type.STRING },
                category: { type: Type.STRING },
                monthlyContribution: { type: Type.NUMBER },
              },
              required: ['hasGoal'],
            },
            matchedFileIds: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            matchedContactIds: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            matchReasons: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            fileMatchDetails: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  fileId: { type: Type.STRING },
                  confidence: { type: Type.NUMBER },
                  reason: { type: Type.STRING },
                  matchedKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
                required: ['fileId', 'confidence', 'reason'],
              },
            },
            contactMatchDetails: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  contactId: { type: Type.STRING },
                  confidence: { type: Type.NUMBER },
                  reason: { type: Type.STRING },
                },
                required: ['contactId', 'confidence', 'reason'],
              },
            },
            spokenResponse: {
              type: Type.STRING,
              description: 'Frase para responder en audio con voz sintetizada',
            },
          },
          required: [
            'intent',
            'title',
            'formattedContent',
            'tags',
            'category',
            'detectedPayment',
            'detectedGoal',
            'matchedFileIds',
            'matchedContactIds',
            'matchReasons',
            'spokenResponse',
          ],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    res.json({ success: true, result: parsed });
  } catch (err: any) {
    console.error('Error processing note:', err);
    res.status(500).json({ error: err.message || 'Error al procesar la entrada con IA' });
  }
});

/**
 * 1.1 Auto-match files and contacts for an existing transaction
 */
app.post('/api/assistant/auto-match-transaction', rateLimit(30), async (req, res) => {
  try {
    const { transaction, availableFiles = [], availableContacts = [] } = req.body;
    if (!transaction) {
      return res.status(400).json({ error: 'Falta transacción' });
    }

    const ai = getGeminiClient();
    const prompt = `Analiza esta transacción financiera y encuentra los archivos (recibos, facturas, fotos) y contactos de la agenda relacionados para auto-adjuntarlos:
Transacción: ${JSON.stringify(transaction)}

Archivos disponibles:
${JSON.stringify(availableFiles.map((f: any) => ({ id: f.id, name: f.name, description: f.description, tags: f.tags })))}

Contactos disponibles:
${JSON.stringify(availableContacts.map((c: any) => ({ id: c.id, name: c.name, role: c.role, notes: c.notes })))}

Selecciona los IDs más relevantes y genera una justificación.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            matchedFileIds: { type: Type.ARRAY, items: { type: Type.STRING } },
            matchedContactIds: { type: Type.ARRAY, items: { type: Type.STRING } },
            reason: { type: Type.STRING },
          },
          required: ['matchedFileIds', 'matchedContactIds', 'reason'],
        },
      },
    });

    const result = JSON.parse(response.text || '{}');
    res.json({ success: true, result });
  } catch (err: any) {
    console.error('Error auto-matching transaction:', err);
    res.status(500).json({ error: err.message || 'Error al emparejar archivos' });
  }
});

/**
 * 2. Transcribe Audio using Gemini
 */
app.post('/api/assistant/transcribe', mediaJson, rateLimit(20), async (req, res) => {
  try {
    const { base64Audio, mimeType = 'audio/webm' } = req.body;
    if (!base64Audio) {
      return res.status(400).json({ error: 'Falta base64Audio' });
    }

    const ai = getGeminiClient();
    const cleanBase64 = base64Audio.replace(/^data:[^;]+;base64,/, '');

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-transcribe',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType.split(';')[0],
              data: cleanBase64,
            },
          },
          {
            text: 'Transcribe fielmente en español el contenido de este audio de voz del usuario sin añadir comentarios ni saludos. Solo el texto transcrito.',
          },
        ],
      },
    });

    res.json({ success: true, text: response.text?.trim() || '' });
  } catch (err: any) {
    console.error('Error in audio transcription:', err);
    res.status(500).json({ error: err.message || 'Error en transcripción de audio' });
  }
});

/**
 * 3. Text to Speech (TTS) using gemini-3.8-flash-lite-tts
 */
app.post('/api/assistant/tts', rateLimit(30), async (req, res) => {
  try {
    const { text, voice = 'Kore' } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Falta texto' });
    }

    const ai = getGeminiClient();

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: text,
              speechMetadata: {
                style: 'Asistente virtual amable, fluido, claro y profesional en español latinoamericano o castellano neutro',
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice || 'Kore' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      return res.status(500).json({ error: 'No se generó audio' });
    }

    res.json({ success: true, audioBase64: base64Audio, mimeType: 'audio/wav' });
  } catch (err: any) {
    console.error('TTS error:', err);
    res.status(500).json({ error: err.message || 'Error al sintetizar voz' });
  }
});

/**
 * 4. Financial Advisor & Real Market Search (Google Search Grounding)
 * Evaluates transport vs car, rent vs home buying, and queries live portals in the user's country.
 */
app.post('/api/assistant/financial-advice', rateLimit(15), async (req, res) => {
  try {
    const {
      country = 'México',
      currency = 'USD',
      monthlyIncome = 2500,
      fixedExpenses = 1200,
      variableExpenses = 800,
      transportExpense = 350,
      rentExpense = 700,
      userQuestion,
    } = req.body;

    const ai = getGeminiClient();

    const prompt = `Actúa como AuraFin AI, asesor financiero inteligente y estratega de patrimonio.
Perfil financiero del usuario en ${country} (Moneda: ${currency}):
- Ingreso mensual neto: ${monthlyIncome} ${currency}
- Total Gastos Fijos actuales: ${fixedExpenses} ${currency}
- Total Gastos Variables actuales: ${variableExpenses} ${currency}
- Gasto mensual específico en Transporte (Uber/Taxis/Pasajes/Combustible): ${transportExpense} ${currency}
- Gasto mensual específico en Alquiler/Renta: ${rentExpense} ${currency}
${userQuestion ? `Pregunta o consulta del usuario: "${userQuestion}"` : ''}

Realiza una evaluación financiera profunda con datos actualizados en tiempo real mediante Google Search en ${country}:
1. EVALUACIÓN DE TRANSPORTE VS AUTOMÓVIL:
   - ¿El gasto en transporte (${transportExpense} ${currency}) excede lo recomendable?
   - Si excede (o representa un costo elevado frente al ingreso), calcula y analiza si conviene financiar o comprar un auto económico/híbrido/seminuevo en ${country}.
   - Realiza búsquedas de precios y opciones actuales de automóviles confiables en venta en páginas de clasificados/concesionarios de ${country} (como MercadoLibre, Kavak, etc.).
2. EVALUACIÓN DE ALQUILER VS CASA PROPIA:
   - El usuario paga ${rentExpense} ${currency} en renta mensual.
   - Analiza si con ese gasto o un ajuste menor es factible una cuota de crédito hipotecario para adquirir departamento o casa en ${country}.
   - Realiza búsquedas de opciones reales de departamentos/casas en venta y alquiler en ${country} (como Inmuebles24, Idealista, Properati, etc.).
3. ESTRATEGIA DE AHORRO Y PROGRAMACIÓN DE PAGOS:
   - Diagnóstico del porcentaje de ahorro actual (Ingreso - Fijos - Variables).
   - Metodología recomendada (regla 50/30/20 adaptada).
   - 3 acciones concretas e inmediatas para recortar fugas de dinero.

Proporciona un reporte financiero estructurado en Markdown con subtítulos claros, comparativas numéricas, precios reales encontrados y enlaces a fuentes.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const textResult = response.text || '';
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

    // Extract web links from grounding
    const sources = groundingChunks
      .filter((chunk: any) => chunk.web && chunk.web.uri)
      .map((chunk: any) => ({
        title: chunk.web.title || 'Fuente web',
        url: chunk.web.uri,
      }))
      .slice(0, 8);

    res.json({
      success: true,
      analysis: textResult,
      sources,
      country,
    });
  } catch (err: any) {
    console.error('Error in financial advice:', err);
    res.status(500).json({ error: err.message || 'Error al obtener asesoría financiera' });
  }
});

/**
 * 5. Direct Real-time Portal Search for Cars or Real Estate in User's Country
 */
app.post('/api/assistant/search-market', rateLimit(15), async (req, res) => {
  try {
    const { category, country = 'México', budget, city } = req.body;
    // category: 'cars' | 'housing'

    const ai = getGeminiClient();

    let queryPrompt = '';
    if (category === 'cars') {
      queryPrompt = `Busca opciones reales y actuales de automóviles en venta en ${country} ${city ? `en ${city}` : ''} con un presupuesto o cuota mensual de referencia de aproximadamente ${budget || 'accesible / gama media'}.
Indica marcas y modelos populares y económicos (Toyota, Nissan, Honda, Hyundai, etc.), precios reales de mercado, sitios donde se publican (MercadoLibre, Kavak, etc.) y consejos de financiamiento en ${country}.`;
    } else {
      queryPrompt = `Busca opciones reales y actuales de venta y alquiler de casas y departamentos en ${country} ${city ? `en la ciudad/zona de ${city}` : ''} con rango de precio o alquiler mensual de referencia de ${budget || 'clase media'}.
Indica zonas, precios de renta vs cuota de compra, portales inmobiliarios líderes en ${country} y tasas hipotecarias de referencia en este año.`;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: queryPrompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const sources = (response.candidates?.[0]?.groundingMetadata?.groundingChunks || [])
      .filter((chunk: any) => chunk.web && chunk.web.uri)
      .map((chunk: any) => ({
        title: chunk.web.title || 'Portal en línea',
        url: chunk.web.uri,
      }));

    res.json({
      success: true,
      result: response.text || '',
      sources,
    });
  } catch (err: any) {
    console.error('Error in market search:', err);
    res.status(500).json({ error: err.message || 'Error en búsqueda de mercado' });
  }
});

/**
 * 6. Analyze 3-Month Spending Patterns & Suggest Optimized Category Budgets
 */
app.post('/api/assistant/analyze-budget-patterns', rateLimit(20), async (req, res) => {
  try {
    const { categoryPatterns = [], profile = {}, goals = [] } = req.body;

    const ai = getGeminiClient();

    const prompt = `Eres AuraFin AI, el asesor financiero inteligente.
Tu misión es analizar los patrones de gasto de los ÚLTIMOS 3 MESES del usuario para sugerir optimizaciones de presupuesto (límites mensuales por categoría) que maximicen su capacidad de ahorro sin deteriorar su calidad de vida.

Perfil financiero del usuario:
- País: ${profile.country || 'México'}
- Ingreso mensual: ${profile.currencySymbol || '$'}${profile.monthlyIncome || 2400}
- Moneda: ${profile.currency || 'USD'}
- Metas de ahorro activas: ${JSON.stringify(goals.map((g: any) => ({ titulo: g.title, objetivo: g.targetAmount, actual: g.currentAmount, plazo: g.deadline })))}

Patrones observados por categoría en los últimos 3 meses:
${JSON.stringify(categoryPatterns, null, 2)}

INSTRUCCIONES CLAVE DE OPTIMIZACIÓN:
1. GASTOS VARIABLES/DISCRECIONALES (ocio, transporte fluctuante, compras no esenciales):
   - Si la tendencia fue creciente o el consumo promedio es alto, sugiere una meta de reducción realista (10% - 25%).
   - Justifica cómo lograrlo sin privación (ej. agrupar viajes, sustituir 2 salidas por semana, cocinar en lote).
2. GASTOS FIJOS / ESENCIALES (alquiler, servicios, educación):
   - Proteger necesidades básicas. No sugerir recortes imposibles en alquiler contractual, pero sí sugerir optimización de consumo eléctrico, tarifas de telecomunicaciones o renegociación de pólizas.
3. ALINEACIÓN CON METAS:
   - Destaca cómo el ahorro mensual liberado acelerará el cumplimiento de sus metas (ej. comprar auto o enganche de casa).

Genera una respuesta en JSON estrictamente estructurada con:
- aiStrategicOverview: Resumen ejecutivo conciso de 2-3 párrafos explicando el diagnóstico de los 3 meses y la oportunidad de ahorro identificada.
- categoryAdvice: Objeto con la clave de cada categoría analizada y una recomendación práctica y humana de 1 a 2 oraciones para no exceder el nuevo límite.
- keyActionItems: Array de 3 a 4 recomendaciones inmediatas y accionables.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            aiStrategicOverview: {
              type: Type.STRING,
              description: 'Diagnóstico general estratégico de los 3 meses y potencial de ahorro',
            },
            categoryAdvice: {
              type: Type.OBJECT,
              description: 'Recomendaciones personalizadas por categoría',
              properties: {
                alquiler: { type: Type.STRING },
                transporte: { type: Type.STRING },
                alimentacion: { type: Type.STRING },
                servicios: { type: Type.STRING },
                ocio: { type: Type.STRING },
                salud: { type: Type.STRING },
                educacion: { type: Type.STRING },
                otro: { type: Type.STRING },
              },
            },
            keyActionItems: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Acciones clave prioritarias',
            },
          },
          required: ['aiStrategicOverview', 'categoryAdvice', 'keyActionItems'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    res.json({
      success: true,
      data: parsed,
    });
  } catch (err: any) {
    console.error('Error in analyze-budget-patterns:', err);
    res.status(500).json({ error: err.message || 'Error al analizar patrones de presupuesto' });
  }
});

/**
 * 6. Scan Physical Receipt with Camera & Multimodal Vision
 */
app.post('/api/assistant/scan-receipt', mediaJson, rateLimit(20), async (req, res) => {
  try {
    const { imageBase64, mimeType: providedMimeType, userCurrencySymbol = '$' } = req.body;

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return res.status(400).json({ error: 'La imagen del recibo en formato base64 es requerida' });
    }

    // Clean data URL prefix if present
    let cleanBase64 = imageBase64;
    let mimeType = providedMimeType || 'image/jpeg';

    if (imageBase64.startsWith('data:')) {
      const match = imageBase64.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        cleanBase64 = match[2];
      }
    }

    const ai = getGeminiClient();
    const todayISO = new Date().toISOString().split('T')[0];
    const currentYear = new Date().getFullYear();

    const prompt = `Eres un experto en contabilidad digital, OCR y análisis visual de comprobantes de pago.
Analiza la imagen adjunta de este recibo o ticket físico de compra y extrae con la máxima precisión posible:
1. "merchant": Nombre comercial o establecimiento impreso en el encabezado (ej: "Walmart", "Supermercados Éxito", "Farmacia Guadalajara", "Shell", "Starbucks", "Restaurante", etc.).
2. "title": Título claro y conciso para registrar la transacción (ej: "Compra en Walmart", "Carga de Gasolina", "Almuerzo Restaurante", "Factura de Electricidad").
3. "amount": Importe monetario TOTAL final pagado. Debe ser un número positivo (ej: 42.50).
4. "date": Fecha del comprobante en formato ISO YYYY-MM-DD. Si no tiene año explícito, asume ${currentYear}. Si la fecha no es legible, usa "${todayISO}".
5. "category": Categoría de gasto más exacta según el tipo de comercio y productos:
   - 'alimentacion': supermercados, comida rápida, panadería, abarrotes.
   - 'transporte': gasolina, peajes, estacionamiento, transporte público, taller.
   - 'ocio': restaurantes, bares, cafeterías, cine, eventos.
   - 'servicios': recibo de luz, agua, gas, telefonía, internet.
   - 'salud': farmacia, medicamentos, clínicas, ópticas.
   - 'educacion': libros, papelería, cursos, universidad.
   - 'alquiler': recibo de renta de vivienda o local.
   - 'otro': ferretería, ropa, tecnología o gastos varios.
6. "isFixed": true si es un recibo mensual fijo recurrente (como servicios del hogar o alquiler), false para compras variables cotidianas (la gran mayoría de tickets).
7. "frequency": 'unico' para compras normales, 'mensual' para facturas de servicios periódicos.
8. "items": Lista de los productos o ítems detallados en el ticket con nombre y precio unitario si están legibles.
9. "tax": Monto de impuestos (IVA/Tax) si está impreso, o 0.
10. "confidence": Nivel de confianza de la extracción del 0 al 100.
11. "notes": Resumen breve de los ítems adquiridos.
12. "tags": 3 a 5 hashtags pertinentes (ej: ["#supermercado", "#despensa", "#ticket"]).`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                data: cleanBase64,
                mimeType: mimeType,
              },
            },
            {
              text: prompt,
            },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            merchant: { type: Type.STRING, description: 'Nombre del establecimiento' },
            title: { type: Type.STRING, description: 'Título para el registro de gasto' },
            amount: { type: Type.NUMBER, description: 'Total numérico pagado' },
            date: { type: Type.STRING, description: 'Fecha YYYY-MM-DD' },
            category: {
              type: Type.STRING,
              description: 'alimentacion | transporte | servicios | ocio | salud | educacion | alquiler | otro',
            },
            isFixed: { type: Type.BOOLEAN, description: 'false si es gasto variable' },
            frequency: { type: Type.STRING, description: 'unico | mensual | quincenal | anual' },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  price: { type: Type.NUMBER },
                },
              },
            },
            tax: { type: Type.NUMBER, description: 'Impuestos desglosados' },
            confidence: { type: Type.NUMBER, description: '0 a 100' },
            notes: { type: Type.STRING, description: 'Notas del ticket' },
            tags: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: ['merchant', 'title', 'amount', 'date', 'category', 'isFixed', 'confidence'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    
    // Fallback normalization
    const result = {
      merchant: parsed.merchant || 'Comercio Local',
      title: parsed.title || `Gasto en ${parsed.merchant || 'Comercio'}`,
      amount: typeof parsed.amount === 'number' && parsed.amount > 0 ? parsed.amount : 0,
      date: parsed.date || todayISO,
      category: ['alimentacion', 'transporte', 'servicios', 'ocio', 'salud', 'educacion', 'alquiler', 'otro'].includes(parsed.category)
        ? parsed.category
        : 'alimentacion',
      isFixed: typeof parsed.isFixed === 'boolean' ? parsed.isFixed : false,
      frequency: parsed.frequency || 'unico',
      items: Array.isArray(parsed.items) ? parsed.items : [],
      tax: typeof parsed.tax === 'number' ? parsed.tax : 0,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 85,
      notes: parsed.notes || '',
      tags: Array.isArray(parsed.tags) ? parsed.tags : ['#recibo', '#gasto'],
    };

    res.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    console.error('Error in scan-receipt:', err);
    res.status(500).json({ error: err.message || 'Error al procesar el recibo con visión artificial' });
  }
});

/**
 * 6. Sincronización multiempresa (web ↔ móvil ↔ nube ↔ G:)
 *    Montada como router: ver server/rutas/sincronizacion.ts
 * 7. Empresas afiliadas, branding y usuarios: ver server/rutas/empresas.ts
 */
app.use('/api', routerSincronizacion);
app.use('/api', routerEmpresas);

/**
 * 8. Ruta heredada de APK: el antiguo endpoint generaba un archivo de texto
 * disfrazado de APK (hallazgo de seguridad). Se retiró; la app se instala
 * como PWA real desde el navegador. Respondemos 410 para enlaces antiguos.
 */
app.get(['/api/download/apk', '/download/aurafin.apk'], (req, res) => {
  res.status(410).json({
    error: 'La descarga de APK fue retirada. Instala AuraFin como PWA desde el navegador (menú → Instalar aplicación / Agregar a inicio).',
    install: '/manifest.json',
  });
});

// 404 JSON para rutas de API desconocidas (antes del fallback SPA)
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Endpoint no encontrado' });
});

// Setup Vite middleware in dev or static files in prod
async function startServer() {
  if (IS_PROD) {
    app.use(express.static(path.resolve(process.cwd(), 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(process.cwd(), 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, HOST, () => {
    console.log(`[AuraFin AI] Server running on http://${HOST}:${PORT}`);
    console.log(`[AuraFin DB] Espejo local (disco G:): ${diagnosticoLocal().baseDir}`);
    console.log(`[AuraFin Nube] Supabase: ${supabaseDisponible() ? 'configurado' : 'NO configurado (solo disco local)'}`);
    if (!SYNC_TOKEN) {
      console.log('[AuraFin] Sync sin token heredado (modo local). Para publicar: define AURAFIN_SYNC_TOKEN y HOST.');
    }
  });
}

// Persistir pendientes al cerrar
function flushAndExit(code: number) {
  persistirLegado();
  detenerReconciliacion();
  process.exit(code);
}
process.on('SIGINT', () => flushAndExit(0));
process.on('SIGTERM', () => flushAndExit(0));

startServer()
  .then(asegurarSuperadminInicial)
  .catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
