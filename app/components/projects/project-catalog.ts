import { PROJECT_ROUTES } from "./project-routes";

export type ProjectPreviewKind =
  "grailed-plus" | "photo-graph" | "html" | "spotify";

export type ProjectTitleTreatment =
  "bur1alrites" | "grailed" | "photo-graph" | "nepo" | "elliot-mairet";

export type GrailedPlusFeature =
  "price-trend" | "custom-currency" | "dm" | null;

export type ProjectId =
  | "photo-graph"
  | "elliotmairet"
  | "bur1alrites"
  | "grailed-plus"
  | "nepobabiesruntheunderground";

export type ProjectLink = {
  label: string;
  href: string;
  external?: boolean;
};

export type ProjectDefinition = {
  id: ProjectId;
  number: string;
  title: string;
  titleTreatment: ProjectTitleTreatment;
  eyebrow: string;
  summary: string;
  technologies: readonly string[];
  caseStudyHref?: string;
  experienceHref?: string;
  liveHref?: string;
  sourceHref?: string;
  posterSrc: string;
  posterAlt: string;
  posterAspectRatio: number;
  previewKind: ProjectPreviewKind;
  role: string;
  date: string;
  outcome: string;
  links: readonly ProjectLink[];
};

const projectCatalogDefinition = [
  {
    id: "photo-graph",
    number: "01",
    title: "Photo Node-Gallery",
    titleTreatment: "photo-graph",
    eyebrow: "Photography / Data visualization",
    summary:
      "A force-directed photo archive that uses colour similarity to surface unexpected visual neighbours, then tests those relationships against human review.",
    technologies: ["Next.js", "D3", "Supabase"],
    caseStudyHref: PROJECT_ROUTES.photoGraph,
    experienceHref: PROJECT_ROUTES.photoGraphExperience,
    posterSrc: "/projects/posters/photo-graph.webp",
    posterAlt:
      "Force-directed Photo Node-Gallery with connected photography nodes",
    posterAspectRatio: 2.0,
    previewKind: "photo-graph",
    role: "TBD",
    date: "TBD",
    outcome: "TBD",
    links: [],
  },
  {
    id: "grailed-plus",
    number: "04",
    title: "Grailed Plus",
    titleTreatment: "grailed",
    eyebrow: "Browser extension / Product layer",
    summary:
      "Cross-market comparison, price context, local currency, seller metadata, and dark mode inside Grailed.",
    technologies: ["Chrome MV3", "JavaScript"],
    experienceHref: PROJECT_ROUTES.grailedPlus,
    liveHref: PROJECT_ROUTES.grailedPlus,
    posterSrc: "/projects/posters/grailed-plus.webp",
    posterAlt:
      "Grailed listing with Grailed Plus pricing insights and market comparison",
    posterAspectRatio: 1.75,
    previewKind: "grailed-plus",
    role: "TBD",
    date: "TBD",
    outcome: "TBD",
    links: [
      {
        label: "Product page",
        href: PROJECT_ROUTES.grailedPlus,
      },
      {
        label: "Chrome Web Store",
        href: PROJECT_ROUTES.grailedPlusChromeWebStore,
        external: true,
      },
    ],
  },
  {
    id: "nepobabiesruntheunderground",
    number: "05",
    title: "nepobabiesruntheunderground",
    titleTreatment: "nepo",
    eyebrow: "Experimental web / Multimedia",
    summary:
      "An experimental interface combining custom typography, collage imagery, motion, and WebGL texture.",
    technologies: ["HTML", "CSS", "JavaScript", "WebGL"],
    liveHref: PROJECT_ROUTES.nepobabiesLive,
    posterSrc: "/projects/posters/nepobabies.webp",
    posterAlt: "Experimental nepobabiesruntheunderground website composition",
    posterAspectRatio: 1.77,
    previewKind: "html",
    role: "TBD",
    date: "TBD",
    outcome: "TBD",
    links: [
      {
        label: "Open live site",
        href: PROJECT_ROUTES.nepobabiesLive,
        external: true,
      },
      {
        label: "GitHub",
        href: PROJECT_ROUTES.nepobabiesGithub,
        external: true,
      },
    ],
  },
  {
    id: "bur1alrites",
    number: "03",
    title: "bur1alrites",
    titleTreatment: "bur1alrites",
    eyebrow: "Portfolio / Moving-image archive",
    summary:
      "A black-and-white moving-image archive where clips begin as inverted studies and reveal their colour on hover.",
    technologies: ["Next.js", "TypeScript", "Tailwind CSS"],
    liveHref: PROJECT_ROUTES.bur1alritesLive,
    posterSrc: "/projects/posters/bur1alrites.png",
    posterAlt: "BUR1ALRITES title over a grainy black moving-image scene",
    posterAspectRatio: 1.5,
    previewKind: "html",
    role: "Design and development",
    date: "2026",
    outcome: "An archive for moving-image work",
    links: [
      {
        label: "Open live site",
        href: PROJECT_ROUTES.bur1alritesLive,
        external: true,
      },
    ],
  },
  {
    id: "elliotmairet",
    number: "02",
    title: "Elliot Mairet",
    titleTreatment: "elliot-mairet",
    eyebrow: "Photography / Image archive",
    summary:
      "A photographic archive that pairs an expansive image index with colour palettes and related-image discovery.",
    technologies: ["Next.js", "React", "Supabase"],
    liveHref: PROJECT_ROUTES.elliotMairetLive,
    sourceHref: PROJECT_ROUTES.elliotMairetGithub,
    posterSrc: "/projects/posters/elliot-mairet.png",
    posterAlt:
      "Black-and-white Elliot Mairet photograph of people gathered beneath fabric",
    posterAspectRatio: 1.5,
    previewKind: "html",
    role: "Design and development",
    date: "2026",
    outcome: "A browsable online archive for Elliot Mairet's photographs",
    links: [
      {
        label: "GitHub",
        href: PROJECT_ROUTES.elliotMairetGithub,
        external: true,
      },
    ],
  },
] as const satisfies readonly ProjectDefinition[];

const projectOrder: readonly string[] = [
  "photo-graph",
  "elliotmairet",
  "bur1alrites",
  "grailed-plus",
  "nepobabiesruntheunderground",
];

export const projectCatalog = [...projectCatalogDefinition].sort(
  (left, right) => projectOrder.indexOf(left.id) - projectOrder.indexOf(right.id),
) as readonly ProjectDefinition[] & ReadonlyArray<{ id: ProjectId }>;

export function getProject(projectId: ProjectId) {
  const project = projectCatalog.find(
    (candidate) => candidate.id === projectId,
  );

  if (!project) {
    throw new Error(`Unknown project: ${projectId}`);
  }

  return project;
}

export function getAdjacentProjects(projectId: ProjectId) {
  const index = projectCatalog.findIndex((project) => project.id === projectId);
  const previous =
    projectCatalog[(index - 1 + projectCatalog.length) % projectCatalog.length];
  const next = projectCatalog[(index + 1) % projectCatalog.length];

  return { previous, next };
}
