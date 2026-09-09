import { cva } from "class-variance-authority";
import { useState } from "react";
import ExperienceNav from "@/app/components/ui/experience-nav";
import { cn } from "@/lib/cn";

type HtmlProjectPreviewProps = {
  title: string;
  previewSrc: string;
  projectHref: string;
  showNavigation?: boolean;
};

type PreviewState = {
  src: string;
  status: "loading" | "loaded" | "error";
};

const htmlPreviewShell = cva("relative h-full w-full overflow-hidden");
const htmlPreviewFrame = cva(
  "absolute top-0 left-0 h-full w-[calc(100%+1.25rem)] border-0 bg-neutral-950",
);
const htmlPreviewShellTone = "bg-neutral-950 text-neutral-100";

export default function HtmlProjectPreview({
  title,
  previewSrc,
  projectHref,
  showNavigation = true,
}: HtmlProjectPreviewProps) {
  const [previewState, setPreviewState] = useState<PreviewState>({
    src: previewSrc,
    status: "loading",
  });
  const currentStatus =
    previewState.src === previewSrc ? previewState.status : "loading";

  return (
    <div className={cn(htmlPreviewShell(), htmlPreviewShellTone)}>
      {currentStatus === "error" ? (
        <div
          role="alert"
          className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center"
        >
          <p className="text-sm">This preview is unavailable right now.</p>
          <a
            href={projectHref}
            className="border-rule bg-canvas text-ink focus-visible:outline-focus border px-3 py-2 text-xs font-semibold tracking-[0.08em] uppercase outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
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
          className={htmlPreviewFrame()}
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
