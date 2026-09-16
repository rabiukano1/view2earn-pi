import type { Metadata } from "next";
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