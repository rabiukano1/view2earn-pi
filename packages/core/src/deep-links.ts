import type { TaskPlatform } from "./types";

export interface DeepLinkResult {
  primary: string;
  fallback: string;
  copyLink: string;
}

const platformSchemes: Record<TaskPlatform, string[]> = {
  facebook: ["fb://"],
  tiktok: ["tiktok://"],
  telegram: ["tg://"],
  instagram: ["instagram://"],
};

function extractPageId(url: string): string | null {
  const normalized = url.toLowerCase().replace(/^https?:\/\/(www\.)?/, "").replace(/[?#].*$/, "").replace(/\/+$/, "");
  const fbMatch = normalized.match(/facebook\.com\/profile\.php\?id=(\d+)/);
  if (fbMatch) return fbMatch[1];
  const numericMatch = normalized.match(/facebook\.com\/(\d+)(?:\/|$)/);
  if (numericMatch) return numericMatch[1];
  return null;
}

export function buildDeepLink(platform: TaskPlatform, targetUrl: string): DeepLinkResult {
  const copyLink = targetUrl;

  if (platform === "facebook") {
    const pageId = extractPageId(targetUrl);
    if (pageId) {
      return {
        primary: `fb://page/${pageId}`,
        fallback: `https://facebook.com/profile.php?id=${pageId}`,
        copyLink,
      };
    }
  }

  if (platform === "telegram") {
    const username = targetUrl.replace(/^https?:\/\/(www\.)?t\.me\//, "").split("/")[0].split("?")[0];
    return {
      primary: `tg://resolve?domain=${username}`,
      fallback: targetUrl,
      copyLink,
    };
  }

  const scheme = platformSchemes[platform]?.[0];
  if (scheme) {
    return { primary: targetUrl, fallback: targetUrl, copyLink };
  }

  return { primary: targetUrl, fallback: targetUrl, copyLink };
}

export function isAppInstalledSupported(platform: TaskPlatform): boolean {
  return platform === "facebook" || platform === "telegram";
}
