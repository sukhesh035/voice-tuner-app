# Auth UX Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the verify-email page losing state on app switch, improve sign-up error handling for existing accounts, add loading indicators and friendly error messages across auth pages, and auto-login the user immediately after sign-up (moving email verification to the profile).

**Architecture:** The verify-email page will persist email via the existing `AuthService.pendingConfirmationEmail` signal as a fallback to router state. Sign-up will handle `UsernameExistsException` by attempting to resend verification or directing to login. Loading bars and error messages will be wired on all auth pages consistently. After sign-up the user is navigated directly to `/home`; an "Unverified Email" banner in the profile page will prompt verification later.

**Tech Stack:** Angular 17 (standalone components, signals), Ionic 7, AWS Amplify v6 (Cognito), TypeScript

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `libs/auth/src/lib/auth.service.ts` | Modify | Persist `pendingConfirmationEmail` to sessionStorage; auto-login after signUp; expose `verifyEmailInBackground` |
| `apps/mobile-app/src/app/pages/auth/signup.page.ts` | Modify | Handle `UsernameExistsException` with resend+navigate flow; show errors inline |
| `apps/mobile-app/src/app/pages/auth/signup.page.html` | Modify | Add `UsernameExistsException` action button |
| `apps/mobile-app/src/app/pages/auth/verify-email.page.ts` | Modify | Fall back to service signal for email; add `IonProgressBar`; add `ChangeDetectorRef` |
| `apps/mobile-app/src/app/pages/auth/verify-email.page.html` | Modify | Add `IonProgressBar` to header |
| `apps/mobile-app/src/app/pages/auth/login.page.ts` | Modify | Improve error mapping to cover all Cognito error codes |
| `apps/mobile-app/src/app/pages/auth/forgot-password.page.ts` | Modify | Add `IonProgressBar` import; improve error mapping |
| `apps/mobile-app/src/app/pages/auth/forgot-password.page.html` | Modify | Add `IonProgressBar` to header |

---

## Task 1: Persist pending email in AuthService and auto-login after signUp

**Files:**
- Modify: `libs/auth/src/lib/auth.service.ts`

- [ ] **Step 1: Update `signUp` to sign the user in immediately after registration, and persist pending email to sessionStorage**

Replace the `signUp` method and add a `clearPendingConfirmation` helper. The user is signed in right away so they land on `/home`. The email is stored in sessionStorage so `verify-email` page can survive app switches.

```typescript
// In auth.service.ts, replace signUp():
async signUp(email: string, password: string): Promise<'CONFIRM_SIGN_UP' | 'DONE'> {
  const { nextStep } = await amplifySignUp({
    username: email,
    password,
    options: { userAttributes: { email } },
  });
  if (nextStep.signUpStep === 'CONFIRM_SIGN_UP') {
    this._pendingConfirmation.set(email);
    sessionStorage.setItem('pendingConfirmationEmail', email);
    this.pendingPassword = password;
    // Auto-login immediately so user lands on /home without waiting for email verify
    await this.signIn(email, password);
    return 'CONFIRM_SIGN_UP';
  }
  await this.signIn(email, password);
  return 'DONE';
}
```

Also update `confirmSignUp` to clear sessionStorage after verification:

```typescript
async confirmSignUp(email: string, code: string): Promise<void> {
  const password = this.pendingPassword ?? '';
  this.pendingPassword = null;
  await amplifyConfirmSignUp({ username: email, confirmationCode: code });
  this._pendingConfirmation.set(null);
  sessionStorage.removeItem('pendingConfirmationEmail');
  // Re-fetch session so emailVerified flag is updated
  await this.signIn(email, password || (await this._refreshCurrentPassword()));
}
```

Wait — `signIn` requires a password and we cleared `pendingPassword`. Adjust: keep password for confirmSignUp too, just null it after use in confirmSignUp. Actually the existing code already does this correctly. Keep the existing confirmSignUp body, just add the `sessionStorage.removeItem` and update signUp as shown above.

Final `confirmSignUp`:

```typescript
async confirmSignUp(email: string, code: string): Promise<void> {
  const password = this.pendingPassword ?? '';
  this.pendingPassword = null;
  await amplifyConfirmSignUp({ username: email, confirmationCode: code });
  this._pendingConfirmation.set(null);
  sessionStorage.removeItem('pendingConfirmationEmail');
  if (password) {
    await this.signIn(email, password);
  }
}
```

Also update `signOut` to clear sessionStorage:

```typescript
async signOut(): Promise<void> {
  await amplifySignOut();
  this._pendingConfirmation.set(null);
  sessionStorage.removeItem('pendingConfirmationEmail');
  this._user.set(null);
}
```

