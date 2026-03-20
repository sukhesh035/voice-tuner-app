import { Injectable, OnDestroy, inject } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, filter, map } from 'rxjs/operators';
import { AudioEngineService } from '@voice-tuner/audio-engine';

// ── Types & Interfaces ────────────────────────────────────

export type IndianNote = 'Sa' | 'Re♭' | 'Re' | 'Ga♭' | 'Ga' | 'Ma' | 'Ma#' | 'Pa' | 'Dha♭' | 'Dha' | 'Ni♭' | 'Ni';
export type WesternNote = 'C' | 'C#' | 'D' | 'D#' | 'E' | 'F' | 'F#' | 'G' | 'G#' | 'A' | 'A#' | 'B';

export interface PitchResult {
  frequency:      number;         // Hz (raw detected frequency)
  note:           WesternNote;    // Nearest Western note
  indianNote:     IndianNote;     // Corresponding Indian sargam note
  octave:         number;
  centsOff:       number;         // -50 to +50 from exact note
  deviationFromSa: number;        // cents from Sa (tonic)
  accuracy:       number;         // 0–100 (how close to exact pitch)
  clarity:        number;         // 0–1 (confidence in detection)
  isInTune:       boolean;        // within ±15 cents
  timestamp:      number;
}

export interface PitchStats {
  averageFrequency: number;
  averageCentsOff:  number;
  stabilityScore:   number;         // 0–100
  noteAccuracies:   Record<IndianNote, number>;
  sessionDuration:  number;
  sampleCount:      number;
}

// Western notes in semitone order
const WESTERN_NOTES: WesternNote[] = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

// Indian note names corresponding to 12 semitones (Sa = 0)
const INDIAN_NOTES: IndianNote[] = [
  'Sa', 'Re♭', 'Re', 'Ga♭', 'Ga', 'Ma', 'Ma#', 'Pa', 'Dha♭', 'Dha', 'Ni♭', 'Ni'
];

// Accuracy is full (100) at 0 cents deviation, 0 at ±50 cents
function centsToAccuracy(cents: number): number {
  return Math.max(0, 100 - Math.abs(cents) * 2);
}

/**
 * PitchDetectionService
 * Real-time pitch detection using the YIN algorithm (via Pitchy library pattern)
 * with Indian classical music note mapping.
 */
@Injectable({ providedIn: 'root' })
export class PitchDetectionService implements OnDestroy {
  private readonly audioEngine = inject(AudioEngineService);

  private workletNode: AudioWorkletNode | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private analyserBuffer: Float32Array | null = null;
  private rafId: number | null = null;
  private sessionStart: number | null = null;
  private sessionSamples: PitchResult[] = [];

  private saFrequency = 261.63; // Default Sa = C4

  private pitchSubject = new BehaviorSubject<PitchResult | null>(null);
  private activeSubject = new BehaviorSubject<boolean>(false);
  private destroy$ = new Subject<void>();

  get pitch$():  Observable<PitchResult | null> { return this.pitchSubject.asObservable(); }
  get active$(): Observable<boolean>            { return this.activeSubject.asObservable(); }

  /** Smooth pitch stream — debounced 30ms, ignores duplicates */
  get smoothPitch$(): Observable<PitchResult> {
    return this.pitch$.pipe(
      filter((p): p is PitchResult => p !== null && p.clarity > 0.6),
      distinctUntilChanged((a, b) => Math.abs(a.frequency - b.frequency) < 0.5),
      debounceTime(30)
    );
  }

  /** Note name stream for quick display binding */
  get note$(): Observable<IndianNote | null> {
    return this.pitch$.pipe(map(p => p?.indianNote ?? null));
  }

  /**
   * Set the Sa (tonic) frequency. All deviations are calculated relative to this.
   */
  setSa(frequency: number): void {
    this.saFrequency = frequency;
  }

