import { Alert, Linking } from 'react-native';
import InAppBrowser from 'react-native-inappbrowser-reborn';

const BROWSER_OPTIONS = {
  toolbarColor: '#075E54',
  showTitle: true,
  enableUrlBarHiding: true,
} as const;

export async function openUrl(url: string): Promise<void> {
  try {
    if (await InAppBrowser.isAvailable()) {
      await InAppBrowser.open(url, BROWSER_OPTIONS);
      return;
    }
  } catch (err) {
    console.warn('[openUrl] InAppBrowser failed, falling back to Linking:', err);
  }
  await Linking.openURL(url);
}

// Pi Browser's deep link is the page URL with the scheme swapped for `pi://`
// (pi://pi.view2earn.org/link?token=…). Same helper as the main app. Tried
// directly rather than via canOpenURL, which is blocked by Android 11+ package
// visibility for schemes not listed in the manifest <queries>.
export async function openInPiBrowser(url: string): Promise<void> {
  if (!url) return;
  const clean = url.replace(/^https?:\/\//i, '');
  try {
    await Linking.openURL(`pi://${clean}`);
    return;
  } catch {
    // Pi Browser not installed — fall through to a normal browser so the user
    // at least sees the page telling them to open it in Pi Browser.
  }
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert('Could not open Pi Browser', `Open it manually:\n${url}`);
  }
}
