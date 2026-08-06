import { ArrowUpRight } from "lucide-react";

import { type ProjectDefinition } from "@/app/components/projects/project-catalog";
import ProjectLivePreview from "@/app/components/projects/project-live-preview";
import {
  ActionLink,
  Eyebrow,
  MediaFrame,
  SiteHeader,
} from "@/app/components/ui/editorial";
import ThemeToggle from "@/app/components/ui/theme-toggle";

export default function ProjectCaseStudyShell({
  project,
}: {
  project: ProjectDefinition;
}) {
  return (
    <main className="editorial-page min-h-dvh overflow-x-clip">
      <SiteHeader
        meta={`${project.number} / ${project.title}`}
        ariaLabel={`${project.title} navigation`}
      >
        <a
          href="#overview"
          className="hidden min-h-7 items-center transition-opacity hover:opacity-55 sm:flex"
        >
          Overview
        </a>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/#projects"
          className="flex min-h-7 items-center transition-opacity hover:opacity-55"
        >
          Index
        </a>
        <ThemeToggle />
      </SiteHeader>

      <section
        id="overview"
        className="mx-auto grid max-w-384 gap-10 px-5 pt-7 sm:px-8 sm:pt-10 lg:grid-cols-12 lg:px-12 lg:pt-12"
      >
        <div className="lg:col-span-8">
          <Eyebrow className="mb-5">{project.eyebrow}</Eyebrow>
          <h1 className="-ml-[0.04em] max-w-6xl text-4xl leading-[0.8] font-black tracking-[-0.06em] [overflow-wrap:anywhere]">
            {project.title}
          </h1>
          <p className="editorial-muted mt-7 max-w-3xl leading-8">
            {project.summary}
          </p>
        </div>

        <div className="flex flex-col gap-3 lg:col-span-4">
          <div className="flex flex-wrap justify-end gap-2 py-1">
            {project.experienceHref ? (
              <ActionLink href={project.experienceHref} variant="primary">
                Launch experience
                <ArrowUpRight aria-hidden className="h-4 w-4" />
              </ActionLink>
            ) : null}
          </div>

          <div className="flex flex-col py-4">
            <div className="text-sm font-semibold uppercase justify-end flex">Stack</div>
            <div className="editorial-muted flex justify-end text-sm">
              {project.technologies.join(" · ")}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[96rem] px-5 sm:px-8 lg:px-12 py-8">
        <MediaFrame className="h-[min(70svh,48rem)] min-h-[30rem]">
          <ProjectLivePreview project={project} />
        </MediaFrame>
      </section>
    </main>
  );
}
