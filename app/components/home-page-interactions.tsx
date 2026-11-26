"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { motion, type Transition, useInView } from "framer-motion";
import { useRouter } from "next/navigation";

import ProjectBrowser from "@/app/components/projects/project-browser";
import {
  getProject,
  type ProjectId,
} from "@/app/components/projects/project-catalog";
import { PROJECT_ROUTES } from "@/app/components/projects/project-routes";
import HeaderDirectory from "@/app/components/ui/header-directory";
import { useReducedMotion } from "@/app/hooks/use-reduced-motion";

const HOME_MOTION_EASE = [0.22, 1, 0.36, 1] as const;
const HOME_MOTION_DURATION = 0.65;
const HomeProjectContext = createContext<{
  focusedProjectId: ProjectId | null;
  onFocusChange: (projectId: ProjectId | null) => void;
} | null>(null);

function getHomeTransition(shouldReduceMotion: boolean | null): Transition {
  return shouldReduceMotion
    ? { duration: 0 }
    : { duration: HOME_MOTION_DURATION, ease: HOME_MOTION_EASE };
}

export function HomeEditorialRule({ children }: { children: ReactNode }) {
  const ruleRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(ruleRef, { once: true, amount: 0.8 });
  const shouldReduceMotion = useReducedMotion();
  const lineScale = shouldReduceMotion || isInView ? 1 : 0;

  return (
    <div
      ref={ruleRef}
      className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3"
    >
      <motion.span
        aria-hidden
        className="h-px origin-right bg-ink"
        initial={{ scaleX: shouldReduceMotion ? 1 : 0 }}
        animate={{ scaleX: lineScale }}
        transition={getHomeTransition(shouldReduceMotion)}
      />
      {children}
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

export function HomeContactLink({
  children,
  href,
}: {
  children: ReactNode;
  href: string;
}) {
  const shouldReduceMotion = useReducedMotion();

  return (
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
        transition={getHomeTransition(shouldReduceMotion)}
      />
      {children}
    </motion.a>
  );
}

function useHomeProject() {
  const value = useContext(HomeProjectContext);
  if (!value)
    throw new Error("Home project controls require HomePageInteractions.");
  return value;
}

export function HomeProjectDirectory() {
  const { focusedProjectId } = useHomeProject();
  if (!focusedProjectId) return <HeaderDirectory />;
  const project = getProject(focusedProjectId);
  const projectHref =
    project.writeUpHref ??
    project.experienceHref ??
    project.liveHref ??
    PROJECT_ROUTES.portfolioProjects;

  return (
    <HeaderDirectory
      segments={[
        { label: "portfolio", href: PROJECT_ROUTES.home },
        { label: "projects", href: PROJECT_ROUTES.portfolioProjects },
        { label: project.id, href: projectHref },
      ]}
    />
  );
}

export function HomeProjectBrowser() {
  const { onFocusChange } = useHomeProject();
  return <ProjectBrowser onFocusChange={onFocusChange} />;
}

/** Server-rendered content stays outside this provider's client module graph. */
export function HomePageInteractions({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [focusedProjectId, setFocusedProjectId] = useState<ProjectId | null>(
    null,
  );
  const value = useMemo(
    () => ({ focusedProjectId, onFocusChange: setFocusedProjectId }),
    [focusedProjectId],
  );

  useEffect(() => {
    const focusSection = (event?: Event) => {
      const id = window.location.hash.slice(1);
      if (id === "about" || id === "contact") {
        if (event?.type === "hashchange") {
          // Native hash entries have no router state. Reconcile the current
          // entry so a pending project-hash restore cannot overwrite it later.
          router.replace(window.location.href, { scroll: false });
        }
        const target = document.getElementById(id);
        if (target && !target.contains(document.activeElement))
          target.focus({ preventScroll: true });
      }
    };
    focusSection();
    window.addEventListener("hashchange", focusSection);
    window.addEventListener("popstate", focusSection);
    return () => {
      window.removeEventListener("hashchange", focusSection);
      window.removeEventListener("popstate", focusSection);
    };
  }, [router]);

  return (
    <HomeProjectContext.Provider value={value}>
      {children}
    </HomeProjectContext.Provider>
  );
}
