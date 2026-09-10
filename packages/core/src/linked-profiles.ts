import type { TaskPlatform } from "./types";
import { BIO_CODE_EXPIRY_MINUTES } from "./constants";

export function normalizeUrl(url: string): string {
  return url
    .toLowerCase()
    .replace(/^https?:\/\/(www\.)?/, "")
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "");
}

// Allowed profile hosts for each social platform. Used both for linking a
// user's own profile and for marketplace follow-task URLs (AdMob §3
// content-moderation hardening — no off-platform or exfil URLs).
export const PROFILE_HOST_ALLOWLIST: Record<string, string[]> = {
  facebook: ["facebook.com", "fb.com", "m.facebook.com"],
  tiktok: ["tiktok.com", "vm.tiktok.com", "vt.tiktok.com"],
  telegram: ["t.me", "telegram.me"],
  instagram: ["instagram.com"],
  youtube: ["youtube.com", "youtu.be"],
  x: ["x.com", "twitter.com"],
  linkedin: ["linkedin.com", "lnkd.in"],
  whatsapp: ["whatsapp.com", "wa.me", "chat.whatsapp.com"],
};

// Maps a platform key to a base URL pattern for auto-building profile URLs
// from bare handles. %s is replaced with the handle (without leading @).
const PLATFORM_BASE_URL: Record<string, string> = {
  facebook: "https://facebook.com/%s",
  tiktok: "https://tiktok.com/@%s",
  telegram: "https://t.me/%s",
  instagram: "https://instagram.com/%s",
  youtube: "https://youtube.com/@%s",
  x: "https://x.com/%s",
  linkedin: "https://linkedin.com/in/%s",
};

export interface SanitizedProfileUrl {
  /** Canonical, reset URL (no query/hash/fragment, trailing slash stripped). */
  url: string;
  /** Host the URL points at, e.g. "tiktok.com". */
  host: string;
  /** Optional handle/path segment extracted from the URL. */
  handle?: string;
}

/** Validate + normalize a profile URL against a platform allowlist.
 *  Accepts:
 *    - A full https://… URL
 *    - A URL without protocol (e.g. tiktok.com/@handle)
 *    - A bare handle/username (e.g. @pinetwork or pinetwork) — auto-built
 *      into the canonical URL for the chosen platform.
 */
export function sanitizeProfileUrl(platform: string, rawUrl: string): SanitizedProfileUrl {
  let trimmed = (rawUrl ?? "").trim();
  if (!trimmed) throw new Error("Profile URL is required.");

  // If the input looks like a bare handle (no dots, no slashes, no colons),
  // auto-build the full URL using the platform's base template.
  const looksLikeHandle = !/[./:]/.test(trimmed.replace(/^@/, ""));
  if (looksLikeHandle && PLATFORM_BASE_URL[platform]) {
    const handle = trimmed.replace(/^@/, "");
    trimmed = PLATFORM_BASE_URL[platform].replace("%s", handle);
  } else if (!/^https?:\/\//i.test(trimmed)) {
    // Automatically prepend https:// if the protocol is missing
    trimmed = `https://${trimmed.replace(/^:\/\//, "")}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("Invalid URL. Paste the full https:// link to your profile.");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Only http(s) profile links are allowed.");
  }

  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  const allowed = PROFILE_HOST_ALLOWLIST[platform];
  if (!allowed || allowed.length === 0) {
    throw new Error(`Unsupported platform: ${platform}`);
  }
  if (!allowed.some((h) => host === h || host.endsWith(`.${h}`))) {
    throw new Error(
      `That link isn't a ${platform} profile. Use one of: ${allowed.join(", ")}.`,
    );
  }

  parsed.hash = "";
  parsed.search = "";
  const url = normalizeUrl(parsed.toString());
  const handle = url.split("/").filter(Boolean)[1]?.replace(/^@/, "");
  return { url, host, handle };
}

/** Host name for a profile URL, or null when it's JavaScript/docs/shortlinks. */
export function profileHost(platform: string, rawUrl: string): string | null {
  try {
    return sanitizeProfileUrl(platform, rawUrl).host;
  } catch {
    return null;
  }
}

export function generateBioCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const arr = new Uint8Array(6);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < 6; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
  }
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[arr[i] % chars.length];
  }
  return code;
}

export function isBioCodeExpired(createdAt: number): boolean {
  return Date.now() - createdAt > BIO_CODE_EXPIRY_MINUTES * 60 * 1000;
}

export function getDeepLink(platform: TaskPlatform, targetUrl: string): { primary: string; fallback: string } {
  const normalized = normalizeUrl(targetUrl);
  const isFacebook = normalized.includes("facebook.com") || normalized.includes("fb.com");

  if (isFacebook) {
    const pageId = extractFacebookPageId(normalized);
    if (pageId) {
      return {
        primary: `fb://page/${pageId}`,
        fallback: `https://facebook.com/profile.php?id=${pageId}`,
      };
    }
  }
  return { primary: targetUrl, fallback: targetUrl };
}

function extractFacebookPageId(url: string): string | null {
  const match = url.match(/profile\.php\?id=(\d+)/);
  if (match) return match[1];
  const slug = url.replace(/^https?:\/\//, "").replace(/^www\./, "");
  const parts = slug.split("/").filter(Boolean);
  if (parts.length >= 2 && parts[0] === "facebook.com") {
    const name = parts[1].replace(/\?.*$/, "");
    if (/^\d+$/.test(name)) return name;
  }
  return null;
}
