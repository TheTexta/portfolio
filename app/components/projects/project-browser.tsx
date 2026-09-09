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
import { cn } from "@/lib/cn";

import {
  ActionLink,
  EditorialContainer,
  EditorialGutter,
  EditorialHeaderBar,
  EDITORIAL_HEADER_CONTROL_CLASS,
  Eyebrow,
} from "@/app/components/ui/editorial";
import { useProjectRailMotion } from "@/app/components/projects/use-project-rail-motion";

const PROJECT_HASH_PREFIX = "#project-";
const RAIL_ONE = projectCatalog;
const VALID_PROJECT_IDS = new Set(projectCatalog.map((project) => project.id));
const FOCUS_HEADER_CONTROL_CLASS = cn(
  EDITORIAL_HEADER_CONTROL_CLASS,
  "cursor-pointer appearance-none gap-2 bg-transparent",
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
      className="project-rail"
      data-direction={direction}
      aria-label={railLabel}
    >
      <div ref={trackRef} className="project-rail-track">
        <div ref={groupRef} className="project-rail-group">
          {projects.map((project, index) => {
            const cardKey = `${direction}-${project.id}-${index}`;
            const infoVisible = touchInfoKey === cardKey;

            return (
              <article
                key={cardKey}
                data-project-id={project.id}
                data-card-key={cardKey}
                className="project-mini-view editorial-rule bg-surface relative shrink-0"
                style={
                  {
                    "--aspect": project.posterAspectRatio,
                  } as React.CSSProperties
                }
              >
                <div className="project-mini-view-media relative h-full w-full overflow-hidden">
                  <button
                    type="button"
                    className="group absolute inset-0 z-10 h-full w-full cursor-pointer text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[rgb(var(--color-focus))]"
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
                      sizes="(max-width: 640px) 100vw, calc(clamp(16rem, 26vw, 24rem) * 2)"
                      className="object-cover"
                    />
                  </button>

                  <div
                    role="button"
                    tabIndex={infoVisible ? 0 : -1}
                    className={cn(
                      "project-mini-view-info bg-canvas text-ink absolute inset-x-0 bottom-0 z-20 cursor-pointer",
                      infoVisible && "project-mini-view-info--visible",
                    )}
                    aria-label={`View ${project.title} details`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onFocusProject(project.id, cardKey);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        onFocusProject(project.id, cardKey);
                      }
                    }}
                  >
                    <div className="editorial-rule flex min-h-12 items-center gap-3 border-t px-3">
                      <h3
                        className={cn(
                          "project-title project-title--rail min-w-0 flex-1 truncate",
                          project.titleTreatment === "nepo" &&
                            "overflow-visible! text-clip!",
                        )}
                        data-title-treatment={project.titleTreatment}
                      >
                        {project.title}
                      </h3>
                      <p className="text-[0.625rem] font-semibold tracking-[0.16em] uppercase">
                        {project.number}
                      </p>
                    </div>
                    <div className="editorial-rule border-t px-3 pt-2 pb-3">
                      <p className="editorial-muted truncate text-[0.625rem] font-semibold tracking-[0.12em] uppercase">
                        {project.technologies.join(" · ")}
                      </p>
                      <div className="mt-2">
                        <p className="editorial-muted line-clamp-2 min-w-0 text-xs leading-5">
                          {project.summary}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
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
      className="project-focus-view outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[rgb(var(--color-focus))]"
      aria-label={`${current.title} focus view`}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
    >
      <EditorialHeaderBar
        ariaLabel={`${current.title} focus controls`}
        leading={
          <Eyebrow className="editorial-muted">
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
          <ArrowLeft aria-hidden className="h-4 w-4" />
          <span>Prev</span>
        </button>
        <button
          type="button"
          className={FOCUS_HEADER_CONTROL_CLASS}
          onClick={selectNext}
          aria-label={`Show ${next.title}`}
        >
          <span>Next</span>
          <ArrowRight aria-hidden className="h-4 w-4" />
        </button>
        <button
          type="button"
          className={FOCUS_HEADER_CONTROL_CLASS}
          onClick={(event) => onClose(event.detail === 0)}
          aria-label="Close project focus"
        >
          <span>Close</span>
          <X aria-hidden className="h-4 w-4" />
        </button>
      </EditorialHeaderBar>

      <div className="project-focus-stage">
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

      <EditorialGutter className="editorial-rule grid gap-4 border-y py-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Eyebrow>
              {current.number} / {current.eyebrow}
            </Eyebrow>
            <span className="editorial-muted text-xs">
              {current.technologies.join(" · ")}
            </span>
          </div>
          <h2
            className="project-title mt-2 text-[clamp(1.75rem,3vw,3rem)] wrap-anywhere"
            data-title-treatment={current.titleTreatment}
          >
            {current.title}
          </h2>
          <p className="editorial-muted mt-2 max-w-2xl text-sm leading-6">
            {current.summary}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 lg:justify-end">
          {current.caseStudyHref ? (
            <ActionLink href={current.caseStudyHref} variant="primary">
              Open case study
              <ArrowUpRight aria-hidden className="h-4 w-4" />
            </ActionLink>
          ) : null}
          {current.sourceHref ? (
            <ActionLink href={current.sourceHref}>View source</ActionLink>
          ) : null}
          {current.experienceHref || current.liveHref ? (
            <ActionLink
              href={current.experienceHref ?? current.liveHref ?? "/"}
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
        "project-focus-preview editorial-frame bg-surface min-w-0 overflow-hidden",
        current
          ? "project-focus-preview--current"
          : cn(
              "project-focus-preview--side",
              position === "previous"
                ? "project-focus-preview--previous"
                : "project-focus-preview--next",
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
          className="absolute inset-0 z-20 h-full w-full cursor-pointer bg-transparent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[rgb(var(--color-focus))]"
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
            `[data-card-key="${cardKey}"] > .project-mini-view-media > button`,
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
          railLabel="Projects rail"
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
      className="scroll-mt-12"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setTouchInfoKey(null);
        }
      }}
    >
      {!focusedProjectId ? (
        <EditorialContainer className="max-w-384 pb-3">
          <Eyebrow className="editorial-muted">
            Interactive works / 01—
            {projectCatalog.length.toString().padStart(2, "0")}
          </Eyebrow>
          <h2 className="mt-1.5 text-[clamp(1.75rem,3.5vw,3.25rem)] leading-none font-semibold tracking-[-0.035em]">
            Projects
          </h2>
        </EditorialContainer>
      ) : null}

      {focusedProjectId ? (
        <FocusCarousel
          projectId={focusedProjectId}
          transitionProjectId={focusedProjectId}
          onChange={changeFocusedProject}
          onClose={closeFocus}
        />
      ) : (
        rails
      )}
    </div>
  );
}
