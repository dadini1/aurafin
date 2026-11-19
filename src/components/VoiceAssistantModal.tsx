import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Sparkles,
  X,
  ArrowRight,
  Loader2,
  FileText,
  DollarSign,
  Target,
  HelpCircle,
  CheckCircle2,
  AlertCircle,
  Zap,
  Plus,
  Trash2,
  Play,
  RotateCcw,
  Check,
  Settings2,
  History,
  Edit3,
  Copy,
  Clock,
} from 'lucide-react';
import {
  DeviceFile,
  DeviceContact,
  NoteItem,
  PaymentItem,
  SavingsGoal,
  UserFinancialProfile,
  VoiceIntentType,
  VoiceShortcut,
  VoiceCommandLogItem,
} from '../types';
import { VoiceRecorderHelper } from '../utils/speech';
import { processNoteWithAI, playAssistantVoice } from '../services/geminiService';
import { useTheme } from '../context/ThemeContext';

interface VoiceAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableFiles: DeviceFile[];
  availableContacts: DeviceContact[];
  profile: UserFinancialProfile;
  voiceAudioEnabled: boolean;
  onNoteCreated: (note: NoteItem, payment?: PaymentItem, goal?: SavingsGoal) => void;
  initialPromptText?: string;
  defaultIntent?: VoiceIntentType;
}

const DEFAULT_VOICE_SHORTCUTS: VoiceShortcut[] = [
  {
    id: 'sc-rent',
    trigger: 'Pagar Renta',
    promptTemplate: 'Pagar la renta del departamento de $650 que vence el 5 de cada mes a Carlos Morales',
    category: 'transaccion',
    description: 'Registra el pago de alquiler mensual programado',
    isCustom: false,
  },
  {
    id: 'sc-balance',
    trigger: 'Consultar Saldo',
    promptTemplate: '¿Cuál es mi balance financiero actual, cuánto he gastado y cuánto ahorro este mes?',
    category: 'consulta',
    description: 'Resumen en tiempo real de ingresos, gastos y ahorro neto',
    isCustom: false,
  },
  {
    id: 'sc-groceries',
    trigger: 'Registrar Súper',
    promptTemplate: 'Gasto variable de supermercado por $75 pagado con tarjeta hoy',
    category: 'transaccion',
    description: 'Registra compras y despensa con clasificación variable',
    isCustom: false,
  },
  {
    id: 'sc-gas',
    trigger: 'Cargar Gasolina',
    promptTemplate: 'Gasto en combustible y transporte por $35 en la estación de servicio',
    category: 'transaccion',
    description: 'Registra gastos rápidos de combustible y transporte',
    isCustom: false,
  },
  {
    id: 'sc-goal',
    trigger: 'Ahorro Emergencia',
    promptTemplate: 'Crear meta de ahorro de $3,000 en 6 meses para fondo de emergencia',
    category: 'meta_ahorro',
    description: 'Crea meta automática con aportes sugeridos',
    isCustom: false,
  },
  {
    id: 'sc-cuts',
    trigger: 'Recortar Gastos',
    promptTemplate: '¿En qué categorías estoy excediendo el promedio histórico y cómo recortar según la estrategia de ahorro?',
    category: 'consulta',
    description: 'Asesoría proactiva sobre categorías con sobregasto',
    isCustom: false,
  },
];

const DEFAULT_COMMAND_LOG: VoiceCommandLogItem[] = [
  {
    id: 'cmd-1',
    commandText: 'Hablé con el mecánico Juan por el cambio de aceite del auto y me cobró $120',
    intent: 'transaccion',
    executedAt: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
    summaryResult: 'Transacción registrada ($120 USD) y factura adjuntada',
    success: true,
  },
  {
    id: 'cmd-2',
    commandText: 'Pagar la renta del departamento de $650 el día 5 de cada mes a Carlos Morales',
    intent: 'transaccion',
    executedAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    summaryResult: 'Pago programado de alquiler creado para el 5 de nov',
    success: true,
  },
  {
    id: 'cmd-3',
    commandText: 'Quiero ahorrar $4,000 en 10 meses para el enganche de un auto seminuevo',
    intent: 'meta_ahorro',
    executedAt: new Date(Date.now() - 1000 * 60 * 360).toISOString(),
    summaryResult: 'Meta de ahorro de $4,000 USD creada con aporte mensual',
    success: true,
  },
  {
    id: 'cmd-4',
    commandText: '¿Cuál es mi balance financiero actual, cuánto he gastado y cuánto ahorro este mes?',
    intent: 'consulta',
    executedAt: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString(),
    summaryResult: 'Consulta de asesoría financiera respondida por voz',
    success: true,
  },
  {
    id: 'cmd-5',
    commandText: 'Compra de despensa familiar en el supermercado por $85.40 pagado con tarjeta',
    intent: 'transaccion',
    executedAt: new Date(Date.now() - 1000 * 60 * 60 * 40).toISOString(),
    summaryResult: 'Gasto variable de supermercado registrado con ticket',
    success: true,
  },
];

