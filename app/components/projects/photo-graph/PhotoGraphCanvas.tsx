"use client";

import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
} from "react";

import { useTheme } from "@/app/components/theme/theme-provider";
import { PROJECT_ROUTES } from "@/app/components/projects/project-routes";
import { ControlButton } from "@/app/components/ui/control";
import ExperienceNav from "@/app/components/ui/experience-nav";
import { photoGraphMediaUrl } from "@/lib/photo-graph/media-url";
import { useReducedMotion } from "@/app/hooks/use-reduced-motion";

import PhotoGraph2DRenderer from "./PhotoGraph2DRenderer";
import PhotoGraphBrowser from "./PhotoGraphBrowser";
import PhotoGraphControls from "./PhotoGraphControls";
import PhotoGraphInspectOverlay from "./PhotoGraphInspectOverlay";
import PhotoGraphRendererBoundary from "./PhotoGraphRendererBoundary";
import {
  DEFAULT_GRAPH_CONTROLS,
  PHOTO_GRAPH_INSPECT_PREVIEW_QUALITY,
  PHOTO_GRAPH_INSPECT_PREVIEW_WIDTH,
  photoGraphControlRowClass,
  photoGraphControlTextClass,
  photoGraphShellClass,
} from "./config";
import type {
  GraphControls,
  InspectTarget,
  PhotoGraphCanvasProps,
  PhotoGraphData,
  PhotoGraphNode,
} from "./types";
import type { PhotoGraph3DRendererProps } from "./PhotoGraph3DRenderer";
import type { PhotoGraphViewSnapshot } from "./view-state";
import { usePhotoGraphData } from "./usePhotoGraphData";
import styles from "./photo-graph-controls.module.css";
import loadingStyles from "./photo-graph-loading.module.css";

function buildInspectPreviewUrl(node: PhotoGraphNode) {
  if (!node.storagePath) return node.sourceUrl;
  try {
    return (
      photoGraphMediaUrl(
        {
          storagePath: node.storagePath,
          storageProvider: node.storageProvider,
        },
        {
          width: PHOTO_GRAPH_INSPECT_PREVIEW_WIDTH,
          quality: PHOTO_GRAPH_INSPECT_PREVIEW_QUALITY,
        },
      ) ?? node.sourceUrl
    );
  } catch {
    return node.storageProvider === "r2" ? "" : node.sourceUrl;
  }
}

function canRestoreFocus(
  element: HTMLElement | null,
  allowClipped = false,
): element is HTMLElement {
  if (
    !element?.isConnected ||
    element.closest('[hidden], [inert], [aria-hidden="true"], :disabled') ||
    element.getAttribute("aria-disabled") === "true"
  )
    return false;
  for (
    let ancestor = element.parentElement;
    ancestor;
    ancestor = ancestor.parentElement
  ) {
    if (
      ancestor instanceof HTMLDetailsElement &&
      !ancestor.open &&
      !ancestor.querySelector("summary")?.contains(element)
    )
      return false;
  }
  const style = getComputedStyle(element);
  if (
    style.display === "none" ||
    style.visibility === "hidden" ||
    !element.getClientRects().length
  )
    return false;
  // The clipped entry reveals on focus; the graph region is the final logical
  // fallback even when an embedded graph is only partly inside the viewport.
  if (allowClipped) return true;
  const bounds = element.getBoundingClientRect();
  const tolerance = 0.5;
  if (
    bounds.left < -tolerance ||
    bounds.top < -tolerance ||
    bounds.right > document.documentElement.clientWidth + tolerance ||
    bounds.bottom > window.innerHeight + tolerance
  )
    return false;
  for (
    let ancestor = element.parentElement;
    ancestor;
    ancestor = ancestor.parentElement
  ) {
    const overflow = getComputedStyle(ancestor);
    const clipX = /^(auto|scroll|hidden|clip)$/.test(overflow.overflowX);
    const clipY = /^(auto|scroll|hidden|clip)$/.test(overflow.overflowY);
    if (!clipX && !clipY) continue;
    const clip = ancestor.getBoundingClientRect();
    const left = clip.left + ancestor.clientLeft;
    const top = clip.top + ancestor.clientTop;
    if (
      (clipX &&
        (bounds.left < left - tolerance ||
          bounds.right > left + ancestor.clientWidth + tolerance)) ||
      (clipY &&
        (bounds.top < top - tolerance ||
          bounds.bottom > top + ancestor.clientHeight + tolerance))
    )
      return false;
  }
  return true;
}

