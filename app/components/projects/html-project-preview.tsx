import { cva } from "class-variance-authority";
import ExperienceNav from "@/app/components/ui/experience-nav";
import { cn } from "@/lib/cn";

type HtmlProjectPreviewProps = {
  title: string;
  previewSrc: string;
  projectHref: string;
  showNavigation?: boolean;
};

const htmlPreviewShell = cva("relative h-full w-full overflow-hidden");
const htmlPreviewFrame = cva(
  "absolute inset-0 h-full w-full border-0 bg-neutral-950",
);
const htmlPreviewShellTone = "bg-neutral-950 text-neutral-100";

export default function HtmlProjectPreview({
  title,
  previewSrc,
  projectHref,
  showNavigation = true,
}: HtmlProjectPreviewProps) {
  return (
    <div className={cn(htmlPreviewShell(), htmlPreviewShellTone)}>
      <iframe
        title={`${title} preview`}
        src={previewSrc}
        loading="lazy"
        scrolling="auto"
        className={htmlPreviewFrame()}
      />

      {showNavigation ? (
        <ExperienceNav
          experienceHref={projectHref}
          ariaLabel={`${title} controls`}
        />
      ) : null}
    </div>
  );
}
