import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.swaraai.app',
  appName: 'Swara AI',
  webDir: '../../dist/apps/mobile-app/browser',
  server: {
    // For local dev with live reload: uncomment and set to your machine IP
    // url: 'http://192.168.1.x:4200',
    // cleartext: true,
  },
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#0A0A1B',
    preferredContentMode: 'mobile',
  },
  android: {
    backgroundColor: '#0A0A1B',
    allowMixedContent: false,
  },
  plugins: {
    CapacitorUpdater: {
      // We drive updates manually from LiveUpdateService, not from the plugin's
      // built-in polling. The service fetches the manifest, downloads the zip,
      // and applies it at a safe moment (e.g. when the user returns to Home).
      autoUpdate: false,
      // Roll back to the built-in bundle if a downloaded update crashes on boot.
      autoDeleteFailed: true,
    },
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: '#0A0A1B',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      iosSpinnerStyle: 'large',
      spinnerColor: '#7C4DFF',
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#0A0A1B',
    },
    Keyboard: {
      resize: 'body',
      style: 'dark',
      resizeOnFullScreen: true,
    },
    FirebaseMessaging: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#7C4DFF',
    },
  },
};

export default config;
