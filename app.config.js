// Load .env before Expo reads config (optional - EAS injects env vars during build)
try {
  require('dotenv').config();
} catch {
  // dotenv not available when EAS CLI reads config
}

// Store builds: omit dev client so the native project does not include expo-dev-menu / launcher.
// EAS sets EAS_BUILD_PROFILE during cloud builds (e.g. "production", "development").
const easProfile = process.env.EAS_BUILD_PROFILE
const includeDevClient = easProfile !== 'production'

const plugins = [
  'expo-router',
  'expo-font',
  ...(includeDevClient ? ['expo-dev-client'] : []),
  [
    'expo-build-properties',
    {
      ios: {
        // @react-native-ml-kit/text-recognition (GoogleMLKit) requires iOS 15.5+
        deploymentTarget: '15.5',
      },
    },
  ],
  'expo-sharing',
  [
    'expo-camera',
    {
      cameraPermission:
        'Fillr needs camera access to scan barcodes and photograph ingredient labels.',
    },
  ],
]

module.exports = {
  expo: {
    name: 'Fillr',
    slug: 'fillr',
    version: '1.2.0',
    orientation: 'portrait',
    /** Store / home-screen launcher icon. */
    icon: './assets/icon-ios.png',
    userInterfaceStyle: 'light',
    scheme: 'fillr',
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#f0fdf4',
    },
    ios: {
      supportsTablet: true,
      buildNumber: '4',
      bundleIdentifier: 'com.nav004.fillr',
      icon: './assets/icon-ios.png',
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      adaptiveIcon: {
        backgroundColor: '#f0fdf4',
        foregroundImage: './assets/icon.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
      package: 'com.nav004.fillr',
      softwareKeyboardLayoutMode: 'resize',
    },
    web: {
      favicon: './assets/favicon.png',
    },
    plugins,
    extra: {
      eas: {
        projectId: 'd6910c20-2064-4685-909f-a6aeaef15d29',
      },
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    },
  },
};
