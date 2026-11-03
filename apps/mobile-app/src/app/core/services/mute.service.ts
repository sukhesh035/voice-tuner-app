import { Injectable, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Mute } from '@capgo/capacitor-mute';

/**
 * Tracks the device's silent/mute state so the UI can warn users that
 * they won't hear the metronome/tanpura sound.
 *
 * The mute plugin has no change event, so we poll the hardware switch
 * every few seconds (a native property read — negligible cost).
 */
@Injectable({ providedIn: 'root' })
export class MuteService {
  readonly isMuted = signal(false);
  private timer: ReturnType<typeof setInterval> | null = null;

  /** Begin polling. Idempotent — safe to call from multiple components. */
  start(): void {
    if (this.timer !== null) return;
    void this.check();
    this.timer = setInterval(() => void this.check(), 3000);
  }

  async check(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    try {
      const { value } = await Mute.isMuted();
      this.isMuted.set(value);
    } catch {
      // Leave the previous state on failure.
    }
  }
}
