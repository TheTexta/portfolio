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
      "Browser extension injects embedding-based matching to compare listings across secondary clothing platforms. Also adds price history, drop metrics, seller metadata, non-usd currency support, and dark mode",
    tags: ["Chrome MV3", "JavaScript"],
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
      "Force-directed gallery maps photographs via color-similarity matching.",
    tags: ["Next.js", "D3", "Supabase"],
    renderPreview: (darkMode) => (
      <PhotoGraphCanvas forcedDarkMode={darkMode} fitToCanvas />
    ),
  },
  {
    id: "nepobabiesruntheunderground",
    title: "nepobabiesruntheunderground",
    description:
      "Experimental UI project that layers custom typography, motion, collage imagery, and WebGL textures",
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
