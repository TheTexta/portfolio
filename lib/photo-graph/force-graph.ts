import type {
  GraphImageDimensions,
  GraphNode,
  PhotoGraphPayload,
  PhotoGraphPayloadLink,
  PhotoGraphPayloadNode,
} from "@/lib/photo-graph/types";

const PHOTO_GRAPH_NODE_CONFIG = {
  baseBox: 220,
  minBox: 64,
  maxBox: 300,
  balanceStartDeviationLog2: 0.3,
  balanceMaxDeviationLog2: 1.5,
  maxAreaBoost: 1.55,
  maxLongSideMultiplier: 2,
  linkStrengthMin: 0.0001,
  linkStrengthMax: 0.04,
  linkNodeSizeDistanceFactor: 0.72,
  layerAreaBlurStrength: 0.14,
} as const;

type SizedNode = {
  aspectRatio: number;
  baseSize: number;
  w: number;
  h: number;
  renderArea: number;
};

type LayeredNode = SizedNode & {
  id: string;
  layerNoise: number;
};

type LinkedNode = {
  w: number;
  h: number;
};

type LinkedEdge<TNode extends LinkedNode> = {
  source: string | TNode;
  target: string | TNode;
  value: number;
  baseValue?: number;
};

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function normalizePhotoGraphAspectRatio(aspectRatio: number | undefined) {
  if (!Number.isFinite(aspectRatio) || !aspectRatio || aspectRatio <= 0) {
    return 1;
  }

  return aspectRatio;
}

export function resolvePhotoGraphAspectRatio(
  dimensions: GraphImageDimensions | undefined,
) {
  if (!dimensions) {
    return 1;
  }

  const derivedAspect = dimensions.width / dimensions.height;
  return normalizePhotoGraphAspectRatio(
    Number.isFinite(dimensions.aspectRatio) && dimensions.aspectRatio > 0
      ? dimensions.aspectRatio
      : derivedAspect,
  );
}

export function computePhotoGraphNodeLayerNoise(id: string) {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  }

  if (hash === 0) {
    return 0;
  }

  return (hash / 0xffffffff) * 2 - 1;
}

export function sizePhotoGraphNode<T extends SizedNode>(node: T) {
  const aspectRatio = normalizePhotoGraphAspectRatio(node.aspectRatio);
  const baseSize = Math.max(1, node.baseSize);
  const deviation = Math.abs(Math.log2(aspectRatio));
  const progress = clamp(
    (deviation - PHOTO_GRAPH_NODE_CONFIG.balanceStartDeviationLog2) /
      (PHOTO_GRAPH_NODE_CONFIG.balanceMaxDeviationLog2 -
        PHOTO_GRAPH_NODE_CONFIG.balanceStartDeviationLog2),
    0,
    1,
  );
  const areaBoost =
    1 + progress * (PHOTO_GRAPH_NODE_CONFIG.maxAreaBoost - 1);
  const targetArea = baseSize * baseSize * areaBoost;

  let width = Math.sqrt(targetArea * aspectRatio);
  let height = Math.sqrt(targetArea / aspectRatio);

  const longSideLimit =
    baseSize * PHOTO_GRAPH_NODE_CONFIG.maxLongSideMultiplier;
  const longSide = Math.max(width, height);
  if (longSide > longSideLimit) {
    const shrink = longSideLimit / longSide;
    width *= shrink;
    height *= shrink;
  }

  node.w = width;
  node.h = height;
  node.renderArea = Math.max(1, width * height);

  return node;
}

function resolvePayloadSourceUrl(node: GraphNode) {
  if (node.url) {
    return node.url;
  }

  throw new Error(`Missing source URL for photo graph node ${node.id}.`);
}

export function getPhotoGraphNodeRenderArea(node: SizedNode) {
  if (Number.isFinite(node.renderArea) && node.renderArea > 0) {
    return node.renderArea;
  }

  return Math.max(1, node.w * node.h);
}

export function getPhotoGraphNodeLayerArea(node: LayeredNode) {
  const baseArea = getPhotoGraphNodeRenderArea(node);
  const blurScale =
    1 +
    clamp(node.layerNoise, -1, 1) *
      PHOTO_GRAPH_NODE_CONFIG.layerAreaBlurStrength;
  return Math.max(1, baseArea * blurScale);
}

