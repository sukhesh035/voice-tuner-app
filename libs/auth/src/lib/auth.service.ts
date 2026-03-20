import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { filter, map, take } from 'rxjs/operators';
import {
  signIn as amplifySignIn,
  signUp as amplifySignUp,
  signOut as amplifySignOut,
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
  private userSubject = new BehaviorSubject<AppUser | null>(null);
  private pendingConfirmationSubject = new BehaviorSubject<string | null>(null);
  private initializedSubject = new BehaviorSubject<boolean>(false);
  /** Ephemeral in-memory password held only during the signup → verify-email flow.
   *  Never persisted to storage. Cleared immediately after confirmSignUp(). */
  private pendingPassword: string | null = null;

  get user$(): Observable<AppUser | null> { return this.userSubject.asObservable(); }
  get isAuthenticated$(): Observable<boolean> { return this.user$.pipe(map(u => u !== null)); }
  get currentUser(): AppUser | null { return this.userSubject.value; }
  /** Email address waiting for Cognito confirmation, or null if none. */
  get pendingConfirmation$(): Observable<string | null> { return this.pendingConfirmationSubject.asObservable(); }
  get pendingConfirmationEmail(): string | null { return this.pendingConfirmationSubject.value; }
  /** Emits true (exactly once) when initialize() has completed — success or failure. */
  get initialized$(): Observable<true> {
    return this.initializedSubject.asObservable().pipe(
      filter((v): v is true => v === true),
      take(1)
    );
  }

  async initialize(): Promise<void> {
    try {
      // fetchAuthSession will silently use the stored refresh token to issue
      // new tokens if the access token is expired — this is the key piece that
      // makes the session survive page refreshes and app restarts.
      const session = await fetchAuthSession({ forceRefresh: false });
      if (!session.tokens?.idToken) {
        this.userSubject.next(null);
        return;
      }
      const user = await getCurrentUser();
      const email = session.tokens.idToken.payload['email'] as string ?? user.username;
      const emailVerified = session.tokens.idToken.payload['email_verified'] === true;
      this.userSubject.next({
        id:    user.userId,
        email,
        name:  (session.tokens.idToken.payload['name'] as string)
               ?? email.split('@')[0],
        emailVerified,
      });
    } catch {
      this.userSubject.next(null);
    } finally {
      // Always signal completion so guards and pages don't wait forever.
      this.initializedSubject.next(true);
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
      this.pendingConfirmationSubject.next(null);
      this.userSubject.next({ id: user.userId, email, name: email.split('@')[0], emailVerified });
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
      this.pendingConfirmationSubject.next(email);
      // Hold the password in memory so verify-email page doesn't need to pass it via router state
      this.pendingPassword = password;
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
    this.pendingConfirmationSubject.next(null);
    await this.signIn(email, password);
  }

  async signOut(): Promise<void> {
    await amplifySignOut();
    this.pendingConfirmationSubject.next(null);
    this.userSubject.next(null);
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

