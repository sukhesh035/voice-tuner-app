import { Component, OnInit, inject } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { ThemeService } from './core/services/theme.service';
import { AuthService } from '@voice-tuner/auth';
import { ApiService } from './core/services/api.service';
import { LiveUpdateService } from './core/services/live-update.service';
import { PushNotificationService } from './core/services/push-notification.service';
import { PermissionsService } from './core/services/permissions.service';

// On a real device over cellular/WiFi, Cognito's fetchAuthSession can take
// 300–800ms. Cap the wait so a slow or offline network never freezes the app.
const AUTH_INIT_TIMEOUT_MS = 5000;

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
    });
  }
}
