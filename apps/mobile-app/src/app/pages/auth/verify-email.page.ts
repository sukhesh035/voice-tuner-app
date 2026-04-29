import { Component, ChangeDetectionStrategy, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent,
  IonIcon, IonBackButton, IonButtons, IonProgressBar
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
  imports: [FormsModule, IonHeader, IonToolbar, IonTitle, IonContent, IonIcon, IonBackButton, IonButtons, IonProgressBar],
  templateUrl: './verify-email.page.html',
  styleUrls: ['./verify-email.page.scss'],
})
export class VerifyEmailPage implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly analytics = inject(AnalyticsService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly _icons = (() => addIcons({ arrowBackOutline, mailOutline }))();

  code = '';
  isLoading = false;
  errorMsg = '';
  successMsg = '';
  email = '';

  ngOnInit(): void {
    this.resolveEmail();
  }

  /** Called every time the page becomes active (initial load AND app resume). */
  ionViewWillEnter(): void {
    this.resolveEmail();
  }

  private resolveEmail(): void {
    const nav = this.router.getCurrentNavigation();
    const state = nav?.extras?.state as { email?: string } | undefined;
    // Primary: router state on first navigation.
    // Fallback: service signal / localStorage (survives app switch / kill+relaunch).
    const resolved = state?.email ?? this.authService.getPendingEmail() ?? '';
    if (resolved) {
      this.email = resolved;
      this.cdr.markForCheck();
    } else if (!this.email) {
      this.router.navigate(['/login'], { replaceUrl: true });
    }
  }

  async verify(): Promise<void> {
    if (!this.code.trim()) {
      this.errorMsg = 'Please enter the 6-digit code from your email.';
      this.cdr.markForCheck();
      return;
    }
    this.isLoading = true;
    this.errorMsg = '';
    this.successMsg = '';
    this.cdr.markForCheck();
    try {
      await this.authService.confirmSignUp(this.email, this.code.trim());
      this.api.getProfile().catch(() => {});
      this.analytics.logEvent('email_verified');
      await this.router.navigate(['/home'], { replaceUrl: true });
    } catch (err: any) {
      this.errorMsg = this.mapError(err);
      this.analytics.logEvent('email_verify_error', { error: err.name ?? 'unknown' });
    } finally {
      this.isLoading = false;
      this.cdr.markForCheck();
    }
  }

  async resend(): Promise<void> {
    this.isLoading = true;
    this.errorMsg = '';
    this.successMsg = '';
    this.cdr.markForCheck();
    try {
      await this.authService.resendConfirmation(this.email);
      this.successMsg = 'A new code has been sent to your inbox.';
      this.analytics.logEvent('email_verify_resend');
    } catch (err: any) {
      this.errorMsg = err.message ?? 'Could not resend code. Please try again.';
    } finally {
      this.isLoading = false;
      this.cdr.markForCheck();
    }
  }

  private mapError(err: any): string {
    const name = err?.name ?? err?.code ?? '';
    switch (name) {
      case 'CodeMismatchException':
        return 'Incorrect code. Please check and try again.';
      case 'ExpiredCodeException':
        return 'This code has expired. Tap "Resend code" to get a new one.';
      case 'TooManyFailedAttemptsException':
      case 'LimitExceededException':
        return 'Too many attempts. Please wait a moment and try again.';
      default:
        return err?.message ?? 'Verification failed. Please try again.';
    }
  }
}
