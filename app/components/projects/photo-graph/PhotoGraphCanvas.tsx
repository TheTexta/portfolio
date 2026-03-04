"use client";

import { usePathname } from "next/navigation";

import { useCallback, useEffect, useRef, useState } from "react";
import * as d3 from "d3";

import { Download, Menu, X } from "lucide-react";

import { useTheme } from "@/app/components/theme/theme-provider";
import { getProjectChrome } from "@/app/components/projects/project-chrome";
import { PROJECT_ROUTES } from "@/app/components/projects/project-routes";
import {
  buildOptimizedImageUrl,
  computeTargetImageWidth,
  shouldUpgradeWidth,
} from "@/app/components/projects/photo-graph/imageOptimizer";
import { OverlayIconButton } from "@/app/components/ui/overlay-icon-button";
import OverlayNavBar from "@/app/components/ui/overlay-nav-bar";
import { storage } from "@/app/components/projects/photo-graph/firebaseClient";
import { getDownloadURL, ref } from "firebase/storage";

// TODO: find a way to generate json edge data when new images added.

type RawNode = {
  id?: string | number;
  scale?: number;
  colour?: string;
  correlations?: Record<string, number>;
  url?: string;
};

type SimNode = d3.SimulationNodeDatum & {
  id: string;
  colour?: string;
  sourceUrl: string;
  w: number;
  h: number;
  loadedWidth?: number;
  requestedWidth?: number;
  hasInitialImage?: boolean;
  fx?: number | null;
  fy?: number | null;
  _grab?: { dx: number; dy: number };
};

type SimLink = d3.SimulationLinkDatum<SimNode> & {
  source: string | SimNode;
  target: string | SimNode;
  value: number;
  _baseValue?: number;
};

type CanvasInputEvent = MouseEvent | TouchEvent | PointerEvent | WheelEvent;

type PhotoGraphCanvasProps = {
  graphUrl?: string;
  imageBasePath?: string;
  forcedDarkMode?: boolean;
};

type GraphControls = {
  hideConnections: boolean;
  chargeMult: number;
  distMinMult: number;
  distMaxMult: number;
};

type InspectTarget = {
  id: string;
  url: string;
};

type InspectMetadata = {
  resolution: { width: number; height: number } | null;
  sizeMb: number | null;
  downloadUrl: string | null;
  filename: string;
};

const DEFAULT_IMAGE_BASE_PATH = "photography-images";

const GRAPH_CONFIG = {
  baseBox: 220,
  minBox: 64,
  maxBox: 300,
  collidePad: 0,
  distMin: 10,
  distMax: 1600,
  charge: -420,
  zoomExtent: [0.25, 4] as [number, number],
  initialZoom: 0.8, // <-- add this
  imageConcurrency: 5,
  upgradeDebounceMs: 120,
  viewportBufferRatio: 0.15,
};

const overlayPanelClass =
  "absolute left-[1vmin] top-[1vmin] z-[5] space-y-2 p-1.5 text-center backdrop-blur-[2px]";
const overlayTextClass = "m-0 p-0 text-xs";
const sliderClass =
  "accent-grey-800 range-sm h-1 rounded-full bg-white/50 border-none";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function resolveNodeId(node: RawNode, index: number) {
  return String(node.id ?? index + 1);
}

async function resolveNodeSourceUrl(
  node: RawNode,
  id: string,
  imageBasePath: string,
) {
  if (node.url) return node.url;
  return getDownloadURL(
    ref(storage, `${imageBasePath.replace(/\/$/, "")}/${id}.png`),
  );
}

function sizeNodeFromImage(node: SimNode, image: HTMLImageElement) {
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;

  if (!width || !height) return;

  const aspect = width / height;
  if (aspect >= 1) {
    node.w = GRAPH_CONFIG.baseBox;
    node.h = GRAPH_CONFIG.baseBox / aspect;
    return;
  }

  node.h = GRAPH_CONFIG.baseBox;
  node.w = GRAPH_CONFIG.baseBox * aspect;
}

