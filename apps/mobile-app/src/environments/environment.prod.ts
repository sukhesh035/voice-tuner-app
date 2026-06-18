// ─────────────────────────────────────────────────────────────────────────────
// PRODUCTION ENVIRONMENT STUB — safe to commit (no real secrets).
// In CI, generate-env.mjs overwrites this file with live stack outputs
// before the production build runs.
// ─────────────────────────────────────────────────────────────────────────────
export const environment = {
  production: true,
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
  enableAnalytics: true,
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
    appleApiKey: 'appl_REPLACE_WITH_PROD_KEY',
    googleApiKey: 'goog_REPLACE_WITH_PROD_KEY',
  },
};