- [ ] **Step 2: Add a public getter for the persisted pending email (for verify-email page fallback)**

Add this method to `AuthService`:

```typescript
/** Returns the pending confirmation email from memory or sessionStorage fallback. */
getPendingEmail(): string | null {
  return this._pendingConfirmation() ?? sessionStorage.getItem('pendingConfirmationEmail');
}
```

- [ ] **Step 3: Commit**

```bash
git add libs/auth/src/lib/auth.service.ts
git commit -m "feat(auth): auto-login after sign-up, persist pending email to sessionStorage"
```

---

## Task 2: Fix verify-email page — survive app switch, add progress bar

**Files:**
- Modify: `apps/mobile-app/src/app/pages/auth/verify-email.page.ts`
- Modify: `apps/mobile-app/src/app/pages/auth/verify-email.page.html`

- [ ] **Step 1: Add `IonProgressBar` and `ChangeDetectorRef` to verify-email page, fix `ngOnInit` to fall back to service signal**

Replace the full `verify-email.page.ts`:

```typescript
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
    const nav = this.router.getCurrentNavigation();
    const state = nav?.extras?.state as { email?: string } | undefined;
    // Primary: router state. Fallback: service signal / sessionStorage (survives app switch)
    this.email = state?.email ?? this.authService.getPendingEmail() ?? '';

    if (!this.email) {
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
```

- [ ] **Step 2: Add `IonProgressBar` to verify-email template header**

In `verify-email.page.html`, replace the `<ion-header>` block:

```html
<ion-header>
  <ion-toolbar>
    <ion-buttons slot="start">
      <ion-back-button defaultHref="/login" text=""></ion-back-button>
    </ion-buttons>
    <ion-title>Verify Email</ion-title>
  </ion-toolbar>
  @if (isLoading) {
    <ion-progress-bar type="indeterminate"></ion-progress-bar>
  }
</ion-header>
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile-app/src/app/pages/auth/verify-email.page.ts apps/mobile-app/src/app/pages/auth/verify-email.page.html
git commit -m "fix(verify-email): survive app switch via service fallback, add progress bar, improve error messages"
```

---

## Task 3: Fix signup — handle UsernameExistsException, navigate to home after sign-up

**Files:**
- Modify: `apps/mobile-app/src/app/pages/auth/signup.page.ts`
- Modify: `apps/mobile-app/src/app/pages/auth/signup.page.html`

- [ ] **Step 1: Update `signup.page.ts` to navigate to `/home` after sign-up (since user is now auto-logged in), and handle `UsernameExistsException` intelligently**

Replace the full `signup.page.ts`:

```typescript
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
  /** When true, show a "Sign In" action button alongside the error message */
  showSignInAction = false;

  private mapError(err: any): string {
    const name = err?.name ?? err?.code ?? '';
    switch (name) {
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
      this.cdr.markForCheck();
      return;
    }
    if (this.password.length < 8) {
      this.errorMsg = 'Password must be at least 8 characters.';
      this.cdr.markForCheck();
      return;
    }
    this.isLoading = true;
    this.errorMsg  = '';
    this.showSignInAction = false;
    this.cdr.markForCheck();
    try {
      const result = await this.authService.signUp(this.email, this.password);
      this.analytics.logEvent('sign_up', { method: 'email' });
      if (result === 'CONFIRM_SIGN_UP') {
        // User is already logged in (auto-login in authService.signUp).
        // Navigate home; profile page will show the verify-email prompt.
        this.api.getProfile().catch(() => {});
        await this.router.navigate(['/home'], { replaceUrl: true });
      } else {
        this.api.getProfile().catch(() => {});
        await this.router.navigate(['/home'], { replaceUrl: true });
      }
    } catch (err: any) {
      if (err?.name === 'UsernameExistsException') {
        // Try to resend verification in case the account is unconfirmed
        try {
          await this.authService.resendConfirmation(this.email);
          // Unconfirmed account — navigate to verify-email page
          await this.router.navigate(['/verify-email'], { state: { email: this.email } });
          return;
        } catch {
          // Confirmed account exists — show sign-in prompt
          this.errorMsg = 'An account with this email already exists.';
          this.showSignInAction = true;
        }
      } else {
        this.errorMsg = this.mapError(err);
      }
    } finally {
      this.isLoading = false;
      this.cdr.markForCheck();
    }
  }

  goToSignIn(): void {
    this.router.navigate(['/login'], { replaceUrl: true });
  }
}
```

- [ ] **Step 2: Update `signup.page.html` to show Sign In action button when `showSignInAction` is true**

Replace the `@if (errorMsg)` block in `signup.page.html`:

