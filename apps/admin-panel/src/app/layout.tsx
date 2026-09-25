import type { Metadata, Viewport } from "next";
import { Providers } from "./providers";
import { Sidebar } from "./sidebar";
import { AuthGate } from "./AuthGate";
import "./globals.css";

export const metadata: Metadata = {
  title: "View2Earn Admin",
};

// Without this, phones render the panel at ~980px and scale it down: inputs end
// up a few physical pixels tall, so taps miss them, the keyboard does not open
// and long-press-to-paste cannot grab the field. Zoom stays enabled on purpose.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <AuthGate>
            <div className="layout">
              <Sidebar />
              <main className="main">{children}</main>
            </div>
          </AuthGate>
        </Providers>
      </body>
    </html>
  );
}