export default function PhotoGraphCanvas({
  allow3D = false,
  controls: controlledControls,
  defaultControls = DEFAULT_GRAPH_CONTROLS,
  forcedDarkMode,
  fitToCanvas = false,
  graphUrl,
  onControlsChange,
  showControls = true,
  showNavigation = true,
}: PhotoGraphCanvasProps) {
  const { darkMode: siteDarkMode } = useTheme();
  const activeDarkMode = forcedDarkMode ?? siteDarkMode;
  const isFullPageRoute = usePathname() === PROJECT_ROUTES.photoGraphExperience;
  const canUse3D = allow3D && isFullPageRoute;
  const reducedMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const browserEntryRef = useRef<HTMLElement>(null);
  const browserSelectRef = useRef<HTMLSelectElement>(null);
  const inspectOpenerRef = useRef<{
    id: string;
    element: HTMLElement | null;
  } | null>(null);
  const statusId = useId();
  const guidanceId = useId();
  const [twoDSnapshot, setTwoDSnapshot] =
    useState<PhotoGraphViewSnapshot | null>(null);
  const [threeDSnapshot, setThreeDSnapshot] =
    useState<PhotoGraphViewSnapshot | null>(null);
  const modeRequestRef = useRef(0);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [browserOpen, setBrowserOpen] = useState(false);
  const [browseFocusRequest, setBrowseFocusRequest] = useState<{
    id: string;
    sequence: number;
  } | null>(null);
  const [inspectTarget, setInspectTarget] = useState<InspectTarget | null>(
    null,
  );
  const [uncontrolledControls, setUncontrolledControls] = useState({
    ...defaultControls,
  });
  const [hasLocalControlOverride, setHasLocalControlOverride] = useState(false);
  const [mode, setMode] = useState<"2d" | "loading" | "3d">("2d");
  const [modeMessage, setModeMessage] = useState("");
  const [resetViewKey, setResetViewKey] = useState(0);
  const [ThreeDRenderer, setThreeDRenderer] =
    useState<ComponentType<PhotoGraph3DRendererProps> | null>(null);
  const { defaultGraphControls, graphData, loadStatus, retry } =
    usePhotoGraphData(graphUrl);
  const [renderedGraphData, setRenderedGraphData] =
    useState<PhotoGraphData | null>(null);
  const selectedNode =
    loadStatus === "ready"
      ? (graphData.nodes.find((node) => node.id === selectedPhotoId) ??
        graphData.nodes[0])
      : undefined;
  // Normalize on data replacement, not on renderer/camera changes.
  if (
    loadStatus === "ready" &&
    selectedPhotoId !== (selectedNode?.id ?? null)
  ) {
    setSelectedPhotoId(selectedNode?.id ?? null);
  } else if (loadStatus === "empty" && selectedPhotoId !== null) {
    setSelectedPhotoId(null);
  }
  const activeControls =
    controlledControls ??
    (hasLocalControlOverride
      ? uncontrolledControls
      : (defaultGraphControls ?? uncontrolledControls));

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const update = (width: number, height: number) => {
      // Retained previews can be display:none. Keep their last real viewport so
      // hiding them does not reset camera fitting or enqueue 1px image demand.
      if (width <= 0 || height <= 0) return;
      const next = {
        width: Math.max(1, Math.round(width)),
        height: Math.max(1, Math.round(height)),
      };
      setDimensions((current) =>
        current.width === next.width && current.height === next.height
          ? current
          : next,
      );
    };
    const bounds = container.getBoundingClientRect();
    update(bounds.width, bounds.height);
    const observer = new ResizeObserver(([entry]) => {
      if (entry) update(entry.contentRect.width, entry.contentRect.height);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(
    () => () => {
      modeRequestRef.current += 1;
    },
    [],
  );

  const changeMode = useCallback(
    async (enabled: boolean) => {
      const request = ++modeRequestRef.current;
      setModeMessage("");
      if (!enabled || !canUse3D) {
        setMode("2d");
        return;
      }
      setMode("loading");
      try {
        // Import the entire renderer only in a browser event. Its dependencies
        // access window at module evaluation and must never enter the SSR path.
        const renderer = await import("./PhotoGraph3DRenderer");
        if (modeRequestRef.current !== request) return;
        setThreeDRenderer(() => renderer.default);
        setMode("3d");
      } catch {
        if (modeRequestRef.current !== request) return;
        setMode("2d");
        setModeMessage(
          "3D could not load. Showing 2D; enable 3D to try again.",
        );
      }
    },
    [canUse3D],
  );

  const handle3DFailure = useCallback(() => {
    modeRequestRef.current += 1;
    setMode("2d");
    setModeMessage(
      "3D is unavailable on this device. Showing 2D; you can try 3D again.",
    );
  }, []);

  const setControlValue = useCallback(
    (key: keyof GraphControls, value: boolean | number) => {
      const next = { ...activeControls, [key]: value } as GraphControls;
      if (controlledControls) {
        onControlsChange?.(next);
      } else {
        setHasLocalControlOverride(true);
        setUncontrolledControls(next);
      }
    },
    [activeControls, controlledControls, onControlsChange],
  );

  const inspectNode = useCallback(
    (node: PhotoGraphNode, opener?: HTMLButtonElement) => {
      inspectOpenerRef.current = { id: node.id, element: opener ?? null };
      setSelectedPhotoId(node.id);
      setInspectTarget({
        id: node.id,
        originalUrl: node.sourceUrl,
        previewUrl: buildInspectPreviewUrl(node),
      });
    },
    [],
  );
  const selectNode = (node: PhotoGraphNode) => {
    setSelectedPhotoId(node.id);
    if (!isFullPageRoute) {
      setBrowseFocusRequest((current) => ({
        id: node.id,
        sequence: (current?.sequence ?? 0) + 1,
      }));
    }
  };
  const restoreInspectFocus = useCallback(() => {
    // Route unmount must not focus a previous page.
    if (!containerRef.current?.isConnected) return;
    const opener = inspectOpenerRef.current;
    const candidates = opener?.element
      ? [
          loadStatus === "ready" && selectedNode?.id === opener.id
            ? opener.element
            : null,
          browserSelectRef.current,
          browserEntryRef.current,
          containerRef.current,
        ]
      : [containerRef.current];
    for (const candidate of candidates) {
      const revealEntry = candidate === browserEntryRef.current;
      if (
        !canRestoreFocus(
          candidate,
          revealEntry || candidate === containerRef.current,
        )
      )
        continue;
      candidate.focus({ preventScroll: true });
      // Focusing a clipped summary changes its layout. Validate the revealed
      // entry too, rather than retaining focus outside an embedded viewport.
      if (!revealEntry || canRestoreFocus(candidate)) break;
    }
    inspectOpenerRef.current = null;
  }, [loadStatus, selectedNode?.id]);
  const closeInspect = useCallback(() => setInspectTarget(null), []);
  const inspectCanvasNode = useCallback(
    (node: PhotoGraphNode) => inspectNode(node),
    [inspectNode],
  );
  const is3D = canUse3D && mode === "3d" && ThreeDRenderer !== null;
  const screenStatus =
    loadStatus === "ready" && !is3D && renderedGraphData !== graphData
      ? "loading"
      : loadStatus;

  return (
    <div
      data-settings-open={menuOpen && showControls}
      data-browser-open={browserOpen && showControls}
      data-controls-columns={dimensions.width >= 640}
      style={
        { "--photo-graph-height": `${dimensions.height}px` } as CSSProperties
      }
      className={`${styles.shell} static size-full transition-colors ${photoGraphShellClass}`}
    >
      <div
        className={`size-full transition-opacity duration-200 motion-reduce:transition-none ${inspectTarget ? "pointer-events-none opacity-35" : "opacity-100"}`}
      >
        {showControls && (
          <PhotoGraphControls
            menuOpen={menuOpen}
            controls={activeControls}
            reserveNavigationSpace={showNavigation}
            reserveResetSpace={
              showNavigation && isFullPageRoute && showControls
            }
            showTheme={isFullPageRoute && forcedDarkMode === undefined}
            show3D={canUse3D}
            threeDEnabled={canUse3D && mode !== "2d"}
            threeDLoading={mode === "loading"}
            threeDDisabled={loadStatus !== "ready"}
            modeMessage={menuOpen ? modeMessage : ""}
            on3DChange={changeMode}
            onMenuOpen={() => setMenuOpen(true)}
            onMenuClose={() => setMenuOpen(false)}
            onControlChange={setControlValue}
          />
        )}
        {showNavigation && (
          <ExperienceNav
            writeUpHref={
              isFullPageRoute ? PROJECT_ROUTES.photoGraph : undefined
            }
            experienceHref={
              isFullPageRoute ? undefined : PROJECT_ROUTES.photoGraphExperience
            }
            showWriteUpLabel={false}
            ariaLabel="Photo graph controls"
            className="[&>*]:min-h-8"
          >
            {isFullPageRoute && showControls && (
              <ControlButton
                layout="action"
                size="sm"
                className={`px-3 py-0 ${photoGraphControlRowClass} ${photoGraphControlTextClass}`}
                disabled={loadStatus !== "ready" || mode === "loading"}
                onClick={() => setResetViewKey((key) => key + 1)}
              >
                Reset
              </ControlButton>
            )}
          </ExperienceNav>
        )}
        <div
          ref={containerRef}
          role="region"
          aria-label="Interactive photograph graph"
          aria-describedby={showControls ? guidanceId : undefined}
          tabIndex={-1}
          className="relative size-full bg-canvas focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink focus-visible:outline-solid"
        >
          {showControls && (
            <p id={guidanceId} className="sr-only">
              Use Browse photographs to select and open photographs with the
              keyboard.
            </p>
          )}
          {dimensions.width > 0 &&
            dimensions.height > 0 &&
            (is3D ? (
              <PhotoGraphRendererBoundary onFailure={handle3DFailure}>
                <ThreeDRenderer
                  graphData={graphData}
                  dimensions={dimensions}
                  controls={activeControls}
                  activeDarkMode={activeDarkMode}
                  reducedMotion={reducedMotion}
                  onInspect={inspectCanvasNode}
                  snapshot={threeDSnapshot}
                  onSaveSnapshot={setThreeDSnapshot}
                  resetViewKey={resetViewKey}
                  onFailure={handle3DFailure}
                />
              </PhotoGraphRendererBoundary>
            ) : (
              <PhotoGraph2DRenderer
                graphData={graphData}
                dimensions={dimensions}
                controls={activeControls}
                activeDarkMode={activeDarkMode}
                reducedMotion={reducedMotion}
                onInspect={inspectCanvasNode}
                fitToCanvas={fitToCanvas}
                browseFocusRequest={browseFocusRequest}
                snapshot={twoDSnapshot}
                onSaveSnapshot={setTwoDSnapshot}
                resetViewKey={resetViewKey}
                onReady={setRenderedGraphData}
              />
            ))}
          <AnimatePresence initial={false}>
            {screenStatus !== "ready" && (
              <motion.div
                key="graph-status"
                initial={{ opacity: 1 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, pointerEvents: "none" }}
                transition={{
                  duration: reducedMotion ? 0 : 0.35,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="absolute inset-0 z-4 flex items-center justify-center bg-canvas px-6 text-center"
                id={statusId}
                role={screenStatus === "error" ? "alert" : "status"}
                aria-live="polite"
              >
                <div className="flex max-w-sm flex-col items-center gap-3">
                  <p className="text-xs font-semibold tracking-[0.08em] uppercase">
                    {screenStatus === "loading" && "Loading photographs"}
                    {screenStatus === "empty" && "No photographs available"}
                    {screenStatus === "error" && "Photo graph unavailable"}
                  </p>
                  {screenStatus === "loading" && (
                    <div
                      role="progressbar"
                      aria-label="Loading photographs"
                      className="h-1.5 w-48 max-w-full overflow-hidden border border-ink/40"
                    >
                      <span
                        className={`${loadingStyles.bar} block h-full w-1/3 bg-ink`}
                      />
                    </div>
                  )}
                  {screenStatus === "error" && (
                    <ControlButton
                      layout="action"
                      size="md"
                      className={photoGraphControlRowClass}
                      onClick={retry}
                    >
                      Try again
                    </ControlButton>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div
            data-mode-message={Boolean(modeMessage && !menuOpen)}
            className={`${styles.browserDock} pointer-events-none absolute bottom-2 left-2 z-10 flex max-w-[calc(100%-1rem)] flex-col items-start gap-2 pb-[env(safe-area-inset-bottom)]`}
          >
            {showControls && (
              <PhotoGraphBrowser
                graph={graphData}
                loadStatus={loadStatus}
                selectedId={selectedNode?.id ?? null}
                open={browserOpen}
                onOpenChange={setBrowserOpen}
                standalone={isFullPageRoute}
                revealEntry={menuOpen}
                statusId={statusId}
                entryRef={browserEntryRef}
                selectRef={browserSelectRef}
                onSelect={selectNode}
                onOpen={inspectNode}
              />
            )}
            {modeMessage && !menuOpen && (
              <p
                role="status"
                aria-live="polite"
                className="pointer-events-auto max-w-full border border-ink bg-canvas p-3 text-xs leading-relaxed"
              >
                {modeMessage}
              </p>
            )}
          </div>
        </div>
      </div>
      <PhotoGraphInspectOverlay
        target={inspectTarget}
        restoreFocus={restoreInspectFocus}
        onCloseComplete={closeInspect}
      />
    </div>
  );
}
