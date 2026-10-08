import type { Metadata, Viewport } from "next";
import { Providers } from "./providers";
import "./globals.css";
import { IS_TELEGRAM_APP } from "@/pi/telegram";

export const metadata: Metadata = {
  title: {
    default: "View2Earn - Verified Digital Engagement",
    template: "%s - View2Earn",
  },
  description:
    IS_TELEGRAM_APP
      ? "View2Earn Telegram app — complete tasks, spin, quiz and learn to earn points redeemable for rewards."
      : "View2Earn Pi web app — follow, like, share and join channels on the Pi Network to earn points redeemable for digital perks and rewards.",
  metadataBase: new URL("https://view2earn.org"),
};

// Without this the page renders at desktop width inside Pi Browser and lets
// pinch-zoom reflow the layout — the two things that make a web page in a
// webview feel like a web page. viewportFit: "cover" lets the shell paint
// behind the status bar and use the env(safe-area-inset-*) padding instead.
// Zoom is deliberately left enabled; touch-action handles the double-tap
// delay without taking magnification away from anyone who needs it.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#fbfaf8",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      {IS_TELEGRAM_APP && (
        <head>
          <script src="https://telegram.org/js/telegram-web-app.js" />
        </head>
      )}
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}