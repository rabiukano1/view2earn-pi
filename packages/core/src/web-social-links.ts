export type SocialPlatform =
  | "facebook"
  | "tiktok"
  | "telegram"
  | "youtube"
  | "instagram"
  | "x"
  | "linkedin"
  | "whatsapp"
  | "unknown";

export const PLATFORM_META: Record<SocialPlatform, { label: string; emoji: string }> = {
  facebook: { label: "Facebook", emoji: "📘" },
  tiktok: { label: "TikTok", emoji: "🎵" },
  telegram: { label: "Telegram", emoji: "✈️" },
  youtube: { label: "YouTube", emoji: "▶️" },
  instagram: { label: "Instagram", emoji: "📸" },
  x: { label: "X (Twitter)", emoji: "🐦" },
  linkedin: { label: "LinkedIn", emoji: "💼" },
  whatsapp: { label: "WhatsApp", emoji: "💬" },
  unknown: { label: "Website", emoji: "🌐" },
};

export function detectWebPlatform(url: string): SocialPlatform {
  try {
    const { hostname } = new URL(url);
    if (hostname.includes("tiktok.com")) return "tiktok";
    if (hostname.includes("youtube.com") || hostname.includes("youtu.be")) return "youtube";
    if (hostname.includes("instagram.com") || hostname.includes("instagr.am")) return "instagram";
    if (hostname.includes("facebook.com") || hostname.includes("fb.watch") || hostname.endsWith("fb.com"))
      return "facebook";
    if (hostname.includes("twitter.com") || hostname.includes("x.com")) return "x";
    if (hostname.includes("t.me") || hostname.includes("telegram.me") || hostname.includes("telegram.org"))
      return "telegram";
    if (hostname.includes("linkedin.com") || hostname.includes("lnkd.in")) return "linkedin";
    if (hostname.includes("whatsapp.com") || hostname.includes("wa.me")) return "whatsapp";
    return "unknown";
  } catch {
    return "unknown";
  }
}

export function platformEmoji(url: string): string {
  return PLATFORM_META[detectWebPlatform(url)].emoji;
}

export function platformLabel(url: string): string {
  return PLATFORM_META[detectWebPlatform(url)].label;
}

export function isValidHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function webTargetUrl(platform: string | undefined, url: string | undefined): string {
  const target = (url ?? "").trim();
  if (!target) return "";
  const p = (platform ?? "").toLowerCase();

  if (p === "tiktok") {
    if (/^https?:\/\/(vm|vt)\.tiktok\.com\//i.test(target)) return target;
    return target.replace(/^https?:\/\/(www\.)?tiktok\.com/i, "https://www.tiktok.com");
  }
  if (p === "facebook") {
    if (/^https?:\/\/(www\.)?(fb\.watch|fb\.com)\//i.test(target)) return target;
    return target.replace(/^https?:\/\/(www\.)?facebook\.com/i, "https://www.facebook.com");
  }
  if (p === "x") {
    return target.replace(/^https?:\/\/(www\.)?twitter\.com/i, "https://x.com");
  }
  if (p === "instagram") {
    return target.replace(/^https?:\/\/(www\.)?instagram\.com/i, "https://www.instagram.com");
  }
  if (p === "youtube") {
    return target.replace(/^https?:\/\/(www\.)?youtube\.com/i, "https://www.youtube.com");
  }
  return target;
}

export function openWebLink(url: string): void {
  window.open(url, "_blank", "noopener,noreferrer");
}

export function openWebTaskLink(platform: string | undefined, url: string | undefined): void {
  const target = webTargetUrl(platform, url);
  if (!isValidHttpUrl(target)) return;
  openWebLink(target);
}