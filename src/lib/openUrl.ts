/**
 * Smart URL opener — tries the platform's native app first (Facebook, TikTok,
 * Instagram, X/Twitter, Telegram, YouTube), falling back to the browser if the
 * native app isn't installed.
 *
 * On Android 11+ (API 30+) `Linking.canOpenURL` frequently returns false due to
 * OS package visibility restrictions. We attempt direct `Linking.openURL(nativeScheme)`
 * inside try/catch blocks to launch native apps directly when installed.
 */

import { Alert, Linking } from 'react-native';

function parseSafe(raw: string): { host: string; path: string; search: string } {
  try {
    const u = new URL(raw);
    return { host: u.hostname.toLowerCase(), path: u.pathname, search: u.search };
  } catch {
    return { host: '', path: '', search: '' };
  }
}

function firstSegment(path: string): string {
  return path.replace(/^\/+/, '').split('/')[0] ?? '';
}

// ---- Deep link candidate builders -----------------------------------------

function telegram(url: string): string[] | null {
  const { host, path, search } = parseSafe(url);
  if (!host.includes('t.me') && !host.includes('telegram.me') && !host.includes('telegram.org')) return null;

  const seg = firstSegment(path);
  if (!seg) return null;

  if (seg.startsWith('+')) {
    return [`tg://join?invite=${seg.slice(1)}`];
  }
  const startMatch = search.match(/[?&]start=([^&]+)/);
  if (startMatch) {
    return [`tg://resolve?domain=${seg}&start=${startMatch[1]}`, `tg://resolve?domain=${seg}`];
  }
  return [`tg://resolve?domain=${seg}`];
}

function youtube(url: string): string[] | null {
  const { host, path, search } = parseSafe(url);
  if (!host.includes('youtube.com') && !host.includes('youtu.be')) return null;
  const fullPath = `${path}${search}`;
  return [`vnd.youtube://${fullPath}`, `youtube://${fullPath}`];
}

function tiktok(url: string): string[] | null {
  const { host, path } = parseSafe(url);
  if (!host.includes('tiktok.com')) return null;

  const seg = firstSegment(path);
  if (seg.startsWith('@')) {
    return [
      `snssdk1233://user/profile/${seg}`,
      `snssdk1180://user/profile/${seg}`,
      `tiktok://user/profile/${seg}`,
      `musically://user/profile/${seg}`,
    ];
  }
  if (path.includes('/video/')) {
    const videoId = path.split('/video/')[1]?.split('?')[0];
    return [
      videoId ? `snssdk1233://aweme/detail/${videoId}` : `snssdk1233://user/profile/${seg}`,
      `musically://user/profile/${seg}`,
      `tiktok://user/profile/${seg}`,
    ];
  }
  return [`snssdk1233://user/profile/${seg}`, `tiktok://user/profile/${seg}`];
}

function facebook(url: string, _platform?: string, pageId?: string): string[] | null {
  const { host, path } = parseSafe(url);
  if (!host.includes('facebook.com') && !host.includes('fb.com') && !host.includes('fb.watch')) return null;

  const encodedUrl = encodeURIComponent(url);
  const candidates: string[] = [];

  if (pageId) {
    candidates.push(`fb://page/${pageId}`);
  }

  const seg = firstSegment(path);
  if (seg && !['pages', 'groups', 'watch', 'events', 'share'].includes(seg)) {
    candidates.push(`fb://profile/${seg}`);
    candidates.push(`fb://page/${seg}`);
  }

  candidates.push(`fb://facewebmodal/f?href=${encodedUrl}`);
  candidates.push('fb://');
  return candidates;
}

function twitter(url: string): string[] | null {
  const { host, path } = parseSafe(url);
  if (!host.includes('twitter.com') && !host.includes('x.com')) return null;

  const parts = path.replace(/^\/+/, '').split('/');
  const username = parts[0];
  if (!username || ['i', 'intent', 'search', 'hashtag', 'settings'].includes(username)) return null;

  if (parts[1] === 'status' && parts[2]) {
    return [`twitter://status?id=${parts[2]}`, `x://status?id=${parts[2]}`];
  }
  return [`twitter://user?screen_name=${username}`, `x://user?screen_name=${username}`];
}

function instagram(url: string): string[] | null {
  const { host, path } = parseSafe(url);
  if (!host.includes('instagram.com')) return null;

  const parts = path.replace(/^\/+/, '').replace(/\/+$/, '').split('/');
  const target = parts[0];
  if (!target || target === 'p' || target === 'reel' || target === 'tv') {
    return [url.replace(/^https?:\/\//, 'instagram://'), 'instagram://'];
  }
  return [`instagram://user?username=${target}`, 'instagram://'];
}

type LinkBuilder = (url: string, platform?: string, pageId?: string) => string[] | null;

const BUILDERS: LinkBuilder[] = [telegram, youtube, tiktok, facebook, twitter, instagram];

// Opens a URL inside the Pi Browser app via its `pi://` deep link scheme
// (e.g. https://pi.view2earn.org → pi://pi.view2earn.org), falling back to the
// regular browser when the Pi Browser isn't installed. Note: `pinetwork://`
// opens the Pi Network mining app, NOT the Pi Browser.
export async function openInPiBrowser(url: string): Promise<void> {
  if (!url) return;
  const clean = url.replace(/^https?:\/\//i, '');
  try {
    await Linking.openURL(`pi://${clean}`);
    return;
  } catch {
    // Pi Browser not installed — fall through to the default browser.
  }
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert('Could not open Pi Browser', `Open it manually:\n${url}`);
  }
}

// ---- Public API -----------------------------------------------------------

/**
 * Smart URL opener — tries native app deep links first (Facebook, TikTok,
 * Instagram, Twitter/X, Telegram, YouTube), falling back to the browser if the
 * native app is not installed.
 */
export async function smartOpenUrl(url: string, platform?: string, pageId?: string): Promise<void> {
  if (!url) return;

  // Non-http schemes — pass straight through (mailto:, phantom:, etc.)
  if (!/^https?:\/\//i.test(url)) {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Could not open link', `Open it manually:\n${url}`);
    }
    return;
  }

  // 1. Gather native deep link candidate URLs
  const candidates: string[] = [];
  for (const build of BUILDERS) {
    const list = build(url, platform, pageId);
    if (list && list.length > 0) {
      candidates.push(...list);
    }
  }

  // 2. Try opening candidate native deep link URLs
  for (const nativeUrl of candidates) {
    try {
      await Linking.openURL(nativeUrl);
      return; // Native app opened successfully!
    } catch {
      // Candidate scheme failed or native app not installed — try next candidate
    }
  }

  // 3. Fallback — open original HTTPS URL in browser
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert('Could not open link', `Open it manually:\n${url}`);
  }
}
