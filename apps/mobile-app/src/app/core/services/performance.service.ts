import { Injectable } from '@angular/core';
import { FirebasePerformance } from '@capacitor-firebase/performance';
import { Capacitor } from '@capacitor/core';
import { environment } from '../../../environments/environment';

/**
 * Performance monitoring service — wraps @capacitor-firebase/performance.
 *
 * Only active on native platforms (iOS/Android) in production.
 * On web/dev, all calls are silent no-ops so the app never crashes.
 *
 * Usage:
 *   await performance.startTrace('audio_load');
 *   // ... do work ...
 *   await performance.stopTrace('audio_load');
 */
@Injectable({ providedIn: 'root' })
export class PerformanceService {

  /** Active trace names — prevents double-start bugs */
  private activeTraces = new Set<string>();

  private get isActive(): boolean {
    return environment.enableAnalytics && Capacitor.isNativePlatform();
  }

  /**
   * Start a named custom trace.
   * Safe to call even if the trace is already active — will skip silently.
   */
  async startTrace(traceName: string): Promise<void> {
    if (!this.isActive) return;
    if (this.activeTraces.has(traceName)) return;
    try {
      await FirebasePerformance.startTrace({ traceName });
      this.activeTraces.add(traceName);
    } catch (e) {
      console.warn(`[Performance] startTrace(${traceName}) failed:`, e);
    }
  }

  /**
   * Stop a named custom trace.
   * Safe to call even if the trace was never started — will skip silently.
   */
  async stopTrace(traceName: string): Promise<void> {
    if (!this.isActive) return;
    if (!this.activeTraces.has(traceName)) return;
    try {
      await FirebasePerformance.stopTrace({ traceName });
      this.activeTraces.delete(traceName);
    } catch (e) {
      console.warn(`[Performance] stopTrace(${traceName}) failed:`, e);
      // Always remove from active set even on error to prevent leaks
      this.activeTraces.delete(traceName);
    }
  }

  /**
   * Record a one-shot duration trace: starts immediately and stops after
   * the provided async work completes. Returns the value from the work fn.
   *
   * Usage:
   *   const result = await perf.trace('raga_load', () => loadRaga());
   */
  async trace<T>(traceName: string, work: () => Promise<T>): Promise<T> {
    await this.startTrace(traceName);
    try {
      return await work();
    } finally {
      await this.stopTrace(traceName);
    }
  }

  /**
   * Start the app_startup trace — call as early as possible in app boot.
   * Stop it once the main page is rendered (e.g. in APP_INITIALIZER after
   * router navigation settles).
   */
  async startAppStartupTrace(): Promise<void> {
    await this.startTrace('app_startup');
  }

  async stopAppStartupTrace(): Promise<void> {
    await this.stopTrace('app_startup');
  }

  /**
   * Wraps a screen render with a trace named `screen_<screenName>`.
   * Starts on navigation begin, stops once the route has settled.
   */
  async startScreenTrace(screenName: string): Promise<void> {
    await this.startTrace(`screen_${screenName.toLowerCase().replace(/\s+/g, '_')}`);
  }

  async stopScreenTrace(screenName: string): Promise<void> {
    await this.stopTrace(`screen_${screenName.toLowerCase().replace(/\s+/g, '_')}`);
  }
}
