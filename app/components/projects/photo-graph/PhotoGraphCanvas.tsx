"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";

import {
  Fragment,
  type Dispatch,
  type ReactElement,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import * as d3 from "d3";
import type { ForceGraphMethods, LinkObject, NodeObject } from "react-force-graph-2d";

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

type NodeDrawBounds = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type PhotoGraphNodeBase = {
  id: string;
  colour?: string;
  sourceUrl: string;
  baseSize: number;
  aspectRatio: number;
  hasKnownAspectRatio: boolean;
  layerNoise: number;
  w: number;
  h: number;
  renderArea: number;
  loadedWidth?: number;
  requestedWidth?: number;
  __drawBounds?: NodeDrawBounds;
};

type PhotoGraphNode = NodeObject<PhotoGraphNodeBase> & PhotoGraphNodeBase;

type PhotoGraphLinkBase = {
  source: string | PhotoGraphNode;
  target: string | PhotoGraphNode;
  value: number;
  _baseValue?: number;
};

type PhotoGraphLink = LinkObject<PhotoGraphNode, PhotoGraphLinkBase> &
  PhotoGraphLinkBase;

type PhotoGraphData = {
  nodes: PhotoGraphNode[];
  links: PhotoGraphLink[];
};

type PhotoGraphInstance = ForceGraphMethods<PhotoGraphNode, PhotoGraphLink>;
type RuntimeForce = Parameters<PhotoGraphInstance["d3Force"]>[1];

type RectangleCollisionForce = {
  (alpha: number): void;
  initialize: (nodes: PhotoGraphNode[] | ArrayLike<PhotoGraphNode>) => void;
};

type TickableSimulation = d3.Simulation<PhotoGraphNode, PhotoGraphLink> & {
  tick: (iterations?: number) => TickableSimulation;
};

type NodePositionSnapshot = Record<string, { x: number; y: number }>;

type GraphTransform = { k: number; x: number; y: number };

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

type IntroLayout = {
  expanded: NodePositionSnapshot;
  compacted: NodePositionSnapshot;
};

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-white dark:bg-black" />,
}) as unknown as (props: Record<string, unknown>) => ReactElement;

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
  initialLayoutTicksMin: 90,
  initialLayoutTicksMax: 220,
  initialLayoutTicksPerSqrtNode: 18,
  initialCompactionAlpha: 0.6,
  initialCompactionTickFactor: 0.7,
  initialCompactionDurationMs: 1500,
  imageConcurrency: 5,
  upgradeDebounceMs: 120,
  viewportBufferRatio: 0.15,
  alphaMin: 0.001,
  xForceStrength: 0.03,
  yForceStrength: 0.09,
};

const overlayPanelClass =
  "absolute left-[1vmin] top-[1vmin] z-[5] space-y-2 p-1.5 text-center backdrop-blur-[2px]";
const overlayTextClass = "m-0 p-0 text-xs";
const photoGraphShellClass = "bg-neutral-950 text-neutral-100";
const photoGraphOverlayClass = "overlay-tone-base bg-overlay-fill-soft";
const photoGraphModalClass = "bg-overlay-panel text-overlay-ink";
const sliderClass =
  "range-sm h-1 rounded-full border-none bg-black/15 accent-ink dark:bg-white/35";
const INSPECT_OVERLAY_TRANSITION_MS = 220;
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

