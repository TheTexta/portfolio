import type { ReactNode } from "react";
import HtmlProjectPreview from "@/app/components/projects/html-project-preview";
import GrailedPlusPreview from "@/app/components/projects/grailed-plus/grailed-plus-preview";
import PhotoGraphCanvas from "@/app/components/projects/photo-graph/PhotoGraphCanvas";
import type { PreviewLink } from "./project-preview-link";
import { PROJECT_ROUTES } from "./project-routes";

export type ProjectDefinition = {
  id: string;
  title: string;
  description: string;
  tags: string[];
  previewLinks?: PreviewLink[];
  renderPreview: (darkMode: boolean) => ReactNode;
};

export const projectCatalog: ProjectDefinition[] = [
  {
    id: "photo-graph",
    title: "Photo Node-Gallery",
      description:
        "A force-directed gallery where photographs cluster and interact based on color similarity.",
    tags: ["Next.js", "D3", "Firebase"],
    renderPreview: (darkMode) => <PhotoGraphCanvas forcedDarkMode={darkMode} />,
  },
  {
    id: "grailed-plus",
    title: "Grailed Plus (V2)",
    description:
      "Browser extension that introduces price history, drop metrics, seller metadata, custom currency conversion, and site-wide dark mode controls.",
    tags: ["Browser Extension", "Chrome MV3", "Firefox MV3", "JavaScript"],
    // TODO: Firefox Webstore
    previewLinks: [
      {
        label: "Chrome Web Store",
        href: "https://chromewebstore.google.com/detail/grailed-plus/bgblnhmkbofpgmibnogimfheipedkegd?authuser=1&hl=en",
        ariaLabel: "Open Grailed Plus on Chrome Web Store",
      },
    ],
    renderPreview: (darkMode) => (
      <GrailedPlusPreview forcedDarkMode={darkMode} />
    ),
  },
  {
    id: "nepobabiesruntheunderground",
    title: "nepobabiesruntheunderground",
      description:
        "A visual UI project combining custom typography, motion, collage imagery, and WebGL textures in an experimental digital environment.",
    tags: ["HTML", "CSS", "JavaScript", "WebGL"],
    previewLinks: [
      {
        label: "GitHub",
        href: "https://github.com/TheTexta/nepobabiesruntheunderground",
        ariaLabel: "Open nepobabiesruntheunderground on GitHub",
      },
    ],
    renderPreview: () => (
      <HtmlProjectPreview
        title="nepobabiesruntheunderground"
        previewSrc={PROJECT_ROUTES.nepobabiesPreview}
        projectHref={PROJECT_ROUTES.nepobabies}
      />
    ),
  },
];
