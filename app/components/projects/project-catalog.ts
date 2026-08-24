import { PROJECT_ROUTES } from "./project-routes";

export type ProjectId =
  | "grailed-plus"
  | "photo-graph"
  | "nepobabiesruntheunderground"
  | "spotify-nodify";

export type ProjectPreviewKind =
  | "grailed-plus"
  | "photo-graph"
  | "html"
  | "spotify";

export type ProjectTitleTreatment = "grailed" | "photo-graph" | "nepo";

export type GrailedPlusFeature = "price-trend" | "custom-currency" | "dm" | null;

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
  posterSrc: string;
  posterAlt: string;
  posterAspectRatio: number;
  previewKind: ProjectPreviewKind;
  role: string;
  date: string;
  outcome: string;
  links: readonly ProjectLink[];
};

export const projectCatalog: readonly ProjectDefinition[] = [
  {
    id: "grailed-plus",
    number: "01",
    title: "Grailed Plus",
    titleTreatment: "grailed",
    eyebrow: "Browser extension / Product layer",
    summary:
      "Cross-market comparison, price context, local currency, seller metadata, and dark mode inside Grailed.",
    technologies: ["Chrome MV3", "JavaScript"],
    experienceHref: PROJECT_ROUTES.grailedPlusInstall,
    liveHref: PROJECT_ROUTES.grailedPlusInstall,
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
        href: PROJECT_ROUTES.grailedPlusInstall,
      },
      {
        label: "Chrome Web Store",
        href: PROJECT_ROUTES.grailedPlusChromeWebStore,
        external: true,
      },
    ],
  },
  {
    id: "photo-graph",
    number: "02",
    title: "Photo Node-Gallery",
    titleTreatment: "photo-graph",
    eyebrow: "Photography / Data visualization",
    summary:
      "A force-directed gallery that maps photographs through color-similarity relationships.",
    technologies: ["Next.js", "D3", "Supabase"],
    caseStudyHref: PROJECT_ROUTES.photoGraph,
    experienceHref: PROJECT_ROUTES.photoGraphExperience,
    posterSrc: "/projects/posters/photo-graph.webp",
    posterAlt:
      "Force-directed Photo Node-Gallery with connected photography nodes",
    posterAspectRatio: 2.00,
    previewKind: "photo-graph",
    role: "TBD",
    date: "TBD",
    outcome: "TBD",
    links: [],
  },
  {
    id: "nepobabiesruntheunderground",
    number: "03",
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
] as const;

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
