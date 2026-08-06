import { ArrowLeft, ArrowRight, ArrowUpRight } from "lucide-react";

import {
  getAdjacentProjects,
  type ProjectDefinition,
} from "@/app/components/projects/project-catalog";
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
  const { previous, next } = getAdjacentProjects(project.id);
  const previousHref =
    previous.caseStudyHref ?? previous.experienceHref ?? previous.liveHref;
  const nextHref = next.caseStudyHref ?? next.experienceHref ?? next.liveHref;

  return (
    <main className="editorial-page min-h-dvh overflow-x-clip">
      <SiteHeader
        meta={`${project.number} / ${project.title}`}
        ariaLabel={`${project.title} navigation`}
      >
        <a
          href="#overview"
          className="hidden min-h-11 items-center transition-opacity hover:opacity-55 sm:flex"
        >
          Overview
        </a>
        <ActionLink
          href="/#projects"
          variant="quiet"
          size="sm"
          className="border-0 px-1"
        >
          Index
        </ActionLink>
        <ThemeToggle />
      </SiteHeader>

      <section
        id="overview"
        className="mx-auto grid max-w-[96rem] gap-10 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-12 lg:px-12 lg:py-24"
      >
        <div className="lg:col-span-8">
          <Eyebrow className="mb-5">{project.eyebrow}</Eyebrow>
          <h1 className="-ml-[0.04em] max-w-6xl text-[clamp(3.7rem,9vw,9rem)] leading-[0.8] font-black tracking-[-0.06em] [overflow-wrap:anywhere]">
            {project.title}
          </h1>
          <p className="editorial-muted mt-7 max-w-3xl text-lg leading-8 sm:text-xl">
            {project.summary}
          </p>
        </div>

        <dl className="editorial-rule grid content-end border-y my-auto lg:col-span-4">
          {[
            ["Role", project.role],
            ["Date", project.date],
            ["Outcome", project.outcome],
            ["Stack", project.technologies.join(" · ")],
          ].map(([label, value]) => (
            <div
              key={label}
              className="editorial-rule grid grid-cols-[6rem_1fr] gap-4 border-b py-3 last:border-b-0"
            >
              <dt className="text-[0.6875rem] font-semibold tracking-[0.16em] uppercase">
                {label}
              </dt>
              <dd className="editorial-muted text-sm">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mx-auto max-w-[96rem] px-5 sm:px-8 lg:px-12">
        <div className="editorial-rule mb-3 flex items-end justify-between gap-5 border-b pb-3">
          <Eyebrow>Live project view</Eyebrow>
        </div>
        <MediaFrame className="h-[min(70svh,48rem)] min-h-[30rem]">
          <ProjectLivePreview project={project} />
        </MediaFrame>
      </section>

      <section className="editorial-rule mx-auto mt-16 grid max-w-[96rem] gap-10 border-t px-5 py-14 sm:px-8 lg:grid-cols-12 lg:px-12 lg:py-20">
        <div className="lg:col-span-4">
          <Eyebrow>Selected capabilities</Eyebrow>
          <h2 className="mt-4 text-[clamp(2rem,4vw,4rem)] leading-[0.94] font-bold tracking-[-0.04em]">
            What the work does.
          </h2>
        </div>
        <ol className="editorial-rule border-y lg:col-span-8">
          {project.capabilities.map((capability, index) => (
            <li
              key={capability}
              className="editorial-rule grid grid-cols-[3rem_1fr] gap-4 border-b py-4 last:border-b-0"
            >
              <span className="editorial-muted text-xs">
                {(index + 1).toString().padStart(2, "0")}
              </span>
              <span className="text-base font-medium">{capability}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="editorial-rule border-y">
        <div className="mx-auto flex max-w-[96rem] flex-wrap items-center gap-2 px-5 py-8 sm:px-8 lg:px-12">
          {project.experienceHref ? (
            <ActionLink href={project.experienceHref} variant="primary">
              Launch experience
              <ArrowUpRight aria-hidden className="h-4 w-4" />
            </ActionLink>
          ) : null}
          {project.links.map((link) => (
            <ActionLink
              key={`${link.label}-${link.href}`}
              href={link.href}
              target={link.external ? "_blank" : undefined}
              rel={link.external ? "noreferrer" : undefined}
            >
              {link.label}
              {link.external ? (
                <ArrowUpRight aria-hidden className="h-4 w-4" />
              ) : null}
            </ActionLink>
          ))}
        </div>
      </section>

      <nav
        aria-label="Project case studies"
        className="mx-auto grid max-w-[96rem] sm:grid-cols-2"
      >
        {previousHref ? (
          <a
            href={previousHref}
            className="editorial-rule group flex min-h-32 flex-col justify-between border-b px-5 py-5 sm:border-r sm:border-b-0 sm:px-8 lg:px-12"
          >
            <span className="flex items-center gap-2 text-xs font-semibold tracking-[0.16em] uppercase">
              <ArrowLeft
                aria-hidden
                className="h-4 w-4 transition-transform group-hover:-translate-x-1"
              />
              Previous
            </span>
            <span className="mt-6 text-2xl font-bold [overflow-wrap:anywhere]">
              {previous.title}
            </span>
          </a>
        ) : (
          <div className="editorial-rule flex min-h-32 flex-col justify-between border-b px-5 py-5 sm:border-r sm:border-b-0 sm:px-8 lg:px-12">
            <span className="flex items-center gap-2 text-xs font-semibold tracking-[0.16em] uppercase opacity-45">
              <ArrowLeft aria-hidden className="h-4 w-4" />
              Previous
            </span>
            <span className="mt-6 text-2xl font-bold [overflow-wrap:anywhere] opacity-75">
              {previous.title}
            </span>
          </div>
        )}
        {nextHref ? (
          <a
            href={nextHref}
            className="group flex min-h-32 flex-col items-end justify-between px-5 py-5 text-right sm:px-8 lg:px-12"
          >
            <span className="flex items-center gap-2 text-xs font-semibold tracking-[0.16em] uppercase">
              Next
              <ArrowRight
                aria-hidden
                className="h-4 w-4 transition-transform group-hover:translate-x-1"
              />
            </span>
            <span className="mt-6 text-2xl font-bold [overflow-wrap:anywhere]">
              {next.title}
            </span>
          </a>
        ) : (
          <div className="flex min-h-32 flex-col items-end justify-between px-5 py-5 text-right sm:px-8 lg:px-12">
            <span className="flex items-center gap-2 text-xs font-semibold tracking-[0.16em] uppercase opacity-45">
              Next
              <ArrowRight aria-hidden className="h-4 w-4" />
            </span>
            <span className="mt-6 text-2xl font-bold [overflow-wrap:anywhere] opacity-75">
              {next.title}
            </span>
          </div>
        )}
      </nav>
    </main>
  );
}
