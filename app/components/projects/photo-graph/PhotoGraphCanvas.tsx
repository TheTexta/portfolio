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
import OverlayNavBar from "@/app/components/ui/overlay-nav-bar";
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
  PHOTO_GRAPH_INSPECT_PREVIEW_QUALITY,
  PHOTO_GRAPH_INSPECT_PREVIEW_WIDTH,
  photoGraphShellClass,
} from "./config";
import type {
  GraphControls,
  InspectTarget,
  PhotoGraphCanvasProps,
  PhotoGraphInstance,
  PhotoGraphLink,
  PhotoGraphNode,
} from "./types";
import { usePhotoGraphData } from "./usePhotoGraphData";
import { usePhotoGraphForces } from "./usePhotoGraphForces";
import { usePhotoGraphImages } from "./usePhotoGraphImages";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-white dark:bg-black" />,
}) as unknown as (props: Record<string, unknown>) => ReactElement;

function fitGraphToWeightedCenter(
  graph: PhotoGraphInstance,
  nodes: PhotoGraphNode[],
  width: number,
  height: number,
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

  graph.centerAt(centerX, centerY, GRAPH_CONFIG.fitToCanvasDurationMs);
  graph.zoom(zoom, GRAPH_CONFIG.fitToCanvasDurationMs);
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
  const { darkMode: siteDarkMode, toggleTheme } = useTheme();
  const activeDarkMode = forcedDarkMode ?? siteDarkMode;
  const isFullPageRoute = usePathname() === PROJECT_ROUTES.photoGraph;

  const fgRef = useRef<PhotoGraphInstance | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fitToCanvasAppliedRef = useRef(false);
  const fitToCanvasTickCountRef = useRef(0);

  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [menuOpen, setMenuOpen] = useState(false);
  const [uncontrolledControls, setUncontrolledControls] = useState<GraphControls>({
    ...defaultControls,
  });
  const [hasLocalControlOverride, setHasLocalControlOverride] = useState(false);
  const [inspectTarget, setInspectTarget] = useState<InspectTarget | null>(
    null,
  );

  const {
    defaultGraphControls: fetchedDefaultGraphControls,
    graphData,
  } = usePhotoGraphData(graphUrl);
  const activeControls =
    controlledControls ??
    (hasLocalControlOverride
      ? uncontrolledControls
      : fetchedDefaultGraphControls ?? uncontrolledControls);
  const { reinitializeCollisionForce } = usePhotoGraphForces({
    fgRef,
    nodes: graphData.nodes,
    controls: activeControls,
  });

  const handleNodeMutation = useCallback(
    (resortNodes = false) => {
      if (!resortNodes) {
        return;
      }

      sortPhotoGraphNodesForRender(graphData.nodes);
      reinitializeCollisionForce(graphData.nodes);
    },
    [graphData.nodes, reinitializeCollisionForce],
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
    nodes: graphData.nodes,
    onNodeMutation: handleNodeMutation,
  });

  useEffect(() => {
    fitToCanvasAppliedRef.current = false;
    fitToCanvasTickCountRef.current = 0;
  }, [dimensions.height, dimensions.width, graphData.nodes, fitToCanvas]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }

      const width = Math.max(1, Math.round(entry.contentRect.width));
      const height = Math.max(1, Math.round(entry.contentRect.height));

      setDimensions((current) =>
        current.width === width && current.height === height
          ? current
          : { width, height },
      );
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  const linkColor = useCallback((link: PhotoGraphLink) => {
    const alpha = getPhotoGraphLinkValue(link);

    return activeDarkMode
      ? `rgba(255, 255, 255, ${0.72 * alpha})`
      : `rgba(0, 0, 0, ${alpha})`;
  }, [activeDarkMode]);

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
    if (!fitToCanvas || fitToCanvasAppliedRef.current || !fgRef.current) {
      return;
    }

    fitToCanvasTickCountRef.current += 1;
    if (fitToCanvasTickCountRef.current < GRAPH_CONFIG.fitToCanvasMinTicks) {
      return;
    }

    const positionedNodes = graphData.nodes.filter(
      (node) => Number.isFinite(node.x) && Number.isFinite(node.y),
    );
    if (!positionedNodes.length) {
      return;
    }

    fitToCanvasAppliedRef.current = true;
    fitGraphToWeightedCenter(
      fgRef.current,
      positionedNodes,
      dimensions.width,
      dimensions.height,
    );
  }, [
    dimensions.height,
    dimensions.width,
    fitToCanvas,
    graphData.nodes,
  ]);

  return (
    <div
      className={`static h-full w-full transition-colors ${photoGraphShellClass}`}
    >
      <div
        className={`h-full w-full transition-[opacity,filter] duration-200 ${
          inspectTarget
            ? "pointer-events-none opacity-35 blur-[1px]"
            : "opacity-100"
        }`}
      >
        {showControls && (
          <PhotoGraphControls
            menuOpen={menuOpen}
            controls={activeControls}
            onMenuOpen={() => setMenuOpen(true)}
            onMenuClose={() => setMenuOpen(false)}
            onControlChange={setControlValue}
          />
        )}

        {showNavigation && (
          <OverlayNavBar
            darkMode={isFullPageRoute ? activeDarkMode : undefined}
            onToggleDarkMode={
              isFullPageRoute && forcedDarkMode === undefined
                ? toggleTheme
                : undefined
            }
            expandHref={isFullPageRoute ? undefined : PROJECT_ROUTES.photoGraph}
            exitHref={isFullPageRoute ? PROJECT_ROUTES.home : undefined}
            ariaLabel="Photo graph controls"
          />
        )}

        <div
          ref={containerRef}
          className="relative h-full w-full bg-white [image-rendering:pixelated] dark:bg-black [&_canvas]:[image-rendering:pixelated]"
        >
          {dimensions.width > 0 && dimensions.height > 0 && (
            <ForceGraph2D
              ref={
                fgRef as MutableRefObject<PhotoGraphInstance | undefined>
              }
              graphData={graphData}
              width={dimensions.width}
              height={dimensions.height}
              minZoom={GRAPH_CONFIG.zoomExtent[0]}
              maxZoom={GRAPH_CONFIG.zoomExtent[1]}
              // Photo nodes repaint asynchronously as images load in.
              autoPauseRedraw={false}
              nodeCanvasObjectMode={() => "replace"}
              nodeCanvasObject={nodeCanvasObject}
              nodePointerAreaPaint={nodePointerAreaPaint}
              linkColor={linkColor}
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
        </div>
      </div>

      <PhotoGraphInspectOverlay
        target={inspectTarget}
        onCloseComplete={() => setInspectTarget(null)}
      />
    </div>
  );
}
