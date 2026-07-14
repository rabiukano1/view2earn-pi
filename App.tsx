import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ConvexProvider, ConvexReactClient } from 'convex/react';
import { NavigationContainer } from '@react-navigation/native';
import codePush from 'react-native-code-push';
import { CONVEX_URL } from './src/config';
import AppNavigator from './src/navigation/AppNavigator';

const convex = new ConvexReactClient(CONVEX_URL, {
  unsavedChangesWarning: false,
});

function App() {
  return (
    <ConvexProvider client={convex}>
      <SafeAreaProvider>
        <NavigationContainer>
          <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
          <AppNavigator />
        </NavigationContainer>
      </SafeAreaProvider>
    </ConvexProvider>
  );
}

export default typeof codePush === 'function' ? codePush(App) : App;
