import type { Metadata } from "next";
import "./globals.css";

import { Analytics } from "@vercel/analytics/next"


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
    <html lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
