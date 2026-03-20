import { bootstrapApplication } from '@angular/platform-browser';
import { Amplify } from 'aws-amplify';
import { initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
import { Capacitor } from '@capacitor/core';
import { defineCustomElements } from '@ionic/pwa-elements/loader';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';
import { environment } from './environments/environment';

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId:       environment.amplify.userPoolId,
      userPoolClientId: environment.amplify.userPoolClientId,
    },
  },
});

// Initialise Firebase only when config is present (production).
// In dev, Firebase secrets are intentionally empty — skip init to avoid SDK errors.
if (environment.firebase.projectId) {
  const firebaseApp = initializeApp(environment.firebase);

  // Analytics web SDK: only initialise in browser contexts AND when enabled (production)
  if (!Capacitor.isNativePlatform() && environment.enableAnalytics) {
    getAnalytics(firebaseApp);
  }
}

// Register Ionic PWA Elements (provides web fallback UI for Camera, Toast, etc.)
defineCustomElements(window);

bootstrapApplication(AppComponent, appConfig).catch(console.error);
