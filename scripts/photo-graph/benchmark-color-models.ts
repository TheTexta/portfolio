import { loadEnvConfig } from "@next/env";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  BENCHMARK_METRIC_DEFINITIONS,
  evaluateBenchmarkRanking,
} from "../../lib/photo-graph/benchmark-metrics";
import { countGraphEdges } from "../../lib/photo-graph/edge-generation";
import {
  cloneGraphNodes,
  loadGraphWithFallback,
} from "../../lib/photo-graph/graph-store";
import { generateSparsePhotoGraph } from "../../lib/photo-graph/sparse-edge-generation";
import {
  computePhotoGraphModelDistance,
  PHOTO_GRAPH_SIMILARITY_MODELS,
} from "../../lib/photo-graph/similarity-models";
import type {
  GraphNode,
  PhotoGraphColorFeatureV1,
  PhotoGraphSimilarityModelId,
} from "../../lib/photo-graph/types";
import judgments from "./color-benchmark-judgments-v1.json";

const FEATURE_CATALOG_PATH = path.join(
  process.cwd(),
  "public",
  "projects",
  "photo-graph",
  "color-features-v1.json",
);
const OUTPUT_PATH = path.join(
  process.cwd(),
  "public",
  "projects",
  "photo-graph",
  "color-model-benchmark-v1.json",
);
const NEIGHBORS_PER_NODE = 4;
const DISPLAY_NEIGHBOR_COUNT = 6;

type FeatureCatalog = {
  version: 1;
  generatedAt: string;
  nodes: Record<string, PhotoGraphColorFeatureV1>;
};

type DistanceEntry = {
  id: string;
  distance: number;
};

function round(value: number, digits = 6) {
  return Number(value.toFixed(digits));
}

function compareNodeIds(leftId: string, rightId: string) {
  const leftNumber = Number(leftId);
  const rightNumber = Number(rightId);
  return Number.isFinite(leftNumber) && Number.isFinite(rightNumber)
    ? leftNumber - rightNumber
    : leftId.localeCompare(rightId);
}

function rankedDistances(
  query: GraphNode,
  candidates: GraphNode[],
  model: PhotoGraphSimilarityModelId,
) {
  if (!query.feature) {
    throw new Error(`Query node ${query.id} is missing its feature.`);
  }

  return candidates
    .filter((candidate) => candidate.id !== query.id && candidate.feature)
    .map((candidate): DistanceEntry => ({
      id: candidate.id,
      distance: computePhotoGraphModelDistance(
        query.feature!,
        candidate.feature!,
        model,
      ),
    }))
    .filter((entry) => Number.isFinite(entry.distance))
    .sort(
      (left, right) =>
        left.distance - right.distance || compareNodeIds(left.id, right.id),
    );
}

function graphTopology(nodes: GraphNode[]) {
  const adjacency = new Map(
    nodes.map((node) => [
      node.id,
      Object.keys(node.correlations).filter((targetId) =>
        nodes.some((candidate) => candidate.id === targetId),
      ),
    ]),
  );
  const isolates = [...adjacency.values()].filter(
    (neighbors) => neighbors.length === 0,
  ).length;
  const visited = new Set<string>();
  let components = 0;

  for (const node of nodes) {
    if (visited.has(node.id)) {
      continue;
    }
    components += 1;
    const pending = [node.id];
    while (pending.length > 0) {
      const current = pending.pop()!;
      if (visited.has(current)) {
        continue;
      }
      visited.add(current);
      for (const targetId of adjacency.get(current) ?? []) {
        if (!visited.has(targetId)) {
          pending.push(targetId);
        }
      }
    }
  }

  return { components, isolates };
}

function validateJudgments(nodeById: Map<string, GraphNode>) {
  const referencedIds = new Set(
    judgments.queries.flatMap((query) => [
      query.id,
      ...query.positiveIds,
      ...query.negativeIds,
    ]),
  );
  const missingIds = [...referencedIds].filter((id) => !nodeById.has(id));
  if (missingIds.length > 0) {
    throw new Error(
      `Benchmark judgments reference missing nodes: ${missingIds.join(", ")}`,
    );
  }
}

