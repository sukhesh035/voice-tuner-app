import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  signIn as amplifySignIn,
  signUp as amplifySignUp,
  signOut as amplifySignOut,
  getCurrentUser,
  fetchAuthSession,
  resendSignUpCode
} from 'aws-amplify/auth';

export interface AppUser {
  id:    string;
  email: string;
  name:  string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private userSubject = new BehaviorSubject<AppUser | null>(null);
  private pendingConfirmationSubject = new BehaviorSubject<string | null>(null);

  get user$(): Observable<AppUser | null> { return this.userSubject.asObservable(); }
  get isAuthenticated$(): Observable<boolean> { return this.user$.pipe(map(u => u !== null)); }
  get currentUser(): AppUser | null { return this.userSubject.value; }
  /** Email address waiting for Cognito confirmation, or null if none. */
  get pendingConfirmation$(): Observable<string | null> { return this.pendingConfirmationSubject.asObservable(); }
  get pendingConfirmationEmail(): string | null { return this.pendingConfirmationSubject.value; }

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
      this.userSubject.next({
        id:    user.userId,
        email,
        name:  (session.tokens.idToken.payload['name'] as string)
               ?? email.split('@')[0],
      });
    } catch {
      this.userSubject.next(null);
    }
  }

  async signIn(email: string, password: string): Promise<void> {
    // If Amplify still has a stale session in localStorage, signIn will throw
    // UserAlreadyAuthenticatedException. Sign out silently first to clear it.
    try { await amplifySignOut(); } catch { /* ignore */ }
    const { isSignedIn } = await amplifySignIn({ username: email, password });
    if (isSignedIn) {
      const user = await getCurrentUser();
      this.pendingConfirmationSubject.next(null);
      this.userSubject.next({ id: user.userId, email, name: email.split('@')[0] });
    }
  }

  async signUp(email: string, password: string): Promise<void> {
    await amplifySignUp({ username: email, password, options: { userAttributes: { email } } });
    this.pendingConfirmationSubject.next(email);
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
}
