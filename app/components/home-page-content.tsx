"use client";

import { useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";

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
  const ruleRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(ruleRef, { once: true, amount: 0.8 });
  const shouldReduceMotion = useReducedMotion();
  const lineScale = shouldReduceMotion || isInView ? 1 : 0;

  return (
    <div
      ref={ruleRef}
      className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 px-5 sm:px-8 lg:px-12"
    >
      <motion.span
        aria-hidden
        className="h-px origin-right bg-ink"
        initial={{ scaleX: shouldReduceMotion ? 1 : 0 }}
        animate={{ scaleX: lineScale }}
        transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
      />
      <p className="text-center text-xs font-semibold tracking-[0.18em] uppercase sm:text-sm">
        {children}
      </p>
      <motion.span
        aria-hidden
        className="h-px origin-left bg-ink"
        initial={{ scaleX: shouldReduceMotion ? 1 : 0 }}
        animate={{ scaleX: lineScale }}
        transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
      />
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
          <div className="mx-auto max-w-200 pt-5 sm:hidden">
            <img
              src="favicon.ico"
              alt=""
              className="mx-auto justify-center object-center align-middle hue-rotate-180 invert-100 dark:hue-rotate-0 dark:invert-0"
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
        <div className="flex justify-center px-5 py-4 sm:px-8 sm:pt-10 lg:px-12">
          <BorderContainer className="h-60 w-full max-w-228.25 sm:h-68.25">
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
