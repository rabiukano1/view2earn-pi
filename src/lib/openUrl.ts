/**
 * WhatsApp-style URL opener — v3 (nuclear: NO InAppBrowser at all).
 *
 * Every single URL is opened via Linking.openURL() which fires an Android
 * ACTION_VIEW intent. The OS routes it to the native app or system browser.
 *
 * InAppBrowser (Chrome Custom Tabs) is COMPLETELY REMOVED because TikTok,
 * Instagram, and Facebook actively block Custom Tabs with 404 pages.
 */

import { Alert, Linking } from 'react-native';

// ---- Helpers ----------------------------------------------------------------

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

// ---- Native URI scheme builders (best-effort) ----

function telegram(url: string): string[] | null {
  const { host, path, search } = parseSafe(url);
  if (!host.includes('t.me') && !host.includes('telegram.me') && !host.includes('telegram.org')) return null;
  const seg = firstSegment(path);
  if (!seg) return null;
  if (seg.startsWith('+')) return [`tg://join?invite=${seg.slice(1)}`];
  const startMatch = search.match(/[?&]start=([^&]+)/);
  if (startMatch) return [`tg://resolve?domain=${seg}&start=${startMatch[1]}`, `tg://resolve?domain=${seg}`];
  return [`tg://resolve?domain=${seg}`];
}

