import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token, ActionPerformed, PushNotificationSchema } from '@capacitor/push-notifications';
import { ApiService } from './api.service';
import { AnalyticsService } from './analytics.service';

/**
 * Manages push notification registration, token lifecycle, and foreground
 * notification handling via Capacitor's PushNotifications plugin.
 *
 * On web/PWA this is a no-op — push is only supported on native iOS/Android.
 */
@Injectable({ providedIn: 'root' })
export class PushNotificationService {
  private registered = false;
  private currentToken: string | null = null;

  constructor(
    private api: ApiService,
    private analytics: AnalyticsService,
  ) {}

  /**
   * Call once after the user is authenticated. Requests permission,
   * registers for push, and sends the device token to the backend.
   */
  async initialize(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    if (this.registered) return;

    this.addListeners();

    const permResult = await PushNotifications.checkPermissions();
    if (permResult.receive === 'prompt' || permResult.receive === 'prompt-with-rationale') {
      const reqResult = await PushNotifications.requestPermissions();
      if (reqResult.receive !== 'granted') {
        console.log('[Push] Permission denied');
        return;
      }
    } else if (permResult.receive !== 'granted') {
      console.log('[Push] Permission not granted:', permResult.receive);
      return;
    }

    await PushNotifications.register();
    this.registered = true;
  }

  /**
   * Unregister from push notifications and remove the device token
   * from the backend.
   */
  async unregister(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    if (!this.registered) return;

    try {
      if (this.currentToken) {
        await this.api.deleteDeviceToken(this.currentToken);
        this.currentToken = null;
      }
    } catch (err) {
      console.error('[Push] Failed to delete device token', err);
    }

    await PushNotifications.removeAllListeners();
    this.registered = false;
  }

  private addListeners(): void {
    // Token received — send to backend
    PushNotifications.addListener('registration', async (token: Token) => {
      console.log('[Push] Token:', token.value);
      this.currentToken = token.value;
      const platform = Capacitor.getPlatform() as 'ios' | 'android';
      try {
        await this.api.registerDeviceToken(token.value, platform);
        this.analytics.logEvent('push_token_registered', { platform });
      } catch (err) {
        console.error('[Push] Failed to register token with backend', err);
      }
    });

    // Registration error
    PushNotifications.addListener('registrationError', (err) => {
      console.error('[Push] Registration error:', err);
    });

    // Notification received while app is in foreground
    PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
      console.log('[Push] Foreground notification:', notification);
      this.analytics.logEvent('push_received_foreground', {
        title: notification.title ?? '',
      });
    });

    // User tapped a notification
    PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
      console.log('[Push] Notification tapped:', action.notification);
      this.analytics.logEvent('push_tapped', {
        title: action.notification.title ?? '',
      });
      // Future: deep-link based on action.notification.data
    });
  }
}
