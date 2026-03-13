import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonButton } from '@ionic/angular/standalone';
import { AuthService } from '@voice-tuner/auth';

@Component({
  selector: 'app-login',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, IonHeader, IonToolbar, IonTitle, IonContent, IonButton],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Sign In</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div class="login-page">
        <div class="login-hero">
          <div class="login-logo">🎵</div>
          <div class="login-title">Sruti</div>
          <div class="login-sub">Indian Classical Music Companion</div>
        </div>

        <div class="login-form sruti-card">
          <div class="form-group">
            <label class="form-label">Email</label>
            <input class="form-input" type="email" [(ngModel)]="email" placeholder="you@example.com" />
          </div>
          <div class="form-group">
            <label class="form-label">Password</label>
            <input class="form-input" type="password" [(ngModel)]="password" placeholder="••••••••" />
          </div>

          <div class="error-msg" *ngIf="errorMsg">{{ errorMsg }}</div>

          <button class="sruti-btn sruti-btn--primary login-btn" (click)="signIn()" [disabled]="isLoading">
            {{ isLoading ? 'Signing in...' : 'Sign In' }}
          </button>
          <button class="sruti-btn sruti-btn--secondary login-btn" (click)="signUp()" [disabled]="isLoading">
            Create Account
          </button>

          <div class="divider"><span>or</span></div>
          <button class="sruti-btn sruti-btn--ghost login-btn" (click)="continueAsGuest()">
            Continue as Guest
          </button>
        </div>
      </div>
    </ion-content>
  `,
  styles: [`
    .login-page { padding: 24px; min-height: 100%; display: flex; flex-direction: column; gap: 32px; justify-content: center; }
    .login-hero { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 8px; }
    .login-logo { font-size: 64px; }
    .login-title { font-size: 36px; font-weight: 900; background: var(--sruti-gradient-primary); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
    .login-sub { font-size: 15px; color: var(--sruti-text-secondary); }
    .login-form { display: flex; flex-direction: column; gap: 16px; }
    .form-group { display: flex; flex-direction: column; gap: 6px; }
    .form-label { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--sruti-text-secondary); }
    .form-input { padding: 12px 16px; background: var(--sruti-bg-input); border: 1px solid var(--sruti-border); border-radius: 10px; color: var(--sruti-text-primary); font-size: 16px; outline: none; }
    .login-btn { width: 100%; padding: 14px !important; font-size: 16px !important; }
    .error-msg { font-size: 13px; color: var(--sruti-pitch-off); text-align: center; }
    .divider { display: flex; align-items: center; gap: 12px; color: var(--sruti-text-tertiary); font-size: 13px; &::before, &::after { content: ''; flex: 1; height: 1px; background: var(--sruti-border); } }
  `]
})
export class LoginPage {
  email    = '';
  password = '';
  isLoading = false;
  errorMsg  = '';

  constructor(private authService: AuthService, private router: Router) {}

  async signIn(): Promise<void> {
    this.isLoading = true;
    this.errorMsg  = '';
    try {
      await this.authService.signIn(this.email, this.password);
      await this.router.navigate(['/home']);
    } catch (err: any) {
      this.errorMsg = err.message ?? 'Sign in failed. Please try again.';
    } finally {
      this.isLoading = false;
    }
  }

  async signUp(): Promise<void> {
    this.isLoading = true;
    this.errorMsg  = '';
    try {
      await this.authService.signUp(this.email, this.password);
      this.errorMsg = 'Check your email for a confirmation link.';
    } catch (err: any) {
      this.errorMsg = err.message ?? 'Sign up failed.';
    } finally {
      this.isLoading = false;
    }
  }

  continueAsGuest(): void {
    this.router.navigate(['/home']);
  }
}
