import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './types';

// Lets code OUTSIDE the navigator trigger navigation — specifically the voice
// mini player, which is mounted above NavigationContainer so that playback
// survives screen changes, and therefore cannot use useNavigation().
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export function navigateFromAnywhere<T extends keyof RootStackParamList>(
  name: T,
  params?: RootStackParamList[T],
) {
  if (navigationRef.isReady()) {
    // @ts-expect-error — params are optional per-route; the ref API is loose here.
    navigationRef.navigate(name, params);
  }
}
