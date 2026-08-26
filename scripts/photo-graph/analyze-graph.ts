import { loadEnvConfig } from "@next/env";
import { performance } from "node:perf_hooks";

import {
  DEFAULT_LAB_EDGE_GENERATION_PARAMS,
  countGraphEdges,
  regenerateLabGraphCorrelations,
} from "../../lib/photo-graph/edge-generation";
import { loadPhotoGraphEdgeGenerationConfig } from "../../lib/photo-graph/database";
import {
  cloneGraphNodes,
  loadGraphWithFallback,
} from "../../lib/photo-graph/graph-store";
import { generateSparsePhotoGraph } from "../../lib/photo-graph/sparse-edge-generation";
import type {
  GraphNode,
  LabEdgeGenerationParams,
} from "../../lib/photo-graph/types";

type GraphMetrics = {
  nodes: number;
  edges: number;
  density: number;
  components: number;
  isolates: number;
  degreeMin: number;
  degreeMedian: number;
  degreeMean: number;
  degreeMax: number;
};

const SWEEP_PARAMS: LabEdgeGenerationParams[] = [
  { sigmaE: 10, minCorrelation: 0.2 },
  { sigmaE: 10, minCorrelation: 0.3 },
  { sigmaE: 10, minCorrelation: 0.4 },
  { sigmaE: 15, minCorrelation: 0.2 },
  DEFAULT_LAB_EDGE_GENERATION_PARAMS,
  { sigmaE: 15, minCorrelation: 0.4 },
  { sigmaE: 20, minCorrelation: 0.2 },
  { sigmaE: 20, minCorrelation: 0.3 },
  { sigmaE: 20, minCorrelation: 0.4 },
];

function finiteNeighbors(node: GraphNode, nodeIds: Set<string>) {
  return Object.entries(node.correlations).flatMap(([targetId, correlation]) =>
    targetId !== node.id &&
    nodeIds.has(targetId) &&
    Number.isFinite(correlation) &&
    correlation > 0
      ? [targetId]
      : [],
  );
}

function median(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  const middle = Math.floor(values.length / 2);
  return values.length % 2 === 0
    ? (values[middle - 1] + values[middle]) / 2
    : values[middle];
}

function measureGraph(nodes: GraphNode[]): GraphMetrics {
  const nodeIds = new Set(nodes.map((node) => node.id));
  const neighbors = new Map(
    nodes.map((node) => [node.id, new Set(finiteNeighbors(node, nodeIds))]),
  );

  for (const [sourceId, targetIds] of neighbors) {
    for (const targetId of targetIds) {
      neighbors.get(targetId)?.add(sourceId);
    }
  }

  const degrees = [...neighbors.values()]
    .map((entries) => entries.size)
    .sort((left, right) => left - right);
  const visited = new Set<string>();
  let components = 0;

  for (const node of nodes) {
    if (visited.has(node.id)) {
      continue;
    }

    components += 1;
    const pending = [node.id];
    visited.add(node.id);

    while (pending.length > 0) {
      const currentId = pending.pop();
      if (!currentId) {
        continue;
      }

      for (const targetId of neighbors.get(currentId) ?? []) {
        if (!visited.has(targetId)) {
          visited.add(targetId);
          pending.push(targetId);
        }
      }
    }
  }

  const edges = countGraphEdges(nodes);
  const possibleEdges = (nodes.length * (nodes.length - 1)) / 2;

  return {
    nodes: nodes.length,
    edges,
    density: possibleEdges > 0 ? edges / possibleEdges : 0,
    components,
    isolates: degrees.filter((degree) => degree === 0).length,
    degreeMin: degrees[0] ?? 0,
    degreeMedian: median(degrees),
    degreeMean:
      degrees.length > 0
        ? degrees.reduce((total, degree) => total + degree, 0) / degrees.length
        : 0,
    degreeMax: degrees.at(-1) ?? 0,
  };
}

function toReportRow(
  label: string,
  metrics: GraphMetrics,
  durationMs: number | null = null,
) {
  return {
    graph: label,
    nodes: metrics.nodes,
    edges: metrics.edges,
    density: metrics.density.toFixed(4),
    components: metrics.components,
    isolates: metrics.isolates,
    degreeMin: metrics.degreeMin,
    degreeMedian: metrics.degreeMedian.toFixed(1),
    degreeMean: metrics.degreeMean.toFixed(1),
    degreeMax: metrics.degreeMax,
    durationMs: durationMs === null ? "-" : durationMs.toFixed(1),
  };
}

async function run() {
  loadEnvConfig(process.cwd());
  const loaded = await loadGraphWithFallback();
  const rows = [
    toReportRow(`loaded:${loaded.source}`, measureGraph(loaded.nodes)),
  ];
  const savedConfig = loaded.databaseAvailable
    ? await loadPhotoGraphEdgeGenerationConfig()
    : null;

  if (savedConfig) {
    const nodes = cloneGraphNodes(loaded.nodes);
    const startedAt = performance.now();
    generateSparsePhotoGraph(nodes, savedConfig);
    rows.push(
      toReportRow(
        `saved:${savedConfig.model}:k${savedConfig.neighborsPerNode}:d${savedConfig.maxDistance}`,
        measureGraph(nodes),
        performance.now() - startedAt,
      ),
    );
  }

  for (const params of SWEEP_PARAMS) {
    const nodes = cloneGraphNodes(loaded.nodes);
    const startedAt = performance.now();
    regenerateLabGraphCorrelations(nodes, params);
    const durationMs = performance.now() - startedAt;
    rows.push(
      toReportRow(
        `lab:s${params.sigmaE}:c${params.minCorrelation}`,
        measureGraph(nodes),
        durationMs,
      ),
    );
  }

  console.log(
    `Photo graph source: ${loaded.source} (${loaded.databaseAvailable ? "database available" : "static fallback"})`,
  );
  console.table(rows);
}

run().catch((error) => {
  console.error("Photo graph analysis failed.", error);
  process.exitCode = 1;
});
