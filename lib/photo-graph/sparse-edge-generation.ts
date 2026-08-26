import { clamp01 } from "@/lib/photo-graph/feature-extraction";
import { computePhotoGraphModelDistance } from "@/lib/photo-graph/similarity-models";
import { PHOTO_GRAPH_SIMILARITY_MODELS } from "@/lib/photo-graph/similarity-models";
import type {
  GraphNode,
  PhotoGraphNeighborRow,
  PhotoGraphSparseEdgeGenerationConfig,
} from "@/lib/photo-graph/types";

export const CIEDE2000_EDGE_GENERATION_CONFIG: PhotoGraphSparseEdgeGenerationConfig = {
  version: 2,
  model: "mean-lab-ciede2000",
  neighborsPerNode: 4,
  maxDistance: 16,
};

export const DEFAULT_SPARSE_EDGE_GENERATION_CONFIG =
  CIEDE2000_EDGE_GENERATION_CONFIG;

export const SPARSE_EDGE_GENERATION_LIMITS = {
  neighborsPerNode: { min: 1, max: 100 },
  maxDistance: { min: 0.001, max: 100 },
} as const;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function finiteNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  }
  return Number.NaN;
}

function isModel(value: unknown): value is PhotoGraphSparseEdgeGenerationConfig["model"] {
  return PHOTO_GRAPH_SIMILARITY_MODELS.some((model) => model.id === value);
}

export function normalizeSparseEdgeGenerationConfig(
  value: unknown,
): PhotoGraphSparseEdgeGenerationConfig {
  if (isRecord(value) && value.version === 2 && isModel(value.model)) {
    const neighborsPerNode = finiteNumber(value.neighborsPerNode);
    const maxDistance = finiteNumber(value.maxDistance);
    const model = PHOTO_GRAPH_SIMILARITY_MODELS.find(
      (entry) => entry.id === value.model,
    );

    return {
      version: 2,
      model: value.model,
      neighborsPerNode: Number.isFinite(neighborsPerNode)
        ? Math.round(
            clamp(
              neighborsPerNode,
              SPARSE_EDGE_GENERATION_LIMITS.neighborsPerNode.min,
              SPARSE_EDGE_GENERATION_LIMITS.neighborsPerNode.max,
            ),
          )
        : DEFAULT_SPARSE_EDGE_GENERATION_CONFIG.neighborsPerNode,
      maxDistance: Number.isFinite(maxDistance)
        ? clamp(
            maxDistance,
            SPARSE_EDGE_GENERATION_LIMITS.maxDistance.min,
            model?.maxDistanceLimit ?? SPARSE_EDGE_GENERATION_LIMITS.maxDistance.max,
          )
        : model?.defaultMaxDistance ?? DEFAULT_SPARSE_EDGE_GENERATION_CONFIG.maxDistance,
    };
  }

  if (isRecord(value) && value.mode === "lab" && isRecord(value.params)) {
    const sigmaE = finiteNumber(value.params.sigmaE);
    const minCorrelation = finiteNumber(value.params.minCorrelation);
    if (sigmaE > 0 && minCorrelation > 0 && minCorrelation <= 1) {
      return {
        version: 2,
        model: "mean-lab-cie76",
        neighborsPerNode: SPARSE_EDGE_GENERATION_LIMITS.neighborsPerNode.max,
        maxDistance: clamp(
          sigmaE * Math.sqrt(-Math.log(minCorrelation)),
          SPARSE_EDGE_GENERATION_LIMITS.maxDistance.min,
          100,
        ),
      };
    }
  }

  return DEFAULT_SPARSE_EDGE_GENERATION_CONFIG;
}

export function parseSparseEdgeGenerationConfig(
  value: unknown,
): PhotoGraphSparseEdgeGenerationConfig | null {
  if (!isRecord(value) || value.version !== 2 || !isModel(value.model)) {
    return null;
  }
  const neighborsPerNode = finiteNumber(value.neighborsPerNode);
  const maxDistance = finiteNumber(value.maxDistance);
  const model = PHOTO_GRAPH_SIMILARITY_MODELS.find(
    (entry) => entry.id === value.model,
  );
  if (
    !Number.isInteger(neighborsPerNode) ||
    neighborsPerNode < SPARSE_EDGE_GENERATION_LIMITS.neighborsPerNode.min ||
    neighborsPerNode > SPARSE_EDGE_GENERATION_LIMITS.neighborsPerNode.max ||
    !Number.isFinite(maxDistance) ||
    maxDistance < SPARSE_EDGE_GENERATION_LIMITS.maxDistance.min ||
    maxDistance > (model?.maxDistanceLimit ?? SPARSE_EDGE_GENERATION_LIMITS.maxDistance.max)
  ) {
    return null;
  }
  return {
    version: 2,
    model: value.model,
    neighborsPerNode,
    maxDistance,
  };
}

export function parseSparseEdgeGenerationConfigFromSearchParams(
  searchParams: URLSearchParams,
) {
  const model = searchParams.get("model");
  const neighborsPerNode = searchParams.get("neighborsPerNode");
  const maxDistance = searchParams.get("maxDistance");
  if (model === null && neighborsPerNode === null && maxDistance === null) {
    return null;
  }
  return parseSparseEdgeGenerationConfig({
    version: 2,
    model,
    neighborsPerNode,
    maxDistance,
  });
}

export type RankedPhotoGraphNeighbor = Omit<
  PhotoGraphNeighborRow,
  "source_node_id" | "target_node_id" | "updated_at"
