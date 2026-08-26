"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";

import {
  type MutableRefObject,
  type ReactElement,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { useTheme } from "@/app/components/theme/theme-provider";
import { PROJECT_ROUTES } from "@/app/components/projects/project-routes";
import { ControlButton } from "@/app/components/ui/control";
import ExperienceNav from "@/app/components/ui/experience-nav";
import {
  getPhotoGraphLinkValue,
  sortPhotoGraphNodesForRender,
} from "@/lib/photo-graph/force-graph";
import { buildSupabaseStorageRenderUrl } from "@/lib/supabase/config";

import PhotoGraphControls from "./PhotoGraphControls";
import PhotoGraphInspectOverlay from "./PhotoGraphInspectOverlay";
import {
  DEFAULT_GRAPH_CONTROLS,
  GRAPH_CONFIG,
  PHOTO_GRAPH_ALPHA_DECAY,
  PHOTO_GRAPH_VISIBLE_SETTLE_TICKS,
  PHOTO_GRAPH_INSPECT_PREVIEW_QUALITY,
  PHOTO_GRAPH_INSPECT_PREVIEW_WIDTH,
  photoGraphShellClass,
} from "./config";
import type {
  GraphControls,
  InspectTarget,
  PhotoGraphData,
  PhotoGraphCanvasProps,
  PhotoGraphInstance,
  PhotoGraphLink,
  PhotoGraphNode,
} from "./types";
import { usePhotoGraphData } from "./usePhotoGraphData";
import { usePhotoGraphForces } from "./usePhotoGraphForces";
import { usePhotoGraphImages } from "./usePhotoGraphImages";
import { usePhotoGraphIntro } from "./usePhotoGraphIntro";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
  loading: () => <div className="bg-canvas h-full w-full" />,
}) as unknown as (props: Record<string, unknown>) => ReactElement;

const EMPTY_PHOTO_GRAPH_DATA: PhotoGraphData = { nodes: [], links: [] };

type ConnectionIntroAnchor = {
  node: PhotoGraphNode;
  previousFx: number | undefined;
  previousFy: number | undefined;
  pinnedFx: number;
  pinnedFy: number;
};

function fitGraphToWeightedCenter(
  graph: PhotoGraphInstance,
  nodes: PhotoGraphNode[],
  width: number,
  height: number,
  durationOverride?: number,
) {
  const padding = Math.round(
    Math.min(width, height) * GRAPH_CONFIG.fitToCanvasPaddingRatio,
  );
  const availableHalfWidth = Math.max(1, (width - padding * 2) / 2);
  const availableHalfHeight = Math.max(1, (height - padding * 2) / 2);

  let totalWeight = 0;
  let weightedX = 0;
  let weightedY = 0;
  let minLeft = Number.POSITIVE_INFINITY;
  let maxRight = Number.NEGATIVE_INFINITY;
  let minTop = Number.POSITIVE_INFINITY;
  let maxBottom = Number.NEGATIVE_INFINITY;

  for (const node of nodes) {
    const x = node.x ?? 0;
    const y = node.y ?? 0;
    const halfWidth = node.w / 2;
    const halfHeight = node.h / 2;
    const weight = Math.max(1, node.renderArea || node.w * node.h || 1);

    totalWeight += weight;
    weightedX += x * weight;
    weightedY += y * weight;

    minLeft = Math.min(minLeft, x - halfWidth);
    maxRight = Math.max(maxRight, x + halfWidth);
    minTop = Math.min(minTop, y - halfHeight);
    maxBottom = Math.max(maxBottom, y + halfHeight);
  }

  if (
    !Number.isFinite(totalWeight) ||
    totalWeight <= 0 ||
    !Number.isFinite(minLeft) ||
    !Number.isFinite(maxRight) ||
    !Number.isFinite(minTop) ||
    !Number.isFinite(maxBottom)
  ) {
    return;
  }

  const centerX = weightedX / totalWeight;
  const centerY = weightedY / totalWeight;
  const extentX = Math.max(centerX - minLeft, maxRight - centerX, 1);
  const extentY = Math.max(centerY - minTop, maxBottom - centerY, 1);
  const zoom = Math.max(
    GRAPH_CONFIG.zoomExtent[0],
    Math.min(
      GRAPH_CONFIG.zoomExtent[1],
      availableHalfWidth / extentX,
      availableHalfHeight / extentY,
    ),
  );

  const duration =
    durationOverride ??
    (window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? 0
      : GRAPH_CONFIG.fitToCanvasDurationMs);

  graph.centerAt(centerX, centerY, duration);
  graph.zoom(zoom, duration);
}

