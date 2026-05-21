import type { Metadata, Viewport } from "next";
import "./globals.css";
import MobileShell from "@/components/MobileShell";

export const metadata: Metadata = {
  title: "Gambler's Paradise",
  description:
    "An incremental mobile game of gambling, jobs, investing, real estate, business and a simulated global economy.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Paradise" },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0f",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="phone-frame">
          <MobileShell>{children}</MobileShell>
        </div>
      </body>
    </html>
  );
}
