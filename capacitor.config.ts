import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.119caa9520bb4e219b73b47109416a59',
  appName: 'PayLoom Instants',
  webDir: 'dist',
  server: {
    url: 'https://119caa95-20bb-4e21-9b73-b47109416a59.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#250e52',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#250e52',
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
  },
};

export default config;
