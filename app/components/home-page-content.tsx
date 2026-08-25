"use client";

import { useState } from "react";

import ProjectBrowser from "@/app/components/projects/project-browser";
import {
  getProject,
  type ProjectId,
} from "@/app/components/projects/project-catalog";
import { PROJECT_ROUTES } from "@/app/components/projects/project-routes";
import { EditorialContainer, SiteHeader } from "@/app/components/ui/editorial";
import HeaderDirectory, {
  type HeaderDirectorySegment,
} from "@/app/components/ui/header-directory";
import ThemeToggle from "@/app/components/ui/theme-toggle";

function getFocusedDirectorySegments(
  projectId: ProjectId,
): HeaderDirectorySegment[] {
  const project = getProject(projectId);
  const projectHref =
    project.caseStudyHref ??
    project.experienceHref ??
    project.liveHref ??
    PROJECT_ROUTES.portfolioProjects;

  return [
    { label: "portfolio", href: PROJECT_ROUTES.home },
    { label: "projects", href: PROJECT_ROUTES.portfolioProjects },
    { label: project.id, href: projectHref },
  ];
}

export default function HomePageContent() {
  const [focusedProjectId, setFocusedProjectId] = useState<ProjectId | null>(
    null,
  );

  return (
    <main className="editorial-page min-h-dvh overflow-x-clip">
      <SiteHeader
        directory={
          focusedProjectId ? (
            <HeaderDirectory
              segments={getFocusedDirectorySegments(focusedProjectId)}
            />
          ) : undefined
        }
      >
        <a
          href="#contact"
          className="hidden min-h-7 items-center transition-opacity hover:opacity-55 sm:flex"
        >
          Contact
        </a>
        <ThemeToggle />
      </SiteHeader>

      <section>
        <EditorialContainer className="grid py-10 sm:py-12 lg:grid-cols-12 lg:py-14">
          <div className="lg:col-span-9">
            <p className="mb-3 flex items-center gap-3 text-[0.6875rem] font-semibold tracking-[0.18em] uppercase">
              <span aria-hidden className="h-px w-8 bg-current" />
              Software + multimedia
            </p>
            <h1 className="-ml-[0.035em] text-[clamp(3.25rem,7vw,6.5rem)] leading-[0.84] font-semibold tracking-[-0.05em]">
              Dexter Young.
            </h1>
            <p className="editorial-muted mt-4 max-w-3xl text-[clamp(1rem,1.6vw,1.25rem)] leading-7">
              browser extensions, interactive image systems, and multimedia webworks
            </p>
          </div>
        </EditorialContainer>
      </section>

      <ProjectBrowser onFocusChange={setFocusedProjectId} />

      <footer
        id="contact"
        className="editorial-rule mt-8 scroll-mt-12 border-t sm:mt-12"
      >
        <EditorialContainer className="grid gap-6 py-8 sm:py-10 lg:grid-cols-12 lg:py-12">
          <div className="lg:col-span-8">
            <p className="text-[0.6875rem] font-semibold tracking-[0.18em] uppercase">
              Get in touch
            </p>
            <h2 className="mt-3 text-[clamp(2rem,4vw,4.25rem)] leading-[0.9] font-semibold tracking-[-0.045em]">
              Personal Information
            </h2>
          </div>
          <ul className="editorial-rule divide-y divide-[rgb(var(--color-rule))] border-y lg:col-span-4">
            {[
              ["GitHub", "https://github.com/TheTexta", "@TheTexta"],
              ["LinkedIn", "https://www.linkedin.com/in/dexter-y", "dexter-y"],
              ["Email", "mailto:dextery777@gmail.com", "dextery777@gmail.com"],
            ].map(([label, href, value]) => (
              <li key={label}>
                <a
                  href={href}
                  className="flex min-h-12 items-center justify-between py-2 text-sm transition-opacity hover:opacity-55"
                >
                  <span className="font-semibold tracking-[0.12em] uppercase">
                    {label}
                  </span>
                  <span className="editorial-muted ml-auto truncate">
                    {value}
                  </span>
                </a>
              </li>
            ))}
            <li>
              <a
                href="/Dexter%20Young%20Resume.pdf"
                download="Dexter Young Resume.pdf"
                className="flex min-h-12 items-center justify-between py-2 text-sm transition-opacity hover:opacity-55"
              >
                <span className="font-semibold tracking-[0.12em] uppercase">
                  Resume
                </span>
                <span className="editorial-muted ml-auto truncate">
                  Download PDF
                </span>
              </a>
            </li>
          </ul>
        </EditorialContainer>
      </footer>
    </main>
  );
}
