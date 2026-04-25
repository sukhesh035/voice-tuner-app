import { Injectable, signal, computed } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
import { filter, map, take } from 'rxjs/operators';
import {
  signIn as amplifySignIn,
  signUp as amplifySignUp,
  signOut as amplifySignOut,
  deleteUser as amplifyDeleteUser,
  getCurrentUser,
  fetchAuthSession,
  resendSignUpCode,
  confirmSignUp as amplifyConfirmSignUp,
  resetPassword as amplifyResetPassword,
  confirmResetPassword as amplifyConfirmResetPassword,
} from 'aws-amplify/auth';

export interface AppUser {
  id:            string;
  email:         string;
  name:          string;
  emailVerified: boolean;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  // ── Internal signals ────────────────────────────────────────────────────────
  private readonly _user                = signal<AppUser | null>(null);
  private readonly _pendingConfirmation = signal<string | null>(null);
  private readonly _initialized         = signal<boolean>(false);

  /** Ephemeral in-memory password held only during the signup → verify-email flow.
   *  Never persisted to storage. Cleared immediately after confirmSignUp(). */
  private pendingPassword: string | null = null;

  // ── Public signals ──────────────────────────────────────────────────────────
  /** Read-only signal of the current authenticated user (null if not signed in). */
  readonly user            = this._user.asReadonly();
  /** Derived signal — true when a user is signed in. */
  readonly isAuthenticated = computed(() => this._user() !== null);
  /** True once initialize() has resolved (success or failure). */
  readonly initialized     = this._initialized.asReadonly();
  /** Email awaiting Cognito confirmation, or null. */
  readonly pendingConfirmationEmail = this._pendingConfirmation.asReadonly();

  // ── Observable adapters (keep for components/guards still using async pipe) ─
  // These must be field initialisers (not getters) so toObservable() runs
  // during construction — a valid injection context.
  readonly user$: Observable<AppUser | null> = toObservable(this._user);
  readonly isAuthenticated$: Observable<boolean> = toObservable(this.isAuthenticated);
  get currentUser(): AppUser | null { return this._user(); }
  /** Email address waiting for Cognito confirmation, or null if none. */
  readonly pendingConfirmation$: Observable<string | null> = toObservable(this._pendingConfirmation);
  /** Emits true (exactly once) when initialize() has completed — success or failure. */
  readonly initialized$: Observable<true> = toObservable(this._initialized).pipe(
    filter((v): v is true => v === true),
    take(1)
  );

  async initialize(): Promise<void> {
    try {
      // fetchAuthSession will silently use the stored refresh token to issue
      // new tokens if the access token is expired — this is the key piece that
      // makes the session survive page refreshes and app restarts.
      const session = await fetchAuthSession({ forceRefresh: false });
      if (!session.tokens?.idToken) {
        this._user.set(null);
        return;
      }
      const user = await getCurrentUser();
      const email = session.tokens.idToken.payload['email'] as string ?? user.username;
      const emailVerified = session.tokens.idToken.payload['email_verified'] === true;
      this._user.set({
        id:    user.userId,
        email,
        name:  (session.tokens.idToken.payload['name'] as string)
               ?? email.split('@')[0],
        emailVerified,
      });
    } catch {
      this._user.set(null);
    } finally {
      // Always signal completion so guards and pages don't wait forever.
      this._initialized.set(true);
    }
  }

  async signIn(email: string, password: string): Promise<void> {
    // If Amplify still has a stale session in localStorage, signIn will throw
    // UserAlreadyAuthenticatedException. Sign out silently first to clear it.
    try { await amplifySignOut(); } catch { /* ignore */ }
    const { isSignedIn } = await amplifySignIn({ username: email, password });
    if (isSignedIn) {
      const session = await fetchAuthSession({ forceRefresh: false });
      const user = await getCurrentUser();
      const emailVerified = session.tokens?.idToken?.payload['email_verified'] === true;
      this._pendingConfirmation.set(null);
      this._user.set({ id: user.userId, email, name: email.split('@')[0], emailVerified });
    }
  }

  /**
   * Register a new user. Returns 'CONFIRM_SIGN_UP' when Cognito has sent a
   * verification code (the normal case now that auto-confirm is removed), or
   * 'DONE' if somehow the user is already confirmed.
   */
  async signUp(email: string, password: string): Promise<'CONFIRM_SIGN_UP' | 'DONE'> {
    const { nextStep } = await amplifySignUp({
      username: email,
      password,
      options: { userAttributes: { email } },
    });
    if (nextStep.signUpStep === 'CONFIRM_SIGN_UP') {
      this._pendingConfirmation.set(email);
      sessionStorage.setItem('pendingConfirmationEmail', email);
      // Hold the password in memory so verify-email page doesn't need to pass it via router state
      this.pendingPassword = password;
      // Auto-login immediately so user lands on /home without waiting for email verify
      await this.signIn(email, password);
      return 'CONFIRM_SIGN_UP';
    }
    // Auto-confirmed (shouldn't happen anymore, but handle gracefully)
    await this.signIn(email, password);
    return 'DONE';
  }

  /** Confirm email verification code after sign-up. Then sign the user in. */
  async confirmSignUp(email: string, code: string): Promise<void> {
    const password = this.pendingPassword ?? '';
    this.pendingPassword = null; // clear immediately — single use
    await amplifyConfirmSignUp({ username: email, confirmationCode: code });
    this._pendingConfirmation.set(null);
    sessionStorage.removeItem('pendingConfirmationEmail');
    if (password) {
      await this.signIn(email, password);
    }
  }

  async signOut(): Promise<void> {
    await amplifySignOut();
    this._pendingConfirmation.set(null);
    sessionStorage.removeItem('pendingConfirmationEmail');
    this._user.set(null);
  }

  /** Returns the pending confirmation email from memory or sessionStorage fallback. */
  getPendingEmail(): string | null {
    return this._pendingConfirmation() ?? sessionStorage.getItem('pendingConfirmationEmail');
  }

  /** Delete the current Cognito user account permanently. */
  async deleteAccount(): Promise<void> {
    await amplifyDeleteUser();
    this._pendingConfirmation.set(null);
    this._user.set(null);
  }

  async getIdToken(): Promise<string | null> {
    try {
      const session = await fetchAuthSession();
      return session.tokens?.idToken?.toString() ?? null;
    } catch {
      return null;
    }
  }

  async resendConfirmation(email: string): Promise<void> {
    await resendSignUpCode({ username: email });
  }

  /** Trigger Cognito to send a password-reset code to the user's email. */
  async resetPassword(email: string): Promise<void> {
    await amplifyResetPassword({ username: email });
  }

  /** Complete the forgot-password flow with the code + new password. */
  async confirmResetPassword(email: string, code: string, newPassword: string): Promise<void> {
    await amplifyConfirmResetPassword({ username: email, confirmationCode: code, newPassword });
  }
}
