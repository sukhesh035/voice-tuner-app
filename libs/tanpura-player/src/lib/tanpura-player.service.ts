import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { AudioEngineService } from '@voice-tuner/audio-engine';

// ── Tanpura Configuration Types ──────────────────────────

export type MusicalKey = 'C' | 'C#' | 'D' | 'D#' | 'E' | 'F' | 'F#' | 'G' | 'G#' | 'A' | 'A#' | 'B';

export type StringConfig = 'Sa-Pa-Sa-Sa' | 'Sa-Ma-Sa-Sa' | 'Sa-Ma#-Sa-Sa';

export interface TanpuraState {
  isPlaying:   boolean;
  key:         MusicalKey;
  octave:      number;         // 3 or 4
  tempo:       number;         // BPM (40–120)
  volume:      number;         // 0–1
  fineTune:    number;         // cents (-100 to +100)
  stringConfig: StringConfig;
  currentString: number;       // 0–3 (which string is plucking)
}

export interface PluckSchedule {
  time: number;
  stringIndex: number;
  frequency: number;
  velocity: number;
}

// Note frequencies relative to C4
const NOTE_FREQS: Record<MusicalKey, number> = {
  'C':  261.63, 'C#': 277.18, 'D':  293.66, 'D#': 311.13,
  'E':  329.63, 'F':  349.23, 'F#': 369.99, 'G':  392.00,
  'G#': 415.30, 'A':  440.00, 'A#': 466.16, 'B':  493.88
};

// String intervals: Sa(1/1), Pa(3/2), Sa(2/1), Sa(2/1) — Classic Kharaj Pancham
const STRING_INTERVALS: Record<StringConfig, number[]> = {
  'Sa-Pa-Sa-Sa':  [1.0, 1.5, 2.0, 2.0],
  'Sa-Ma-Sa-Sa':  [1.0, 4/3, 2.0, 2.0],
  'Sa-Ma#-Sa-Sa': [1.0, Math.pow(2, 6/12), 2.0, 2.0]
};

// Per-string resonance parameters (simulate layered harmonic content)
const STRING_RESONANCE = [
  { decay: 4.2, brightness: 0.7, jitter: 0.008 },  // Sa (lower)
  { decay: 3.6, brightness: 0.6, jitter: 0.010 },  // Pa
  { decay: 3.8, brightness: 0.8, jitter: 0.007 },  // Sa (upper)
  { decay: 3.9, brightness: 0.75, jitter: 0.006 }  // Sa (upper)
];

/**
 * TanpuraPlayerService
 * High-quality, Web Audio tanpura simulation using multi-harmonic synthesis,
 * resonance envelopes, and humanisation randomisation.
 */
@Injectable({ providedIn: 'root' })
export class TanpuraPlayerService {
  private stateSubject = new BehaviorSubject<TanpuraState>({
    isPlaying:    false,
    key:          'C',
    octave:       3,
    tempo:        5,
    volume:       0.8,
    fineTune:     0,
    stringConfig: 'Sa-Pa-Sa-Sa',
    currentString: 0
  });

  // Scheduling state
  private scheduleTimer: ReturnType<typeof setTimeout> | null = null;
  private nextPluckTime = 0;
  private nextStringIndex = 0;   // simple counter, always 0→1→2→3→0→…
  private sampleBuffers = new Map<string, AudioBuffer>();
  private loadedSamples = false;

  get state$(): Observable<TanpuraState> { return this.stateSubject.asObservable(); }
  get state():  TanpuraState              { return this.stateSubject.value; }

  constructor(private audioEngine: AudioEngineService) {}

  // ── Public API ─────────────────────────────────────────

  async play(): Promise<void> {
    await this.audioEngine.resume();
    if (!this.loadedSamples) {
      await this.preloadSamples();
    }
    this.nextPluckTime  = this.audioEngine.currentTime + 0.05;
    this.nextStringIndex = 0;
    this.patchState({ isPlaying: true, currentString: 0 });
    this.schedule();
  }

  stop(): void {
    if (this.scheduleTimer !== null) {
      clearTimeout(this.scheduleTimer);
      this.scheduleTimer = null;
    }
    this.patchState({ isPlaying: false });
  }

  toggle(): Promise<void> | void {
    return this.state.isPlaying ? this.stop() : this.play();
  }

  setKey(key: MusicalKey): void {
    const wasPlaying = this.state.isPlaying;
    if (wasPlaying) this.stop();
    this.patchState({ key });
    if (wasPlaying) setTimeout(() => this.play(), 0);
  }

  setTempo(bpm: number): void {
    this.patchState({ tempo: Math.max(0, Math.min(10, bpm)) });
  }

  setVolume(volume: number): void {
    this.patchState({ volume: Math.max(0, Math.min(1, volume)) });
    this.audioEngine.setMasterVolume(volume);
  }

  setFineTune(cents: number): void {
    this.patchState({ fineTune: Math.max(-100, Math.min(100, cents)) });
  }

  setOctave(octave: 3 | 4): void {
    this.patchState({ octave });
  }

  setStringConfig(config: StringConfig): void {
    this.patchState({ stringConfig: config });
  }

  // ── Core Scheduling ────────────────────────────────────

