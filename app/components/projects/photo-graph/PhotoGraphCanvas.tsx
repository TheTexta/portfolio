"use client";

import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentType,
} from "react";

import { useTheme } from "@/app/components/theme/theme-provider";
import { PROJECT_ROUTES } from "@/app/components/projects/project-routes";
import { ControlButton } from "@/app/components/ui/control";
import ExperienceNav from "@/app/components/ui/experience-nav";
import { photoGraphMediaUrl } from "@/lib/photo-graph/media-url";
import { useReducedMotion } from "@/app/hooks/use-reduced-motion";

import PhotoGraph2DRenderer from "./PhotoGraph2DRenderer";
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
  PhotoGraphNode,
} from "./types";
import type { PhotoGraph3DRendererProps } from "./PhotoGraph3DRenderer";
import type { PhotoGraphViewSnapshot } from "./view-state";
import { usePhotoGraphData } from "./usePhotoGraphData";
import styles from "./photo-graph-controls.module.css";

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
  const [twoDSnapshot, setTwoDSnapshot] =
    useState<PhotoGraphViewSnapshot | null>(null);
  const [threeDSnapshot, setThreeDSnapshot] =
    useState<PhotoGraphViewSnapshot | null>(null);
  const modeRequestRef = useRef(0);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
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
  const activeControls =
    controlledControls ??
    (hasLocalControlOverride
      ? uncontrolledControls
      : (defaultGraphControls ?? uncontrolledControls));

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const update = (width: number, height: number) => {
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

  const inspectNode = useCallback((node: PhotoGraphNode) => {
    setSelectedPhotoId(node.id);
    setInspectTarget({
      id: node.id,
      originalUrl: node.sourceUrl,
      previewUrl: buildInspectPreviewUrl(node),
    });
  }, []);
  const closeInspect = useCallback(() => setInspectTarget(null), []);
  const is3D = canUse3D && mode === "3d" && ThreeDRenderer !== null;

  return (
    <div
      className={`${styles.shell} static size-full transition-colors ${photoGraphShellClass}`}
    >
      <div
        aria-hidden={inspectTarget ? true : undefined}
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
          tabIndex={-1}
          className="relative size-full bg-canvas"
        >
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
                  onInspect={inspectNode}
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
                onInspect={inspectNode}
                fitToCanvas={fitToCanvas}
                showBrowser={
                  showControls && !isFullPageRoute && loadStatus === "ready"
                }
                selectedPhotoId={selectedPhotoId}
                onSelect={setSelectedPhotoId}
                snapshot={twoDSnapshot}
                onSaveSnapshot={setTwoDSnapshot}
                resetViewKey={resetViewKey}
              />
            ))}
          {loadStatus !== "ready" && (
            <div
              className="absolute inset-0 z-4 flex items-center justify-center bg-canvas/90 px-6 text-center"
              role={loadStatus === "error" ? "alert" : "status"}
              aria-live="polite"
            >
              <div className="flex max-w-sm flex-col items-center gap-3">
                <p className="text-xs font-semibold tracking-[0.08em] uppercase">
                  {loadStatus === "loading" && "Loading photographs"}
                  {loadStatus === "empty" && "No photographs available"}
                  {loadStatus === "error" && "Photo graph unavailable"}
                </p>
                {loadStatus === "error" && (
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
            </div>
          )}
          {modeMessage && !menuOpen && (
            <p
              role="status"
              aria-live="polite"
              className="absolute bottom-2 left-2 z-4 max-w-[calc(100%-1rem)] border border-ink bg-canvas p-3 text-xs leading-relaxed"
            >
              {modeMessage}
            </p>
          )}
        </div>
      </div>
      <PhotoGraphInspectOverlay
        target={inspectTarget}
        returnFocusRef={containerRef}
        onCloseComplete={closeInspect}
      />
    </div>
  );
}
