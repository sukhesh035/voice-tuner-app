import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { AudioEngineService } from '@voice-tuner/audio-engine';

// ── Tanpura Configuration Types ──────────────────────────

export type MusicalKey = 'C' | 'C#' | 'D' | 'D#' | 'E' | 'F' | 'F#' | 'G' | 'G#' | 'A' | 'A#' | 'B';

export type StringConfig = 'Sa-Pa-Sa' | 'Sa-Ma-Sa' | 'Sa-Ma#-Sa';

export type Instrument = 'tanpura' | 'keyboard' | 'guitar';

export interface TanpuraState {
  isPlaying:   boolean;
  key:         MusicalKey;
  octave:      number;         // 3 or 4
  tempo:       number;         // BPM (40–120)
  volume:      number;         // 0–1
  fineTune:    number;         // cents (-100 to +100)
  stringConfig: StringConfig;
  currentString: number;       // 0–2 (which string is plucking)
  instrument:  Instrument;     // currently selected drone instrument
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

// String intervals: Sa(1/1), Pa(3/2), Sa(2/1) — Classic Kharaj Pancham
const STRING_INTERVALS: Record<StringConfig, number[]> = {
  'Sa-Pa-Sa':  [1.0, 1.5, 2.0],
  'Sa-Ma-Sa':  [1.0, 4/3, 2.0],
  'Sa-Ma#-Sa': [1.0, Math.pow(2, 6/12), 2.0]
};

// Per-string resonance parameters (simulate layered harmonic content)
const STRING_RESONANCE = [
  { decay: 4.2, brightness: 0.7, jitter: 0.008 },  // Sa (lower)
  { decay: 3.6, brightness: 0.6, jitter: 0.010 },  // Pa / Ma
  { decay: 3.8, brightness: 0.8, jitter: 0.007 },  // Sa (upper)
];

/**
 * TanpuraPlayerService
 * High-quality, Web Audio tanpura simulation using multi-harmonic synthesis,
 * resonance envelopes, and humanisation randomisation.
 */
@Injectable({ providedIn: 'root' })
export class TanpuraPlayerService {
  private readonly audioEngine = inject(AudioEngineService);

  private stateSubject = new BehaviorSubject<TanpuraState>({
    isPlaying:    false,
    key:          'C',
    octave:       3,
    tempo:        5,
    volume:       0.8,
    fineTune:     0,
    stringConfig: 'Sa-Pa-Sa',
    currentString: 0,
    instrument:   'tanpura'
  });

  // Scheduling state
  private scheduleTimer: ReturnType<typeof setTimeout> | null = null;
  private nextPluckTime = 0;
  private nextStringIndex = 0;   // simple counter, always 0→1→2→3→0→…
  private sampleBuffers = new Map<string, AudioBuffer>();
  private loadedSamples = false;

  get state$(): Observable<TanpuraState> { return this.stateSubject.asObservable(); }
  get state():  TanpuraState              { return this.stateSubject.value; }

  // ── Public API ─────────────────────────────────────────

  async play(): Promise<void> {
    await this.audioEngine.resume();
    if (!this.loadedSamples) {
      await this.preloadSamples();
    }
    // Restore master gain in case it was silenced by stop() or stopAndSilence().
    const gain = this.audioEngine.masterGainNode;
    const ctx  = this.audioEngine.context;
    if (gain && ctx) {
      gain.gain.cancelScheduledValues(ctx.currentTime);
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(this.state.volume, ctx.currentTime + 0.05);
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
    // Silence in-flight oscillator nodes that would otherwise keep decaying
    // for several seconds after the scheduler stops.
    const gain = this.audioEngine.masterGainNode;
    const ctx  = this.audioEngine.context;
    if (gain && ctx) {
      gain.gain.cancelScheduledValues(ctx.currentTime);
      gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.03);
    }
  }

  /**
   * Stop the scheduler AND immediately ramp the master gain to zero.
   * This silences all in-flight oscillator nodes (which have long decay tails
   * and would otherwise keep playing through the speakers for several seconds
   * even after stop() is called).
   * Use this before opening the microphone so the mic does not hear them.
   */
  stopAndSilence(): void {
    this.stop();
    const gain = this.audioEngine.masterGainNode;
    const ctx  = this.audioEngine.context;
    if (gain && ctx) {
      gain.gain.cancelScheduledValues(ctx.currentTime);
      gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
      // 30 ms linear ramp to zero — fast enough to be inaudible as a click,
      // but instant enough that nothing leaks into the microphone.
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.03);
    }
  }

