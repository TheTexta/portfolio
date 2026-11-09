"use client";

import dynamic from "next/dynamic";
import { animate, useMotionValue } from "framer-motion";

import {
  type MutableRefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
  useMemo,
  useLayoutEffect,
} from "react";

import {
  getPhotoGraphLinkValue,
  sortPhotoGraphNodesForRender,
} from "@/lib/photo-graph/force-graph";

import PhotoGraphBrowser from "./PhotoGraphBrowser";
import {
  GRAPH_CONFIG,
  PHOTO_GRAPH_ALPHA_DECAY,
  PHOTO_GRAPH_VISIBLE_SETTLE_TICKS,
} from "./config";
import type {
  PhotoGraphData,
  PhotoGraphRendererProps,
  PhotoGraphInstance,
  PhotoGraphLink,
  PhotoGraphNode,
} from "./types";
import { usePhotoGraphForces } from "./usePhotoGraphForces";
import { usePhotoGraphImages } from "./usePhotoGraphImages";
import { usePhotoGraphIntro } from "./usePhotoGraphIntro";
import {
  createRendererData,
  snapshotPositions,
  type PhotoGraphViewSnapshot,
  photoGraphForceSettingsKey,
} from "./view-state";

const ForceGraph2D = dynamic(
  () =>
    import("react-force-graph-2d").then(
      ({ default: Graph }) => Graph<PhotoGraphNode, PhotoGraphLink>,
    ),
  {
    ssr: false,
    loading: () => <div className="size-full bg-canvas" />,
  },
);

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
  // Keep the desktop camera scale on narrow screens. Mobile should reveal a
  // pannable slice of the gallery instead of shrinking every photo to fit.
  const fitWidth = Math.max(width, GRAPH_CONFIG.fitToCanvasMinWidth);
  const padding = Math.round(
    Math.min(fitWidth, height) * GRAPH_CONFIG.fitToCanvasPaddingRatio,
  );
  const availableHalfWidth = Math.max(1, (fitWidth - padding * 2) / 2);
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

type Props = PhotoGraphRendererProps & {
  fitToCanvas: boolean;
  showBrowser: boolean;
  selectedPhotoId: string | null;
  onSelect: (id: string) => void;
  snapshot: PhotoGraphViewSnapshot | null;
  onSaveSnapshot: (snapshot: PhotoGraphViewSnapshot) => void;
};

