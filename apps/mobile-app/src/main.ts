import { bootstrapApplication } from '@angular/platform-browser';
import { Amplify } from 'aws-amplify';
import { initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
import { Capacitor } from '@capacitor/core';
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

// Initialise Firebase (web SDK — required even on native for @capacitor-firebase to work)
const firebaseApp = initializeApp({
  apiKey:            'AIzaSyDROHvKgZe59e-MI0tWgu9XQLw_ZXLIsik',
  authDomain:        'swara-ai-4caf4.firebaseapp.com',
  projectId:         'swara-ai-4caf4',
  storageBucket:     'swara-ai-4caf4.firebasestorage.app',
  messagingSenderId: '902627762999',
  appId:             '1:902627762999:web:a4529814deb1cd132b70b2',
  measurementId:     'G-MTV5EP385L',
});

// Analytics web SDK: only initialise in browser contexts AND when enabled (production)
if (!Capacitor.isNativePlatform() && environment.enableAnalytics) {
  getAnalytics(firebaseApp);
}

bootstrapApplication(AppComponent, appConfig).catch(console.error);
