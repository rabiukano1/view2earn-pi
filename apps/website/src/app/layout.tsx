import type { Metadata } from "next";
import { Providers } from "./providers";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { CookieConsentBanner } from "@/components/CookieConsentBanner";
import { VisitorTracker } from "@/components/VisitorTracker";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "View2Earn — Earn rewards for every engagement",
    template: "%s · View2Earn",
  },
  description:
    "View2Earn is a social-engagement and rewards platform on Pi Network and Sidra Chain. Follow, like, share and join channels to earn points redeemable for airtime, data and more.",
  keywords: [
    "View2Earn",
    "earn rewards",
    "Pi Network",
    "Sidra Chain",
    "social engagement rewards",
    "paid to engage",
  ],
  openGraph: {
    title: "View2Earn — Earn rewards for every engagement",
    description:
      "Follow, like, share and join channels to earn points redeemable for real rewards on Pi Network and Sidra Chain.",
    type: "website",
    siteName: "View2Earn",
  },
  metadataBase: new URL("https://view2earn.org"),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <SiteHeader />
          <main>{children}</main>
          <SiteFooter />
          <VisitorTracker />
          <CookieConsentBanner />
        </Providers>
      </body>
    </html>
  );
}
