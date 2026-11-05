import { generateSparsePhotoGraph } from "@/lib/photo-graph/sparse-edge-generation";
import { computePhotoGraphModelDistance } from "@/lib/photo-graph/similarity-models";
import type {
  GraphNode,
  PhotoGraphSparseEdgeGenerationConfig,
} from "@/lib/photo-graph/types";
import type { ExampleEdge, ExamplePhoto, WorkedExample } from "./example-types";

export type ExampleDataset = Omit<WorkedExample, "pairs">;

export function rankExampleCandidates(photos: ExamplePhoto[], queryId: string) {
  const query = photos.find((photo) => photo.id === queryId)!;
  return photos
    .filter((photo) => photo.id !== queryId)
    .map((photo) => ({
      id: photo.id,
      distance: computePhotoGraphModelDistance(
        query,
        photo,
        "mean-lab-ciede2000",
      ),
    }))
    .sort(
      (left, right) =>
        left.distance - right.distance || Number(left.id) - Number(right.id),
    )
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

/** Production selection rules, operating on fresh nodes rather than the fixture. */
export function buildExampleGraph(
  photos: ExamplePhoto[],
  config: PhotoGraphSparseEdgeGenerationConfig,
) {
  const nodes: GraphNode[] = photos.map((photo) => ({
    id: photo.id,
    scale: 1,
    colour: "#000000",
    correlations: {},
    feature: {
      rgb: [...photo.rgb],
      lab: [...photo.lab],
      hue: photo.hue,
      longSide: photo.longSide,
    },
  }));
  const result = generateSparsePhotoGraph(nodes, config);
  const edges: ExampleEdge[] = [];
  for (const node of result.nodes) {
    for (const [target, weight] of Object.entries(node.correlations)) {
      if (Number(node.id) < Number(target))
        edges.push({ source: node.id, target, weight });
    }
  }
  return { nominations: result.neighbors, edges };
}

export function describeCandidate(
  data: ExampleDataset,
  graph: WorkedExample["defaultGraph"],
  config: PhotoGraphSparseEdgeGenerationConfig,
  id: string,
  queryId = data.queryId,
  ranking = data.queryRanking,
) {
  const ranked = ranking.find((candidate) => candidate.id === id)!;
  const forward = graph.nominations.find(
    (edge) => edge.sourceId === queryId && edge.targetId === id,
  );
  const reverse = graph.nominations.find(
    (edge) => edge.sourceId === id && edge.targetId === queryId,
  );
  const edge = graph.edges.find(
    (edge) =>
      (edge.source === id && edge.target === queryId) ||
      (edge.target === id && edge.source === queryId),
  );
  const status =
    ranked.distance > config.maxDistance
      ? "Beyond cutoff"
      : ranked.distance === config.maxDistance
        ? "At cutoff: zero weight"
        : forward
          ? "Selected"
          : "Outside neighbour limit";
  return {
    ...ranked,
    status,
    forward: !!forward,
    reverse: !!reverse,
    linked: !!edge,
    weight: edge?.weight ?? 0,
  };
}

export const format = (value: number, digits = 3) => value.toFixed(digits);
export const signed = (value: number, digits = 3) =>
  `${value > 0 ? "+" : ""}${format(value, digits)}`;
export const colour = (photo: ExamplePhoto) => `rgb(${photo.rgb.join(" ")})`;
