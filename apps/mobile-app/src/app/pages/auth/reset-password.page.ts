import { Component, ChangeDetectionStrategy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent,
  IonIcon, IonBackButton, IonButtons
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { arrowBackOutline, eyeOutline, eyeOffOutline } from 'ionicons/icons';
import { AuthService } from '@voice-tuner/auth';
import { AnalyticsService } from '../../core/services/analytics.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, IonHeader, IonToolbar, IonTitle, IonContent, IonIcon, IonBackButton, IonButtons],
  templateUrl: './reset-password.page.html',
  styleUrls: ['./reset-password.page.scss'],
})
export class ResetPasswordPage implements OnInit {
  readonly authService = inject(AuthService);
  readonly router = inject(Router);
  readonly analytics = inject(AnalyticsService);
  private readonly _icons = (() => addIcons({ arrowBackOutline, eyeOutline, eyeOffOutline }))();

  code = '';
  newPassword = '';
  showPass = false;
  isLoading = false;
  errorMsg = '';
  successMsg = '';
  done = false;

  // Passed via router state from login.page after sendReset()
  email = '';

  ngOnInit(): void {
    const nav = this.router.getCurrentNavigation();
    const state = nav?.extras?.state as { email?: string } | undefined;
    this.email = state?.email ?? '';

    if (!this.email) {
      this.router.navigate(['/login'], { replaceUrl: true });
    }
  }

  async submit(): Promise<void> {
    if (!this.code.trim()) {
      this.errorMsg = 'Please enter the code from your email.';
      return;
    }
    if (this.newPassword.length < 8) {
      this.errorMsg = 'Password must be at least 8 characters.';
      return;
    }
    this.isLoading = true;
    this.errorMsg = '';
    this.successMsg = '';
    try {
      await this.authService.confirmResetPassword(this.email, this.code.trim(), this.newPassword);
      this.done = true;
      this.successMsg = 'Password reset successfully! You can now sign in.';
      this.analytics.logEvent('password_reset_complete');
    } catch (err: any) {
      this.errorMsg = err.message ?? 'Could not reset password. Please try again.';
      this.analytics.logEvent('password_reset_error', { error: err.name ?? 'unknown' });
    } finally {
      this.isLoading = false;
    }
  }

  goToSignIn(): void {
    this.router.navigate(['/login'], { replaceUrl: true });
  }
}
