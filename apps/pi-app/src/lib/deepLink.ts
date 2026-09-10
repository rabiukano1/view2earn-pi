// Canonical target URL for opening a task.
// TikTok registers Android App Links on www.tiktok.com, so the plain https URL
// hands off to the installed TikTok / TikTok Lite app (falling back to the
// website). Short links (vm./vt.) self-bounce after the server redirect, so we
// leave them untouched instead of guessing a deep link. Facebook likewise App
// Links on www.facebook.com, while fb.watch/fb.com short links self-bounce.
export function taskTargetUrl(platform: string | undefined, url: string | undefined): string {
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
  return target;
}