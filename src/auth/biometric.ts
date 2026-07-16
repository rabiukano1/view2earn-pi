import ReactNativeBiometrics from 'react-native-biometrics';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Biometric app-lock. Convex Auth keeps the session across restarts, so on a
// second open the user is still signed in — this gate asks for a fingerprint /
// Face ID before revealing the app when the user has turned the lock on.

const LOCK_KEY = 'v2e_biometric_lock';
const rnBiometrics = new ReactNativeBiometrics({ allowDeviceCredentials: true });

export async function biometricAvailable(): Promise<boolean> {
  try {
    const { available } = await rnBiometrics.isSensorAvailable();
    return available;
  } catch {
    return false;
  }
}

export async function promptBiometric(message = 'Unlock View2Earn'): Promise<boolean> {
  try {
    const { success } = await rnBiometrics.simplePrompt({ promptMessage: message });
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
