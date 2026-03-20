import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { FirebaseMessaging } from '@capacitor-firebase/messaging';
import { ApiService } from './api.service';
import { AnalyticsService } from './analytics.service';

/**
 * Manages push notification registration, FCM token lifecycle, and foreground
 * notification handling via @capacitor-firebase/messaging.
 *
 * On web/PWA this is a no-op — push is only supported on native iOS/Android.
 */
@Injectable({ providedIn: 'root' })
export class PushNotificationService {
  private initialized = false;
  private currentToken: string | null = null;

  constructor(
    private api: ApiService,
    private analytics: AnalyticsService,
  ) {}

  /**
   * Call once after the user is authenticated and notification permission is granted.
   * Gets the FCM token and sends it to the backend.
   */
  async initialize(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    if (this.initialized) return;

    this.addListeners();

    try {
      const { token } = await FirebaseMessaging.getToken();
      console.log('[Push] FCM token:', token);
      this.currentToken = token;
      const platform = Capacitor.getPlatform() as 'ios' | 'android';
      await this.api.registerDeviceToken(token, platform);
      this.analytics.logEvent('push_token_registered', { platform });
    } catch (err) {
      console.error('[Push] Failed to get/register FCM token', err);
    }

    this.initialized = true;
  }

  /**
   * Unregister from push notifications and remove the device token
   * from the backend.
   */
  async unregister(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    if (!this.initialized) return;

    try {
      if (this.currentToken) {
        await this.api.deleteDeviceToken(this.currentToken);
        this.currentToken = null;
      }
      await FirebaseMessaging.deleteToken();
    } catch (err) {
      console.error('[Push] Failed to unregister', err);
    }

    await FirebaseMessaging.removeAllListeners();
    this.initialized = false;
  }

  private addListeners(): void {
    // Token refreshed — re-register with backend
    FirebaseMessaging.addListener('tokenReceived', async ({ token }) => {
      console.log('[Push] Token refreshed:', token);
      if (token !== this.currentToken) {
        this.currentToken = token;
        const platform = Capacitor.getPlatform() as 'ios' | 'android';
        try {
          await this.api.registerDeviceToken(token, platform);
        } catch (err) {
          console.error('[Push] Failed to register refreshed token', err);
        }
      }
    });

    // Notification received while app is in foreground
    FirebaseMessaging.addListener('notificationReceived', ({ notification }) => {
      console.log('[Push] Foreground notification:', notification);
      this.analytics.logEvent('push_received_foreground', {
        title: notification.title ?? '',
      });
    });

    // User dismissed a notification (swiped away without tapping)
    FirebaseMessaging.addListener('notificationReceived', ({ notification }) => {
      // We can't directly detect dismiss on iOS/Android from Capacitor, but
      // logNotificationDismissed can be called explicitly from UI components
      // when the user swipes away an in-app banner. This listener is a stub.
      void notification; // suppress unused warning
    });

    // User tapped a notification
    FirebaseMessaging.addListener('notificationActionPerformed', ({ notification }) => {
      console.log('[Push] Notification tapped:', notification);
      this.analytics.logEvent('push_tapped', {
        title: notification.title ?? '',
      });
      // Future: deep-link based on notification.data
    });
  }
}