function youtube(url: string): string[] | null {
  const { host, path, search } = parseSafe(url);
  if (!host.includes('youtube.com') && !host.includes('youtu.be')) return null;
  const videoId =
    search.match(/[?&]v=([^&]+)/)?.[1] ??
    path.match(/^\/(?:watch|shorts|embed|live|v)\/([^/?#]+)/)?.[1] ??
    (host.includes('youtu.be') ? path.replace(/^\/+/, '').split('/')[0] : undefined);
  if (!videoId) return null;
  return [`vnd.youtube://${videoId}`, `youtube://${videoId}`];
}

function tiktok(url: string): string[] | null {
  const { host, path, search } = parseSafe(url);
  if (!host.includes('tiktok.com')) return null;
  // Short links (vm./vt.) don't contain video IDs — skip native scheme
  if (host.startsWith('vm.') || host.startsWith('vt.')) return null;

  const videoMatch = path.match(/\/video\/([^/?#]+)/);
  if (videoMatch?.[1]) {
    return [
      `snssdk1233://aweme/detail/${videoMatch[1]}`,
      `snssdk1180://aweme/detail/${videoMatch[1]}`,
    ];
  }
  return null;
}

function facebook(url: string, _platform?: string, pageId?: string): string[] | null {
  const { host, path, search } = parseSafe(url);
  if (!host.includes('facebook.com')) return null;
  const candidates: string[] = [];
  if (pageId) candidates.push(`fb://page/${pageId}`);
  const seg = firstSegment(path);
  if (seg === 'watch' || seg === 'reel' || seg === 'reels') {
    const videoId = search.match(/[?&]v=([^&]+)/)?.[1];
    if (videoId) candidates.push(`fb://video/${videoId}`);
  }
  const groupSeg = path.match(/\/groups\/([^/?#]+)/);
  if (groupSeg?.[1]) candidates.push(`fb://group/${groupSeg[1]}`);
  candidates.push(`fb://facewebmodal/f?href=${encodeURIComponent(url)}`);
  return candidates;
}

function twitter(url: string): string[] | null {
  const { host, path } = parseSafe(url);
  if (!host.includes('twitter.com') && !host.includes('x.com')) return null;
  const parts = path.replace(/^\/+/, '').split('/');
  const username = parts[0];
  if (!username || ['i', 'intent', 'search', 'hashtag', 'settings'].includes(username)) return null;
  if (parts[1] === 'status' && parts[2]) return [`twitter://status?id=${parts[2]}`];
  return [`twitter://user?screen_name=${username}`];
}

function instagram(url: string): string[] | null {
  const { host, path } = parseSafe(url);
  if (!host.includes('instagram.com') && !host.includes('instagr.am')) return null;
  const parts = path.replace(/^\/+/, '').replace(/\/+$/, '').split('/');
  const target = parts[0];
  if (!target) return null;
  if (['p', 'reel', 'reels', 'tv', 'stories', 'explore'].includes(target)) return null;
  return [`instagram://user?username=${target}`];
}

function whatsapp(url: string): string[] | null {
  const { host, path, search } = parseSafe(url);
  if (!host.includes('whatsapp.com') && !host.includes('wa.me')) return null;
  const seg = firstSegment(path);
  if (host.includes('wa.me')) return [`whatsapp://send?phone=${seg}${search ? '&' + search.replace('?', '') : ''}`];
  if (host === 'chat.whatsapp.com') return [`whatsapp://chat?code=${seg}`];
  if (path.startsWith('/send')) return [`whatsapp://send${search}`];
  return null;
}

type LinkBuilder = (url: string, platform?: string, pageId?: string) => string[] | null;
const BUILDERS: LinkBuilder[] = [telegram, youtube, tiktok, facebook, twitter, instagram, whatsapp];

// ---- Pi Browser helper (unchanged) ------------------------------------------

export async function openInPiBrowser(url: string): Promise<void> {
  if (!url) return;
  const clean = url.replace(/^https?:\/\//i, '');
  try {
    await Linking.openURL(`pi://${clean}`);
    return;
  } catch {
    // Pi Browser not installed
  }
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert('Could not open Pi Browser', `Open it manually:\n${url}`);
  }
}

// ---- Public API -------------------------------------------------------------

import InAppBrowser from 'react-native-inappbrowser-reborn';

/**
 * Opens InAppBrowser as a fallback, mimicking the user's requested behavior.
 */
const openInAppBrowser = async (url: string) => {
  try {
    if (await InAppBrowser.isAvailable()) {
      await InAppBrowser.open(url, {
        toolbarColor: '#075E54', // The requested color
        showTitle: true,
      });
    } else {
      await Linking.openURL(url);
    }
  } catch (error) {
    Alert.alert('Error', 'Failed to open browser');
  }
};

/**
 * Opens ANY URL using the requested flow: Native App -> InAppBrowser -> System Browser.
 */
export async function smartOpenUrl(url: string, platform?: string, pageId?: string): Promise<void> {
  if (!url) return;

  // Auto-fix URLs missing protocol
  let resolved = url.trim();
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//i.test(resolved) && resolved.includes('.')) {
    resolved = `https://${resolved}`;
  }

  console.log(`[smartOpenUrl v4] Opening: ${resolved}`);

  // Non-http schemes (tg://, mailto:, etc.) — pass straight through
  if (!/^https?:\/\//i.test(resolved)) {
    try {
      const supported = await Linking.canOpenURL(resolved);
      if (supported) {
        await Linking.openURL(resolved);
      } else {
        Alert.alert('App not installed', 'Could not open the link natively.');
      }
    } catch {
      Alert.alert('Could not open link', `Open it manually:\n${url}`);
    }
    return;
  }

  // Step 1: Try platform-specific native URI scheme (best-effort)
  for (const build of BUILDERS) {
    const list = build(resolved, platform, pageId);
    if (!list || list.length === 0) continue;
    
    for (const nativeUrl of list) {
      try {
        console.log(`[smartOpenUrl v4] Checking native: ${nativeUrl}`);
        const supported = await Linking.canOpenURL(nativeUrl);
        
        if (supported) {
          console.log(`[smartOpenUrl v4] Opening native: ${nativeUrl}`);
          await Linking.openURL(nativeUrl);
          return; // Success, exit completely
        }
      } catch (err) {
        console.log('[smartOpenUrl v4] Error checking native url:', err);
      }
    }
  }

  // Step 2: If native apps are not installed, fallback to the requested InAppBrowser
  console.log(`[smartOpenUrl v4] App not installed, falling back to browser: ${resolved}`);
  await openInAppBrowser(resolved);
}
