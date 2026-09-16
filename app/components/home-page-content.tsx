"use client";

import { useState } from "react";

import ProjectBrowser from "@/app/components/projects/project-browser";
import {
  getProject,
  type ProjectId,
} from "@/app/components/projects/project-catalog";
import { PROJECT_ROUTES } from "@/app/components/projects/project-routes";
import {
  BorderContainer,
  EditorialRuleHeading,
  SiteHeader,
} from "@/app/components/ui/editorial";
import HeaderDirectory, {
  type HeaderDirectorySegment,
} from "@/app/components/ui/header-directory";
import ThemeToggle from "@/app/components/ui/theme-toggle";

function EditorialRule({ children }: { children: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 px-5 sm:px-8 lg:px-12">
      <span aria-hidden className="h-px bg-ink" />
      <p className="text-center text-xs font-semibold tracking-[0.18em] uppercase sm:text-sm">
        {children}
      </p>
      <span aria-hidden className="h-px bg-ink" />
    </div>
  );
}

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
    <main className="min-h-dvh overflow-x-clip bg-canvas text-ink">
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
          className="flex min-h-7 items-center transition-opacity hover:opacity-55"
        >
          Contact
        </a>
        <ThemeToggle className="hidden sm:inline-flex" />
      </SiteHeader>

      <section className="py-30 sm:py-20 lg:py-24">
        <div className="space-y-2 sm:space-y-5">
          <EditorialRule>Software + multimedia</EditorialRule>
          <div className="sm:hidden mx-auto max-w-200 pt-5 ">
            <img
              src="favicon.ico"
              alt=""
              className="mx-auto justify-center dark:invert-0 invert-100 hue-rotate-180 dark:hue-rotate-0 object-center align-middle"
            />
          </div>
          <div className="mx-auto h-60 w-[calc(100%-2.5rem)] max-w-200 py-12 sm:h-82.5 sm:w-[calc(100%-4rem)] lg:w-[calc(100%-6rem)]">
            <BorderContainer>
              <h1 className="px-4 py-5 text-center font-display text-4xl leading-[0.7705] font-semibold tracking-tighter whitespace-nowrap sm:text-6xl lg:text-8xl">
                Dexter Young
              </h1>
            </BorderContainer>
          </div>
          <EditorialRule>
            Multimedia webworks, browser extensions and interactive image
            systems
          </EditorialRule>
        </div>
      </section>
      <ProjectBrowser onFocusChange={setFocusedProjectId} />

      <footer id="contact" className="scroll-mt-12 sm:py-20 lg:py-24">
        <EditorialRuleHeading>Contact</EditorialRuleHeading>
        <div className="py-4 flex justify-center px-5 sm:pt-10 sm:px-8 lg:px-12">
          <BorderContainer className="h-60 sm:h-68.25 w-full max-w-228.25">
            <ul className="grid grid-rows-4">
              {[
                ["GitHub", "https://github.com/TheTexta", "@TheTexta"],
                [
                  "LinkedIn",
                  "https://www.linkedin.com/in/dexter-y",
                  "dexter-y",
                ],
                [
                  "Email",
                  "mailto:dextery777@gmail.com",
                  "dextery777@gmail.com",
                ],
                ["Resume", "/public/dexter-young-resume.pdf", "Download PDF"],
              ].map(([label, href, value]) => (
                <li
                  key={label}
                  className="flex min-h-12 items-center border-b border-ink last:border-b-0"
                >
                  <a
                    href={href}
                    className="flex w-full items-center justify-between px-3 py-2 text-xs transition-opacity hover:opacity-55 sm:text-sm"
                  >
                    <span className="font-semibold tracking-[0.12em] uppercase">
                      {label}
                    </span>
                    <span className="ml-auto truncate text-muted">{value}</span>
                  </a>
                </li>
              ))}
            </ul>
          </BorderContainer>
        </div>
      </footer>
    </main>
  );
}
