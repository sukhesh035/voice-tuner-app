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
  selector: 'app-signup',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, IonHeader, IonToolbar, IonTitle, IonContent, IonIcon, IonBackButton, IonButtons, IonProgressBar],
  templateUrl: './signup.page.html',
  styleUrls: ['./signup.page.scss'],
})
export class SignupPage {
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

  private mapError(err: any): string {
    const name = err?.name ?? err?.code ?? '';
    switch (name) {
      case 'UsernameExistsException':
        return 'An account with this email already exists. Try signing in instead.';
      case 'InvalidPasswordException':
        return 'Password must be at least 8 characters and include a number.';
      case 'InvalidParameterException':
        return 'Please enter a valid email address.';
      case 'TooManyRequestsException':
      case 'LimitExceededException':
        return 'Too many attempts. Please wait a moment and try again.';
      case 'NetworkError':
        return 'Network error. Please check your connection and try again.';
      default:
        return err?.message ?? 'Could not create account. Please try again.';
    }
  }

  async signUp(): Promise<void> {
    if (!this.email || !this.password) {
      this.errorMsg = 'Please enter your email and a password.';
      return;
    }
    if (this.password.length < 8) {
      this.errorMsg = 'Password must be at least 8 characters.';
      return;
    }
    this.isLoading = true;
    this.errorMsg  = '';
    try {
      const result = await this.authService.signUp(this.email, this.password);
      this.analytics.logEvent('sign_up', { method: 'email' });
      if (result === 'CONFIRM_SIGN_UP') {
        await this.router.navigate(['/verify-email'], {
          state: { email: this.email },
        });
      } else {
        // Auto-confirmed (rare)
        this.api.getProfile().catch(() => {});
        await this.router.navigate(['/home'], { replaceUrl: true });
      }
    } catch (err: any) {
      this.errorMsg = this.mapError(err);
    } finally {
      this.isLoading = false;
      this.cdr.markForCheck();
    }
  }

  goToSignIn(): void {
    this.router.navigate(['/login'], { replaceUrl: true });
  }
}
