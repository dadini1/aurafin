import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  Mic,
  Square,
  Send,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Volume2,
  VolumeX,
  ArrowRight,
  Sliders,
  Loader2,
} from 'lucide-react';
import { UserFinancialProfile } from '../types';
import { useTheme } from '../context/ThemeContext';
import { VoiceRecorderHelper } from '../utils/speech';
import { transcribeAudioBlob, playAssistantVoice } from '../services/geminiService';
import {
  parseBudgetVoiceCommand,
  ParsedBudgetCommand,
} from '../utils/budgetVoiceCommandParser';

interface QuickBudgetVoiceCommandBarProps {
  categoryBudgets: Record<string, number>;
  onUpdateCategoryBudgets: (updated: Record<string, number>) => void;
  profile: UserFinancialProfile;
  onJumpToBudgets?: () => void;
}

interface AppliedChangeRecord {
  commandText: string;
  category: string;
  categoryLabel: string;
  previousAmount: number;
  newAmount: number;
  delta: number;
  previousBudgetsSnapshot: Record<string, number>;
  appliedAt: number;
}

const EXAMPLE_COMMANDS = [
  'Update my food budget to $500',
  'Increase transport budget by $50',
  'Set entertainment budget to $150',
  'Reduce servicios a $100',
];

export const QuickBudgetVoiceCommandBar: React.FC<QuickBudgetVoiceCommandBarProps> = ({
  categoryBudgets,
  onUpdateCategoryBudgets,
  profile,
  onJumpToBudgets,
}) => {
  const { isNitido, isVibrant } = useTheme();
  const [commandText, setCommandText] = useState('');
  const [speechLang, setSpeechLang] = useState<'en-US' | 'es-ES'>('en-US');
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [micVolume, setMicVolume] = useState(0);
  const [voiceFeedbackEnabled, setVoiceFeedbackEnabled] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastApplied, setLastApplied] = useState<AppliedChangeRecord | null>(null);

  const recorderRef = useRef<VoiceRecorderHelper | null>(null);
  const latestBudgetsRef = useRef(categoryBudgets);
  const voiceFeedbackRef = useRef(voiceFeedbackEnabled);

  useEffect(() => {
    latestBudgetsRef.current = categoryBudgets;
  }, [categoryBudgets]);

  useEffect(() => {
    voiceFeedbackRef.current = voiceFeedbackEnabled;
  }, [voiceFeedbackEnabled]);

  useEffect(() => {
    return () => {
      if (recorderRef.current?.isListening) {
        recorderRef.current.stopListening().catch(() => {});
      }
    };
  }, []);

  const livePreview: ParsedBudgetCommand | null = useMemo(() => {
    if (!commandText.trim()) return null;
    return parseBudgetVoiceCommand(commandText, categoryBudgets);
  }, [commandText, categoryBudgets]);

  const totalBudget = useMemo(
    () =>
      Object.values(categoryBudgets).reduce(
        (sum: number, val: number) => sum + (Number(val) || 0),
        0
      ),
    [categoryBudgets]
  );

  const executeCommand = (rawInput: string): boolean => {
    const currentBudgets = latestBudgetsRef.current;
    const parsed = parseBudgetVoiceCommand(rawInput, currentBudgets);

    if (!parsed.matched || !parsed.category || parsed.newAmount === undefined || !parsed.categoryLabel) {
      setErrorMessage(
        parsed.errorReason ||
          'No se pudo interpretar el comando. Prueba: "Update my food budget to $500".'
      );
      return false;
    }

    const previousSnapshot = { ...currentBudgets };
    const updatedBudgets = {
      ...currentBudgets,
      [parsed.category]: parsed.newAmount,
    };

    onUpdateCategoryBudgets(updatedBudgets);

    setErrorMessage(null);
    setLastApplied({
      commandText: rawInput.trim(),
      category: parsed.category,
      categoryLabel: parsed.categoryLabel,
      previousAmount: parsed.previousAmount ?? 0,
      newAmount: parsed.newAmount,
      delta: parsed.delta ?? 0,
      previousBudgetsSnapshot: previousSnapshot,
      appliedAt: Date.now(),
    });

    if (voiceFeedbackRef.current) {
      const spokenMsg =
        speechLang === 'en-US'
          ? `Updated ${parsed.categoryLabel} budget to ${profile.currencySymbol}${parsed.newAmount}.`
          : `Presupuesto de ${parsed.categoryLabel} actualizado a ${profile.currencySymbol}${parsed.newAmount}.`;
      playAssistantVoice(spokenMsg).catch(() => {});
    }

    return true;
  };

  const stopRecordingAndProcess = async (applyTranscriptIfValid: boolean) => {
    const recorder = recorderRef.current;
    if (!recorder) {
      setIsListening(false);
      setMicVolume(0);
      return;
    }

    setIsListening(false);
    setMicVolume(0);
    const blob = await recorder.stopListening();

    if (!recorder.supportsNativeRecognition && blob && blob.size > 0) {
      setIsTranscribing(true);
      try {
        const transcript = await transcribeAudioBlob(blob);
        if (transcript.trim()) {
          setCommandText(transcript.trim());
          if (applyTranscriptIfValid) {
            executeCommand(transcript.trim());
          }
        } else {
          setErrorMessage('No se detectó voz en la grabación. Intenta de nuevo.');
        }
      } catch {
        setErrorMessage('Error al transcribir el audio. También puedes escribir el comando.');
      } finally {
        setIsTranscribing(false);
      }
    }
  };

  const handleToggleListening = async () => {
    if (isListening) {
      await stopRecordingAndProcess(true);
      return;
    }

    setErrorMessage(null);
    if (!recorderRef.current) {
      recorderRef.current = new VoiceRecorderHelper();
    }

    let handledFinal = false;
    let hadError = false;

    const started = await recorderRef.current.startListening(
      (interimText) => {
        setCommandText(interimText);
      },
      (finalText) => {
        setCommandText(finalText);
        if (handledFinal) return;
        const testParse = parseBudgetVoiceCommand(finalText, latestBudgetsRef.current);
        if (testParse.matched) {
          handledFinal = true;
          const ok = executeCommand(finalText);
          if (ok) {
            stopRecordingAndProcess(false).catch(() => {});
          }
        }
      },
      (volume) => {
        setMicVolume(volume);
      },
      (err) => {
        hadError = true;
        setErrorMessage(err);
        setIsListening(false);
        setMicVolume(0);
      },
      speechLang
    );

    if (started && !hadError) {
      setIsListening(true);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commandText.trim()) return;
    const ok = executeCommand(commandText);
    if (ok) {
      setCommandText('');
    }
  };

  const handleTriggerExample = (example: string) => {
    setCommandText(example);
    setErrorMessage(null);
    executeCommand(example);
  };

  const handleUndo = () => {
    if (!lastApplied) return;
    onUpdateCategoryBudgets(lastApplied.previousBudgetsSnapshot);
    setLastApplied(null);
    setErrorMessage(null);
  };

  const cardSurfaceClass = isNitido
    ? 'bg-white border border-slate-200 shadow-sm'
    : isVibrant
    ? 'bg-[#0a1228] border border-cyan-400/40 shadow-xl shadow-cyan-950/20'
    : 'bg-slate-900 border border-slate-800 shadow-lg';

  const inputSurfaceClass = isNitido
    ? 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-cyan-600 focus:bg-white'
    : 'bg-slate-950/70 border-slate-700 text-white placeholder-slate-500 focus:border-cyan-400';

  return (
    <section
      aria-label="Comando rápido de presupuesto por voz"
      className={`p-5 sm:p-6 rounded-3xl transition-colors ${cardSurfaceClass}`}
    >
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-start sm:items-center gap-3">
          <div
            className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${
              isListening
                ? 'bg-rose-600 text-white border-rose-500'
                : isNitido
                ? 'bg-cyan-50 text-cyan-700 border-cyan-200'
                : 'bg-cyan-500/15 text-cyan-300 border-cyan-400/30'
            }`}
          >
            <Mic className="w-5 h-5" />
          </div>
          <div>
            <h3
              className={`text-base font-bold tracking-tight ${
                isNitido ? 'text-slate-900' : 'text-white'
              }`}
            >
              Comando Rápido de Presupuesto por Voz
            </h3>
            <p
              className={`text-xs mt-0.5 ${
                isNitido ? 'text-slate-600' : 'text-slate-400'
              }`}
            >
              Actualiza cualquier categoría diciendo o escribiendo:{' '}
              <span className={`font-semibold ${isNitido ? 'text-slate-800' : 'text-slate-200'}`}>
                &ldquo;Update my food budget to $500&rdquo;
              </span>
            </p>
          </div>
        </div>

        {/* Language & Audio Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <div
            className={`inline-flex rounded-xl p-0.5 border ${
              isNitido
                ? 'bg-slate-100 border-slate-200'
                : 'bg-slate-950/70 border-slate-700'
            }`}
            role="group"
            aria-label="Idioma de reconocimiento de voz"
          >
            <button
              type="button"
              onClick={() => setSpeechLang('en-US')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                speechLang === 'en-US'
                  ? isNitido
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'bg-cyan-500/25 text-cyan-200'
                  : isNitido
                  ? 'text-slate-600 hover:text-slate-900'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => setSpeechLang('es-ES')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                speechLang === 'es-ES'
                  ? isNitido
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'bg-cyan-500/25 text-cyan-200'
                  : isNitido
                  ? 'text-slate-600 hover:text-slate-900'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              ES
            </button>
          </div>

          <button
            type="button"
            onClick={() => setVoiceFeedbackEnabled((prev) => !prev)}
            title={
              voiceFeedbackEnabled
                ? 'Confirmación hablada activada'
                : 'Confirmación hablada desactivada'
            }
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border whitespace-nowrap shrink-0 transition-colors ${
              voiceFeedbackEnabled
                ? isNitido
                  ? 'bg-cyan-50 text-cyan-800 border-cyan-200'
                  : 'bg-cyan-500/20 text-cyan-200 border-cyan-400/40'
                : isNitido
                ? 'bg-slate-50 text-slate-600 border-slate-200 hover:text-slate-900'
                : 'bg-slate-800/70 text-slate-400 border-slate-700 hover:text-white'
            }`}
          >
            {voiceFeedbackEnabled ? (
              <Volume2 className="w-3.5 h-3.5" />
            ) : (
              <VolumeX className="w-3.5 h-3.5" />
            )}
            <span>{voiceFeedbackEnabled ? 'Voz ON' : 'Voz OFF'}</span>
          </button>

          {onJumpToBudgets && (
            <button
              type="button"
              onClick={onJumpToBudgets}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border whitespace-nowrap shrink-0 transition-colors ${
                isNitido
                  ? 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  : 'bg-slate-800/70 text-slate-200 border-slate-700 hover:bg-slate-800'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Ver presupuestos</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Command Input + Mic Trigger */}
      <form onSubmit={handleFormSubmit} className="flex flex-col sm:flex-row gap-2.5">
        <button
          type="button"
          onClick={handleToggleListening}
          disabled={isTranscribing}
          className={`inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-sm font-bold whitespace-nowrap shrink-0 transition-all border ${
            isListening
              ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-500 shadow-sm'
              : isNitido
              ? 'bg-slate-900 hover:bg-slate-800 text-white border-slate-900 shadow-sm'
              : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 border-cyan-400 shadow-sm'
          } disabled:opacity-60`}
        >
          {isTranscribing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Procesando audio...</span>
            </>
          ) : isListening ? (
            <>
              <Square className="w-4 h-4 fill-current" />
              <span>Detener escucha</span>
            </>
          ) : (
            <>
              <Mic className="w-4 h-4" />
              <span>Dictar comando</span>
            </>
          )}
        </button>

        <div className="relative flex-1 min-w-0">
          <input
            type="text"
            value={commandText}
            onChange={(e) => {
              setCommandText(e.target.value);
              if (errorMessage) setErrorMessage(null);
            }}
            placeholder='Ej: "Update my food budget to $500" o "Sube transporte en $50"'
            aria-label="Comando de presupuesto por voz o texto"
            className={`w-full px-4 py-3 pr-10 rounded-2xl border text-sm outline-none transition-colors ${inputSurfaceClass}`}
          />
          {commandText && (
            <button
              type="button"
              onClick={() => {
                setCommandText('');
                setErrorMessage(null);
              }}
              aria-label="Limpiar comando"
              className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold px-1.5 py-0.5 rounded-md ${
                isNitido
                  ? 'text-slate-400 hover:text-slate-700'
                  : 'text-slate-500 hover:text-slate-200'
              }`}
            >
              ✕
            </button>
          )}
        </div>

        <button
          type="submit"
          disabled={!commandText.trim() || isTranscribing}
          className={`inline-flex items-center justify-center gap-1.5 px-5 py-3 rounded-2xl text-sm font-bold whitespace-nowrap shrink-0 transition-colors border ${
            isNitido
              ? 'bg-cyan-600 hover:bg-cyan-700 text-white border-cyan-600 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200'
              : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 border-emerald-400 disabled:bg-slate-800 disabled:text-slate-500 disabled:border-slate-700'
          }`}
        >
          <Send className="w-4 h-4" />
          <span>Aplicar</span>
        </button>
      </form>

      {/* Live Audio Level Bar while Listening */}
      {isListening && (
        <div
          className={`mt-3 px-3.5 py-2.5 rounded-2xl border flex items-center gap-3 ${
            isNitido
              ? 'bg-rose-50/70 border-rose-200 text-rose-900'
              : 'bg-rose-950/30 border-rose-500/30 text-rose-200'
          }`}
        >
          <span className="text-xs font-bold whitespace-nowrap">
            Escuchando ({speechLang === 'en-US' ? 'Inglés' : 'Español'}):
          </span>
          <div
            className={`flex-1 h-2 rounded-full overflow-hidden ${
              isNitido ? 'bg-rose-100' : 'bg-slate-800'
            }`}
          >
            <div
              className="h-full bg-rose-500 transition-all duration-75 rounded-full"
              style={{ width: `${Math.max(8, Math.round(micVolume * 100))}%` }}
            />
          </div>
          <span className="text-xs font-medium whitespace-nowrap">
            Di tu instrucción clara
          </span>
        </div>
      )}

      {/* Live Intent Preview while Typing/Speaking */}
      {livePreview && !errorMessage && (
        <div
          className={`mt-3 px-3.5 py-2.5 rounded-2xl border flex flex-wrap items-center justify-between gap-2 text-xs ${
            livePreview.matched
              ? isNitido
                ? 'bg-cyan-50/70 border-cyan-200 text-cyan-950'
                : 'bg-cyan-950/40 border-cyan-400/30 text-cyan-100'
              : isNitido
              ? 'bg-slate-50 border-slate-200 text-slate-600'
              : 'bg-slate-800/50 border-slate-700 text-slate-300'
          }`}
        >
          {livePreview.matched && livePreview.categoryLabel ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold">Intención detectada:</span>
                <span className="font-semibold">{livePreview.categoryLabel}</span>
                <span className="inline-flex items-center gap-1.5 font-bold tabular-nums">
                  <span>
                    {profile.currencySymbol}
                    {(livePreview.previousAmount ?? 0).toLocaleString()}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 opacity-70" />
                  <span>
                    {profile.currencySymbol}
                    {(livePreview.newAmount ?? 0).toLocaleString()}
                  </span>
                  <span
                    className={
                      (livePreview.delta ?? 0) >= 0
                        ? isNitido
                          ? 'text-emerald-700'
                          : 'text-emerald-400'
                        : isNitido
                        ? 'text-amber-700'
                        : 'text-amber-300'
                    }
                  >
                    ({(livePreview.delta ?? 0) >= 0 ? '+' : '-'}
                    {profile.currencySymbol}
                    {Math.abs(livePreview.delta ?? 0).toLocaleString()})
                  </span>
                </span>
              </div>
              <span className="text-[11px] font-semibold opacity-80 whitespace-nowrap">
                Presiona Enter o &ldquo;Aplicar&rdquo;
              </span>
            </>
          ) : (
            <span>{livePreview.errorReason}</span>
          )}
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div
          role="alert"
          className={`mt-3 px-3.5 py-2.5 rounded-2xl border flex items-center gap-2 text-xs font-medium ${
            isNitido
              ? 'bg-amber-50 border-amber-200 text-amber-900'
              : 'bg-amber-950/40 border-amber-500/30 text-amber-200'
          }`}
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Applied Confirmation Banner + 1-Click Undo */}
      {lastApplied && (
        <div
          role="status"
          className={`mt-3 px-4 py-3 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            isNitido
              ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
              : 'bg-emerald-950/40 border-emerald-500/35 text-emerald-100'
          }`}
        >
          <div className="flex items-start sm:items-center gap-2.5">
            <CheckCircle2
              className={`w-4 h-4 mt-0.5 sm:mt-0 shrink-0 ${
                isNitido ? 'text-emerald-700' : 'text-emerald-400'
              }`}
            />
            <div className="text-xs leading-relaxed">
              <span className="font-bold">{lastApplied.categoryLabel}</span> actualizado:{' '}
              <span className="font-bold tabular-nums">
                {profile.currencySymbol}
                {lastApplied.previousAmount.toLocaleString()}
              </span>{' '}
              <ArrowRight className="w-3 h-3 inline mx-0.5" />{' '}
              <span className="font-extrabold tabular-nums">
                {profile.currencySymbol}
                {lastApplied.newAmount.toLocaleString()}
              </span>
              <span className="mx-2 opacity-60">•</span>
              <span className="opacity-90">
                Presupuesto total mensual:{' '}
                <strong className="tabular-nums">
                  {profile.currencySymbol}
                  {totalBudget.toLocaleString()}
                </strong>
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleUndo}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border whitespace-nowrap shrink-0 self-start sm:self-center transition-colors ${
              isNitido
                ? 'bg-white hover:bg-emerald-100/70 text-emerald-900 border-emerald-300'
                : 'bg-emerald-900/50 hover:bg-emerald-900 text-emerald-100 border-emerald-500/40'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Deshacer</span>
          </button>
        </div>
      )}

      {/* Quick One-Tap Examples */}
      <div
        className={`mt-4 pt-3 border-t flex flex-wrap items-center gap-2 ${
          isNitido ? 'border-slate-100' : 'border-slate-800'
        }`}
      >
        <span
          className={`text-[11px] font-bold uppercase tracking-wider mr-1 ${
            isNitido ? 'text-slate-500' : 'text-slate-400'
          }`}
        >
          Probar comando rápido:
        </span>
        {EXAMPLE_COMMANDS.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => handleTriggerExample(example)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border whitespace-nowrap transition-colors ${
              isNitido
                ? 'bg-slate-50 hover:bg-cyan-50 text-slate-700 hover:text-cyan-900 border-slate-200 hover:border-cyan-300'
                : 'bg-slate-800/70 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-200 border-slate-700 hover:border-cyan-400/40'
            }`}
          >
            {example}
          </button>
        ))}
      </div>
    </section>
  );
};
