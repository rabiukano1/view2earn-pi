import { Alert, Platform, Share, ToastAndroid } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { smartOpenUrl } from '../lib/openUrl';
import { detectPlatform, resolveShortUrl, validateUrl } from '../services/TaskLinkService';

/**
 * Central entry point for opening ANY external link.
 *
 * Flow:
 *  1. Validate the URL (http/https only).
 *  2. Detect the platform.
 *  3. Resolve a supported short link (e.g. vm./vt.tiktok.com) when necessary —
 *     never guess the destination type from a short code.
 *  4. Try the exact native destination via smartOpenUrl's per-platform deep
 *     link builders (only where the platform reliably supports the exact
 *     destination).
 *  5. Fall back to the EXACT HTTPS URL in the in-app browser.
 *
 * The exact URL the creator supplied is preserved end to end.
 */
export async function openSocialLink(url: string): Promise<void> {
  try {
    if (!url) return;

    // Normalize URLs missing a protocol (e.g. "vm.tiktok.com/abc" → "https://…")
    let normalized = url.trim();
    if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//i.test(normalized) && normalized.includes('.')) {
      normalized = `https://${normalized}`;
    }

    if (!validateUrl(normalized) || !/^https?:\/\//i.test(normalized)) {
      Alert.alert('Invalid link', 'This link is not supported.');
      return;
    }

    const platform = detectPlatform(normalized);
    const resolvedUrl = await resolveShortUrl(normalized, platform);

    // smartOpenUrl handles exact-native attempts and in-app-browser fallback.
    await smartOpenUrl(resolvedUrl, platform);
  } catch {
    Alert.alert('Unable to open this link', 'Please try again.');
  }
}

/** Follow a creator — delegates to the centralized handler. */
export async function followUser(url: string): Promise<void> {
  await openSocialLink(url);
}

/** Copy the exact profile URL and confirm with a short toast (Android) / alert. */
export async function copyProfileLink(url: string): Promise<void> {
  try {
    await Clipboard.setString(url);
    if (Platform.OS === 'android') {
      ToastAndroid.show('Profile link copied', ToastAndroid.SHORT);
    } else {
      Alert.alert('Copied', 'Profile link copied to clipboard');
    }
  } catch {
    Alert.alert('Could not copy link', 'Please try again.');
  }
}

/** Share the exact profile URL via the system share sheet. */
export async function shareProfile(url: string, name: string): Promise<void> {
  try {
    await Share.share({
      message: `Check out ${name} on View2earn:\n${url}`,
    });
  } catch {
    Alert.alert('Could not share', 'Please try again.');
  }
}