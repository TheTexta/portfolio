"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";

import { ArrowRightFromLine } from 'lucide-react';
import { X } from 'lucide-react';
import { Menu } from 'lucide-react';



import {
  buildOptimizedImageUrl,
  computeTargetImageWidth,
  shouldUpgradeWidth,
} from "@/app/components/projects/photo-graph/imageOptimizer";
import { getApp, getApps, initializeApp } from "firebase/app";
import { getDownloadURL, getStorage, ref } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCJcaZDccPEycNq8063Ziz5X0fr11U1TdI",
  authDomain: "portfolio-site-firebase-41fab.firebaseapp.com",
  projectId: "portfolio-site-firebase-41fab",
  storageBucket: "portfolio-site-firebase-41fab.firebasestorage.app",
  messagingSenderId: "274306939095",
  appId: "1:274306939095:web:a5389c279fd8cbf31c1892",
  measurementId: "G-YMW53LSD8L",
};

const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
const storage = getStorage(firebaseApp);
// TODO: add metadata to inspection view

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
  imageConcurrency: 5,
  upgradeDebounceMs: 120,
  viewportBufferRatio: 0.15,
};

const overlayControlClass =
  "cursor-pointer bg-white/30 px-1.5 backdrop-blur-[2px]";
const overlayPanelClass =
  "absolute left-[1vmin] top-[1vmin] z-[5] space-y-2 bg-white/30 p-1.5 text-center backdrop-blur-[2px]";
const overlayTextClass = "m-0 p-0 text-xs";
const sliderClass = "m-2.5 h-[3px] select-none";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function resolveNodeId(node: RawNode, index: number) {
  return String(node.id ?? index + 1);
}

