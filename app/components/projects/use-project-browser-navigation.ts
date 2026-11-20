"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  browserProjects as projectCatalog,
  type ProjectId,
} from "./project-catalog";

const PROJECT_HASH_PREFIX = "#project-";
const VALID_PROJECT_IDS = new Set(projectCatalog.map((project) => project.id));
type ViewTransition = {
  finished: Promise<void>;
  ready: Promise<void>;
  skipTransition: () => void;
  updateCallbackDone: Promise<void>;
};
type DocumentWithViewTransition = Document & {
  startViewTransition?: (callback: () => void) => ViewTransition;
};

function readProjectHash(): ProjectId | null {
  const value = window.location.hash;
  if (!value.startsWith(PROJECT_HASH_PREFIX)) return null;
  const id = value.slice(PROJECT_HASH_PREFIX.length) as ProjectId;
  return VALID_PROJECT_IDS.has(id) ? id : null;
}

/** Owns focus-view history, transition lifetime and return-to-gallery navigation. */
export function useProjectBrowserNavigation({
  embedded,
  onFocusChange,
}: {
  embedded: boolean;
  onFocusChange?: (projectId: ProjectId | null) => void;
}) {
  const [focusedProjectId, setFocusedProjectId] = useState<ProjectId | null>(
    null,
  );
  const [returnProjectId, setReturnProjectId] = useState<ProjectId | null>(
    null,
  );
  const [touchInfoKey, setTouchInfoKey] = useState<string | null>(null);
  const [mobileExpandedKey, setMobileExpandedKey] = useState<string | null>(
    `mobile-table-${projectCatalog[0].id}-0`,
  );
  const galleryRef = useRef<HTMLDivElement>(null);
  const activeViewTransitionRef = useRef<ViewTransition | null>(null);
  const focusedProjectRef = useRef<ProjectId | null>(null);
  const railScrollYRef = useRef(0);
  const lastFocusedCardKeyRef = useRef<string | null>(null);
  const restoreRailRef = useRef(false);
  const restoreRailFocusRef = useRef(false);

  const updateWithTransition = useCallback(
    (callback: () => void, onFinished?: () => void) => {
      const documentWithTransition = document as DocumentWithViewTransition;
      const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      if (
        embedded ||
        !documentWithTransition.startViewTransition ||
        reducedMotion
      ) {
        callback();
        onFinished?.();
        return;
      }
      activeViewTransitionRef.current?.skipTransition();
      const transition = documentWithTransition.startViewTransition(() => {
        flushSync(callback);
      });
      activeViewTransitionRef.current = transition;
      // Superseded transitions reject ready/updateCallbackDone; cancellation is expected.
      void transition.ready.catch(() => undefined);
      void transition.updateCallbackDone.catch(() => undefined);
      void transition.finished
        .catch(() => undefined)
        .finally(() => {
          if (activeViewTransitionRef.current === transition)
            activeViewTransitionRef.current = null;
          onFinished?.();
        });
    },
    [embedded],
  );

  useEffect(
    () => () => {
      activeViewTransitionRef.current?.skipTransition();
      activeViewTransitionRef.current = null;
    },
    [],
  );

  useEffect(() => {
    if (embedded) return;
    const syncFromHash = () => {
      const projectId = readProjectHash();
      if (focusedProjectRef.current === projectId) return;
      if (focusedProjectRef.current && !projectId) {
        restoreRailRef.current = true;
        restoreRailFocusRef.current = true;
        const cardKey = lastFocusedCardKeyRef.current;
        if (cardKey?.startsWith("mobile-table-")) setMobileExpandedKey(cardKey);
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
  }, [embedded, updateWithTransition]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (focusedProjectId) {
        if (!embedded) galleryRef.current?.scrollIntoView({ block: "start" });
        galleryRef.current
          ?.querySelector<HTMLElement>(".project-focus-view")
          ?.focus({ preventScroll: true });
        return;
      }
      if (!restoreRailRef.current) return;
      restoreRailRef.current = false;
      const sectionTarget = embedded
        ? null
        : document.getElementById(window.location.hash.slice(1));
      if (sectionTarget) {
        restoreRailFocusRef.current = false;
        sectionTarget.scrollIntoView({ block: "start" });
        if (!sectionTarget.contains(document.activeElement))
          sectionTarget.focus({ preventScroll: true });
        return;
      }
      if (!embedded) window.scrollTo({ top: railScrollYRef.current });
      if (!restoreRailFocusRef.current) return;
      restoreRailFocusRef.current = false;
      const cardKey = lastFocusedCardKeyRef.current;
      const trigger = cardKey
        ? galleryRef.current?.querySelector<HTMLElement>(
            `[data-card-key="${cardKey}"] [data-project-trigger]`,
          )
        : null;
      if (trigger && trigger.getClientRects().length > 0) {
        if (!embedded)
          trigger.scrollIntoView({
            block: "nearest",
            inline: "nearest",
            behavior: "instant",
          });
        trigger.focus({ preventScroll: true });
      } else galleryRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [embedded, focusedProjectId]);

  useEffect(() => {
    onFocusChange?.(focusedProjectId);
  }, [focusedProjectId, onFocusChange]);
  useEffect(() => {
    if (!touchInfoKey) return;
    const dismiss = (event: globalThis.PointerEvent) => {
      if (!galleryRef.current?.contains(event.target as Node))
        setTouchInfoKey(null);
    };
    window.addEventListener("pointerdown", dismiss);
    return () => window.removeEventListener("pointerdown", dismiss);
  }, [touchInfoKey]);

  const getLocationUrl = useCallback(
    () => `${window.location.pathname}${window.location.search}`,
    [],
  );
  const setProjectHash = useCallback(
    (projectId: ProjectId, mode: "push" | "replace" = "push") => {
      if (!embedded)
        window.history[mode === "push" ? "pushState" : "replaceState"](
          { projectId, projectFocus: true },
          "",
          `${getLocationUrl()}${PROJECT_HASH_PREFIX}${projectId}`,
        );
      updateWithTransition(() => {
        focusedProjectRef.current = projectId;
        setFocusedProjectId(projectId);
      });
    },
    [embedded, getLocationUrl, updateWithTransition],
  );

  const openFocus = useCallback(
    (projectId: ProjectId, cardKey: string) => {
      railScrollYRef.current = window.scrollY;
      lastFocusedCardKeyRef.current = cardKey;
      setTouchInfoKey(null);
      setMobileExpandedKey(null);
      const sourceCard = galleryRef.current?.querySelector<HTMLElement>(
        `[data-card-key="${cardKey}"]`,
      );
      if (sourceCard && !embedded)
        sourceCard.style.viewTransitionName = `project-poster-${projectId}`;
      setProjectHash(projectId);
    },
    [embedded, setProjectHash],
  );

  const closeFocus = useCallback(
    (restoreFocus: boolean) => {
      const projectId = focusedProjectRef.current;
      const projectIndex = projectCatalog.findIndex(
        (project) => project.id === projectId,
      );
      restoreRailRef.current = true;
      restoreRailFocusRef.current = restoreFocus;
      if (!embedded) window.history.replaceState({}, "", getLocationUrl());
      updateWithTransition(
        () => {
          if (projectId && projectIndex !== -1) {
            setReturnProjectId(projectId);
            setMobileExpandedKey(
              restoreFocus &&
                lastFocusedCardKeyRef.current?.startsWith("mobile-table-")
                ? lastFocusedCardKeyRef.current
                : `mobile-table-${projectId}-${projectIndex}`,
            );
          }
          focusedProjectRef.current = null;
          setFocusedProjectId(null);
          if (!embedded) window.scrollTo({ top: railScrollYRef.current });
        },
        () => setReturnProjectId(null),
      );
    },
    [embedded, getLocationUrl, updateWithTransition],
  );

  const changeFocusedProject = useCallback(
    (projectId: ProjectId) => {
      setProjectHash(projectId, "replace");
    },
    [setProjectHash],
  );
  return {
    galleryRef,
    focusedProjectId,
    returnProjectId,
    touchInfoKey,
    setTouchInfoKey,
    mobileExpandedKey,
    setMobileExpandedKey,
    openFocus,
    closeFocus,
    changeFocusedProject,
  };
}