async function run() {
  loadEnvConfig(process.cwd());
  const [loaded, catalogRaw] = await Promise.all([
    loadGraphWithFallback(),
    readFile(FEATURE_CATALOG_PATH, "utf8"),
  ]);
  const catalog = JSON.parse(catalogRaw) as FeatureCatalog;
  const nodes = cloneGraphNodes(loaded.nodes);

  for (const node of nodes) {
    const colorV1 = catalog.nodes[node.id];
    if (!node.feature || !colorV1) {
      throw new Error(`Node ${node.id} is missing a benchmark feature.`);
    }
    node.feature.colorV1 = colorV1;
  }

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  validateJudgments(nodeById);
  const models = [];

  for (const definition of PHOTO_GRAPH_SIMILARITY_MODELS) {
    const timingStart = performance.now();
    let pairCount = 0;
    for (let leftIndex = 0; leftIndex < nodes.length; leftIndex += 1) {
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < nodes.length;
        rightIndex += 1
      ) {
        computePhotoGraphModelDistance(
          nodes[leftIndex].feature!,
          nodes[rightIndex].feature!,
          definition.id,
        );
        pairCount += 1;
      }
    }
    const pairwiseDurationMs = performance.now() - timingStart;
    const config = {
      version: 2 as const,
      model: definition.id,
      neighborsPerNode: NEIGHBORS_PER_NODE,
      maxDistance: definition.defaultMaxDistance,
    };
    const graphStart = performance.now();
    const { nodes: generatedNodes } = generateSparsePhotoGraph(
      cloneGraphNodes(nodes),
      config,
    );
    const graphDurationMs = performance.now() - graphStart;
    const edgeCount = countGraphEdges(generatedNodes);
    const topology = graphTopology(generatedNodes);
    const queryResults = judgments.queries.map((judgment) => {
      const query = nodeById.get(judgment.id)!;
      const fullRanking = rankedDistances(query, nodes, definition.id);
      const evaluation = evaluateBenchmarkRanking(
        fullRanking,
        judgment,
        NEIGHBORS_PER_NODE,
        DISPLAY_NEIGHBOR_COUNT,
      );

      return {
        id: judgment.id,
        label: judgment.label,
        ...evaluation,
        precisionAtK: round(evaluation.precisionAtK, 4),
        pairwiseAgreement: round(evaluation.pairwiseAgreement, 4),
        neighbors: evaluation.neighbors.map((entry) => ({
          ...entry,
          distance: round(entry.distance),
        })),
        judgedNeighbors: evaluation.judgedNeighbors.map((entry) => ({
          ...entry,
          distance: round(entry.distance),
        })),
      };
    });
    const averagePrecisionAtK =
      queryResults.reduce((sum, query) => sum + query.precisionAtK, 0) /
      queryResults.length;
    const averagePairwiseAgreement =
      queryResults.reduce((sum, query) => sum + query.pairwiseAgreement, 0) /
      queryResults.length;

    models.push({
      id: definition.id,
      label: definition.label,
      config,
      metrics: {
        precisionAtK: round(averagePrecisionAtK, 4),
        judgedPositiveCountAtK: queryResults.reduce(
          (sum, query) => sum + query.judgedPositiveCountAtK,
          0,
        ),
        judgedSlotCount: queryResults.reduce(
          (sum, query) => sum + query.judgedSlotCount,
          0,
        ),
        pairwiseAgreement: round(averagePairwiseAgreement, 4),
        pairwiseDurationMs: round(pairwiseDurationMs, 3),
        graphDurationMs: round(graphDurationMs, 3),
        pairCount,
        edgeCount,
        density: round(
          nodes.length > 1
            ? (2 * edgeCount) / (nodes.length * (nodes.length - 1))
            : 0,
        ),
        ...topology,
      },
      queries: queryResults,
    });
  }

  const report = {
    version: 1,
    reportingSchemaVersion: 2,
    metricDefinitions: BENCHMARK_METRIC_DEFINITIONS,
    generatedAt: new Date().toISOString(),
    featureCatalogGeneratedAt: catalog.generatedAt,
    source: loaded.source,
    nodeCount: nodes.length,
    neighborsPerNode: NEIGHBORS_PER_NODE,
    judgmentScope: judgments.scope,
    queryIds: judgments.queries.map((query) => query.id),
    models,
  };

  await writeFile(OUTPUT_PATH, `${JSON.stringify(report)}\n`, "utf8");
  console.table(
    models.map((model) => ({
      model: model.id,
      judgedSubsetPrecisionAt4: model.metrics.precisionAtK,
      positiveSlots: `${model.metrics.judgedPositiveCountAtK}/${model.metrics.judgedSlotCount}`,
      agreement: model.metrics.pairwiseAgreement,
      edges: model.metrics.edgeCount,
      components: model.metrics.components,
      isolates: model.metrics.isolates,
      pairwiseMs: model.metrics.pairwiseDurationMs,
      graphMs: model.metrics.graphDurationMs,
    })),
  );
  console.log(`Wrote benchmark report to ${OUTPUT_PATH}.`);
}

run().catch((error) => {
  console.error("Photo graph color benchmark failed.");
  console.error(error);
  process.exit(1);
});
