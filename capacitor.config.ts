import type { CapacitorConfig } from '@capacitor/cli';
import { KeyboardResize, KeyboardStyle } from '@capacitor/keyboard';

const config: CapacitorConfig = {
  appId: 'in.airjournal.app',
  appName: 'AIR Journal',
  webDir: 'dist',
  backgroundColor: '#FAF6EC',
  loggingBehavior: 'production',
  server: {
    androidScheme: 'https',
    cleartext: false
  },
  android: {
    backgroundColor: '#FAF6EC',
    allowMixedContent: false,
    webContentsDebuggingEnabled: false
  },
  plugins: {
    Keyboard: {
      resize: KeyboardResize.Native,
      style: KeyboardStyle.Light,
      resizeOnFullScreen: true
    },
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 500,
      launchFadeOutDuration: 180,
      backgroundColor: '#FAF6EC',
      showSpinner: false
    }
  }
};

export default config;
