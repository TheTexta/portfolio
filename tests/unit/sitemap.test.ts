import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import {
  LEGACY_WRITE_UP_REDIRECTS,
  PROJECT_ROUTES,
} from "@/app/components/projects/project-routes";
import { absoluteUrl, PUBLIC_PAGES } from "@/lib/seo";
import { SITE_ORIGIN } from "@/lib/site-config";

describe("canonical sitemap URLs", () => {
  it("includes only unique public pages on the canonical site origin", () => {
    const urls = sitemap().map((entry) => entry.url);

    expect(urls.toSorted()).toEqual(
      Object.values(PUBLIC_PAGES)
        .map((page) => absoluteUrl(page.path))
        .toSorted(),
    );
    expect(new Set(urls).size).toBe(urls.length);
    for (const url of urls) {
      expect(new URL(url).origin).toBe(SITE_ORIGIN);
    }
  });

  it("excludes redirect sources and the external Nepobabies destination", () => {
    const urls = sitemap().map((entry) => entry.url);

    expect(urls).toContain(absoluteUrl(PROJECT_ROUTES.home));
    for (const path of [
      "/",
      ...LEGACY_WRITE_UP_REDIRECTS.map(([source]) => source),
    ]) {
      expect(urls).not.toContain(absoluteUrl(path));
    }
    expect(urls).not.toContain(PROJECT_ROUTES.nepobabiesLive);
    expect(urls).not.toContain(
      `${SITE_ORIGIN}${PROJECT_ROUTES.nepobabiesLive}`,
    );
  });

  it("resolves external links without concatenating two origins", () => {
    expect(absoluteUrl(PROJECT_ROUTES.nepobabiesLive)).toBe(
      PROJECT_ROUTES.nepobabiesLive,
    );
    expect(absoluteUrl(PROJECT_ROUTES.home)).toBe(
      `${SITE_ORIGIN}${PROJECT_ROUTES.home}`,
    );
  });
});
