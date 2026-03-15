import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sruti.voicetuner',
  appName: 'Swara AI',
  webDir: '../../dist/apps/mobile-app/browser',
  server: {
    // For local dev with live reload: uncomment and set to your machine IP
    // url: 'http://192.168.1.x:4200',
    // cleartext: true,
  },
  ios: {
    contentInset: 'always',
    backgroundColor: '#0A0A1B',
    preferredContentMode: 'mobile',
  },
  android: {
    backgroundColor: '#0A0A1B',
    allowMixedContent: false,
  },
  plugins: {
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
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#7C4DFF',
    },
  },
};

export default config;
