import type { MetadataRoute } from "next";

import { SITE_ORIGIN } from "@/lib/site-config";

const DISALLOWED_PATHS = [
  "/api/",
  "/admin/",
  "/auth/spotify/callback",
  "/components/projects/nepobabiesruntheunderground/preview",
];

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
