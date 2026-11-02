import ProjectBrowser from "@/app/components/projects/project-browser";
import {
  BorderContainer,
  BORDER_CONTAINER_TEXT_SCALE_CLASS,
} from "@/app/components/ui/editorial";
import ThemeToggle from "@/app/components/ui/theme-toggle";
import { SITE_PROFILE } from "@/lib/site-config";
import { cn } from "@/lib/cn";

export function PortfolioFrameExample() {
  return (
    <figure
      aria-label="Portfolio frame example"
      data-write-up-preview
      className="my-10"
    >
      <div className="mb-4 hidden justify-end text-xs font-semibold tracking-[0.12em] sm:flex">
        <ThemeToggle />
      </div>
      <BorderContainer className="h-auto min-h-44 grid-rows-[minmax(1.5rem,1fr)_auto_minmax(1.5rem,1fr)] sm:min-h-56">
        <span
          className={cn(
            BORDER_CONTAINER_TEXT_SCALE_CLASS,
            "block px-3 py-4 text-center font-display leading-tight font-semibold tracking-[-0.025em] text-balance sm:px-4 sm:py-5",
          )}
        >
          {SITE_PROFILE.name}
        </span>
      </BorderContainer>
      <figcaption className="mt-4 text-[0.8125rem] leading-[1.6] text-muted">
        The site’s animated frame, with its desktop theme control.
      </figcaption>
    </figure>
  );
}

export function PortfolioBrowserExample() {
  return (
    <figure
      aria-label="Portfolio browser example"
      data-write-up-preview
      className="my-10"
    >
      <ProjectBrowser embedded />
      <figcaption className="mt-4 text-[0.8125rem] leading-[1.6] text-muted">
        The live project browser. Open a project, use the arrow keys, then
        Escape to return. Its state stays inside this example.
      </figcaption>
    </figure>
  );
}
