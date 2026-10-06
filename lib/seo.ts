import type { Metadata } from "next";

import {
  getProject,
  getProjectHref,
  projectCatalog,
  type ProjectDefinition,
} from "@/app/components/projects/project-catalog";
import { PROJECT_ROUTES } from "@/app/components/projects/project-routes";
import { SITE_ORIGIN, SITE_PROFILE } from "@/lib/site-config";

type PublicPage = {
  path: string;
  title: string;
  description: string;
  lastModified: string;
  image: ProjectDefinition;
  project?: ProjectDefinition;
};

const photoGraph = getProject("photo-graph");
const grailedPlus = getProject("grailed-plus");

// Update these dates when the corresponding public content changes significantly.
export const PUBLIC_PAGES = {
  portfolio: {
    path: PROJECT_ROUTES.home,
    title: `${SITE_PROFILE.name} — Software Developer & Creative Technologist`,
    description: SITE_PROFILE.description,
    lastModified: "2026-10-06",
    image: photoGraph,
  },
  photoGraph: {
    path: PROJECT_ROUTES.photoGraph,
    title: `${photoGraph.title} — ${SITE_PROFILE.name}`,
    description: photoGraph.summary,
    lastModified: "2026-10-06",
    image: photoGraph,
    project: photoGraph,
  },
  grailedPlus: {
    path: PROJECT_ROUTES.grailedPlus,
    title: `${grailedPlus.title} — Price Insights, Market Compare, Currency, and Dark Mode`,
    description:
      "Explore live Grailed Plus demos for price insights, market comparison, custom currency conversion, seller context, and dark mode.",
    lastModified: "2026-10-06",
    image: grailedPlus,
    project: grailedPlus,
  },
} satisfies Record<string, PublicPage>;

export function absoluteUrl(path: string) {
  return new URL(path, SITE_ORIGIN).toString();
}

export function createPageMetadata(page: PublicPage): Metadata {
  const image = {
    url: absoluteUrl(page.image.posterSrc),
    alt: page.image.posterAlt,
    width: page.image.posterWidth,
    height: page.image.posterHeight,
  };

  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: absoluteUrl(page.path) },
    openGraph: {
      type: "website",
      siteName: SITE_PROFILE.name,
      title: page.title,
      description: page.description,
      url: absoluteUrl(page.path),
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: page.title,
      description: page.description,
      images: [{ url: image.url, alt: image.alt }],
    },
  };
}

const PERSON_ID = `${SITE_ORIGIN}/#person`;
const WEBSITE_ID = `${SITE_ORIGIN}/#website`;

export function createSiteStructuredData() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Person",
        "@id": PERSON_ID,
        name: SITE_PROFILE.name,
        url: absoluteUrl(PROJECT_ROUTES.home),
        jobTitle: SITE_PROFILE.role,
        description: SITE_PROFILE.description,
        sameAs: Object.values(SITE_PROFILE.profiles),
      },
      {
        "@type": "WebSite",
        "@id": WEBSITE_ID,
        url: `${SITE_ORIGIN}/`,
        name: SITE_PROFILE.name,
        alternateName: "dextery.dev",
        description: SITE_PROFILE.description,
        publisher: { "@id": PERSON_ID },
      },
    ],
  };
}

export function createPageStructuredData(page: PublicPage) {
  const url = absoluteUrl(page.path);
  const imageId = `${url}#primary-image`;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "ImageObject",
        "@id": imageId,
        contentUrl: absoluteUrl(page.image.posterSrc),
        caption: page.image.posterAlt,
        width: page.image.posterWidth,
        height: page.image.posterHeight,
      },
      {
        "@type": page.project ? "WebPage" : "CollectionPage",
        "@id": `${url}#webpage`,
        url,
        name: page.title,
        description: page.description,
        isPartOf: { "@id": WEBSITE_ID },
        primaryImageOfPage: { "@id": imageId },
        about: { "@id": PERSON_ID },
        mainEntity: page.project
          ? {
              "@type": "CreativeWork",
              name: page.project.title,
              description: page.project.summary,
              url,
              creator: { "@id": PERSON_ID },
              image: { "@id": imageId },
            }
          : {
              "@type": "ItemList",
              itemListElement: projectCatalog.map((project, index) => ({
                "@type": "ListItem",
                position: index + 1,
                name: project.title,
                url: absoluteUrl(getProjectHref(project)),
              })),
            },
      },
    ],
  };
}
