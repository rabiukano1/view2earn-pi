// Adsgram — the ad network for Telegram Mini Apps. Used only in Telegram mode
// (see telegram.ts); Pi Browser keeps the Pi Ad Network. Block IDs come from
// the Adsgram publisher dashboard (https://partner.adsgram.ai).
//   NEXT_PUBLIC_ADSGRAM_REWARD_BLOCK_ID        e.g. "12345"
//   NEXT_PUBLIC_ADSGRAM_INTERSTITIAL_BLOCK_ID  e.g. "int-12345"
//   NEXT_PUBLIC_ADSGRAM_DEBUG_USERS            comma-separated Telegram user IDs
//       that always get Adsgram test ads (the "test device" equivalent).
//       Test views are not paid and never trigger the Reward URL.
// ponytail: rewards trust the client-side `done` flag (capped server-side by
// the existing per-adType cooldowns / daily ad limits). Upgrade path: Adsgram
// "Reward URL" postback -> convex/http.ts when traffic justifies it.

type AdController = { show: () => Promise<{ done: boolean }> };
declare global {
  interface Window {
    Adsgram?: { init: (opts: { blockId: string; debug?: boolean }) => AdController };
  }
}

const SDK_URL = "https://sad.adsgram.ai/js/sad.min.js";
const REWARD_BLOCK = process.env.NEXT_PUBLIC_ADSGRAM_REWARD_BLOCK_ID ?? "";
const INTERSTITIAL_BLOCK = process.env.NEXT_PUBLIC_ADSGRAM_INTERSTITIAL_BLOCK_ID ?? "";
const DEBUG_USERS = (process.env.NEXT_PUBLIC_ADSGRAM_DEBUG_USERS ?? "").split(",").map((s) => s.trim()).filter(Boolean);

function isDebugUser(): boolean {
  const id = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
  return id !== undefined && DEBUG_USERS.includes(String(id));
}

function loadSdk(): Promise<NonNullable<Window["Adsgram"]>> {
  return new Promise((resolve, reject) => {
    if (window.Adsgram) return resolve(window.Adsgram);
    const s = document.createElement("script");
    s.src = SDK_URL;
    s.async = true;
    s.onload = () => (window.Adsgram ? resolve(window.Adsgram) : reject(new Error("Adsgram failed to load")));
    s.onerror = () => reject(new Error("Could not load Adsgram"));
    document.head.appendChild(s);
  });
}

export const adsgramConfigured = () => REWARD_BLOCK.length > 0;

// Resolves true only when the user watched to the end. Throws if not configured
// or the SDK cannot load, so callers can fall back.
export async function showAdsgramRewarded(): Promise<boolean> {
  if (!REWARD_BLOCK) throw new Error("Adsgram not configured");
  const Adsgram = await loadSdk();
  try {
    const res = await Adsgram.init({ blockId: REWARD_BLOCK, debug: isDebugUser() }).show();
    return res.done === true;
  } catch {
    return false; // closed early / no fill — never rewarded
  }
}

export async function showAdsgramInterstitial(): Promise<void> {
  if (!INTERSTITIAL_BLOCK) return;
  const Adsgram = await loadSdk();
  await Adsgram.init({ blockId: INTERSTITIAL_BLOCK, debug: isDebugUser() }).show().catch(() => {});
}
