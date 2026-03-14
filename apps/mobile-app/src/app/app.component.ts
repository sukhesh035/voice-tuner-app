import { Component, OnInit } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { ThemeService } from './core/services/theme.service';
import { AuthService } from '@voice-tuner/auth';
import { ApiService } from './core/services/api.service';

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
    // Restore Cognito session from stored refresh token on every app start.
    // Amplify handles token refresh automatically once a valid session exists.
    this.authService.initialize().then(() => {
      if (this.authService.currentUser) {
        // Ensure user record exists in DynamoDB after session restore
        this.api.getProfile().catch(() => {});
      }
    });
  }
}
