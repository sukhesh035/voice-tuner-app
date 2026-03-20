import { Injectable } from '@angular/core';
import { FirebaseCrashlytics } from '@capacitor-firebase/crashlytics';
import { Capacitor } from '@capacitor/core';
import { environment } from '../../../environments/environment';

/**
 * Crashlytics service — captures crashes, non-fatal errors, and custom logs.
 *
 * Only active on native platforms (iOS/Android) in production.
 * On web, errors are forwarded to console.error so dev tooling still catches them.
 *
 * Usage:
 *   crashlytics.recordError(err, 'AudioEngine');
 *   crashlytics.log('User started raga practice');
 *   crashlytics.setUserId('user-123');
 */
@Injectable({ providedIn: 'root' })
export class CrashlyticsService {

  private get isActive(): boolean {
    return environment.enableAnalytics && Capacitor.isNativePlatform();
  }

  /** Record a non-fatal error — appears in Crashlytics dashboard under "Non-fatals" */
  async recordError(error: Error | unknown, context?: string): Promise<void> {
    const err = error instanceof Error ? error : new Error(String(error));
    if (!this.isActive) {
      console.error(`[Crashlytics${context ? '/' + context : ''}]`, err);
      return;
    }
    try {
      // Log a breadcrumb first so we see context in the crash report
      if (context) {
        await FirebaseCrashlytics.log({ message: `Error context: ${context}` });
      }
      await FirebaseCrashlytics.recordException({
        message: err.message,
        // stacktrace format expected by Capacitor Firebase Crashlytics
        stacktrace: err.stack
          ? err.stack.split('\n').slice(1).map(line => {
              const match = line.trim().match(/^at (.+?) \((.+?):(\d+):(\d+)\)$/);
              if (match) {
                return { className: '', methodName: match[1], fileName: match[2], lineNumber: parseInt(match[3]) };
              }
              return { className: '', methodName: line.trim(), fileName: 'unknown', lineNumber: 0 };
            })
          : [],
      });
    } catch (e) {
      console.warn('[Crashlytics] recordError failed:', e);
    }
  }

  /** Add a breadcrumb log message — visible in crash reports alongside the crash */
  async log(message: string): Promise<void> {
    if (!this.isActive) return;
    try {
      await FirebaseCrashlytics.log({ message });
    } catch (e) {
      console.warn('[Crashlytics] log failed:', e);
    }
  }

  /** Link this crash session to a user (use after login) */
  async setUserId(userId: string): Promise<void> {
    if (!this.isActive) return;
    try {
      await FirebaseCrashlytics.setUserId({ userId });
    } catch (e) {
      console.warn('[Crashlytics] setUserId failed:', e);
    }
  }

  /** Unlink the user (use on sign-out) */
  async clearUserId(): Promise<void> {
    if (!this.isActive) return;
    try {
      await FirebaseCrashlytics.setUserId({ userId: '' });
    } catch (e) {
      console.warn('[Crashlytics] clearUserId failed:', e);
    }
  }

  /** Add a custom string key-value visible in crash reports */
  async setAttribute(key: string, value: string): Promise<void> {
    if (!this.isActive) return;
    try {
      await FirebaseCrashlytics.setCustomKey({ key, value, type: 'string' });
    } catch (e) {
      console.warn('[Crashlytics] setAttribute failed:', e);
    }
  }

  /**
   * Force a test crash (development only).
   * Call this from settings in a debug build to verify the Crashlytics pipeline.
   */
  async testCrash(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      console.warn('[Crashlytics] testCrash only works on native platforms');
      return;
    }
    await FirebaseCrashlytics.crash({ message: 'Test crash from Swara AI' });
  }
}
