import type { ReactNode } from "react";
import HtmlProjectPreview from "@/app/components/projects/html-project-preview";
import GrailedPlusPreview from "@/app/components/projects/grailed-plus/grailed-plus-preview";
import PhotoGraphCanvas from "@/app/components/projects/photo-graph/PhotoGraphCanvas";
import { PROJECT_ROUTES } from "./project-routes";

export type ProjectDefinition = {
  id: string;
  title: string;
  description: string;
  tags: string[];
  renderPreview: (darkMode: boolean) => ReactNode;
};

export const projectCatalog: ProjectDefinition[] = [
  {
    id: "photo-graph",
    title: "Node based Photo Gallery",
    description:
      "Interactive force-directed image graph where photographs dynamically cluster based on color similarity; an evolving canvas shaped by user interaction.",
    tags: ["Next.js", "D3", "Firebase"],
    renderPreview: (darkMode) => <PhotoGraphCanvas forcedDarkMode={darkMode} />,
  },
  {
    id: "grailed-plus",
    title: "Grailed Plus (V2)",
    description:
      "Browser extension that introduces price history, drop metrics, seller metadata, custom currency conversion, and site-wide dark mode controls.",
    tags: ["Browser Extension", "Chrome MV3", "Firefox MV3", "JavaScript"],
    renderPreview: (darkMode) => (
      <GrailedPlusPreview forcedDarkMode={darkMode} />
    ),
  },
  {
    id: "nepobabiesruntheunderground",
    title: "nepobabiesruntheunderground",
    description:
      "Creative visual UI project blending custom typography, layered motion, collage imagery, and WebGL textures into an experimental digital world.",
    tags: ["HTML", "CSS", "JavaScript", "WebGL"],
    renderPreview: () => (
      <HtmlProjectPreview
        title="nepobabiesruntheunderground"
        previewSrc={PROJECT_ROUTES.nepobabiesPreview}
        projectHref={PROJECT_ROUTES.nepobabies}
      />
    ),
  },
];
