import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ConvexReactClient } from 'convex/react';
import { ConvexAuthProvider } from '@convex-dev/auth/react';
import type { TokenStorage } from '@convex-dev/auth/react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer } from '@react-navigation/native';
import { CONVEX_URL } from './src/config';
import AppNavigator from './src/navigation/AppNavigator';

const convex = new ConvexReactClient(CONVEX_URL, {
  unsavedChangesWarning: false,
});

const tokenStorage: TokenStorage = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
};

export default function App() {
  return (
    <ConvexAuthProvider client={convex} storage={tokenStorage}>
      <SafeAreaProvider>
        <NavigationContainer>
          <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
          <AppNavigator />
        </NavigationContainer>
      </SafeAreaProvider>
    </ConvexAuthProvider>
  );
}
