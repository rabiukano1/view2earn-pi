import { Alert, Platform, Share, ToastAndroid, Linking } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import InAppBrowser from 'react-native-inappbrowser-reborn';

const resolveUrl = async (url: string): Promise<string> => {
  try {
    if (url.includes('vm.tiktok.com') || url.includes('tiktok.com/t/')) {
      const response = await fetch(url, { method: 'HEAD', redirect: 'follow' });
      return response.url; 
    }
  } catch (e) {
    console.log('Failed to resolve url', e);
  }
  return url;
};

const getDeepLink = (url: string) => {
  // TikTok Video
  if (url.includes('tiktok.com/video/')) {
    const videoId = url.split('/video/')[1].split('?')[0];
    return `snssdk1233://aweme/detail/${videoId}`;
  }
  // TikTok Profile
  if (url.includes('tiktok.com/@')) {
    const username = url.split('@')[1].split('/')[0];
    return `snssdk1233://user/profile/${username}`;
  }
  // Instagram
  if (url.includes('instagram.com/')) {
    const parts = url.split('instagram.com/')[1].split('/');
    if (parts[1] === 'p' || parts[1] === 'reel') return `instagram://media?id=${parts[2]}`;
    return `instagram://user?username=${parts[0]}`;
  }
  // YouTube
  if (url.includes('youtu.be/')) {
    const videoId = url.split('youtu.be/')[1].split('?')[0];
    return `vnd.youtube://watch?v=${videoId}`;
  }
  if (url.includes('youtube.com/watch')) {
    try {
      const videoId = new URL(url).searchParams.get('v') || '';
      return `vnd.youtube://watch?v=${videoId}`;
    } catch {
      return url;
    }
  }
  return url;
};

export const openSocialLink = async (originalUrl: string) => {
  try {
    const url = await resolveUrl(originalUrl); // 1. Expand short links first
    const deepLink = getDeepLink(url); // 2. Convert to app scheme
    const canOpen = await Linking.canOpenURL(deepLink);
    if (canOpen && deepLink !== url) {
      await Linking.openURL(deepLink); // 3. Open App
    } else {
      await InAppBrowser.open(url, { toolbarColor: '#075E54', showTitle: true }); // 4. Fallback
    }
  } catch (err) {
    Alert.alert('Error', 'Cannot open link');
    try {
      await InAppBrowser.open(originalUrl, { toolbarColor: '#075E54' });
    } catch {}
  }
};

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