export const VoiceAssistantModal: React.FC<VoiceAssistantModalProps> = ({
  isOpen,
  onClose,
  availableFiles,
  availableContacts,
  profile,
  voiceAudioEnabled,
  onNoteCreated,
  initialPromptText = '',
  defaultIntent,
}) => {
  const { isNitido, isVibrant } = useTheme();

  // Mode: Assistant Dictation vs Voice Shortcuts vs Command Log
  const [activeModalTab, setActiveModalTab] = useState<'assistant' | 'shortcuts' | 'log'>('assistant');

  // Assistant State
  const [transcript, setTranscript] = useState(initialPromptText);
  const [isRecording, setIsRecording] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedIntent, setSelectedIntent] = useState<VoiceIntentType | 'auto'>(defaultIntent || 'auto');

  // Voice Shortcuts State
  const [shortcuts, setShortcuts] = useState<VoiceShortcut[]>(() => {
    try {
      const saved = localStorage.getItem('aurafin_voice_shortcuts');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Error reading voice shortcuts from localStorage:', e);
    }
    return DEFAULT_VOICE_SHORTCUTS;
  });

  // Voice Command Log State (Last 10 commands executed via voice)
  const [commandLog, setCommandLog] = useState<VoiceCommandLogItem[]>(() => {
    try {
      const saved = localStorage.getItem('aurafin_voice_command_log');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed.slice(0, 10);
      }
    } catch (e) {
      console.warn('Error reading command log from localStorage:', e);
    }
    return DEFAULT_COMMAND_LOG;
  });

  // New Shortcut Form State
  const [isAddingShortcut, setIsAddingShortcut] = useState(false);
  const [newTrigger, setNewTrigger] = useState('');
  const [newPromptTemplate, setNewPromptTemplate] = useState('');
  const [newCategory, setNewCategory] = useState<VoiceIntentType>('transaccion');
  const [newDescription, setNewDescription] = useState('');
  const [shortcutFeedbackToast, setShortcutFeedbackToast] = useState<string | null>(null);
  const [copiedCommandId, setCopiedCommandId] = useState<string | null>(null);

  const voiceHelperRef = useRef<VoiceRecorderHelper | null>(null);

  const INTENT_CATEGORIES = [
    { id: 'auto', label: 'Detección Automática', icon: Sparkles, desc: 'La IA clasifica la intención' },
    { id: 'nota', label: 'Nota / Dictado', icon: FileText, desc: 'Ideas, acuerdos, reuniones' },
    { id: 'transaccion', label: 'Pago / Transacción', icon: DollarSign, desc: 'Fijo, variable o ingreso' },
    { id: 'meta_ahorro', label: 'Meta de Ahorro', icon: Target, desc: 'Auto, vivienda, emergencia' },
    { id: 'consulta', label: 'Consulta Financiera', icon: HelpCircle, desc: 'Asesoría y recomendaciones' },
  ];

  const QUICK_PROMPTS_BY_INTENT: Record<string, string[]> = {
    all: [
      'Hablé con el mecánico Juan por el cambio de aceite del auto y me cobró $120',
      'Pagar la renta del departamento de $650 el día 5 de cada mes a Carlos Morales',
      'Gasté $45 en combustible y traslados en Uber esta semana',
      'Quiero ahorrar $4,000 en 10 meses para el enganche de un auto seminuevo',
      'Establecer meta de ahorro de $12,000 para el enganche de un departamento',
      '¿Me conviene comprar un automóvil considerando lo que gasto en transporte mensual?',
    ],
    nota: [
      'Reunión con el mecánico Juan sobre el mantenimiento del Honda Civic para revisar frenos',
      'Cotización de departamento en Residencial Palmas acordada con la asesora Sofía en $650',
    ],
    transaccion: [
      'Registrar pago fijo de luz de $48.50 que vence el 8 de noviembre',
      'Gasto variable de supermercado por $85.40 pagado con tarjeta',
      'Gasto de $320 acumulado este mes en taxis y Uber',
    ],
    meta_ahorro: [
      'Quiero ahorrar $4,000 en 10 meses para el enganche de un automóvil',
      'Crear meta de fondo de emergencia de $3,600 para 6 meses',
      'Meta de ahorro para comprar casa de $15,000 en 24 meses',
    ],
    consulta: [
      '¿Me conviene invertir en un auto considerando que gasto $320 en transporte al mes?',
      '¿Qué porcentaje de mis ingresos estoy gastando en renta y cómo puedo comprar casa?',
    ],
  };

  // Sync shortcuts with localStorage
  const saveShortcuts = (updated: VoiceShortcut[]) => {
    setShortcuts(updated);
    try {
      localStorage.setItem('aurafin_voice_shortcuts', JSON.stringify(updated));
    } catch (e) {
      console.warn('Error saving voice shortcuts to localStorage:', e);
    }
  };

  // Save command log to localStorage (max 10)
  const saveCommandLog = (updated: VoiceCommandLogItem[]) => {
    const trimmed = updated.slice(0, 10);
    setCommandLog(trimmed);
    try {
      localStorage.setItem('aurafin_voice_command_log', JSON.stringify(trimmed));
    } catch (e) {
      console.warn('Error saving command log to localStorage:', e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      voiceHelperRef.current = new VoiceRecorderHelper();
      if (initialPromptText) {
        setTranscript(initialPromptText);
      } else {
        startRecording();
      }
    } else {
      stopRecording();
      setTranscript('');
      setErrorMessage(null);
      setIsProcessing(false);
      setSelectedIntent(defaultIntent || 'auto');
      setActiveModalTab('assistant');
      setIsAddingShortcut(false);
    }
    return () => {
      stopRecording();
    };
  }, [isOpen]);

  const startRecording = async () => {
    if (!voiceHelperRef.current) {
      voiceHelperRef.current = new VoiceRecorderHelper();
    }
    setErrorMessage(null);
    setIsRecording(true);

    await voiceHelperRef.current.startListening(
      (interim) => {
        setTranscript(interim);
      },
      (final) => {
        setTranscript(final);
      },
      (volume) => {
        setVolumeLevel(volume);
      },
      (err) => {
        console.warn('Voice error:', err);
        setErrorMessage(err);
      }
    );
  };

  const stopRecording = async () => {
    if (voiceHelperRef.current && voiceHelperRef.current.isListening) {
      setIsRecording(false);
      setVolumeLevel(0);
      await voiceHelperRef.current.stopListening();
    }
  };

  const handleToggleRecord = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // Check if live transcript matches any custom or default voice trigger
  const matchedShortcut = React.useMemo(() => {
    if (!transcript.trim()) return null;
    const lower = transcript.toLowerCase();
    return shortcuts.find(
      (sc) =>
        lower.includes(sc.trigger.toLowerCase()) ||
        sc.trigger.toLowerCase().split(' ').every((w) => lower.includes(w))
    );
  }, [transcript, shortcuts]);

  const handleApplyShortcut = (shortcut: VoiceShortcut, autoExecute = false) => {
    setTranscript(shortcut.promptTemplate);
    if (shortcut.category) {
      setSelectedIntent(shortcut.category);
    }
    if (autoExecute) {
      handleProcessNote(shortcut.promptTemplate, shortcut.category);
    } else {
      setActiveModalTab('assistant');
      setShortcutFeedbackToast(`¡Atajo "${shortcut.trigger}" aplicado! Revisa o toca Procesar.`);
      setTimeout(() => setShortcutFeedbackToast(null), 3500);
    }
  };

  const handleCreateCustomShortcut = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTrigger.trim() || !newPromptTemplate.trim()) return;

    const newSc: VoiceShortcut = {
      id: `sc-custom-${Date.now()}`,
      trigger: newTrigger.trim(),
      promptTemplate: newPromptTemplate.trim(),
      category: newCategory,
      description: newDescription.trim() || `Atajo de voz personalizado para ${newTrigger.trim()}`,
      isCustom: true,
    };

    const next = [newSc, ...shortcuts];
    saveShortcuts(next);
    setNewTrigger('');
    setNewPromptTemplate('');
    setNewDescription('');
    setIsAddingShortcut(false);
    setShortcutFeedbackToast(`¡Atajo "${newSc.trigger}" guardado exitosamente!`);
    setTimeout(() => setShortcutFeedbackToast(null), 3500);
  };

  const handleDeleteShortcut = (id: string) => {
    const next = shortcuts.filter((s) => s.id !== id);
    saveShortcuts(next);
  };

  const handleResetShortcuts = () => {
    saveShortcuts(DEFAULT_VOICE_SHORTCUTS);
    setShortcutFeedbackToast('¡Atajos restablecidos a la configuración inicial!');
    setTimeout(() => setShortcutFeedbackToast(null), 3000);
  };

  // Command Log: Edit previous request
  const handleEditPreviousCommand = (logItem: VoiceCommandLogItem) => {
    setTranscript(logItem.commandText);
    if (logItem.intent && logItem.intent !== 'auto') {
      setSelectedIntent(logItem.intent);
    }
    setActiveModalTab('assistant');
    setShortcutFeedbackToast(`Comando cargado para editar. Modifica el texto y presiona Analizar.`);
    setTimeout(() => setShortcutFeedbackToast(null), 3500);
  };

  // Command Log: Re-run previous request immediately
  const handleReRunCommand = (logItem: VoiceCommandLogItem) => {
    setTranscript(logItem.commandText);
    if (logItem.intent && logItem.intent !== 'auto') {
      setSelectedIntent(logItem.intent);
    }
    handleProcessNote(logItem.commandText, logItem.intent !== 'auto' ? logItem.intent : undefined);
  };

  // Command Log: Copy text
  const handleCopyCommandText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCommandId(id);
    setTimeout(() => setCopiedCommandId(null), 2000);
  };

  // Command Log: Delete entry
  const handleDeleteCommandLogItem = (id: string) => {
    const next = commandLog.filter((item) => item.id !== id);
    saveCommandLog(next);
  };

  // Command Log: Clear all
  const handleClearCommandLog = () => {
    saveCommandLog([]);
    setShortcutFeedbackToast('Historial de comandos de voz limpiado.');
    setTimeout(() => setShortcutFeedbackToast(null), 2500);
  };

  const handleProcessNote = async (textToProcess?: string, overrideIntent?: VoiceIntentType) => {
    const finalText = (textToProcess || transcript).trim();
    if (!finalText) {
      setErrorMessage('Por favor di o escribe algo antes de procesar.');
      return;
    }

    await stopRecording();
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      setProcessingStep('1/3 Diferenciando intención y contexto con IA...');
      await new Promise((r) => setTimeout(r, 350));

      setProcessingStep('2/3 Escaneando galería de archivos y contactos...');
      const result = await processNoteWithAI(finalText, availableFiles, availableContacts);

      setProcessingStep('3/3 Agrupando registros y auto-adjuntando...');
      await new Promise((r) => setTimeout(r, 250));

      const noteId = `note-${Date.now()}`;
      let createdPayment: PaymentItem | undefined = undefined;
      let createdGoal: SavingsGoal | undefined = undefined;

      // 1. Transaction creation if detected
      if (
        result.detectedPayment &&
        result.detectedPayment.hasPayment &&
        result.detectedPayment.amount
      ) {
        createdPayment = {
          id: `pay-${Date.now()}`,
          title: result.detectedPayment.title || result.title,
          amount: result.detectedPayment.amount,
          type: result.detectedPayment.type === 'ingreso' ? 'ingreso' : 'gasto',
          isFixed: Boolean(result.detectedPayment.isFixed),
          category: (result.detectedPayment.category as any) || 'otro',
          frequency: (result.detectedPayment.frequency as any) || 'mensual',
          dueDate: result.detectedPayment.dueDate || new Date().toISOString().split('T')[0],
          // "Se pagó" → pagado; pago programado/futuro → pendiente
          status: result.detectedPayment.paid ? 'pagado' : 'pendiente',
          beneficiary: result.detectedPayment.beneficiary || undefined,
          detail: result.detectedPayment.detail || result.formattedContent,
          noteId: noteId,
          matchedFileIds: result.matchedFileIds || [],
          matchedContactIds: result.matchedContactIds || [],
          createdAt: new Date().toISOString(),
        };
      }

      // 2. Savings Goal creation if detected
      if (
        result.detectedGoal &&
        result.detectedGoal.hasGoal &&
        result.detectedGoal.targetAmount
      ) {
        createdGoal = {
          id: `goal-${Date.now()}`,
          title: result.detectedGoal.title || result.title,
          targetAmount: result.detectedGoal.targetAmount,
          currentAmount: 0,
          deadline:
            result.detectedGoal.deadline ||
            new Date(Date.now() + 300 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          category: (result.detectedGoal.category as any) || 'otro',
          monthlyContribution:
            result.detectedGoal.monthlyContribution ||
            Math.round(result.detectedGoal.targetAmount / 10),
          notes: `Generado por asistente de voz a partir de: "${finalText}"`,
          createdAt: new Date().toISOString(),
        };
      }

      const activeIntent = overrideIntent || (selectedIntent !== 'auto' ? selectedIntent : result.intent);

      // 3. Complete Note item
      const newNote: NoteItem = {
        id: noteId,
        title: result.title,
        content: finalText,
        formattedContent: result.formattedContent,
        rawTranscript: finalText,
        intent: activeIntent as VoiceIntentType,
        tags: result.tags.map((t) => (t.startsWith('#') ? t : `#${t}`)),
        category: (result.category as any) || 'general',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        matchedFileIds: result.matchedFileIds || [],
        matchedContactIds: result.matchedContactIds || [],
        matchReasons: result.matchReasons || [],
        fileMatchDetails: result.fileMatchDetails,
        contactMatchDetails: result.contactMatchDetails,
        isPinned: false,
        linkedPaymentId: createdPayment?.id,
        linkedGoalId: createdGoal?.id,
      };

      // Record in Command Log (keeping max 10)
      const summaryResult = createdPayment
        ? `Pago registrado: ${createdPayment.title} (${profile.currencySymbol}${createdPayment.amount})`
        : createdGoal
        ? `Meta creada: ${createdGoal.title} (${profile.currencySymbol}${createdGoal.targetAmount})`
        : `Nota registrada: ${result.title}`;

      const newLogItem: VoiceCommandLogItem = {
        id: `cmd-${Date.now()}`,
        commandText: finalText,
        intent: activeIntent as VoiceIntentType,
        executedAt: new Date().toISOString(),
        summaryResult,
        success: true,
      };
      saveCommandLog([newLogItem, ...commandLog.filter((c) => c.commandText !== finalText)]);

      // Voice TTS feedback if enabled
      if (voiceAudioEnabled && result.spokenResponse) {
        playAssistantVoice(result.spokenResponse).catch(() => {});
      }

      onNoteCreated(newNote, createdPayment, createdGoal);
      onClose();
    } catch (err: any) {
      console.error('Error processing note:', err);
      setErrorMessage(err.message || 'Error al procesar con IA. Inténtalo de nuevo.');
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  const currentPrompts =
    selectedIntent === 'auto'
      ? QUICK_PROMPTS_BY_INTENT.all
      : QUICK_PROMPTS_BY_INTENT[selectedIntent] || QUICK_PROMPTS_BY_INTENT.all;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 backdrop-blur-md animate-in fade-in duration-200 ${
      isNitido ? 'bg-slate-900/40' : 'bg-slate-950/85'
    }`}>
      <div className={`relative w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border ${
        isNitido ? 'bg-white border-slate-200 shadow-indigo-500/10' : 'bg-slate-900 border-slate-800'
      }`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-5 sm:px-6 py-4 border-b ${
          isNitido ? 'border-slate-100 bg-slate-50/70' : 'border-slate-800 bg-slate-900/80'
        }`}>
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-2xl text-white shadow-md ${
                isNitido
                  ? 'bg-gradient-to-tr from-cyan-500 via-indigo-600 to-fuchsia-500 shadow-cyan-500/20'
                  : isVibrant
                  ? 'bg-gradient-to-tr from-[#00d2ff] to-[#7928ca] shadow-[0_0_15px_rgba(0,210,255,0.4)]'
                  : 'bg-gradient-to-tr from-cyan-500 to-indigo-600 shadow-cyan-500/20'
              }`}
            >
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className={`text-base font-bold flex items-center gap-2 ${isNitido ? 'text-slate-900' : 'text-white'}`}>
                Asistente de Voz IA
                <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                  isNitido ? 'bg-cyan-50 text-cyan-800 border-cyan-300' : 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                }`}>
                  Multimodal & Comandos
                </span>
              </h3>
              <p className={`text-xs ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
                Dictado en vivo, atajos rápidos e historial de comandos ejecutados.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-xl transition-colors ${
              isNitido ? 'text-slate-400 hover:text-slate-800 hover:bg-slate-100' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Navigation Tabs: Assistant vs Voice Shortcuts vs Command Log */}
        <div className={`flex items-center border-b px-3 sm:px-6 pt-2 overflow-x-auto no-scrollbar ${
          isNitido ? 'border-slate-100 bg-slate-50/50' : 'border-slate-800 bg-slate-950/40'
        }`}>
          <button
            type="button"
            onClick={() => setActiveModalTab('assistant')}
            className={`flex items-center gap-2 py-2.5 px-3 sm:px-4 text-xs font-bold border-b-2 transition-all shrink-0 ${
              activeModalTab === 'assistant'
                ? isNitido
                  ? 'border-cyan-600 text-cyan-700 bg-cyan-50/40'
                  : isVibrant
                  ? 'border-cyan-400 text-cyan-300'
                  : 'border-cyan-500 text-cyan-400'
                : isNitido ? 'border-transparent text-slate-500 hover:text-slate-800' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Dictado en Vivo</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveModalTab('shortcuts')}
            className={`flex items-center gap-1.5 py-2.5 px-3 sm:px-4 text-xs font-bold border-b-2 transition-all shrink-0 ${
              activeModalTab === 'shortcuts'
                ? isNitido
                  ? 'border-amber-600 text-amber-700 bg-amber-50/40'
                  : isVibrant
                  ? 'border-cyan-400 text-cyan-300'
                  : 'border-cyan-500 text-cyan-400'
                : isNitido ? 'border-transparent text-slate-500 hover:text-slate-800' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span>Atajos de Voz</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full border ${
              isNitido ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
            }`}>
              {shortcuts.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveModalTab('log')}
            className={`flex items-center gap-1.5 py-2.5 px-3 sm:px-4 text-xs font-bold border-b-2 transition-all shrink-0 ${
              activeModalTab === 'log'
                ? isNitido
                  ? 'border-indigo-600 text-indigo-700 bg-indigo-50/40'
                  : isVibrant
                  ? 'border-cyan-400 text-cyan-300'
                  : 'border-cyan-500 text-cyan-400'
                : isNitido ? 'border-transparent text-slate-500 hover:text-slate-800' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="w-3.5 h-3.5 text-indigo-500" />
            <span>Historial (Command Log)</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full border ${
              isNitido ? 'bg-indigo-100 text-indigo-800 border-indigo-300' : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
            }`}>
              {commandLog.length}
            </span>
          </button>
        </div>

        {/* Feedback Toast */}
        {shortcutFeedbackToast && (
          <div className="mx-5 sm:mx-6 mt-3 p-2.5 bg-cyan-950/80 border border-cyan-500/40 rounded-xl text-cyan-300 text-xs font-semibold flex items-center justify-between animate-fadeIn">
            <span className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-cyan-400" />
              {shortcutFeedbackToast}
            </span>
            <button
              onClick={() => setShortcutFeedbackToast(null)}
              className="text-cyan-400 hover:text-white text-xs ml-2"
            >
              ✕
            </button>
          </div>
        )}

        {/* TAB 1: ASSISTANT & DICTATION */}
        {activeModalTab === 'assistant' && (
          <div className="p-5 sm:p-6 flex-1 overflow-y-auto space-y-4 custom-scrollbar">
            {/* Quick Shortcuts & Recent Commands Ribbon */}
            <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Zap className="w-3 h-3 text-amber-400" />
                  Atajos y Comandos Recientes
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveModalTab('log')}
                    className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                  >
                    <History className="w-3 h-3" />
                    <span>Ver Log ({commandLog.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveModalTab('shortcuts')}
                    className="text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                  >
                    <Settings2 className="w-3 h-3" />
                    <span>Atajos</span>
                  </button>
                </div>
              </div>

              {/* Quick shortcut chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                {shortcuts.slice(0, 5).map((sc) => (
                  <button
                    key={sc.id}
                    type="button"
                    onClick={() => handleApplyShortcut(sc, false)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/40 text-slate-200 hover:text-white text-[11px] font-semibold shrink-0 transition-all active:scale-95"
                    title={sc.promptTemplate}
                  >
                    <span className="text-amber-400 text-xs">⚡</span>
                    <span>{sc.trigger}</span>
                  </button>
                ))}

                {commandLog.length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleEditPreviousCommand(commandLog[0])}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-indigo-950/50 hover:bg-indigo-900/50 border border-indigo-500/30 text-indigo-300 text-[11px] font-semibold shrink-0 transition-all active:scale-95"
                    title={`Último comando: ${commandLog[0].commandText}`}
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Último: {commandLog[0].commandText.slice(0, 20)}...</span>
                  </button>
                )}
              </div>
            </div>

            {/* Matched Shortcut Banner (Real-time trigger recognition) */}
            {matchedShortcut && (
              <div className="p-3 rounded-2xl bg-gradient-to-r from-amber-950/40 via-slate-900 to-indigo-950/40 border border-amber-500/40 flex items-center justify-between gap-3 animate-fadeIn">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-300">
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block">
                      ¡Atajo detectado: &ldquo;{matchedShortcut.trigger}&rdquo;!
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Toca para autocompletar la plantilla o procesar directamente.
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleApplyShortcut(matchedShortcut, false)}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
                  >
                    Usar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyShortcut(matchedShortcut, true)}
                    className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-cyan-500 to-indigo-600 text-white text-xs font-bold transition-transform active:scale-95"
                  >
                    Ejecutar
                  </button>
                </div>
              </div>
            )}

            {/* Intent Differentiation Selector */}
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                Tipo de Entrada / Intención
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                {INTENT_CATEGORIES.map((item) => {
                  const Icon = item.icon;
                  const isSelected = selectedIntent === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setSelectedIntent(item.id as any)}
                      className={`p-2 rounded-xl border text-left transition-all flex flex-col items-center justify-center text-center gap-1 ${
                        isSelected
                          ? 'bg-cyan-500/15 border-cyan-500 text-cyan-300 shadow-sm'
                          : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="text-[11px] font-bold leading-tight">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Audio Visualizer & Waveform */}
            <div className="flex flex-col items-center justify-center p-5 bg-slate-950/60 rounded-2xl border border-slate-800/80 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 via-transparent to-indigo-500/5 pointer-events-none" />

              {/* Glowing Microphone Button */}
              <div className="relative mb-2">
                {isRecording && (
                  <div
                    className="absolute inset-0 rounded-full bg-cyan-500 blur-xl opacity-40 transition-transform duration-100"
                    style={{ transform: `scale(${1 + volumeLevel * 1.5})` }}
                  />
                )}
                <button
                  onClick={handleToggleRecord}
                  className={`relative flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-full transition-all duration-300 shadow-xl ${
                    isRecording
                      ? 'bg-rose-500 hover:bg-rose-600 text-white ring-4 ring-rose-500/30 animate-pulse'
                      : isVibrant
                      ? 'bg-gradient-to-tr from-[#00d2ff] via-[#7928ca] to-[#ff0080] hover:scale-105 text-white ring-4 ring-cyan-500/30'
                      : 'bg-gradient-to-tr from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white ring-4 ring-cyan-500/20'
                  }`}
                >
                  {isRecording ? <Mic className="w-7 h-7" /> : <MicOff className="w-7 h-7" />}
                </button>
              </div>

              <p className="text-xs font-medium text-slate-300 mb-2">
                {isRecording
                  ? 'Escuchando tu voz... Di tu tarea o activa un atajo'
                  : 'Presiona el micrófono para hablar o escribe abajo'}
              </p>

              {/* Simulated Dynamic Sound Bars */}
              <div className="flex items-center gap-1.5 h-6 px-4">
                {[4, 8, 14, 20, 16, 10, 6, 12, 22, 18, 12, 6].map((baseHeight, idx) => {
                  const dynamicHeight = isRecording
                    ? Math.min(26, Math.max(4, baseHeight * (0.8 + volumeLevel * 2.5)))
                    : 3;
                  return (
                    <div
                      key={idx}
                      className={`w-1 rounded-full transition-all duration-75 ${
                        isRecording ? 'bg-gradient-to-t from-cyan-500 to-indigo-400' : 'bg-slate-700'
                      }`}
                      style={{ height: `${dynamicHeight}px` }}
                    />
                  );
                })}
              </div>
            </div>

            {/* Transcript Area */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Dictado en Directo o Texto
                </label>
                {transcript && (
                  <button
                    onClick={() => setTranscript('')}
                    className="text-xs text-slate-500 hover:text-slate-300"
                  >
                    Limpiar
                  </button>
                )}
              </div>
              <textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder="Ej: 'Pagar la renta del departamento' o 'Consultar saldo este mes'..."
                rows={3}
                className="w-full px-4 py-2.5 bg-slate-950/80 border border-slate-700/80 rounded-xl text-slate-100 placeholder-slate-500 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500 transition-all resize-none"
              />
            </div>

            {/* Quick Voice Suggestions */}
            <div>
              <p className="text-xs font-semibold text-slate-400 mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                Ejemplos de dictado para probar la IA:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {currentPrompts.slice(0, 4).map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setTranscript(prompt);
                      handleProcessNote(prompt);
                    }}
                    className="text-left text-xs px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition-all"
                  >
                    &ldquo;{prompt}&rdquo;
                  </button>
                ))}
              </div>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: VOICE SHORTCUTS CONFIGURATION SECTION */}
        {activeModalTab === 'shortcuts' && (
          <div className="p-5 sm:p-6 flex-1 overflow-y-auto space-y-5 custom-scrollbar">
            {/* Header info */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-gradient-to-r from-amber-950/30 via-slate-900 to-indigo-950/30 border border-amber-500/30">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-300 shrink-0 mt-0.5">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">
                    Configuración de Atajos de Voz (Voice Shortcuts)
                  </h4>
                  <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                    Personaliza palabras clave como <em>&ldquo;Pagar Renta&rdquo;</em> o <em>&ldquo;Consultar Saldo&rdquo;</em> para disparar automáticamente transacciones o consultas.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                <button
                  type="button"
                  onClick={() => setIsAddingShortcut(!isAddingShortcut)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all shadow-md active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isAddingShortcut ? 'Cerrar Formulario' : 'Nuevo Atajo'}</span>
                </button>
              </div>
            </div>

            {/* Add Custom Shortcut Form */}
            {isAddingShortcut && (
              <form
                onSubmit={handleCreateCustomShortcut}
                className="p-4 rounded-2xl bg-slate-950 border border-amber-500/40 space-y-3.5 animate-fadeIn"
              >
                <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                  <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5" />
                    Crear Nuevo Atajo de Voz
                  </span>
                  <span className="text-[10px] text-slate-400">Se guardará localmente</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-300 block mb-1">
                      Palabra o Frase Clave (Trigger) *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: Pagar Renta, Consultar Saldo, Gym..."
                      value={newTrigger}
                      onChange={(e) => setNewTrigger(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-300 block mb-1">
                      Tipo de Tarea / Intención *
                    </label>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value as VoiceIntentType)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none cursor-pointer"
                    >
                      <option value="transaccion">Pago / Transacción (Fijo, Variable, Ingreso)</option>
                      <option value="consulta">Consulta Financiera / Asesoría</option>
                      <option value="meta_ahorro">Meta de Ahorro</option>
                      <option value="nota">Nota / Recordatorio General</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">
                    Instrucción Completa o Plantilla para la IA *
                  </label>
                  <textarea
                    required
                    rows={2}
                    placeholder="Ej: Pagar la renta de $650 con vencimiento el día 5 del mes a nombre de Carlos Morales"
                    value={newPromptTemplate}
                    onChange={(e) => setNewPromptTemplate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 resize-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">
                    Descripción Breve (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Pago recurrente del departamento"
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsAddingShortcut(false)}
                    className="px-3 py-1.5 rounded-xl text-slate-400 hover:text-white text-xs font-semibold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-bold text-xs shadow-md active:scale-95 transition-transform"
                  >
                    Guardar Atajo
                  </button>
                </div>
              </form>
            )}

            {/* Configured Shortcuts Cards */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs text-slate-400 font-bold px-1">
                <span>Atajos Configurados ({shortcuts.length})</span>
                <button
                  type="button"
                  onClick={handleResetShortcuts}
                  className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Restablecer Predeterminados</span>
                </button>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                {shortcuts.map((sc) => {
                  const categoryBadgeColor =
                    sc.category === 'transaccion'
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                      : sc.category === 'consulta'
                      ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                      : sc.category === 'meta_ahorro'
                      ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                      : 'bg-slate-700/30 text-slate-300 border-slate-600/30';

                  const categoryLabel =
                    sc.category === 'transaccion'
                      ? 'Transacción'
                      : sc.category === 'consulta'
                      ? 'Consulta'
                      : sc.category === 'meta_ahorro'
                      ? 'Meta de Ahorro'
                      : 'Nota';

                  return (
                    <div
                      key={sc.id}
                      className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                    >
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-white text-sm flex items-center gap-1.5">
                            <Zap className="w-3.5 h-3.5 text-amber-400" />
                            &ldquo;{sc.trigger}&rdquo;
                          </span>
                          <span
                            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${categoryBadgeColor}`}
                          >
                            {categoryLabel}
                          </span>
                          {sc.isCustom && (
                            <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                              Personalizado
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                          {sc.promptTemplate}
                        </p>

                        {sc.description && (
                          <p className="text-[10px] text-slate-500 italic">
                            {sc.description}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                        <button
                          type="button"
                          onClick={() => handleApplyShortcut(sc, false)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700 text-xs font-semibold transition-colors active:scale-95"
                          title="Cargar texto al dictador"
                        >
                          <span>Usar</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleApplyShortcut(sc, true)}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white text-xs font-bold transition-all shadow-md active:scale-95"
                          title="Ejecutar y procesar de inmediato con IA"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Ejecutar</span>
                        </button>

                        {sc.isCustom && (
                          <button
                            type="button"
                            onClick={() => handleDeleteShortcut(sc.id)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                            title="Eliminar este atajo"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: COMMAND LOG SECTION (Last 10 Voice Commands - Re-run & Edit) */}
        {activeModalTab === 'log' && (
          <div className="p-5 sm:p-6 flex-1 overflow-y-auto space-y-4 custom-scrollbar">
            {/* Header info */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-gradient-to-r from-indigo-950/30 via-slate-900 to-cyan-950/30 border border-indigo-500/30">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-300 shrink-0 mt-0.5">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">
                    Historial de Comandos de Voz (Command Log)
                  </h4>
                  <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                    Visualiza los últimos 10 comandos ejecutados por voz. Puedes <strong>re-ejecutarlos</strong> al instante o <strong>editarlos</strong> antes de procesar.
                  </p>
                </div>
              </div>

              {commandLog.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearCommandLog}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 border border-slate-700 hover:border-rose-500/30 text-xs font-semibold transition-all self-start sm:self-auto shrink-0"
                  title="Limpiar todo el historial"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Limpiar Log</span>
                </button>
              )}
            </div>

            {/* List of last 10 commands */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs text-slate-400 font-bold px-1">
                <span>Últimos Comandos Ejecutados ({commandLog.length}/10)</span>
                <span className="text-[11px] text-cyan-400">Toca Editar o Re-ejecutar</span>
              </div>

              {commandLog.map((logItem, idx) => {
                const categoryBadgeColor =
                  logItem.intent === 'transaccion'
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    : logItem.intent === 'consulta'
                    ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                    : logItem.intent === 'meta_ahorro'
                    ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                    : 'bg-slate-700/30 text-slate-300 border-slate-600/30';

                const categoryLabel =
                  logItem.intent === 'transaccion'
                    ? 'Transacción'
                    : logItem.intent === 'consulta'
                    ? 'Consulta'
                    : logItem.intent === 'meta_ahorro'
                    ? 'Meta de Ahorro'
                    : 'Nota';

                const timeFormatted = new Date(logItem.executedAt).toLocaleTimeString('es-ES', {
                  hour: '2-digit',
                  minute: '2-digit',
                });
                const dateFormatted = new Date(logItem.executedAt).toLocaleDateString('es-ES', {
                  day: 'numeric',
                  month: 'short',
                });

                return (
                  <div
                    key={logItem.id}
                    className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-800 text-slate-400">
                          #{idx + 1}
                        </span>
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${categoryBadgeColor}`}
                        >
                          {categoryLabel}
                        </span>
                        <span className="text-[10px] text-slate-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {dateFormatted}, {timeFormatted}
                        </span>
                      </div>

                      <p className="text-xs text-white font-medium leading-relaxed">
                        &ldquo;{logItem.commandText}&rdquo;
                      </p>

                      {logItem.summaryResult && (
                        <p className="text-[11px] text-emerald-400/90 flex items-center gap-1 font-semibold">
                          <CheckCircle2 className="w-3 h-3 shrink-0" />
                          <span>{logItem.summaryResult}</span>
                        </p>
                      )}
                    </div>

                    {/* Action buttons: Edit, Re-run, Copy, Delete */}
                    <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                      {/* Copy Button */}
                      <button
                        type="button"
                        onClick={() => handleCopyCommandText(logItem.id, logItem.commandText)}
                        className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors"
                        title="Copiar texto del comando"
                      >
                        {copiedCommandId === logItem.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>

                      {/* Edit Button */}
                      <button
                        type="button"
                        onClick={() => handleEditPreviousCommand(logItem)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 hover:text-cyan-200 border border-cyan-500/30 text-xs font-semibold transition-all active:scale-95"
                        title="Cargar texto en el dictador para editarlo antes de procesar"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Editar</span>
                      </button>

                      {/* Re-run Button */}
                      <button
                        type="button"
                        onClick={() => handleReRunCommand(logItem)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white text-xs font-bold transition-all shadow-md active:scale-95"
                        title="Re-ejecutar este comando de voz de inmediato"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>Re-ejecutar</span>
                      </button>

                      {/* Delete from log */}
                      <button
                        type="button"
                        onClick={() => handleDeleteCommandLogItem(logItem.id)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        title="Eliminar del historial"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}

              {commandLog.length === 0 && (
                <div className="p-8 text-center bg-slate-950/60 rounded-2xl border border-slate-800 space-y-2">
                  <History className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-xs text-slate-400 font-semibold">
                    No hay comandos en el historial todavía.
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Los comandos que dictes por voz se registrarán automáticamente aquí para re-ejecutarlos o editarlos cuando lo necesites.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-5 sm:px-6 py-3.5 border-t border-slate-800 bg-slate-900/70 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-400">
            {activeModalTab === 'assistant' ? (
              isRecording ? (
                <span className="text-cyan-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                  Micrófono activo
                </span>
              ) : (
                <span>Presiona Analizar o usa un atajo</span>
              )
            ) : activeModalTab === 'shortcuts' ? (
              <span>{shortcuts.length} atajos de voz configurados</span>
            ) : (
              <span>{commandLog.length} comandos en el historial (máx. 10)</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {activeModalTab !== 'assistant' ? (
              <button
                type="button"
                onClick={() => setActiveModalTab('assistant')}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-md transition-all"
              >
                <Mic className="w-3.5 h-3.5" />
                <span>Volver al Dictado</span>
              </button>
            ) : (
              <>
                <button
                  onClick={onClose}
                  disabled={isProcessing}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleProcessNote()}
                  disabled={isProcessing || !transcript.trim()}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-semibold text-xs sm:text-sm shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all ${
                    isVibrant
                      ? 'bg-gradient-to-r from-[#00d2ff] via-[#7928ca] to-[#ff0080] shadow-[0_0_20px_rgba(0,210,255,0.4)]'
                      : 'bg-gradient-to-r from-cyan-500 via-indigo-600 to-violet-600 hover:from-cyan-400 hover:to-indigo-500 shadow-cyan-500/25'
                  }`}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{processingStep || 'Procesando...'}</span>
                    </>
                  ) : (
                    <>
                      <span>Analizar y Auto-Adjuntar</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
