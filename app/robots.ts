import type { MetadataRoute } from "next";

import { SITE_ORIGIN } from "@/lib/site-config";

// Public noindex pages must remain crawlable so crawlers can read their metadata.
// Legacy URLs also remain crawlable so their redirects or 404s can be discovered.
const DISALLOWED_PATHS = ["/api/", "/admin"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: DISALLOWED_PATHS,
      },
    ],
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
  };
}
