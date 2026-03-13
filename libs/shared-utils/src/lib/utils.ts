// ── Music Theory Utilities ──────────────────────────────────

export const NOTES_WESTERN = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'] as const;
export type WesternNote = typeof NOTES_WESTERN[number];

/**
 * Convert a frequency to the nearest MIDI note number.
 */
export function freqToMidi(freq: number): number {
  return 12 * Math.log2(freq / 440) + 69;
}

/**
 * Convert a MIDI note number to frequency in Hz.
 */
export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Calculate cents offset from exact note.
 */
export function getCentsOff(freq: number): number {
  const midi    = freqToMidi(freq);
  const rounded = Math.round(midi);
  return (midi - rounded) * 100;
}

/**
 * Get the Western note name from a frequency.
 */
export function freqToNoteName(freq: number): WesternNote {
  const midi      = Math.round(freqToMidi(freq));
  const noteIndex = ((midi % 12) + 12) % 12;
  return NOTES_WESTERN[noteIndex];
}

/**
 * Transpose a frequency by a given number of semitones.
 */
export function transposeSemitones(freq: number, semitones: number): number {
  return freq * Math.pow(2, semitones / 12);
}

/**
 * Transpose a frequency by cents.
 */
export function transposeCents(freq: number, cents: number): number {
  return freq * Math.pow(2, cents / 1200);
}

// ── Time Utilities ────────────────────────────────────────

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours   = Math.floor(diff / 3600000);
  const days    = Math.floor(diff / 86400000);
  if (days > 0)    return `${days}d ago`;
  if (hours > 0)   return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}

// ── Math / Signal Utilities ──────────────────────────────

/**
 * Exponential moving average.
 */
export function ema(prev: number, current: number, alpha = 0.1): number {
  return alpha * current + (1 - alpha) * prev;
}

/**
 * Clamp a value between min and max.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Linear interpolation.
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp(t, 0, 1);
}

/**
 * Generate a random code string (for session codes).
 */
export function generateSessionCode(length = 6): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// ── Storage Utilities ─────────────────────────────────────

export function safeLocalGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw !== null ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function safeLocalSet(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}
