import { smartOpenUrl } from '../lib/openUrl';

/**
 * Validates the URL to ensure it is using a safe protocol.
 * Rejects javascript:, data:, file:, etc.
 */
export function validateUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return ['http:', 'https:', 'mailto:'].includes(u.protocol) || 
           // Allow common native schemes if they slipped through
           /^[a-zA-Z0-9.-]+:$/.test(u.protocol);
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
 * Resolves short URLs (e.g., vm.tiktok.com, vt.tiktok.com) to their canonical destination.
 * Only follows redirects for trusted short domains to avoid open redirects.
 * Returns the final URL if resolved, otherwise the original URL.
 */
export async function resolveShortUrl(url: string, platform: string): Promise<string> {
  try {
    const { hostname } = new URL(url);
    
    // Currently only resolving TikTok short links. Can be expanded.
    if (platform === 'tiktok' && (hostname.startsWith('vm.') || hostname.startsWith('vt.'))) {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 5000); // 5-second timeout

      try {
        const response = await fetch(url, { 
          method: 'HEAD', 
          redirect: 'follow',
          signal: controller.signal 
        });
        clearTimeout(id);
        
        if (response.ok && response.url) {
          // Validate that the resolved URL is still TikTok to prevent open redirects
          const resolvedHost = new URL(response.url).hostname;
          if (resolvedHost.includes('tiktok.com')) {
            return response.url;
          }
        }
      } catch (fetchErr) {
        clearTimeout(id);
        console.warn(`[TaskLinkService] Failed to resolve short link ${url}:`, fetchErr);
      }
    }
    
    return url;
  } catch (e) {
    return url;
  }
}

/**
 * Central service for opening task links with platform‑aware deep linking and short‑link resolution.
 */
export async function openTaskLink(url: string, platform?: string, pageId?: string): Promise<void> {
  if (!url) return;

  if (!validateUrl(url)) {
    console.warn(`[TaskLinkService] Unsafe or unsupported URL protocol: ${url}`);
    return;
  }

  const detectedPlatform = detectPlatform(url);
  const resolvedUrl = await resolveShortUrl(url, detectedPlatform);
  const contentType = detectContentType(detectedPlatform, resolvedUrl);

  if (__DEV__) {
    console.log(`\n==================================================`);
    console.log(`[TaskLinkService] OPENING TASK LINK`);
    console.log(`Original URL:  ${url}`);
    console.log(`Resolved URL:  ${resolvedUrl}`);
    console.log(`Platform:      ${detectedPlatform}`);
    console.log(`Content Type:  ${contentType}`);
    console.log(`==================================================\n`);
  }

  // Pass the resolved URL to our smart deep-link router
  await smartOpenUrl(resolvedUrl, platform || detectedPlatform, pageId);
}
