import type { Metadata } from "next";
import "./globals.css";

import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { FirebaseAnalytics } from "@/app/components/firebase/firebase-analytics";
import { ThemeProvider } from "@/app/components/theme/theme-provider";


export const metadata: Metadata = {
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
