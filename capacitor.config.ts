import type { CapacitorConfig } from '@capacitor/cli';
import { KeyboardResize, KeyboardStyle } from '@capacitor/keyboard';

const liveServerUrl = process.env.CAPACITOR_LIVE_SERVER_URL?.trim();

if (liveServerUrl) {
  const parsed = new URL(liveServerUrl);
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
    throw new Error('CAPACITOR_LIVE_SERVER_URL must be a credential-free HTTPS URL.');
  }
}

const config: CapacitorConfig = {
  appId: 'in.airjournal.app',
  appName: 'AIR Journal',
  webDir: 'dist',
  backgroundColor: '#FAF6EC',
  loggingBehavior: 'production',
  server: {
    ...(liveServerUrl ? { url: liveServerUrl } : {}),
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
