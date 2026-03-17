import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { ApiService } from './api.service';
import { PushNotificationService } from './push-notification.service';

export type PermissionState = 'granted' | 'denied' | 'prompt';

/**
 * Centralized service for managing app permissions (microphone + notifications).
 * Tracks real OS-level permission state and syncs it to the user profile in DynamoDB.
 *
 * On first launch after auth, call `requestAllOnFirstLaunch()` to prompt both.
 * The settings page uses `checkPermissions()` to display current state, and
 * `requestMicPermission()` / `requestNotificationPermission()` to re-prompt
 * or open system settings when denied.
 */
@Injectable({ providedIn: 'root' })
export class PermissionsService {
  micPermission: PermissionState = 'prompt';
  notificationPermission: PermissionState = 'prompt';

  constructor(
    private api: ApiService,
    private pushService: PushNotificationService,
  ) {}

  /**
   * Check current OS-level permission states for mic and notifications.
   * Updates local state and returns both.
   */
  async checkPermissions(): Promise<{ mic: PermissionState; notification: PermissionState }> {
    // Microphone — uses standard browser Permissions API
    try {
      const micStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      this.micPermission = micStatus.state as PermissionState;
    } catch {
      // Permissions API not supported (some WebViews) — assume prompt
      this.micPermission = 'prompt';
    }

    // Notifications — use Capacitor plugin on native, Notification API on web
    if (Capacitor.isNativePlatform()) {
      try {
        const result = await PushNotifications.checkPermissions();
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

    return { mic: this.micPermission, notification: this.notificationPermission };
  }

  /**
   * Request microphone permission. Returns the resulting state.
   * If denied, on native platforms opens system settings.
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
        const result = await PushNotifications.requestPermissions();
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
   * Mic is requested first (essential for the app), then notifications.
   */
  async requestAllOnFirstLaunch(): Promise<void> {
    await this.requestMicPermission();
    await this.requestNotificationPermission();
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
      // On Android, open the app's detail settings page
      const { App } = await import('@capacitor/app');
      const info = await App.getInfo();
      window.open(`android.settings.APPLICATION_DETAILS_SETTINGS:package:${info.id}`, '_system');
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