```html
@if (errorMsg) {
  <div class="error-msg">{{ errorMsg }}</div>
}
@if (showSignInAction) {
  <button class="swara-btn swara-btn--secondary signup-btn" type="button" (click)="goToSignIn()">
    Sign In Instead
  </button>
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile-app/src/app/pages/auth/signup.page.ts apps/mobile-app/src/app/pages/auth/signup.page.html
git commit -m "fix(signup): auto-navigate to home after sign-up, handle existing account gracefully"
```

---

## Task 4: Improve login error messages

**Files:**
- Modify: `apps/mobile-app/src/app/pages/auth/login.page.ts`

- [ ] **Step 1: Add a `mapError` method to `LoginPage` and use it in `signIn`**

Replace the catch block in `signIn()` and add `mapError`:

```typescript
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
```

Update the catch block in `signIn()`:

```typescript
} catch (err: any) {
  if (err.name === 'UserNotConfirmedException') {
    this.unconfirmedEmail = this.email;
  }
  this.errorMsg = this.mapError(err);
  this.analytics.logEvent('login_error', { error: err.name ?? 'unknown' });
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile-app/src/app/pages/auth/login.page.ts
git commit -m "fix(login): improve error messages with friendly user-facing copy"
```

---

## Task 5: Add progress bar to forgot-password page

**Files:**
- Modify: `apps/mobile-app/src/app/pages/auth/forgot-password.page.ts`
- Modify: `apps/mobile-app/src/app/pages/auth/forgot-password.page.html`

- [ ] **Step 1: Read forgot-password files**

Check current state of `forgot-password.page.ts` and `forgot-password.page.html` to confirm whether `IonProgressBar` is imported and used.

Run:
```bash
head -30 apps/mobile-app/src/app/pages/auth/forgot-password.page.ts
head -20 apps/mobile-app/src/app/pages/auth/forgot-password.page.html
```

- [ ] **Step 2: Add `IonProgressBar` to forgot-password imports if missing**

In `forgot-password.page.ts`, ensure the imports array includes `IonProgressBar`:

```typescript
imports: [FormsModule, IonHeader, IonToolbar, IonTitle, IonContent, IonIcon, IonBackButton, IonButtons, IonProgressBar],
```

- [ ] **Step 3: Add progress bar to forgot-password template**

In `forgot-password.page.html`, add after `</ion-toolbar>` inside `<ion-header>`:

```html
@if (isLoading) {
  <ion-progress-bar type="indeterminate"></ion-progress-bar>
}
```

- [ ] **Step 4: Add friendly error mapping to forgot-password page**

In `forgot-password.page.ts`, add a `mapError` method:

```typescript
private mapError(err: any): string {
  const name = err?.name ?? err?.code ?? '';
  switch (name) {
    case 'UserNotFoundException':
      return 'No account found with this email address.';
    case 'InvalidParameterException':
      return 'Please enter a valid email address.';
    case 'LimitExceededException':
    case 'TooManyRequestsException':
      return 'Too many requests. Please wait a moment and try again.';
    case 'NetworkError':
      return 'Network error. Please check your connection and try again.';
    default:
      return err?.message ?? 'Could not send reset email. Please try again.';
  }
}
```

Use it in the `sendReset()` catch:

```typescript
} catch (err: any) {
  this.errorMsg = this.mapError(err);
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/mobile-app/src/app/pages/auth/forgot-password.page.ts apps/mobile-app/src/app/pages/auth/forgot-password.page.html
git commit -m "fix(forgot-password): add progress bar and friendly error messages"
```

---

## Task 6: Push to dev branch and create PR to main

- [ ] **Step 1: Verify current branch and status**

```bash
git status
git branch
```

- [ ] **Step 2: Push to dev branch**

```bash
git push origin dev
```

- [ ] **Step 3: Create PR from dev to main**

```bash
gh pr create --title "fix(auth): verify-email survives app switch, friendly errors, auto-login after sign-up" --base main --head dev --body "$(cat <<'EOF'
## Summary

- **Fix verify-email losing state on app switch**: Email is now persisted in `sessionStorage` via `AuthService` and used as fallback in `VerifyEmailPage.ngOnInit()` when router state is unavailable
- **Auto-login after sign-up**: Users land on `/home` immediately after sign-up; email verification is deferred to the profile page
- **Handle existing account on sign-up**: `UsernameExistsException` now tries to resend verification (for unconfirmed accounts) or shows a "Sign In Instead" button (for confirmed accounts)
- **Loading bars on verify-email**: `IonProgressBar` added with `ChangeDetectorRef` for `OnPush` compatibility
- **Friendly error messages**: All auth pages (login, signup, verify-email, forgot-password) now map Cognito error codes to human-readable copy
EOF
)"
```
