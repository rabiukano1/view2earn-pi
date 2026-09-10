import { NativeModules, NativeEventEmitter } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { ReferralAttribution } = NativeModules;

const STORAGE_KEY = '@view2earn_attributed_referrer';
const ATTRIBUTED_REFERRER_KEY = '@view2earn_install_referrer';

// Reads the referral code attributed at install/deep-link time (Play Store
// `referrer=` or a `view2earn://...?referrer=...` link) so the app can apply it
// automatically after signup — no manual code entry required.
export async function captureAttributedReferrer(): Promise<string | null> {
  if (!ReferralAttribution) return null;
  try {
    const referrer: string | null = await ReferralAttribution.getReferrer();
    if (referrer) {
      await AsyncStorage.setItem(STORAGE_KEY, referrer);
    }
    return referrer;
  } catch {
    return null;
  }
}

// Returns any referrer captured during this install/link, then clears it so it
// is applied only once. Falls back to any value already persisted.
export async function consumeAttributedReferrer(): Promise<string | null> {
  try {
    const fresh = await captureAttributedReferrer();
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    const code = fresh || stored;
    if (code) {
      await AsyncStorage.removeItem(STORAGE_KEY);
    }
    return code;
  } catch {
    return null;
  }
}

// Subscribe to attribution events emitted after JS has loaded (deep links that
// arrive while the app is running). Returns an unsubscribe function.
export function subscribeToReferralAttribution(
  onReferrer: (referrer: string) => void,
): () => void {
  if (!ReferralAttribution) return () => {};
  const emitter = new NativeEventEmitter(ReferralAttribution);
  const sub = emitter.addListener('onReferralAttribution', (payload: any) => {
    const referrer = payload?.referrer;
    if (referrer) {
      AsyncStorage.setItem(STORAGE_KEY, referrer).catch(() => {});
      onReferrer(referrer);
    }
  });
  return () => sub.remove();
}

export { ATTRIBUTED_REFERRER_KEY };
