import { StatusBar, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ConvexProvider, ConvexReactClient } from 'convex/react';
import codePush from 'react-native-code-push';
import TaskFeedScreen from './src/screens/TaskFeedScreen';
import { CONVEX_URL } from './src/config';

const convex = new ConvexReactClient(CONVEX_URL, {
  unsavedChangesWarning: false, // required for React Native
});

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <ConvexProvider client={convex}>
      <SafeAreaProvider>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
        <TaskFeedScreen />
      </SafeAreaProvider>
    </ConvexProvider>
  );
}

// codePush is undefined when the native module isn't available (e.g. Jest,
// or if the CodePush native module fails to load) — fall back to the plain App.
export default typeof codePush === 'function' ? codePush(App) : App;
