import React, { useState } from 'react';
import {
  FolderOpen,
  Users,
  Upload,
  UserPlus,
  Sparkles,
  FileText,
  Image as ImageIcon,
  Tag,
  Calendar,
  HardDrive,
  Phone,
  Mail,
  CheckCircle2,
  X,
  ExternalLink,
  Search,
} from 'lucide-react';
import { DeviceFile, DeviceContact, NoteItem } from '../types';

interface DeviceGalleryTabProps {
  files: DeviceFile[];
  contacts: DeviceContact[];
  notes: NoteItem[];
  onAddFile: (file: DeviceFile) => void;
  onAddContact: (contact: DeviceContact) => void;
  onSelectFilePreview: (file: DeviceFile) => void;
  onOpenVoiceAssistantWithText: (text: string) => void;
}

export const DeviceGalleryTab: React.FC<DeviceGalleryTabProps> = ({
  files,
  contacts,
  notes,
  onAddFile,
  onAddContact,
  onSelectFilePreview,
  onOpenVoiceAssistantWithText,
}) => {
  const [activeSection, setActiveSection] = useState<'files' | 'contacts'>('files');
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddContactOpen, setIsAddContactOpen] = useState(false);

  // New contact form
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactRole, setContactRole] = useState('');
  const [contactNotes, setContactNotes] = useState('');
  const [contactCategory, setContactCategory] = useState<DeviceContact['category']>('servicios');

  // File Upload handling
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploaded = e.target.files?.[0];
    if (!uploaded) return;

    const isImg = uploaded.type.startsWith('image/');
    const reader = new FileReader();
    reader.onload = () => {
      const resultUrl = reader.result as string;
      const cleanName = uploaded.name;
      const newFile: DeviceFile = {
        id: `file-custom-${Date.now()}`,
        name: cleanName,
        type: isImg ? 'image' : 'document',
        size: `${(uploaded.size / (1024 * 1024)).toFixed(1)} MB`,
        url: isImg ? resultUrl : 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=600&auto=format&fit=crop&q=80',
        description: `Archivo subido por el usuario: ${cleanName}`,
        tags: cleanName.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(' ').filter((w) => w.length > 3),
        uploadDate: new Date().toISOString().split('T')[0],
        category: 'factura',
      };
      onAddFile(newFile);
    };
    reader.readAsDataURL(uploaded);
  };

  const handleCreateContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactName.trim()) return;

    const newContact: DeviceContact = {
      id: `contact-custom-${Date.now()}`,
      name: contactName.trim(),
      phone: contactPhone.trim() || 'Sin teléfono',
      email: contactEmail.trim() || 'sin-email@dispositivo.com',
      role: contactRole.trim() || 'Contacto General',
      notes: contactNotes.trim(),
      category: contactCategory,
    };

    onAddContact(newContact);
    setContactName('');
    setContactPhone('');
    setContactEmail('');
    setContactRole('');
    setContactNotes('');
    setIsAddContactOpen(false);
  };

  const filteredFiles = files.filter(
    (f) =>
      f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.tags.some((t) => t.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredContacts = contacts.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Banner explaining the Auto-Attachment engine */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Motor de Auto-Indexación & Escaneo Local</span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Galería del Dispositivo Móvil & Contactos
          </h2>
          <p className="text-xs text-slate-300 mt-1 leading-relaxed">
            Aquí reside la memoria documental de tu dispositivo. Cuando dictas o guardas una nota, <strong>AuraFin AI escanea este almacén automáticamente</strong> y vincula las fotos, facturas o contactos relevantes sin que tengas que buscarlos carpeta por carpeta.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* File input button */}
          <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs font-semibold cursor-pointer transition-colors">
            <Upload className="w-4 h-4 text-cyan-400" />
            <span>Subir Archivo o Foto</span>
            <input type="file" onChange={handleFileUpload} className="hidden" />
          </label>

          {/* Add contact button */}
          <button
            onClick={() => setIsAddContactOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white text-xs font-semibold shadow-md transition-all"
          >
            <UserPlus className="w-4 h-4" />
            <span>Nuevo Contacto</span>
          </button>
        </div>
      </div>

      {/* Switcher & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveSection('files')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeSection === 'files'
                ? 'bg-cyan-500 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <FolderOpen className="w-4 h-4" />
            <span>Galería de Archivos ({files.length})</span>
          </button>

          <button
            onClick={() => setActiveSection('contacts')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeSection === 'contacts'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Agenda de Contactos ({contacts.length})</span>
          </button>
        </div>

        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder={activeSection === 'files' ? 'Buscar archivo o recibo...' : 'Buscar persona o rol...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
        </div>
      </div>

      {/* SECTION: FILES */}
      {activeSection === 'files' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredFiles.map((file) => {
            const isImg = file.type === 'image' || file.type === 'receipt';
            const attachedNotes = notes.filter((n) => n.matchedFileIds?.includes(file.id));

            return (
              <div
                key={file.id}
                className="bg-slate-900 rounded-2xl border border-slate-800 hover:border-slate-700/80 p-4 flex flex-col justify-between shadow-md transition-all group"
              >
                <div className="space-y-3">
                  {/* Thumbnail / Header */}
                  <div
                    onClick={() => onSelectFilePreview(file)}
                    className="cursor-pointer relative rounded-xl overflow-hidden bg-slate-950 border border-slate-800 h-40 flex items-center justify-center group-hover:border-cyan-500/40 transition-colors"
                  >
                    {isImg ? (
                      <img
                        src={file.url}
                        alt={file.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="p-4 text-center flex flex-col items-center">
                        <FileText className="w-10 h-10 text-indigo-400 mb-2" />
                        <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                          Documento PDF
                        </span>
                      </div>
                    )}
                    <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-950/80 backdrop-blur-md text-white border border-white/10">
                      {file.size}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-white truncate group-hover:text-cyan-300 transition-colors">
                      {file.name}
                    </h4>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                      {file.description}
                    </p>
                  </div>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1">
                    {file.tags.slice(0, 4).map((tag, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Footer with Auto-Attachment Status */}
                <div className="pt-3 mt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                  <div className="text-slate-400">
                    {attachedNotes.length > 0 ? (
                      <span className="text-cyan-400 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Auto-vinculado en {attachedNotes.length} nota(s)
                      </span>
                    ) : (
                      <span>Disponible para vincular</span>
                    )}
                  </div>

                  <button
                    onClick={() =>
                      onOpenVoiceAssistantWithText(
                        `Nota sobre ${file.name.replace(/_/g, ' ')}:`
                      )
                    }
                    title="Dictar nota sobre este archivo"
                    className="text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1 hover:underline"
                  >
                    <Sparkles className="w-3 h-3" /> Dictar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* SECTION: CONTACTS */}
      {activeSection === 'contacts' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredContacts.map((contact) => {
            const attachedNotes = notes.filter((n) => n.matchedContactIds?.includes(contact.id));

            return (
              <div
                key={contact.id}
                className="bg-slate-900 rounded-2xl border border-slate-800 hover:border-slate-700/80 p-5 flex flex-col justify-between shadow-md space-y-4"
              >
                <div className="flex items-start gap-3.5">
                  {contact.avatar ? (
                    <img
                      src={contact.avatar}
                      alt={contact.name}
                      className="w-12 h-12 rounded-2xl object-cover shrink-0 border border-slate-700"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center font-bold text-base shrink-0 border border-cyan-500/20">
                      {contact.name.charAt(0)}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-bold text-white truncate">{contact.name}</h4>
                    <span className="text-xs font-semibold text-cyan-400 block truncate">
                      {contact.role}
                    </span>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">{contact.notes}</p>
                  </div>
                </div>

                <div className="space-y-1.5 bg-slate-950/50 p-3 rounded-xl border border-slate-800 text-xs text-slate-300">
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="font-mono text-[11px] truncate">{contact.phone}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate text-[11px]">{contact.email}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">
                    {attachedNotes.length > 0 ? (
                      <span className="text-emerald-400 font-semibold">
                        {attachedNotes.length} nota(s) vinculada(s)
                      </span>
                    ) : (
                      'Agenda local'
                    )}
                  </span>

                  <button
                    onClick={() =>
                      onOpenVoiceAssistantWithText(
                        `Hablé con ${contact.name} (${contact.role}) sobre:`
                      )
                    }
                    className="text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" /> Asociar en nota
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Crear Contacto */}
      {isAddContactOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-cyan-400" />
                Añadir Contacto al Dispositivo
              </h3>
              <button onClick={() => setIsAddContactOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateContact} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Nombre Completo</label>
                <input
                  type="text"
                  placeholder="Ej: Lic. Roberto Gómez"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:ring-2 focus:ring-cyan-500/40 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Rol / Especialidad</label>
                <input
                  type="text"
                  placeholder="Ej: Mecánico, Asesor Inmobiliario, Arrendador..."
                  value={contactRole}
                  onChange={(e) => setContactRole(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:ring-2 focus:ring-cyan-500/40 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Teléfono</label>
                  <input
                    type="text"
                    placeholder="+52 55 ..."
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:ring-2 focus:ring-cyan-500/40 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="correo@..."
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:ring-2 focus:ring-cyan-500/40 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Notas o Detalles Clave</label>
                <textarea
                  rows={2}
                  placeholder="Ej: Encargado de mantenimientos del auto, precios con descuento..."
                  value={contactNotes}
                  onChange={(e) => setContactNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:ring-2 focus:ring-cyan-500/40 focus:outline-none resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddContactOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-white font-semibold text-xs shadow-md"
                >
                  Guardar Contacto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
