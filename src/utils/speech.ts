// Speech Recognition & Audio Helper

// Type definitions for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export class VoiceRecorderHelper {
  private recognition: any = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private microphoneStream: MediaStream | null = null;
  private animFrameId: number | null = null;

  public isListening = false;
  public supportsNativeRecognition = false;

  constructor() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.supportsNativeRecognition = true;
    }
  }

  public async startListening(
    onInterimText: (text: string) => void,
    onFinalText: (text: string) => void,
    onVolumeChange?: (volume: number) => void,
    onError?: (error: string) => void,
    lang: string = 'es-ES'
  ): Promise<boolean> {
    try {
      this.isListening = true;
      let fatalError = false;

      // 1. Setup AudioContext for volume visualizer
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.microphoneStream = stream;
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 256;
        const source = this.audioContext.createMediaStreamSource(stream);
        source.connect(this.analyser);

        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        const updateVolume = () => {
          if (!this.isListening || !this.analyser) return;
          this.analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          const normalized = Math.min(1, avg / 128);
          if (onVolumeChange) onVolumeChange(normalized);
          this.animFrameId = requestAnimationFrame(updateVolume);
        };
        updateVolume();

        // Also setup MediaRecorder in case native SpeechRecognition is not available
        if (!this.supportsNativeRecognition) {
          this.audioChunks = [];
          this.mediaRecorder = new MediaRecorder(stream);
          this.mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) this.audioChunks.push(e.data);
          };
          this.mediaRecorder.start(250);
        }
      } catch (err: any) {
        console.warn('Microphone permission or audio context error:', err);
        if (onError) onError('No se pudo acceder al micrófono. Por favor permite los permisos.');
      }

      // 2. Setup Native SpeechRecognition if available
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        this.recognition = new SpeechRecognition();
        this.recognition.lang = lang;
        this.recognition.continuous = true;
        this.recognition.interimResults = true;

        let accumulatedFinal = '';

        this.recognition.onresult = (event: any) => {
          let interim = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              accumulatedFinal += (accumulatedFinal ? ' ' : '') + event.results[i][0].transcript;
            } else {
              interim += event.results[i][0].transcript;
            }
          }
          onInterimText(interim || accumulatedFinal);
          if (accumulatedFinal) {
            onFinalText(accumulatedFinal);
          }
        };

        this.recognition.onerror = (e: any) => {
          console.warn('Speech recognition error:', e);
          if (e.error === 'not-allowed' || e.error === 'service-not-allowed' || e.error === 'audio-capture') {
            fatalError = true;
          }
          if (e.error !== 'no-speech' && e.error !== 'aborted' && onError) {
            onError(`Error de reconocimiento: ${e.error}`);
          }
        };

        this.recognition.onend = () => {
          if (this.isListening && !fatalError) {
            try {
              this.recognition?.start();
            } catch {
              // Ignore restart error
            }
          }
        };

        this.recognition.start();
      }

      return true;
    } catch (err: any) {
      this.isListening = false;
      if (onError) onError(err.message || 'Error al iniciar reconocimiento');
      return false;
    }
  }

  public async stopListening(): Promise<Blob | null> {
    this.isListening = false;

    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {}
      this.recognition = null;
    }

    let recordedBlob: Blob | null = null;
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      const finishPromise = new Promise<Blob>((resolve) => {
        if (!this.mediaRecorder) return resolve(new Blob());
        this.mediaRecorder.onstop = () => {
          const blob = new Blob(this.audioChunks, { type: 'audio/webm' });
          resolve(blob);
        };
        this.mediaRecorder.stop();
      });
      recordedBlob = await finishPromise;
    }

    if (this.microphoneStream) {
      this.microphoneStream.getTracks().forEach((track) => track.stop());
      this.microphoneStream = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }

    return recordedBlob;
  }
}
