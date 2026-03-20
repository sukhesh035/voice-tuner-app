import { Component, ChangeDetectionStrategy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent,
  IonIcon, IonBackButton, IonButtons
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { arrowBackOutline, mailOutline } from 'ionicons/icons';
import { AuthService } from '@voice-tuner/auth';
import { ApiService } from '../../core/services/api.service';
import { AnalyticsService } from '../../core/services/analytics.service';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, IonHeader, IonToolbar, IonTitle, IonContent, IonIcon, IonBackButton, IonButtons],
  templateUrl: './verify-email.page.html',
  styleUrls: ['./verify-email.page.scss'],
})
export class VerifyEmailPage implements OnInit {
  readonly authService = inject(AuthService);
  readonly api = inject(ApiService);
  readonly router = inject(Router);
  readonly analytics = inject(AnalyticsService);
  private readonly _icons = (() => addIcons({ arrowBackOutline, mailOutline }))();

  code = '';
  isLoading = false;
  errorMsg = '';
  successMsg = '';

  // Passed via router state from signup.page after a successful signUp() call
  email = '';

  ngOnInit(): void {
    const nav = this.router.getCurrentNavigation();
    const state = nav?.extras?.state as { email?: string } | undefined;
    this.email = state?.email ?? '';

    // If we landed here without email (e.g. direct navigation), go back to login
    if (!this.email) {
      this.router.navigate(['/login'], { replaceUrl: true });
    }
  }

  async verify(): Promise<void> {
    if (!this.code.trim()) {
      this.errorMsg = 'Please enter the 6-digit code from your email.';
      return;
    }
    this.isLoading = true;
    this.errorMsg = '';
    this.successMsg = '';
    try {
      await this.authService.confirmSignUp(this.email, this.code.trim());
      // Provision user record in DynamoDB after verified sign-in
      this.api.getProfile().catch(() => {});
      this.analytics.logEvent('email_verified');
      await this.router.navigate(['/home'], { replaceUrl: true });
    } catch (err: any) {
      this.errorMsg = err.message ?? 'Verification failed. Please try again.';
      this.analytics.logEvent('email_verify_error', { error: err.name ?? 'unknown' });
    } finally {
      this.isLoading = false;
    }
  }

  async resend(): Promise<void> {
    this.isLoading = true;
    this.errorMsg = '';
    this.successMsg = '';
    try {
      await this.authService.resendConfirmation(this.email);
      this.successMsg = 'A new code has been sent to your inbox.';
      this.analytics.logEvent('email_verify_resend');
    } catch (err: any) {
      this.errorMsg = err.message ?? 'Could not resend code. Please try again.';
    } finally {
      this.isLoading = false;
    }
  }
}
