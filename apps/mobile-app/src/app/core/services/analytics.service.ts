import { Injectable } from '@angular/core';
import { FirebaseAnalytics } from '@capacitor-firebase/analytics';
import { Capacitor } from '@capacitor/core';
import { environment } from '../../../environments/environment';

/**
 * Thin wrapper around @capacitor-firebase/analytics.
 *
 * On native (iOS/Android) calls are forwarded to the Firebase SDK.
 * On web it calls the JS SDK directly (already initialised in main.ts).
 *
 * Analytics is only enabled when environment.enableAnalytics === true (production only).
 *
 * Usage:
 *   analytics.logEvent('practice_started', { mode: 'shruti' });
 *   analytics.setScreen('Practice');
 */
@Injectable({ providedIn: 'root' })
export class AnalyticsService {

  constructor() {
    // Disable analytics collection in all non-production environments
    if (!environment.enableAnalytics) {
      this.setEnabled(false);
    }
  }

  /** Log a custom analytics event */
  async logEvent(name: string, params?: Record<string, string | number | boolean>): Promise<void> {
    if (!environment.enableAnalytics) return;
    try {
      await FirebaseAnalytics.logEvent({ name, params });
    } catch (err) {
      console.warn('[Analytics] logEvent failed:', err);
    }
  }

  /** Set the current screen name (sent with subsequent events) */
  async setScreen(screenName: string): Promise<void> {
    if (!environment.enableAnalytics) return;
    try {
      await FirebaseAnalytics.setCurrentScreen({ screenName });
    } catch (err) {
      console.warn('[Analytics] setScreen failed:', err);
    }
  }

  /** Associate subsequent events with a user id (use after login) */
  async setUserId(userId: string | null): Promise<void> {
    if (!environment.enableAnalytics) return;
    try {
      await FirebaseAnalytics.setUserId({ userId });
    } catch (err) {
      console.warn('[Analytics] setUserId failed:', err);
    }
  }

  /** Set a persistent user property */
  async setUserProperty(key: string, value: string): Promise<void> {
    if (!environment.enableAnalytics) return;
    try {
      await FirebaseAnalytics.setUserProperty({ key, value });
    } catch (err) {
      console.warn('[Analytics] setUserProperty failed:', err);
    }
  }

  /** Enable / disable analytics collection (e.g. based on user consent) */
  async setEnabled(enabled: boolean): Promise<void> {
    try {
      await FirebaseAnalytics.setEnabled({ enabled });
    } catch (err) {
      console.warn('[Analytics] setEnabled failed:', err);
    }
  }

  /** Returns true when running on a real native device (not browser) */
  get isNative(): boolean {
    return Capacitor.isNativePlatform();
  }
}
