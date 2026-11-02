"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import type { ReactNode } from "react";

import {
  getProject,
  getProjectHref,
  type ProjectDefinition,
  type ProjectId,
} from "@/app/components/projects/project-catalog";
import { PROJECT_ROUTES } from "@/app/components/projects/project-routes";
import { cn } from "@/lib/cn";
import ProjectPreviewControls from "./project-preview-controls";

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
  showControls?: boolean;
};

type ProjectPreviewRendererProps = {
  compact: boolean;
  keepMounted: boolean;
};

type ProjectPreviewRenderer = (props: ProjectPreviewRendererProps) => ReactNode;

const elliotMairet = getProject("elliotmairet");

function StaticProjectPreview({ projectId }: { projectId: ProjectId }) {
  const project = getProject(projectId);

  return (
    <Image
      src={project.posterSrc}
      alt={project.posterAlt}
      fill
      sizes="(min-width: 1024px) 75vw, 100vw"
      className="object-contain"
    />
  );
}

const PROJECT_PREVIEW_RENDERERS: Record<ProjectId, ProjectPreviewRenderer> = {
  "portfolio-design": () => (
    <StaticProjectPreview projectId="portfolio-design" />
  ),
  "tvm-discord-bot": () => <StaticProjectPreview projectId="tvm-discord-bot" />,
  "bot-or-not": () => <StaticProjectPreview projectId="bot-or-not" />,
  bur1alrites: () => (
    <HtmlProjectPreview
      title="bur1alrites"
      previewSrc={PROJECT_ROUTES.bur1alritesLive}
      projectHref={PROJECT_ROUTES.bur1alritesLive}
      desktopPreviewScale={0.8}
      mobilePreviewScale={0.75}
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
    />
  ),
  elliotmairet: () => (
    <HtmlProjectPreview
      title={elliotMairet.title}
      previewSrc={elliotMairet.liveHref!}
      projectHref={elliotMairet.liveHref!}
      desktopPreviewScale={elliotMairet.previewScale}
      mobilePreviewScale={elliotMairet.previewScale}
    />
  ),
};

export default function ProjectLivePreview({
  project,
  className,
  compact = false,
  keepMounted = false,
  showControls = false,
}: ProjectLivePreviewProps) {
  return (
    <div
      className={cn(
        "relative flex size-full min-h-0 flex-col overflow-hidden bg-surface",
        className,
      )}
    >
      {/* Photo Graph handles dragging, zooming, and inspection in the preview.
          Other previews keep their own click-to-open navigation. */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {renderProjectPreview(project.id, compact, keepMounted)}
      </div>
      {showControls && !compact ? (
        <ProjectPreviewControls
          title={project.title}
          href={
            project.experienceHref ??
            project.liveHref ??
            getProjectHref(project)
          }
        />
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
