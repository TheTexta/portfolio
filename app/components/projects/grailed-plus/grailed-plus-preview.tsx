"use client";

import { useRef } from "react";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { PROJECT_ROUTES } from "@/app/components/projects/project-routes";
import { actionStyles, Eyebrow } from "@/app/components/ui/editorial";
import { useElementSize } from "@/app/hooks/use-element-size";
import { useIframeOpenOnClick } from "@/app/hooks/use-iframe-open-on-click";
import { cn } from "@/lib/cn";

type GrailedPlusPreviewProps = {
  className?: string;
  keepMounted?: boolean;
};

const GRAILED_PLUS_HERO_PREVIEW_ROUTE = `${PROJECT_ROUTES.grailedPlus}?view=hero`;
const DESKTOP_PREVIEW_WIDTH = 1280;
const NARROW_PREVIEW_BREAKPOINT = 640;

export default function GrailedPlusPreview({
  className,
  keepMounted = false,
}: GrailedPlusPreviewProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const iframeClick = useIframeOpenOnClick(
    iframeRef,
    PROJECT_ROUTES.grailedPlus,
    GRAILED_PLUS_HERO_PREVIEW_ROUTE,
  );
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
        <Link
          aria-label="Open the full Grailed Plus site"
          href={PROJECT_ROUTES.grailedPlus}
          className="flex h-full min-h-64 flex-col justify-between gap-10 p-5 sm:p-8"
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
          <span
            className={cn(
              actionStyles({ size: "lg", variant: "primary" }),
              "w-full sm:w-fit",
            )}
          >
            Open Grailed Plus
            <ArrowUpRight aria-hidden className="size-4" strokeWidth={1.75} />
          </span>
        </Link>
      ) : null}
      {(!isNarrowFrame || keepMounted) && (
        <iframe
          ref={iframeRef}
          src={GRAILED_PLUS_HERO_PREVIEW_ROUTE}
          title="Grailed Plus product hero preview"
          loading="lazy"
          referrerPolicy="strict-origin"
          scrolling="auto"
          aria-hidden={isNarrowFrame}
          inert={isNarrowFrame}
          tabIndex={isNarrowFrame ? -1 : undefined}
          onPointerEnter={iframeClick.onPointerEnter}
          onPointerLeave={iframeClick.onPointerLeave}
          onMouseEnter={iframeClick.onMouseEnter}
          onMouseLeave={iframeClick.onMouseLeave}
          onLoad={iframeClick.onLoad}
          className={cn(
            "absolute top-0 left-0 block border-0 bg-canvas",
            isNarrowFrame && "invisible",
          )}
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
