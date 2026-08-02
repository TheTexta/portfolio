import type { MetadataRoute } from "next";

import { PROJECT_ROUTES } from "@/app/components/projects/project-routes";
import { SITE_ORIGIN } from "@/lib/site-config";

const INDEXABLE_PATHS = [
  PROJECT_ROUTES.home,
  PROJECT_ROUTES.photoGraph,
  PROJECT_ROUTES.spotifyNodify,
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return INDEXABLE_PATHS.map((path) => ({
    url: `${SITE_ORIGIN}${path}`,
    lastModified,
  }));
}
