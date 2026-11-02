"use client";

import dynamic from "next/dynamic";

import {
  getProject,
  type ProjectId,
} from "@/app/components/projects/project-catalog";
import HtmlProjectPreview from "@/app/components/projects/html-project-preview";
import ProjectPreviewControls from "./project-preview-controls";

const PhotoGraphCanvas = dynamic(
  () => import("@/app/components/projects/photo-graph/PhotoGraphCanvas"),
  { ssr: false },
);

export default function WriteUpProjectPreview({
  projectId,
  showControls = true,
}: {
  projectId: ProjectId;
  showControls?: boolean;
}) {
  const project = getProject(projectId);
  const href = project.liveHref ?? project.experienceHref;
  // At full scale the reading column triggers bur1alrites' mobile tap-to-play
  // layout even on desktop, hiding its 3D room navigation.
  const isBur1alrites = projectId === "bur1alrites";

  return (
    <div
      role="region"
      aria-label={`${project.title} interactive preview`}
      data-write-up-preview
      className="relative my-10 flex h-[clamp(20rem,50svh,32rem)] flex-col overflow-hidden border border-ink bg-canvas [&_p]:m-0"
    >
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {project.previewKind === "photo-graph" ? (
          <PhotoGraphCanvas
            fitToCanvas
            showControls={false}
            showNavigation={false}
          />
        ) : href ? (
          <HtmlProjectPreview
            title={project.title}
            previewSrc={href}
            projectHref={href}
            desktopPreviewScale={
              project.previewScale ?? (isBur1alrites ? 0.8 : 1)
            }
            mobilePreviewScale={project.previewScale}
            allowPointerLock={isBur1alrites}
            allowAutoplay={isBur1alrites}
            interaction="native"
          />
        ) : null}
      </div>
      {showControls && href ? (
        <ProjectPreviewControls title={project.title} href={href} />
      ) : null}
    </div>
  );
}
