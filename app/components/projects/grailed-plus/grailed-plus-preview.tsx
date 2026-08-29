"use client";

import { useEffect, useRef, useState } from "react";

import { PROJECT_ROUTES } from "@/app/components/projects/project-routes";
import { cn } from "@/lib/cn";

type GrailedPlusPreviewProps = {
  className?: string;
};

const GRAILED_PLUS_HERO_PREVIEW_ROUTE =
  `${PROJECT_ROUTES.grailedPlus}?view=hero`;
const DESKTOP_PREVIEW_WIDTH = 1280;
const SCROLLBAR_GUTTER = 20;

export default function GrailedPlusPreview({
  className,
}: GrailedPlusPreviewProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const frame = frameRef.current;

    if (!frame) {
      return;
    }

    const updateFrameSize = () => {
      const { width, height } = frame.getBoundingClientRect();

      setFrameSize((currentSize) =>
        currentSize.width === width && currentSize.height === height
          ? currentSize
          : { width, height },
      );
    };

    updateFrameSize();

    const resizeObserver = new ResizeObserver(updateFrameSize);
    resizeObserver.observe(frame);

    return () => resizeObserver.disconnect();
  }, []);

  const previewScale = frameSize.width / DESKTOP_PREVIEW_WIDTH;
  const hasMeasuredFrame = previewScale > 0;

  return (
    <div
      ref={frameRef}
      className={cn(
        "bg-canvas relative h-full w-full overflow-hidden",
        className,
      )}
    >
      <iframe
        src={GRAILED_PLUS_HERO_PREVIEW_ROUTE}
        title="Grailed Plus product hero preview"
        loading="lazy"
        referrerPolicy="strict-origin"
        scrolling="auto"
        className="bg-canvas absolute top-0 left-0 block border-0"
        style={
          hasMeasuredFrame
            ? {
                width: `${DESKTOP_PREVIEW_WIDTH + SCROLLBAR_GUTTER}px`,
                height: `${frameSize.height / previewScale}px`,
                transform: `scale(${previewScale})`,
                transformOrigin: "top left",
              }
            : {
                height: "100%",
                visibility: "hidden",
                width: "calc(100% + 1.25rem)",
              }
        }
      />
    </div>
  );
}
