import { ApplicationConfig, importProvidersFrom, isDevMode, inject, APP_INITIALIZER } from '@angular/core';
import { provideRouter, withPreloading, PreloadAllModules, Router, NavigationEnd } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { ServiceWorkerModule } from '@angular/service-worker';
import { provideIonicAngular } from '@ionic/angular/standalone';
import { filter } from 'rxjs/operators';
import { routes } from './app.routes';
import { authInterceptor } from '@voice-tuner/auth';
import { AnalyticsService } from './core/services/analytics.service';

/** Screen name map: route path segment → human-readable name */
const SCREEN_NAMES: Record<string, string> = {
  home:     'Home',
  tanpura:  'Tanpura',
  sing:     'Sing',
  practice: 'Practice',
  progress: 'Progress',
  settings: 'Settings',
  profile:  'Profile',
  login:    'Login',
};

function routerAnalyticsInitializer(router: Router, analytics: AnalyticsService): () => void {
  return () => {
    router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe((e) => {
      const nav = e as NavigationEnd;
      // Extract the last path segment as the screen name
      const segment = nav.urlAfterRedirects.split('/').filter(Boolean).pop() ?? 'home';
      const screenName = SCREEN_NAMES[segment] ?? segment;
      analytics.setScreen(screenName);
    });
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withPreloading(PreloadAllModules)),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAnimations(),
    provideIonicAngular({
      mode: 'ios',
      animated: true,
      rippleEffect: false
    }),
    importProvidersFrom(
      ServiceWorkerModule.register('ngsw-worker.js', {
        enabled: !isDevMode(),
        registrationStrategy: 'registerWhenStable:30000'
      })
    ),
    {
      provide: APP_INITIALIZER,
      useFactory: () => {
        const router    = inject(Router);
        const analytics = inject(AnalyticsService);
        return routerAnalyticsInitializer(router, analytics);
      },
      multi: true,
    }
  ]
};