async function resolveNodeSourceUrl(node: RawNode, id: string, imageBasePath: string) {
  if (node.url) return node.url;
  return getDownloadURL(ref(storage, `${imageBasePath.replace(/\/$/, "")}/${id}.png`));
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
        GRAPH_CONFIG.maxBox
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
    })
  );

  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const links: SimLink[] = [];

  for (const [index, entry] of data.entries()) {
    const sourceId = resolveNodeId(entry, index);

    for (const [targetId, rawValue] of Object.entries(entry.correlations ?? {})) {
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
  viewportHeight: number
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

export default function PhotoGraphCanvas({
  graphUrl = "/portfolioTable.json",
  imageBasePath = DEFAULT_IMAGE_BASE_PATH,
}: PhotoGraphCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const nodesRef = useRef<SimNode[]>([]);
  const linksRef = useRef<SimLink[]>([]);
  const imagesRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const pendingWidthsRef = useRef<Map<string, Set<number>>>(new Map());
  const errorLogRef = useRef<Set<string>>(new Set());
  const simRef = useRef<d3.Simulation<SimNode, SimLink> | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<HTMLCanvasElement, unknown> | null>(null);
  const transformRef = useRef(d3.zoomIdentity);
  const dprRef = useRef(1);
  const frameRef = useRef<number | null>(null);
  const settleTimeoutRef = useRef<number | null>(null);
  const upgradeTimeoutRef = useRef<number | null>(null);
  const alphaRef = useRef({ value: 1, updatedAt: 0 });
  const darkModeRef = useRef(false);
  const controlsRef = useRef({
    hideConnections: false,
    chargeMult: 1,
    distMinMult: 1,
    distMaxMult: 1,
  });

  const [menuOpen, setMenuOpen] = useState(true);
  const [hideConnections, setHideConnections] = useState(false);
  const [chargeMult, setChargeMult] = useState(1);
  const [distMinMult, setDistMinMult] = useState(1);
  const [distMaxMult, setDistMaxMult] = useState(1);
  const [alpha, setAlpha] = useState(1);
  const [inspectUrl, setInspectUrl] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(false);

  const syncAlpha = () => {
    const simAlpha = simRef.current?.alpha() ?? 0;
    const now = performance.now();
    const { value, updatedAt } = alphaRef.current;

    if (Math.abs(simAlpha - value) < 0.01 && now - updatedAt < 120 && simAlpha >= 0.01) {
      return;
    }

    alphaRef.current = { value: simAlpha, updatedAt: now };
    setAlpha((current) => (Math.abs(current - simAlpha) < 0.01 ? current : simAlpha));
  };

  const paint = () => {
    const canvas = canvasRef.current;
    if (!canvas || !canvas.width) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    context.save();
    context.clearRect(0, 0, canvas.width, canvas.height);

    const transform = transformRef.current;
    const dpr = dprRef.current;
    const isDarkMode = darkModeRef.current;
    context.setTransform(transform.k * dpr, 0, 0, transform.k * dpr, transform.x * dpr, transform.y * dpr);

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
      const x = (node.x ?? 0) - node.w / 2;
      const y = (node.y ?? 0) - node.h / 2;
      const image = imagesRef.current.get(node.id);

      if (image) {
        context.drawImage(image, x, y, node.w, node.h);
        continue;
      }

      context.fillStyle = isDarkMode ? "rgba(255, 255, 255, 0.12)" : "#ffffff46";
      context.fillRect(x, y, node.w, node.h);
    }

    context.restore();
    syncAlpha();
  };

  const requestRender = () => {
    if (frameRef.current !== null) return;

    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      paint();
    });
  };

  const getWorldPoint = (event: CanvasInputEvent, canvas: HTMLCanvasElement) => {
    const point = d3.pointer(event, canvas) as [number, number];
    return transformRef.current.invert(point) as [number, number];
  };

  const hitNode = (event: CanvasInputEvent, canvas: HTMLCanvasElement) => {
    const [mouseX, mouseY] = getWorldPoint(event, canvas);

    for (let index = nodesRef.current.length - 1; index >= 0; index -= 1) {
      const node = nodesRef.current[index];
      const x = (node.x ?? 0) - node.w / 2;
      const y = (node.y ?? 0) - node.h / 2;

      if (mouseX >= x && mouseX <= x + node.w && mouseY >= y && mouseY <= y + node.h) {
        return node;
      }
    }

    return null;
  };

  const applyConnectionVisibility = (hidden: boolean) => {
    for (const link of linksRef.current) {
      const baseValue = link._baseValue ?? link.value ?? 0;
      link._baseValue = baseValue;
      link.value = hidden ? 0 : baseValue;
    }

    requestRender();
  };

  const updateSimulationForces = () => {
    const simulation = simRef.current;
    if (!simulation) return;

    const currentControls = controlsRef.current;
    const minDistance = GRAPH_CONFIG.distMin * currentControls.distMinMult;
    const maxDistance = GRAPH_CONFIG.distMax * currentControls.distMaxMult;

    const linkForce = simulation.force("link") as d3.ForceLink<SimNode, SimLink> | undefined;
    if (linkForce) {
      linkForce.distance((link) => {
        const value = link._baseValue ?? link.value ?? 0;
        return minDistance + (1 - value) * (maxDistance - minDistance);
      });
    }

    const chargeForce = simulation.force("charge") as d3.ForceManyBody<SimNode> | undefined;
    chargeForce?.strength(currentControls.chargeMult * GRAPH_CONFIG.charge);
  };

  const nudgeSimulation = (target = 0.25, settleDelay = 150) => {
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
  };

  const syncPendingRequestWidth = (node: SimNode) => {
    const widths = pendingWidthsRef.current.get(node.id);
    node.requestedWidth = widths && widths.size ? Math.max(...widths) : undefined;
  };

  const trackPendingWidth = (node: SimNode, width: number, pending: boolean) => {
    const current = pendingWidthsRef.current.get(node.id) ?? new Set<number>();

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
  };

  const refreshNodeAfterImageLoad = () => {
    const collideForce = simRef.current?.force("collide") as d3.ForceCollide<SimNode> | undefined;
    collideForce?.initialize?.(nodesRef.current);

    nudgeSimulation(0.08, 220);
    requestRender();
  };

  const applyOptimizedImage = (node: SimNode, image: HTMLImageElement, loadedWidth: number) => {
    if (!shouldUpgradeWidth(node.loadedWidth, loadedWidth)) {
      return;
    }

    sizeNodeFromImage(node, image);
    node.loadedWidth = loadedWidth;
    imagesRef.current.set(node.id, image);
    refreshNodeAfterImageLoad();
  };

  const applyFallbackImage = (node: SimNode, image: HTMLImageElement) => {
    if (imagesRef.current.has(node.id)) {
      return;
    }

    sizeNodeFromImage(node, image);
    node.loadedWidth = 0;
    imagesRef.current.set(node.id, image);
    refreshNodeAfterImageLoad();
  };

  const logNodeImageError = (node: SimNode, error: unknown) => {
    const errorKey = node.id;
    if (errorLogRef.current.has(errorKey)) return;

    errorLogRef.current.add(errorKey);
    console.error(`Failed to load image for node ${node.id}`, error);
  };

  const getNodeTargetWidth = (node: SimNode) =>
    computeTargetImageWidth(node, transformRef.current.k, dprRef.current);

  const loadNodeImage = async (node: SimNode, targetWidth: number, signal: AbortSignal) => {
    if (signal.aborted) return;
    if (!shouldUpgradeWidth(node.loadedWidth, targetWidth)) return;
    if ((node.requestedWidth ?? 0) >= targetWidth) return;

    trackPendingWidth(node, targetWidth, true);

    try {
      try {
        const optimizedUrl = buildOptimizedImageUrl(node.sourceUrl, targetWidth);
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
  };

  const runNodeQueue = async (
    nodes: SimNode[],
    signal: AbortSignal,
    resolveWidth: (node: SimNode) => number
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
      Array.from({ length: Math.min(GRAPH_CONFIG.imageConcurrency, nodes.length) }, () => worker())
    );
  };

  const preloadImages = async (signal: AbortSignal) => {
    await runNodeQueue(nodesRef.current, signal, getNodeTargetWidth);
  };

  const upgradeVisibleImages = async (signal: AbortSignal) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const viewportWidth = canvas.clientWidth;
    const viewportHeight = canvas.clientHeight;
    if (!viewportWidth || !viewportHeight) return;

    const transform = transformRef.current;
    const visibleNodes = nodesRef.current.filter((node) =>
      isNodeVisible(node, transform, viewportWidth, viewportHeight)
    );

    await runNodeQueue(visibleNodes, signal, getNodeTargetWidth);
  };

  const scheduleUpgradePass = (signal: AbortSignal, delay = GRAPH_CONFIG.upgradeDebounceMs) => {
    if (upgradeTimeoutRef.current !== null) {
      window.clearTimeout(upgradeTimeoutRef.current);
    }

    upgradeTimeoutRef.current = window.setTimeout(() => {
      upgradeTimeoutRef.current = null;
      void upgradeVisibleImages(signal);
    }, delay);
  };

  const bindInteractions = (canvas: HTMLCanvasElement, onZoomOrPan: () => void) => {
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
      .on("start", (event: d3.D3DragEvent<HTMLCanvasElement, SimNode, SimNode>) => {
        const simulation = simRef.current;
        if (!simulation) return;

        canvas.style.cursor = "grabbing";
        if (!event.active) simulation.alphaTarget(0.35).restart();

        const [mouseX, mouseY] = getWorldPoint(event.sourceEvent as CanvasInputEvent, canvas);
        event.subject._grab = {
          dx: (event.subject.x ?? 0) - mouseX,
          dy: (event.subject.y ?? 0) - mouseY,
        };
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
      })
      .on("drag", (event: d3.D3DragEvent<HTMLCanvasElement, SimNode, SimNode>) => {
        const [mouseX, mouseY] = getWorldPoint(event.sourceEvent as CanvasInputEvent, canvas);
        const grab = event.subject._grab ?? { dx: 0, dy: 0 };

        event.subject.fx = mouseX + grab.dx;
        event.subject.fy = mouseY + grab.dy;
        requestRender();
      })
      .on("end", (event: d3.D3DragEvent<HTMLCanvasElement, SimNode, SimNode>) => {
        canvas.style.cursor = "default";

        if (!event.active) {
          simRef.current?.alphaTarget(0);
        }

        event.subject.fx = null;
        event.subject.fy = null;
        delete event.subject._grab;
      });

    selection.call(drag);

    const handleClick = (event: MouseEvent) => {
      const node = hitNode(event, canvas);
      if (node) setInspectUrl(node.sourceUrl);
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
  };

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const updateTheme = (isDark: boolean) => {
      darkModeRef.current = isDark;
      setDarkMode(isDark);
    };

    updateTheme(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => updateTheme(event.matches);
    mediaQuery.addEventListener("change", handleChange);

    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    darkModeRef.current = darkMode;
    requestRender();
  }, [darkMode]);

  useEffect(() => {
    let disposed = false;
    const abortController = new AbortController();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const scheduleCurrentUpgradePass = () => scheduleUpgradePass(abortController.signal);

    const resize = () => {
      dprRef.current = window.devicePixelRatio || 1;

      const width = window.innerWidth;
      const height = window.innerHeight;

      canvas.width = Math.round(width * dprRef.current);
      canvas.height = Math.round(height * dprRef.current);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      requestRender();
      scheduleCurrentUpgradePass();
    };

    const cleanupInteractions = bindInteractions(canvas, scheduleCurrentUpgradePass);
    resize();
    window.addEventListener("resize", resize);

    const init = async () => {
      try {
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
        imagesRef.current = new Map();
        pendingWidthsRef.current = new Map();
        errorLogRef.current = new Set();
        const simulation = d3
          .forceSimulation<SimNode>(nodes)
          .force(
            "link",
            d3
              .forceLink<SimNode, SimLink>(links)
              .id((node) => node.id)
              .distance((link) => {
                const value = link._baseValue ?? link.value ?? 0;
                return GRAPH_CONFIG.distMin + (1 - value) * (GRAPH_CONFIG.distMax - GRAPH_CONFIG.distMin);
              })
              .strength((link) => 0.15 + 0.85 * (link._baseValue ?? link.value ?? 0))
          )
          .force("charge", d3.forceManyBody<SimNode>().strength(GRAPH_CONFIG.charge))
          .force("x", d3.forceX<SimNode>().strength(0.03))
          .force("y", d3.forceY<SimNode>().strength(0.09))
          .force(
            "collide",
            d3
              .forceCollide<SimNode>()
              .radius((node) => Math.max(node.w, node.h) / 2 + GRAPH_CONFIG.collidePad)
              .iterations(3)
          )
          .on("tick", requestRender);

        simRef.current = simulation;
        applyConnectionVisibility(controlsRef.current.hideConnections);
        updateSimulationForces();
        simulation.alpha(1).restart();
        requestRender();

        await preloadImages(abortController.signal);
        scheduleUpgradePass(abortController.signal, 0);
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

      window.removeEventListener("resize", resize);
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
    // These helpers read mutable refs on purpose; reinitializing the graph on every render is unnecessary.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphUrl, imageBasePath]);

  useEffect(() => {
    controlsRef.current.hideConnections = hideConnections;
    applyConnectionVisibility(hideConnections);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hideConnections]);

  useEffect(() => {
    controlsRef.current.chargeMult = chargeMult;
    controlsRef.current.distMinMult = distMinMult;
    controlsRef.current.distMaxMult = distMaxMult;
    nudgeSimulation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chargeMult, distMinMult, distMaxMult]);

  // TODO: make this fade between colours instead of hard switching.
  const alphaColorClass = alpha < 0.01 ? "text-green-600" : "text-red-600";


  const canvasThemeClass = darkMode ? "bg-neutral-950 text-neutral-100" : "bg-stone-100 text-neutral-950";
  const overlayToneClass = darkMode
    ? "border border-white/10 bg-black/35 text-neutral-100"
    : "border border-black/10 bg-white/35 text-neutral-950";
  const inspectOverlayClass = darkMode ? "bg-black/75 text-neutral-100" : "bg-white/75 text-neutral-950";

  return (
    <div className={`h-full w-full transition-colors ${canvasThemeClass}`}>
      <nav className="absolute left-[1vmin] right-[1vmin] top-[1vmin] z-[5] flex h-8 items-center">
        {!menuOpen && (
          <button
            onClick={() => setMenuOpen(true)}
            className={`flex h-8 w-8 items-center justify-center rounded-md ${overlayControlClass} ${overlayToneClass}`}
            aria-label="Open graph controls"
          >
            <Menu className="h-4 w-4" />
          </button>
        )}

        <div className="ml-auto flex h-full items-center gap-2">
          <button
            onClick={() => setDarkMode((current) => !current)}
            className={`flex h-8 w-8 items-center justify-center rounded-full ${overlayControlClass} ${overlayToneClass}`}
            aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
            aria-pressed={darkMode}
          >
            {darkMode ? "◐" : "◑"}
          </button>

          <Link
            href="/"
            className={`flex h-8 w-8 items-center justify-center rounded-md ${overlayControlClass} ${overlayToneClass}`}
            aria-label="Back to home"
          >
            <ArrowRightFromLine className="h-4 w-4" />
          </Link>
        </div>
      </nav>

      {menuOpen && (
        <div className={`${overlayPanelClass} ${overlayToneClass}`}>
          <div className="w-full flex items-start">
            <div className="flex-1 text-center">
              <p className={overlayTextClass}>Simulation Alpha:</p>
              <p className={`${overlayTextClass} ${alphaColorClass}`}>{alpha.toFixed(3)}</p>
            </div>

            <button
              onClick={() => setMenuOpen(false)}
              className={`ml-auto m-0 flex h-5 w-5 items-center justify-center ${overlayControlClass}`}
              aria-label="Close graph controls"
            >
              <X className="h-4 w-4" />
            </button>

          </div>

          <label className={`flex items-center justify-center gap-1 ${overlayTextClass}`}>
            Hide Connections{" "}
            <input
              type="checkbox"
              checked={hideConnections}
              onChange={(event) => setHideConnections(event.target.checked)}
              className="m-0 h-2.5"
            />
          </label>

          <input
            type="range"
            min={0}
            max={5}
            step="any"
            value={chargeMult}
            onChange={(event) => setChargeMult(Number(event.target.value))}
            className={sliderClass}
          />
          <p className={overlayTextClass}>Charge Mult: {chargeMult.toFixed(2)}</p>

          <input
            type="range"
            min={0}
            max={500}
            step="any"
            value={distMinMult / 0.1}
            onChange={(event) => setDistMinMult(Number(event.target.value) * 0.1)}
            className={sliderClass}
          />
          <p className={overlayTextClass}>Dist Min Mult: {distMinMult.toFixed(2)}</p>

          <input
            type="range"
            min={0}
            max={50}
            step="any"
            value={distMaxMult / 0.1}
            onChange={(event) => setDistMaxMult(Number(event.target.value) * 0.1)}
            className={sliderClass}
          />
          <p className={overlayTextClass}>Dist Max Mult: {distMaxMult.toFixed(2)}</p>
        </div>
      )}

      {inspectUrl && (
        <div
          onClick={() => setInspectUrl(null)}
          className={`absolute left-1/2 top-1/2 z-10 flex h-[70vh] w-[70vw] -translate-x-1/2 -translate-y-1/2 items-center justify-center ${inspectOverlayClass} backdrop-blur-sm`}
        // TODO: add colour swatches to inspect view
        // TODO: add pinterest/save button to inspect view ???
        >
          <button
            onClick={(event) => {
              event.stopPropagation();
              setInspectUrl(null);
            }}
            className={`absolute right-[2%] top-[2%] flex h-8 w-8 items-center justify-center ${overlayControlClass}`}
            aria-label="Close image inspection"
          >
            X
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={inspectUrl}
            alt=""
            className="max-h-[90%] max-w-[90%]"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      )}

      <canvas
        ref={canvasRef}
        className="block h-full w-full m-0 [image-rendering:pixelated]"
      />
    </div>
  );
}
