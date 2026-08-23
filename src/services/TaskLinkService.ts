import { smartOpenUrl } from '../lib/openUrl';

/**
 * Validates the URL to ensure it is using a safe protocol.
 * Rejects javascript:, data:, file:, etc.
 */
export function validateUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const proto = u.protocol.toLowerCase();
    // Block known dangerous protocols
    if (['javascript:', 'data:', 'file:', 'vbscript:', 'blob:'].includes(proto)) return false;
    // Allow http(s), mailto, and known native app schemes
    return true;
  } catch {
    return false;
  }
}

/**
 * Detects the platform based on the URL hostname.
 */
export function detectPlatform(url: string): string {
  try {
    const { hostname } = new URL(url);
    if (hostname.includes('tiktok.com')) return 'tiktok';
    if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) return 'youtube';
    if (hostname.includes('instagram.com') || hostname.includes('instagr.am')) return 'instagram';
    if (hostname.includes('facebook.com') || hostname.includes('fb.watch') || hostname.endsWith('fb.com')) return 'facebook';
    if (hostname.includes('twitter.com') || hostname.includes('x.com')) return 'x';
    if (hostname.includes('t.me') || hostname.includes('telegram.me') || hostname.includes('telegram.org')) return 'telegram';
    if (hostname.includes('linkedin.com') || hostname.includes('lnkd.in')) return 'linkedin';
    if (hostname.includes('whatsapp.com') || hostname.includes('wa.me')) return 'whatsapp';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Detects the content type based on the platform and URL path.
 */
export function detectContentType(platform: string, url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname;
    const search = u.search;

    switch (platform) {
      case 'tiktok':
        if (path.includes('/video/')) return 'video';
        if (path.startsWith('/@')) return 'profile';
        return 'other';
      case 'youtube':
        if (path.startsWith('/watch') || path.startsWith('/shorts/') || path.startsWith('/v/') || path.startsWith('/embed/')) return 'video';
        if (u.hostname.includes('youtu.be')) return 'video';
        if (path.startsWith('/channel/') || path.startsWith('/c/')) return 'channel';
        return 'other';
      case 'instagram':
        if (path.startsWith('/p/')) return 'post';
        if (path.startsWith('/reel/') || path.startsWith('/reels/')) return 'reel';
        const parts = path.replace(/^\/+/, '').replace(/\/+$/, '').split('/');
        if (parts.length === 1 && !['explore', 'tv', 'stories'].includes(parts[0])) return 'profile';
        return 'other';
      case 'facebook':
        if (path.includes('/video') || path.startsWith('/watch') || path.startsWith('/reel')) return 'video';
        if (path.includes('/posts/') || path.includes('/photo')) return 'post';
        if (path.startsWith('/groups/')) return 'group';
        if (path.startsWith('/pages/')) return 'page';
        return 'profile';
      case 'telegram':
        const tgParts = path.replace(/^\/+/, '').split('/');
        if (tgParts.length > 1 && !isNaN(Number(tgParts[1]))) return 'message';
        return 'channel';
      case 'x':
        if (path.includes('/status/')) return 'post';
        return 'profile';
      case 'linkedin':
        if (path.startsWith('/in/')) return 'profile';
        if (path.startsWith('/company/')) return 'company';
        if (path.startsWith('/feed/update/') || path.startsWith('/posts/')) return 'post';
        return 'other';
      case 'whatsapp':
        if (path.startsWith('/send') || u.hostname.includes('wa.me')) return 'chat';
        if (u.hostname === 'chat.whatsapp.com') return 'group';
        return 'other';
      default:
        return 'unknown';
    }
  } catch {
    return 'unknown';
  }
}

/**
 * Resolves short URLs to their canonical full URLs by following redirects.
 * TikTok specifically requires a browser-like User-Agent to avoid 403s.
 */
export async function resolveShortUrl(url: string, platform: string): Promise<string> {
  const isShort = url.includes('vm.tiktok.com') || url.includes('vt.tiktok.com') || url.includes('youtu.be') || url.includes('fb.watch');
  if (!isShort) return url;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });
    // Response.url contains the final URL after all redirects are followed.
    return response.url || url;
  } catch (error) {
    console.warn('[TaskLinkService] Failed to resolve short URL:', error);
    return url;
  }
}

/**
 * Central service for opening task links.
 * Resolves short links first to determine the exact destination, then hands it off
 * to smartOpenUrl to open the exact native app page directly.
 */
export async function openTaskLink(url: string, platform?: string, pageId?: string): Promise<void> {
  if (!url) return;

  // Normalize URLs missing a protocol (e.g. "vm.tiktok.com/abc" → "https://vm.tiktok.com/abc").
  let normalized = url.trim();
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//i.test(normalized) && normalized.includes('.')) {
    normalized = `https://${normalized}`;
  }

  if (!validateUrl(normalized)) {
    console.warn(`[TaskLinkService] Unsafe or unsupported URL protocol: ${normalized}`);
    return;
  }

  const detectedPlatform = detectPlatform(normalized);

  // Resolve short links (vm.tiktok.com, youtu.be, fb.watch, etc.) to canonical
  // URLs with a 3-second timeout so users aren't stuck waiting.
  let resolvedUrl = normalized;
  try {
    resolvedUrl = await Promise.race([
      resolveShortUrl(normalized, detectedPlatform),
      new Promise<string>((resolve) => setTimeout(() => resolve(normalized), 3000)),
    ]);
  } catch {
    resolvedUrl = normalized;
  }

  const finalPlatform = detectPlatform(resolvedUrl);

  if (__DEV__) {
    console.log(`\n==================================================`);
    console.log(`[TaskLinkService] OPENING TASK LINK`);
    console.log(`Original URL:  ${url}`);
    console.log(`Resolved URL:  ${resolvedUrl}`);
    console.log(`Final Platform:${finalPlatform}`);
    console.log(`==================================================\n`);
  }

  // Hand directly to the smart opener — it will use the resolved URL
  await smartOpenUrl(resolvedUrl, platform || finalPlatform, pageId);
}
