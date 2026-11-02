"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { useElementSize } from "@/app/hooks/use-element-size";
import { useIframeOpenOnClick } from "@/app/hooks/use-iframe-open-on-click";
import { cn } from "@/lib/cn";

type HtmlProjectPreviewProps = {
  title: string;
  previewSrc: string;
  projectHref: string;
  desktopPreviewScale?: number;
  mobilePreviewScale?: number;
  interaction?: "launch" | "native";
  allowPointerLock?: boolean;
  allowAutoplay?: boolean;
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
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
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
      <iframe
        key={previewSrc}
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
          setFailedSrc(null);
        }}
        onError={() => setFailedSrc(previewSrc)}
      />
      {failedSrc === previewSrc ? (
        <p
          role="status"
          className="absolute bottom-2 left-2 z-10 max-w-[calc(100%-1rem)] bg-canvas px-2 py-1 text-sm text-ink"
        >
          Preview unavailable.
        </p>
      ) : null}
    </div>
  );
}
