import { Component, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent,
  IonIcon, IonBackButton, IonButtons
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { arrowBackOutline, eyeOutline, eyeOffOutline } from 'ionicons/icons';
import { AuthService } from '@voice-tuner/auth';
import { ApiService } from '../../core/services/api.service';
import { AnalyticsService } from '../../core/services/analytics.service';

@Component({
  selector: 'app-login',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, IonHeader, IonToolbar, IonTitle, IonContent, IonIcon, IonBackButton, IonButtons],
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
})
export class LoginPage {
  email     = '';
  password  = '';
  showPass  = false;
  isLoading = false;
  errorMsg  = '';
  successMsg = '';
  unconfirmedEmail = '';

  constructor(
    private authService: AuthService,
    private api: ApiService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private analytics: AnalyticsService
  ) {
    addIcons({ arrowBackOutline, eyeOutline, eyeOffOutline });
  }

  async signIn(): Promise<void> {
    this.isLoading        = true;
    this.errorMsg         = '';
    this.successMsg       = '';
    this.unconfirmedEmail = '';
    try {
      await this.authService.signIn(this.email, this.password);
      this.api.getProfile().catch(() => {});
      this.analytics.logEvent('login', { method: 'email' });
      await this.router.navigate(['/home']);
    } catch (err: any) {
      if (err.name === 'UserNotConfirmedException') {
        this.unconfirmedEmail = this.email;
        this.errorMsg = 'Your email address hasn\'t been confirmed yet.';
      } else {
        this.errorMsg = err.message ?? 'Sign in failed. Please try again.';
        this.analytics.logEvent('login_error', { error: err.name ?? 'unknown' });
      }
    } finally {
      this.isLoading = false;
      this.cdr.markForCheck();
    }
  }

  async resendConfirmation(): Promise<void> {
    if (!this.unconfirmedEmail) return;
    this.isLoading  = true;
    this.errorMsg   = '';
    this.successMsg = '';
    try {
      await this.authService.resendConfirmation(this.unconfirmedEmail);
      this.successMsg = 'Confirmation email resent. Check your inbox.';
      this.unconfirmedEmail = '';
    } catch (err: any) {
      this.errorMsg = err.message ?? 'Could not resend confirmation email.';
    } finally {
      this.isLoading = false;
      this.cdr.markForCheck();
    }
  }

  goToSignUp(): void {
    this.router.navigate(['/signup']);
  }

  goToForgotPassword(): void {
    this.router.navigate(['/forgot-password']);
  }

  continueAsGuest(): void {
    this.analytics.logEvent('continue_as_guest');
    this.router.navigate(['/home']);
  }
}
