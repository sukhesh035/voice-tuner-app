import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent,
  IonBackButton, IonButtons
} from '@ionic/angular/standalone';
import { AuthService } from '@voice-tuner/auth';
import { AnalyticsService } from '../../core/services/analytics.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, IonHeader, IonToolbar, IonTitle, IonContent, IonBackButton, IonButtons],
  templateUrl: './forgot-password.page.html',
  styleUrls: ['./forgot-password.page.scss'],
})
export class ForgotPasswordPage {
  readonly authService = inject(AuthService);
  readonly router = inject(Router);
  readonly analytics = inject(AnalyticsService);

  email = '';
  isLoading = false;
  errorMsg = '';

  async sendReset(): Promise<void> {
    if (!this.email.trim()) {
      this.errorMsg = 'Please enter your email address.';
      return;
    }
    this.isLoading = true;
    this.errorMsg = '';
    try {
      await this.authService.resetPassword(this.email.trim());
      this.analytics.logEvent('forgot_password_sent');
      await this.router.navigate(['/reset-password'], {
        state: { email: this.email.trim() },
      });
    } catch (err: any) {
      this.errorMsg = err.message ?? 'Could not send reset email. Please try again.';
    } finally {
      this.isLoading = false;
    }
  }

  goToSignIn(): void {
    this.router.navigate(['/login'], { replaceUrl: true });
  }
}
