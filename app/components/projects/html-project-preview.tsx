import { type CSSProperties, useState } from "react";
import ExperienceNav from "@/app/components/ui/experience-nav";
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
  "absolute top-0 left-0 h-full origin-top-left border-0 bg-neutral-950 [width:calc(100%+1.25rem)]";
const htmlPreviewShellTone = "bg-neutral-950 text-neutral-100";

export default function HtmlProjectPreview({
  title,
  previewSrc,
  projectHref,
  mobilePreviewScale = 1,
  showNavigation = true,
}: HtmlProjectPreviewProps) {
  const [previewState, setPreviewState] = useState<PreviewState>({
    src: previewSrc,
    status: "loading",
  });
  const currentStatus =
    previewState.src === previewSrc ? previewState.status : "loading";
  const hasMobileScale = mobilePreviewScale > 0 && mobilePreviewScale < 1;
  const mobilePreviewStyle = hasMobileScale
    ? ({
        "--html-preview-mobile-scale": mobilePreviewScale,
        "--html-preview-mobile-width": `${100 / mobilePreviewScale}%`,
        "--html-preview-mobile-height": `${100 / mobilePreviewScale}%`,
      } as CSSProperties)
    : undefined;

  return (
    <div
      className={cn(htmlPreviewShell, htmlPreviewShellTone)}
      style={mobilePreviewStyle}
    >
      {currentStatus === "error" ? (
        <div
          role="alert"
          className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center"
        >
          <p className="text-sm">This preview is unavailable right now.</p>
          <a
            href={projectHref}
            className="border border-rule bg-canvas px-3 py-2 text-xs font-semibold tracking-[0.08em] text-ink uppercase outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
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
          className={cn(
            htmlPreviewFrame,
            hasMobileScale &&
              "max-md:h-[var(--html-preview-mobile-height)] max-md:w-[var(--html-preview-mobile-width)] max-md:scale-[var(--html-preview-mobile-scale)] [@media(orientation:landscape)_and_(max-width:1023px)_and_(max-height:500px)]:h-[var(--html-preview-mobile-height)] [@media(orientation:landscape)_and_(max-width:1023px)_and_(max-height:500px)]:w-[var(--html-preview-mobile-width)] [@media(orientation:landscape)_and_(max-width:1023px)_and_(max-height:500px)]:scale-[var(--html-preview-mobile-scale)]",
          )}
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
