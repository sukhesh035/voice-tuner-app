import { Component, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
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
  imports: [CommonModule, FormsModule, IonHeader, IonToolbar, IonTitle, IonContent, IonBackButton, IonButtons],
  templateUrl: './forgot-password.page.html',
  styleUrls: ['./forgot-password.page.scss'],
})
export class ForgotPasswordPage {
  email     = '';
  isLoading = false;
  errorMsg  = '';

  constructor(
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private analytics: AnalyticsService,
  ) {}

  async sendReset(): Promise<void> {
    if (!this.email.trim()) {
      this.errorMsg = 'Please enter your email address.';
      this.cdr.markForCheck();
      return;
    }
    this.isLoading = true;
    this.errorMsg  = '';
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
      this.cdr.markForCheck();
    }
  }

  goToSignIn(): void {
    this.router.navigate(['/login'], { replaceUrl: true });
  }
}
