import { oklabDistance, rgbToOklab } from "@/lib/photo-graph/color-features";
import type {
  GraphFeature,
  PhotoGraphPaletteEntry,
  PhotoGraphSimilarityModelId,
} from "@/lib/photo-graph/types";

export const PHOTO_GRAPH_SIMILARITY_MODELS: ReadonlyArray<{
  id: PhotoGraphSimilarityModelId;
  label: string;
  defaultMaxDistance: number;
  maxDistanceLimit: number;
  requiresColorV1: boolean;
}> = [
  {
    id: "mean-lab-cie76",
    label: "Mean LAB / CIE76",
    defaultMaxDistance: 19,
    maxDistanceLimit: 100,
    requiresColorV1: false,
  },
  {
    id: "mean-lab-ciede2000",
    label: "Mean LAB / CIEDE2000",
    defaultMaxDistance: 16,
    maxDistanceLimit: 100,
    requiresColorV1: false,
  },
  {
    id: "mean-oklab",
    label: "Mean Oklab",
    defaultMaxDistance: 0.12,
    maxDistanceLimit: 1,
    requiresColorV1: false,
  },
  {
    id: "oklab-histogram",
    label: "Oklab Distribution / Hellinger",
    defaultMaxDistance: 0.5,
    maxDistanceLimit: 1,
    requiresColorV1: true,
  },
  {
    id: "oklab-palette-emd",
    label: "Oklab Palette / Earth Mover",
    defaultMaxDistance: 0.16,
    maxDistanceLimit: 1,
    requiresColorV1: true,
  },
] as const;

function deltaE76(
  left: [number, number, number],
  right: [number, number, number],
) {
  return Math.hypot(
    left[0] - right[0],
    left[1] - right[1],
    left[2] - right[2],
  );
}

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180;
}

function radiansToDegrees(value: number) {
  return (value * 180) / Math.PI;
}

export function deltaE2000(
  left: [number, number, number],
  right: [number, number, number],
) {
  const [l1, a1, b1] = left;
  const [l2, a2, b2] = right;
  const chroma1 = Math.hypot(a1, b1);
  const chroma2 = Math.hypot(a2, b2);
  const meanChroma = (chroma1 + chroma2) / 2;
  const meanChroma7 = meanChroma ** 7;
  const g = 0.5 * (1 - Math.sqrt(meanChroma7 / (meanChroma7 + 25 ** 7)));
  const adjustedA1 = (1 + g) * a1;
  const adjustedA2 = (1 + g) * a2;
  const adjustedChroma1 = Math.hypot(adjustedA1, b1);
  const adjustedChroma2 = Math.hypot(adjustedA2, b2);
  const hue = (a: number, b: number) => {
    const degrees = radiansToDegrees(Math.atan2(b, a));
    return degrees >= 0 ? degrees : degrees + 360;
  };
  const hue1 = hue(adjustedA1, b1);
  const hue2 = hue(adjustedA2, b2);
  const deltaL = l2 - l1;
  const deltaChroma = adjustedChroma2 - adjustedChroma1;
  const hueDifference = hue2 - hue1;
  const deltaHueDegrees =
    adjustedChroma1 * adjustedChroma2 === 0
      ? 0
      : Math.abs(hueDifference) <= 180
        ? hueDifference
        : hueDifference > 180
          ? hueDifference - 360
          : hueDifference + 360;
  const deltaHue =
    2 *
    Math.sqrt(adjustedChroma1 * adjustedChroma2) *
    Math.sin(degreesToRadians(deltaHueDegrees / 2));
  const meanLightness = (l1 + l2) / 2;
  const meanAdjustedChroma = (adjustedChroma1 + adjustedChroma2) / 2;
  const meanHue =
    adjustedChroma1 * adjustedChroma2 === 0
      ? hue1 + hue2
      : Math.abs(hue1 - hue2) <= 180
        ? (hue1 + hue2) / 2
        : hue1 + hue2 < 360
          ? (hue1 + hue2 + 360) / 2
          : (hue1 + hue2 - 360) / 2;
  const t =
    1 -
    0.17 * Math.cos(degreesToRadians(meanHue - 30)) +
    0.24 * Math.cos(degreesToRadians(2 * meanHue)) +
    0.32 * Math.cos(degreesToRadians(3 * meanHue + 6)) -
    0.2 * Math.cos(degreesToRadians(4 * meanHue - 63));
  const lightnessScale =
    1 +
    (0.015 * (meanLightness - 50) ** 2) /
      Math.sqrt(20 + (meanLightness - 50) ** 2);
  const chromaScale = 1 + 0.045 * meanAdjustedChroma;
  const hueScale = 1 + 0.015 * meanAdjustedChroma * t;
  const rotationDegrees =
    30 * Math.exp(-(((meanHue - 275) / 25) ** 2));
  const rotation =
    -2 *
    Math.sqrt(
      meanAdjustedChroma ** 7 /
        (meanAdjustedChroma ** 7 + 25 ** 7),
    ) *
    Math.sin(degreesToRadians(2 * rotationDegrees));
  const normalizedL = deltaL / lightnessScale;
  const normalizedChroma = deltaChroma / chromaScale;
  const normalizedHue = deltaHue / hueScale;

  return Math.sqrt(
    normalizedL ** 2 +
      normalizedChroma ** 2 +
      normalizedHue ** 2 +
      rotation * normalizedChroma * normalizedHue,
  );
}

