/**
 * Smart URL opener — tries the platform's native app first (like WhatsApp),
 * falling back to the browser if the app isn't installed.
 *
 * On Android 11+ `Linking.canOpenURL` requires `<queries>` declarations in
 * AndroidManifest.xml for each custom scheme.  On iOS it requires
 * `LSApplicationQueriesSchemes` in Info.plist.  Both are configured alongside
 * this module.
 */

import { Alert, Linking, Platform } from 'react-native';

// ---------------------------------------------------------------------------
// ponytail: Deep-link scheme mappings are hand-curated.  When a platform
// changes its registered scheme or adds new URL patterns this list must be
// updated manually.
// ---------------------------------------------------------------------------

interface DeepLink {
  scheme: string;
  nativeUrl: string;
}

// ---- URL parser (safe on all RN versions) ---------------------------------

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

// ---- Per-platform deep-link builders --------------------------------------

function telegram(url: string): DeepLink | null {
  const { host, path } = parseSafe(url);
  if (!host.includes('t.me') && !host.includes('telegram.me') && !host.includes('telegram.org')) return null;

  const seg = firstSegment(path);
  if (!seg) return null;

  // Invite link   — t.me/+HASH  →  tg://join?invite=HASH
  if (seg.startsWith('+')) {
    return { scheme: 'tg', nativeUrl: `tg://join?invite=${seg.slice(1)}` };
  }
  // Bot start     — t.me/bot?start=XXX  →  tg://resolve?domain=bot&start=XXX
  const { search } = parseSafe(url);
  const startMatch = search.match(/[?&]start=([^&]+)/);
  if (startMatch) {
    return { scheme: 'tg', nativeUrl: `tg://resolve?domain=${seg}&start=${startMatch[1]}` };
  }
  // Channel / user — tg://resolve?domain=USERNAME
  return { scheme: 'tg', nativeUrl: `tg://resolve?domain=${seg}` };
}

function youtube(url: string): DeepLink | null {
  const { host } = parseSafe(url);
  if (!host.includes('youtube.com') && !host.includes('youtu.be')) return null;
  // vnd.youtube:// mirrors the same URL structure as the web link.
  return { scheme: 'vnd.youtube', nativeUrl: url.replace(/^https?:\/\//, 'vnd.youtube://') };
}

function tiktok(url: string): DeepLink | null {
  const { host, path } = parseSafe(url);
  if (!host.includes('tiktok.com')) return null;

  const seg = firstSegment(path);
  if (seg.startsWith('@')) {
    // Profile page — snssdk1233://user/profile/@username
    return { scheme: 'snssdk1233', nativeUrl: `snssdk1233://user/profile/${seg}` };
  }
  // Video or other — try musically:// with the full path
  if (path.includes('/video/')) {
    return { scheme: 'musically', nativeUrl: url.replace(/^https?:\/\//, 'musically://') };
  }
  return null;
}

function facebook(url: string): DeepLink | null {
  const { host } = parseSafe(url);
  if (!host.includes('facebook.com') && !host.includes('fb.com') && !host.includes('fb.watch')) return null;
  // fb://facewebmodal/f?href=<encoded-url> opens any FB URL in the native app.
  return { scheme: 'fb', nativeUrl: `fb://facewebmodal/f?href=${encodeURIComponent(url)}` };
}

function twitter(url: string): DeepLink | null {
  const { host, path } = parseSafe(url);
  if (!host.includes('twitter.com') && !host.includes('x.com')) return null;

  const parts = path.replace(/^\/+/, '').split('/');
  const username = parts[0];
  if (!username || ['i', 'intent', 'search', 'hashtag', 'settings'].includes(username)) return null;

  // Tweet — twitter://status?id=TWEET_ID
  if (parts[1] === 'status' && parts[2]) {
    return { scheme: 'twitter', nativeUrl: `twitter://status?id=${parts[2]}` };
  }
  // Profile — twitter://user?screen_name=USERNAME
  return { scheme: 'twitter', nativeUrl: `twitter://user?screen_name=${username}` };
}

function instagram(url: string): DeepLink | null {
  const { host, path } = parseSafe(url);
  if (!host.includes('instagram.com')) return null;

  const parts = path.replace(/^\/+/, '').replace(/\/+$/, '').split('/');
  const target = parts[0];
  // Post / reel — instagram://media?id=…  (tricky, just use generic scheme)
  if (!target || target === 'p' || target === 'reel' || target === 'tv') {
    return { scheme: 'instagram', nativeUrl: url.replace(/^https?:\/\//, 'instagram://') };
  }
  // Profile
  return { scheme: 'instagram', nativeUrl: `instagram://user?username=${target}` };
}

// ponytail: Order matters only for readability; each builder returns null for
// domains it doesn't own so there is no ambiguity.
const BUILDERS = [telegram, youtube, tiktok, facebook, twitter, instagram];

// ---- Public API -----------------------------------------------------------

/**
 * Open a URL the way WhatsApp does — try the native app first, then the
 * browser.  Handles Telegram, YouTube, TikTok, Facebook, X (Twitter) and
 * Instagram out of the box.  Any other `https://` URL goes straight to the
 * browser.
 *
 * For non-http schemes (mailto:, solana:, phantom:, etc.) the URL is passed
 * through to `Linking.openURL` unchanged.
 */
export async function smartOpenUrl(url: string): Promise<void> {
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

  // Try a platform-native deep link first
  for (const build of BUILDERS) {
    const link = build(url);
    if (link) {
      try {
        const ok = await Linking.canOpenURL(link.nativeUrl);
        if (ok) {
          await Linking.openURL(link.nativeUrl);
          return;
        }
      } catch {
        // canOpenURL / openURL threw — fall through to HTTPS
      }
    }
  }

  // Fallback — open the original HTTPS URL (browser or Android App Links)
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert('Could not open link', `Open it manually:\n${url}`);
  }
}
