// Build-time stand-in for adsgram.ts in the PI build. next.config.js swaps the
// real module for this one whenever NEXT_PUBLIC_APP_MODE !== "telegram", so the
// Pi bundle contains no third-party ad SDK at all — matching what the Pi Ad
// Network application declares. These are never called: isTelegram() is a
// false build-time constant there.
export const adsgramConfigured = () => false;
export function adsgramViewerId(): string {
  return "";
}
export async function showAdsgramRewarded(): Promise<{
  done: boolean;
  reason: string;
  viewerId: string;
}> {
  return { done: false, reason: "ADS_NOT_SUPPORTED", viewerId: "" };
}
export async function showAdsgramInterstitial(): Promise<void> {}
