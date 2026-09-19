import React from 'react';
import { ActivityIndicator, StatusBar, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ConvexReactClient } from 'convex/react';
import { ConvexAuthProvider } from '@convex-dev/auth/react';
import type { TokenStorage } from '@convex-dev/auth/react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer } from '@react-navigation/native';
import { CONVEX_URL } from './src/config';
import { useAuth } from './src/auth/AuthContext';
import BiometricGate from './src/auth/BiometricGate';
import AppNavigator from './src/navigation/AppNavigator';
import LoginScreen from './src/screens/LoginScreen';
import { colors } from './src/theme';
import { initializeAdMob } from './src/services/admobService';
import { initInterstitial } from './src/services/interstitialService';

const convex = new ConvexReactClient(CONVEX_URL, {
  unsavedChangesWarning: false,
});

// Convex Auth persists its tokens here. AsyncStorage is fine for dev; use a
// secure keystore (react-native-keychain) before production.
const tokenStorage: TokenStorage = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
};

import SplashScreen, { ONBOARDING_STORAGE_KEY } from './src/screens/SplashScreen';
import BootSplash from 'react-native-bootsplash';

// Show the app once signed in, the login screen otherwise. Every screen reads
// the user from useAuth(), so inside AppNavigator a signed-in user always exists.
function Gate() {
  const { userId, ready } = useAuth();
  const [showSplash, setShowSplash] = React.useState<boolean | null>(null);
  // Bounds how long we keep the native splash up waiting on the auth round-trip.
  const [bootTimedOut, setBootTimedOut] = React.useState(false);

  React.useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_STORAGE_KEY)
      .then((seen) => {
        setShowSplash(seen !== 'true');
      })
      .catch(() => {
        setShowSplash(false);
      });
  }, []);

  // Hide the native boot splash as soon as we can render real UI. We no longer
  // block the whole app on the Convex connection — only the brief window below
  // while auth is still resolving (so a signed-in user doesn't see a login
  // flash). A safety timeout guarantees a slow network can never hang startup.
  React.useEffect(() => {
    if (showSplash === null) return;
    if (showSplash || ready || bootTimedOut) {
      BootSplash.hide({ fade: true }).catch(() => {});
      return;
    }
    const t = setTimeout(() => setBootTimedOut(true), 2500);
    return () => clearTimeout(t);
  }, [showSplash, ready, bootTimedOut]);

  if (showSplash === null) {
    // ponytail: Render branded loader instead of null so users never see a pitch-black screen during startup initialization.
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgDark, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  // Keep the splash/loader visible while auth resolves so signed-in users don't see a login flash.
  if (!ready && !bootTimedOut) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgDark, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return userId ? (
    <BiometricGate>
      <AppNavigator />
    </BiometricGate>
  ) : (
    <AppNavigator onShowSplash={() => setShowSplash(true)} />
  );
}

import { LanguageProvider } from './src/i18n/LanguageContext';

import type { LinkingOptions } from '@react-navigation/native';
import type { RootStackParamList } from './src/navigation/types';

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['view2earn://', 'https://view2earn.app', 'https://www.view2earn.app'],
  config: {
    screens: {
      MainTabs: {
        screens: {
          Home: 'home',
          Tasks: 'tasks',
          Settings: 'settings',
          Profile: 'profile',
        },
      },
      Login: 'login',
      Marketplace: 'marketplace',
      CreateListing: 'create-listing/:userId',
      Academy: 'academy',
      Quiz: 'quiz',
      Spin: 'spin/:userId',
      Level: 'level',
      Surveys: 'surveys',
      Terms: 'terms',
      Policy: 'policy/:policy',
      Referral: 'referral',
      LinkedAccounts: 'linked-accounts',
      Security: 'security',
      Leaderboard: 'leaderboard',
      Achievements: 'achievements',
      Stats: 'stats',
      Donate: 'donate',
      WalletAuth: 'wallet-auth/:nonce',
    },
  },
};

function App() {
  React.useEffect(() => {
    // Defer AdMob SDK init so it doesn't compete with cold-start network/auth.
    const t = setTimeout(() => {
      initializeAdMob().then(() => initInterstitial());
    }, 1500);
    return () => clearTimeout(t);
  }, []);

  return (
    <ConvexAuthProvider client={convex} storage={tokenStorage}>
      <SafeAreaProvider>
        <LanguageProvider>
          <NavigationContainer linking={linking}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
            <Gate />
          </NavigationContainer>
        </LanguageProvider>
      </SafeAreaProvider>
    </ConvexAuthProvider>
  );
}
export default App;
