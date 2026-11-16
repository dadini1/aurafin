import React, { useState } from 'react';
import {
  Search,
  Plus,
  Sparkles,
  Paperclip,
  User,
  Tag,
  Pin,
  Trash2,
  Volume2,
  Calendar,
  FileText,
  DollarSign,
  Phone,
  Mail,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Target,
  FileSpreadsheet,
} from 'lucide-react';
import { NoteItem, DeviceFile, DeviceContact, UserFinancialProfile } from '../types';
import { playAssistantVoice } from '../services/geminiService';
import { exportFinancialDataToCSV } from '../utils/financialDataExporter';
import { useTheme } from '../context/ThemeContext';

interface NotesTabProps {
  notes: NoteItem[];
  availableFiles: DeviceFile[];
  availableContacts: DeviceContact[];
  profile: UserFinancialProfile;
  onOpenVoiceAssistant: (initialText?: string) => void;
  onDeleteNote: (id: string) => void;
  onTogglePin: (id: string) => void;
  onSelectFilePreview: (file: DeviceFile, reason?: string) => void;
  voiceAudioEnabled: boolean;
}

export const NotesTab: React.FC<NotesTabProps> = ({
  notes,
  availableFiles,
  availableContacts,
  profile,
  onOpenVoiceAssistant,
  onDeleteNote,
  onTogglePin,
  onSelectFilePreview,
  voiceAudioEnabled,
}) => {
  const { isNitido, isVibrant } = useTheme();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('todos');
  const [expandedNoteIds, setExpandedNoteIds] = useState<Record<string, boolean>>({});
  const [notesNotification, setNotesNotification] = useState<string | null>(null);

  // Collect all unique tags
  const allTags = Array.from(
    new Set(
      notes.flatMap((n) => n.tags || []).map((t) => (t.startsWith('#') ? t : `#${t}`))
    )
  );

  // Filter notes
  const filteredNotes = notes.filter((note) => {
    const matchesSearch =
      note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      note.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      note.formattedContent.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (note.tags && note.tags.some((t) => t.toLowerCase().includes(searchTerm.toLowerCase())));

    const matchesTag =
      selectedTag === 'todos' ||
      (note.tags && note.tags.some((t) => t.toLowerCase() === selectedTag.toLowerCase()));

    return matchesSearch && matchesTag;
  });

  const toggleExpand = (id: string) => {
    setExpandedNoteIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSpeakNote = (text: string) => {
    playAssistantVoice(text);
  };

  const handleExportNotesCSV = () => {
    const { totalRecords, filename } = exportFinancialDataToCSV(
      [],
      [],
      notes,
      profile,
      {},
      {
        includePayments: false,
        includeSavingsGoals: false,
        includeNotes: true,
        includeSavingsStrategy: false,
        includeProfileSummary: true,
      }
    );
    setNotesNotification(`¡${totalRecords} notas exportadas exitosamente a ${filename}!`);
    setTimeout(() => setNotesNotification(null), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notesNotification && (
        <div className="p-3 bg-emerald-950/80 border border-emerald-500/40 rounded-2xl text-emerald-300 text-xs font-semibold flex items-center justify-between animate-fadeIn">
          <span>{notesNotification}</span>
          <button onClick={() => setNotesNotification(null)} className="text-emerald-400 hover:text-white ml-2">✕</button>
        </div>
      )}

      {/* Top Action Banner */}
      <div className={`relative overflow-hidden rounded-3xl p-6 sm:p-8 shadow-xl border ${
        isNitido
          ? 'bg-gradient-to-r from-cyan-50 via-indigo-50/70 to-fuchsia-50/80 border-indigo-200/90 shadow-indigo-500/5'
          : 'bg-gradient-to-r from-slate-900 via-indigo-950/70 to-slate-900 border-slate-800'
      }`}>
        <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-3 border ${
              isNitido 
                ? 'bg-cyan-100 text-cyan-800 border-cyan-300' 
                : 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
            }`}>
              <Sparkles className="w-3.5 h-3.5 text-cyan-500" />
              <span>Organización Automática con Auto-Adjuntos</span>
            </div>
            <h2 className={`text-xl sm:text-2xl font-black tracking-tight ${isNitido ? 'text-slate-900' : 'text-white'}`}>
              Tus Notas & Archivos Móviles Inteligentes
            </h2>
            <p className={`text-xs sm:text-sm mt-1 leading-relaxed ${isNitido ? 'text-slate-600' : 'text-slate-300'}`}>
              Habla o dicta lo que hiciste o necesitas. AuraFin AI clasificará la nota, le asignará etiquetas y buscará en tu galería y contactos para adjuntar recibos, fotos y personas sin que tengas que buscarlos.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap sm:flex-nowrap">
            <button
              onClick={handleExportNotesCSV}
              className={`flex items-center gap-2 px-4 py-3 rounded-2xl font-bold text-xs sm:text-sm shadow-md active:scale-95 transition-all border ${
                isNitido
                  ? 'bg-white hover:bg-slate-50 text-slate-700 hover:text-emerald-700 border-slate-200'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-emerald-300 border-slate-700/80'
              }`}
              title="Descargar notas y transcripciones en CSV estructurado"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
              <span>Exportar Notas (CSV)</span>
            </button>

            <button
              onClick={() => onOpenVoiceAssistant()}
              className="flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 via-indigo-600 to-violet-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-sm shadow-xl shadow-cyan-500/25 active:scale-95 transition-all text-white-fixed"
            >
              <Sparkles className="w-4 h-4 text-cyan-200" />
              <span>Dictar Nueva Nota por Voz</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter Bar & Search */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              id="notes-search"
              name="notes-search"
              aria-label="Buscar notas por texto, etiqueta, gasto o contacto"
              placeholder="Buscar por texto, etiqueta, gasto o contacto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-xs sm:text-sm transition-all focus:outline-none focus:ring-2 focus:ring-cyan-500/40 border ${
                isNitido
                  ? 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 shadow-xs'
                  : 'bg-slate-900 border-slate-800 text-slate-200 placeholder-slate-500'
              }`}
            />
          </div>

          {/* Quick Create Text Button */}
          <button
            onClick={() => onOpenVoiceAssistant(' ')}
            className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-colors border ${
              isNitido
                ? 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-xs'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border-slate-700/80'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>Escribir Nota</span>
          </button>
        </div>

        {/* Smart Tags Horizontal Filter */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 no-scrollbar">
          <button
            onClick={() => setSelectedTag('todos')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all ${
              selectedTag === 'todos'
                ? 'bg-gradient-to-r from-cyan-500 to-indigo-600 text-white shadow-md text-white-fixed'
                : isNitido
                ? 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            #Todos ({notes.length})
          </button>

          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setSelectedTag(tag)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all ${
                selectedTag.toLowerCase() === tag.toLowerCase()
                  ? 'bg-gradient-to-r from-indigo-600 to-fuchsia-600 text-white shadow-md text-white-fixed'
                  : isNitido
                  ? 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Notes Grid */}
      {filteredNotes.length === 0 ? (
        <div className="p-12 text-center bg-slate-900/60 rounded-3xl border border-slate-800/80 space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
            <FileText className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">No se encontraron notas</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
              Prueba con otro término de búsqueda o presiona el botón para dictar tu primera nota con voz.
            </p>
          </div>
          <button
            onClick={() => onOpenVoiceAssistant()}
            className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-white font-semibold text-xs transition-colors"
          >
            Dictar Ahora
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredNotes.map((note) => {
            const isExpanded = !!expandedNoteIds[note.id];
            const matchedFiles = availableFiles.filter((f) =>
              note.matchedFileIds?.includes(f.id)
            );
            const matchedContacts = availableContacts.filter((c) =>
              note.matchedContactIds?.includes(c.id)
            );

            return (
              <div
                key={note.id}
                className={`flex flex-col justify-between rounded-2xl border transition-all ${
                  isNitido
                    ? note.isPinned
                      ? 'bg-white border-indigo-400 shadow-md shadow-indigo-500/10'
                      : 'bg-white border-slate-200 hover:border-cyan-400 shadow-sm hover:shadow-md'
                    : note.isPinned
                    ? 'bg-slate-900/90 border-indigo-500/40 shadow-lg shadow-indigo-500/10'
                    : 'bg-slate-900/90 border-slate-800 hover:border-slate-700/80 shadow-md'
                }`}
              >
                {/* Note Top Bar */}
                <div className="p-5 pb-3">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {note.intent && (
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${
                          note.intent === 'transaccion'
                            ? isNitido ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                            : note.intent === 'meta_ahorro'
                            ? isNitido ? 'bg-cyan-100 text-cyan-800 border-cyan-300' : 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                            : note.intent === 'consulta'
                            ? isNitido ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                            : isNitido ? 'bg-indigo-100 text-indigo-800 border-indigo-300' : 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                        }`}>
                          {note.intent === 'transaccion'
                            ? '💳 Transacción'
                            : note.intent === 'meta_ahorro'
                            ? '🎯 Meta de Ahorro'
                            : note.intent === 'consulta'
                            ? '💡 Consulta'
                            : '📝 Nota'}
                        </span>
                      )}
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border ${
                        isNitido ? 'bg-slate-100 text-slate-700 border-slate-200' : 'bg-slate-800 text-slate-300 border border-slate-700/60'
                      }`}>
                        {note.category}
                      </span>
                      {note.linkedPaymentId && (
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                          isNitido ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                        }`}>
                          <DollarSign className="w-3 h-3" /> Pago en Finanzas
                        </span>
                      )}
                      {note.linkedGoalId && (
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                          isNitido ? 'bg-cyan-100 text-cyan-800 border-cyan-300' : 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                        }`}>
                          <Target className="w-3 h-3" /> Meta de Ahorro
                        </span>
                      )}
                      {note.isPinned && (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          isNitido ? 'bg-indigo-100 text-indigo-800 border-indigo-300' : 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                        }`}>
                          Fijada
                        </span>
                      )}
                    </div>

                    <div className={`flex items-center gap-1 ${isNitido ? 'text-slate-500' : 'text-slate-400'}`}>
                      <button
                        onClick={() => handleSpeakNote(note.formattedContent || note.content)}
                        title="Escuchar nota con voz de IA"
                        className={`p-1.5 rounded-lg transition-colors ${isNitido ? 'hover:text-cyan-700 hover:bg-slate-100' : 'hover:text-cyan-300 hover:bg-slate-800'}`}
                      >
                        <Volume2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onTogglePin(note.id)}
                        title={note.isPinned ? 'Desfijar nota' : 'Fijar nota'}
                        className={`p-1.5 rounded-lg transition-colors ${
                          note.isPinned ? 'text-indigo-600' : isNitido ? 'hover:text-slate-800 hover:bg-slate-100' : 'hover:text-slate-200 hover:bg-slate-800'
                        }`}
                      >
                        <Pin className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDeleteNote(note.id)}
                        title="Eliminar nota"
                        className={`p-1.5 rounded-lg transition-colors ${isNitido ? 'hover:text-rose-600 hover:bg-rose-50' : 'hover:text-rose-400 hover:bg-slate-800'}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <h3 className={`text-base font-bold mb-2 leading-snug ${isNitido ? 'text-slate-900' : 'text-white'}`}>
                    {note.title}
                  </h3>

                  <p className={`text-xs sm:text-sm leading-relaxed ${isNitido ? 'text-slate-600' : 'text-slate-300'}`}>
                    {note.formattedContent || note.content}
                  </p>

                  {/* Smart Tags */}
                  {note.tags && note.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {note.tags.map((tag, idx) => (
                        <button
                          key={idx}
                          onClick={() => setSelectedTag(tag)}
                          className={`text-[11px] font-medium px-2.5 py-1 rounded-md transition-colors border ${
                            isNitido
                              ? 'bg-cyan-50/80 hover:bg-cyan-100 text-cyan-800 border-cyan-200'
                              : 'bg-slate-800/90 hover:bg-slate-700 text-cyan-300 border-slate-700/60'
                          }`}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* AUTO-ATTACHED SECTION (FILES & CONTACTS) */}
                {(matchedFiles.length > 0 || matchedContacts.length > 0) && (
                  <div className={`mx-4 my-2 p-3.5 rounded-2xl border space-y-2.5 ${
                    isNitido ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/70 border-cyan-900/30'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                        isNitido ? 'text-indigo-950' : 'text-cyan-400'
                      }`}>
                        <Sparkles className={`w-3.5 h-3.5 ${isNitido ? 'text-indigo-600' : 'text-cyan-400 animate-pulse'}`} />
                        Archivos y Contactos Auto-Adjuntados por IA
                      </span>
                      <span className={`text-[10px] ${isNitido ? 'text-slate-600' : 'text-slate-500'}`}>
                        {matchedFiles.length + matchedContacts.length} elementos
                      </span>
                    </div>

                    {/* Reasons explanation */}
                    {note.matchReasons && note.matchReasons.length > 0 && (
                      <div className={`text-[11px] px-2.5 py-1.5 rounded-xl border ${
                        isNitido ? 'text-slate-700 bg-white border-slate-200 font-medium' : 'text-slate-400 italic bg-cyan-950/20 border-cyan-800/20'
                      }`}>
                        💡 {note.matchReasons.join(' ')}
                      </div>
                    )}

                    {/* Matched Files Preview Chips */}
                    {matchedFiles.length > 0 && (
                      <div className="space-y-1.5">
                        <span className={`text-[10px] font-bold uppercase tracking-wider block ${
                          isNitido ? 'text-slate-600' : 'text-slate-400'
                        }`}>
                          Archivos / Facturas vinculados:
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {matchedFiles.map((file) => (
                            <div
                              key={file.id}
                              onClick={() =>
                                onSelectFilePreview(
                                  file,
                                  note.matchReasons?.find((r) => r.toLowerCase().includes(file.name.toLowerCase())) ||
                                    'Auto-adjuntado por contexto temático de la nota'
                                )
                              }
                              className={`group flex items-center gap-2 p-2 rounded-xl border cursor-pointer transition-all ${
                                isNitido
                                  ? 'bg-white hover:bg-slate-100 border-slate-200 hover:border-slate-300 shadow-xs'
                                  : 'bg-slate-900 hover:bg-slate-800 border-slate-800 hover:border-cyan-500/40'
                              }`}
                            >
                              {file.type === 'image' || file.type === 'receipt' ? (
                                <img
                                  src={file.url}
                                  alt={file.name}
                                  className="w-10 h-10 rounded-lg object-cover bg-slate-100 border border-slate-200 shrink-0"
                                />
                              ) : (
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border ${
                                  isNitido ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                                }`}>
                                  <FileText className="w-5 h-5" />
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <p className={`text-xs font-bold truncate ${
                                  isNitido ? 'text-slate-900 group-hover:text-indigo-700' : 'text-slate-200 group-hover:text-cyan-300'
                                }`}>
                                  {file.name}
                                </p>
                                <span className={`text-[10px] block ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
                                  {file.size} · Ver archivo
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Matched Contacts Chips */}
                    {matchedContacts.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <span className={`text-[10px] font-bold uppercase tracking-wider block ${
                          isNitido ? 'text-slate-600' : 'text-slate-400'
                        }`}>
                          Contactos asociados de la agenda:
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {matchedContacts.map((contact) => (
                            <div
                              key={contact.id}
                              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs ${
                                isNitido ? 'bg-white border-slate-200 text-slate-800 shadow-xs' : 'bg-slate-900 border-slate-800'
                              }`}
                            >
                              {contact.avatar ? (
                                <img
                                  src={contact.avatar}
                                  alt={contact.name}
                                  className="w-6 h-6 rounded-full object-cover shrink-0"
                                />
                              ) : (
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                                  isNitido ? 'bg-indigo-50 text-indigo-700' : 'bg-cyan-500/10 text-cyan-400'
                                }`}>
                                  <User className="w-3.5 h-3.5" />
                                </div>
                              )}
                              <div className="truncate">
                                <span className={`font-bold block truncate ${isNitido ? 'text-slate-900' : 'text-slate-200'}`}>
                                  {contact.name}
                                </span>
                                <span className={`text-[10px] block truncate ${isNitido ? 'text-slate-600' : 'text-slate-400'}`}>
                                  {contact.phone}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Note Footer */}
                <div className={`px-5 py-3 border-t flex items-center justify-between text-[11px] ${
                  isNitido ? 'border-slate-200 bg-slate-50/70 text-slate-600' : 'border-slate-800/80 bg-slate-900/40 text-slate-400'
                }`}>
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(note.createdAt).toLocaleDateString('es-ES', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>

                  {note.rawTranscript && note.rawTranscript !== note.formattedContent && (
                    <button
                      onClick={() => toggleExpand(note.id)}
                      className={`flex items-center gap-1 font-semibold transition-colors ${
                        isNitido ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span>{isExpanded ? 'Ocultar transcripción' : 'Ver dictado original'}</span>
                      {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  )}
                </div>

                {/* Raw Transcript Collapsible */}
                {isExpanded && note.rawTranscript && (
                  <div className={`px-5 py-3 border-t text-xs ${
                    isNitido ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}>
                    <span className={`font-bold block mb-1 ${isNitido ? 'text-slate-900' : 'text-slate-300'}`}>Transcripción original:</span>
                    &ldquo;{note.rawTranscript}&rdquo;
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
