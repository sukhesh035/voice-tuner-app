import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonButton } from '@ionic/angular/standalone';
import { AuthService } from '@voice-tuner/auth';

@Component({
  selector: 'app-profile',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink, IonHeader, IonToolbar, IonTitle, IonContent, IonButton],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Profile</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div class="profile-page">

        <ng-container *ngIf="authService.isAuthenticated$ | async; else loginPrompt">
          <!-- Authenticated View -->
          <div class="profile-header sruti-card">
            <div class="avatar">{{ (authService.user$ | async)?.name?.[0] ?? 'U' }}</div>
            <div class="profile-info">
              <div class="profile-name">{{ (authService.user$ | async)?.name }}</div>
              <div class="profile-email">{{ (authService.user$ | async)?.email }}</div>
            </div>
          </div>

          <div class="profile-stats">
            <div class="sruti-stat-card"><div class="stat-value">42</div><div class="stat-label">Sessions</div></div>
            <div class="sruti-stat-card"><div class="stat-value">7🔥</div><div class="stat-label">Streak</div></div>
            <div class="sruti-stat-card"><div class="stat-value">83%</div><div class="stat-label">Avg Score</div></div>
          </div>

          <div class="profile-actions">
            <button class="sruti-btn sruti-btn--secondary logout-btn" (click)="authService.signOut()">
              Sign Out
            </button>
          </div>
        </ng-container>

        <ng-template #loginPrompt>
          <div class="login-prompt sruti-card">
            <div class="login-prompt-icon">🎵</div>
            <div class="login-prompt-title">Sync Your Progress</div>
            <p class="login-prompt-desc">
              Sign in to save practice history, streaks, and settings across devices.
            </p>
            <a [routerLink]="['/login']" class="sruti-btn sruti-btn--primary">Sign In</a>
            <div class="login-prompt-guest">Continue as guest — practice offline without syncing</div>
          </div>
        </ng-template>

      </div>
    </ion-content>
  `,
  styles: [`
    .profile-page { padding: 16px; padding-bottom: calc(80px + env(safe-area-inset-bottom)); display: flex; flex-direction: column; gap: 20px; }
    .profile-header { display: flex; align-items: center; gap: 16px; }
    .avatar { width: 60px; height: 60px; border-radius: 50%; background: var(--sruti-gradient-primary); display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 700; color: white; flex-shrink: 0; }
    .profile-name  { font-size: 20px; font-weight: 700; }
    .profile-email { font-size: 13px; color: var(--sruti-text-secondary); }
    .profile-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
    .profile-actions { display: flex; justify-content: center; }
    .logout-btn { width: 100%; max-width: 200px; }
    .login-prompt { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 16px; padding: 32px 24px !important; }
    .login-prompt-icon { font-size: 48px; }
    .login-prompt-title { font-size: 22px; font-weight: 800; }
    .login-prompt-desc { font-size: 15px; color: var(--sruti-text-secondary); line-height: 1.5; margin: 0; }
    .login-prompt-guest { font-size: 12px; color: var(--sruti-text-tertiary); }
    .sruti-btn { text-decoration: none; white-space: nowrap; }
  `]
})
export class ProfilePage {
  constructor(public authService: AuthService) {}
}