export default function PhotoGraph2DRenderer({
  controls: activeControls,
  graphData: sourceData,
  activeDarkMode,
  dimensions,
  reducedMotion,
  fitToCanvas = false,
  showBrowser,
  selectedPhotoId,
  onSelect,
  onInspect,
  snapshot,
  onSaveSnapshot,
}: Props) {
  const restoredSnapshot = useMemo(
    () => (snapshot?.data === sourceData ? snapshot : null),
    [snapshot, sourceData],
  );
  const graphData = useMemo(
    () => createRendererData(sourceData, restoredSnapshot),
    [sourceData, restoredSnapshot],
  );

  const fgRef = useRef<PhotoGraphInstance | undefined>(undefined);
  const rootRef = useRef<HTMLDivElement>(null);
  const graphMountedRef = useRef(false);
  const preparedGraphDataRef = useRef<PhotoGraphData>(EMPTY_PHOTO_GRAPH_DATA);
  const reducedMotionRef = useRef(reducedMotion);
  const connectionIntroStartedRef = useRef(false);
  const connectionIntroRunningRef = useRef(false);
  const connectionIntroAnchorRef = useRef<ConnectionIntroAnchor | null>(null);
  const connectionRevealProgressRef = useRef(0);
  const connectionRevealAnimationRef = useRef<ReturnType<
    typeof animate
  > | null>(null);
  const fitToCanvasAppliedRef = useRef(false);
  const connectionRevealProgress = useMotionValue(0);

  const [graphMounted, setGraphMounted] = useState(false);
  const [interacted, setInteracted] = useState(false);
  const configuredSettingsRef = useRef<string | null>(null);
  const forceSettings = photoGraphForceSettingsKey(activeControls);
  const retainLayout = restoredSnapshot?.forceSettings === forceSettings;
  const [preparedGraphData, setPreparedGraphData] = useState<PhotoGraphData>(
    EMPTY_PHOTO_GRAPH_DATA,
  );
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

  const handleGraphReady = useCallback(() => {
    const graph = fgRef.current;
    if (!graph || graphMountedRef.current) {
      return;
    }

    graphMountedRef.current = true;
    setGraphMounted(true);
  }, []);

  useEffect(() => {
    reducedMotionRef.current = reducedMotion;
    if (reducedMotion) {
      connectionRevealAnimationRef.current?.stop();
      releaseConnectionIntroAnchor();
      connectionIntroRunningRef.current = false;
      connectionRevealProgress.set(1);
    }
  }, [reducedMotion, connectionRevealProgress, releaseConnectionIntroAnchor]);

  useLayoutEffect(() => {
    const graph = fgRef.current;
    const root = rootRef.current;
    if (!graphMounted || !graph || !root) return;
    return () => {
      releaseConnectionIntroAnchor();
      if (!graphData.nodes.length) return;
      const saved = {
        data: sourceData,
        positions: snapshotPositions(graphData.nodes),
        camera: graph.centerAt(),
        zoom: graph.zoom(),
        forceSettings,
      };
      queueMicrotask(() => {
        if (!root.isConnected) onSaveSnapshot(saved);
      });
    };
  }, [
    graphMounted,
    graphData,
    sourceData,
    onSaveSnapshot,
    releaseConnectionIntroAnchor,
    forceSettings,
  ]);

  useEffect(() => {
    const graph = fgRef.current;
    if (!graphMounted || !graph) {
      return;
    }

    configureRuntimeForces(graph);
    reinitializeCollisionForce(graphData.nodes);
    const settingsChanged =
      configuredSettingsRef.current !== null &&
      configuredSettingsRef.current !== forceSettings;
    configuredSettingsRef.current = forceSettings;
    if (settingsChanged) queueMicrotask(() => setInteracted(true));

    if (preparedGraphDataRef.current !== graphData) {
      releaseConnectionIntroAnchor();
      preparedGraphDataRef.current = graphData;
      connectionIntroStartedRef.current = Boolean(restoredSnapshot);
      connectionRevealAnimationRef.current?.stop();
      connectionRevealProgress.set(
        reducedMotionRef.current || restoredSnapshot ? 1 : 0,
      );
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
    connectionRevealProgress,
    releaseConnectionIntroAnchor,
    reinitializeCollisionForce,
    restoredSnapshot,
    forceSettings,
  ]);

  useEffect(() => {
    const unsubscribe = connectionRevealProgress.on("change", (value) => {
      connectionRevealProgressRef.current = value;
      fgRef.current?.resumeAnimation();
    });

    return () => {
      unsubscribe();
      connectionRevealAnimationRef.current?.stop();
    };
  }, [connectionRevealProgress]);

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
    queueVisibleImages,
    showPointerCursor,
  } = usePhotoGraphImages({
    activeDarkMode,
    dimensions,
    fgRef,
    hideConnections: activeControls.hideConnections,
    nodes: preparedGraphData.nodes,
    onNodeMutation: handleNodeMutation,
    initialView: retainLayout ? restoredSnapshot : null,
  });

  useEffect(() => {
    fitToCanvasAppliedRef.current = retainLayout;
  }, [
    dimensions.height,
    dimensions.width,
    preparedGraphData.nodes,
    fitToCanvas,
    restoredSnapshot,
    retainLayout,
  ]);

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

  const handleEngineTick = useCallback(() => {
    if (!connectionIntroRunningRef.current) {
      return;
    }

    fgRef.current?.resumeAnimation();
  }, []);

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
    connectionRevealAnimationRef.current?.stop();
    connectionRevealProgress.set(0);
    connectionRevealAnimationRef.current = animate(
      connectionRevealProgress,
      1,
      {
        duration: 1.3,
        ease: [0.22, 1, 0.36, 1],
      },
    );
    connectionRevealAnimationRef.current.then(() => {
      releaseConnectionIntroAnchor();
      connectionIntroRunningRef.current = false;
    });
    graph.d3ReheatSimulation();
  }, [
    dimensions.height,
    dimensions.width,
    fitToCanvas,
    handleGraphReady,
    preparedGraphData.links.length,
    preparedGraphData.nodes,
    releaseConnectionIntroAnchor,
    connectionRevealProgress,
  ]);

  return (
    <div
      ref={rootRef}
      className="size-full [image-rendering:pixelated] [&_canvas]:[image-rendering:pixelated]"
      data-graph-mode="2d"
    >
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
          retainLayout
            ? 0
            : reducedMotion
              ? GRAPH_CONFIG.settleTicks
              : GRAPH_CONFIG.warmupTicks
        }
        cooldownTicks={
          retainLayout && !interacted
            ? 0
            : reducedMotion
              ? interacted
                ? 60
                : 0
              : PHOTO_GRAPH_VISIBLE_SETTLE_TICKS
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
        onNodeClick={onInspect}
        onNodeDrag={() => setInteracted(true)}
        onEngineTick={handleEngineTick}
        onEngineStop={queueVisibleImages}
        onZoom={handleZoom}
        onZoomEnd={handleZoomEnd}
      />
      {showBrowser && (
        <PhotoGraphBrowser
          graph={graphData}
          selectedId={selectedPhotoId}
          onSelect={(node) => {
            onSelect(node.id);
            if (Number.isFinite(node.x) && Number.isFinite(node.y)) {
              fgRef.current?.centerAt(node.x, node.y, reducedMotion ? 0 : 250);
            }
          }}
          onOpen={onInspect}
        />
      )}
    </div>
  );
}
