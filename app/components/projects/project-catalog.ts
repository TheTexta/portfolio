import { PROJECT_ROUTES } from "./project-routes";

export type ProjectPreviewKind =
  "grailed-plus" | "photo-graph" | "html" | "static";

export type ProjectTitleTreatment =
  | "bur1alrites"
  | "grailed"
  | "photo-graph"
  | "nepo"
  | "elliot-mairet"
  | "software";

export type GrailedPlusFeature =
  "price-trend" | "custom-currency" | "dm" | null;

export type ProjectId =
  | "photo-graph"
  | "tvm-discord-bot"
  | "bot-or-not"
  | "portfolio-design"
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
  writeUpHref?: string;
  experienceHref?: string;
  liveHref?: string;
  sourceHref?: string;
  posterSrc: string;
  posterAlt: string;
  posterWidth: number;
  posterHeight: number;
  posterAspectRatio: number;
  previewKind: ProjectPreviewKind;
  showInBrowser?: boolean;
  previewScale?: number;
  role: string;
  date: string;
  status: string;
  outcome: string;
  links: readonly ProjectLink[];
};

const projectCatalogDefinition = [
  {
    id: "photo-graph",
    number: "03",
    title: "Photo Node-Gallery",
    titleTreatment: "photo-graph",
    eyebrow: "Photography / Data visualization",
    summary:
      "A force-directed photo archive that uses colour similarity to surface unexpected visual neighbours, then tests those relationships against human review.",
    technologies: ["Next.js", "D3", "Supabase"],
    writeUpHref: PROJECT_ROUTES.photoGraph,
    experienceHref: PROJECT_ROUTES.photoGraphExperience,
    posterSrc: "/projects/posters/photo-graph.webp",
    posterWidth: 3306,
    posterHeight: 1859,
    posterAlt:
      "Force-directed Photo Node-Gallery with connected photography nodes",
    posterAspectRatio: 2.0,
    previewKind: "photo-graph",
    role: "Design, development, and photography",
    date: "2026",
    status: "Live interactive archive",
    outcome: "A colour-linked archive with a scoped editorial model comparison",
    links: [],
  },
  {
    id: "grailed-plus",
    number: "01",
    title: "Grailed Plus",
    titleTreatment: "grailed",
    eyebrow: "Browser extension / Product layer",
    summary:
      "Cross-market comparison, price context, local currency, seller metadata, and dark mode inside Grailed.",
    technologies: ["TypeScript", "ONNX Runtime", "Node.js"],
    writeUpHref: PROJECT_ROUTES.grailedPlusWriteUp,
    experienceHref: PROJECT_ROUTES.grailedPlus,
    liveHref: PROJECT_ROUTES.grailedPlus,
    posterSrc: "/projects/posters/grailed-plus.webp",
    posterWidth: 1440,
    posterHeight: 820,
    posterAlt:
      "Grailed listing with Grailed Plus pricing insights and market comparison",
    posterAspectRatio: 1.75,
    previewKind: "grailed-plus",
    role: "Product development, extending RVRX/grailed-plus",
    date: "2026",
    status: "Published Chrome extension; Firefox build support",
    outcome: "Pricing context and cross-market comparison inside Grailed",
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
    number: "07",
    title: "nepobabiesruntheunderground",
    titleTreatment: "nepo",
    eyebrow: "Experimental web / Multimedia",
    summary:
      "An experimental interface combining custom typography, collage imagery, motion, and WebGL texture.",
    technologies: ["HTML", "CSS", "JavaScript", "WebGL"],
    liveHref: PROJECT_ROUTES.nepobabiesLive,
    posterSrc: "/projects/posters/nepobabies.webp",
    posterWidth: 1440,
    posterHeight: 812,
    posterAlt: "Experimental nepobabiesruntheunderground website composition",
    posterAspectRatio: 1.77,
    previewKind: "html",
    role: "Design and development",
    date: "2026",
    status: "Live experimental site",
    outcome: "An interactive typography and multimedia experiment",
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
    number: "05",
    title: "bur1alrites",
    titleTreatment: "bur1alrites",
    eyebrow: "Portfolio / Moving-image archive",
    summary:
      "A portfolio for Allie's reactive lighting, with cursor-driven visuals, a 3D gallery, and a projector room.",
    technologies: ["Next.js", "Three.js", "TypeScript", "Tailwind CSS"],
    writeUpHref: PROJECT_ROUTES.bur1alritesWriteUp,
    liveHref: PROJECT_ROUTES.bur1alritesLive,
    posterSrc: "/projects/posters/bur1alrites.png",
    posterWidth: 1500,
    posterHeight: 1000,
    posterAlt: "BUR1ALRITES title over a grainy black moving-image scene",
    posterAspectRatio: 1.5,
    previewKind: "html",
    role: "Design and development",
    date: "2026",
    status: "Live client portfolio",
    outcome: "A reactive portfolio for Allie's lighting work",
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
    number: "04",
    title: "Elliot Mairet",
    titleTreatment: "elliot-mairet",
    eyebrow: "Photography / Image archive",
    summary:
      "A photography archive with colour-based discovery and a publishing workflow that keeps uploads recoverable.",
    technologies: ["Next.js", "React", "Supabase"],
    writeUpHref: PROJECT_ROUTES.elliotMairetWriteUp,
    liveHref: PROJECT_ROUTES.elliotMairetLive,
    sourceHref: PROJECT_ROUTES.elliotMairetGithub,
    posterSrc: "/projects/posters/elliot-mairet.png",
    posterWidth: 2160,
    posterHeight: 1350,
    posterAlt:
      "Black-and-white Elliot Mairet photograph of people gathered beneath fabric",
    posterAspectRatio: 1.625,
    previewKind: "html",
    previewScale: 0.85,
    role: "Design and development",
    date: "2026",
    status: "Live client archive",
    outcome: "A browsable online archive for Elliot Mairet's photographs",
    links: [
      {
        label: "GitHub",
        href: PROJECT_ROUTES.elliotMairetGithub,
        external: true,
      },
    ],
  },
  {
    id: "tvm-discord-bot",
    showInBrowser: false,
    number: "02",
    title: "TVM Discord Bot",
    titleTreatment: "software",
    eyebrow: "Backend / Membership workflows",
    summary:
      "Membership and production access for TVM, with reviewed roster changes and recovery when saved changes lose their confirmation.",
    technologies: ["Node.js", "discord.js", "SQLite"],
    writeUpHref: PROJECT_ROUTES.tvmDiscordBot,
    sourceHref: PROJECT_ROUTES.tvmDiscordBotGithub,
    posterSrc: "/projects/posters/tvm-discord-bot.png",
    posterWidth: 1600,
    posterHeight: 1000,
    posterAlt:
      "TVM bot recovery diagram: roster saved, Discord synchronization pending, confirmation unavailable. Synthetic example.",
    posterAspectRatio: 1.6,
    previewKind: "static",
    role: "TVM workflow development, adapted from EmailVerify",
    date: "2026",
    status: "Public source and regression tests",
    outcome:
      "Persistent membership, role reconciliation, and private shoot workspaces",
    links: [
      {
        label: "Source and tests",
        href: PROJECT_ROUTES.tvmDiscordBotGithub,
        external: true,
      },
    ],
  },
  {
    id: "bot-or-not",
    showInBrowser: false,
    number: "06",
    title: "Bot or Not",
    titleTreatment: "software",
    eyebrow: "Applied ML / Evaluation workflow",
    summary:
      "English and French bot classifiers with grouped model selection, reproducible reports, and explicit limits on overlapping practice data.",
    technologies: ["Python", "scikit-learn", "NumPy"],
    writeUpHref: PROJECT_ROUTES.botOrNot,
    sourceHref: PROJECT_ROUTES.botOrNotGithub,
    posterSrc: "/projects/posters/bot-or-not.png",
    posterWidth: 1600,
    posterHeight: 1000,
    posterAlt:
      "Bot or Not workflow: official-shard validation selects a model and threshold; overlapping practice data is reported separately from independent evaluation.",
    posterAspectRatio: 1.6,
    previewKind: "static",
    role: "Classifier comparison and evaluation tooling for the McGill challenge",
    date: "2026",
    status: "Public source and saved competition run",
    outcome:
      "Language-specific selection and prediction reports with scoped practice results",
    links: [
      {
        label: "Source and reports",
        href: PROJECT_ROUTES.botOrNotGithub,
        external: true,
      },
    ],
  },
  {
    id: "portfolio-design",
    number: "08",
    title: "Portfolio design",
    titleTreatment: "software",
    eyebrow: "Interface / Editorial system",
    summary:
      "An editorial frame for software, photography and interactive media, with focused previews and separate project articles.",
    technologies: ["Next.js", "TypeScript", "MDX", "Framer Motion"],
    writeUpHref: PROJECT_ROUTES.portfolioDesign,
    sourceHref: "https://github.com/TheTexta/portfolio",
    posterSrc: "/projects/portfolio-design/desktop.png",
    posterWidth: 1366,
    posterHeight: 900,
    posterAlt:
      "Dexter Young's monochrome portfolio overview in desktop Chromium.",
    posterAspectRatio: 1366 / 900,
    previewKind: "static",
    showInBrowser: false,
    role: "Design and development",
    date: "2026",
    status: "Public source; local review implementation",
    outcome:
      "A shared reading and browsing system without flattening each project's identity",
    links: [],
  },
] as const satisfies readonly ProjectDefinition[];

