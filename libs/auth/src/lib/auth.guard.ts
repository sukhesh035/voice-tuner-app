import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { switchMap, map } from 'rxjs/operators';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router      = inject(Router);

  // Wait for Cognito session restore to finish before deciding.
  // On a real device, fetchAuthSession takes 300–800ms over the network —
  // without this wait the guard would read the initial false from the
  // BehaviorSubject and redirect logged-in users to /login.
  return authService.initialized$.pipe(
    switchMap(() => authService.isAuthenticated$),
    map(isAuth => isAuth ? true : router.createUrlTree(['/login']))
  );
};
