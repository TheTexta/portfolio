import { cva } from "class-variance-authority";
import { PROJECT_ROUTES } from "@/app/components/projects/project-routes";
import OverlayNavBar from "@/app/components/ui/overlay-nav-bar";
import { cn } from "@/lib/cn";

type HtmlProjectPreviewProps = {
  title: string;
  previewSrc: string;
  projectHref: string;
  exitHref?: string;
  isFullPage?: boolean;
};

const htmlPreviewShell = cva(
  "relative h-full w-full overflow-hidden rounded-[inherit]",
);
const htmlPreviewFrame = cva(
  "absolute inset-0 h-full w-full border-0 bg-neutral-950",
);
const htmlPreviewShellTone = "bg-neutral-950 text-overlay-ink";

export default function HtmlProjectPreview({
  title,
  previewSrc,
  projectHref,
  exitHref = PROJECT_ROUTES.home,
  isFullPage = false,
}: HtmlProjectPreviewProps) {
  return (
    <div className={cn(htmlPreviewShell(), htmlPreviewShellTone)}>
      <iframe
        title={`${title} preview`}
        src={previewSrc}
        loading={isFullPage ? "eager" : "lazy"}
        className={htmlPreviewFrame()}
      />

      <OverlayNavBar
        expandHref={isFullPage ? undefined : projectHref}
        exitHref={isFullPage ? exitHref : undefined}
        ariaLabel={`${title} controls`}
      />
    </div>
  );
}
