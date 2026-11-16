import React from 'react';
import { X, FileText, Download, ExternalLink, Calendar, Tag, HardDrive } from 'lucide-react';
import { DeviceFile } from '../types';

interface FilePreviewModalProps {
  file: DeviceFile | null;
  onClose: () => void;
  reason?: string;
}

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({
  file,
  onClose,
  reason,
}) => {
  if (!file) return null;

  const isImage = file.type === 'image' || file.type === 'receipt';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white truncate max-w-md">{file.name}</h3>
              <p className="text-xs text-slate-400 flex items-center gap-3 mt-0.5">
                <span className="flex items-center gap-1">
                  <HardDrive className="w-3 h-3" /> {file.size}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> {file.uploadDate}
                </span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {/* Reason Badge */}
          {reason && (
            <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-800/60 text-xs text-cyan-300 flex items-center gap-2">
              <span className="font-semibold">✨ Auto-adjuntado por AuraFin AI:</span>
              <span>{reason}</span>
            </div>
          )}

          {/* Media Preview Box */}
          <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden flex items-center justify-center min-h-[220px] max-h-[360px]">
            {isImage ? (
              <img
                src={file.url}
                alt={file.name}
                className="max-h-[360px] w-full object-contain bg-slate-950"
              />
            ) : (
              <div className="p-8 text-center flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center mb-3">
                  <FileText className="w-8 h-8" />
                </div>
                <h4 className="text-sm font-semibold text-white">{file.name}</h4>
                <p className="text-xs text-slate-400 max-w-sm mt-1">{file.description}</p>
                <span className="mt-3 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                  Documento PDF / Archivo del Dispositivo
                </span>
              </div>
            )}
          </div>

          {/* Details & Metadata */}
          <div className="space-y-3 bg-slate-950/40 p-4 rounded-2xl border border-slate-800/80">
            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Descripción & Análisis de Contenido
              </span>
              <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">{file.description}</p>
            </div>

            {file.tags && file.tags.length > 0 && (
              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                  <Tag className="w-3 h-3 text-cyan-400" /> Etiquetas del Archivo
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {file.tags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="text-[11px] px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 border border-slate-700/60"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between">
          <span className="text-xs text-slate-400">Indexado en la galería móvil</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
