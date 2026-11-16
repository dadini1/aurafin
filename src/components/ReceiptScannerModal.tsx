import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Camera,
  X,
  Upload,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Zap,
  ShoppingBag,
  Car,
  Home,
  Coffee,
  HeartPulse,
  BookOpen,
  DollarSign,
  Tag,
  Calendar,
  Layers,
  FileCheck,
  FileText,
  HelpCircle,
  Scan,
  RefreshCw,
  Eye,
  Plus,
} from 'lucide-react';
import { PaymentItem, UserFinancialProfile, DeviceFile, ScannedReceiptResult } from '../types';
import { scanReceiptWithAI } from '../services/geminiService';

interface ReceiptScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddPayment: (payment: Omit<PaymentItem, 'id' | 'createdAt'>) => void;
  profile: UserFinancialProfile;
  onAddFileToGallery?: (file: DeviceFile) => void;
}

export const ReceiptScannerModal: React.FC<ReceiptScannerModalProps> = ({
  isOpen,
  onClose,
  onAddPayment,
  profile,
  onAddFileToGallery,
}) => {
  // Camera & Stream states
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);

  // Capture & Processing states
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Extracted Result & Editing form
  const [extractedData, setExtractedData] = useState<ScannedReceiptResult | null>(null);
  const [formMerchant, setFormMerchant] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formAmount, setFormAmount] = useState<number | ''>('');
  const [formCategory, setFormCategory] = useState<PaymentItem['category']>('alimentacion');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formIsFixed, setFormIsFixed] = useState(false);
  const [formFrequency, setFormFrequency] = useState<PaymentItem['frequency']>('unico');
  const [saveToGallery, setSaveToGallery] = useState(true);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);

  // Clean up camera stream
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
    setTorchOn(false);
  }, []);

  // Start Camera
  const startCamera = useCallback(async () => {
    stopCamera();
    setCameraError(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Tu navegador no soporta acceso directo a la cámara. Puedes subir una foto del recibo.');
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch((err) => {
          console.warn('Error autoplaying video stream:', err);
        });
      }

      setCameraActive(true);

      // Check for torch capability
      const track = stream.getVideoTracks()[0];
      if (track) {
        const capabilities = track.getCapabilities ? (track.getCapabilities() as any) : {};
        setHasTorch(Boolean(capabilities?.torch));
      }
    } catch (err: any) {
      console.warn('Camera access error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('Permiso de cámara denegado. Habilita los permisos o sube una imagen de recibo.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraError('No se encontró una cámara en el dispositivo. Sube una foto de tu recibo.');
      } else {
        setCameraError('No se pudo inicializar la cámara. Por favor utiliza el botón de subir imagen.');
      }
      setCameraActive(false);
    }
  }, [facingMode, stopCamera]);

  // Handle open / close lifecycle
  useEffect(() => {
    if (isOpen) {
      setCapturedImage(null);
      setExtractedData(null);
      setAnalysisError(null);
      setRegistrationSuccess(false);
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, startCamera, stopCamera]);

  // Toggle Torch
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (track && hasTorch) {
      try {
        const nextState = !torchOn;
        await (track as any).applyConstraints({
          advanced: [{ torch: nextState }],
        });
        setTorchOn(nextState);
      } catch (e) {
        console.warn('Failed to toggle torch:', e);
      }
    }
  };

  // Toggle Facing Mode
  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Capture Frame from Video
  const capturePhoto = () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);

    stopCamera();
    setCapturedImage(dataUrl);
    processReceipt(dataUrl);
  };

  // Process uploaded or captured image
  const processReceipt = async (imageDataUrl: string) => {
    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      const result = await scanReceiptWithAI(imageDataUrl, 'image/jpeg', profile.currencySymbol);
      setExtractedData(result);

      // Populate form
      setFormMerchant(result.merchant || '');
      setFormTitle(result.title || `Gasto en ${result.merchant || 'Comercio'}`);
      setFormAmount(result.amount > 0 ? result.amount : '');
      setFormCategory(result.category || 'alimentacion');
      setFormDate(result.date || new Date().toISOString().split('T')[0]);
      setFormIsFixed(result.isFixed || false);
      setFormFrequency(result.frequency || 'unico');
    } catch (err: any) {
      console.error('Error scanning receipt:', err);
      setAnalysisError('No pudimos procesar la imagen automáticamente. Puedes completar los datos manualmente.');
      // Default fallback form
      setFormMerchant('Comercio Local');
      setFormTitle('Gasto de Recibo');
      setFormAmount('');
      setFormCategory('alimentacion');
      setFormDate(new Date().toISOString().split('T')[0]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Handle File Input Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      stopCamera();
      setCapturedImage(dataUrl);
      processReceipt(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  // Create Sample Receipt on Demand (Instant testing without physical receipt)
  const loadSampleReceipt = (type: 'super' | 'gasolina' | 'farmacia' | 'restaurante') => {
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 800;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Paper background
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, 600, 800);

    // Dotted receipt edges
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'center';

    const todayStr = new Date().toISOString().split('T')[0];

    if (type === 'super') {
      ctx.fillText('SUPERMERCADOS METRO', 300, 70);
      ctx.font = '14px monospace';
      ctx.fillText('Av. Central 402 - RUC: 2048918231', 300, 100);
      ctx.fillText(`FECHA: ${todayStr}  HORA: 14:32`, 300, 125);
      ctx.fillText('--------------------------------------------', 300, 150);
      ctx.textAlign = 'left';
      ctx.fillText('LECHE ENTERA 1L            $ 2.40', 80, 190);
      ctx.fillText('PAN INTEGRAL ARTESANAL     $ 3.80', 80, 225);
      ctx.fillText('HUEVOS CAMPEROS X12        $ 4.20', 80, 260);
      ctx.fillText('PECHUGA DE POLLO 1KG       $ 9.80', 80, 295);
      ctx.fillText('VERDURAS Y FRUTAS SURTIDAS $ 14.50', 80, 330);
      ctx.fillText('DETERGENTE ECOLÓGICO       $ 8.90', 80, 365);
      ctx.textAlign = 'center';
      ctx.fillText('--------------------------------------------', 300, 410);
      ctx.font = 'bold 22px monospace';
      ctx.fillText('TOTAL: $ 43.60', 300, 450);
      ctx.font = '14px monospace';
      ctx.fillText('IVA INCLUIDO (16%): $ 6.01', 300, 485);
      ctx.fillText('PAGO CON TARJETA DE DÉBITO ****8192', 300, 520);
      ctx.fillText('¡GRACIAS POR SU COMPRA!', 300, 570);
    } else if (type === 'gasolina') {
      ctx.fillText('ESTACIÓN DE SERVICIO REPSOL', 300, 70);
      ctx.font = '14px monospace';
      ctx.fillText('Carretera Sur Km 14', 300, 100);
      ctx.fillText(`FECHA: ${todayStr}  HORA: 08:15`, 300, 125);
      ctx.fillText('--------------------------------------------', 300, 150);
      ctx.textAlign = 'left';
      ctx.fillText('SURTIDOR #04 - GASOLINA PREMIUM 95', 80, 200);
      ctx.fillText('CANTIDAD: 32.50 LITROS', 80, 235);
      ctx.fillText('PRECIO UNIT: $ 1.60 / L', 80, 270);
      ctx.textAlign = 'center';
      ctx.fillText('--------------------------------------------', 300, 320);
      ctx.font = 'bold 22px monospace';
      ctx.fillText('TOTAL: $ 52.00', 300, 360);
      ctx.font = '14px monospace';
      ctx.fillText('PAGO ELECTRÓNICO APROBADO', 300, 410);
      ctx.fillText('¡BUEN VIAJE!', 300, 470);
    } else if (type === 'farmacia') {
      ctx.fillText('FARMACIA SAN RAFAEL', 300, 70);
      ctx.font = '14px monospace';
      ctx.fillText('Sucursal Médica Norte', 300, 100);
      ctx.fillText(`FECHA: ${todayStr}  HORA: 19:40`, 300, 125);
      ctx.fillText('--------------------------------------------', 300, 150);
      ctx.textAlign = 'left';
      ctx.fillText('IBUPROFENO 600MG X20       $ 6.50', 80, 200);
      ctx.fillText('JARABE ANTITUSIVO 150ML    $ 11.20', 80, 235);
      ctx.fillText('COMPLEJO VITAMÍNICO C + ZN $ 10.80', 80, 270);
      ctx.textAlign = 'center';
      ctx.fillText('--------------------------------------------', 300, 320);
      ctx.font = 'bold 22px monospace';
      ctx.fillText('TOTAL: $ 28.50', 300, 360);
      ctx.font = '14px monospace';
      ctx.fillText('RECETA MÉDICA VERIFICADA', 300, 410);
      ctx.fillText('CUIDA TU SALUD', 300, 470);
    } else {
      ctx.fillText('BISTRO & CAFÉ LA CASONA', 300, 70);
      ctx.font = '14px monospace';
      ctx.fillText('Plaza Mayor 12', 300, 100);
      ctx.fillText(`FECHA: ${todayStr}  HORA: 21:10`, 300, 125);
      ctx.fillText('--------------------------------------------', 300, 150);
      ctx.textAlign = 'left';
      ctx.fillText('2X MENÚ DEGUSTACIÓN        $ 28.00', 80, 200);
      ctx.fillText('1X BOTELLA VINO DE LA CASA $ 12.00', 80, 235);
      ctx.fillText('2X CAFÉ ESPRESSO ITALIANO  $ 4.50', 80, 270);
      ctx.textAlign = 'center';
      ctx.fillText('--------------------------------------------', 300, 320);
      ctx.font = 'bold 22px monospace';
      ctx.fillText('TOTAL: $ 44.50', 300, 360);
      ctx.font = '14px monospace';
      ctx.fillText('SERVICIO INCLUIDO', 300, 410);
      ctx.fillText('¡VUELVA PRONTO!', 300, 470);
    }

    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
    stopCamera();
    setCapturedImage(dataUrl);
    processReceipt(dataUrl);
  };

  // Retake photo
  const handleRetake = () => {
    setCapturedImage(null);
    setExtractedData(null);
    setAnalysisError(null);
    startCamera();
  };

  // Submit and Save Payment
  const handleSubmitPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formAmount || Number(formAmount) <= 0 || !formTitle.trim()) return;

    let attachedFileId: string | undefined = undefined;

    // Optionally save the receipt image to user's gallery
    if (saveToGallery && capturedImage && onAddFileToGallery) {
      attachedFileId = `recibo-${Date.now()}`;
      const newFile: DeviceFile = {
        id: attachedFileId,
        name: `Recibo - ${formMerchant || formTitle} (${formDate}).jpg`,
        type: 'receipt',
        size: '240 KB',
        url: capturedImage,
        description: `Comprobante de compra escaneado con cámara en ${formMerchant || 'comercio'}. Total: ${profile.currencySymbol}${formAmount}.`,
        tags: [
          '#recibo',
          `#${formCategory}`,
          `#${formMerchant.toLowerCase().replace(/\s+/g, '')}`,
          '#escaneado',
        ],
        uploadDate: formDate,
        category: formCategory === 'alquiler' ? 'vivienda' : formCategory === 'transporte' ? 'vehiculo' : 'factura',
      };
      onAddFileToGallery(newFile);
    }

    // Create payment entry
    onAddPayment({
      title: formTitle.trim(),
      amount: Number(formAmount),
      type: 'gasto',
      isFixed: formIsFixed,
      category: formCategory,
      frequency: formFrequency,
      dueDate: formDate,
      status: 'pagado', // scanned physical receipts represent completed transactions
      merchant: formMerchant || undefined,
      receiptImage: capturedImage || undefined,
      matchedFileIds: attachedFileId ? [attachedFileId] : [],
      itemsBreakdown: extractedData?.items && extractedData.items.length > 0 ? extractedData.items : undefined,
    });

    setRegistrationSuccess(true);
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col my-auto max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-slate-900/90 sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 text-cyan-400">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white">Escanear Recibo con Cámara</h3>
                <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                  <Sparkles className="w-3 h-3 text-cyan-400" />
                  IA Visión
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Extrae monto, fecha, categoría y comercio automáticamente para registrar tu gasto
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-6">
          {/* STEP 1: Live Camera Viewfinder or Captured Preview */}
          {!capturedImage ? (
            <div className="space-y-4">
              <div className="relative aspect-[4/3] sm:aspect-[16/10] max-h-[420px] rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center group shadow-inner">
                {cameraActive ? (
                  <>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />

                    {/* Receipt Guide Overlays */}
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6">
                      <div className="w-full max-w-sm h-5/6 border-2 border-dashed border-cyan-400/60 rounded-2xl relative shadow-[0_0_20px_rgba(6,182,212,0.15)] flex flex-col justify-between p-4">
                        {/* Corner Accents */}
                        <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-cyan-400 rounded-tl-lg" />
                        <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-cyan-400 rounded-tr-lg" />
                        <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-cyan-400 rounded-bl-lg" />
                        <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-cyan-400 rounded-br-lg" />

                        <div className="text-center">
                          <span className="text-[11px] font-semibold bg-slate-900/80 backdrop-blur-md text-cyan-300 px-3 py-1 rounded-full border border-cyan-500/30">
                            Alinea el recibo o factura aquí
                          </span>
                        </div>

                        <div className="text-center">
                          <span className="text-[10px] text-slate-300 bg-slate-900/70 px-2 py-0.5 rounded-md">
                            Asegura buena iluminación y texto nítido
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Camera Controls Floating Bar */}
                    <div className="absolute bottom-4 inset-x-0 flex items-center justify-center gap-4 z-10 px-4">
                      {hasTorch && (
                        <button
                          type="button"
                          onClick={toggleTorch}
                          className={`p-3 rounded-full backdrop-blur-md transition-all shadow-lg ${
                            torchOn ? 'bg-amber-400 text-slate-950 font-bold' : 'bg-slate-900/80 text-white hover:bg-slate-800'
                          }`}
                          title="Linterna / Flash"
                        >
                          <Zap className="w-5 h-5" />
                        </button>
                      )}

                      {/* Primary Capture Button */}
                      <button
                        type="button"
                        onClick={capturePhoto}
                        className="w-16 h-16 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 p-1 flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-transform"
                        title="Capturar Foto"
                      >
                        <div className="w-full h-full rounded-full border-4 border-white bg-cyan-500 flex items-center justify-center">
                          <Camera className="w-6 h-6 text-white" />
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={toggleFacingMode}
                        className="p-3 rounded-full bg-slate-900/80 backdrop-blur-md text-white hover:bg-slate-800 transition-all shadow-lg"
                        title="Cambiar Cámara"
                      >
                        <RotateCcw className="w-5 h-5" />
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center p-6 text-center space-y-3">
                    <div className="p-4 rounded-full bg-slate-800/80 text-slate-400 border border-slate-700">
                      <Camera className="w-8 h-8 text-cyan-400" />
                    </div>
                    {cameraError ? (
                      <div className="space-y-1">
                        <p className="text-xs sm:text-sm text-rose-300 font-medium">{cameraError}</p>
                        <p className="text-xs text-slate-400">Puedes subir un archivo desde tu galería o usar un recibo de prueba.</p>
                      </div>
                    ) : (
                      <p className="text-xs sm:text-sm text-slate-400">Iniciando visor de cámara...</p>
                    )}

                    <div className="flex items-center gap-2 pt-2">
                      <button
                        type="button"
                        onClick={startCamera}
                        className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white border border-slate-700 flex items-center gap-1.5"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
                        Reintentar Cámara
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Upload fallback and quick presets */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileUpload}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                  <Upload className="w-4 h-4 text-cyan-400" />
                  <span>Subir foto desde galería</span>
                </button>

                {/* Preset sample tickets */}
                <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-1 sm:pb-0">
                  <span className="text-[11px] text-slate-400 shrink-0">O probar con:</span>
                  <button
                    type="button"
                    onClick={() => loadSampleReceipt('super')}
                    className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-[11px] text-slate-300 hover:text-white shrink-0"
                  >
                    🛒 Supermercado
                  </button>
                  <button
                    type="button"
                    onClick={() => loadSampleReceipt('gasolina')}
                    className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-[11px] text-slate-300 hover:text-white shrink-0"
                  >
                    ⛽ Gasolina
                  </button>
                  <button
                    type="button"
                    onClick={() => loadSampleReceipt('farmacia')}
                    className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-[11px] text-slate-300 hover:text-white shrink-0"
                  >
                    💊 Farmacia
                  </button>
                  <button
                    type="button"
                    onClick={() => loadSampleReceipt('restaurante')}
                    className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-[11px] text-slate-300 hover:text-white shrink-0"
                  >
                    ☕ Restaurante
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* STEP 2 & 3: Analyzed Receipt + Extracted Data Form */
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
              {/* Receipt Snapshot Column */}
              <div className="md:col-span-5 space-y-3">
                <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 aspect-[3/4] max-h-[380px] shadow-lg flex items-center justify-center">
                  <img
                    src={capturedImage}
                    alt="Recibo Escaneado"
                    className="w-full h-full object-contain bg-slate-950"
                  />

                  {/* Scanning Laser Animation */}
                  {isAnalyzing && (
                    <div className="absolute inset-0 bg-cyan-950/20 backdrop-blur-[1px] flex flex-col items-center justify-center p-4">
                      {/* Laser Line */}
                      <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_15px_#22d3ee] animate-pulse" />
                      <div className="bg-slate-900/90 border border-cyan-500/40 px-4 py-3 rounded-2xl text-center space-y-2 shadow-2xl">
                        <Sparkles className="w-6 h-6 text-cyan-400 animate-spin mx-auto" />
                        <p className="text-xs font-bold text-white">Analizando Recibo con IA...</p>
                        <p className="text-[11px] text-cyan-200">Extrayendo monto, fecha y categoría</p>
                      </div>
                    </div>
                  )}

                  {!isAnalyzing && (
                    <div className="absolute top-2 right-2 flex items-center gap-1.5">
                      {extractedData && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/90 text-white shadow-md flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          {extractedData.confidence}% nitidez
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={handleRetake}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 hover:text-white border border-slate-700 flex items-center gap-1.5 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
                    Tomar otra foto
                  </button>

                  {extractedData?.notes && (
                    <span className="text-[11px] text-slate-400 truncate max-w-[200px]" title={extractedData.notes}>
                      {extractedData.notes}
                    </span>
                  )}
                </div>
              </div>

              {/* Form & Verification Column */}
              <div className="md:col-span-7">
                {registrationSuccess ? (
                  <div className="p-8 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 text-center space-y-3 flex flex-col items-center justify-center h-full">
                    <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                      <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <h4 className="text-lg font-bold text-white">¡Gasto Registrado con Éxito!</h4>
                    <p className="text-xs text-emerald-200/90">
                      Se ha añadido a tus pagos programados y se actualizó tu presupuesto mensual.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmitPayment} className="space-y-4">
                    {/* Extraction Status Alert */}
                    {analysisError ? (
                      <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-600/40 text-xs text-amber-200 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>{analysisError}</span>
                      </div>
                    ) : extractedData ? (
                      <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-800/40 text-xs text-cyan-200 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                          <span>Datos del ticket extraídos y listos para verificar</span>
                        </div>
                        {extractedData.tax ? (
                          <span className="text-[10px] text-slate-400">
                            Impuesto: {profile.currencySymbol}{extractedData.tax}
                          </span>
                        ) : null}
                      </div>
                    ) : null}

                    {/* Monto & Moneda (Highlighted) */}
                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1 flex items-center justify-between">
                        <span>Monto Total del Comprobante *</span>
                        <span className="text-[10px] text-cyan-400">Extraído por IA</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-cyan-400 font-bold text-lg">
                          {profile.currencySymbol}
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={formAmount}
                          onChange={(e) => setFormAmount(e.target.value === '' ? '' : Number(e.target.value))}
                          placeholder="0.00"
                          className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-white font-bold text-lg focus:ring-2 focus:ring-cyan-500/50 focus:outline-none"
                          required
                        />
                      </div>
                    </div>

                    {/* Comercio & Título */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-slate-300 block mb-1">
                          Comercio / Establecimiento
                        </label>
                        <input
                          type="text"
                          value={formMerchant}
                          onChange={(e) => setFormMerchant(e.target.value)}
                          placeholder="Ej: Walmart, CFE, Shell"
                          className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:ring-2 focus:ring-cyan-500/40 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-300 block mb-1">
                          Concepto / Título en Finanzas *
                        </label>
                        <input
                          type="text"
                          value={formTitle}
                          onChange={(e) => setFormTitle(e.target.value)}
                          placeholder="Ej: Compra de despensa semanal"
                          className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:ring-2 focus:ring-cyan-500/40 focus:outline-none"
                          required
                        />
                      </div>
                    </div>

                    {/* Categoría & Fecha */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-slate-300 block mb-1">
                          Categoría de Gasto *
                        </label>
                        <select
                          value={formCategory}
                          onChange={(e) => setFormCategory(e.target.value as PaymentItem['category'])}
                          className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:ring-2 focus:ring-cyan-500/40 focus:outline-none"
                        >
                          <option value="alimentacion">Alimentación / Súper</option>
                          <option value="transporte">Transporte / Gasolina</option>
                          <option value="ocio">Ocio / Restaurantes</option>
                          <option value="servicios">Servicios Básicos (Luz/Agua)</option>
                          <option value="salud">Salud y Farmacia</option>
                          <option value="educacion">Educación</option>
                          <option value="alquiler">Vivienda / Alquiler</option>
                          <option value="otro">Otros Gastos</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-300 block mb-1">
                          Fecha del Recibo *
                        </label>
                        <input
                          type="date"
                          value={formDate}
                          onChange={(e) => setFormDate(e.target.value)}
                          className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:ring-2 focus:ring-cyan-500/40 focus:outline-none"
                          required
                        />
                      </div>
                    </div>

                    {/* Tipo de Gasto: Fijo vs Variable */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-slate-300 block mb-1">
                          Naturaleza del Gasto
                        </label>
                        <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
                          <button
                            type="button"
                            onClick={() => setFormIsFixed(false)}
                            className={`py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                              !formIsFixed
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            Variable (Compra)
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormIsFixed(true)}
                            className={`py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                              formIsFixed
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            Fijo (Recurrente)
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-300 block mb-1">
                          Frecuencia
                        </label>
                        <select
                          value={formFrequency}
                          onChange={(e) => setFormFrequency(e.target.value as PaymentItem['frequency'])}
                          className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:ring-2 focus:ring-cyan-500/40 focus:outline-none"
                        >
                          <option value="unico">Pago Único</option>
                          <option value="mensual">Mensual</option>
                          <option value="quincenal">Quincenal</option>
                          <option value="anual">Anual</option>
                        </select>
                      </div>
                    </div>

                    {/* Items Breakdown list if detected */}
                    {extractedData?.items && extractedData.items.length > 0 && (
                      <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400">
                          <span>Artículos detectados en el ticket ({extractedData.items.length}):</span>
                        </div>
                        <div className="max-h-24 overflow-y-auto space-y-1 pr-1">
                          {extractedData.items.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs text-slate-300">
                              <span className="truncate max-w-[220px]">• {item.name}</span>
                              {item.price ? (
                                <span className="font-mono text-cyan-300 font-semibold">
                                  {profile.currencySymbol}{item.price.toFixed(2)}
                                </span>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Checkbox: Guardar en galería de archivos */}
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="checkbox"
                        id="saveReceiptToGallery"
                        checked={saveToGallery}
                        onChange={(e) => setSaveToGallery(e.target.checked)}
                        className="w-4 h-4 rounded text-cyan-500 focus:ring-cyan-400 bg-slate-950 border-slate-700"
                      />
                      <label htmlFor="saveReceiptToGallery" className="text-xs text-slate-300 cursor-pointer">
                        Adjuntar copia fotográfica a la galería de comprobantes de la app
                      </label>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={!formAmount || Number(formAmount) <= 0}
                        className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 disabled:opacity-50 text-white font-semibold text-xs shadow-md flex items-center gap-2 transition-all"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Registrar en Gastos ('payments')</span>
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
