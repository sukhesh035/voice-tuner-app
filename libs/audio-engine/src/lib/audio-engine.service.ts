import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface AudioEngineConfig {
  sampleRate: number;
  bufferSize: number;
  latencyHint: AudioContextLatencyCategory;
}

export interface AudioEngineState {
  isInitialized: boolean;
  isRunning: boolean;
  sampleRate: number;
  currentTime: number;
  microphoneActive: boolean;
  outputLevel: number;
}

const DEFAULT_CONFIG: AudioEngineConfig = {
  sampleRate: 44100,
  bufferSize: 128,
  latencyHint: 'interactive'
};

/**
 * AudioEngineService
 * Central singleton managing the Web Audio API context, microphone access,
 * AudioWorklet scheduling, and shared buses for the entire application.
 */
@Injectable({ providedIn: 'root' })
export class AudioEngineService implements OnDestroy {
  private ctx: AudioContext | null = null;
  private microphoneStream: MediaStream | null = null;
  private microphoneSource: MediaStreamAudioSourceNode | null = null;
  private masterGain: GainNode | null = null;
  private analyserNode: AnalyserNode | null = null;

  private readonly stateSubject = new BehaviorSubject<AudioEngineState>({
    isInitialized: false,
    isRunning: false,
    sampleRate: 44100,
    currentTime: 0,
    microphoneActive: false,
    outputLevel: 0
  });

  private config: AudioEngineConfig = { ...DEFAULT_CONFIG };
  private rafId: number | null = null;

  get state$(): Observable<AudioEngineState> {
    return this.stateSubject.asObservable();
  }

  get context(): AudioContext | null {
    return this.ctx;
  }

  get analyser(): AnalyserNode | null {
    return this.analyserNode;
  }

  get masterGainNode(): GainNode | null {
    return this.masterGain;
  }

  /**
   * Initialize the AudioContext. Must be called from a user gesture on iOS.
   */
  async initialize(config?: Partial<AudioEngineConfig>): Promise<void> {
    if (this.ctx && this.ctx.state !== 'closed') return;

    this.config = { ...DEFAULT_CONFIG, ...config };

    try {
      this.ctx = new AudioContext({
        sampleRate: this.config.sampleRate,
        latencyHint: this.config.latencyHint
      });

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.85;

      this.analyserNode = this.ctx.createAnalyser();
      this.analyserNode.fftSize = 4096;
      this.analyserNode.smoothingTimeConstant = 0.8;

      this.masterGain.connect(this.analyserNode);
      this.analyserNode.connect(this.ctx.destination);

      // Load AudioWorklets
      await this.loadWorklets();

      this.startLevelMonitor();
      this.patchState({ isInitialized: true, sampleRate: this.ctx.sampleRate });
    } catch (err) {
      console.error('[AudioEngine] Initialization failed:', err);
      throw err;
    }
  }

  /**
   * Resume or create the AudioContext (iOS requires resume on user action).
   */
  async resume(): Promise<void> {
    if (!this.ctx) {
      await this.initialize();
      return;
    }
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    this.patchState({ isRunning: true });
  }

  /**
   * Suspend AudioContext to save CPU when app is backgrounded.
   */
  async suspend(): Promise<void> {
    if (this.ctx && this.ctx.state === 'running') {
      await this.ctx.suspend();
      this.patchState({ isRunning: false });
    }
  }

  /**
   * Request microphone access and create a media stream source.
   */
  async enableMicrophone(): Promise<MediaStreamAudioSourceNode> {
    await this.resume();

    if (!this.ctx) throw new Error('[AudioEngine] Context not initialized');

    try {
      this.microphoneStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: this.config.sampleRate,
          channelCount: 1
        }
      });

      this.microphoneSource = this.ctx.createMediaStreamSource(this.microphoneStream);
      this.patchState({ microphoneActive: true });
      return this.microphoneSource;
    } catch (err) {
      console.error('[AudioEngine] Microphone access denied:', err);
      throw err;
    }
  }

  /**
   * Stop and release microphone stream.
   */
  disableMicrophone(): void {
    if (this.microphoneStream) {
      this.microphoneStream.getTracks().forEach(t => t.stop());
      this.microphoneStream = null;
    }
    if (this.microphoneSource) {
      this.microphoneSource.disconnect();
      this.microphoneSource = null;
    }
    this.patchState({ microphoneActive: false });
  }

  /**
   * Load audio sample from URL into an AudioBuffer.
   */
  async loadSample(url: string): Promise<AudioBuffer> {
    await this.resume();
    if (!this.ctx) throw new Error('[AudioEngine] Context not initialized');

    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    return this.ctx.decodeAudioData(arrayBuffer);
  }

  /**
   * Create a buffer source node connected to master gain.
   */
  createBufferSource(): AudioBufferSourceNode {
    if (!this.ctx || !this.masterGain) {
      throw new Error('[AudioEngine] Context not initialized');
    }
    const source = this.ctx.createBufferSource();
    source.connect(this.masterGain);
    return source;
  }

  /**
   * Set master output volume (0-1).
   */
  setMasterVolume(value: number): void {
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(
        Math.max(0, Math.min(1, value)),
        this.ctx.currentTime,
        0.01
      );
    }
  }

  /**
   * Get current audio context time.
   */
  get currentTime(): number {
    return this.ctx?.currentTime ?? 0;
  }

  private async loadWorklets(): Promise<void> {
    if (!this.ctx) return;
    try {
      await this.ctx.audioWorklet.addModule('/assets/worklets/pitch-processor.worklet.js');
    } catch (err) {
      // Worklet loading is best-effort; fall back to ScriptProcessorNode
      console.warn('[AudioEngine] AudioWorklet load failed, will use fallback:', err);
    }
  }

  private startLevelMonitor(): void {
    if (!this.analyserNode) return;
    const dataArray = new Uint8Array(this.analyserNode.fftSize);

    const tick = () => {
      if (!this.analyserNode) return;
      this.analyserNode.getByteTimeDomainData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const v = (dataArray[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / dataArray.length);
      this.patchState({ outputLevel: rms, currentTime: this.ctx?.currentTime ?? 0 });
      this.rafId = requestAnimationFrame(tick);
    };

    this.rafId = requestAnimationFrame(tick);
  }

  private patchState(partial: Partial<AudioEngineState>): void {
    this.stateSubject.next({ ...this.stateSubject.value, ...partial });
  }

  ngOnDestroy(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.disableMicrophone();
    this.ctx?.close();
  }
}
