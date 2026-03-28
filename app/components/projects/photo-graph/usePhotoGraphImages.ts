"use client";

import {
  type RefObject,
  useCallback,
  useEffect,
  useRef,
} from "react";

import {
  getPhotoGraphLinkValue,
  normalizePhotoGraphAspectRatio,
  sizePhotoGraphNode,
} from "@/lib/photo-graph/force-graph";
import {
  buildOptimizedImageUrl,
  computeTargetImageWidth,
  shouldUpgradeWidth,
} from "@/app/components/projects/photo-graph/imageOptimizer";

import { GRAPH_CONFIG } from "./config";
import type {
  GraphTransform,
  PhotoGraphInstance,
  PhotoGraphLink,
  PhotoGraphNode,
} from "./types";
import {
  getCurrentDevicePixelRatio,
  isAbortError,
  loadImage,
} from "./utils";

type UsePhotoGraphImagesArgs = {
  activeDarkMode: boolean;
  dimensions: { width: number; height: number };
  fgRef: RefObject<PhotoGraphInstance | undefined>;
  hideConnections: boolean;
  nodes: PhotoGraphNode[];
  onNodeMutation: (resortNodes?: boolean) => void;
};

type InFlightImageRequest = {
  controller: AbortController;
  width: number;
};

export function usePhotoGraphImages({
  activeDarkMode,
  dimensions,
  fgRef,
  hideConnections,
  nodes,
  onNodeMutation,
}: UsePhotoGraphImagesArgs) {
  const errorLogRef = useRef<Set<string>>(new Set());
  const inFlightRef = useRef<Map<string, InFlightImageRequest>>(new Map());
  const initialViewAppliedRef = useRef(false);
  const transformRef = useRef<GraphTransform>({
    k: GRAPH_CONFIG.initialZoom,
    x: 0,
    y: 0,
  });

  const getNodeTargetWidth = useCallback(
    (node: PhotoGraphNode) =>
      computeTargetImageWidth(
        node,
        transformRef.current.k,
        getCurrentDevicePixelRatio(),
      ),
    [],
  );

  const getInitialNodeTargetWidth = useCallback(
    (node: PhotoGraphNode) =>
      Math.min(getNodeTargetWidth(node), GRAPH_CONFIG.initialImageMaxWidth),
    [getNodeTargetWidth],
  );

  const logNodeImageError = useCallback((node: PhotoGraphNode, error: unknown) => {
    if (errorLogRef.current.has(node.id)) {
      return;
    }

    errorLogRef.current.add(node.id);
    console.error(`Failed to load image for node ${node.id}`, error);
  }, []);

  const applyLoadedImage = useCallback(
    (node: PhotoGraphNode, image: HTMLImageElement, loadedWidth: number) => {
      if (!shouldUpgradeWidth(node.loadedWidth, loadedWidth)) {
        return;
      }

      let resortNodes = false;
      if (!node.hasKnownAspectRatio) {
        const width = image.naturalWidth || image.width;
        const height = image.naturalHeight || image.height;

        if (width && height) {
          node.aspectRatio = normalizePhotoGraphAspectRatio(width / height);
          sizePhotoGraphNode(node);
          node.hasKnownAspectRatio = true;
          resortNodes = true;
        }
      }

      node.image = image;
      node.loadedWidth = loadedWidth;
      onNodeMutation(resortNodes);
    },
    [onNodeMutation],
  );

  const loadNodeImage = useCallback(
    async (node: PhotoGraphNode, targetWidth: number) => {
      if (!shouldUpgradeWidth(node.loadedWidth, targetWidth)) {
        return;
      }

      const currentRequest = inFlightRef.current.get(node.id);
      if (currentRequest) {
        if (currentRequest.width >= targetWidth) {
          return;
        }

        currentRequest.controller.abort();
      }

      const optimizedUrl = buildOptimizedImageUrl(
        node.storagePath,
        node.sourceUrl,
        targetWidth,
      );
      if (!optimizedUrl) {
        logNodeImageError(
          node,
          new Error(`Missing image URL for photo graph node ${node.id}.`),
        );
        return;
      }

      const controller = new AbortController();
      inFlightRef.current.set(node.id, {
        controller,
        width: targetWidth,
      });

      try {
        const image = await loadImage(optimizedUrl, controller.signal);
        if (controller.signal.aborted) {
          return;
        }

        const activeRequest = inFlightRef.current.get(node.id);
        if (!activeRequest || activeRequest.controller !== controller) {
          return;
        }

        applyLoadedImage(node, image, targetWidth);
      } catch (error) {
        if (!isAbortError(error)) {
          logNodeImageError(node, error);
        }
      } finally {
        const activeRequest = inFlightRef.current.get(node.id);
        if (activeRequest?.controller === controller) {
          inFlightRef.current.delete(node.id);
        }
      }
    },
    [applyLoadedImage, logNodeImageError],
  );

  const requestNodeImage = useCallback(
    (node: PhotoGraphNode, targetWidth: number) => {
      void loadNodeImage(node, targetWidth);
    },
    [loadNodeImage],
  );

  const isNodeVisible = useCallback(
    (node: PhotoGraphNode) => {
      const graph = fgRef.current;
      if (!graph || !dimensions.width || !dimensions.height) {
        return true;
      }

      const { x, y } = graph.graph2ScreenCoords(node.x ?? 0, node.y ?? 0);
      const bufferX = dimensions.width * GRAPH_CONFIG.viewportBufferRatio;
      const bufferY = dimensions.height * GRAPH_CONFIG.viewportBufferRatio;
      const halfWidth = (node.w * transformRef.current.k) / 2;
      const halfHeight = (node.h * transformRef.current.k) / 2;

      return (
        x + halfWidth >= -bufferX &&
        x - halfWidth <= dimensions.width + bufferX &&
        y + halfHeight >= -bufferY &&
        y - halfHeight <= dimensions.height + bufferY
      );
    },
    [dimensions.height, dimensions.width, fgRef],
  );

  const queueNodes = useCallback(
    (nextNodes: PhotoGraphNode[], resolveWidth: (node: PhotoGraphNode) => number) => {
      for (const node of nextNodes) {
        requestNodeImage(node, resolveWidth(node));
      }
    },
    [requestNodeImage],
  );

  const queueVisibleImages = useCallback(() => {
    queueNodes(nodes.filter(isNodeVisible), getNodeTargetWidth);
  }, [getNodeTargetWidth, isNodeVisible, nodes, queueNodes]);

  const getInitialLoadQueue = useCallback(() => {
    const graph = fgRef.current;
    if (!graph || !dimensions.width || !dimensions.height) {
      return nodes.slice(0, GRAPH_CONFIG.initialImageFallbackCount);
    }

    const center = graph.centerAt();
    const visibleNodes: { node: PhotoGraphNode; distance: number }[] = [];

    for (const node of nodes) {
      if (!isNodeVisible(node)) {
        continue;
      }

      const deltaX = (node.x ?? 0) - center.x;
      const deltaY = (node.y ?? 0) - center.y;
      visibleNodes.push({
        node,
        distance: Math.hypot(deltaX, deltaY),
      });
    }

    visibleNodes.sort((left, right) => left.distance - right.distance);

    const prioritizedVisibleNodes = visibleNodes
      .slice(0, GRAPH_CONFIG.initialVisibleImageCount)
      .map(({ node }) => node);

    return prioritizedVisibleNodes.length
      ? prioritizedVisibleNodes
      : nodes.slice(0, GRAPH_CONFIG.initialImageFallbackCount);
  }, [dimensions.height, dimensions.width, fgRef, isNodeVisible, nodes]);

  useEffect(() => {
    initialViewAppliedRef.current = false;
    errorLogRef.current = new Set();
    transformRef.current = {
      k: GRAPH_CONFIG.initialZoom,
      x: 0,
      y: 0,
    };

    for (const request of inFlightRef.current.values()) {
      request.controller.abort();
    }
    inFlightRef.current.clear();

    for (const node of nodes) {
      node.image = undefined;
      node.loadedWidth = undefined;
    }
  }, [nodes]);

  useEffect(() => {
    const graph = fgRef.current;
    if (
      !graph ||
      !nodes.length ||
      !dimensions.width ||
      !dimensions.height ||
      initialViewAppliedRef.current
    ) {
      return;
    }

    initialViewAppliedRef.current = true;
    graph.centerAt(0, 0, 0);
    graph.zoom(GRAPH_CONFIG.initialZoom, 0);
    transformRef.current = {
      k: GRAPH_CONFIG.initialZoom,
      x: 0,
      y: 0,
    };

    const frame = window.requestAnimationFrame(() => {
      queueNodes(getInitialLoadQueue(), getInitialNodeTargetWidth);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [
    dimensions.height,
    dimensions.width,
    fgRef,
    getInitialLoadQueue,
    getInitialNodeTargetWidth,
    nodes,
    queueNodes,
  ]);

  useEffect(() => {
    if (!initialViewAppliedRef.current || !nodes.length) {
      return;
    }

    queueVisibleImages();
  }, [dimensions.height, dimensions.width, nodes, queueVisibleImages]);

  const nodeCanvasObject = useCallback(
    (node: PhotoGraphNode, context: CanvasRenderingContext2D) => {
      const left = (node.x ?? 0) - node.w / 2;
      const top = (node.y ?? 0) - node.h / 2;

      if (node.image) {
        context.drawImage(node.image, left, top, node.w, node.h);
        return;
      }

      context.fillStyle = activeDarkMode
        ? "rgba(255, 255, 255, 0.12)"
        : "#ffffff46";
      context.fillRect(left, top, node.w, node.h);
    },
    [activeDarkMode],
  );

  const nodePointerAreaPaint = useCallback(
    (
      node: PhotoGraphNode,
      color: string,
      context: CanvasRenderingContext2D,
    ) => {
      context.fillStyle = color;
      context.fillRect(
        (node.x ?? 0) - node.w / 2,
        (node.y ?? 0) - node.h / 2,
        node.w,
        node.h,
      );
    },
    [],
  );

  const linkVisibility = useCallback(
    (link: PhotoGraphLink) =>
      !hideConnections && getPhotoGraphLinkValue(link) > 0,
    [hideConnections],
  );

  const handleZoom = useCallback((transform: GraphTransform) => {
    transformRef.current = transform;
  }, []);

  const handleZoomEnd = useCallback(
    (transform: GraphTransform) => {
      transformRef.current = transform;
      queueVisibleImages();
    },
    [queueVisibleImages],
  );

  const showPointerCursor = useCallback(
    (obj: PhotoGraphNode | PhotoGraphLink | undefined) =>
      Boolean(obj && "sourceUrl" in obj),
    [],
  );

  return {
    handleZoom,
    handleZoomEnd,
    linkVisibility,
    nodeCanvasObject,
    nodePointerAreaPaint,
    showPointerCursor,
  };
}
