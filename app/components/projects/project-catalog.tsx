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

/*
    Use a compressed, technical, feature-dense style. when writing descriptions for projects - 
    a single-sentence product summary structured as: 
    what it is → where it applies → core technical mechanism → feature list
    */

export const projectCatalog: ProjectDefinition[] = [
  {
    id: "grailed-plus",
    title: "Grailed Plus",
    description:
      "Browser extension for grailed.com, a second-hand clothing marketplace, that injects embedding-based matching to compare listings across secondary clothing platforms, while adding price history, drop metrics, seller metadata, currency conversion, and dark mode controls.",
    tags: ["Browser Extension", "Chrome MV3", "Firefox MV3", "JavaScript"],
    // TODO: Firefox Webstore
    previewLinks: [
      {
        label: "Chrome Web Store",
        href: PROJECT_ROUTES.grailedPlusChromeWebStore,
        ariaLabel: "Open Grailed Plus on Chrome Web Store",
      },
    ],
    renderPreview: (darkMode) => (
      <GrailedPlusPreview forcedDarkMode={darkMode} />
    ),
  },
  {
    id: "photo-graph",
    title: "Photo Node-Gallery",
    description:
      "Interactive force-directed gallery that uses color-similarity mapping to cluster and link photographs within a dynamic node graph.",
    tags: ["Next.js", "D3", "Supabase"],
    renderPreview: (darkMode) => (
      <PhotoGraphCanvas forcedDarkMode={darkMode} fitToCanvas />
    ),
  },
  {
    id: "nepobabiesruntheunderground",
    title: "nepobabiesruntheunderground",
    description:
      "Interactive UI project that layers custom typography, motion, collage imagery, and WebGL textures into a dense experimental digital environment.",
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
