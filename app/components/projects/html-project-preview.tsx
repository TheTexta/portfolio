"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import ExperienceNav from "@/app/components/ui/experience-nav";
import { useElementSize } from "@/app/hooks/use-element-size";
import { useIframeOpenOnClick } from "@/app/hooks/use-iframe-open-on-click";
import { cn } from "@/lib/cn";

type HtmlProjectPreviewProps = {
  title: string;
  previewSrc: string;
  projectHref: string;
  desktopPreviewScale?: number;
  mobilePreviewScale?: number;
  showNavigation?: boolean;
  interaction?: "launch" | "native";
  allowPointerLock?: boolean;
  allowAutoplay?: boolean;
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

function subscribeToCompactPreview(callback: () => void) {
  const query = window.matchMedia(COMPACT_PREVIEW_QUERY);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function getCompactPreview() {
  return window.matchMedia(COMPACT_PREVIEW_QUERY).matches;
}

function getServerCompactPreview() {
  return false;
}

export default function HtmlProjectPreview({
  title,
  previewSrc,
  projectHref,
  desktopPreviewScale = 1,
  mobilePreviewScale = 1,
  showNavigation = true,
  interaction = "launch",
  allowPointerLock = false,
  allowAutoplay = false,
}: HtmlProjectPreviewProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const iframeClick = useIframeOpenOnClick(
    iframeRef,
    projectHref,
    previewSrc,
    interaction === "launch",
  );
  const shellSize = useElementSize(shellRef);
  const [previewState, setPreviewState] = useState<PreviewState>({
    src: previewSrc,
    status: "loading",
  });
  const currentStatus =
    previewState.src === previewSrc ? previewState.status : "loading";
  const isMeasured = shellSize.width > 0 && shellSize.height > 0;
  const isCompact = useSyncExternalStore(
    subscribeToCompactPreview,
    getCompactPreview,
    getServerCompactPreview,
  );
  const previewScale = isCompact ? mobilePreviewScale : desktopPreviewScale;
  const previewWidth = isMeasured ? shellSize.width / previewScale : 0;
  const previewHeight = isMeasured ? shellSize.height / previewScale : 0;

  return (
    <div ref={shellRef} className={cn(htmlPreviewShell, htmlPreviewShellTone)}>
      {currentStatus === "error" ? (
        <div
          role="alert"
          className="relative flex h-full flex-col items-center justify-center gap-3 px-6 text-center"
        >
          <p className="text-sm">This preview is unavailable right now.</p>
          <span className="border border-ink bg-canvas px-3 py-2 text-xs font-semibold tracking-[0.08em] text-ink uppercase">
            Open {title}
          </span>
          <a
            href={projectHref}
            aria-label={`Open the full ${title} site`}
            className="absolute inset-0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink"
          />
        </div>
      ) : (
        <iframe
          ref={iframeRef}
          title={`${title} preview`}
          src={previewSrc}
          loading="lazy"
          scrolling="auto"
          // With no portfolio referrer, the hosted site's click-to-launch
          // bridge stays inactive and its native controls/navigation work.
          referrerPolicy={interaction === "native" ? "no-referrer" : undefined}
          sandbox={`allow-forms allow-popups allow-same-origin allow-scripts${allowPointerLock ? " allow-pointer-lock" : ""}`}
          allow={allowAutoplay ? "autoplay" : undefined}
          onPointerEnter={iframeClick.onPointerEnter}
          onPointerLeave={iframeClick.onPointerLeave}
          onMouseEnter={iframeClick.onMouseEnter}
          onMouseLeave={iframeClick.onMouseLeave}
          className={cn(htmlPreviewFrame, !isMeasured && "invisible")}
          style={{
            width: previewWidth,
            height: previewHeight,
            transform: `scale(${previewScale})`,
          }}
          onLoad={() => {
            iframeClick.onLoad();
            setPreviewState({ src: previewSrc, status: "loaded" });
          }}
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