const projectOrder: readonly ProjectId[] = [
  "grailed-plus",
  "tvm-discord-bot",
  "photo-graph",
  "elliotmairet",
  "bur1alrites",
  "bot-or-not",
  "nepobabiesruntheunderground",
  "portfolio-design",
];

export const projectCatalog = [...projectCatalogDefinition].sort(
  (left, right) =>
    projectOrder.indexOf(left.id) - projectOrder.indexOf(right.id),
) as readonly ProjectDefinition[] & ReadonlyArray<{ id: ProjectId }>;

export const browserProjects = projectCatalog.filter(
  (project) => project.showInBrowser !== false,
);

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
  const index = browserProjects.findIndex(
    (project) => project.id === projectId,
  );
  if (index < 0) throw new Error(`Project ${projectId} has no browser card`);
  const previous =
    browserProjects[
      (index - 1 + browserProjects.length) % browserProjects.length
    ];
  const next = browserProjects[(index + 1) % browserProjects.length];

  return { previous, next };
}

export function getProjectReturnHref(project: ProjectDefinition) {
  return project.showInBrowser === false
    ? `${PROJECT_ROUTES.home}#about`
    : `${PROJECT_ROUTES.home}#project-${project.id}`;
}

export function getProjectHref(project: ProjectDefinition) {
  return (
    project.writeUpHref ??
    project.liveHref ??
    project.experienceHref ??
    PROJECT_ROUTES.portfolioProjects
  );
}
