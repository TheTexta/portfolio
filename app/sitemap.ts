import type { MetadataRoute } from "next";

import { projectCatalog } from "@/app/components/projects/project-catalog";
import { absoluteUrl, PUBLIC_PAGES } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  return Object.values(PUBLIC_PAGES).map((page) => ({
    url: absoluteUrl(page.path),
    lastModified: page.lastModified,
    images:
      page.path === PUBLIC_PAGES.portfolio.path
        ? projectCatalog.map((project) => absoluteUrl(project.posterSrc))
        : undefined,
  }));
}