  /**
   * Restore the master gain to the configured volume level.
   * Call this when playback resumes after a listening phase.
   */
  restoreVolume(): void {
    const gain = this.audioEngine.masterGainNode;
    const ctx  = this.audioEngine.context;
    if (gain && ctx) {
      gain.gain.cancelScheduledValues(ctx.currentTime);
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(this.state.volume, ctx.currentTime + 0.05);
    }
  }

  toggle(): Promise<void> | void {
    return this.state.isPlaying ? this.stop() : this.play();
  }

  setKey(key: MusicalKey): void {
    const wasPlaying = this.state.isPlaying;
    if (wasPlaying) this.stop();
    this.patchState({ key });
    // Call play() synchronously (not deferred) so only one scheduler loop starts.
    // A deferred setTimeout here would race with any direct play() call in the caller.
    if (wasPlaying) this.play();
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

  setInstrument(instrument: Instrument): void {
    const wasPlaying = this.state.isPlaying;
    if (wasPlaying) this.stop();
    // Clear cached samples so preloadSamples() reloads for the new instrument
    this.sampleBuffers.clear();
    this.loadedSamples = false;
    this.patchState({ instrument });
    // Call play() synchronously to avoid double-scheduler race with deferred setTimeout
    if (wasPlaying) this.play();
  }

  // ── Core Scheduling ────────────────────────────────────

  private schedule(): void {
    const lookAhead    = 0.1;  // seconds to schedule ahead
    const scheduleInterval = 25; // ms between scheduler calls

    const { tempo, isPlaying } = this.state;
    if (!isPlaying) return;

    const beatDuration       = 60 / tempo;
    const stringSpacing      = beatDuration / 3; // 3 strings per cycle

    while (this.nextPluckTime < this.audioEngine.currentTime + lookAhead) {
      this.pluckString(this.nextStringIndex, this.nextPluckTime);
      this.nextStringIndex = (this.nextStringIndex + 1) % 3;
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
   * Synthesize a pluck using the method appropriate for the current instrument.
   * Dispatches to tanpura (additive), keyboard (piano-like), or guitar (Karplus-Strong).
   */
  private synthesizePluck(
    ctx: AudioContext,
    freq: number,
    when: number,
    res: { decay: number; brightness: number; jitter: number }
  ): void {
    switch (this.state.instrument) {
      case 'keyboard':
        this.synthesizeKeyboard(ctx, freq, when, res);
        break;
      case 'guitar':
        this.synthesizeGuitar(ctx, freq, when, res);
        break;
      case 'tanpura':
      default:
        this.synthesizeTanpura(ctx, freq, when, res);
        break;
    }
  }

  /**
   * Tanpura synthesis: additive harmonics with 3rd-partial boost,
   * long exponential decay, and micro-jitter for organic shimmer.
   */
  private synthesizeTanpura(
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

      // Disconnect nodes after the oscillator finishes to prevent node accumulation
      osc.onended = () => {
        osc.disconnect();
        env.disconnect();
      };
    }
  }

  /**
   * Keyboard / piano-like synthesis:
   * Clean sine+triangle mix with fast attack, medium decay envelope.
   * Produces a bell-like, sustaining tone reminiscent of a harmonium/keyboard drone.
   */
  private synthesizeKeyboard(
    ctx: AudioContext,
    freq: number,
    when: number,
    res: { decay: number; brightness: number; jitter: number }
  ): void {
    const masterGain = this.audioEngine.masterGainNode;
    if (!masterGain) return;

    const centMul = this.centMultiplier();
    const attack  = 0.005;  // fast attack
    const decay   = res.decay * 0.6;  // shorter decay than tanpura
    const sustain = 0.35;

    // Sine fundamental
    const oscSine = ctx.createOscillator();
    const envSine = ctx.createGain();
    oscSine.type = 'sine';
    oscSine.frequency.value = freq * centMul;
    envSine.gain.setValueAtTime(0, when);
    envSine.gain.linearRampToValueAtTime(0.22 * res.brightness, when + attack);
    envSine.gain.setTargetAtTime(0.22 * sustain * res.brightness, when + attack, decay * 0.3);
    envSine.gain.setTargetAtTime(0, when + decay, decay * 0.4);
    oscSine.connect(envSine);
    envSine.connect(masterGain);
    oscSine.start(when);
    oscSine.stop(when + decay * 3);
    oscSine.onended = () => { oscSine.disconnect(); envSine.disconnect(); };

    // Triangle for warmth (one octave up, quieter)
    const oscTri = ctx.createOscillator();
    const envTri = ctx.createGain();
    oscTri.type = 'triangle';
    oscTri.frequency.value = freq * 2 * centMul;
    envTri.gain.setValueAtTime(0, when);
    envTri.gain.linearRampToValueAtTime(0.08 * res.brightness, when + attack);
    envTri.gain.setTargetAtTime(0, when + attack + 0.01, decay * 0.25);
    oscTri.connect(envTri);
    envTri.connect(masterGain);
    oscTri.start(when);
    oscTri.stop(when + decay * 2);
    oscTri.onended = () => { oscTri.disconnect(); envTri.disconnect(); };

    // Soft 3rd harmonic for body
    const osc3 = ctx.createOscillator();
    const env3 = ctx.createGain();
    osc3.type = 'sine';
    osc3.frequency.value = freq * 3 * centMul;
    env3.gain.setValueAtTime(0, when);
    env3.gain.linearRampToValueAtTime(0.04 * res.brightness, when + attack);
    env3.gain.setTargetAtTime(0, when + attack + 0.01, decay * 0.15);
    osc3.connect(env3);
    env3.connect(masterGain);
    osc3.start(when);
    osc3.stop(when + decay * 1.5);
    osc3.onended = () => { osc3.disconnect(); env3.disconnect(); };
  }

  /**
   * Guitar / plucked-string synthesis using Karplus-Strong algorithm:
   * Short noise burst excitation → delay line with lowpass feedback → natural pluck decay.
   */
  private synthesizeGuitar(
    ctx: AudioContext,
    freq: number,
    when: number,
    res: { decay: number; brightness: number; jitter: number }
  ): void {
    const masterGain = this.audioEngine.masterGainNode;
    if (!masterGain) return;

    const centMul   = this.centMultiplier();
    const targetFreq = freq * centMul;
    const sampleRate = ctx.sampleRate;
    const period     = Math.round(sampleRate / targetFreq);
    const duration   = res.decay * 2.5;

    // Create a buffer filled with noise for the excitation burst
    const bufferSize = Math.max(period, 2);
    const noiseBuffer = ctx.createBuffer(1, bufferSize, sampleRate);
    const noiseData   = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      noiseData[i] = (Math.random() * 2 - 1) * 0.85;
    }

    // Noise burst source
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    // Lowpass filter to shape the pluck tone
    const lpf = ctx.createBiquadFilter();
    lpf.type = 'lowpass';
    // Higher brightness → higher cutoff → brighter pluck
    lpf.frequency.value = Math.min(targetFreq * (4 + res.brightness * 6), sampleRate / 2);
    lpf.Q.value = 0.5;

    // Delay line for Karplus-Strong resonance
    const delay = ctx.createDelay(1);
    delay.delayTime.value = 1 / targetFreq;

    // Feedback gain — controls how long the string rings
    const feedback = ctx.createGain();
    // Higher value = longer sustain; 0.996 gives a natural guitar ring
    feedback.gain.value = 0.996;

    // Output envelope
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.20 * res.brightness, when);
    env.gain.setTargetAtTime(0, when + 0.05, duration * 0.35);

    // Signal chain: noise → lpf → env → masterGain
    //                              ↑ delay ← feedback ← ↓
    noise.connect(lpf);
    lpf.connect(env);
    env.connect(masterGain);

    // Feedback loop: env → delay → feedback → lpf
    env.connect(delay);
    delay.connect(feedback);
    feedback.connect(lpf);

    noise.start(when);
    noise.stop(when + bufferSize / sampleRate);

    // Schedule cleanup: ramp to zero and disconnect all nodes after decay.
    // The timeout breaks the feedback loop (delay→feedback→lpf) which never
    // self-terminates because setTargetAtTime only approaches zero asymptotically.
    const cleanupMs = (duration + 0.1 - ctx.currentTime + when) * 1000;
    const cleanupDelay = Math.max(0, cleanupMs);
    setTimeout(() => {
      try {
        env.disconnect();
        delay.disconnect();
        feedback.disconnect();
        lpf.disconnect();
        noise.disconnect();
      } catch {
        // Nodes may already be disconnected — safe to ignore
      }
    }, cleanupDelay);
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

    // Disconnect nodes after playback ends to prevent node accumulation
    source.onended = () => {
      source.disconnect();
      env.disconnect();
    };
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
    // Load samples from the directory matching the current instrument
    const instrument = this.state.instrument;
    const sampleUrls: Record<string, string> = {
      str0: `/assets/audio/${instrument}/sa-lower.mp3`,
      str1: `/assets/audio/${instrument}/pa.mp3`,
      str2: `/assets/audio/${instrument}/sa-upper.mp3`,
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
