import { Injectable, inject } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { FirebaseMessaging } from '@capacitor-firebase/messaging';
import { AppTrackingTransparency } from 'capacitor-plugin-app-tracking-transparency';
import { ApiService } from './api.service';
import { PushNotificationService } from './push-notification.service';
import { AnalyticsService } from './analytics.service';

export type PermissionState = 'granted' | 'denied' | 'prompt';
export type TrackingStatus = 'authorized' | 'denied' | 'notDetermined' | 'restricted';

/**
 * Centralized service for managing app permissions (microphone, notifications, tracking).
 * Tracks real OS-level permission state and syncs it to the user profile in DynamoDB.
 *
 * On first launch after auth, call `requestAllOnFirstLaunch()` to prompt all permissions.
 * The settings page uses `checkPermissions()` to display current state, and
 * `requestMicPermission()` / `requestNotificationPermission()` to re-prompt
 * or open system settings when denied.
 */
@Injectable({ providedIn: 'root' })
export class PermissionsService {
  private readonly api         = inject(ApiService);
  private readonly pushService = inject(PushNotificationService);
  private readonly analytics   = inject(AnalyticsService);

  micPermission: PermissionState = 'prompt';
  notificationPermission: PermissionState = 'prompt';
  trackingStatus: TrackingStatus = 'notDetermined';

  /**
   * Check current OS-level permission states for mic, notifications, and tracking (iOS).
   * Updates local state and returns all three.
   *
   * Note: navigator.permissions.query({ name: 'microphone' }) is unreliable
   * inside Android WebView — it may return 'prompt' even when the OS has
   * already denied the permission. We therefore rely on the cached value
   * set by requestMicPermission() and only fall back to the Permissions API
   * on platforms where it is known to work (web/PWA).
   */
  async checkPermissions(): Promise<{ mic: PermissionState; notification: PermissionState; tracking: TrackingStatus }> {
    // Microphone — on native platforms trust the cached value from the last
    // requestMicPermission() call rather than the unreliable WebView API.
    if (!Capacitor.isNativePlatform()) {
      try {
        const micStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        this.micPermission = micStatus.state as PermissionState;
      } catch {
        // Permissions API not supported — keep existing cached value
      }
    }
    // On native, this.micPermission already holds the correct state from the
    // most recent requestMicPermission() call — no update needed here.

    // Notifications — use Capacitor plugin on native, Notification API on web
    if (Capacitor.isNativePlatform()) {
      try {
        const result = await FirebaseMessaging.checkPermissions();
        this.notificationPermission = result.receive === 'granted' ? 'granted'
          : result.receive === 'denied' ? 'denied'
          : 'prompt';
      } catch {
        this.notificationPermission = 'prompt';
      }
    } else {
      // Web/PWA fallback
      if ('Notification' in window) {
        this.notificationPermission = Notification.permission === 'granted' ? 'granted'
          : Notification.permission === 'denied' ? 'denied'
          : 'prompt';
      }
    }

    // ATT tracking — iOS only; on Android/web treat as authorized
    if (Capacitor.getPlatform() === 'ios') {
      try {
        const { status } = await AppTrackingTransparency.getStatus();
        this.trackingStatus = status as TrackingStatus;
      } catch {
        this.trackingStatus = 'notDetermined';
      }
    } else {
      this.trackingStatus = 'authorized';
    }

    return { mic: this.micPermission, notification: this.notificationPermission, tracking: this.trackingStatus };
  }

  /**
   * Request microphone permission. Returns the resulting state.
   *
   * On Android, the RECORD_AUDIO permission must be declared in AndroidManifest.xml
   * (handled by patch-android.mjs). Once declared, Capacitor's WebView will show
   * the native Android system dialog when getUserMedia is called.
   * On iOS and web, getUserMedia alone triggers the system prompt.
   */
  async requestMicPermission(): Promise<PermissionState> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Got access — immediately stop the stream, we just needed the permission
      stream.getTracks().forEach(t => t.stop());
      this.micPermission = 'granted';
    } catch (err: unknown) {
      const name = err instanceof DOMException ? err.name : '';
      // NotAllowedError = user denied; NotFoundError = no mic hardware
      this.micPermission = name === 'NotAllowedError' ? 'denied' : 'denied';
    }

    await this.syncToBackend();
    return this.micPermission;
  }

  /**
   * Request notification permission. Returns the resulting state.
   * On native, delegates to PushNotificationService.initialize() which handles
   * registration + token exchange.
   */
  async requestNotificationPermission(): Promise<PermissionState> {
    if (Capacitor.isNativePlatform()) {
      try {
        const result = await FirebaseMessaging.requestPermissions();
        this.notificationPermission = result.receive === 'granted' ? 'granted' : 'denied';
        if (this.notificationPermission === 'granted') {
          await this.pushService.initialize();
        }
      } catch {
        this.notificationPermission = 'denied';
      }
    } else {
      // Web/PWA
      if ('Notification' in window) {
        const result = await Notification.requestPermission();
        this.notificationPermission = result === 'granted' ? 'granted'
          : result === 'denied' ? 'denied'
          : 'prompt';
      }
    }

    await this.syncToBackend();
    return this.notificationPermission;
  }

  /**
   * Prompt both permissions on first launch. Called once after first auth.
   * Mic is requested first (essential for the app), then notifications,
   * then ATT tracking (iOS only).
   */
  async requestAllOnFirstLaunch(): Promise<void> {
    await this.requestMicPermission();
    await this.requestNotificationPermission();
    await this.requestTrackingPermission();
  }

  /**
   * Request App Tracking Transparency permission (iOS 14+ only).
   * On Android and web this is a no-op and always returns 'authorized'.
   * Enables or disables Firebase Analytics based on the user's decision.
   */
  async requestTrackingPermission(): Promise<TrackingStatus> {
    if (Capacitor.getPlatform() === 'ios') {
      try {
        const { status } = await AppTrackingTransparency.requestPermission();
        this.trackingStatus = status as TrackingStatus;
      } catch {
        this.trackingStatus = 'denied';
      }
    } else {
      this.trackingStatus = 'authorized';
    }

    // Enable analytics only when the user has explicitly authorized tracking.
    await this.analytics.setEnabled(this.trackingStatus === 'authorized');

    return this.trackingStatus;
  }

  /**
   * Open the OS settings page for this app so the user can toggle
   * permissions that were previously denied.
   * On iOS, opens the app's section in the Settings app.
   * On Android, opens the app details in system settings.
   * Falls back to a no-op on web.
   */
  async openAppSettings(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;

    const platform = Capacitor.getPlatform();
    if (platform === 'ios') {
      // On iOS, app-settings: opens the app's own Settings page
      window.open('app-settings:', '_system');
    } else if (platform === 'android') {
      // On Android, open the app's detail settings page using a proper intent URI.
      // The intent:// scheme with the ACTION_APPLICATION_DETAILS_SETTINGS action
      // is the correct format for navigating to app permissions in Android settings.
      const { App } = await import('@capacitor/app');
      const info = await App.getInfo();
      window.open(
        `intent:#Intent;action=android.settings.APPLICATION_DETAILS_SETTINGS;data=package:${info.id};end`,
        '_system'
      );
    }
  }

  /**
   * Sync current permission states to the user profile in DynamoDB.
   */
  private async syncToBackend(): Promise<void> {
    try {
      await this.api.updatePreferences({
        micPermissionGranted: this.micPermission === 'granted',
        notificationsEnabled: this.notificationPermission === 'granted',
      });
    } catch (err) {
      console.error('[Permissions] Failed to sync to backend', err);
    }
  }
}
