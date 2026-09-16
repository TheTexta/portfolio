"use client";

import { useRef, useState } from "react";
import ExperienceNav from "@/app/components/ui/experience-nav";
import { useElementSize } from "@/app/hooks/use-element-size";
import { cn } from "@/lib/cn";

type HtmlProjectPreviewProps = {
  title: string;
  previewSrc: string;
  projectHref: string;
  mobilePreviewScale?: number;
  showNavigation?: boolean;
};

type PreviewState = {
  src: string;
  status: "loading" | "loaded" | "error";
};

const htmlPreviewShell = "relative size-full overflow-hidden";
const htmlPreviewFrame =
  "absolute top-0 left-0 block origin-top-left border-0 bg-neutral-950";
const htmlPreviewShellTone = "bg-neutral-950 text-neutral-100";
const COMPACT_PREVIEW_QUERY =
  "(max-width: 767px), (orientation: landscape) and (max-width: 1023px) and (max-height: 500px)";

export default function HtmlProjectPreview({
  title,
  previewSrc,
  projectHref,
  mobilePreviewScale = 1,
  showNavigation = true,
}: HtmlProjectPreviewProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const shellSize = useElementSize(shellRef);
  const [previewState, setPreviewState] = useState<PreviewState>({
    src: previewSrc,
    status: "loading",
  });
  const currentStatus =
    previewState.src === previewSrc ? previewState.status : "loading";
  const hasMobileScale = mobilePreviewScale > 0 && mobilePreviewScale < 1;
  const isMeasured = shellSize.width > 0 && shellSize.height > 0;
  const previewScale =
    hasMobileScale &&
    typeof window !== "undefined" &&
    window.matchMedia(COMPACT_PREVIEW_QUERY).matches
      ? mobilePreviewScale
      : 1;
  const previewWidth = isMeasured ? shellSize.width / previewScale : 0;
  const previewHeight = isMeasured ? shellSize.height / previewScale : 0;

  return (
    <div ref={shellRef} className={cn(htmlPreviewShell, htmlPreviewShellTone)}>
      {currentStatus === "error" ? (
        <div
          role="alert"
          className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center"
        >
          <p className="text-sm">This preview is unavailable right now.</p>
          <a
            href={projectHref}
            className="border border-ink bg-canvas px-3 py-2 text-xs font-semibold tracking-[0.08em] text-ink uppercase outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Open {title}
          </a>
        </div>
      ) : (
        <iframe
          title={`${title} preview`}
          src={previewSrc}
          loading="lazy"
          scrolling="auto"
          sandbox="allow-forms allow-popups allow-same-origin allow-scripts"
          className={cn(htmlPreviewFrame, !isMeasured && "invisible")}
          style={{
            width: previewWidth,
            height: previewHeight,
            transform: `scale(${previewScale})`,
          }}
          onLoad={() => setPreviewState({ src: previewSrc, status: "loaded" })}
          onError={() => setPreviewState({ src: previewSrc, status: "error" })}
        />
      )}

      {showNavigation ? (
        <ExperienceNav
          experienceHref={projectHref}
          ariaLabel={`${title} controls`}
        />
      ) : null}
    </div>
  );
}
