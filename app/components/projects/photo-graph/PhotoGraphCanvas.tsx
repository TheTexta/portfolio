"use client";

import { usePathname } from "next/navigation";

import {
  Fragment,
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import * as d3 from "d3";
// TODO: Migrate to d3-react

import { Download, Menu, X } from "lucide-react";

import { useTheme } from "@/app/components/theme/theme-provider";
import { PROJECT_ROUTES } from "@/app/components/projects/project-routes";
import {
  buildOptimizedImageUrl,
  computeTargetImageWidth,
  shouldUpgradeWidth,
} from "@/app/components/projects/photo-graph/imageOptimizer";
import {
  OverlayControlAnchor,
  OverlayControlButton,
} from "@/app/components/ui/overlay-control-button";
import OverlayNavBar from "@/app/components/ui/overlay-nav-bar";
import { storage } from "@/lib/firebase/client";
import type { GraphImageDimensions } from "@/lib/photo-graph/types";
import { getDownloadURL, ref } from "firebase/storage";

type RawNode = {
  id?: string | number;
  scale?: number;
  colour?: string;
  correlations?: Record<string, number>;
  storagePath?: string;
  url?: string;
  dimensions?: GraphImageDimensions;
};

type SimNode = d3.SimulationNodeDatum & {
  id: string;
  colour?: string;
  sourceUrl: string;
  baseSize: number;
  aspectRatio: number;
  layerNoise: number;
  w: number;
  h: number;
  renderArea: number;
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

type RectangleCollisionForce = {
  (alpha: number): void;
  initialize: (nodes: SimNode[] | ArrayLike<SimNode>) => void;
};

type TickableSimulation = d3.Simulation<SimNode, SimLink> & {
  tick: (iterations?: number) => TickableSimulation;
};

type NodePositionSnapshot = { x: number; y: number }[];

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

type GraphSliderConfig = {
  key: Exclude<keyof GraphControls, "hideConnections">;
  label: string;
  min: number;
  max: number;
  scale?: number;
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
  balanceStartDeviationLog2: 0.3,
  balanceMaxDeviationLog2: 1.5,
  maxAreaBoost: 1.55,
  maxLongSideMultiplier: 2,
  collidePad: 0,
  collideBoxScale: 1.3,
  collideStrength: 0.55,
  collideIterations: 1,
  linkStrengthMin: 0.0001,
  linkStrengthMax: 0.04,
  linkNodeSizeDistanceFactor: 0.72,
  layerAreaBlurStrength: 0.14,
  distMin: 10,
  distMax: 1600,
  charge: -420,
  zoomExtent: [0.25, 4] as [number, number],
  initialZoom: 0.8,
  initialRenderAlpha: 0.12,
  initialLayoutTicksMin: 90,
  initialLayoutTicksMax: 220,
  initialLayoutTicksPerSqrtNode: 18,
  initialCompactionAlpha: 0.6,
  initialCompactionTickFactor: 0.7,
  initialCompactionDurationMs: 1500,
  imageConcurrency: 5,
  upgradeDebounceMs: 120,
  viewportBufferRatio: 0.15,
};

const overlayPanelClass =
  "absolute left-[1vmin] top-[1vmin] z-[5] space-y-2 p-1.5 text-center backdrop-blur-[2px]";
const overlayTextClass = "m-0 p-0 text-xs";
const photoGraphShellClass = "bg-neutral-950 text-neutral-100";
const photoGraphOverlayClass = "overlay-tone-base bg-overlay-fill-soft";
const photoGraphModalClass = "bg-overlay-panel text-overlay-ink";
const sliderClass =
  "range-sm h-1 rounded-full border-none bg-black/15 accent-ink dark:bg-white/35";
const DEFAULT_CHARGE_MULT = 1;
const INITIAL_DIST_MAX_MULT = 5;
const DEFAULT_DIST_MAX_MULT = 1;
const DEFAULT_GRAPH_CONTROLS: GraphControls = {
  hideConnections: false,
  chargeMult: DEFAULT_CHARGE_MULT,
  distMinMult: 1,
  distMaxMult: DEFAULT_DIST_MAX_MULT,
};
const INITIAL_LAYOUT_CONTROLS: GraphControls = {
  ...DEFAULT_GRAPH_CONTROLS,
  distMaxMult: INITIAL_DIST_MAX_MULT,
};
const GRAPH_CONTROL_SLIDERS: readonly GraphSliderConfig[] = [
  { key: "chargeMult", label: "Charge Mult", min: 0, max: 5 },
  { key: "distMinMult", label: "Dist Min Mult", min: 0, max: 500, scale: 0.1 },
  { key: "distMaxMult", label: "Dist Max Mult", min: 0, max: 50, scale: 0.1 },
];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function easeOutExponential(progress: number, decay = 6) {
  if (progress <= 0) return 0;
  if (progress >= 1) return 1;

  const normalizedDecay = 1 - Math.exp(-decay);
  return (1 - Math.exp(-decay * progress)) / normalizedDecay;
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function cancelAnimationFrameRef(frameRef: { current: number | null }) {
  if (frameRef.current === null) return;

  window.cancelAnimationFrame(frameRef.current);
  frameRef.current = null;
}

function clearTimeoutRef(timeoutRef: { current: number | null }) {
  if (timeoutRef.current === null) return;

  window.clearTimeout(timeoutRef.current);
  timeoutRef.current = null;
}

function patchNullableState<T extends object>(
  setState: Dispatch<SetStateAction<T | null>>,
  patch: Partial<T>,
) {
  setState((current) => (current ? { ...current, ...patch } : current));
}

function resolveNodeId(node: RawNode, index: number) {
  return String(node.id ?? index + 1);
}

function computeNodeLayerNoise(id: string) {
  // Deterministic per-node noise in [-1, 1] to softly blur strict layering.
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  }

  if (hash === 0) {
    return 0;
  }

  return (hash / 0xffffffff) * 2 - 1;
}

function normalizeAspectRatio(aspectRatio: number | undefined) {
  if (!Number.isFinite(aspectRatio) || !aspectRatio || aspectRatio <= 0) {
    return 1;
  }

  return aspectRatio;
}

function resolveRawAspectRatio(dimensions: GraphImageDimensions | undefined) {
  if (!dimensions) {
    return 1;
  }

  const derivedAspect = dimensions.width / dimensions.height;
  return normalizeAspectRatio(
    Number.isFinite(dimensions.aspectRatio) && dimensions.aspectRatio > 0
      ? dimensions.aspectRatio
      : derivedAspect,
  );
}

function sizeNodeFromAspectRatio(node: SimNode) {
  const aspectRatio = normalizeAspectRatio(node.aspectRatio);
  const baseSize = Math.max(1, node.baseSize);
  const deviation = Math.abs(Math.log2(aspectRatio));
  const progress = clamp(
    (deviation - GRAPH_CONFIG.balanceStartDeviationLog2) /
      (GRAPH_CONFIG.balanceMaxDeviationLog2 -
        GRAPH_CONFIG.balanceStartDeviationLog2),
    0,
    1,
  );
  const areaBoost = 1 + progress * (GRAPH_CONFIG.maxAreaBoost - 1);
  const targetArea = baseSize * baseSize * areaBoost;

  let width = Math.sqrt(targetArea * aspectRatio);
  let height = Math.sqrt(targetArea / aspectRatio);

  const longSideLimit = baseSize * GRAPH_CONFIG.maxLongSideMultiplier;
  const longSide = Math.max(width, height);
  if (longSide > longSideLimit) {
    const shrink = longSideLimit / longSide;
    width *= shrink;
    height *= shrink;
  }

  node.w = width;
  node.h = height;
  node.renderArea = Math.max(1, width * height);
}

async function resolveNodeSourceUrl(
  node: RawNode,
  id: string,
  imageBasePath: string,
) {
  if (node.url) return node.url;
  const storagePath =
    node.storagePath ?? `${imageBasePath.replace(/\/$/, "")}/${id}.png`;
  return getDownloadURL(ref(storage, storagePath));
}

function sizeNodeFromImage(node: SimNode, image: HTMLImageElement) {
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;

  if (!width || !height) return;

  node.aspectRatio = normalizeAspectRatio(width / height);
  sizeNodeFromAspectRatio(node);
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
      const aspectRatio = resolveRawAspectRatio(entry.dimensions);
      const node: SimNode = {
        id,
        colour: entry.colour,
        sourceUrl: await resolveNodeSourceUrl(entry, id, imageBasePath),
        baseSize: box,
        aspectRatio,
        layerNoise: computeNodeLayerNoise(id),
        w: box,
        h: box,
        renderArea: box * box,
      };

      sizeNodeFromAspectRatio(node);

      return node;
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

function createRectangleCollideForce(
  padding = 0,
  boxScale = GRAPH_CONFIG.collideBoxScale,
  strength = GRAPH_CONFIG.collideStrength,
  iterations = GRAPH_CONFIG.collideIterations,
): RectangleCollisionForce {
  let nodes: SimNode[] = [];

  const force: RectangleCollisionForce = (alpha) => {
    if (!nodes.length) return;

    for (let iteration = 0; iteration < iterations; iteration += 1) {
      for (let leftIndex = 0; leftIndex < nodes.length; leftIndex += 1) {
        const left = nodes[leftIndex];
        const leftX = left.x ?? 0;
        const leftY = left.y ?? 0;
        const leftHalfWidth = (left.w * boxScale) / 2 + padding;
        const leftHalfHeight = (left.h * boxScale) / 2 + padding;

        for (
          let rightIndex = leftIndex + 1;
          rightIndex < nodes.length;
          rightIndex += 1
        ) {
          const right = nodes[rightIndex];
          const rightX = right.x ?? 0;
          const rightY = right.y ?? 0;
          const rightHalfWidth = (right.w * boxScale) / 2 + padding;
          const rightHalfHeight = (right.h * boxScale) / 2 + padding;

          const deltaX = rightX - leftX;
          const deltaY = rightY - leftY;
          const overlapX = leftHalfWidth + rightHalfWidth - Math.abs(deltaX);
          if (overlapX <= 0) continue;

          const overlapY = leftHalfHeight + rightHalfHeight - Math.abs(deltaY);
          if (overlapY <= 0) continue;

          const pushFactor = strength * alpha;
          if (overlapX < overlapY) {
            const directionX = deltaX === 0 ? 1 : Math.sign(deltaX);
            const pushX = overlapX * pushFactor * directionX;

            if (left.fx == null && right.fx == null) {
              left.vx = (left.vx ?? 0) - pushX * 0.5;
              right.vx = (right.vx ?? 0) + pushX * 0.5;
            } else if (left.fx == null) {
              left.vx = (left.vx ?? 0) - pushX;
            } else if (right.fx == null) {
              right.vx = (right.vx ?? 0) + pushX;
            }
            continue;
          }

          const directionY = deltaY === 0 ? 1 : Math.sign(deltaY);
          const pushY = overlapY * pushFactor * directionY;
          if (left.fy == null && right.fy == null) {
            left.vy = (left.vy ?? 0) - pushY * 0.5;
            right.vy = (right.vy ?? 0) + pushY * 0.5;
          } else if (left.fy == null) {
            left.vy = (left.vy ?? 0) - pushY;
          } else if (right.fy == null) {
            right.vy = (right.vy ?? 0) + pushY;
          }
        }
      }
    }
  };

  force.initialize = (nextNodes) => {
    nodes = Array.from(nextNodes);
  };

  return force;
}

function getLinkValue(link: SimLink) {
  return clamp(link._baseValue ?? link.value ?? 0, 0, 1);
}

function resolveLinkNodes(link: SimLink) {
  const source = typeof link.source === "object" ? link.source : null;
  const target = typeof link.target === "object" ? link.target : null;
  return { source, target };
}

function computeLinkDistance(
  link: SimLink,
  minDistance: number,
  maxDistance: number,
) {
  const value = getLinkValue(link);
  const desiredDistance =
    minDistance + (1 - value) * (maxDistance - minDistance);
  const { source, target } = resolveLinkNodes(link);
  if (!source || !target) {
    return desiredDistance;
  }

  const minAxisDistance = Math.max(
    ((source.w + target.w) / 2) * GRAPH_CONFIG.linkNodeSizeDistanceFactor,
    ((source.h + target.h) / 2) * GRAPH_CONFIG.linkNodeSizeDistanceFactor,
  );

  return Math.max(desiredDistance, minAxisDistance);
}

function computeLinkStrength(link: SimLink) {
  const value = getLinkValue(link);
  return (
    GRAPH_CONFIG.linkStrengthMin +
    value * (GRAPH_CONFIG.linkStrengthMax - GRAPH_CONFIG.linkStrengthMin)
  );
}

function applySimulationForces(
  simulation: d3.Simulation<SimNode, SimLink>,
  controls: GraphControls,
) {
  const minDistance = GRAPH_CONFIG.distMin * controls.distMinMult;
  const maxDistance = GRAPH_CONFIG.distMax * controls.distMaxMult;

  const linkForce = simulation.force("link") as
    | d3.ForceLink<SimNode, SimLink>
    | undefined;
  if (linkForce) {
    linkForce.distance((link) =>
      computeLinkDistance(link, minDistance, maxDistance),
    );
    linkForce.strength((link) => computeLinkStrength(link));
  }

  const chargeForce = simulation.force("charge") as
    | d3.ForceManyBody<SimNode>
    | undefined;
  chargeForce?.strength(controls.chargeMult * GRAPH_CONFIG.charge);
}

function createSimulation(
  nodes: SimNode[],
  links: SimLink[],
  onTick: () => void,
  controls: GraphControls,
) {
  const simulation = d3
    .forceSimulation<SimNode>(nodes)
    .force(
      "link",
      d3.forceLink<SimNode, SimLink>(links).id((node) => node.id),
    )
    .force("charge", d3.forceManyBody<SimNode>())
    .force("x", d3.forceX<SimNode>().strength(0.03))
    .force("y", d3.forceY<SimNode>().strength(0.09))
    .force("collide", createRectangleCollideForce(GRAPH_CONFIG.collidePad))
    .on("tick", onTick);

  applySimulationForces(simulation, controls);
  return simulation;
}

function getInitialLayoutTickCount(nodeCount: number) {
  return clamp(
    Math.round(
      Math.sqrt(Math.max(1, nodeCount)) *
        GRAPH_CONFIG.initialLayoutTicksPerSqrtNode,
    ),
    GRAPH_CONFIG.initialLayoutTicksMin,
    GRAPH_CONFIG.initialLayoutTicksMax,
  );
}

function getInitialCompactionTickCount(nodeCount: number) {
  return Math.max(
    1,
    Math.round(
      getInitialLayoutTickCount(nodeCount) *
        GRAPH_CONFIG.initialCompactionTickFactor,
    ),
  );
}

function warmupSimulationLayout(
  simulation: d3.Simulation<SimNode, SimLink>,
  tickCount: number,
  alpha = 1,
) {
  const tickableSimulation = simulation as TickableSimulation;
  tickableSimulation.stop();
  tickableSimulation.alpha(alpha);
  tickableSimulation.tick(tickCount);
}

function captureNodePositions(nodes: SimNode[]): NodePositionSnapshot {
  return nodes.map((node) => ({
    x: node.x ?? 0,
    y: node.y ?? 0,
  }));
}

function applyNodePositions(
  nodes: SimNode[],
  positions: NodePositionSnapshot,
  progress = 1,
) {
  nodes.forEach((node, index) => {
    const position = positions[index];
    if (!position) return;

    node.x = (node.x ?? 0) + (position.x - (node.x ?? 0)) * progress;
    node.y = (node.y ?? 0) + (position.y - (node.y ?? 0)) * progress;
    node.vx = 0;
    node.vy = 0;
  });
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

function getNodeRenderArea(node: SimNode) {
  if (Number.isFinite(node.renderArea) && node.renderArea > 0) {
    return node.renderArea;
  }

  return Math.max(1, node.w * node.h);
}

function getNodeLayerArea(node: SimNode) {
  const baseArea = getNodeRenderArea(node);
  const blurScale =
    1 + clamp(node.layerNoise, -1, 1) * GRAPH_CONFIG.layerAreaBlurStrength;
  return Math.max(1, baseArea * blurScale);
}

function getRenderOrderedNodes(nodes: SimNode[]) {
  return [...nodes].sort((left, right) => {
    const areaDelta = getNodeLayerArea(right) - getNodeLayerArea(left);
    if (Math.abs(areaDelta) > 1e-6) {
      return areaDelta;
    }

    return left.id.localeCompare(right.id);
  });
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

function convertSizeToMb(sizeInBytes: number) {
  return sizeInBytes / (1024 * 1024);
}

export default function PhotoGraphCanvas({
  graphUrl = "/api/photo-graph/graph",
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
  const introCompactionFrameRef = useRef<number | null>(null);
  const settleTimeoutRef = useRef<number | null>(null);
  const upgradeTimeoutRef = useRef<number | null>(null);
  const alphaRef = useRef({ value: 1, updatedAt: 0 });
  const darkModeRef = useRef(false);
  const controlsRef = useRef<GraphControls>({ ...DEFAULT_GRAPH_CONTROLS });

  const [menuOpen, setMenuOpen] = useState(false);
  const [controls, setControls] = useState<GraphControls>(() => ({
    ...DEFAULT_GRAPH_CONTROLS,
  }));
  const [alpha, setAlpha] = useState(1);
  const [inspectTarget, setInspectTarget] = useState<InspectTarget | null>(
    null,
  );
  const [inspectMetadata, setInspectMetadata] =
    useState<InspectMetadata | null>(null);
  const patchInspectMetadata = useCallback(
    (patch: Partial<InspectMetadata>) => {
      patchNullableState(setInspectMetadata, patch);
    },
    [],
  );
  const setControlValue = useCallback(
    <K extends keyof GraphControls>(key: K, value: GraphControls[K]) => {
      setControls((current) =>
        current[key] === value ? current : { ...current, [key]: value },
      );
    },
    [],
  );

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
    context.lineWidth = 1;

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

    const renderNodes = getRenderOrderedNodes(nodesRef.current);
    for (const node of renderNodes) {
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

  const animateInitialCompaction = useCallback(
    (
      nodes: SimNode[],
      fromPositions: NodePositionSnapshot,
      toPositions: NodePositionSnapshot,
      signal: AbortSignal,
    ) =>
      new Promise<void>((resolve) => {
        applyNodePositions(nodes, fromPositions);
        requestRender();

        const finish = () => {
          cancelAnimationFrameRef(introCompactionFrameRef);
          applyNodePositions(nodes, toPositions);
          requestRender();
          resolve();
        };

        if (signal.aborted) {
          finish();
          return;
        }

        const startedAt = performance.now();

        const step = (now: number) => {
          if (signal.aborted) {
            finish();
            return;
          }

          const progress = clamp(
            (now - startedAt) / GRAPH_CONFIG.initialCompactionDurationMs,
            0,
            1,
          );
          const easedProgress = easeOutExponential(progress);

          nodes.forEach((node, index) => {
            const fromPosition = fromPositions[index];
            const toPosition = toPositions[index];
            if (!fromPosition || !toPosition) return;

            node.x =
              fromPosition.x + (toPosition.x - fromPosition.x) * easedProgress;
            node.y =
              fromPosition.y + (toPosition.y - fromPosition.y) * easedProgress;
            node.vx = 0;
            node.vy = 0;
          });

          requestRender();

          if (progress < 1) {
            introCompactionFrameRef.current =
              window.requestAnimationFrame(step);
            return;
          }

          introCompactionFrameRef.current = null;
          resolve();
        };

        introCompactionFrameRef.current = window.requestAnimationFrame(step);
      }),
    [requestRender],
  );

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
      const renderNodes = getRenderOrderedNodes(nodesRef.current);

      for (let index = renderNodes.length - 1; index >= 0; index -= 1) {
        const node = renderNodes[index];
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

    applySimulationForces(simulation, controlsRef.current);
  }, []);

  const nudgeSimulation = useCallback(
    (target = 0.75, settleDelay = 150) => {
      const simulation = simRef.current;
      if (!simulation) return;

      updateSimulationForces();
      simulation.alphaTarget(target).restart();

      clearTimeoutRef(settleTimeoutRef);
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
      | RectangleCollisionForce
      | undefined;
    collideForce?.initialize?.(nodesRef.current);

    nudgeSimulation(0.08, 220);
    requestRender();
  }, [nudgeSimulation, requestRender]);

  const applyLoadedImage = useCallback(
    (
      node: SimNode,
      image: HTMLImageElement,
      loadedWidth: number,
      onlyIfMissing = false,
    ) => {
      if (onlyIfMissing) {
        if (imagesRef.current.has(node.id)) return;
      } else if (!shouldUpgradeWidth(node.loadedWidth, loadedWidth)) {
        return;
      }

      sizeNodeFromImage(node, image);
      node.loadedWidth = loadedWidth;
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
          applyLoadedImage(node, optimizedImage, targetWidth);
        } catch (error) {
          if (isAbortError(error)) return;

          try {
            const fallbackImage = await loadImage(node.sourceUrl, signal);
            if (signal.aborted) return;
            applyLoadedImage(node, fallbackImage, 0, true);
          } catch (fallbackError) {
            if (isAbortError(fallbackError)) return;
            logNodeImageError(node, fallbackError);
          }
        }
      } finally {
        trackPendingWidth(node, targetWidth, false);
      }
    },
    [applyLoadedImage, logNodeImageError, trackPendingWidth],
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
    (nodes: SimNode[], signal: AbortSignal) =>
      runNodeQueue(nodes, signal, getNodeTargetWidth),
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
      clearTimeoutRef(upgradeTimeoutRef);
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
      resetRuntimeCollections();
      await preloadImages(nodes, abortController.signal);
      if (abortController.signal.aborted) {
        return;
      }

      nodesRef.current = nodes;
      linksRef.current = links;

      const simulation = createSimulation(
        nodes,
        links,
        requestRender,
        INITIAL_LAYOUT_CONTROLS,
      );
      warmupSimulationLayout(
        simulation,
        getInitialLayoutTickCount(nodes.length),
      );
      const expandedPositions = captureNodePositions(nodes);
      applySimulationForces(simulation, controlsRef.current);
      warmupSimulationLayout(
        simulation,
        getInitialCompactionTickCount(nodes.length),
        GRAPH_CONFIG.initialCompactionAlpha,
      );
      const compactedPositions = captureNodePositions(nodes);
      applyNodePositions(nodes, expandedPositions);
      applyConnectionVisibility(controlsRef.current.hideConnections);
      requestRender();
      await animateInitialCompaction(
        nodes,
        expandedPositions,
        compactedPositions,
        abortController.signal,
      );
      if (abortController.signal.aborted) {
        return;
      }

      simRef.current = simulation;
      simulation.alpha(GRAPH_CONFIG.initialRenderAlpha).restart();
      requestRender();

      scheduleUpgradePass(abortController.signal, 0);
    };

    const cleanupRuntime = () => {
      window.removeEventListener("resize", resizeCanvas);
      resizeObserver.disconnect();
      cleanupInteractions();

      cancelAnimationFrameRef(frameRef);
      cancelAnimationFrameRef(introCompactionFrameRef);
      clearTimeoutRef(settleTimeoutRef);
      clearTimeoutRef(upgradeTimeoutRef);

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
    animateInitialCompaction,
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
        patchInspectMetadata({
          sizeMb: convertSizeToMb(blob.size),
          downloadUrl: objectUrl,
          filename: buildInspectFilename(
            inspectTarget.id,
            inspectTarget.url,
            blob.type,
          ),
        });
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
  }, [inspectTarget, patchInspectMetadata]);

  // TODO: make this fade between colours instead of hard switching.
  const alphaColorClass =
    alpha < 0.01
      ? "text-emerald-700 dark:text-emerald-300"
      : "text-red-700 dark:text-red-300";
  const isFullPageRoute = usePathname() === PROJECT_ROUTES.photoGraph;
  return (
    <div className={`static h-full w-full transition-colors ${photoGraphShellClass}`}>
      {!menuOpen && (
        <OverlayControlButton
          onClick={() => setMenuOpen(true)}
          className="absolute top-[1vmin] left-[1vmin] z-6"
          aria-label="Open graph controls"
        >
          <Menu className="h-4 w-4" />
        </OverlayControlButton>
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
        ariaLabel="Photo graph controls"
      />

      {menuOpen && (
        <div
          className={`rounded-md select-none ${overlayPanelClass} border ${photoGraphOverlayClass}`}
        >
          <div className="flex w-full items-start">
            

            <OverlayControlButton
              onClick={() => setMenuOpen(false)}
              size="sm"
              className="ml-auto"
              aria-label="Close graph controls"
            >
              <X className="h-4 w-4" />
            </OverlayControlButton>
            <div className="flex-1 text-center">
              <p className={`mx-2 ${overlayTextClass}`}>Simulation Alpha</p>
              <p className={`${overlayTextClass} ${alphaColorClass}`}>
                {alpha.toFixed(3)}
              </p>
            </div>
          </div>

          <label
            className={`flex items-center justify-center gap-1 ${overlayTextClass}`}
          >
            Hide Connections{" "}
            <input
              type="checkbox"
              checked={controls.hideConnections}
              onChange={(event) =>
                setControlValue("hideConnections", event.target.checked)
              }
              className="m-0 h-2.5"
            />
          </label>

          {GRAPH_CONTROL_SLIDERS.map(({ key, label, min, max, scale = 1 }) => (
            <Fragment key={key}>
              <input
                type="range"
                min={min}
                max={max}
                value={controls[key] / scale}
                onChange={(event) =>
                  setControlValue(key, Number(event.target.value) * scale)
                }
                className={sliderClass}
              />
              <p className={overlayTextClass}>
                {label}: {controls[key].toFixed(2)}
              </p>
            </Fragment>
          ))}
        </div>
      )}

      {inspectTarget && (
        <div
          onClick={() => setInspectTarget(null)}
          className={`absolute inset-0 z-10 m-auto flex max-h-9/12 max-w-9/12 items-center justify-center ${photoGraphModalClass} backdrop-blur-sm`}
          // TODO: add colour swatches to inspect view
          // TODO: add fadein/out animations and fade the other ui elements while doing so through the flex container holding all of them.
        >
          <div
            className="relative flex h-full w-full flex-col items-center justify-center"
            onClick={(event) => event.stopPropagation()}
          >
            <OverlayControlButton
              onClick={() => setInspectTarget(null)}
              className="absolute top-0 right-0 mx-2 my-2"
              aria-label="Close image inspection"
            >
              <X className="h-4 w-4" />
            </OverlayControlButton>

            {/* eslint-disable-next-line @next/next/no-img-element -- This inspect overlay needs the raw image element for natural-size reads and unrestricted sizing. */}
            <img
              src={inspectTarget.url}
              alt=""
              className="my-auto max-h-9/12 max-w-5/6 place-self-center align-middle"
              onLoad={(event) => {
                const { naturalWidth, naturalHeight } = event.currentTarget;
                patchInspectMetadata({
                  resolution: {
                    width: naturalWidth,
                    height: naturalHeight,
                  },
                });
              }}
            />

            <div
              className={`absolute bottom-0 flex h-1/8 w-full items-center justify-between gap-4 px-4 text-[9px] sm:text-xs ${overlayTextClass}`}
            >
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

              <OverlayControlAnchor
                href={inspectMetadata?.downloadUrl ?? undefined}
                download={inspectMetadata?.filename}
                layout="action"
                size="sm"
                className={`gap-1 ${
                  inspectMetadata?.downloadUrl
                    ? ""
                    : "pointer-events-none opacity-50"
                }`}
                aria-disabled={!inspectMetadata?.downloadUrl}
              >
                Download Original
                <Download className="h-4 w-4" />
              </OverlayControlAnchor>
            </div>
          </div>
        </div>
      )}

      <canvas
        ref={canvasRef}
        className="relative m-0 block h-full w-full bg-white [image-rendering:pixelated] dark:bg-black"
      />
    </div>
  );
}
