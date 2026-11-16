import React, { useState, useMemo } from 'react';
import {
  Mic,
  TrendingUp,
  Smile,
  AlertTriangle,
  Minus,
  CheckCircle2,
  Clock,
  Sparkles,
  Volume2,
  Filter,
  CheckSquare,
  Square,
  ArrowRight,
  Calendar,
  Layers,
  FileText,
  DollarSign,
  Target,
  RefreshCw,
  Zap,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  PieChart,
  Pie,
  AreaChart,
  Area,
  CartesianGrid,
  Legend,
} from 'recharts';
import { NoteItem, PaymentItem, SavingsGoal, UserFinancialProfile } from '../types';
import {
  generateVoiceAnalytics,
  VoiceActionItem,
  VoiceTopicMetric,
  VoiceSentiment,
} from '../services/voiceAnalyticsService';
import { playAssistantVoice } from '../services/geminiService';
import { useTheme } from '../context/ThemeContext';

interface VoiceAnalyticsTabProps {
  notes: NoteItem[];
  profile: UserFinancialProfile;
  payments: PaymentItem[];
  goals: SavingsGoal[];
  onOpenVoiceAssistant: (initialText?: string) => void;
  onNavigateToTab?: (tab: 'notes' | 'finances') => void;
}

export const VoiceAnalyticsTab: React.FC<VoiceAnalyticsTabProps> = ({
  notes,
  profile,
  payments,
  goals,
  onOpenVoiceAssistant,
  onNavigateToTab,
}) => {
  const { isVibrant } = useTheme();

  // Time scope filter: 7, 30 (default), or 90 days
  const [selectedPeriod, setSelectedPeriod] = useState<number>(30);
  const [selectedTopicFilter, setSelectedTopicFilter] = useState<string | null>(null);
  const [actionItemFilter, setActionItemFilter] = useState<'todos' | 'pendientes' | 'completados'>('todos');
  const [completedActionIds, setCompletedActionIds] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('aurafin_completed_action_items');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [playingNoteId, setPlayingNoteId] = useState<string | null>(null);

  // Generate Voice Analytics Report
  const report = useMemo(() => {
    return generateVoiceAnalytics(notes, selectedPeriod);
  }, [notes, selectedPeriod]);

  // Handle action item toggle
  const toggleActionItem = (id: string) => {
    setCompletedActionIds((prev) => {
      const updated = { ...prev, [id]: !prev[id] };
      try {
        localStorage.setItem('aurafin_completed_action_items', JSON.stringify(updated));
      } catch (e) {
        console.warn('Error saving action items to localStorage:', e);
      }
      return updated;
    });
  };

  // Play audio of a note transcript using TTS
  const handlePlayAudio = (noteId: string, text: string) => {
    setPlayingNoteId(noteId);
    playAssistantVoice(text)
      .catch((e) => console.warn('TTS error:', e))
      .finally(() => setPlayingNoteId(null));
  };

  // Filtered action items with user completion state
  const augmentedActionItems = useMemo(() => {
    return report.actionItems.map((item) => ({
      ...item,
      isDone: completedActionIds[item.id] !== undefined ? completedActionIds[item.id] : item.status === 'completado',
    }));
  }, [report.actionItems, completedActionIds]);

  const filteredActionItems = useMemo(() => {
    return augmentedActionItems.filter((item) => {
      if (selectedTopicFilter && item.topic !== selectedTopicFilter) return false;
      if (actionItemFilter === 'pendientes') return !item.isDone;
      if (actionItemFilter === 'completados') return item.isDone;
      return true;
    });
  }, [augmentedActionItems, actionItemFilter, selectedTopicFilter]);

  const completedCount = augmentedActionItems.filter((i) => i.isDone).length;
  const completionRate = augmentedActionItems.length > 0 ? Math.round((completedCount / augmentedActionItems.length) * 100) : 0;

  // Sentiment Donut Data
  const sentimentDonutData = [
    { name: 'Positivo / Optimista', value: report.sentimentSummary.positiveCount, color: isVibrant ? '#00f59b' : '#10b981' },
    { name: 'Neutral / Informativo', value: report.sentimentSummary.neutralCount, color: isVibrant ? '#00d2ff' : '#06b6d4' },
    { name: 'Alerta / Preocupación', value: report.sentimentSummary.alertCount, color: isVibrant ? '#ff0080' : '#f43f5e' },
  ].filter((d) => d.value > 0);

  // Custom tooltip for topics
  const renderTopicTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as VoiceTopicMetric;
      return (
        <div className="bg-slate-950 p-3 rounded-2xl border border-slate-700 shadow-xl text-xs space-y-1">
          <p className="font-bold text-white flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: data.color }} />
            {data.label}
          </p>
          <p className="text-slate-300">
            Frecuencia: <span className="font-bold text-white">{data.count} notas</span> ({data.percentage}%)
          </p>
          {data.totalAmountMentioned > 0 && (
            <p className="text-emerald-400 font-bold">
              Dinero mencionado: {profile.currencySymbol}{data.totalAmountMentioned} {profile.currency}
            </p>
          )}
          <p className="text-slate-400 text-[10px] capitalize">
            Sentimiento dominante: <span className="font-semibold text-slate-200">{data.dominantSentiment}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-8 animate-fadeIn pb-24 sm:pb-12">
      {/* Top Banner / Hero Header */}
      <div className={`relative overflow-hidden rounded-3xl p-6 sm:p-8 border shadow-2xl transition-all ${
        isVibrant
          ? 'bg-gradient-to-r from-[#05071e] via-[#0d1538] to-[#1a0836] border-[#00f0ff]/30 shadow-[0_0_30px_rgba(0,210,255,0.15)]'
          : 'bg-gradient-to-r from-slate-900 via-indigo-950/70 to-slate-900 border-slate-800'
      }`}>
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 mb-3">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>Inteligencia de Voz & Minería de Hábitos</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Voice Analytics Dashboard
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 leading-relaxed">
              Analítica avanzada que extrae de tus notas de voz los temas más recurrentes, el índice de sentimiento emocional y las tareas accionables pendientes de los últimos {selectedPeriod} días.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            {/* Period Selector Tabs */}
            <div className="flex items-center bg-slate-950 p-1 rounded-2xl border border-slate-800 self-start sm:self-auto">
              {[
                { label: '7D', value: 7 },
                { label: '30 Días', value: 30 },
                { label: '90D', value: 90 },
              ].map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setSelectedPeriod(p.value)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    selectedPeriod === p.value
                      ? isVibrant
                        ? 'bg-gradient-to-r from-[#00d2ff] to-[#7928ca] text-white shadow-md'
                        : 'bg-cyan-500 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Launch Dictation CTA */}
            <button
              onClick={() => onOpenVoiceAssistant()}
              className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-white text-xs sm:text-sm font-bold shadow-xl transition-all active:scale-95 ${
                isVibrant
                  ? 'bg-gradient-to-r from-[#00d2ff] via-[#7928ca] to-[#ff0080] shadow-[0_0_20px_rgba(0,210,255,0.4)]'
                  : 'bg-gradient-to-r from-cyan-500 via-indigo-600 to-violet-600 hover:from-cyan-400'
              }`}
            >
              <Mic className="w-4 h-4" />
              <span>Dictar Nueva Nota</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Highlight Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Notes */}
        <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-300">Notas de Voz</span>
            <Mic className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-white">{report.totalNotesAnalyzed}</span>
              <span className="text-xs text-slate-400">en {selectedPeriod} días</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              ~{report.totalWordsDictated} palabras ({report.totalEstimatedAudioMinutes} min de audio)
            </p>
          </div>
        </div>

        {/* Sentiment Index */}
        <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">Índice de Sentimiento</span>
            <Smile className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-emerald-400">{report.sentimentSummary.score}/100</span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold">
                {report.sentimentSummary.positivePercent}% Positivo
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              {report.sentimentSummary.label}
            </p>
          </div>
        </div>

        {/* Action Items Resolution */}
        <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">Tareas Derivadas</span>
            <CheckCircle2 className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-white">{completedCount}/{augmentedActionItems.length}</span>
              <span className="text-xs text-indigo-400 font-bold">{completionRate}% resuelto</span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-cyan-400 to-indigo-500 h-full rounded-full transition-all"
                style={{ width: `${completionRate}%` }}
              />
            </div>
          </div>
        </div>

        {/* Automated Conversion Rate */}
        <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-300">Conversión a Finanzas</span>
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-amber-300">{report.conversionStats.conversionRate}%</span>
              <span className="text-xs text-slate-400">automatizado</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              {report.conversionStats.convertedToPayments} pagos y {report.conversionStats.convertedToGoals} metas generados
            </p>
          </div>
        </div>
      </div>

      {/* Primary Visualizations: Topics & Sentiment Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Most Common Topics Bar Chart (7 Cols) */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 p-5 sm:p-6 rounded-3xl shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                Temas Más Frecuentes (Most Common Topics)
              </h3>
              <p className="text-xs text-slate-400">
                Frecuencia y categorías extraídas por IA a partir de las notas de voz.
              </p>
            </div>
            {selectedTopicFilter && (
              <button
                onClick={() => setSelectedTopicFilter(null)}
                className="text-xs text-cyan-400 hover:text-white font-semibold flex items-center gap-1 self-start sm:self-auto"
              >
                <span>Mostrar todos</span>
                <span className="px-1.5 py-0.5 rounded-full bg-slate-800 text-[10px]">✕</span>
              </button>
            )}
          </div>

          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={report.topicMetrics}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                <XAxis type="number" stroke="#64748b" tick={{ fontSize: 11 }} />
                <YAxis
                  dataKey="label"
                  type="category"
                  stroke="#94a3b8"
                  tick={{ fontSize: 11, fontWeight: 600 }}
                  width={110}
                />
                <Tooltip content={renderTopicTooltip} />
                <Bar
                  dataKey="count"
                  radius={[0, 8, 8, 0]}
                  cursor="pointer"
                  onClick={(entry: any) => setSelectedTopicFilter(entry?.topic === selectedTopicFilter ? null : entry?.topic)}
                >
                  {report.topicMetrics.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.color}
                      opacity={selectedTopicFilter && selectedTopicFilter !== entry.topic ? 0.35 : 1}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Topics Chips with Money Tags */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-2 border-t border-slate-800">
            {report.topicMetrics.map((tm) => (
              <button
                key={tm.topic}
                onClick={() => setSelectedTopicFilter(tm.topic === selectedTopicFilter ? null : tm.topic)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all flex items-center gap-1.5 ${
                  selectedTopicFilter === tm.topic
                    ? 'ring-2 ring-cyan-400 bg-slate-800 text-white'
                    : 'bg-slate-950 text-slate-300 hover:bg-slate-800 border border-slate-800'
                }`}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tm.color }} />
                <span>{tm.label}</span>
                <span className="text-[10px] text-slate-400 font-bold">({tm.count})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Right: Sentiments Distribution & Donut (5 Cols) */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 p-5 sm:p-6 rounded-3xl shadow-xl space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Smile className="w-4 h-4 text-emerald-400" />
              Distribución de Sentimientos (Sentiments)
            </h3>
            <p className="text-xs text-slate-400">
              Tono emocional detectado en tus notas de voz en los últimos {selectedPeriod} días.
            </p>
          </div>

          {/* Donut Chart */}
          <div className="h-52 w-full relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={sentimentDonutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {sentimentDonutData.map((entry, idx) => (
                    <Cell key={`cell-${idx}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: any, name: any) => [`${val} notas`, name]}
                  contentStyle={{ backgroundColor: '#020617', borderColor: '#334155', borderRadius: '1rem', fontSize: '11px' }}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Inner Center Label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xl font-black text-white">{report.sentimentSummary.score}%</span>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider">Optimismo</span>
            </div>
          </div>

          {/* Sentiment Legend & Breakdown */}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800 text-center">
            <div className="p-2 rounded-xl bg-emerald-950/40 border border-emerald-500/20">
              <span className="text-[10px] text-emerald-400 font-bold block uppercase">Positivo</span>
              <span className="text-sm font-black text-white">{report.sentimentSummary.positiveCount} notas</span>
              <span className="text-[10px] text-slate-400 block">{report.sentimentSummary.positivePercent}%</span>
            </div>
            <div className="p-2 rounded-xl bg-cyan-950/40 border border-cyan-500/20">
              <span className="text-[10px] text-cyan-400 font-bold block uppercase">Neutral</span>
              <span className="text-sm font-black text-white">{report.sentimentSummary.neutralCount} notas</span>
              <span className="text-[10px] text-slate-400 block">{report.sentimentSummary.neutralPercent}%</span>
            </div>
            <div className="p-2 rounded-xl bg-rose-950/40 border border-rose-500/20">
              <span className="text-[10px] text-rose-400 font-bold block uppercase">Alerta</span>
              <span className="text-sm font-black text-white">{report.sentimentSummary.alertCount} notas</span>
              <span className="text-[10px] text-slate-400 block">{report.sentimentSummary.alertPercent}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* 30-Day Sentiment Evolution Timeline */}
      <div className="bg-slate-900 border border-slate-800 p-5 sm:p-6 rounded-3xl shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              Evolución del Sentimiento en los Últimos {selectedPeriod} Días
            </h3>
            <p className="text-xs text-slate-400">
              Tendencia de optimismo vs cautela en el registro de tus notas de voz.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              Positivo
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
              Neutral
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
              Alerta
            </span>
          </div>
        </div>

        <div className="h-60 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={report.sentimentTimeline} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorPositivo" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={isVibrant ? '#00f59b' : '#10b981'} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={isVibrant ? '#00f59b' : '#10b981'} stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="colorAlerta" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={isVibrant ? '#ff0080' : '#f43f5e'} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={isVibrant ? '#ff0080' : '#f43f5e'} stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="displayDate" stroke="#64748b" tick={{ fontSize: 11 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ backgroundColor: '#020617', borderColor: '#334155', borderRadius: '1rem', fontSize: '12px' }}
              />
              <Area
                type="monotone"
                dataKey="positivo"
                name="Notas Positivas"
                stroke={isVibrant ? '#00f59b' : '#10b981'}
                fillOpacity={1}
                fill="url(#colorPositivo)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="alerta"
                name="Notas con Alerta"
                stroke={isVibrant ? '#ff0080' : '#f43f5e'}
                fillOpacity={1}
                fill="url(#colorAlerta)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Action-Items Board (Acciones Derivadas de Notas de Voz) */}
      <div className="bg-slate-900 border border-slate-800 p-5 sm:p-6 rounded-3xl shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Tareas & Acciones Derivadas (Action-Items)
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                {completedCount}/{augmentedActionItems.length} Resueltas
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Acciones extraídas automáticamente por IA a partir de acuerdos, cotizaciones y recordatorios de voz.
            </p>
          </div>

          {/* Action items filter */}
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-2xl border border-slate-800 self-start sm:self-auto">
            <button
              onClick={() => setActionItemFilter('todos')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                actionItemFilter === 'todos' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Todas ({augmentedActionItems.length})
            </button>
            <button
              onClick={() => setActionItemFilter('pendientes')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                actionItemFilter === 'pendientes' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Pendientes ({augmentedActionItems.filter((i) => !i.isDone).length})
            </button>
            <button
              onClick={() => setActionItemFilter('completados')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                actionItemFilter === 'completados' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Completadas ({completedCount})
            </button>
          </div>
        </div>

        {/* Action Items List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredActionItems.map((item) => {
            const urgencyBadge =
              item.urgency === 'alta'
                ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                : item.urgency === 'media'
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                : 'bg-slate-700/30 text-slate-300 border-slate-600/30';

            return (
              <div
                key={item.id}
                className={`p-3.5 rounded-2xl border transition-all flex items-start gap-3 ${
                  item.isDone
                    ? 'bg-slate-950/40 border-slate-800/60 opacity-65'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleActionItem(item.id)}
                  className="mt-0.5 text-cyan-400 hover:text-cyan-300 transition-transform active:scale-90 shrink-0"
                >
                  {item.isDone ? (
                    <CheckSquare className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <Square className="w-5 h-5 text-slate-500 hover:text-cyan-400" />
                  )}
                </button>

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-bold leading-tight ${item.isDone ? 'line-through text-slate-400' : 'text-white'}`}>
                      {item.title}
                    </span>
                    <span className={`text-[9px] uppercase font-bold px-1.5 py-0.2 rounded border ${urgencyBadge}`}>
                      {item.urgency === 'alta' ? 'Urgente' : item.urgency === 'media' ? 'Moderada' : 'Normal'}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                    {item.description}
                  </p>

                  <div className="flex items-center justify-between pt-1 text-[10px] text-slate-500">
                    <span className="truncate">Fuente: {item.sourceNoteTitle}</span>
                    <button
                      type="button"
                      onClick={() => handlePlayAudio(item.id, `${item.title}. ${item.description}`)}
                      className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-semibold"
                      title="Escuchar audio / síntesis por voz"
                    >
                      <Volume2 className="w-3 h-3" />
                      <span>{playingNoteId === item.id ? 'Reproduciendo...' : 'Escuchar'}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filteredActionItems.length === 0 && (
          <div className="p-8 text-center text-slate-500 text-xs bg-slate-950/40 rounded-2xl border border-slate-800">
            No hay tareas en este filtro. Dicta una nueva nota para extraer más acciones automáticas.
          </div>
        )}
      </div>

      {/* Keywords Cloud and Insight Summary */}
      <div className="p-5 sm:p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          Términos Más Frecuentes Derivados de tu Voz
        </h3>
        <div className="flex flex-wrap gap-2">
          {report.commonKeywords.map((kw, idx) => {
            const colorClass =
              kw.sentiment === 'positivo'
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                : kw.sentiment === 'alerta'
                ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                : 'bg-slate-950 text-slate-300 border-slate-800';

            return (
              <span
                key={idx}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold border ${colorClass}`}
              >
                <span>#{kw.text}</span>
                <span className="text-[10px] opacity-75 font-bold bg-black/20 px-1.5 py-0.2 rounded-full">
                  {kw.count}
                </span>
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
};
