import ReactNativeBiometrics from 'react-native-biometrics';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Biometric app-lock. Convex Auth keeps the session across restarts, so on a
// second open the user is still signed in — this gate asks for a fingerprint /
// Face ID before revealing the app when the user has turned the lock on.

const LOCK_KEY = 'v2e_biometric_lock';

// Lazy + guarded: never touch the native module at import time. If it isn't
// linked (e.g. running an APK built before it was added), biometric features
// just no-op instead of crashing the whole app on launch.
let rnBiometrics: ReactNativeBiometrics | null = null;
let triedInit = false;
function getBiometrics(): ReactNativeBiometrics | null {
  if (triedInit) return rnBiometrics;
  triedInit = true;
  try {
    rnBiometrics = new ReactNativeBiometrics({ allowDeviceCredentials: true });
  } catch {
    rnBiometrics = null;
  }
  return rnBiometrics;
}

export async function biometricAvailable(): Promise<boolean> {
  const rn = getBiometrics();
  if (!rn) return false;
  try {
    const { available } = await rn.isSensorAvailable();
    return available;
  } catch {
    return false;
  }
}

export async function promptBiometric(message = 'Unlock View2Earn'): Promise<boolean> {
  const rn = getBiometrics();
  if (!rn) return false;
  try {
    const { success } = await rn.simplePrompt({ promptMessage: message });
    return success;
  } catch {
    return false;
  }
}

export async function isLockEnabled(): Promise<boolean> {
  return (await AsyncStorage.getItem(LOCK_KEY)) === '1';
}

export async function setLockEnabled(on: boolean): Promise<void> {
  if (on) await AsyncStorage.setItem(LOCK_KEY, '1');
  else await AsyncStorage.removeItem(LOCK_KEY);
}
