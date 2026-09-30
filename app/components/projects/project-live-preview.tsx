"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
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
  keepMounted?: boolean;
};

type ProjectPreviewRendererProps = {
  compact: boolean;
  keepMounted: boolean;
};

type ProjectPreviewRenderer = (props: ProjectPreviewRendererProps) => ReactNode;

const PROJECT_PREVIEW_RENDERERS: Record<ProjectId, ProjectPreviewRenderer> = {
  bur1alrites: () => (
    <HtmlProjectPreview
      title="bur1alrites"
      previewSrc={PROJECT_ROUTES.bur1alritesLive}
      projectHref={PROJECT_ROUTES.bur1alritesLive}
      desktopPreviewScale={0.8}
      mobilePreviewScale={0.75}
      showNavigation={false}
    />
  ),
  "grailed-plus": ({ keepMounted }) => (
    <GrailedPlusPreview keepMounted={keepMounted} />
  ),
  "photo-graph": () => (
    <PhotoGraphCanvas fitToCanvas showNavigation={false} showControls={false} />
  ),
  nepobabiesruntheunderground: () => (
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
      mobilePreviewScale={0.75}
      showNavigation={false}
    />
  ),
};

export default function ProjectLivePreview({
  project,
  className,
  compact = false,
  keepMounted = false,
}: ProjectLivePreviewProps) {
  const fullHref =
    project.experienceHref ?? project.liveHref ?? project.caseStudyHref;
  const linkPhotoGraph = project.previewKind === "photo-graph" && !compact;

  return (
    <div
      className={cn(
        "relative size-full min-h-0 overflow-hidden bg-surface",
        className,
      )}
    >
      <div
        className="size-full"
        inert={linkPhotoGraph}
        aria-hidden={linkPhotoGraph}
      >
        {renderProjectPreview(project.id, compact, keepMounted)}
      </div>
      {linkPhotoGraph && fullHref ? (
        <Link
          href={fullHref}
          aria-label={`Open the full ${project.title} experience`}
          className="absolute inset-0 z-20 cursor-pointer touch-pan-y focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink"
        >
          <span className="sr-only">
            Open the full {project.title} experience
          </span>
        </Link>
      ) : null}
    </div>
  );
}

function renderProjectPreview(
  projectId: ProjectId,
  compact: boolean,
  keepMounted: boolean,
) {
  const renderer = PROJECT_PREVIEW_RENDERERS[projectId];

  return renderer?.({ compact, keepMounted });
}
