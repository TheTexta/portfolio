import ProjectBrowser from "@/app/components/projects/project-browser";
import { BorderContainer } from "@/app/components/ui/editorial";
import ThemeToggle from "@/app/components/ui/theme-toggle";
import { SITE_PROFILE } from "@/lib/site-config";

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
      <BorderContainer className="h-44">
        <span className="block py-6 text-center font-display text-[clamp(1.5rem,4vw,3rem)] leading-none font-semibold tracking-tighter">
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
