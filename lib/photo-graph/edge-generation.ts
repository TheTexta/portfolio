import type {
  GraphFeature,
  GraphNode,
  LabEdgeGenerationParams,
  PhotoGraphEdgeGenerationConfig,
} from "@/lib/photo-graph/types";
import { clamp01 } from "@/lib/photo-graph/feature-extraction";
import { ensureProcessingFeatures } from "@/lib/photo-graph/graph-store";

export const DEFAULT_LAB_EDGE_GENERATION_PARAMS: LabEdgeGenerationParams = {
  sigmaE: 15,
  minCorrelation: 0.3,
};

export const DEFAULT_PHOTO_GRAPH_EDGE_GENERATION_CONFIG: PhotoGraphEdgeGenerationConfig =
  {
    mode: "lab",
    params: DEFAULT_LAB_EDGE_GENERATION_PARAMS,
  };

export const LAB_EDGE_PARAM_LIMITS = {
  sigmaE: {
    min: 1,
    max: 80,
  },
  minCorrelation: {
    min: 0,
    max: 1,
  },
} as const;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function gauss(value: number, sigma: number) {
  return Math.exp(-((value * value) / (sigma * sigma)));
}

function parseFiniteNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return Number.NaN;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function compareNodeIds(leftId: string, rightId: string) {
  const leftNumber = Number(leftId);
  const rightNumber = Number(rightId);

  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
    return leftNumber - rightNumber;
  }

  return leftId.localeCompare(rightId);
}

export function deltaE76(
  leftLab: [number, number, number],
  rightLab: [number, number, number],
) {
  const dl = leftLab[0] - rightLab[0];
  const da = leftLab[1] - rightLab[1];
  const db = leftLab[2] - rightLab[2];

  return Math.sqrt(dl * dl + da * da + db * db);
}

export function computeLabCorrelation(
  left: GraphFeature,
  right: GraphFeature,
  params: LabEdgeGenerationParams = DEFAULT_LAB_EDGE_GENERATION_PARAMS,
) {
  const sigmaE = clamp(
    params.sigmaE,
    LAB_EDGE_PARAM_LIMITS.sigmaE.min,
    LAB_EDGE_PARAM_LIMITS.sigmaE.max,
  );

  return clamp01(gauss(deltaE76(left.lab, right.lab), sigmaE));
}

export function shouldKeepLabEdge(
  correlation: number,
  params: LabEdgeGenerationParams = DEFAULT_LAB_EDGE_GENERATION_PARAMS,
) {
  return correlation >= params.minCorrelation;
}

export function normalizeLabEdgeGenerationParams(
  value: unknown,
): LabEdgeGenerationParams {
  const record = isRecord(value) ? value : {};
  const sigmaE = parseFiniteNumber(record.sigmaE);
  const minCorrelation = parseFiniteNumber(record.minCorrelation);

  return {
    sigmaE: Number.isFinite(sigmaE)
      ? clamp(
          sigmaE,
          LAB_EDGE_PARAM_LIMITS.sigmaE.min,
          LAB_EDGE_PARAM_LIMITS.sigmaE.max,
        )
      : DEFAULT_LAB_EDGE_GENERATION_PARAMS.sigmaE,
    minCorrelation: Number.isFinite(minCorrelation)
      ? clamp(
          minCorrelation,
          LAB_EDGE_PARAM_LIMITS.minCorrelation.min,
          LAB_EDGE_PARAM_LIMITS.minCorrelation.max,
        )
      : DEFAULT_LAB_EDGE_GENERATION_PARAMS.minCorrelation,
  };
}

export function normalizePhotoGraphEdgeGenerationConfig(
  value: unknown,
): PhotoGraphEdgeGenerationConfig {
  if (!isRecord(value) || value.mode !== "lab") {
    return DEFAULT_PHOTO_GRAPH_EDGE_GENERATION_CONFIG;
  }

  return {
    mode: "lab",
    params: normalizeLabEdgeGenerationParams(value.params),
  };
}

export function parseLabEdgeGenerationParams(
  value: unknown,
): LabEdgeGenerationParams | null {
  if (!isRecord(value)) {
    return null;
  }

  const sigmaE = parseFiniteNumber(value.sigmaE);
  const minCorrelation = parseFiniteNumber(value.minCorrelation);

  if (
    !Number.isFinite(sigmaE) ||
    !Number.isFinite(minCorrelation) ||
    sigmaE < LAB_EDGE_PARAM_LIMITS.sigmaE.min ||
    sigmaE > LAB_EDGE_PARAM_LIMITS.sigmaE.max ||
    minCorrelation < LAB_EDGE_PARAM_LIMITS.minCorrelation.min ||
    minCorrelation > LAB_EDGE_PARAM_LIMITS.minCorrelation.max
  ) {
    return null;
  }

  return {
    sigmaE,
    minCorrelation,
  };
}

export function parseLabEdgeGenerationParamsFromSearchParams(
  searchParams: URLSearchParams,
) {
  const sigmaERaw = searchParams.get("sigmaE");
  const minCorrelationRaw = searchParams.get("minCorrelation");

  if (sigmaERaw === null && minCorrelationRaw === null) {
    return null;
  }

  return parseLabEdgeGenerationParams({
    sigmaE: sigmaERaw,
    minCorrelation: minCorrelationRaw,
  });
}

export function regenerateLabGraphCorrelations(
  nodes: GraphNode[],
  params: LabEdgeGenerationParams = DEFAULT_LAB_EDGE_GENERATION_PARAMS,
) {
  ensureProcessingFeatures(nodes);

  for (const node of nodes) {
    node.correlations = {};
  }

  for (let index = 0; index < nodes.length; index += 1) {
    const left = nodes[index];
    if (!left.feature) {
      continue;
    }

    for (let offset = index + 1; offset < nodes.length; offset += 1) {
      const right = nodes[offset];
      if (!right.feature) {
        continue;
      }

      const correlation = computeLabCorrelation(
        left.feature,
        right.feature,
        params,
      );
      if (!shouldKeepLabEdge(correlation, params)) {
        continue;
      }

      left.correlations[right.id] = correlation;
      right.correlations[left.id] = correlation;
    }
  }

  return nodes;
}

export function countGraphEdges(
  nodes: Pick<GraphNode, "id" | "correlations">[],
) {
  let count = 0;

  for (const node of nodes) {
    for (const [targetId, correlation] of Object.entries(node.correlations ?? {})) {
      if (
        !Number.isFinite(correlation) ||
        correlation <= 0 ||
        compareNodeIds(node.id, targetId) >= 0
      ) {
        continue;
      }

      count += 1;
    }
  }

  return count;
}
