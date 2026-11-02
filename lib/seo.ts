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
const elliotMairet = getProject("elliotmairet");
const bur1alrites = getProject("bur1alrites");
const grailedPlus = getProject("grailed-plus");
const tvmDiscordBot = getProject("tvm-discord-bot");
const botOrNot = getProject("bot-or-not");
const portfolioDesign = getProject("portfolio-design");

// Update these dates when the corresponding public content changes significantly.
export const PUBLIC_PAGES = {
  portfolio: {
    path: PROJECT_ROUTES.home,
    title: `${SITE_PROFILE.name} — Software Developer & Creative Technologist`,
    description: SITE_PROFILE.description,
    lastModified: "2026-11-02",
    image: photoGraph,
  },
  photoGraph: {
    path: PROJECT_ROUTES.photoGraph,
    title: `${photoGraph.title} — ${SITE_PROFILE.name}`,
    description: photoGraph.summary,
    lastModified: "2026-11-02",
    image: photoGraph,
    project: photoGraph,
  },
  elliotMairet: {
    path: PROJECT_ROUTES.elliotMairetWriteUp,
    title: `${elliotMairet.title} — ${SITE_PROFILE.name}`,
    description: elliotMairet.summary,
    lastModified: "2026-11-02",
    image: elliotMairet,
    project: elliotMairet,
  },
  bur1alrites: {
    path: PROJECT_ROUTES.bur1alritesWriteUp,
    title: `${bur1alrites.title} — ${SITE_PROFILE.name}`,
    description: bur1alrites.summary,
    lastModified: "2026-11-02",
    image: bur1alrites,
    project: bur1alrites,
  },
  grailedPlusEngineering: {
    path: PROJECT_ROUTES.grailedPlusWriteUp,
    title: `${grailedPlus.title} — Engineering case study — ${SITE_PROFILE.name}`,
    description: grailedPlus.summary,
    lastModified: "2026-11-02",
    image: grailedPlus,
    project: grailedPlus,
  },
  tvmDiscordBot: {
    path: PROJECT_ROUTES.tvmDiscordBot,
    title: `${tvmDiscordBot.title} — ${SITE_PROFILE.name}`,
    description: tvmDiscordBot.summary,
    lastModified: "2026-11-02",
    image: tvmDiscordBot,
    project: tvmDiscordBot,
  },
  botOrNot: {
    path: PROJECT_ROUTES.botOrNot,
    title: `${botOrNot.title} — ${SITE_PROFILE.name}`,
    description: botOrNot.summary,
    lastModified: "2026-11-02",
    image: botOrNot,
    project: botOrNot,
  },
  portfolioDesign: {
    path: PROJECT_ROUTES.portfolioDesign,
    title: `${portfolioDesign.title} — ${SITE_PROFILE.name}`,
    description: portfolioDesign.summary,
    lastModified: "2026-11-02",
    image: portfolioDesign,
    project: portfolioDesign,
  },
  grailedPlus: {
    path: PROJECT_ROUTES.grailedPlus,
    title: `${grailedPlus.title} — Price Insights, Market Compare, Currency, and Dark Mode`,
    description:
      "Explore sample-data Grailed Plus demos for price insights, market comparison, custom currency conversion, seller context, and dark mode.",
    lastModified: "2026-10-31",
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