async function buildGraph(data: RawNode[], imageBasePath: string) {
  const nodes: SimNode[] = await Promise.all(
    data.map(async (entry, index) => {
      const id = resolveNodeId(entry, index);
      const box = clamp(
        Math.round((entry.scale ?? 0.5) * GRAPH_CONFIG.baseBox),
        GRAPH_CONFIG.minBox,
        GRAPH_CONFIG.maxBox,
      );

      return {
        id,
        colour: entry.colour,
        sourceUrl: await resolveNodeSourceUrl(entry, id, imageBasePath),
        w: box,
        h: box,
        x: (Math.random() - 0.5) * 50,
        y: (Math.random() - 0.5) * 50,
      };
    }),
  );

  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const links: SimLink[] = [];

  for (const [index, entry] of data.entries()) {
    const sourceId = resolveNodeId(entry, index);

    for (const [targetId, rawValue] of Object.entries(
      entry.correlations ?? {},
    )) {
      if (sourceId === targetId) continue;
      if (!nodeMap.has(sourceId) || !nodeMap.has(targetId)) continue;

      const value = clamp(Number(rawValue) || 0, 0, 1);
      if (!value || sourceId >= targetId) continue;

      links.push({
        source: sourceId,
        target: targetId,
        value,
        _baseValue: value,
      });
    }
  }

  return { nodes, links };
}

function loadImage(url: string, signal: AbortSignal) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Image load aborted", "AbortError"));
      return;
    }

    const image = new Image();
    image.decoding = "async";
    image.crossOrigin = "anonymous";

    const cleanup = () => {
      image.onload = null;
      image.onerror = null;
      signal.removeEventListener("abort", handleAbort);
    };

    const handleAbort = () => {
      cleanup();
      image.src = "";
      reject(new DOMException("Image load aborted", "AbortError"));
    };

    image.onload = () => {
      cleanup();
      resolve(image);
    };

    image.onerror = () => {
      cleanup();
      reject(new Error(`Failed to load image: ${url}`));
    };

    signal.addEventListener("abort", handleAbort, { once: true });
    image.src = url;
  });
}

function isNodeVisible(
  node: SimNode,
  transform: d3.ZoomTransform,
  viewportWidth: number,
  viewportHeight: number,
) {
  const bufferX = viewportWidth * GRAPH_CONFIG.viewportBufferRatio;
  const bufferY = viewportHeight * GRAPH_CONFIG.viewportBufferRatio;
  const halfWidth = (node.w * transform.k) / 2;
  const halfHeight = (node.h * transform.k) / 2;
  const screenX = (node.x ?? 0) * transform.k + transform.x;
  const screenY = (node.y ?? 0) * transform.k + transform.y;

  return (
    screenX + halfWidth >= -bufferX &&
    screenX - halfWidth <= viewportWidth + bufferX &&
    screenY + halfHeight >= -bufferY &&
    screenY - halfHeight <= viewportHeight + bufferY
  );
}

function getNodeTopLeft(node: SimNode) {
  return {
    x: (node.x ?? 0) - node.w / 2,
    y: (node.y ?? 0) - node.h / 2,
  };
}

function buildInspectFilename(
  id: string,
  sourceUrl: string,
  mimeType?: string,
) {
  const typeExtension = mimeType?.split("/")[1]?.split("+")[0];
  if (typeExtension) return `${id}.${typeExtension}`;

  try {
    const { pathname } = new URL(sourceUrl);
    const extension = pathname.split(".").pop();
    if (extension && extension !== pathname) return `${id}.${extension}`;
  } catch {
    // Ignore URL parsing failures and fall back to png.
  }

  return `${id}.png`;
}

function formatSizeInMb(sizeInBytes: number) {
  return (sizeInBytes / (1024 * 1024)).toFixed(2);
}

