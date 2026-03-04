import { getProjectChrome } from "@/app/components/projects/project-chrome";
import { PROJECT_ROUTES } from "@/app/components/projects/project-routes";
import OverlayNavBar from "@/app/components/ui/overlay-nav-bar";

type HtmlProjectPreviewProps = {
  title: string;
  previewSrc: string;
  projectHref: string;
  exitHref?: string;
  isFullPage?: boolean;
};

export default function HtmlProjectPreview({
  title,
  previewSrc,
  projectHref,
  exitHref = PROJECT_ROUTES.home,
  isFullPage = false,
}: HtmlProjectPreviewProps) {
  const chrome = getProjectChrome("html-preview", true);

  return (
    <div
      className={`relative h-full w-full overflow-hidden rounded-[inherit] ${chrome.shell}`}
    >
      <iframe
        title={`${title} preview`}
        src={previewSrc}
        loading={isFullPage ? "eager" : "lazy"}
        className="absolute inset-0 h-full w-full border-0 bg-white"
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
