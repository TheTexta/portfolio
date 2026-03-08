import type { Metadata } from "next";
import "./globals.css";

import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { FirebaseAnalytics } from "@/app/components/firebase/firebase-analytics";
import { ThemeProvider } from "@/app/components/theme/theme-provider";
import { SITE_ORIGIN } from "@/lib/site-config";


export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: "Dexter Young",
  description: "Showcase of programming and multimedia projects by Dexter Young",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <FirebaseAnalytics />
          {children}
          <Analytics />
          <SpeedInsights />
        </ThemeProvider>
      </body>
    </html>
  );
}
