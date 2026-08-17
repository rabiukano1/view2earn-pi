import type { Metadata } from "next";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "View2Earn - Verified Digital Engagement",
    template: "%s - View2Earn",
  },
  description:
    "View2Earn Pi web app — follow, like, share and join channels on the Pi Network to earn points redeemable for digital perks and rewards.",
  metadataBase: new URL("https://view2earn.org"),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}