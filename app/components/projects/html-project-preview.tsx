import { cva } from "class-variance-authority";
import { getProjectChrome } from "@/app/components/projects/project-chrome";
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
  "absolute inset-0 h-full w-full border-0 bg-white",
);

export default function HtmlProjectPreview({
  title,
  previewSrc,
  projectHref,
  exitHref = PROJECT_ROUTES.home,
  isFullPage = false,
}: HtmlProjectPreviewProps) {
  const chrome = getProjectChrome("html-preview", true);

  return (
    <div className={cn(htmlPreviewShell(), chrome.shell)}>
      <iframe
        title={`${title} preview`}
        src={previewSrc}
        loading={isFullPage ? "eager" : "lazy"}
        className={htmlPreviewFrame()}
      />

      <OverlayNavBar
        toneClass={chrome.overlay}
        expandHref={isFullPage ? undefined : projectHref}
        exitHref={isFullPage ? exitHref : undefined}
        ariaLabel={`${title} controls`}
      />
    </div>
  );
}
