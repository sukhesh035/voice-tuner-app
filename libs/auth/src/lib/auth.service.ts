import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  signIn as amplifySignIn,
  signUp as amplifySignUp,
  signOut as amplifySignOut,
  getCurrentUser,
  fetchAuthSession
} from 'aws-amplify/auth';

export interface AppUser {
  id:    string;
  email: string;
  name:  string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private userSubject = new BehaviorSubject<AppUser | null>(null);

  get user$(): Observable<AppUser | null> { return this.userSubject.asObservable(); }
  get isAuthenticated$(): Observable<boolean> { return this.user$.pipe(map(u => u !== null)); }
  get currentUser(): AppUser | null { return this.userSubject.value; }

  async initialize(): Promise<void> {
    try {
      const user = await getCurrentUser();
      this.userSubject.next({ id: user.userId, email: user.username, name: user.username });
    } catch {
      this.userSubject.next(null);
    }
  }

  async signIn(email: string, password: string): Promise<void> {
    const { isSignedIn } = await amplifySignIn({ username: email, password });
    if (isSignedIn) {
      const user = await getCurrentUser();
      this.userSubject.next({ id: user.userId, email, name: email.split('@')[0] });
    }
  }

  async signUp(email: string, password: string): Promise<void> {
    await amplifySignUp({ username: email, password, options: { userAttributes: { email } } });
  }

  async signOut(): Promise<void> {
    await amplifySignOut();
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
}
