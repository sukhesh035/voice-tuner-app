import { Component, OnInit } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { ThemeService } from './core/services/theme.service';
import { AuthService } from '@voice-tuner/auth';
import { ApiService } from './core/services/api.service';

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
  constructor(
    private themeService: ThemeService,
    private authService: AuthService,
    private api: ApiService,
  ) {}

  ngOnInit(): void {
    this.themeService.initialize();
    // Race auth init against a timeout so a slow/offline Cognito call never
    // blocks the whole app from rendering.
    const timeout = new Promise<void>(resolve => setTimeout(resolve, AUTH_INIT_TIMEOUT_MS));
    Promise.race([this.authService.initialize(), timeout]).then(() => {
      if (this.authService.currentUser) {
        // Ensure user record exists in DynamoDB after session restore
        this.api.getProfile().catch(() => {});
      }
    });
  }
}