  /**
   * Start real-time pitch detection from microphone.
   */
  async start(): Promise<void> {
    const micSource = await this.audioEngine.enableMicrophone();
    const ctx = this.audioEngine.context;
    if (!ctx) throw new Error('[PitchDetection] Audio context not ready after init');

    this.sessionStart   = performance.now();
    this.sessionSamples = [];

    const bufferSize = 2048;
    this.analyserBuffer = new Float32Array(bufferSize);

    // Prefer AudioWorkletNode (already loaded by AudioEngineService.loadWorklets())
    let connected = false;
    try {
      this.workletNode = new AudioWorkletNode(ctx, 'pitch-processor');
      this.workletNode.port.onmessage = (event) => {
        const { frequency, clarity } = event.data as { frequency: number; clarity: number };
        if (frequency > 0) {
          const pitchResult = this.frequencyToResult(frequency, clarity);
          this.pitchSubject.next(pitchResult);
          if (pitchResult.clarity > 0.85) {
            this.sessionSamples.push(pitchResult);
            if (this.sessionSamples.length > 3600) {
              this.sessionSamples.splice(0, 100);
            }
          }
        } else {
          this.pitchSubject.next(null);
        }
      };
      micSource.connect(this.workletNode);
      // WorkletNode does not produce output audio — no need to connect to destination
      connected = true;
    } catch (err) {
      console.warn('[PitchDetection] AudioWorkletNode unavailable, falling back to ScriptProcessorNode:', err);
    }

    if (!connected) {
      // ScriptProcessorNode fallback (deprecated, last resort for old WebViews)
      this.scriptProcessor = ctx.createScriptProcessor(bufferSize, 1, 1);
      this.scriptProcessor.onaudioprocess = (event) => {
        const inputData = event.inputBuffer.getChannelData(0);
        this.processAudioBuffer(new Float32Array(inputData));
      };
      micSource.connect(this.scriptProcessor);
      this.scriptProcessor.connect(ctx.destination);
    }

    this.activeSubject.next(true);
  }

