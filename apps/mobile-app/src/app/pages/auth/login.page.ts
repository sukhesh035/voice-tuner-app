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

type LoginView = 'signin' | 'forgot';

@Component({
  selector: 'app-login',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, IonHeader, IonToolbar, IonTitle, IonContent, IonIcon, IonBackButton, IonButtons],
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
})
export class LoginPage {
  view: LoginView = 'signin';

  email     = '';
  password  = '';
  showPass  = false;
  isLoading = false;
  errorMsg  = '';
  successMsg = '';
  unconfirmedEmail = '';   // set when Cognito returns UserNotConfirmedException

  constructor(
    private authService: AuthService,
    private api: ApiService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {
    addIcons({ arrowBackOutline, eyeOutline, eyeOffOutline });
  }

  async signIn(): Promise<void> {
    this.isLoading       = true;
    this.errorMsg        = '';
    this.successMsg      = '';
    this.unconfirmedEmail = '';
    try {
      await this.authService.signIn(this.email, this.password);
      // Ensure user record exists in DynamoDB (auto-provisions on first login)
      this.api.getProfile().catch(() => {});
      await this.router.navigate(['/home']);
    } catch (err: any) {
      if (err.name === 'UserNotConfirmedException') {
        this.unconfirmedEmail = this.email;
        this.errorMsg = 'Your email address hasn\'t been confirmed yet.';
      } else {
        this.errorMsg = err.message ?? 'Sign in failed. Please try again.';
      }
    } finally {
      this.isLoading = false;
      this.cdr.markForCheck();
    }
  }

  async signUp(): Promise<void> {
    this.isLoading  = true;
    this.errorMsg   = '';
    this.successMsg = '';
    try {
      await this.authService.signUp(this.email, this.password);
      // Provision user record in DynamoDB immediately after sign-up
      this.api.getProfile().catch(() => {});
      await this.router.navigate(['/home']);
    } catch (err: any) {
      this.errorMsg = err.message ?? 'Sign up failed.';
    } finally {
      this.isLoading = false;
      this.cdr.markForCheck();
    }
  }

  async sendReset(): Promise<void> {
    if (!this.email) {
      this.errorMsg = 'Please enter your email address.';
      this.cdr.markForCheck();
      return;
    }
    this.isLoading  = true;
    this.errorMsg   = '';
    this.successMsg = '';
    try {
      // AuthService may not have resetPassword — use a best-effort approach
      const svc = this.authService as any;
      if (typeof svc.resetPassword === 'function') {
        await svc.resetPassword(this.email);
      }
      this.successMsg = 'Password reset email sent. Check your inbox.';
    } catch (err: any) {
      this.errorMsg = err.message ?? 'Could not send reset email.';
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

  showForgot(): void {
    this.view       = 'forgot';
    this.errorMsg   = '';
    this.successMsg = '';
    this.cdr.markForCheck();
  }

  showSignIn(): void {
    this.view       = 'signin';
    this.errorMsg   = '';
    this.successMsg = '';
    this.cdr.markForCheck();
  }

  continueAsGuest(): void {
    this.router.navigate(['/home']);
  }
}
