import { Injectable } from '@angular/core';
import { FirebaseRemoteConfig } from '@capacitor-firebase/remote-config';
import { environment } from '../../../environments/environment';

/**
 * Remote Config service — wraps @capacitor-firebase/remote-config.
 *
 * Call `initialize()` once during app startup (APP_INITIALIZER).
 * Config values are then available synchronously via the typed getters.
 *
 * In non-production environments Remote Config is disabled and all getters
 * return the compile-time defaults — the app never crashes or waits on Firebase.
 *
 * Default keys / values:
 *   welcome_message                 → "Welcome to Swara AI"
 *   practice_session_min_duration_s → 60
 *   ear_training_rounds_per_session → 10
 *   show_iap_banner                 → false
 *   ab_signup_variant               → "control"
 */
@Injectable({ providedIn: 'root' })
export class RemoteConfigService {

  /** Compile-time defaults — used in dev and as safe fallbacks in prod */
  private readonly DEFAULTS: Record<string, string | number | boolean> = {
    welcome_message:                  'Welcome to Swara AI',
    practice_session_min_duration_s:  60,
    ear_training_rounds_per_session:  10,
    show_iap_banner:                  false,
    ab_signup_variant:                'control',
  };

  private initialized = false;

  /**
   * Fetch + activate Remote Config.
   * Should be called in APP_INITIALIZER so values are ready before first render.
   * Safe to await — failure is caught internally and defaults are used.
   */
  async initialize(): Promise<void> {
    if (!environment.enableAnalytics || !environment.firebase.projectId) {
      this.initialized = true;
      return;
    }
    try {
      // Set in-app defaults so getters work even before fetch completes
      await FirebaseRemoteConfig.setMinimumFetchInterval({
        minimumFetchIntervalInSeconds: environment.enableAnalytics ? 3600 : 0,
      });
      await FirebaseRemoteConfig.fetchAndActivate();
      this.initialized = true;
    } catch (e) {
      // Non-fatal — fall back to compile-time defaults
      console.warn('[RemoteConfig] initialize failed, using defaults:', e);
      this.initialized = true;
    }
  }

  /** Get a string config value */
  async getString(key: string): Promise<string> {
    if (!this.initialized || !environment.enableAnalytics) {
      return String(this.DEFAULTS[key] ?? '');
    }
    try {
      const { value } = await FirebaseRemoteConfig.getString({ key });
      return value ?? String(this.DEFAULTS[key] ?? '');
    } catch {
      return String(this.DEFAULTS[key] ?? '');
    }
  }

  /** Get a boolean config value */
  async getBoolean(key: string): Promise<boolean> {
    if (!this.initialized || !environment.enableAnalytics) {
      return Boolean(this.DEFAULTS[key] ?? false);
    }
    try {
      const { value } = await FirebaseRemoteConfig.getBoolean({ key });
      return value ?? Boolean(this.DEFAULTS[key] ?? false);
    } catch {
      return Boolean(this.DEFAULTS[key] ?? false);
    }
  }

  /** Get a number config value */
  async getNumber(key: string): Promise<number> {
    if (!this.initialized || !environment.enableAnalytics) {
      return Number(this.DEFAULTS[key] ?? 0);
    }
    try {
      const { value } = await FirebaseRemoteConfig.getNumber({ key });
      return value ?? Number(this.DEFAULTS[key] ?? 0);
    } catch {
      return Number(this.DEFAULTS[key] ?? 0);
    }
  }

  // ── Typed convenience accessors ─────────────────────────────────────────────

  get welcomeMessage(): Promise<string> {
    return this.getString('welcome_message');
  }

  get practiceSessionMinDurationSeconds(): Promise<number> {
    return this.getNumber('practice_session_min_duration_s');
  }

  get earTrainingRoundsPerSession(): Promise<number> {
    return this.getNumber('ear_training_rounds_per_session');
  }

  get showIapBanner(): Promise<boolean> {
    return this.getBoolean('show_iap_banner');
  }

  get abSignupVariant(): Promise<string> {
    return this.getString('ab_signup_variant');
  }
}