export default function PhotoGraphCanvas({
  graphUrl = "/portfolioTable.json",
  imageBasePath = DEFAULT_IMAGE_BASE_PATH,
  forcedDarkMode,
}: PhotoGraphCanvasProps) {
  const { darkMode: siteDarkMode, toggleTheme } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const nodesRef = useRef<SimNode[]>([]);
  const linksRef = useRef<SimLink[]>([]);
  const imagesRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const pendingWidthsRef = useRef<Map<string, Set<number>>>(new Map());
  const errorLogRef = useRef<Set<string>>(new Set());
  const simRef = useRef<d3.Simulation<SimNode, SimLink> | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<HTMLCanvasElement, unknown> | null>(
    null,
  );
  const transformRef = useRef(d3.zoomIdentity);
  const dprRef = useRef(1);
  const frameRef = useRef<number | null>(null);
  const settleTimeoutRef = useRef<number | null>(null);
  const upgradeTimeoutRef = useRef<number | null>(null);
  const alphaRef = useRef({ value: 1, updatedAt: 0 });
  const darkModeRef = useRef(false);
  const controlsRef = useRef<GraphControls>({
    hideConnections: false,
    chargeMult: 1,
    distMinMult: 1,
    distMaxMult: 1,
  });

  const [menuOpen, setMenuOpen] = useState(false);
  const [controls, setControls] = useState<GraphControls>({
    hideConnections: false,
    chargeMult: 1,
    distMinMult: 1,
    distMaxMult: 1,
  });
  const [alpha, setAlpha] = useState(1);
  const [inspectTarget, setInspectTarget] = useState<InspectTarget | null>(
    null,
  );
  const [inspectMetadata, setInspectMetadata] =
    useState<InspectMetadata | null>(null);

  const syncAlpha = useCallback(() => {
    const simAlpha = simRef.current?.alpha() ?? 0;
    const now = performance.now();
    const { value, updatedAt } = alphaRef.current;

    if (
      Math.abs(simAlpha - value) < 0.01 &&
      now - updatedAt < 120 &&
      simAlpha >= 0.01
    ) {
      return;
    }

    alphaRef.current = { value: simAlpha, updatedAt: now };
    setAlpha((current) =>
      Math.abs(current - simAlpha) < 0.01 ? current : simAlpha,
    );
  }, []);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canvas.width) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    context.save();
    context.clearRect(0, 0, canvas.width, canvas.height);

    const transform = transformRef.current;
    const dpr = dprRef.current;
    const isDarkMode = darkModeRef.current;
    context.setTransform(
      transform.k * dpr,
      0,
      0,
      transform.k * dpr,
      transform.x * dpr,
      transform.y * dpr,
    );

    context.strokeStyle = isDarkMode ? "rgba(255, 255, 255, 0.72)" : "#000";
    context.lineWidth = 3;

    for (const link of linksRef.current) {
      const opacity = link.value ?? 0;
      if (opacity <= 0) continue;

      const source = link.source as SimNode;
      const target = link.target as SimNode;
      if (!source || !target) continue;

      context.globalAlpha = opacity;
      context.beginPath();
      context.moveTo(source.x ?? 0, source.y ?? 0);
      context.lineTo(target.x ?? 0, target.y ?? 0);
      context.stroke();
    }

    context.globalAlpha = 1;

    for (const node of nodesRef.current) {
      const { x, y } = getNodeTopLeft(node);
      const image = imagesRef.current.get(node.id);

      if (image) {
        context.drawImage(image, x, y, node.w, node.h);
        continue;
      }

      context.fillStyle = isDarkMode
        ? "rgba(255, 255, 255, 0.12)"
        : "#ffffff46";
      context.fillRect(x, y, node.w, node.h);
    }

    context.restore();
    syncAlpha();
  }, [syncAlpha]);

  const requestRender = useCallback(() => {
    if (frameRef.current !== null) return;

    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      paint();
    });
  }, [paint]);

  const getWorldPoint = useCallback(
    (event: CanvasInputEvent, canvas: HTMLCanvasElement) => {
      const point = d3.pointer(event, canvas) as [number, number];
      return transformRef.current.invert(point) as [number, number];
    },
    [],
  );

  const hitNode = useCallback(
    (event: CanvasInputEvent, canvas: HTMLCanvasElement) => {
      const [mouseX, mouseY] = getWorldPoint(event, canvas);

      for (let index = nodesRef.current.length - 1; index >= 0; index -= 1) {
        const node = nodesRef.current[index];
        const { x, y } = getNodeTopLeft(node);

        if (
          mouseX >= x &&
          mouseX <= x + node.w &&
          mouseY >= y &&
          mouseY <= y + node.h
        ) {
          return node;
        }
      }

      return null;
    },
    [getWorldPoint],
  );

  const applyInitialZoom = useCallback((canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const initialTransform = d3.zoomIdentity
      .translate(rect.width / 2, rect.height / 2)
      .scale(GRAPH_CONFIG.initialZoom);

    transformRef.current = initialTransform;
    const zoomBehavior = zoomRef.current;
    if (zoomBehavior) {
      d3.select(canvas).call(zoomBehavior.transform, initialTransform);
    }
  }, []);

  const applyConnectionVisibility = useCallback(
    (hidden: boolean) => {
      for (const link of linksRef.current) {
        const baseValue = link._baseValue ?? link.value ?? 0;
        link._baseValue = baseValue;
        link.value = hidden ? 0 : baseValue;
      }

      requestRender();
    },
    [requestRender],
  );

  const updateSimulationForces = useCallback(() => {
    const simulation = simRef.current;
    if (!simulation) return;

    const currentControls = controlsRef.current;
    const minDistance = GRAPH_CONFIG.distMin * currentControls.distMinMult;
    const maxDistance = GRAPH_CONFIG.distMax * currentControls.distMaxMult;

    const linkForce = simulation.force("link") as
      | d3.ForceLink<SimNode, SimLink>
      | undefined;
    if (linkForce) {
      linkForce.distance((link) => {
        const value = link._baseValue ?? link.value ?? 0;
        return minDistance + (1 - value) * (maxDistance - minDistance);
      });
    }

    const chargeForce = simulation.force("charge") as
      | d3.ForceManyBody<SimNode>
      | undefined;
    chargeForce?.strength(currentControls.chargeMult * GRAPH_CONFIG.charge);
  }, []);

  const nudgeSimulation = useCallback(
    (target = 0.25, settleDelay = 150) => {
      const simulation = simRef.current;
      if (!simulation) return;

      updateSimulationForces();
      simulation.alphaTarget(target).restart();

      if (settleTimeoutRef.current !== null) {
        window.clearTimeout(settleTimeoutRef.current);
      }

      settleTimeoutRef.current = window.setTimeout(() => {
        settleTimeoutRef.current = null;
        simRef.current?.alphaTarget(0);
      }, settleDelay);
    },
    [updateSimulationForces],
  );

  const syncPendingRequestWidth = useCallback((node: SimNode) => {
    const widths = pendingWidthsRef.current.get(node.id);
    node.requestedWidth =
      widths && widths.size ? Math.max(...widths) : undefined;
  }, []);

  const trackPendingWidth = useCallback(
    (node: SimNode, width: number, pending: boolean) => {
      const current =
        pendingWidthsRef.current.get(node.id) ?? new Set<number>();

      if (pending) {
        current.add(width);
        pendingWidthsRef.current.set(node.id, current);
      } else {
        current.delete(width);
        if (!current.size) {
          pendingWidthsRef.current.delete(node.id);
        }
      }

      syncPendingRequestWidth(node);
    },
    [syncPendingRequestWidth],
  );

  const refreshNodeAfterImageLoad = useCallback(() => {
    const collideForce = simRef.current?.force("collide") as
      | d3.ForceCollide<SimNode>
      | undefined;
    collideForce?.initialize?.(nodesRef.current);

    nudgeSimulation(0.08, 220);
    requestRender();
  }, [nudgeSimulation, requestRender]);

  const applyOptimizedImage = useCallback(
    (node: SimNode, image: HTMLImageElement, loadedWidth: number) => {
      if (!shouldUpgradeWidth(node.loadedWidth, loadedWidth)) {
        return;
      }

      sizeNodeFromImage(node, image);
      node.loadedWidth = loadedWidth;
      imagesRef.current.set(node.id, image);
      refreshNodeAfterImageLoad();
    },
    [refreshNodeAfterImageLoad],
  );

  const applyFallbackImage = useCallback(
    (node: SimNode, image: HTMLImageElement) => {
      if (imagesRef.current.has(node.id)) {
        return;
      }

      sizeNodeFromImage(node, image);
      node.loadedWidth = 0;
      imagesRef.current.set(node.id, image);
      refreshNodeAfterImageLoad();
    },
    [refreshNodeAfterImageLoad],
  );

  const logNodeImageError = useCallback((node: SimNode, error: unknown) => {
    const errorKey = node.id;
    if (errorLogRef.current.has(errorKey)) return;

    errorLogRef.current.add(errorKey);
    console.error(`Failed to load image for node ${node.id}`, error);
  }, []);

  const getNodeTargetWidth = useCallback(
    (node: SimNode) =>
      computeTargetImageWidth(node, transformRef.current.k, dprRef.current),
    [],
  );

  const loadNodeImage = useCallback(
    async (node: SimNode, targetWidth: number, signal: AbortSignal) => {
      if (signal.aborted) return;
      if (!shouldUpgradeWidth(node.loadedWidth, targetWidth)) return;
      if ((node.requestedWidth ?? 0) >= targetWidth) return;

      trackPendingWidth(node, targetWidth, true);

      try {
        try {
          const optimizedUrl = buildOptimizedImageUrl(
            node.sourceUrl,
            targetWidth,
          );
          const optimizedImage = await loadImage(optimizedUrl, signal);
          if (signal.aborted) return;
          applyOptimizedImage(node, optimizedImage, targetWidth);
        } catch (error) {
          if (isAbortError(error)) return;

          try {
            const fallbackImage = await loadImage(node.sourceUrl, signal);
            if (signal.aborted) return;
            applyFallbackImage(node, fallbackImage);
          } catch (fallbackError) {
            if (isAbortError(fallbackError)) return;
            logNodeImageError(node, fallbackError);
          }
        }
      } finally {
        trackPendingWidth(node, targetWidth, false);
      }
    },
    [
      applyFallbackImage,
      applyOptimizedImage,
      logNodeImageError,
      trackPendingWidth,
    ],
  );

  const runNodeQueue = useCallback(
    async (
      nodes: SimNode[],
      signal: AbortSignal,
      resolveWidth: (node: SimNode) => number,
    ) => {
      if (!nodes.length) return;

      let index = 0;

      const worker = async () => {
        while (!signal.aborted) {
          const node = nodes[index];
          index += 1;
          if (!node) return;

          await loadNodeImage(node, resolveWidth(node), signal);
        }
      };

      await Promise.all(
        Array.from(
          { length: Math.min(GRAPH_CONFIG.imageConcurrency, nodes.length) },
          () => worker(),
        ),
      );
    },
    [loadNodeImage],
  );

  const preloadImages = useCallback(
    async (signal: AbortSignal) => {
      await runNodeQueue(nodesRef.current, signal, getNodeTargetWidth);
    },
    [getNodeTargetWidth, runNodeQueue],
  );

  const upgradeVisibleImages = useCallback(
    async (signal: AbortSignal) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const viewportWidth = canvas.clientWidth;
      const viewportHeight = canvas.clientHeight;
      if (!viewportWidth || !viewportHeight) return;

      const transform = transformRef.current;
      const visibleNodes = nodesRef.current.filter((node) =>
        isNodeVisible(node, transform, viewportWidth, viewportHeight),
      );

      await runNodeQueue(visibleNodes, signal, getNodeTargetWidth);
    },
    [getNodeTargetWidth, runNodeQueue],
  );

  const scheduleUpgradePass = useCallback(
    (signal: AbortSignal, delay = GRAPH_CONFIG.upgradeDebounceMs) => {
      if (upgradeTimeoutRef.current !== null) {
        window.clearTimeout(upgradeTimeoutRef.current);
      }

      upgradeTimeoutRef.current = window.setTimeout(() => {
        upgradeTimeoutRef.current = null;
        void upgradeVisibleImages(signal);
      }, delay);
    },
    [upgradeVisibleImages],
  );

  const bindInteractions = useCallback(
    (canvas: HTMLCanvasElement, onZoomOrPan: () => void) => {
      const selection = d3.select(canvas);

      const zoom = d3
        .zoom<HTMLCanvasElement, unknown>()
        .scaleExtent(GRAPH_CONFIG.zoomExtent)
        .filter((event: CanvasInputEvent) => {
          if (event.type === "wheel") return true;
          if ("touches" in event && event.touches.length > 1) return true;
          return !hitNode(event, canvas);
        })
        .on("zoom", (event: d3.D3ZoomEvent<HTMLCanvasElement, unknown>) => {
          transformRef.current = event.transform;
          requestRender();
          onZoomOrPan();
        });

      zoomRef.current = zoom;
      selection.call(zoom);

      const drag = d3
        .drag<HTMLCanvasElement, SimNode>()
        .container(() => canvas)
        .subject((event: CanvasInputEvent) => hitNode(event, canvas) ?? null)
        .on(
          "start",
          (event: d3.D3DragEvent<HTMLCanvasElement, SimNode, SimNode>) => {
            const simulation = simRef.current;
            if (!simulation) return;

            canvas.style.cursor = "grabbing";
            if (!event.active) simulation.alphaTarget(0.35).restart();

            const [mouseX, mouseY] = getWorldPoint(
              event.sourceEvent as CanvasInputEvent,
              canvas,
            );
            event.subject._grab = {
              dx: (event.subject.x ?? 0) - mouseX,
              dy: (event.subject.y ?? 0) - mouseY,
            };
            event.subject.fx = event.subject.x;
            event.subject.fy = event.subject.y;
          },
        )
        .on(
          "drag",
          (event: d3.D3DragEvent<HTMLCanvasElement, SimNode, SimNode>) => {
            const [mouseX, mouseY] = getWorldPoint(
              event.sourceEvent as CanvasInputEvent,
              canvas,
            );
            const grab = event.subject._grab ?? { dx: 0, dy: 0 };

            event.subject.fx = mouseX + grab.dx;
            event.subject.fy = mouseY + grab.dy;
            requestRender();
          },
        )
        .on(
          "end",
          (event: d3.D3DragEvent<HTMLCanvasElement, SimNode, SimNode>) => {
            canvas.style.cursor = "default";

            if (!event.active) {
              simRef.current?.alphaTarget(0);
            }

            event.subject.fx = null;
            event.subject.fy = null;
            delete event.subject._grab;
          },
        );

      selection.call(drag);

      const handleClick = (event: MouseEvent) => {
        const node = hitNode(event, canvas);
        if (node) {
          setInspectTarget({ id: node.id, url: node.sourceUrl });
        }
      };

      const handleMouseMove = (event: MouseEvent) => {
        canvas.style.cursor = hitNode(event, canvas) ? "pointer" : "default";
      };

      canvas.addEventListener("click", handleClick);
      canvas.addEventListener("mousemove", handleMouseMove);

      return () => {
        canvas.removeEventListener("click", handleClick);
        canvas.removeEventListener("mousemove", handleMouseMove);
        selection.on(".zoom", null);
        selection.on(".drag", null);
      };
    },
    [hitNode, requestRender, getWorldPoint],
  );

  const activeDarkMode = forcedDarkMode ?? siteDarkMode;

  useEffect(() => {
    darkModeRef.current = activeDarkMode;
    requestRender();
  }, [activeDarkMode, requestRender]);

  useEffect(() => {
    let disposed = false;
    const abortController = new AbortController();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const scheduleCurrentUpgradePass = () => {
      scheduleUpgradePass(abortController.signal);
    };

    const resizeCanvas = () => {
      dprRef.current = window.devicePixelRatio || 1;

      const rect = canvas.getBoundingClientRect();
      const cssWidth = Math.max(1, Math.round(rect.width));
      const cssHeight = Math.max(1, Math.round(rect.height));

      const nextWidth = Math.round(cssWidth * dprRef.current);
      const nextHeight = Math.round(cssHeight * dprRef.current);

      if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
        canvas.width = nextWidth;
        canvas.height = nextHeight;
        requestRender();
        scheduleCurrentUpgradePass();
      }
    };

    const cleanupInteractions = bindInteractions(
      canvas,
      scheduleCurrentUpgradePass,
    );

    const resizeObserver = new ResizeObserver(resizeCanvas);
    resizeObserver.observe(canvas);

    resizeCanvas();

    applyInitialZoom(canvas);

    window.addEventListener("resize", resizeCanvas);

    const resetRuntimeCollections = () => {
      imagesRef.current = new Map();
      pendingWidthsRef.current = new Map();
      errorLogRef.current = new Set();
    };

    const createSimulation = (nodes: SimNode[], links: SimLink[]) =>
      d3
        .forceSimulation<SimNode>(nodes)
        .force(
          "link",
          d3
            .forceLink<SimNode, SimLink>(links)
            .id((node) => node.id)
            .distance((link) => {
              const value = link._baseValue ?? link.value ?? 0;
              return (
                GRAPH_CONFIG.distMin +
                (1 - value) * (GRAPH_CONFIG.distMax - GRAPH_CONFIG.distMin)
              );
            })
            .strength(
              (link) => 0.15 + 0.85 * (link._baseValue ?? link.value ?? 0),
            ),
        )
        .force(
          "charge",
          d3.forceManyBody<SimNode>().strength(GRAPH_CONFIG.charge),
        )
        .force("x", d3.forceX<SimNode>().strength(0.03))
        .force("y", d3.forceY<SimNode>().strength(0.09))
        .force(
          "collide",
          d3
            .forceCollide<SimNode>()
            .radius(
              (node) => Math.max(node.w, node.h) / 2 + GRAPH_CONFIG.collidePad,
            )
            .iterations(3),
        )
        .on("tick", requestRender);

    const initializeGraph = async () => {
      const response = await fetch(graphUrl, {
        cache: "no-store",
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch graph data: ${graphUrl}`);
      }

      const data = (await response.json()) as RawNode[];
      if (disposed) return;

      const { nodes, links } = await buildGraph(data, imageBasePath);
      nodesRef.current = nodes;
      linksRef.current = links;
      resetRuntimeCollections();

      const simulation = createSimulation(nodes, links);
      simRef.current = simulation;
      applyConnectionVisibility(controlsRef.current.hideConnections);
      updateSimulationForces();
      simulation.alpha(1).restart();
      requestRender();

      await preloadImages(abortController.signal);
      scheduleUpgradePass(abortController.signal, 0);
    };

    const cleanupRuntime = () => {
      window.removeEventListener("resize", resizeCanvas);
      resizeObserver.disconnect();
      cleanupInteractions();

      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }

      if (settleTimeoutRef.current !== null) {
        window.clearTimeout(settleTimeoutRef.current);
        settleTimeoutRef.current = null;
      }

      if (upgradeTimeoutRef.current !== null) {
        window.clearTimeout(upgradeTimeoutRef.current);
        upgradeTimeoutRef.current = null;
      }

      simRef.current?.stop();
      simRef.current = null;
    };

    const init = async () => {
      try {
        await initializeGraph();
      } catch (error) {
        if (!isAbortError(error)) {
          console.error(error);
        }
      }
    };

    void init();

    return () => {
      disposed = true;
      abortController.abort();
      cleanupRuntime();
    };
  }, [
    graphUrl,
    imageBasePath,
    applyConnectionVisibility,
    applyInitialZoom,
    bindInteractions,
    preloadImages,
    requestRender,
    scheduleUpgradePass,
    updateSimulationForces,
  ]);

  useEffect(() => {
    controlsRef.current = controls;
  }, [controls]);

  useEffect(() => {
    applyConnectionVisibility(controls.hideConnections);
  }, [controls.hideConnections, applyConnectionVisibility]);

  useEffect(() => {
    nudgeSimulation();
  }, [
    controls.chargeMult,
    controls.distMinMult,
    controls.distMaxMult,
    nudgeSimulation,
  ]);

  useEffect(() => {
    if (!inspectTarget) {
      setInspectMetadata(null);
      return;
    }

    const abortController = new AbortController();
    let objectUrl: string | null = null;

    setInspectMetadata({
      resolution: null,
      sizeMb: null,
      downloadUrl: null,
      filename: buildInspectFilename(inspectTarget.id, inspectTarget.url),
    });

    const loadInspectMetadata = async () => {
      try {
        const response = await fetch(inspectTarget.url, {
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error(
            `Failed to fetch original image: ${response.status} ${response.statusText}`,
          );
        }

        const blob = await response.blob();
        if (abortController.signal.aborted) return;

        objectUrl = URL.createObjectURL(blob);
        setInspectMetadata((current) =>
          current
            ? {
                ...current,
                sizeMb: Number(formatSizeInMb(blob.size)),
                downloadUrl: objectUrl,
                filename: buildInspectFilename(
                  inspectTarget.id,
                  inspectTarget.url,
                  blob.type,
                ),
              }
            : current,
        );
      } catch (error) {
        if (!isAbortError(error)) {
          console.error(error);
        }
      }
    };

    void loadInspectMetadata();

    return () => {
      abortController.abort();
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [inspectTarget]);

  // TODO: make this fade between colours instead of hard switching.
  const alphaColorClass = alpha < 0.01 ? "text-green-600" : "text-red-600";
  const chrome = getProjectChrome("photo-graph", activeDarkMode);
  const isFullPageRoute = usePathname() === PROJECT_ROUTES.photoGraph;
  return (
    <div className={`static h-full w-full transition-colors ${chrome.shell}`}>
      {!menuOpen && (
        <OverlayIconButton
          onClick={() => setMenuOpen(true)}
          toneClass={chrome.overlay}
          className="absolute left-[1vmin] top-[1vmin] z-[6]"
          aria-label="Open graph controls"
        >
          <Menu className="h-4 w-4" />
        </OverlayIconButton>
      )}

      <OverlayNavBar
        darkMode={isFullPageRoute ? activeDarkMode : undefined}
        onToggleDarkMode={
          isFullPageRoute && forcedDarkMode === undefined
            ? toggleTheme
            : undefined
        }
        expandHref={isFullPageRoute ? undefined : PROJECT_ROUTES.photoGraph}
        exitHref={isFullPageRoute ? PROJECT_ROUTES.home : undefined}
        toneClass={chrome.overlay}
        ariaLabel="Photo graph controls"
      />

      {menuOpen && (
        <div
          className={`rounded-md select-none ${overlayPanelClass} border ${chrome.overlay}`}
        >
          <div className="w-full flex items-start">
            <div className="flex-1 text-center">
              <p className={`mx-2 ${overlayTextClass}`}>Simulation Alpha</p>
              <p className={`${overlayTextClass} ${alphaColorClass}`}>
                {alpha.toFixed(3)}
              </p>
            </div>

            <OverlayIconButton
              onClick={() => setMenuOpen(false)}
              toneClass={chrome.overlay}
              className="ml-auto h-7 w-7"
              aria-label="Close graph controls"
            >
              <X className="h-5 w-5" />
            </OverlayIconButton>
          </div>

          <label
            className={`flex items-center justify-center gap-1 ${overlayTextClass}`}
          >
            Hide Connections{" "}
            <input
              type="checkbox"
              checked={controls.hideConnections}
              onChange={(event) =>
                setControls((current) => ({
                  ...current,
                  hideConnections: event.target.checked,
                }))
              }
              className="m-0 h-2.5"
            />
          </label>

          <input
            type="range"
            min={0}
            max={5}
            step="any"
            value={controls.chargeMult}
            onChange={(event) =>
              setControls((current) => ({
                ...current,
                chargeMult: Number(event.target.value),
              }))
            }
            className={sliderClass}
          />
          <p className={overlayTextClass}>
            Charge Mult: {controls.chargeMult.toFixed(2)}
          </p>

          <input
            type="range"
            min={0}
            max={500}
            step="any"
            value={controls.distMinMult / 0.1}
            onChange={(event) =>
              setControls((current) => ({
                ...current,
                distMinMult: Number(event.target.value) * 0.1,
              }))
            }
            className={sliderClass}
          />
          <p className={overlayTextClass}>
            Dist Min Mult: {controls.distMinMult.toFixed(2)}
          </p>

          <input
            type="range"
            min={0}
            max={50}
            step="any"
            value={controls.distMaxMult / 0.1}
            onChange={(event) =>
              setControls((current) => ({
                ...current,
                distMaxMult: Number(event.target.value) * 0.1,
              }))
            }
            className={sliderClass}
          />
          <p className={overlayTextClass}>
            Dist Max Mult: {controls.distMaxMult.toFixed(2)}
          </p>
        </div>
      )}

      {inspectTarget && (
        <div
          onClick={() => setInspectTarget(null)}
          className={`absolute inset-0 z-10 m-auto flex max-h-9/12 max-w-9/12 items-center justify-center ${chrome.modal} backdrop-blur-sm`}
          // TODO: add colour swatches to inspect view
          // TODO: add fadein/out animations and fade the other ui elements while doing so through the flex container holding all of them.
        >
          <div
            className="relative flex h-full  w-full flex-col items-center justify-center"
            onClick={(event) => event.stopPropagation()}
          >
            <OverlayIconButton
              onClick={() => setInspectTarget(null)}
              toneClass={chrome.overlay}
              className="absolute right-0 top-0 mx-2 my-2"
              aria-label="Close image inspection"
            >
              <X className="h-4 w-4" />
            </OverlayIconButton>

            <img
              src={inspectTarget.url}
              alt=""
              className="max-h-9/12 max-w-5/6 justify-self-center self-center align-middle my-auto"
              onLoad={(event) => {
                const { naturalWidth, naturalHeight } = event.currentTarget;
                setInspectMetadata((current) =>
                  current
                    ? {
                        ...current,
                        resolution: {
                          width: naturalWidth,
                          height: naturalHeight,
                        },
                      }
                    : current,
                );
              }}
            />

            <div className="absolute flex h-1/8 w-full items-center justify-between gap-4 px-4 bottom-0 sm:text-xs text-[9px] {overlayTextClass}">
              <div className="flex items-center gap-4">
                <p>
                  <span className="hidden sm:inline">Resolution: </span>
                  {inspectMetadata?.resolution
                    ? `${inspectMetadata.resolution.width} x ${inspectMetadata.resolution.height}`
                    : "Loading..."}
                </p>
                <p>
                  <span className="hidden sm:inline">Original Size: </span>
                  {inspectMetadata?.sizeMb != null
                    ? `${inspectMetadata.sizeMb.toFixed(2)} MB`
                    : "Loading..."}
                </p>
              </div>

              <a
                href={inspectMetadata?.downloadUrl ?? undefined}
                download={inspectMetadata?.filename}
                className={`inline-flex items-center gap-1 ${
                  inspectMetadata?.downloadUrl
                    ? ""
                    : "pointer-events-none opacity-50"
                }`}
                aria-disabled={!inspectMetadata?.downloadUrl}
              >
                Download Original
                <Download className="sm:h-3.5 sm:w-3.5 h-1.75 w-1.75" />
              </a>
            </div>
          </div>
        </div>
      )}

      <canvas
        ref={canvasRef}
        className="relative m-0 block h-full w-full [image-rendering:pixelated]"
      />
    </div>
  );
}