  private schedule(): void {
    const lookAhead    = 0.1;  // seconds to schedule ahead
    const scheduleInterval = 25; // ms between scheduler calls

    const { tempo, isPlaying } = this.state;
    if (!isPlaying) return;

    const beatDuration       = 60 / tempo;
    const stringSpacing      = beatDuration / 4; // 4 strings per cycle

    while (this.nextPluckTime < this.audioEngine.currentTime + lookAhead) {
      this.pluckString(this.nextStringIndex, this.nextPluckTime);
      this.nextStringIndex = (this.nextStringIndex + 1) % 4;
      this.nextPluckTime += stringSpacing + this.humanizeOffset(0.004);
    }

    this.scheduleTimer = setTimeout(() => this.schedule(), scheduleInterval);
  }

  private pluckString(stringIndex: number, when: number): void {
    const ctx = this.audioEngine.context;
    if (!ctx) return;

    const res  = STRING_RESONANCE[stringIndex];
    const freq = this.getStringFrequency(stringIndex);
    const gain = this.audioEngine.masterGainNode;
    if (!gain) return;

    // Try to use loaded sample first, fall back to synthesis
    const sampleKey = `str${stringIndex}`;
    if (this.sampleBuffers.has(sampleKey)) {
      this.playSample(this.sampleBuffers.get(sampleKey)!, when, freq, res);
    } else {
      this.synthesizePluck(ctx, freq, when, res);
    }

    this.patchState({ currentString: stringIndex });
  }

  /**
   * Synthesize a tanpura pluck using additive synthesis:
   * – Fundamental + harmonics with decaying amplitude
   * – Karplus-Strong-inspired resonance
   * – Slight frequency modulation for alap-like shimmer
   */
  private synthesizePluck(
    ctx: AudioContext,
    freq: number,
    when: number,
    res: { decay: number; brightness: number; jitter: number }
  ): void {
    const masterGain = this.audioEngine.masterGainNode;
    if (!masterGain) return;

    const num_harmonics = 10;

    for (let h = 1; h <= num_harmonics; h++) {
      const harmFreq   = freq * h;
      if (harmFreq > ctx.sampleRate / 2) break;

      // Tanpura harmonic content model: 1/h falloff with brightness boost on 3rd partial
      const baseMag = (1 / h) * res.brightness;
      const mag     = h === 3 ? baseMag * 1.4 : baseMag;

      const osc = ctx.createOscillator();
      const env = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.value = harmFreq * this.centMultiplier();
      // Humanize frequency with micro jitter
      osc.frequency.setValueAtTime(
        harmFreq * this.centMultiplier() * (1 + (Math.random() - 0.5) * res.jitter),
        when
      );

      // Exponential decay envelope
      env.gain.setValueAtTime(0, when);
      env.gain.linearRampToValueAtTime(mag * 0.18, when + 0.002);
      env.gain.setTargetAtTime(0, when + 0.01, res.decay / (h * 0.8));

      osc.connect(env);
      env.connect(masterGain);

      osc.start(when);
      osc.stop(when + res.decay * 3);
    }
  }

  private playSample(
    buffer: AudioBuffer,
    when: number,
    targetFreq: number,
    res: { decay: number; brightness: number; jitter: number }
  ): void {
    const ctx = this.audioEngine.context;
    const masterGain = this.audioEngine.masterGainNode;
    if (!ctx || !masterGain) return;

    const source = ctx.createBufferSource();
    const env    = ctx.createGain();

    // Pitch-shift sample by adjusting playbackRate
    const baseFreq = 261.63; // samples recorded at C3
    source.buffer = buffer;
    source.playbackRate.value = (targetFreq / baseFreq) * this.centMultiplier();

    env.gain.setValueAtTime(0.85 + Math.random() * 0.12, when);
    env.gain.setTargetAtTime(0, when + 0.1, res.decay);

    source.connect(env);
    env.connect(masterGain);
    source.start(when);
    source.stop(when + res.decay * 4);
  }

  // ── Frequency Calculations ─────────────────────────────

  private getStringFrequency(stringIndex: number): number {
    const { key, octave, stringConfig } = this.state;
    const baseFreq    = NOTE_FREQS[key] * Math.pow(2, octave - 4);
    const intervals   = STRING_INTERVALS[stringConfig];
    return baseFreq * intervals[stringIndex];
  }

  private centMultiplier(): number {
    return Math.pow(2, this.state.fineTune / 1200);
  }

  private humanizeOffset(maxSeconds: number): number {
    return (Math.random() - 0.5) * 2 * maxSeconds;
  }

  // ── Sample Loading ─────────────────────────────────────

  private async preloadSamples(): Promise<void> {
    // Attempt to load high-quality samples from CDN / S3
    // Falls back gracefully to synthesis if loading fails
    const sampleUrls: Record<string, string> = {
      str0: '/assets/audio/tanpura/sa-lower.mp3',
      str1: '/assets/audio/tanpura/pa.mp3',
      str2: '/assets/audio/tanpura/sa-upper.mp3',
      str3: '/assets/audio/tanpura/sa-upper.mp3'
    };

    const loadPromises = Object.entries(sampleUrls).map(async ([key, url]) => {
      try {
        const buffer = await this.audioEngine.loadSample(url);
        this.sampleBuffers.set(key, buffer);
      } catch {
        // Silently ignore missing samples — synthesis fallback handles it
      }
    });

    await Promise.allSettled(loadPromises);
    this.loadedSamples = true;
  }

  private patchState(partial: Partial<TanpuraState>): void {
    this.stateSubject.next({ ...this.stateSubject.value, ...partial });
  }
}
