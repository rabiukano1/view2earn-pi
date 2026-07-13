import type { TaskPlatform } from "./types";
import { BIO_CODE_EXPIRY_MINUTES } from "./constants";

export function normalizeUrl(url: string): string {
  return url
    .toLowerCase()
    .replace(/^https?:\/\/(www\.)?/, "")
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "");
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
