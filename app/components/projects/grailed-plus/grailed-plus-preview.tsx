"use client";

import { useRef } from "react";
import { ArrowUpRight } from "lucide-react";

import { PROJECT_ROUTES } from "@/app/components/projects/project-routes";
import { ActionLink, Eyebrow } from "@/app/components/ui/editorial";
import { useElementSize } from "@/app/hooks/use-element-size";
import { cn } from "@/lib/cn";

type GrailedPlusPreviewProps = {
  className?: string;
};

const GRAILED_PLUS_HERO_PREVIEW_ROUTE = `${PROJECT_ROUTES.grailedPlus}?view=hero`;
const DESKTOP_PREVIEW_WIDTH = 1280;
const NARROW_PREVIEW_BREAKPOINT = 640;

export default function GrailedPlusPreview({
  className,
}: GrailedPlusPreviewProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const frameSize = useElementSize(frameRef);

  const previewScale = frameSize.width / DESKTOP_PREVIEW_WIDTH;
  const hasMeasuredFrame = previewScale > 0;
  const isNarrowFrame =
    hasMeasuredFrame && frameSize.width < NARROW_PREVIEW_BREAKPOINT;

  return (
    <div
      ref={frameRef}
      className={cn("relative size-full overflow-hidden bg-canvas", className)}
    >
      {isNarrowFrame ? (
        <div
          aria-labelledby="grailed-plus-preview-title"
          className="flex h-full min-h-64 flex-col justify-between gap-10 p-5 sm:p-8"
          role="region"
        >
          <div>
            <Eyebrow className="text-muted">Grailed Plus</Eyebrow>
            <h2
              id="grailed-plus-preview-title"
              className="mt-5 max-w-sm text-4xl leading-[0.9] font-bold tracking-[-0.045em]"
            >
              Desktop experience.
            </h2>
            <p className="mt-5 max-w-sm text-sm leading-6 text-muted">
              This interactive preview is designed for a wider screen.
            </p>
          </div>
          <ActionLink
            href={GRAILED_PLUS_HERO_PREVIEW_ROUTE}
            size="lg"
            variant="primary"
            className="w-full sm:w-fit"
          >
            Open desktop demo
            <ArrowUpRight aria-hidden className="size-4" strokeWidth={1.75} />
          </ActionLink>
        </div>
      ) : (
        <iframe
          src={GRAILED_PLUS_HERO_PREVIEW_ROUTE}
          title="Grailed Plus product hero preview"
          loading="lazy"
          referrerPolicy="strict-origin"
          scrolling="auto"
          className="absolute top-0 left-0 block border-0 bg-canvas"
          style={
            hasMeasuredFrame
              ? {
                  width: `${DESKTOP_PREVIEW_WIDTH}px`,
                  height: `${frameSize.height / previewScale}px`,
                  transform: `scale(${previewScale})`,
                  transformOrigin: "top left",
                }
              : {
                  height: "100%",
                  visibility: "hidden",
                  width: "100%",
                }
          }
        />
      )}
    </div>
  );
}