function sizeNodeFromAspectRatio(node: PhotoGraphNode) {
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

function sizeNodeFromImage(node: PhotoGraphNode, image: HTMLImageElement) {
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;

  if (!width || !height) return;

  node.aspectRatio = normalizeAspectRatio(width / height);
  sizeNodeFromAspectRatio(node);
}

async function buildGraph(data: RawNode[], imageBasePath: string) {
  const nodes: PhotoGraphNode[] = await Promise.all(
    data.map(async (entry, index) => {
      const id = resolveNodeId(entry, index);
      const box = clamp(
        Math.round((entry.scale ?? 0.5) * GRAPH_CONFIG.baseBox),
        GRAPH_CONFIG.minBox,
        GRAPH_CONFIG.maxBox,
      );
      const aspectRatio = resolveRawAspectRatio(entry.dimensions);
      const node: PhotoGraphNode = {
        id,
        colour: entry.colour,
        sourceUrl: await resolveNodeSourceUrl(entry, id, imageBasePath),
        baseSize: box,
        aspectRatio,
        hasKnownAspectRatio: Boolean(entry.dimensions),
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
  const links: PhotoGraphLink[] = [];

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
  let nodes: PhotoGraphNode[] = [];

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

function getLinkValue(link: PhotoGraphLink) {
  return clamp(link._baseValue ?? link.value ?? 0, 0, 1);
}

function resolveLinkNodes(link: PhotoGraphLink) {
  const source = typeof link.source === "object" ? link.source : null;
  const target = typeof link.target === "object" ? link.target : null;
  return { source, target };
}

function computeLinkDistance(
  link: PhotoGraphLink,
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

function computeLinkStrength(link: PhotoGraphLink) {
  const value = getLinkValue(link);
  return (
    GRAPH_CONFIG.linkStrengthMin +
    value * (GRAPH_CONFIG.linkStrengthMax - GRAPH_CONFIG.linkStrengthMin)
  );
}

function applySimulationForces(
  simulation: d3.Simulation<PhotoGraphNode, PhotoGraphLink>,
  controls: GraphControls,
) {
  const minDistance = GRAPH_CONFIG.distMin * controls.distMinMult;
  const maxDistance = GRAPH_CONFIG.distMax * controls.distMaxMult;

  const linkForce = simulation.force("link") as
    | d3.ForceLink<PhotoGraphNode, PhotoGraphLink>
    | undefined;
  if (linkForce) {
    linkForce.distance((link) =>
      computeLinkDistance(link, minDistance, maxDistance),
    );
    linkForce.strength((link) => computeLinkStrength(link));
  }

  const chargeForce = simulation.force("charge") as
    | d3.ForceManyBody<PhotoGraphNode>
    | undefined;
  chargeForce?.strength(controls.chargeMult * GRAPH_CONFIG.charge);
}

function createPrelayoutSimulation(
  nodes: PhotoGraphNode[],
  links: PhotoGraphLink[],
  controls: GraphControls,
) {
  const simulation = d3
    .forceSimulation<PhotoGraphNode>(nodes)
    .force(
      "link",
      d3.forceLink<PhotoGraphNode, PhotoGraphLink>(links).id((node) => node.id),
    )
    .force("charge", d3.forceManyBody<PhotoGraphNode>())
    .force("x", d3.forceX<PhotoGraphNode>().strength(GRAPH_CONFIG.xForceStrength))
    .force("y", d3.forceY<PhotoGraphNode>().strength(GRAPH_CONFIG.yForceStrength))
    .force("collide", createRectangleCollideForce(GRAPH_CONFIG.collidePad));

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
  simulation: d3.Simulation<PhotoGraphNode, PhotoGraphLink>,
  tickCount: number,
  alpha = 1,
) {
  const tickableSimulation = simulation as TickableSimulation;
  tickableSimulation.stop();
  tickableSimulation.alpha(alpha);
  tickableSimulation.tick(tickCount);
}

function captureNodePositions(nodes: PhotoGraphNode[]): NodePositionSnapshot {
  return Object.fromEntries(
    nodes.map((node) => [
      node.id,
      {
        x: node.x ?? 0,
        y: node.y ?? 0,
      },
    ]),
  );
}

function applyNodePositions(
  nodes: PhotoGraphNode[],
  positions: NodePositionSnapshot,
  progress = 1,
) {
  nodes.forEach((node) => {
    const position = positions[node.id];
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

function getNodeRenderArea(node: PhotoGraphNode) {
  if (Number.isFinite(node.renderArea) && node.renderArea > 0) {
    return node.renderArea;
  }

  return Math.max(1, node.w * node.h);
}

function getNodeLayerArea(node: PhotoGraphNode) {
  const baseArea = getNodeRenderArea(node);
  const blurScale =
    1 + clamp(node.layerNoise, -1, 1) * GRAPH_CONFIG.layerAreaBlurStrength;
  return Math.max(1, baseArea * blurScale);
}

function sortNodesForRender(nodes: PhotoGraphNode[]) {
  nodes.sort((left, right) => {
    const areaDelta = getNodeLayerArea(right) - getNodeLayerArea(left);
    if (Math.abs(areaDelta) > 1e-6) {
      return areaDelta;
    }

    return left.id.localeCompare(right.id);
  });
}

function getCurrentDevicePixelRatio() {
  return typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
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

function clearNodePins(nodes: PhotoGraphNode[]) {
  nodes.forEach((node) => {
    node.fx = undefined;
    node.fy = undefined;
  });
}

function getNodeBounds(node: PhotoGraphNode): NodeDrawBounds {
  return (
    node.__drawBounds ?? {
      left: (node.x ?? 0) - node.w / 2,
      top: (node.y ?? 0) - node.h / 2,
      width: node.w,
      height: node.h,
    }
  );
}

export default function PhotoGraphCanvas({
  graphUrl = "/api/photo-graph/graph",
  imageBasePath = DEFAULT_IMAGE_BASE_PATH,
  forcedDarkMode,
}: PhotoGraphCanvasProps) {
  const { darkMode: siteDarkMode, toggleTheme } = useTheme();
  const activeDarkMode = forcedDarkMode ?? siteDarkMode;
  const isFullPageRoute = usePathname() === PROJECT_ROUTES.photoGraph;

  const fgRef = useRef<PhotoGraphInstance | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const nodesRef = useRef<PhotoGraphNode[]>([]);
  const imagesRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const pendingWidthsRef = useRef<Map<string, Set<number>>>(new Map());
  const errorLogRef = useRef<Set<string>>(new Set());
  const controlsRef = useRef<GraphControls>({ ...DEFAULT_GRAPH_CONTROLS });
  const darkModeRef = useRef(activeDarkMode);
  const transformRef = useRef<GraphTransform>({
    k: GRAPH_CONFIG.initialZoom,
    x: 0,
    y: 0,
  });
  const initAbortRef = useRef<AbortController | null>(null);
  const introLayoutRef = useRef<IntroLayout | null>(null);
  const introFrameRef = useRef<number | null>(null);
  const introActiveRef = useRef(false);
  const introCancelledRef = useRef(false);
  const initialViewAppliedRef = useRef(false);
  const applyingInitialViewRef = useRef(false);
  const upgradeTimeoutRef = useRef<number | null>(null);
  const engineRunningRef = useRef(false);

  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [graphData, setGraphData] = useState<PhotoGraphData>({
    nodes: [],
    links: [],
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const [controls, setControls] = useState<GraphControls>(() => ({
    ...DEFAULT_GRAPH_CONTROLS,
  }));
  const [engineStatus, setEngineStatus] = useState<"settling" | "settled">(
    "settled",
  );
  const [inspectTarget, setInspectTarget] = useState<InspectTarget | null>(
    null,
  );
  const [inspectOverlayOpen, setInspectOverlayOpen] = useState(false);
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

  const openInspectTarget = useCallback((target: InspectTarget) => {
    setInspectTarget(target);
  }, []);

  const closeInspectTarget = useCallback(() => {
    setInspectOverlayOpen(false);
  }, []);

  const configureRuntimeForces = useCallback(() => {
    const graph = fgRef.current;
    if (!graph) return;

    graph.d3Force("center", null);
    graph.d3Force(
      "x",
      d3.forceX<PhotoGraphNode>().strength(
        GRAPH_CONFIG.xForceStrength,
      ) as unknown as RuntimeForce,
    );
    graph.d3Force(
      "y",
      d3.forceY<PhotoGraphNode>().strength(
        GRAPH_CONFIG.yForceStrength,
      ) as unknown as RuntimeForce,
    );
    graph.d3Force(
      "collide",
      createRectangleCollideForce(
        GRAPH_CONFIG.collidePad,
      ) as unknown as RuntimeForce,
    );

    const linkForce = graph.d3Force("link") as
      | d3.ForceLink<PhotoGraphNode, PhotoGraphLink>
      | undefined;
    if (linkForce) {
      const minDistance = GRAPH_CONFIG.distMin * controlsRef.current.distMinMult;
      const maxDistance = GRAPH_CONFIG.distMax * controlsRef.current.distMaxMult;
      linkForce.distance((link) =>
        computeLinkDistance(link as PhotoGraphLink, minDistance, maxDistance),
      );
      linkForce.strength((link) => computeLinkStrength(link as PhotoGraphLink));
    }

    const chargeForce = graph.d3Force("charge") as
      | d3.ForceManyBody<PhotoGraphNode>
      | undefined;
    chargeForce?.strength(controlsRef.current.chargeMult * GRAPH_CONFIG.charge);
  }, []);

  const reinitializeCollisionForce = useCallback(() => {
    const collideForce = fgRef.current?.d3Force("collide") as
      | RectangleCollisionForce
      | undefined;
    collideForce?.initialize?.(nodesRef.current);
  }, []);

  const cancelIntroCompaction = useCallback(() => {
    if (!introActiveRef.current) return;

    introCancelledRef.current = true;
    introActiveRef.current = false;
    cancelAnimationFrameRef(introFrameRef);
    clearNodePins(nodesRef.current);
  }, []);

  const nodeCanvasObjectMode = useCallback(() => "replace", []);
  const linkCanvasObjectMode = useCallback(() => "replace", []);

  const nodeCanvasObject = useCallback(
    (node: PhotoGraphNode, context: CanvasRenderingContext2D) => {
      const left = (node.x ?? 0) - node.w / 2;
      const top = (node.y ?? 0) - node.h / 2;
      node.__drawBounds = {
        left,
        top,
        width: node.w,
        height: node.h,
      };

      const image = imagesRef.current.get(node.id);
      if (image) {
        context.drawImage(image, left, top, node.w, node.h);
        return;
      }

      context.fillStyle = darkModeRef.current
        ? "rgba(255, 255, 255, 0.12)"
        : "#ffffff46";
      context.fillRect(left, top, node.w, node.h);
    },
    [],
  );

  const nodePointerAreaPaint = useCallback(
    (node: PhotoGraphNode, color: string, context: CanvasRenderingContext2D) => {
      const bounds = getNodeBounds(node);
      context.fillStyle = color;
      context.fillRect(bounds.left, bounds.top, bounds.width, bounds.height);
    },
    [],
  );

  const linkCanvasObject = useCallback(
    (link: PhotoGraphLink, context: CanvasRenderingContext2D) => {
      const source = typeof link.source === "object" ? link.source : null;
      const target = typeof link.target === "object" ? link.target : null;
      if (!source || !target) return;

      context.save();
      context.globalAlpha = getLinkValue(link);
      context.strokeStyle = darkModeRef.current
        ? "rgba(255, 255, 255, 0.72)"
        : "#000";
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(source.x ?? 0, source.y ?? 0);
      context.lineTo(target.x ?? 0, target.y ?? 0);
      context.stroke();
      context.restore();
    },
    [],
  );

  const linkPointerAreaPaint = useCallback(() => {}, []);

  const linkVisibility = useCallback(
    (link: PhotoGraphLink) =>
      !controlsRef.current.hideConnections && getLinkValue(link) > 0,
    [],
  );

  const showPointerCursor = useCallback(
    (obj: PhotoGraphNode | PhotoGraphLink | undefined) =>
      Boolean(obj && "sourceUrl" in obj),
    [],
  );

  const syncPendingRequestWidth = useCallback((node: PhotoGraphNode) => {
    const widths = pendingWidthsRef.current.get(node.id);
    node.requestedWidth =
      widths && widths.size ? Math.max(...widths) : undefined;
  }, []);

  const trackPendingWidth = useCallback(
    (node: PhotoGraphNode, width: number, pending: boolean) => {
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

  const refreshGraphAfterNodeMutation = useCallback(
    (resortNodes = false) => {
      if (resortNodes) {
        sortNodesForRender(nodesRef.current);
      }

      reinitializeCollisionForce();
      fgRef.current?.d3ReheatSimulation();
    },
    [reinitializeCollisionForce],
  );

  const applyLoadedImage = useCallback(
    (
      node: PhotoGraphNode,
      image: HTMLImageElement,
      loadedWidth: number,
      onlyIfMissing = false,
    ) => {
      if (onlyIfMissing) {
        if (imagesRef.current.has(node.id)) return;
      } else if (!shouldUpgradeWidth(node.loadedWidth, loadedWidth)) {
        return;
      }

      let resortNodes = false;
      if (!node.hasKnownAspectRatio) {
        sizeNodeFromImage(node, image);
        node.hasKnownAspectRatio = true;
        resortNodes = true;
      }

      node.loadedWidth = loadedWidth;
      imagesRef.current.set(node.id, image);
      refreshGraphAfterNodeMutation(resortNodes);
    },
    [refreshGraphAfterNodeMutation],
  );

  const logNodeImageError = useCallback((node: PhotoGraphNode, error: unknown) => {
    const errorKey = node.id;
    if (errorLogRef.current.has(errorKey)) return;

    errorLogRef.current.add(errorKey);
    console.error(`Failed to load image for node ${node.id}`, error);
  }, []);

  const getNodeTargetWidth = useCallback(
    (node: PhotoGraphNode) =>
      computeTargetImageWidth(
        node,
        transformRef.current.k,
        getCurrentDevicePixelRatio(),
      ),
    [],
  );

  const loadNodeImage = useCallback(
    async (node: PhotoGraphNode, targetWidth: number, signal: AbortSignal) => {
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
      nodes: PhotoGraphNode[],
      signal: AbortSignal,
      resolveWidth: (node: PhotoGraphNode) => number,
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
    [dimensions.height, dimensions.width],
  );

  const getInitialLoadQueue = useCallback((nodes: PhotoGraphNode[]) => {
    const graph = fgRef.current;
    if (!graph || !dimensions.width || !dimensions.height) {
      return nodes;
    }

    const center = graph.centerAt();
    const visibleNodes: { node: PhotoGraphNode; distance: number }[] = [];
    const remainingNodes: PhotoGraphNode[] = [];

    for (const node of nodes) {
      if (isNodeVisible(node)) {
        const deltaX = (node.x ?? 0) - center.x;
        const deltaY = (node.y ?? 0) - center.y;
        visibleNodes.push({
          node,
          distance: Math.hypot(deltaX, deltaY),
        });
        continue;
      }

      remainingNodes.push(node);
    }

    visibleNodes.sort((left, right) => left.distance - right.distance);

    return [
      ...visibleNodes.map(({ node }) => node),
      ...remainingNodes,
    ];
  }, [dimensions.height, dimensions.width, isNodeVisible]);

  const loadInitialImages = useCallback(
    (nodes: PhotoGraphNode[], signal: AbortSignal) =>
      runNodeQueue(getInitialLoadQueue(nodes), signal, getNodeTargetWidth),
    [getInitialLoadQueue, getNodeTargetWidth, runNodeQueue],
  );

  const upgradeVisibleImages = useCallback(
    async (signal: AbortSignal) => {
      const visibleNodes = nodesRef.current.filter(isNodeVisible);
      await runNodeQueue(visibleNodes, signal, getNodeTargetWidth);
    },
    [getNodeTargetWidth, isNodeVisible, runNodeQueue],
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

  const runIntroCompaction = useCallback(
    (layout: IntroLayout, signal: AbortSignal) => {
      introCancelledRef.current = false;
      introActiveRef.current = true;
      applyNodePositions(nodesRef.current, layout.expanded);

      const finish = () => {
        cancelAnimationFrameRef(introFrameRef);
        clearNodePins(nodesRef.current);
        introActiveRef.current = false;
      };

      const step = (now: number, startedAt = now) => {
        if (signal.aborted || introCancelledRef.current) {
          finish();
          return;
        }

        const progress = clamp(
          (now - startedAt) / GRAPH_CONFIG.initialCompactionDurationMs,
          0,
          1,
        );
        const easedProgress = easeOutExponential(progress);

        nodesRef.current.forEach((node) => {
          const fromPosition = layout.expanded[node.id];
          const toPosition = layout.compacted[node.id];
          if (!fromPosition || !toPosition) return;

          node.x =
            fromPosition.x + (toPosition.x - fromPosition.x) * easedProgress;
          node.y =
            fromPosition.y + (toPosition.y - fromPosition.y) * easedProgress;
          node.vx = 0;
          node.vy = 0;
          node.fx = node.x;
          node.fy = node.y;
        });

        if (progress < 1) {
          introFrameRef.current = window.requestAnimationFrame((nextNow) =>
            step(nextNow, startedAt),
          );
          return;
        }

        finish();
      };

      introFrameRef.current = window.requestAnimationFrame((now) => step(now));
    },
    [],
  );

  const handleNodeDrag = useCallback(() => {
    cancelIntroCompaction();
    engineRunningRef.current = true;
    setEngineStatus("settling");
  }, [cancelIntroCompaction]);

  const handleZoom = useCallback(
    (transform: GraphTransform) => {
      transformRef.current = transform;

      if (introActiveRef.current && !applyingInitialViewRef.current) {
        cancelIntroCompaction();
      }

      const abortController = initAbortRef.current;
      if (abortController) {
        scheduleUpgradePass(abortController.signal);
      }
    },
    [cancelIntroCompaction, scheduleUpgradePass],
  );

  const handleZoomEnd = useCallback(
    (transform: GraphTransform) => {
      transformRef.current = transform;

      const abortController = initAbortRef.current;
      if (abortController) {
        scheduleUpgradePass(abortController.signal, 0);
      }
    },
    [scheduleUpgradePass],
  );

  const handleEngineTick = useCallback(() => {
    if (engineRunningRef.current) return;

    engineRunningRef.current = true;
    setEngineStatus("settling");
  }, []);

  const handleEngineStop = useCallback(() => {
    if (!engineRunningRef.current) return;

    engineRunningRef.current = false;
    setEngineStatus("settled");
  }, []);

  useEffect(() => {
    darkModeRef.current = activeDarkMode;

    if (nodesRef.current.length) {
      fgRef.current?.d3ReheatSimulation();
    }
  }, [activeDarkMode]);

  useEffect(() => {
    controlsRef.current = controls;
  }, [controls]);

  useEffect(() => {
    if (!nodesRef.current.length) return;

    configureRuntimeForces();
    fgRef.current?.d3ReheatSimulation();
  }, [
    controls.chargeMult,
    controls.distMinMult,
    controls.distMaxMult,
    controls.hideConnections,
    configureRuntimeForces,
  ]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;

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

  useEffect(() => {
    let disposed = false;
    const abortController = new AbortController();
    initAbortRef.current = abortController;
    introLayoutRef.current = null;
    introCancelledRef.current = false;
    introActiveRef.current = false;
    initialViewAppliedRef.current = false;
    applyingInitialViewRef.current = false;
    cancelAnimationFrameRef(introFrameRef);
    clearTimeoutRef(upgradeTimeoutRef);
    clearNodePins(nodesRef.current);

    imagesRef.current = new Map();
    pendingWidthsRef.current = new Map();
    errorLogRef.current = new Set();
    nodesRef.current = [];
    engineRunningRef.current = false;
    setEngineStatus("settled");
    setGraphData({ nodes: [], links: [] });

    const graph = fgRef.current;
    if (graph) {
      configureRuntimeForces();
    }

    const initializeGraph = async () => {
      const response = await fetch(graphUrl, {
        cache: "no-store",
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch graph data: ${graphUrl}`);
      }

      const data = (await response.json()) as RawNode[];
      if (disposed || abortController.signal.aborted) return;

      const { nodes, links } = await buildGraph(data, imageBasePath);
      if (disposed || abortController.signal.aborted) return;

      const prelayoutSimulation = createPrelayoutSimulation(
        nodes,
        links,
        INITIAL_LAYOUT_CONTROLS,
      );
      warmupSimulationLayout(
        prelayoutSimulation,
        getInitialLayoutTickCount(nodes.length),
      );
      const expanded = captureNodePositions(nodes);
      applySimulationForces(prelayoutSimulation, controlsRef.current);
      warmupSimulationLayout(
        prelayoutSimulation,
        getInitialCompactionTickCount(nodes.length),
        GRAPH_CONFIG.initialCompactionAlpha,
      );
      const compacted = captureNodePositions(nodes);
      applyNodePositions(nodes, expanded);
      clearNodePins(nodes);
      sortNodesForRender(nodes);

      introLayoutRef.current = { expanded, compacted };
      nodesRef.current = nodes;
      setGraphData({ nodes, links });
    };

    void initializeGraph().catch((error: unknown) => {
      if (!isAbortError(error)) {
        console.error(error);
      }
    });

    return () => {
      disposed = true;
      abortController.abort();
      if (initAbortRef.current === abortController) {
        initAbortRef.current = null;
      }
      cancelAnimationFrameRef(introFrameRef);
      clearTimeoutRef(upgradeTimeoutRef);
      clearNodePins(nodesRef.current);
      introActiveRef.current = false;
      introCancelledRef.current = true;
    };
  }, [configureRuntimeForces, graphUrl, imageBasePath]);

  useEffect(() => {
    if (!graphData.nodes.length || !dimensions.width || !dimensions.height) {
      return;
    }

    const graph = fgRef.current;
    const abortController = initAbortRef.current;
    const introLayout = introLayoutRef.current;
    if (!graph || !abortController || !introLayout) {
      return;
    }

    configureRuntimeForces();
    reinitializeCollisionForce();

    if (initialViewAppliedRef.current) {
      return;
    }

    initialViewAppliedRef.current = true;
    applyingInitialViewRef.current = true;
    graph.centerAt(0, 0, 0);
    graph.zoom(GRAPH_CONFIG.initialZoom, 0);

    window.requestAnimationFrame(() => {
      applyingInitialViewRef.current = false;
      if (abortController.signal.aborted) return;

      void loadInitialImages(nodesRef.current, abortController.signal);
      scheduleUpgradePass(abortController.signal, 0);
      runIntroCompaction(introLayout, abortController.signal);
    });
  }, [
    configureRuntimeForces,
    dimensions.height,
    dimensions.width,
    graphData.nodes.length,
    loadInitialImages,
    reinitializeCollisionForce,
    runIntroCompaction,
    scheduleUpgradePass,
  ]);

  useEffect(() => {
    if (!inspectTarget) {
      setInspectOverlayOpen(false);
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

  useEffect(() => {
    if (!inspectTarget) return;

    const frame = window.requestAnimationFrame(() => {
      setInspectOverlayOpen(true);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [inspectTarget]);

  useEffect(() => {
    if (!inspectTarget || inspectOverlayOpen) return;

    const timeout = window.setTimeout(() => {
      setInspectTarget((current) => (current === inspectTarget ? null : current));
    }, INSPECT_OVERLAY_TRANSITION_MS);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [inspectOverlayOpen, inspectTarget]);

  const engineStatusClass =
    engineStatus === "settled"
      ? "text-emerald-700 dark:text-emerald-300"
      : "text-red-700 dark:text-red-300";

  return (
    <div className={`static h-full w-full transition-colors ${photoGraphShellClass}`}>
      <div
        className={`h-full w-full transition-[opacity,filter] duration-200 ${
          inspectTarget ? "pointer-events-none opacity-35 blur-[1px]" : "opacity-100"
        }`}
      >
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
                <p className={`mx-2 ${overlayTextClass}`}>Simulation Status</p>
                <p className={`${overlayTextClass} ${engineStatusClass}`}>
                  {engineStatus === "settled" ? "Settled" : "Settling"}
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

        <div
          ref={containerRef}
          className="relative h-full w-full bg-white [image-rendering:pixelated] dark:bg-black [&_canvas]:[image-rendering:pixelated]"
        >
          {dimensions.width > 0 && dimensions.height > 0 && (
            <ForceGraph2D
              ref={fgRef}
              graphData={graphData}
              width={dimensions.width}
              height={dimensions.height}
              minZoom={GRAPH_CONFIG.zoomExtent[0]}
              maxZoom={GRAPH_CONFIG.zoomExtent[1]}
              d3AlphaMin={GRAPH_CONFIG.alphaMin}
              cooldownTime={Number.POSITIVE_INFINITY}
              cooldownTicks={Number.POSITIVE_INFINITY}
              nodeCanvasObjectMode={nodeCanvasObjectMode}
              nodeCanvasObject={nodeCanvasObject}
              nodePointerAreaPaint={nodePointerAreaPaint}
              linkCanvasObjectMode={linkCanvasObjectMode}
              linkCanvasObject={linkCanvasObject}
              linkPointerAreaPaint={linkPointerAreaPaint}
              linkVisibility={linkVisibility}
              showPointerCursor={showPointerCursor}
              onNodeClick={(node: PhotoGraphNode) =>
                openInspectTarget({ id: node.id, url: node.sourceUrl })
              }
              onNodeDrag={handleNodeDrag}
              onNodeDragEnd={handleNodeDrag}
              onZoom={handleZoom}
              onZoomEnd={handleZoomEnd}
              onEngineTick={handleEngineTick}
              onEngineStop={handleEngineStop}
              enableNodeDrag
            />
          )}
        </div>
      </div>

      {inspectTarget && (
        <div
          onClick={closeInspectTarget}
          className={`absolute inset-0 z-10 m-auto flex max-h-9/12 max-w-9/12 items-center justify-center transition-[opacity,backdrop-filter] duration-200 ${photoGraphModalClass} ${
            inspectOverlayOpen ? "opacity-100 backdrop-blur-sm" : "backdrop-blur-0 opacity-0"
          }`}
          // TODO: add colour swatches to inspect view
        >
          <div
            className={`relative flex h-full w-full flex-col items-center justify-center transition-[opacity,transform,filter] duration-200 ease-out ${
              inspectOverlayOpen
                ? "blur-0 scale-100 opacity-100"
                : "scale-[1.06] opacity-0 blur-[2px]"
            }`}
            onClick={(event) => event.stopPropagation()}
          >
            <OverlayControlButton
              onClick={closeInspectTarget}
              className="absolute top-0 right-0 mx-2 my-2"
              aria-label="Close image inspection"
            >
              <X className="h-4 w-4" />
            </OverlayControlButton>

            {/* eslint-disable-next-line @next/next/no-img-element -- This inspect overlay needs the raw image element for natural-size reads and unrestricted sizing. */}
            <img
              src={inspectTarget.url}
              alt=""
              className={`my-auto max-h-9/12 max-w-5/6 place-self-center align-middle transition-transform duration-200 ease-out ${
                inspectOverlayOpen ? "scale-100" : "scale-[1.1]"
              }`}
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
              className={`absolute bottom-0 flex h-1/8 w-full items-center justify-between gap-4 px-4 text-[9px] transition-opacity duration-200 sm:text-xs ${overlayTextClass} ${
                inspectOverlayOpen ? "opacity-100" : "opacity-0"
              }`}
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
    </div>
  );
}