export function sortPhotoGraphNodesForRender<T extends LayeredNode>(nodes: T[]) {
  nodes.sort((left, right) => {
    const areaDelta =
      getPhotoGraphNodeLayerArea(right) - getPhotoGraphNodeLayerArea(left);
    if (Math.abs(areaDelta) > 1e-6) {
      return areaDelta;
    }

    return left.id.localeCompare(right.id);
  });

  return nodes;
}

export function getPhotoGraphLinkValue(link: {
  baseValue?: number;
  value: number;
}) {
  return clamp(link.baseValue ?? link.value ?? 0, 0, 1);
}

function resolvePhotoGraphLinkNodes<TNode extends LinkedNode>(
  link: LinkedEdge<TNode>,
) {
  const source = typeof link.source === "object" ? link.source : null;
  const target = typeof link.target === "object" ? link.target : null;

  return { source, target };
}

export function computePhotoGraphLinkDistance<TNode extends LinkedNode>(
  link: LinkedEdge<TNode>,
  minDistance: number,
  maxDistance: number,
) {
  const value = getPhotoGraphLinkValue(link);
  const desiredDistance =
    minDistance + (1 - value) * (maxDistance - minDistance);
  const { source, target } = resolvePhotoGraphLinkNodes(link);

  if (!source || !target) {
    return desiredDistance;
  }

  const minAxisDistance = Math.max(
    ((source.w + target.w) / 2) *
      PHOTO_GRAPH_NODE_CONFIG.linkNodeSizeDistanceFactor,
    ((source.h + target.h) / 2) *
      PHOTO_GRAPH_NODE_CONFIG.linkNodeSizeDistanceFactor,
  );

  return Math.max(desiredDistance, minAxisDistance);
}

export function computePhotoGraphLinkStrength(
  link: {
    baseValue?: number;
    value: number;
  },
) {
  const value = getPhotoGraphLinkValue(link);

  return (
    PHOTO_GRAPH_NODE_CONFIG.linkStrengthMin +
    value *
      (PHOTO_GRAPH_NODE_CONFIG.linkStrengthMax -
        PHOTO_GRAPH_NODE_CONFIG.linkStrengthMin)
  );
}

export function buildPhotoGraphPayload(nodes: GraphNode[]): PhotoGraphPayload {
  const payloadNodes: PhotoGraphPayloadNode[] = nodes.map((node) => {
    const baseSize = clamp(
      Math.round((node.scale ?? 0.5) * PHOTO_GRAPH_NODE_CONFIG.baseBox),
      PHOTO_GRAPH_NODE_CONFIG.minBox,
      PHOTO_GRAPH_NODE_CONFIG.maxBox,
    );
    const payloadNode: PhotoGraphPayloadNode = {
      id: node.id,
      sourceUrl: resolvePayloadSourceUrl(node),
      storagePath: node.storagePath,
      baseSize,
      aspectRatio: resolvePhotoGraphAspectRatio(node.dimensions),
      hasKnownAspectRatio: Boolean(node.dimensions),
      layerNoise: computePhotoGraphNodeLayerNoise(node.id),
      w: baseSize,
      h: baseSize,
      renderArea: baseSize * baseSize,
    };

    return sizePhotoGraphNode(payloadNode);
  });

  const nodeIds = new Set(payloadNodes.map((node) => node.id));
  const payloadLinks: PhotoGraphPayloadLink[] = [];

  for (const node of nodes) {
    const sourceId = node.id;

    for (const [targetId, rawValue] of Object.entries(node.correlations ?? {})) {
      if (sourceId === targetId) continue;
      if (!nodeIds.has(sourceId) || !nodeIds.has(targetId)) continue;

      const value = clamp(Number(rawValue) || 0, 0, 1);
      if (!value || sourceId >= targetId) continue;

      payloadLinks.push({
        source: sourceId,
        target: targetId,
        value,
        baseValue: value,
      });
    }
  }

  sortPhotoGraphNodesForRender(payloadNodes);

  return {
    nodes: payloadNodes,
    links: payloadLinks,
  };
}
