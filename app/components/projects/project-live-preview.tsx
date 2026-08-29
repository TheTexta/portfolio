"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";

import type {
  ProjectDefinition,
  ProjectId,
} from "@/app/components/projects/project-catalog";
import { PROJECT_ROUTES } from "@/app/components/projects/project-routes";
import { cn } from "@/lib/cn";

const GrailedPlusPreview = dynamic(
  () => import("@/app/components/projects/grailed-plus/grailed-plus-preview"),
  { ssr: false },
);
const PhotoGraphCanvas = dynamic(
  () => import("@/app/components/projects/photo-graph/PhotoGraphCanvas"),
  { ssr: false },
);
const HtmlProjectPreview = dynamic(
  () => import("@/app/components/projects/html-project-preview"),
  { ssr: false },
);
type ProjectLivePreviewProps = {
  project: ProjectDefinition;
  className?: string;
  compact?: boolean;
};

type ProjectPreviewRendererProps = {
  compact: boolean;
};

type ProjectPreviewRenderer = (
  props: ProjectPreviewRendererProps,
) => ReactNode;

const PROJECT_PREVIEW_RENDERERS: Record<ProjectId, ProjectPreviewRenderer> = {
  bur1alrites: () => (
    <HtmlProjectPreview
      title="bur1alrites"
      previewSrc={PROJECT_ROUTES.bur1alritesLive}
      projectHref={PROJECT_ROUTES.bur1alritesLive}
      showNavigation={false}
    />
  ),
  "grailed-plus": () => <GrailedPlusPreview />,
  "photo-graph": ({ compact }) => (
    <PhotoGraphCanvas
      fitToCanvas
      showNavigation={false}
      showControls={!compact}
    />
  ),
  "nepobabiesruntheunderground": () => (
    <HtmlProjectPreview
      title="nepobabiesruntheunderground"
      previewSrc={PROJECT_ROUTES.nepobabiesPreview}
      projectHref={PROJECT_ROUTES.nepobabiesLive}
      showNavigation={false}
    />
  ),
  elliotmairet: () => (
    <HtmlProjectPreview
      title="Elliot Mairet"
      previewSrc={PROJECT_ROUTES.elliotMairetLive}
      projectHref={PROJECT_ROUTES.elliotMairetLive}
      showNavigation={false}
    />
  ),
  "spotify-nodify": () => null,
};

export default function ProjectLivePreview({
  project,
  className,
  compact = false,
}: ProjectLivePreviewProps) {
  return (
    <div
      className={cn(
        "bg-surface relative h-full min-h-0 w-full overflow-hidden",
        className,
      )}
    >
      {renderProjectPreview(project.id, compact)}
    </div>
  );
}

function renderProjectPreview(
  projectId: ProjectId,
  compact: boolean,
) {
  const renderer = PROJECT_PREVIEW_RENDERERS[projectId];

  return renderer?.({ compact });
}
