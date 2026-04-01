import { Injectable } from '@angular/core';
import { FirebaseAnalytics } from '@capacitor-firebase/analytics';
import { Capacitor } from '@capacitor/core';
import { environment } from '../../../environments/environment';

// On iOS in production, disable analytics collection immediately at module load
// time — before any event can fire — so we do not collect data before the user
// has seen and responded to the App Tracking Transparency prompt.
// PermissionsService.requestTrackingPermission() will call setEnabled(true) once
// the user authorizes tracking. On Android and web, ATT does not apply.
if (environment.enableAnalytics && Capacitor.getPlatform() === 'ios') {
  FirebaseAnalytics.setEnabled({ enabled: false }).catch(() => {});
}

export type SubscriptionTier = 'free' | 'paid';

export interface UserProperties {
  preferred_key?: string;
  practice_streak?: number;
  subscription_tier?: SubscriptionTier;
  platform?: 'ios' | 'android' | 'web';
  days_since_signup?: number;
}

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
 *   analytics.setUserProperties({ preferred_key: 'C', practice_streak: 7 });
 */
@Injectable({ providedIn: 'root' })
export class AnalyticsService {

  // No constructor needed — iOS analytics is disabled at module load (see top-level
  // guard above) and re-enabled by PermissionsService after ATT consent is granted.

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

  /**
   * Batch-set typed user properties.
   * All values are coerced to strings as required by the Firebase SDK.
   * Skips any key with undefined value.
   */
  async setUserProperties(props: UserProperties): Promise<void> {
    if (!environment.enableAnalytics) return;
    const entries = Object.entries(props) as [string, string | number | boolean | undefined][];
    for (const [key, value] of entries) {
      if (value === undefined) continue;
      await this.setUserProperty(key, String(value));
    }
  }

  /** Enable / disable analytics collection (e.g. based on user consent) */
  async setEnabled(enabled: boolean): Promise<void> {
    if (!environment.firebase.projectId) return;
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

  // ── Typed event helpers ──────────────────────────────────────────────────────

  /** Fired when a full practice session ends naturally (not abandoned) */
  async logSessionCompleted(params: {
    mode: string;
    duration_seconds: number;
    accuracy: number;
    notes_hit: number;
  }): Promise<void> {
    await this.logEvent('session_completed', params);
  }

  /** Fired when the user taps "End Session" before completing a round */
  async logPracticeAbandoned(params: {
    mode: string;
    time_before_stop_seconds: number;
  }): Promise<void> {
    await this.logEvent('practice_abandoned', params);
  }

  /** Login funnel step — call at each stage of the login flow */
  async logLoginFunnelStep(step: 'opened' | 'email_entered' | 'submitted'): Promise<void> {
    await this.logEvent('login_funnel_step', { step });
  }

  /** Signup funnel step — call at each stage of the signup flow */
  async logSignupFunnelStep(step: 'opened' | 'email_entered' | 'submitted'): Promise<void> {
    await this.logEvent('signup_funnel_step', { step });
  }

  /** Rolling note accuracy trend — call after each shruti round */
  async logNoteAccuracyTrend(params: {
    note: string;
    rolling_avg: number;
  }): Promise<void> {
    await this.logEvent('note_accuracy_trend', params);
  }

  /** Number of sessions completed today */
  async logDailySessionCount(count: number): Promise<void> {
    await this.logEvent('daily_session_count', { count });
  }

  /** IAP flow events (stub — wire to real purchase flow when ready) */
  async logPurchaseInitiated(productId: string): Promise<void> {
    await this.logEvent('purchase_initiated', { product_id: productId });
  }

  async logPurchaseCompleted(productId: string, price: number): Promise<void> {
    await this.logEvent('purchase_completed', { product_id: productId, price });
  }

  async logPurchaseFailed(productId: string, reason: string): Promise<void> {
    await this.logEvent('purchase_failed', { product_id: productId, reason });
  }

  /** User dismissed a push notification banner */
  async logNotificationDismissed(title: string): Promise<void> {
    await this.logEvent('notification_dismissed', { title });
  }

  /** User subscribed to a push topic */
  async logNotificationTopicSubscribed(topic: string): Promise<void> {
    await this.logEvent('notification_topic_subscribed', { topic });
  }
}