> & {
  sourceId: string;
  targetId: string;
};

type Candidate = {
  targetId: string;
  distance: number;
};

function compareNodeIds(leftId: string, rightId: string) {
  const leftNumber = Number(leftId);
  const rightNumber = Number(rightId);
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
    return leftNumber - rightNumber;
  }
  return leftId.localeCompare(rightId);
}

function correlationFromDistance(distance: number, maxDistance: number) {
  return clamp01(1 - distance / maxDistance);
}

function rankCandidates(
  sourceId: string,
  candidates: Candidate[],
  config: PhotoGraphSparseEdgeGenerationConfig,
) {
  const candidateByTarget = new Map<string, Candidate>();

  for (const candidate of candidates) {
    if (
      candidate.targetId === sourceId ||
      !Number.isFinite(candidate.distance) ||
      candidate.distance > config.maxDistance
    ) {
      continue;
    }
    const existing = candidateByTarget.get(candidate.targetId);
    if (!existing || candidate.distance < existing.distance) {
      candidateByTarget.set(candidate.targetId, candidate);
    }
  }

  return [...candidateByTarget.values()]
    .sort(
      (left, right) =>
        left.distance - right.distance ||
        compareNodeIds(left.targetId, right.targetId),
    )
    .slice(0, config.neighborsPerNode)
    .map(
      (candidate, index): RankedPhotoGraphNeighbor => ({
        sourceId,
        targetId: candidate.targetId,
        model: config.model,
        feature_version: 1,
        distance: candidate.distance,
        correlation: correlationFromDistance(
          candidate.distance,
          config.maxDistance,
        ),
        rank: index + 1,
      }),
    );
}

export function applyRankedNeighborsToGraph(
  nodes: GraphNode[],
  neighbors: RankedPhotoGraphNeighbor[],
) {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  for (const node of nodes) {
    node.correlations = {};
  }

  for (const neighbor of neighbors) {
    const source = nodeById.get(neighbor.sourceId);
    const target = nodeById.get(neighbor.targetId);
    if (!source || !target || neighbor.correlation <= 0) {
      continue;
    }
    source.correlations[target.id] = Math.max(
      source.correlations[target.id] ?? 0,
      neighbor.correlation,
    );
    target.correlations[source.id] = Math.max(
      target.correlations[source.id] ?? 0,
      neighbor.correlation,
    );
  }

  return nodes;
}

export function generateSparsePhotoGraph(
  nodes: GraphNode[],
  config: PhotoGraphSparseEdgeGenerationConfig = DEFAULT_SPARSE_EDGE_GENERATION_CONFIG,
) {
  const candidatesBySource = new Map<string, Candidate[]>(
    nodes.map((node) => [node.id, []]),
  );

  for (let leftIndex = 0; leftIndex < nodes.length; leftIndex += 1) {
    const left = nodes[leftIndex];
    if (!left.feature) {
      continue;
    }
    for (let rightIndex = leftIndex + 1; rightIndex < nodes.length; rightIndex += 1) {
      const right = nodes[rightIndex];
      if (!right.feature) {
        continue;
      }
      const distance = computePhotoGraphModelDistance(
        left.feature,
        right.feature,
        config.model,
      );
      candidatesBySource.get(left.id)?.push({ targetId: right.id, distance });
      candidatesBySource.get(right.id)?.push({ targetId: left.id, distance });
    }
  }

  const neighbors = nodes.flatMap((node) =>
    rankCandidates(node.id, candidatesBySource.get(node.id) ?? [], config),
  );

  return {
    nodes: applyRankedNeighborsToGraph(nodes, neighbors),
    neighbors,
  };
}

export function updateSparsePhotoGraphForAddedNodes(
  existingNodes: GraphNode[],
  addedNodes: GraphNode[],
  existingNeighbors: RankedPhotoGraphNeighbor[],
  config: PhotoGraphSparseEdgeGenerationConfig,
) {
  const allNodes = [...existingNodes, ...addedNodes];
  const currentBySource = new Map<string, Candidate[]>();
  for (const neighbor of existingNeighbors) {
    if (neighbor.model !== config.model) {
      continue;
    }
    const current = currentBySource.get(neighbor.sourceId) ?? [];
    current.push({ targetId: neighbor.targetId, distance: neighbor.distance });
    currentBySource.set(neighbor.sourceId, current);
  }

  for (const source of existingNodes) {
    if (!source.feature) {
      continue;
    }
    const candidates = currentBySource.get(source.id) ?? [];
    for (const added of addedNodes) {
      if (!added.feature) {
        continue;
      }
      candidates.push({
        targetId: added.id,
        distance: computePhotoGraphModelDistance(
          source.feature,
          added.feature,
          config.model,
        ),
      });
    }
    currentBySource.set(source.id, candidates);
  }

  for (const source of addedNodes) {
    if (!source.feature) {
      continue;
    }
    const candidates: Candidate[] = [];
    for (const target of allNodes) {
      if (source.id === target.id || !target.feature) {
        continue;
      }
      candidates.push({
        targetId: target.id,
        distance: computePhotoGraphModelDistance(
          source.feature,
          target.feature,
          config.model,
        ),
      });
    }
    currentBySource.set(source.id, candidates);
  }

  const updatedNeighbors = allNodes.flatMap((node) =>
    rankCandidates(node.id, currentBySource.get(node.id) ?? [], config),
  );

  return {
    nodes: applyRankedNeighborsToGraph(allNodes, updatedNeighbors),
    neighbors: updatedNeighbors,
  };
}