export function hellingerDistance(left: number[], right: number[]) {
  if (left.length !== right.length || left.length === 0) {
    return Number.POSITIVE_INFINITY;
  }

  let squaredDifference = 0;
  for (let index = 0; index < left.length; index += 1) {
    const difference =
      Math.sqrt(Math.max(0, left[index])) -
      Math.sqrt(Math.max(0, right[index]));
    squaredDifference += difference * difference;
  }

  return Math.sqrt(squaredDifference) / Math.SQRT2;
}

type FlowEdge = {
  to: number;
  reverseIndex: number;
  capacity: number;
  cost: number;
};

function addFlowEdge(graph: FlowEdge[][], from: number, to: number, capacity: number, cost: number) {
  const forward: FlowEdge = {
    to,
    reverseIndex: graph[to].length,
    capacity,
    cost,
  };
  const reverse: FlowEdge = {
    to: from,
    reverseIndex: graph[from].length,
    capacity: 0,
    cost: -cost,
  };
  graph[from].push(forward);
  graph[to].push(reverse);
}

export function paletteEarthMoverDistance(
  left: PhotoGraphPaletteEntry[],
  right: PhotoGraphPaletteEntry[],
) {
  if (!left.length || !right.length) {
    return Number.POSITIVE_INFINITY;
  }

  const source = 0;
  const leftOffset = 1;
  const rightOffset = leftOffset + left.length;
  const sink = rightOffset + right.length;
  const graph = Array.from({ length: sink + 1 }, () => [] as FlowEdge[]);

  for (let index = 0; index < left.length; index += 1) {
    addFlowEdge(graph, source, leftOffset + index, left[index].weight, 0);
  }
  for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
    for (let rightIndex = 0; rightIndex < right.length; rightIndex += 1) {
      addFlowEdge(
        graph,
        leftOffset + leftIndex,
        rightOffset + rightIndex,
        1,
        oklabDistance(left[leftIndex].color, right[rightIndex].color),
      );
    }
  }
  for (let index = 0; index < right.length; index += 1) {
    addFlowEdge(graph, rightOffset + index, sink, right[index].weight, 0);
  }

  let totalCost = 0;
  let totalFlow = 0;

  while (totalFlow < 1 - 1e-9) {
    const distances = new Array<number>(graph.length).fill(Number.POSITIVE_INFINITY);
    const previousNode = new Array<number>(graph.length).fill(-1);
    const previousEdge = new Array<number>(graph.length).fill(-1);
    distances[source] = 0;

    for (let iteration = 0; iteration < graph.length - 1; iteration += 1) {
      let changed = false;
      for (let node = 0; node < graph.length; node += 1) {
        if (!Number.isFinite(distances[node])) {
          continue;
        }
        for (let edgeIndex = 0; edgeIndex < graph[node].length; edgeIndex += 1) {
          const edge = graph[node][edgeIndex];
          if (edge.capacity <= 1e-12) {
            continue;
          }
          const candidate = distances[node] + edge.cost;
          if (candidate + 1e-12 < distances[edge.to]) {
            distances[edge.to] = candidate;
            previousNode[edge.to] = node;
            previousEdge[edge.to] = edgeIndex;
            changed = true;
          }
        }
      }
      if (!changed) {
        break;
      }
    }

    if (previousNode[sink] < 0) {
      break;
    }

    let augmentation = 1 - totalFlow;
    for (let node = sink; node !== source; node = previousNode[node]) {
      augmentation = Math.min(
        augmentation,
        graph[previousNode[node]][previousEdge[node]].capacity,
      );
    }
    for (let node = sink; node !== source; node = previousNode[node]) {
      const edge = graph[previousNode[node]][previousEdge[node]];
      edge.capacity -= augmentation;
      graph[node][edge.reverseIndex].capacity += augmentation;
    }

    totalFlow += augmentation;
    totalCost += augmentation * distances[sink];
  }

  return totalFlow > 1e-6 ? totalCost / totalFlow : Number.POSITIVE_INFINITY;
}

export function computePhotoGraphModelDistance(
  left: GraphFeature,
  right: GraphFeature,
  model: PhotoGraphSimilarityModelId,
) {
  switch (model) {
    case "mean-lab-cie76":
      return deltaE76(left.lab, right.lab);
    case "mean-lab-ciede2000":
      return deltaE2000(left.lab, right.lab);
    case "mean-oklab":
      return oklabDistance(
        left.colorV1?.meanOklab ?? rgbToOklab(left.rgb),
        right.colorV1?.meanOklab ?? rgbToOklab(right.rgb),
      );
    case "oklab-histogram":
      return left.colorV1 && right.colorV1
        ? hellingerDistance(left.colorV1.histogram, right.colorV1.histogram)
        : Number.POSITIVE_INFINITY;
    case "oklab-palette-emd":
      return left.colorV1 && right.colorV1
        ? paletteEarthMoverDistance(left.colorV1.palette, right.colorV1.palette)
        : Number.POSITIVE_INFINITY;
  }
}