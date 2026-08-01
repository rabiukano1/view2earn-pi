import type { Metadata } from "next";
import { Providers } from "./providers";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "View2Earn — Earn rewards for your attention",
    template: "%s · View2Earn",
  },
  description:
    "View2Earn is a task-and-reward platform on Pi Network and Sidra Chain. Complete social tasks, watch ads, answer quizzes and earn points redeemable for airtime, data and more.",
  keywords: [
    "View2Earn",
    "earn rewards",
    "Pi Network",
    "Sidra Chain",
    "task rewards",
    "paid to view",
  ],
  openGraph: {
    title: "View2Earn — Earn rewards for your attention",
    description:
      "Complete tasks, watch ads, answer quizzes and earn points redeemable for rewards.",
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
        </Providers>
      </body>
    </html>
  );
}
