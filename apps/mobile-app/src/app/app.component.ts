import { Component, OnInit, inject } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { Capacitor } from '@capacitor/core';
import { ThemeService } from './core/services/theme.service';
import { AuthService } from '@voice-tuner/auth';
import { ApiService } from './core/services/api.service';
import { LiveUpdateService } from './core/services/live-update.service';
import { PushNotificationService } from './core/services/push-notification.service';
import { PermissionsService } from './core/services/permissions.service';

// On a real device over cellular/WiFi, Cognito's fetchAuthSession can take
// 300–800ms. Cap the wait so a slow or offline network never freezes the app.
const AUTH_INIT_TIMEOUT_MS = 5000;

// Minimum time (ms) the animated splash overlay stays visible so the user
// always sees the full entry animation on both iOS and Android.
const SPLASH_MIN_DISPLAY_MS = 2000;

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [IonApp, IonRouterOutlet],
  template: `
    <ion-app>
      <ion-router-outlet></ion-router-outlet>
    </ion-app>
  `
})
export class AppComponent implements OnInit {
  private readonly themeService    = inject(ThemeService);
  private readonly authService     = inject(AuthService);
  private readonly api             = inject(ApiService);
  private readonly liveUpdate      = inject(LiveUpdateService);
  private readonly pushNotification = inject(PushNotificationService);
  private readonly permissions     = inject(PermissionsService);

  ngOnInit(): void {
    this.themeService.initialize();

    // Record start time to enforce minimum splash display duration.
    const splashStart = Date.now();

    // Hard cap: always hide splash after 3s no matter what, so a network
    // failure or hung promise never leaves the user stuck on the splash.
    const hardCapTimer = setTimeout(() => this.hideSplash(), 3000);

    // Start live-update check early (non-blocking). On the web this is a no-op.
    this.liveUpdate.initialize();

    // Race auth init against a timeout so a slow/offline Cognito call never
    // blocks the whole app from rendering.
    const timeout = new Promise<void>(resolve => setTimeout(resolve, AUTH_INIT_TIMEOUT_MS));
    Promise.race([this.authService.initialize(), timeout]).then(async () => {
      if (this.authService.currentUser) {
        try {
          // Ensure user record exists in DynamoDB after session restore
          const profile = await this.api.getProfile();

          // First launch: if mic permission was never granted, prompt both
          // mic + notification permissions upfront
          if (!profile.preferences?.micPermissionGranted) {
            await this.permissions.requestAllOnFirstLaunch();
          } else {
            // Returning user: just sync permission state and init push if enabled
            await this.permissions.checkPermissions();
            if (profile.preferences?.notificationsEnabled) {
              this.pushNotification.initialize().catch((err) =>
                console.error('[App] Push notification init failed', err)
              );
            }
          }
        } catch (err) {
          console.error('[App] Profile/permissions init failed', err);
        }
      }

      // Wait until at least SPLASH_MIN_DISPLAY_MS has elapsed so the user
      // always sees the full native splash before it hides.
      const elapsed = Date.now() - splashStart;
      const remaining = Math.max(0, SPLASH_MIN_DISPLAY_MS - elapsed);
      setTimeout(() => {
        clearTimeout(hardCapTimer);
        this.hideSplash();
      }, remaining);
    }).catch(() => this.hideSplash());
  }

  /**
   * Hide the native Capacitor splash screen with a smooth fade.
   * No-op on web.
   */
  private hideSplash(): void {
    if (!Capacitor.isNativePlatform()) return;
    import('@capacitor/splash-screen')
      .then(({ SplashScreen }) => SplashScreen.hide({ fadeOutDuration: 400 }))
      .catch(() => {});
  }
}
