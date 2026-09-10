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

export function openInPiBrowser(targetUrl: string) {
  const piBrowserDirect = `pi://browser?url=${encodeURIComponent(targetUrl)}`;
  const piBrowserFallback = `https://pi.browser/?url=${encodeURIComponent(targetUrl)}`;

  Linking.canOpenURL(piBrowserDirect)
    .then((supported) => {
      if (supported) {
        return Linking.openURL(piBrowserDirect);
      }
      return Linking.openURL(piBrowserFallback);
    })
    .catch(() => {
      openUrl(targetUrl);
    });
}
