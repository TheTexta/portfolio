import type { ReactNode } from "react";
import HtmlProjectPreview from "@/app/components/projects/html-project-preview";
import PhotoGraphCanvas from "@/app/components/projects/photo-graph/PhotoGraphCanvas";
import SpotifyNodify from "@/app/components/projects/spotify-nodify/spotify-nodify";
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
    id: "nepobabiesruntheunderground",
    title: "nepobabiesruntheunderground",
    description:
      "Legacy multimedia web piece embedded as a live HTML preview, with its original CSS, JavaScript, shaders, and image assets preserved.",
    tags: ["HTML", "CSS", "JavaScript", "WebGL"],
    renderPreview: () => (
      <HtmlProjectPreview
        title="nepobabiesruntheunderground"
        previewSrc={PROJECT_ROUTES.nepobabiesPreview}
        projectHref={PROJECT_ROUTES.nepobabies}
      />
    ),
  },
  {
    id: "spotify-nodify",
    title: "spotify-nodify",
    description:
      "Spotify authorization demo that turns your account into a live project preview, with profile data, top tracks, and an expandable dark-mode UI.",
    tags: ["Next.js", "Spotify API", "OAuth"],
    renderPreview: (darkMode) => <SpotifyNodify forcedDarkMode={darkMode} />,
  },
];
