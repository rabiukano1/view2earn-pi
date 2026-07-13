import type { Metadata } from "next";
import { Providers } from "./providers";
import { Sidebar } from "./sidebar";
import "./globals.css";

export const metadata: Metadata = {
  title: "View2Earn Admin",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <div className="layout">
            <Sidebar />
            <main className="main">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
