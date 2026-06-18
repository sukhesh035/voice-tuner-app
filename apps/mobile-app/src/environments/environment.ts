// ─────────────────────────────────────────────────────────────────────────────
// DEFAULT ENVIRONMENT STUB — safe to commit (no real secrets).
// In CI, generate-env.mjs overwrites this file with live stack outputs.
// For local development, the "local" build configuration replaces this file
// with environment.local.ts via Angular fileReplacements.
// ─────────────────────────────────────────────────────────────────────────────
export const environment = {
  production: false,
  apiBaseUrl: '',
  amplify: {
    region: '',
    userPoolId: '',
    userPoolClientId: '',
    identityPoolId: '',
  },
  s3: {
    bucket: '',
    region: '',
    baseUrl: '',
  },
  web: {
    url: '',
  },
  featureFlags: {
    aiCoach: true,
    guruClassroom: true,
    offlineMode: true,
  },
  liveUpdate: {
    manifestUrl: '',
  },
  enableAnalytics: false,
  firebase: {
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: '',
    measurementId: '',
  },
  revenueCat: {
    appleApiKey: 'appl_REPLACE_WITH_DEV_KEY',
    googleApiKey: 'goog_REPLACE_WITH_DEV_KEY',
  },
};