function buildInspectPreviewUrl(node: PhotoGraphNode) {
  if (!node.storagePath) {
    return node.sourceUrl;
  }

  return buildSupabaseStorageRenderUrl(node.storagePath, {
    width: PHOTO_GRAPH_INSPECT_PREVIEW_WIDTH,
    quality: PHOTO_GRAPH_INSPECT_PREVIEW_QUALITY,
  });
}

export default function PhotoGraphCanvas({
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

  const fgRef = useRef<PhotoGraphInstance | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const graphMountedRef = useRef(false);
  const preparedGraphDataRef = useRef<PhotoGraphData>(EMPTY_PHOTO_GRAPH_DATA);
  const reducedMotionRef = useRef(false);
  const connectionIntroStartedRef = useRef(false);
  const connectionIntroRunningRef = useRef(false);
  const connectionIntroAnchorRef = useRef<ConnectionIntroAnchor | null>(null);
  const visibleSettleTickCountRef = useRef(0);
  const connectionRevealProgressRef = useRef(0);
  const fitToCanvasAppliedRef = useRef(false);

  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [graphMounted, setGraphMounted] = useState(false);
  const [reducedMotion, setReducedMotion] = useState<boolean | null>(null);
  const [preparedGraphData, setPreparedGraphData] =
    useState<PhotoGraphData>(EMPTY_PHOTO_GRAPH_DATA);
  const [menuOpen, setMenuOpen] = useState(false);
  const [uncontrolledControls, setUncontrolledControls] =
    useState<GraphControls>({
      ...defaultControls,
    });
  const [hasLocalControlOverride, setHasLocalControlOverride] = useState(false);
  const [inspectTarget, setInspectTarget] = useState<InspectTarget | null>(
    null,
  );
  const {
    defaultGraphControls: fetchedDefaultGraphControls,
    graphData,
    loadStatus,
    retry,
  } = usePhotoGraphData(graphUrl);
  const activeControls =
    controlledControls ??
    (hasLocalControlOverride
      ? uncontrolledControls
      : (fetchedDefaultGraphControls ?? uncontrolledControls));
  const { configureRuntimeForces, reinitializeCollisionForce } =
    usePhotoGraphForces({
      fgRef,
      nodes: graphData.nodes,
      controls: activeControls,
    });

  const releaseConnectionIntroAnchor = useCallback(() => {
    const anchor = connectionIntroAnchorRef.current;
    if (!anchor) {
      return;
    }

    if (
      anchor.node.fx === anchor.pinnedFx &&
      anchor.node.fy === anchor.pinnedFy
    ) {
      anchor.node.fx = anchor.previousFx;
      anchor.node.fy = anchor.previousFy;
    }
    connectionIntroAnchorRef.current = null;
  }, []);

  const handleGraphReady = useCallback(
    () => {
      const graph = fgRef.current;
      if (!graph || graphMountedRef.current) {
        return;
      }

      graphMountedRef.current = true;
      setGraphMounted(true);
    },
    [],
  );

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        reducedMotionRef.current = prefersReducedMotion;
        setReducedMotion(prefersReducedMotion);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const graph = fgRef.current;
    if (!graphMounted || !graph) {
      return;
    }

    configureRuntimeForces(graph);
    reinitializeCollisionForce(graphData.nodes);

    if (preparedGraphDataRef.current !== graphData) {
      releaseConnectionIntroAnchor();
      preparedGraphDataRef.current = graphData;
      connectionIntroStartedRef.current = false;
      visibleSettleTickCountRef.current = 0;
      connectionRevealProgressRef.current = reducedMotionRef.current ? 1 : 0;
      let cancelled = false;
      queueMicrotask(() => {
        if (!cancelled) {
          setPreparedGraphData(graphData);
        }
      });

      return () => {
        cancelled = true;
      };
    }

    if (graphData.nodes.length) {
      graph.d3ReheatSimulation();
    }
  }, [
    configureRuntimeForces,
    graphData,
    graphMounted,
    releaseConnectionIntroAnchor,
    reinitializeCollisionForce,
  ]);

  const handleNodeMutation = useCallback(
    (resortNodes = false) => {
      if (!resortNodes) {
        return;
      }

      sortPhotoGraphNodesForRender(preparedGraphData.nodes);
      reinitializeCollisionForce(preparedGraphData.nodes);
    },
    [preparedGraphData.nodes, reinitializeCollisionForce],
  );

  const {
    handleZoom,
    handleZoomEnd,
    linkVisibility,
    nodeCanvasObject,
    nodePointerAreaPaint,
    showPointerCursor,
  } = usePhotoGraphImages({
    activeDarkMode,
    dimensions,
    fgRef,
    hideConnections: activeControls.hideConnections,
    nodes: preparedGraphData.nodes,
    onNodeMutation: handleNodeMutation,
  });

  useEffect(() => {
    fitToCanvasAppliedRef.current = false;
  }, [dimensions.height, dimensions.width, preparedGraphData.nodes, fitToCanvas]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const updateDimensions = (width: number, height: number) => {
      const nextWidth = Math.max(1, Math.round(width));
      const nextHeight = Math.max(1, Math.round(height));

      setDimensions((current) =>
        current.width === nextWidth && current.height === nextHeight
          ? current
          : { width: nextWidth, height: nextHeight },
      );
    };

    const initialBounds = container.getBoundingClientRect();
    updateDimensions(initialBounds.width, initialBounds.height);

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }

      updateDimensions(entry.contentRect.width, entry.contentRect.height);
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  const linkColor = useCallback(
    (link: PhotoGraphLink) => {
      const alpha = getPhotoGraphLinkValue(link);

      return activeDarkMode
        ? `rgba(255, 255, 255, ${0.72 * alpha})`
        : `rgba(0, 0, 0, ${alpha})`;
    },
    [activeDarkMode],
  );
  const { linkCanvasObject } = usePhotoGraphIntro({
    revealProgressRef: connectionRevealProgressRef,
    linkColor,
  });

  const setControlValue = useCallback(
    (key: keyof GraphControls, value: boolean | number) => {
      const nextControls = {
        ...activeControls,
        [key]: value,
      } as GraphControls;

      if (controlledControls) {
        onControlsChange?.(nextControls);
        return;
      }

      setHasLocalControlOverride(true);
      setUncontrolledControls((current) =>
        current[key] === value ? current : nextControls,
      );
    },
    [activeControls, controlledControls, onControlsChange],
  );

  const handleEngineTick = useCallback(() => {
    if (
      reducedMotionRef.current ||
      !connectionIntroRunningRef.current ||
      visibleSettleTickCountRef.current >= PHOTO_GRAPH_VISIBLE_SETTLE_TICKS
    ) {
      return;
    }

    visibleSettleTickCountRef.current += 1;
    connectionRevealProgressRef.current =
      visibleSettleTickCountRef.current / PHOTO_GRAPH_VISIBLE_SETTLE_TICKS;

    if (
      visibleSettleTickCountRef.current === PHOTO_GRAPH_VISIBLE_SETTLE_TICKS
    ) {
      releaseConnectionIntroAnchor();
      connectionIntroRunningRef.current = false;
    }
  }, [releaseConnectionIntroAnchor]);

  const handleRenderFramePre = useCallback(() => {
    handleGraphReady();

    if (!fitToCanvas || fitToCanvasAppliedRef.current || !fgRef.current) {
      // The intro can still run in embedded canvases that keep their own camera.
    } else {
      const positionedNodes = preparedGraphData.nodes.filter(
        (node) => Number.isFinite(node.x) && Number.isFinite(node.y),
      );
      if (positionedNodes.length) {
        fitToCanvasAppliedRef.current = true;
        fitGraphToWeightedCenter(
          fgRef.current,
          positionedNodes,
          dimensions.width,
          dimensions.height,
          0,
        );
      }
    }

    const graph = fgRef.current;
    if (
      !graph ||
      reducedMotionRef.current ||
      connectionIntroStartedRef.current ||
      preparedGraphData.links.length === 0
    ) {
      return;
    }

    const anchorNode = preparedGraphData.nodes.reduce<PhotoGraphNode | null>(
      (closest, node) => {
        if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) {
          return closest;
        }
        if (!closest) {
          return node;
        }

        const nodePoint = graph.graph2ScreenCoords(node.x ?? 0, node.y ?? 0);
        const closestPoint = graph.graph2ScreenCoords(
          closest.x ?? 0,
          closest.y ?? 0,
        );
        const centerX = dimensions.width / 2;
        const centerY = dimensions.height / 2;
        return Math.hypot(nodePoint.x - centerX, nodePoint.y - centerY) <
          Math.hypot(closestPoint.x - centerX, closestPoint.y - centerY)
          ? node
          : closest;
      },
      null,
    );
    if (!anchorNode) {
      return;
    }

    const zoom = Math.max(graph.zoom(), Number.EPSILON);
    const pinnedFx =
      (anchorNode.x ?? 0) + GRAPH_CONFIG.connectionIntroDragDistancePx / zoom;
    const pinnedFy = anchorNode.y ?? 0;
    connectionIntroAnchorRef.current = {
      node: anchorNode,
      previousFx: anchorNode.fx,
      previousFy: anchorNode.fy,
      pinnedFx,
      pinnedFy,
    };
    anchorNode.x = pinnedFx;
    anchorNode.y = pinnedFy;
    anchorNode.fx = pinnedFx;
    anchorNode.fy = pinnedFy;
    connectionIntroStartedRef.current = true;
    connectionIntroRunningRef.current = true;
    graph.d3ReheatSimulation();
  }, [
    dimensions.height,
    dimensions.width,
    fitToCanvas,
    handleGraphReady,
    preparedGraphData.links.length,
    preparedGraphData.nodes,
  ]);

  return (
    <div
      className={`static h-full w-full transition-colors ${photoGraphShellClass}`}
    >
      <div
        aria-hidden={inspectTarget ? true : undefined}
        className={`h-full w-full transition-opacity duration-200 motion-reduce:transition-none ${
          inspectTarget ? "pointer-events-none opacity-35" : "opacity-100"
        }`}
      >
        {showControls && (
          <PhotoGraphControls
            menuOpen={menuOpen}
            controls={activeControls}
            showTheme={isFullPageRoute && forcedDarkMode === undefined}
            onMenuOpen={() => setMenuOpen(true)}
            onMenuClose={() => setMenuOpen(false)}
            onControlChange={setControlValue}
          />
        )}

        {showNavigation && (
          <ExperienceNav
            caseStudyHref={
              isFullPageRoute ? PROJECT_ROUTES.photoGraph : undefined
            }
            experienceHref={
              isFullPageRoute ? undefined : PROJECT_ROUTES.photoGraphExperience
            }
            ariaLabel="Photo graph controls"
          />
        )}

        <div
          ref={containerRef}
          className="bg-canvas relative h-full w-full [image-rendering:pixelated] [&_canvas]:[image-rendering:pixelated]"
        >
          {dimensions.width > 0 &&
            dimensions.height > 0 &&
            reducedMotion !== null && (
            <ForceGraph2D
              ref={fgRef as MutableRefObject<PhotoGraphInstance | undefined>}
              graphData={preparedGraphData}
              width={dimensions.width}
              height={dimensions.height}
              minZoom={GRAPH_CONFIG.zoomExtent[0]}
              maxZoom={GRAPH_CONFIG.zoomExtent[1]}
              d3AlphaMin={0}
              d3AlphaDecay={PHOTO_GRAPH_ALPHA_DECAY}
              warmupTicks={
                reducedMotion
                  ? GRAPH_CONFIG.settleTicks
                  : GRAPH_CONFIG.warmupTicks
              }
              cooldownTicks={
                reducedMotion ? 0 : PHOTO_GRAPH_VISIBLE_SETTLE_TICKS
              }
              cooldownTime={Infinity}
              // Photo nodes repaint asynchronously as images load in.
              autoPauseRedraw={false}
              onRenderFramePre={handleRenderFramePre}
              nodeCanvasObjectMode={() => "replace"}
              nodeCanvasObject={nodeCanvasObject}
              nodePointerAreaPaint={nodePointerAreaPaint}
              linkColor={linkColor}
              linkCanvasObjectMode={() => "replace"}
              linkCanvasObject={linkCanvasObject}
              linkVisibility={linkVisibility}
              showPointerCursor={showPointerCursor}
              onNodeClick={(node: PhotoGraphNode) =>
                setInspectTarget({
                  id: node.id,
                  originalUrl: node.sourceUrl,
                  previewUrl: buildInspectPreviewUrl(node),
                })
              }
              onEngineTick={handleEngineTick}
              onZoom={handleZoom}
              onZoomEnd={handleZoomEnd}
            />
          )}
          {loadStatus !== "ready" && (
            <div
              className="bg-canvas/90 absolute inset-0 z-[4] flex items-center justify-center px-6 text-center"
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
                  <ControlButton layout="action" size="sm" onClick={retry}>
                    Try again
                  </ControlButton>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <PhotoGraphInspectOverlay
        target={inspectTarget}
        onCloseComplete={() => setInspectTarget(null)}
      />
    </div>
  );
}