  /**
   * Stop pitch detection and release microphone.
   */
  stop(): void {
    if (this.workletNode) {
      this.workletNode.port.onmessage = null;
      this.workletNode.disconnect();
      this.workletNode = null;
    }
    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor.onaudioprocess = null;
      this.scriptProcessor = null;
    }
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.audioEngine.disableMicrophone();
    this.pitchSubject.next(null);
    this.activeSubject.next(false);
  }

  /**
   * Compute session statistics from buffered pitch samples.
   */
  getSessionStats(): PitchStats {
    const samples = this.sessionSamples.filter(s => s.clarity > 0.6);
    if (samples.length === 0) {
      return {
        averageFrequency: 0,
        averageCentsOff:  0,
        stabilityScore:   0,
        noteAccuracies:   {} as Record<IndianNote, number>,
        sessionDuration:  0,
        sampleCount:      0
      };
    }

    const avgFreq = samples.reduce((s, p) => s + p.frequency, 0) / samples.length;
    const avgCents = samples.reduce((s, p) => s + p.centsOff, 0) / samples.length;
    const variance = samples.reduce((s, p) => s + Math.pow(p.centsOff - avgCents, 2), 0) / samples.length;
    const stdDev   = Math.sqrt(variance);
    const stability = Math.max(0, 100 - stdDev * 2);

    const noteGroups: Record<string, number[]> = {};
    for (const s of samples) {
      const n = s.indianNote;
      if (!noteGroups[n]) noteGroups[n] = [];
      noteGroups[n].push(s.accuracy);
    }

    const noteAccuracies = Object.fromEntries(
      Object.entries(noteGroups).map(([note, accs]) => [
        note,
        accs.reduce((a, b) => a + b, 0) / accs.length
      ])
    ) as Record<IndianNote, number>;

    return {
      averageFrequency: avgFreq,
      averageCentsOff:  avgCents,
      stabilityScore:   stability,
      noteAccuracies,
      sessionDuration:  this.sessionStart
        ? (performance.now() - this.sessionStart) / 1000
        : 0,
      sampleCount: samples.length
    };
  }

  // ── Core YIN Pitch Detection (Pure JS Implementation) ──

  private processAudioBuffer(buffer: Float32Array): void {
    const sampleRate = this.audioEngine.context?.sampleRate ?? 44100;
    const result     = this.yin(buffer, sampleRate);

    if (result !== null) {
      const pitchResult = this.frequencyToResult(result.frequency, result.clarity);
      this.pitchSubject.next(pitchResult);
      if (pitchResult.clarity > 0.85) {
        this.sessionSamples.push(pitchResult);
        // Cap memory: keep last 3600 samples (~60s at 60fps)
        if (this.sessionSamples.length > 3600) {
          this.sessionSamples.splice(0, 100);
        }
      }
    } else {
      // Silence or noise
      this.pitchSubject.next(null);
    }
  }

  /**
   * YIN pitch detection algorithm (monophonic).
   * Reference: de Cheveigné & Kawahara, JASA 2002.
   */
  private yin(
    buffer: Float32Array,
    sampleRate: number,
    threshold = 0.15
  ): { frequency: number; clarity: number } | null {
    const N = buffer.length;
    const half = Math.floor(N / 2);
    const diff = new Float32Array(half);

    // Step 1: Difference function
    for (let tau = 0; tau < half; tau++) {
      for (let j = 0; j < half; j++) {
        const delta = buffer[j] - buffer[j + tau];
        diff[tau] += delta * delta;
      }
    }

    // Step 2: Cumulative mean normalised difference
    const cmnd = new Float32Array(half);
    cmnd[0] = 1;
    let runningSum = 0;
    for (let tau = 1; tau < half; tau++) {
      runningSum += diff[tau];
      cmnd[tau] = diff[tau] / ((runningSum / tau) || 1);
    }

    // Step 3: Absolute threshold — find first dip below threshold
    let tau = 2;
    while (tau < half) {
      if (cmnd[tau] < threshold) {
        while (tau + 1 < half && cmnd[tau + 1] < cmnd[tau]) tau++;
        break;
      }
      tau++;
    }

    if (tau >= half || cmnd[tau] >= threshold) return null;

    // Step 4: Parabolic interpolation for sub-sample accuracy
    const refinedTau = this.parabolicInterp(cmnd, tau);
    const frequency  = sampleRate / refinedTau;

    // Reject out-of-range frequencies (human vocal: 80–1200 Hz)
    if (frequency < 80 || frequency > 1200) return null;

    const clarity = 1 - cmnd[tau];
    return { frequency, clarity };
  }

  private parabolicInterp(arr: Float32Array, idx: number): number {
    if (idx < 1 || idx + 1 >= arr.length) return idx;
    const x1 = arr[idx - 1], x2 = arr[idx], x3 = arr[idx + 1];
    const denom = 2 * (2 * x2 - x1 - x3);
    if (Math.abs(denom) < 1e-10) return idx;
    return idx + (x1 - x3) / denom;
  }

  // ── Note Mapping ──────────────────────────────────────

  private frequencyToResult(frequency: number, clarity: number): PitchResult {
    // Convert to MIDI note number
    const midi    = 12 * Math.log2(frequency / 440) + 69;
    const rounded = Math.round(midi);
    const centsOff = (midi - rounded) * 100;

    const noteIndex = ((rounded % 12) + 12) % 12;
    const octave    = Math.floor(rounded / 12) - 1;
    const note      = WESTERN_NOTES[noteIndex];

    // Map to Indian sargam relative to the current Sa key
    const saFreqNorm   = 12 * Math.log2(this.saFrequency / 440) + 69;
    const saSemitone   = ((Math.round(saFreqNorm) % 12) + 12) % 12;
    const semitoneFromSa = ((noteIndex - saSemitone) + 12) % 12;
    const indianNote   = INDIAN_NOTES[semitoneFromSa];

    // Cents deviation from Sa (for detuning display)
    const deviationFromSa = semitoneFromSa * 100 + centsOff;

    const accuracy = centsToAccuracy(centsOff);
    const isInTune = Math.abs(centsOff) <= 25;

    return {
      frequency,
      note,
      indianNote,
      octave,
      centsOff,
      deviationFromSa,
      accuracy,
      clarity,
      isInTune,
      timestamp: Date.now()
    };
  }

  ngOnDestroy(): void {
    this.stop();
    this.destroy$.next();
    this.destroy$.complete();
  }
}
