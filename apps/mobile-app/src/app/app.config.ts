import { ApplicationConfig, importProvidersFrom, isDevMode, inject, APP_INITIALIZER } from '@angular/core';
import { provideRouter, withPreloading, PreloadAllModules, Router, NavigationEnd, NavigationStart } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { ServiceWorkerModule } from '@angular/service-worker';
import { provideIonicAngular } from '@ionic/angular/standalone';
import { filter } from 'rxjs/operators';
import { routes } from './app.routes';
import { authInterceptor } from '@voice-tuner/auth';
import { AnalyticsService } from './core/services/analytics.service';
import { PerformanceService } from './core/services/performance.service';
import { RemoteConfigService } from './core/services/remote-config.service';

/** Screen name map: route path segment → human-readable name */
const SCREEN_NAMES: Record<string, string> = {
  home:     'Home',
  tanpura:  'Tanpura',
  sing:     'Sing',
  practice: 'Practice',
  progress: 'Progress',
  settings: 'Settings',
  profile:  'Profile',
  login:            'Login',
  signup:           'Sign Up',
  'forgot-password': 'Forgot Password',
  'verify-email':   'Verify Email',
  'reset-password': 'Reset Password',
};

function routerAnalyticsInitializer(
  router: Router,
  analytics: AnalyticsService,
  perf: PerformanceService,
): () => void {
  return () => {
    // Start app_startup trace as early as possible; stop on first NavigationEnd
    perf.startAppStartupTrace();
    let startupStopped = false;

    router.events.pipe(filter(e => e instanceof NavigationStart)).subscribe((e) => {
      const nav = e as NavigationStart;
      const segment = nav.url.split('/').filter(Boolean).pop() ?? 'home';
      const screenName = SCREEN_NAMES[segment] ?? segment;
      perf.startScreenTrace(screenName);
    });

    router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe((e) => {
      const nav = e as NavigationEnd;
      const segment = nav.urlAfterRedirects.split('/').filter(Boolean).pop() ?? 'home';
      const screenName = SCREEN_NAMES[segment] ?? segment;

      analytics.setScreen(screenName);
      perf.stopScreenTrace(screenName);

      if (!startupStopped) {
        startupStopped = true;
        perf.stopAppStartupTrace();
      }
    });
  };
}

function remoteConfigInitializer(remoteConfig: RemoteConfigService): () => Promise<void> {
  return () => remoteConfig.initialize();
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
    // Remote Config: fetch + activate before app renders
    {
      provide: APP_INITIALIZER,
      useFactory: () => {
        const remoteConfig = inject(RemoteConfigService);
        return remoteConfigInitializer(remoteConfig);
      },
      multi: true,
    },
    // Analytics + Performance: screen tracking + traces on navigation events
    {
      provide: APP_INITIALIZER,
      useFactory: () => {
        const router    = inject(Router);
        const analytics = inject(AnalyticsService);
        const perf      = inject(PerformanceService);
        return routerAnalyticsInitializer(router, analytics, perf);
      },
      multi: true,
    }
  ]
};
