import { Component, ChangeDetectionStrategy, inject, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent,
  IonIcon, IonBackButton, IonButtons, IonProgressBar
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
  imports: [FormsModule, IonHeader, IonToolbar, IonTitle, IonContent, IonIcon, IonBackButton, IonButtons, IonProgressBar],
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
})
export class LoginPage {
  private readonly authService = inject(AuthService);
  private readonly api         = inject(ApiService);
  private readonly router      = inject(Router);
  private readonly analytics   = inject(AnalyticsService);
  private readonly cdr         = inject(ChangeDetectorRef);

  private readonly _icons = (() => addIcons({ arrowBackOutline, eyeOutline, eyeOffOutline }))();

  email     = '';
  password  = '';
  showPass  = false;
  isLoading = false;
  errorMsg  = '';
  successMsg = '';
  unconfirmedEmail = '';

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
      }
      this.errorMsg = this.mapError(err);
      this.analytics.logEvent('login_error', { error: err.name ?? 'unknown' });
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

  private mapError(err: any): string {
    const name = err?.name ?? err?.code ?? '';
    switch (name) {
      case 'NotAuthorizedException':
        return 'Incorrect email or password. Please try again.';
      case 'UserNotFoundException':
        return 'No account found with this email. Please sign up first.';
      case 'UserNotConfirmedException':
        return 'Your email address hasn\'t been confirmed yet.';
      case 'PasswordResetRequiredException':
        return 'You need to reset your password before signing in.';
      case 'TooManyRequestsException':
      case 'LimitExceededException':
        return 'Too many sign-in attempts. Please wait and try again.';
      case 'NetworkError':
        return 'Network error. Please check your connection and try again.';
      default:
        return err?.message ?? 'Sign in failed. Please try again.';
    }
  }

  continueAsGuest(): void {
    this.analytics.logEvent('continue_as_guest');
    this.router.navigate(['/home']);
  }
}
