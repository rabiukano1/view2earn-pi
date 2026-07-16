import React from 'react';
import { ActivityIndicator, StatusBar, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ConvexReactClient } from 'convex/react';
import { ConvexAuthProvider } from '@convex-dev/auth/react';
import type { TokenStorage } from '@convex-dev/auth/react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer } from '@react-navigation/native';
import codePush from 'react-native-code-push';
import { CONVEX_URL } from './src/config';
import { useAuth } from './src/auth/AuthContext';
import BiometricGate from './src/auth/BiometricGate';
import AppNavigator from './src/navigation/AppNavigator';
import LoginScreen from './src/screens/LoginScreen';
import { colors } from './src/theme';

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

// Show the app once signed in, the login screen otherwise. Every screen reads
// the user from useAuth(), so inside AppNavigator a signed-in user always exists.
function Gate() {
  const { userId, ready } = useAuth();
  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }
  return userId ? (
    <BiometricGate>
      <AppNavigator />
    </BiometricGate>
  ) : (
    <LoginScreen />
  );
}

function App() {
  return (
    <ConvexAuthProvider client={convex} storage={tokenStorage}>
      <SafeAreaProvider>
        <NavigationContainer>
          <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
          <Gate />
        </NavigationContainer>
      </SafeAreaProvider>
    </ConvexAuthProvider>
  );
}

export default typeof codePush === 'function' ? codePush(App) : App;
