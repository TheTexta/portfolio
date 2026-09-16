"use client";

import { ArrowLeft, ArrowRight, ArrowUpRight, X } from "lucide-react";
import Image from "next/image";
import {
  type KeyboardEvent,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";

import {
  getAdjacentProjects,
  getProject,
  projectCatalog,
  type ProjectDefinition,
  type ProjectId,
} from "@/app/components/projects/project-catalog";
import ProjectLivePreview from "@/app/components/projects/project-live-preview";
import ProjectTitle from "@/app/components/projects/project-title";
import { cn } from "@/lib/cn";

import {
  ActionLink,
  EditorialGutter,
  EditorialHeaderBar,
  AnimatedHorizontalRule,
  EditorialRuleHeading,
  EDITORIAL_HEADER_CONTROL_CLASS,
  Eyebrow,
} from "@/app/components/ui/editorial";
import { useProjectRailMotion } from "@/app/components/projects/use-project-rail-motion";
import styles from "@/app/components/projects/project-browser.module.css";

const PROJECT_HASH_PREFIX = "#project-";
const RAIL_ONE = projectCatalog;
const VALID_PROJECT_IDS = new Set(projectCatalog.map((project) => project.id));
const FOCUS_HEADER_CONTROL_CLASS = cn(
  EDITORIAL_HEADER_CONTROL_CLASS,
  "project-focus-header-control cursor-pointer appearance-none justify-center gap-2 bg-transparent max-md:min-h-11! max-md:min-w-11",
);

type DocumentWithViewTransition = Document & {
  startViewTransition?: (callback: () => void) => ViewTransition;
};

type ViewTransition = {
  finished: Promise<void>;
  ready: Promise<void>;
  skipTransition: () => void;
  updateCallbackDone: Promise<void>;
};

type RailProps = {
  projects: readonly ProjectDefinition[];
  direction: "forward" | "reverse";
  railLabel: string;
  groupRef: RefObject<HTMLDivElement | null>;
  trackRef: RefObject<HTMLDivElement | null>;
  touchInfoKey: string | null;
  onTouchInfoChange: (cardKey: string | null) => void;
  onFocusProject: (projectId: ProjectId, cardKey: string) => void;
};

function isTouchPresentation() {
  return window.matchMedia("(hover: none), (pointer: coarse)").matches;
}

type ProjectCardProps = {
  project: ProjectDefinition;
  cardKey: string;
  layout: "rail" | "stack";
  infoVisible: boolean;
  onTouchInfoChange: (cardKey: string | null) => void;
  onFocusProject: (projectId: ProjectId, cardKey: string) => void;
};

function ProjectCard({
  project,
  cardKey,
  layout,
  infoVisible,
  onTouchInfoChange,
  onFocusProject,
}: ProjectCardProps) {
  return (
    <article
      data-project-id={project.id}
      data-card-key={cardKey}
      className={cn(
        "project-mini-view group/card relative shrink-0 border-ink bg-surface focus-within:z-1 hover:z-1",
        layout === "rail"
          ? "h-[clamp(16rem,26vw,24rem)] w-[calc(clamp(16rem,26vw,24rem)*var(--aspect))]"
          : "aspect-[var(--aspect)] h-auto w-full",
      )}
      style={
        {
          "--aspect": project.posterAspectRatio,
        } as React.CSSProperties
      }
    >
      <div className="project-mini-view-media relative size-full origin-center overflow-hidden border border-ink">
        <button
          type="button"
          data-project-trigger
          className="group absolute inset-0 z-10 size-full cursor-pointer text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink"
          aria-label={`Show ${project.title} in focus view`}
          onClick={() => {
            if (isTouchPresentation() && !infoVisible) {
              onTouchInfoChange(cardKey);
              return;
            }

            onFocusProject(project.id, cardKey);
          }}
        >
          <Image
            src={project.posterSrc}
            alt={project.posterAlt}
            fill
            sizes={
              layout === "stack"
                ? "calc(100vw - 1rem)"
                : "calc(clamp(16rem, 26vw, 24rem) * 2)"
            }
            className="object-cover"
          />
        </button>

        <div
          role="button"
          tabIndex={infoVisible ? 0 : -1}
          className={cn(
            "project-mini-view-info pointer-events-none absolute inset-x-0 bottom-0 z-20 max-h-full translate-y-[calc(100%_-_3rem)] cursor-pointer overflow-hidden bg-canvas text-ink opacity-100 transition-transform duration-[var(--motion-state)] ease-[var(--ease-out-quint)] group-focus-within/card:pointer-events-auto group-focus-within/card:translate-y-0 group-hover/card:pointer-events-auto group-hover/card:translate-y-0 motion-reduce:duration-[0.01ms]",
            infoVisible &&
              "project-mini-view-info--visible pointer-events-auto translate-y-0",
          )}
          aria-label={`View ${project.title} details`}
          onClick={(event) => {
            event.stopPropagation();
            onFocusProject(project.id, cardKey);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              event.stopPropagation();
              onFocusProject(project.id, cardKey);
            }
          }}
        >
          <div className="flex min-h-12 items-center gap-3 border-t border-ink px-3">
            <ProjectTitle
              as="h3"
              className={cn(
                "min-w-0 flex-1 truncate",
                project.titleTreatment === "nepo" &&
                  "overflow-visible! text-clip!",
              )}
              context="rail"
              treatment={project.titleTreatment}
            >
              {project.title}
            </ProjectTitle>
            <p className="text-[0.625rem] font-semibold tracking-[0.16em] uppercase">
              {project.number}
            </p>
          </div>
          <div className="border-t border-ink px-3 pt-2 pb-3">
            <p className="truncate text-[0.625rem] font-semibold tracking-[0.12em] text-muted uppercase">
              {project.technologies.join(" · ")}
            </p>
            <div className="mt-2">
              <p className="line-clamp-2 min-w-0 text-xs leading-5 text-muted">
                {project.summary}
              </p>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function ProjectRail({
  projects,
  direction,
  railLabel,
  groupRef,
  trackRef,
  touchInfoKey,
  onTouchInfoChange,
  onFocusProject,
}: RailProps) {
  return (
    <div
      className="project-rail relative scrollbar-hide w-full overflow-hidden bg-canvas motion-reduce:overflow-x-auto"
      data-direction={direction}
      aria-label={railLabel}
    >
      <div
        ref={trackRef}
        className="project-rail-track flex w-max py-2 will-change-transform motion-reduce:transform-none! motion-reduce:will-change-auto"
      >
        <div ref={groupRef} className="project-rail-group flex gap-2 pr-2">
          {projects.map((project, index) => {
            const cardKey = `${direction}-${project.id}-${index}`;
            return (
              <ProjectCard
                key={cardKey}
                project={project}
                cardKey={cardKey}
                layout="rail"
                infoVisible={touchInfoKey === cardKey}
                onTouchInfoChange={onTouchInfoChange}
                onFocusProject={onFocusProject}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MobileProjectTable({
  projects,
  expandedKey,
  onToggle,
  onFocusProject,
}: {
  projects: readonly ProjectDefinition[];
  expandedKey: string | null;
  onToggle: (cardKey: string | null) => void;
  onFocusProject: (projectId: ProjectId, cardKey: string) => void;
}) {
  return (
    <div className="border-y border-ink sm:hidden" aria-label="Projects">
      {projects.map((project, index) => {
        const cardKey = `mobile-table-${project.id}-${index}`;
        const expanded = expandedKey === cardKey;

        return (
          <div key={cardKey} className="border-b border-ink last:border-b-0">
            <button
              type="button"
              className="flex min-h-12 w-full items-center justify-between gap-3 px-3 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink"
              aria-expanded={expanded}
              aria-controls={`${cardKey}-preview`}
              onClick={() => onToggle(expanded ? null : cardKey)}
            >
              <ProjectTitle
                as="span"
                className="min-w-0 truncate"
                context="mobile"
                treatment={project.titleTreatment}
              >
                {project.title}
              </ProjectTitle>
              <span className="shrink-0 text-[0.625rem] font-semibold tracking-[0.16em] uppercase">
                {project.number}
              </span>
            </button>

            <div
              id={`${cardKey}-preview`}
              className={cn(
                "max-h-0 overflow-hidden border-t-0 border-transparent transition-[max-height,border-top-color,border-top-width] duration-(--motion-state) ease-(--ease-out-quint) motion-reduce:transition-none",
                expanded && "max-h-[80vw] border-t border-ink",
              )}
              style={{ maxHeight: expanded ? "80vw" : "0px" }}
            >
              <div className="min-h-0 overflow-hidden p-4">
                <button
                  type="button"
                  className="relative block aspect-[var(--aspect)] w-full overflow-hidden border border-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink"
                  style={
                    {
                      "--aspect": project.posterAspectRatio,
                    } as React.CSSProperties
                  }
                  aria-label={`Open ${project.title} focus view`}
                  onClick={() => onFocusProject(project.id, cardKey)}
                >
                  <Image
                    src={project.posterSrc}
                    alt={project.posterAlt}
                    fill
                    sizes="calc(100vw - 1rem)"
                    className="object-cover"
                  />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

type FocusCarouselProps = {
  projectId: ProjectId;
  transitionProjectId: ProjectId | null;
  onChange: (projectId: ProjectId) => void;
  onClose: (restoreFocus: boolean) => void;
};

function FocusCarousel({
  projectId,
  transitionProjectId,
  onChange,
  onClose,
}: FocusCarouselProps) {
  const { previous, next } = getAdjacentProjects(projectId);
  const current = getProject(projectId);
  const currentIndex = projectCatalog.findIndex(
    (project) => project.id === projectId,
  );

  const selectPrevious = useCallback(
    () => onChange(previous.id),
    [onChange, previous.id],
  );
  const selectNext = useCallback(() => onChange(next.id), [next.id, onChange]);

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      selectPrevious();
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      selectNext();
    } else if (event.key === "Escape") {
      event.preventDefault();
      onClose(true);
    }
  };

  return (
    <section
      className="project-focus-view outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink"
      aria-label={`${current.title} focus view`}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
    >
      <EditorialHeaderBar
        ariaLabel={`${current.title} focus controls`}
        leading={
          <Eyebrow className="text-muted">
            <span className="sm:hidden">
              {(currentIndex + 1).toString().padStart(2, "0")} /{" "}
              {projectCatalog.length.toString().padStart(2, "0")}
            </span>
            <span className="hidden sm:inline">
              {(currentIndex + 1).toString().padStart(2, "0")} /{" "}
              {projectCatalog.length.toString().padStart(2, "0")}
            </span>
          </Eyebrow>
        }
      >
        <button
          type="button"
          className={FOCUS_HEADER_CONTROL_CLASS}
          onClick={selectPrevious}
          aria-label={`Show ${previous.title}`}
        >
          <ArrowLeft aria-hidden className="size-4" />
          <span className="max-[359px]:sr-only">Prev</span>
        </button>
        <button
          type="button"
          className={FOCUS_HEADER_CONTROL_CLASS}
          onClick={selectNext}
          aria-label={`Show ${next.title}`}
        >
          <span className="max-[359px]:sr-only">Next</span>
          <ArrowRight aria-hidden className="size-4" />
        </button>
        <button
          type="button"
          className={FOCUS_HEADER_CONTROL_CLASS}
          onClick={(event) => onClose(event.detail === 0)}
          aria-label="Close project focus"
        >
          <span className="max-[359px]:sr-only">Close</span>
          <X aria-hidden className="size-4" />
        </button>
      </EditorialHeaderBar>

      <div className="project-focus-stage relative mx-auto w-full overflow-hidden p-2 md:p-[clamp(0.5rem,1.25vw,1.25rem)]">
        <FocusPreview
          project={previous}
          position="previous"
          transitionProjectId={transitionProjectId}
          onSelect={selectPrevious}
        />
        <FocusPreview
          project={current}
          position="current"
          transitionProjectId={transitionProjectId}
        />
        <FocusPreview
          project={next}
          position="next"
          transitionProjectId={transitionProjectId}
          onSelect={selectNext}
        />
      </div>

      <EditorialGutter className="relative grid gap-4 border-b border-ink py-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <AnimatedHorizontalRule edge="top" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Eyebrow>
              {current.number} / {current.eyebrow}
            </Eyebrow>
            <span className="text-xs text-muted">
              {current.technologies.join(" · ")}
            </span>
          </div>
          <ProjectTitle
            as="h2"
            className="mt-2 wrap-anywhere"
            context="focus"
            treatment={current.titleTreatment}
          >
            {current.title}
          </ProjectTitle>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            {current.summary}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:justify-end">
          {current.caseStudyHref ? (
            <ActionLink
              href={current.caseStudyHref}
              variant="primary"
              className="w-full sm:w-auto"
            >
              Open case study
              <ArrowUpRight aria-hidden className="size-4" />
            </ActionLink>
          ) : null}
          {current.sourceHref ? (
            <ActionLink href={current.sourceHref} className="w-full sm:w-auto">
              View source
            </ActionLink>
          ) : null}
          {current.experienceHref || current.liveHref ? (
            <ActionLink
              href={current.experienceHref ?? current.liveHref ?? "/"}
              className="w-full sm:w-auto"
            >
              Launch experience
            </ActionLink>
          ) : null}
        </div>
      </EditorialGutter>
    </section>
  );
}

function FocusPreview({
  project,
  position,
  transitionProjectId,
  onSelect,
}: {
  project: ProjectDefinition;
  position: "previous" | "current" | "next";
  transitionProjectId: ProjectId | null;
  onSelect?: () => void;
}) {
  const current = position === "current";

  return (
    <div
      data-project-preview-id={project.id}
      className={cn(
        "project-focus-preview relative [aspect-ratio:var(--project-preview-aspect)] min-w-0 overflow-hidden border-ink bg-surface transition-[transform,opacity] duration-[var(--motion-layout)] ease-[var(--ease-out-quint)] motion-reduce:duration-[0.01ms] sm:border",
        current
          ? "project-focus-preview--current z-1 w-full md:mx-auto md:w-[min(70vw,68rem)] max-md:portrait:aspect-[3/4] max-md:portrait:h-auto max-md:portrait:min-h-0 [@media(orientation:landscape)_and_(max-width:1023px)_and_(max-height:500px)]:[aspect-ratio:auto] [@media(orientation:landscape)_and_(max-width:1023px)_and_(max-height:500px)]:h-[min(70svh,24rem)] [@media(orientation:landscape)_and_(max-width:1023px)_and_(max-height:500px)]:min-h-64"
          : cn(
              "project-focus-preview--side absolute top-1/2 hidden w-[44vw] opacity-40 focus-within:opacity-70 hover:opacity-70 md:block",
              position === "previous"
                ? "project-focus-preview--previous left-0"
                : "project-focus-preview--next right-0",
            ),
      )}
      style={
        {
          "--project-preview-aspect": project.posterAspectRatio,
          translate:
            position === "previous"
              ? "-66.666% -50%"
              : position === "next"
                ? "66.666% -50%"
                : undefined,
          viewTransitionName:
            transitionProjectId === project.id
              ? `project-poster-${project.id}`
              : undefined,
        } as React.CSSProperties
      }
    >
      <div className="relative h-full" inert={!current} aria-hidden={!current}>
        {current ? (
          <ProjectLivePreview project={project} />
        ) : (
          <Image
            src={project.posterSrc}
            alt=""
            fill
            sizes="22vw"
            className="object-cover"
          />
        )}
      </div>
      {!current ? (
        <button
          type="button"
          className="absolute inset-0 z-20 size-full cursor-pointer bg-transparent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink"
          onClick={onSelect}
          aria-label={`Center ${project.title}`}
        >
          <span className="sr-only">Center {project.title}</span>
        </button>
      ) : null}
    </div>
  );
}

function readProjectHash(): ProjectId | null {
  const value = window.location.hash;
  if (!value.startsWith(PROJECT_HASH_PREFIX)) {
    return null;
  }

  const projectId = value.slice(PROJECT_HASH_PREFIX.length) as ProjectId;
  return VALID_PROJECT_IDS.has(projectId) ? projectId : null;
}

type ProjectBrowserProps = {
  onFocusChange?: (projectId: ProjectId | null) => void;
};

export default function ProjectBrowser({ onFocusChange }: ProjectBrowserProps) {
  const [focusedProjectId, setFocusedProjectId] = useState<ProjectId | null>(
    null,
  );
  const [touchInfoKey, setTouchInfoKey] = useState<string | null>(null);
  const [mobileExpandedKey, setMobileExpandedKey] = useState<string | null>(
    `mobile-table-${projectCatalog[0].id}-0`,
  );
  const activeViewTransitionRef = useRef<ViewTransition | null>(null);
  const focusedProjectRef = useRef<ProjectId | null>(null);
  const galleryRef = useRef<HTMLDivElement>(null);
  const railAreaRef = useRef<HTMLDivElement>(null);
  const firstRailTrackRef = useRef<HTMLDivElement>(null);
  const firstRailGroupRef = useRef<HTMLDivElement>(null);
  const railScrollYRef = useRef(0);
  const lastFocusedProjectRef = useRef<ProjectId | null>(null);
  const lastFocusedCardKeyRef = useRef<string | null>(null);
  const restoreRailRef = useRef(false);
  const restoreRailFocusRef = useRef(false);
  const railMotion = useMemo(
    () =>
      [
        {
          direction: "forward",
          groupRef: firstRailGroupRef,
          offsetRatio: 0.08,
          trackRef: firstRailTrackRef,
        },
      ] as const,
    [],
  );

  useProjectRailMotion({
    containerRef: railAreaRef,
    enabled: focusedProjectId === null,
    rails: railMotion,
  });

  const updateWithTransition = useCallback((callback: () => void) => {
    const documentWithTransition = document as DocumentWithViewTransition;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (!documentWithTransition.startViewTransition || reducedMotion) {
      callback();
      return;
    }

    activeViewTransitionRef.current?.skipTransition();

    const transition = documentWithTransition.startViewTransition(() => {
      flushSync(callback);
    });
    activeViewTransitionRef.current = transition;

    // `ready` rejects with AbortError when a newer interaction supersedes this
    // transition. That is expected carousel behavior, not an application error.
    void transition.ready.catch(() => undefined);
    void transition.updateCallbackDone.catch(() => undefined);
    void transition.finished
      .catch(() => undefined)
      .finally(() => {
        if (activeViewTransitionRef.current === transition) {
          activeViewTransitionRef.current = null;
        }
      });
  }, []);

  useEffect(() => {
    const syncFromHash = () => {
      const projectId = readProjectHash();
      if (focusedProjectRef.current === projectId) {
        return;
      }

      updateWithTransition(() => {
        focusedProjectRef.current = projectId;
        setFocusedProjectId(projectId);
      });
    };

    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    window.addEventListener("popstate", syncFromHash);

    return () => {
      window.removeEventListener("hashchange", syncFromHash);
      window.removeEventListener("popstate", syncFromHash);
    };
  }, [updateWithTransition]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (focusedProjectId) {
        galleryRef.current?.scrollIntoView({ block: "start" });
        galleryRef.current
          ?.querySelector<HTMLElement>(".project-focus-view")
          ?.focus({ preventScroll: true });
        return;
      }

      if (!restoreRailRef.current) {
        return;
      }

      restoreRailRef.current = false;
      window.scrollTo({ top: railScrollYRef.current });

      if (!restoreRailFocusRef.current) {
        return;
      }

      restoreRailFocusRef.current = false;
      const projectId = lastFocusedProjectRef.current;
      const cardKey = lastFocusedCardKeyRef.current;
      if (projectId && cardKey) {
        galleryRef.current
          ?.querySelector<HTMLElement>(
            `[data-card-key="${cardKey}"] [data-project-trigger]`,
          )
          ?.focus({ preventScroll: true });
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [focusedProjectId]);

  useEffect(() => {
    onFocusChange?.(focusedProjectId);
  }, [focusedProjectId, onFocusChange]);

  useEffect(() => {
    if (!touchInfoKey) {
      return;
    }

    const dismiss = (event: globalThis.PointerEvent) => {
      if (galleryRef.current?.contains(event.target as Node)) {
        return;
      }
      setTouchInfoKey(null);
    };

    window.addEventListener("pointerdown", dismiss);
    return () => window.removeEventListener("pointerdown", dismiss);
  }, [touchInfoKey]);

  const getLocationUrl = useCallback(() => {
    return `${window.location.pathname}${window.location.search}`;
  }, []);

  const setProjectHash = useCallback(
    (projectId: ProjectId, mode: "push" | "replace" = "push") => {
      const nextUrl = `${getLocationUrl()}${PROJECT_HASH_PREFIX}${projectId}`;
      window.history[mode === "push" ? "pushState" : "replaceState"](
        { projectId, projectFocus: true },
        "",
        nextUrl,
      );
      updateWithTransition(() => {
        galleryRef.current
          ?.querySelectorAll<HTMLElement>("[data-project-preview-id]")
          .forEach((preview) => {
            preview.style.viewTransitionName = "";
          });
        focusedProjectRef.current = projectId;
        setFocusedProjectId(projectId);
      });
    },
    [getLocationUrl, updateWithTransition],
  );

  const openFocus = useCallback(
    (projectId: ProjectId, cardKey: string) => {
      railScrollYRef.current = window.scrollY;
      lastFocusedProjectRef.current = projectId;
      lastFocusedCardKeyRef.current = cardKey;
      setTouchInfoKey(null);
      setMobileExpandedKey(null);
      const sourceCard = galleryRef.current?.querySelector<HTMLElement>(
        `[data-card-key="${cardKey}"]`,
      );
      if (sourceCard) {
        sourceCard.style.viewTransitionName = `project-poster-${projectId}`;
      }
      setProjectHash(projectId);
    },
    [setProjectHash],
  );

  const closeFocus = useCallback(
    (restoreFocus: boolean) => {
      const nextUrl = getLocationUrl();
      restoreRailRef.current = true;
      restoreRailFocusRef.current = restoreFocus;

      window.history.replaceState({}, "", nextUrl);
      updateWithTransition(() => {
        focusedProjectRef.current = null;
        setFocusedProjectId(null);
      });
    },
    [getLocationUrl, updateWithTransition],
  );

  const changeFocusedProject = useCallback(
    (projectId: ProjectId) => {
      galleryRef.current
        ?.querySelectorAll<HTMLElement>("[data-project-preview-id]")
        .forEach((preview) => {
          preview.style.viewTransitionName =
            preview.dataset.projectPreviewId === projectId
              ? `project-poster-${projectId}`
              : "none";
        });

      setProjectHash(projectId, "replace");
    },
    [setProjectHash],
  );

  const rails = useMemo(
    () => (
      <div ref={railAreaRef} className="py-2">
        <ProjectRail
          projects={RAIL_ONE}
          direction="forward"
          railLabel="Projects"
          groupRef={firstRailGroupRef}
          trackRef={firstRailTrackRef}
          touchInfoKey={touchInfoKey}
          onTouchInfoChange={setTouchInfoKey}
          onFocusProject={openFocus}
        />
      </div>
    ),
    [openFocus, touchInfoKey],
  );

  return (
    <div
      ref={galleryRef}
      id="projects"
      className={cn("scroll-mt-12 pb-36 sm:py-15", styles.root)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setTouchInfoKey(null);
        }
      }}
    >
      {!focusedProjectId ? (
        <EditorialRuleHeading height="section">Projects</EditorialRuleHeading>
      ) : null}

      {focusedProjectId ? (
        <FocusCarousel
          projectId={focusedProjectId}
          transitionProjectId={focusedProjectId}
          onChange={changeFocusedProject}
          onClose={closeFocus}
        />
      ) : (
        <>
          <div className="sm:hidden">
            <MobileProjectTable
              projects={projectCatalog}
              expandedKey={mobileExpandedKey}
              onToggle={setMobileExpandedKey}
              onFocusProject={openFocus}
            />
          </div>
          <div className="hidden sm:block">{rails}</div>
        </>
      )}
    </div>
  );
}
