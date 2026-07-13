import React, { Suspense, lazy } from 'react';
import { ActivityIndicator, StatusBar, StyleSheet, useColorScheme, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ConvexProvider, ConvexReactClient } from 'convex/react';
import codePush from 'react-native-code-push';
import { CONVEX_URL } from './src/config';

const convex = new ConvexReactClient(CONVEX_URL, {
  unsavedChangesWarning: false,
});

const TaskFeedScreen = lazy(() => import('./src/screens/TaskFeedScreen'));

function Loading() {
  const dark = useColorScheme() === 'dark';
  return (
    <View style={[styles.loading, dark && styles.loadingDark]}>
      <ActivityIndicator size="large" color="#7C3AED" />
    </View>
  );
}

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <ConvexProvider client={convex}>
      <SafeAreaProvider>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
        <Suspense fallback={<Loading />}>
          <TaskFeedScreen />
        </Suspense>
      </SafeAreaProvider>
    </ConvexProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4F4F5',
  },
  loadingDark: {
    backgroundColor: '#18181B',
  },
});

export default typeof codePush === 'function' ? codePush(App) : App;
