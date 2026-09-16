// Telegram Mini App mode (apps/tg-app). Same source as the Pi app, built with
// NEXT_PUBLIC_APP_MODE=telegram: sign-in uses Telegram's signed initData
// instead of Pi, ads go through Adsgram, Pi payments are hidden. Everything
// else (spin, quiz, tasks, learn, wallet ledger) is shared. The Pi build has
// this mode compiled out. Script tag lives in app/layout.tsx.
export const IS_TELEGRAM_APP = process.env.NEXT_PUBLIC_APP_MODE === "telegram";

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string;
        ready: () => void;
        expand: () => void;
        openLink: (url: string) => void;
      };
    };
  }
}

export function getTelegramInitData(): string {
  return typeof window === "undefined" ? "" : window.Telegram?.WebApp?.initData ?? "";
}

export function isTelegram(): boolean {
  return IS_TELEGRAM_APP;
}

// Opens a URL from inside the Mini App (falls back to a normal new tab).
export function openLink(url: string): void {
  const tg = window.Telegram?.WebApp;
  if (tg?.openLink) tg.openLink(url);
  else window.open(url, "_blank", "noopener,noreferrer");
}

// Build-time constant, so it is safe to use during render/hydration.
export function useIsTelegram(): boolean {
  return IS_TELEGRAM_APP;
}
