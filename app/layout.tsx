import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { FirebaseAnalytics } from "@/app/components/firebase/firebase-analytics";
import { ThemeProvider } from "@/app/components/theme/theme-provider";
import { SITE_ORIGIN } from "@/lib/site-config";

const redHatText = localFont({
  src: [
    {
      path: "./fonts/RedHatText-VariableFont_wght.ttf",
      style: "normal",
      weight: "300 700",
    },
    {
      path: "./fonts/RedHatText-Italic-VariableFont_wght.ttf",
      style: "italic",
      weight: "300 700",
    },
  ],
  variable: "--font-red-hat-text",
  display: "swap",
});

const redHatDisplay = localFont({
  src: [
    {
      path: "./fonts/RedHatDisplay-VariableFont_wght.ttf",
      style: "normal",
      weight: "300 900",
    },
    {
      path: "./fonts/RedHatDisplay-Italic-VariableFont_wght.ttf",
      style: "italic",
      weight: "300 900",
    },
  ],
  variable: "--font-red-hat-display",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: "Dexter Young",
  description:
    "Showcase of programming and multimedia projects by Dexter Young",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${redHatText.variable} ${redHatDisplay.variable}`}
    >
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
