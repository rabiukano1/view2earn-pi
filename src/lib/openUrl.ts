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

// YouTube deep links. The native schemes (vnd.youtube://, youtube://) take the
// bare video id — passing the full watch path is invalid. Video ids are
// extracted from /watch?v=…, youtu.be/…, /shorts/…, /embed/… and /live/…
// (live also carries ?v=…). Channels / playlists have no video id, so they
// fall back to https, which YouTube App Links resolve in-app.
function youtube(url: string): string[] | null {
  const { host, path, search } = parseSafe(url);
  if (!host.includes('youtube.com') && !host.includes('youtu.be')) return null;

  const videoId =
    search.match(/[?&]v=([^&]+)/)?.[1] ??
    path.match(/^\/(?:watch|shorts|embed|live|v)\/([^/?#]+)/)?.[1] ??
    (host.includes('youtu.be') ? path.replace(/^\/+/, '').split('/')[0] : undefined);

  if (!videoId) return null;
  return [`vnd.youtube://${videoId}`, `youtube://${videoId}`, `youtube://v/${videoId}`];
}

// TikTok deep links: the scheme differs between the main app (snssdk1233) and
// TikTok Lite (snssdk1180), so both are tried. Paths must match the content
// type — aweme/detail for videos, user/profile for profiles — or the app opens
// the wrong screen (or nothing).
function tiktok(url: string): string[] | null {
  const { host, path, search } = parseSafe(url);
  // Short links (vm.tiktok.com, vt.tiktok.com) redirect server-side to the
  // real content, so the https fallback + TikTok's App Links resolve them to
  // the right screen — guessing a deep link here would open the wrong thing.
  if (!host.includes('tiktok.com') || host.startsWith('vm.') || host.startsWith('vt.')) return null;

  const videoMatch = path.match(/\/video\/([^/?#]+)/);
  if (videoMatch?.[1]) {
    const videoId = videoMatch[1];
    return [
      `snssdk1233://aweme/detail/${videoId}`,
      `snssdk1180://aweme/detail/${videoId}`,
      `tiktok://video/${videoId}`,
      `musically://aweme/detail/${videoId}`,
    ];
  }

  const seg = firstSegment(path);
  // Profiles are best opened by secUid (present on profile URLs as
  // ?secUid=...), falling back to the @handle.
  const secUid = search.match(/[?&]secUid=([^&]+)/)?.[1];
  const profile = secUid ? decodeURIComponent(secUid) : seg;
  if (seg.startsWith('@') || secUid) {
    return [
      `snssdk1233://user/profile/${profile}`,
      `snssdk1180://user/profile/${profile}`,
      `tiktok://user/profile/${profile}`,
      `musically://user/profile/${profile}`,
    ];
  }

  return null;
}

// Facebook deep links. Short hosts (fb.watch, fb.com) redirect server-side to
// the real content, so the https fallback + Facebook's App Links resolve them
// to the right screen. Real paths map to fb://page / fb://profile / fb://group
// / fb://video / fb://reel, falling back to the in-app facewebmodal browser.
function facebook(url: string, _platform?: string, pageId?: string): string[] | null {
  const { host, path, search } = parseSafe(url);
  const isShort = host.includes('fb.watch') || host === 'fb.com' || host.endsWith('.fb.com');
  if (!host.includes('facebook.com') && !isShort) return null;
  if (isShort) return null;

  const encodedUrl = encodeURIComponent(url);
  const candidates: string[] = [];

  if (pageId) {
    candidates.push(`fb://page/${pageId}`);
  }

  const seg = firstSegment(path);

  // Video — watch?v=..., /{user}/videos/{id}, /reel/{id}
  if (seg === 'watch' || seg === 'reel' || seg === 'reels') {
    const videoId = search.match(/[?&]v=([^&]+)/)?.[1];
    if (videoId) candidates.push(`fb://video/${videoId}`);
    if (seg.startsWith('reel')) {
      const reelMatch = path.match(/\/reel(?:s)?\/([^/?#]+)/);
      if (reelMatch?.[1]) candidates.push(`fb://reel/${reelMatch[1]}`);
    }
    if (candidates.length === 0) candidates.push('fb://watch');
  }
  const videoSeg = path.match(/\/videos\/([^/?#]+)/);
  if (videoSeg?.[1]) {
    candidates.push(`fb://video/${videoSeg[1]}`);
  }

  // Group — /groups/{name}
  const groupSeg = path.match(/\/groups\/([^/?#]+)/);
  if (groupSeg?.[1]) {
    candidates.push(`fb://group/${groupSeg[1]}`);
  }

  // Profile / page — /{handle} or /pages/…
  if (seg && !['pages', 'groups', 'watch', 'reel', 'reels', 'videos', 'events', 'share', 'photo'].includes(seg)) {
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

// Instagram deep links. Profiles open reliably via instagram://user?username=.
// Posts/reels/stories have no stable public scheme (instagram://media?id= needs
// the numeric media id, not the shortcode), so they fall back to https — 
// Instagram's Universal Links on instagram.com resolve /p/…, /reel/…, /tv/…
// straight into the app. instagr.am short links redirect server-side, so the
// https fallback handles them too.
function instagram(url: string): string[] | null {
  const { host, path } = parseSafe(url);
  if (!host.includes('instagram.com') && !host.includes('instagr.am')) return null;

  const parts = path.replace(/^\/+/, '').replace(/\/+$/, '').split('/');
  const target = parts[0];
  if (!target) return null;

  // Posts, reels, IGTV, stories — no reliable scheme; https App Link resolves.
  if (['p', 'reel', 'reels', 'tv', 'stories', 'explore'].includes(target)) return null;

  return [`instagram://user?username=${target}`, 'instagram://'];
}

function whatsapp(url: string): string[] | null {
  const { host, path, search } = parseSafe(url);
  if (!host.includes('whatsapp.com') && !host.includes('wa.me')) return null;

  const seg = firstSegment(path);
  
  if (host.includes('wa.me')) {
    return [`whatsapp://send?phone=${seg}${search ? '&' + search.replace('?', '') : ''}`, 'whatsapp://'];
  }
  
  if (host === 'chat.whatsapp.com') {
    return [`whatsapp://chat?code=${seg}`, 'whatsapp://'];
  }

  if (path.startsWith('/send')) {
    return [`whatsapp://send${search}`, 'whatsapp://'];
  }

  return ['whatsapp://'];
}

function linkedin(url: string): string[] | null {
  const { host, path } = parseSafe(url);
  if (!host.includes('linkedin.com') && !host.includes('lnkd.in')) return null;

  if (host.includes('lnkd.in')) return null;

  const seg = firstSegment(path);
  const parts = path.replace(/^\/+/, '').replace(/\/+$/, '').split('/');

  if (seg === 'in' && parts[1]) {
    return [`linkedin://profile/${parts[1]}`, 'linkedin://'];
  }
  
  if (seg === 'company' && parts[1]) {
    return [`linkedin://company/${parts[1]}`, 'linkedin://'];
  }

  return ['linkedin://'];
}

type LinkBuilder = (url: string, platform?: string, pageId?: string) => string[] | null;

const BUILDERS: LinkBuilder[] = [telegram, youtube, tiktok, facebook, twitter, instagram, whatsapp, linkedin];

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
