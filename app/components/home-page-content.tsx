"use client";

import { useRef, useState } from "react";
import { motion, type Transition, useInView } from "framer-motion";

import ProjectBrowser from "@/app/components/projects/project-browser";
import {
  getProject,
  projectCatalog,
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
import { useReducedMotion } from "@/app/hooks/use-reduced-motion";

const HOME_MOTION_EASE = [0.22, 1, 0.36, 1] as const;
const HOME_MOTION_DURATION = 0.65;

function getHomeTransition(shouldReduceMotion: boolean | null): Transition {
  return shouldReduceMotion
    ? { duration: 0 }
    : { duration: HOME_MOTION_DURATION, ease: HOME_MOTION_EASE };
}

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
        transition={getHomeTransition(shouldReduceMotion)}
      />
      <p className="text-center text-xs font-semibold tracking-[0.18em] uppercase sm:text-sm">
        {children}
      </p>
      <motion.span
        aria-hidden
        className="h-px origin-left bg-ink"
        initial={{ scaleX: shouldReduceMotion ? 1 : 0 }}
        animate={{ scaleX: lineScale }}
        transition={getHomeTransition(shouldReduceMotion)}
      />
    </div>
  );
}

function MobileFavicon() {
  const imageRef = useRef<HTMLImageElement>(null);
  const isInView = useInView(imageRef, { once: true, amount: 0.8 });
  const shouldReduceMotion = useReducedMotion();
  const imageOpacity = shouldReduceMotion || isInView ? 1 : 0;

  return (
    <motion.img
      ref={imageRef}
      src="favicon.ico"
      alt=""
      className="mx-auto justify-center object-center align-middle hue-rotate-180 invert-100 dark:hue-rotate-0 dark:invert-0"
      initial={{ opacity: shouldReduceMotion ? 1 : 0 }}
      animate={{ opacity: imageOpacity }}
      transition={getHomeTransition(shouldReduceMotion)}
    />
  );
}

function HomeLinkRow({
  label,
  href,
  value,
}: {
  label: string;
  href: string;
  value?: string;
}) {
  const shouldReduceMotion = useReducedMotion();
  const contactTransition = getHomeTransition(shouldReduceMotion);

  return (
    <li className="flex min-h-12 items-center border-b border-ink last:border-b-0">
      <motion.a
        href={href}
        className="group relative isolate flex size-full min-h-12 items-center justify-between gap-3 overflow-hidden bg-canvas px-3 text-xs transition-opacity focus-visible:-outline-offset-2 sm:text-sm"
        initial="rest"
        whileHover="active"
        whileFocus="active"
      >
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 z-20 w-full origin-left bg-white mix-blend-difference dark:bg-ink"
          variants={{
            rest: { scaleX: 0 },
            active: { scaleX: 1 },
          }}
          transition={contactTransition}
        />
        <span className="relative z-10 min-w-0 truncate text-xs font-semibold tracking-[0.18em] uppercase sm:text-sm">
          {label}
        </span>
        {value ? (
          <span className="relative z-10 ml-auto truncate text-xs sm:text-sm">
            {value}
          </span>
        ) : null}
      </motion.a>
    </li>
  );
}

const writeUpProjects = projectCatalog.filter((project) => project.writeUpHref);

function getFocusedDirectorySegments(
  projectId: ProjectId,
): HeaderDirectorySegment[] {
  const project = getProject(projectId);
  const projectHref =
    project.writeUpHref ??
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
          href="#about"
          className="flex min-h-7 items-center transition-opacity hover:opacity-55"
        >
          About
        </a>
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
            <MobileFavicon />
          </div>
          <div className="mx-auto h-60 w-[calc(100%-2.5rem)] max-w-200 py-12 sm:h-82.5 sm:w-[calc(100%-4rem)] lg:w-[calc(100%-6rem)] lg:max-w-225">
            <BorderContainer>
              <h1 className="object-center px-4 py-5 text-center font-display text-4xl leading-[0.7705] font-semibold tracking-tighter whitespace-nowrap sm:text-6xl lg:py-8 lg:text-8xl">
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

      <section
        id="about"
        aria-label="About"
        className="scroll-mt-12 py-12 sm:pt-20 sm:pb-0 lg:pt-24"
      >
        <EditorialRuleHeading>About</EditorialRuleHeading>
        <div className="px-5 py-4 sm:px-8 sm:pt-10 lg:px-12">
          <div className="mx-auto grid max-w-228.25 gap-8 md:grid-cols-2 md:gap-12">
            <p className="text-base leading-[1.8]">
              I&apos;m Dexter, studying Artificial Intelligence and Computer
              Science at McGill, with a minor in Music Technology. I design and
              build websites, browser tools and visual archives, working across
              interfaces, interactive graphics and the systems behind them.
            </p>
            <div className="flex min-w-0 flex-col gap-3 md:h-0 md:min-h-full">
              <EditorialRule>Write ups</EditorialRule>
              <nav
                aria-label="Project write-ups"
                tabIndex={0}
                className="h-36 min-h-0 min-w-0 [scrollbar-width:thin] [scrollbar-color:var(--color-ink)_var(--color-canvas)] overflow-y-auto overscroll-y-contain border border-ink focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-ink md:h-auto md:flex-1"
              >
                <ul className="grid">
                  {writeUpProjects.map((project) => (
                    <HomeLinkRow
                      key={project.id}
                      label={project.title}
                      href={project.writeUpHref!}
                    />
                  ))}
                </ul>
              </nav>
            </div>
          </div>
        </div>
      </section>

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
                ["Resume", "/Dexter_Young_CV.pdf", "Download PDF"],
              ].map(([label, href, value]) => (
                <HomeLinkRow
                  key={label}
                  label={label}
                  href={href}
                  value={value}
                />
              ))}
            </ul>
          </BorderContainer>
        </div>
      </footer>
    </main>
  );
}
