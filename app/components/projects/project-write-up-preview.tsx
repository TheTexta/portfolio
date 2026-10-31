"use client";

import dynamic from "next/dynamic";

import {
  getProject,
  type ProjectId,
} from "@/app/components/projects/project-catalog";
import HtmlProjectPreview from "@/app/components/projects/html-project-preview";

const PhotoGraphCanvas = dynamic(
  () => import("@/app/components/projects/photo-graph/PhotoGraphCanvas"),
  { ssr: false },
);

export default function WriteUpProjectPreview({
  projectId,
}: {
  projectId: ProjectId;
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
      className="relative my-10 h-[clamp(20rem,50svh,32rem)] overflow-hidden border border-ink bg-canvas [&_p]:m-0"
    >
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
          showNavigation={false}
        />
      ) : null}
    </div>
  );
}
