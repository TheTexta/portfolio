import { buildCanonicalPhotoGraphStoragePath } from "./config";
import { scaleFromLongSide } from "./correlation";
import { photoGraphR2PublishedKey } from "./r2-paths";
import {
  generateSparsePhotoGraph,
  updateSparsePhotoGraphForAddedNodes,
  type RankedPhotoGraphNeighbor,
} from "./sparse-edge-generation";
import type {
  GraphFeature,
  GraphImageDimensions,
  GraphNode,
  PhotoGraphEdgeGenerationConfig,
} from "./types";

export type ParsedUploadRegistration = {
  storagePath: string;
  feature: GraphFeature;
  dimensions: GraphImageDimensions;
  colour: string;
} & (
  | { storageProvider?: undefined }
  | {
      storageProvider: "r2";
      sourceSha256: string;
      sourceSize: number;
      contentType: string;
    }
);

export function nextPhotoGraphNodeId(nodes: GraphNode[]) {
  return (
    nodes.reduce(
      (max, node) =>
        Number.isFinite(Number(node.id)) ? Math.max(max, Number(node.id)) : max,
      0,
    ) + 1
  );
}

/** Plans destinations from reserved identities, never from a new local allocation. */
export function planPhotoGraphUploadNodes(
  existingNodes: GraphNode[],
  existingMaxLongSide: number,
  uploads: ParsedUploadRegistration[],
  nodeIds: string[],
) {
  const createdIds: string[] = [];
  const createdNodes: GraphNode[] = [];
  const legacyAssets: { source: string; destination: string }[] = [];
  const r2Assets: {
    source: string;
    nodeId: string;
    contentType: string;
    size: number;
    sha256: string;
  }[] = [];
  for (const [index, upload] of uploads.entries()) {
    const id = nodeIds[index];
    createdIds.push(id);
    const storagePath =
      upload.storageProvider === "r2"
        ? photoGraphR2PublishedKey(id, upload.storagePath)
        : buildCanonicalPhotoGraphStoragePath(id, upload.storagePath);
    if (upload.storageProvider === "r2") {
      r2Assets.push({
        source: upload.storagePath,
        nodeId: id,
        contentType: upload.contentType,
        size: upload.sourceSize,
        sha256: upload.sourceSha256,
      });
    } else {
      legacyAssets.push({
        source: upload.storagePath,
        destination: storagePath,
      });
    }
    createdNodes.push({
      id,
      scale: 1,
      colour: upload.colour,
      correlations: {},
      storagePath,
      ...(upload.storageProvider === "r2"
        ? { storageProvider: "r2" as const }
        : {}),
      feature: upload.feature,
      dimensions: upload.dimensions,
    });
  }
  const nodes = [...structuredClone(existingNodes), ...createdNodes];
  const newMaxLongSide = Math.max(
    existingMaxLongSide,
    ...createdNodes.map((node) => node.feature?.longSide ?? 1),
  );
  for (const node of newMaxLongSide > existingMaxLongSide
    ? nodes
    : createdNodes) {
    if (node.feature)
      node.scale = scaleFromLongSide(node.feature.longSide, newMaxLongSide);
  }
  return {
    nodes,
    existingNodes: nodes.slice(0, existingNodes.length),
    createdNodes,
    createdIds,
    legacyAssets,
    r2Assets,
  };
}

function neighborSignature(neighbors: RankedPhotoGraphNeighbor[]) {
  return [...neighbors]
    .sort((a, b) => a.rank - b.rank)
    .map(
      (neighbor) =>
        `${neighbor.rank}:${neighbor.targetId}:${neighbor.distance.toPrecision(15)}:${neighbor.correlation.toPrecision(15)}`,
    )
    .join("|");
}

function changedNeighborSourceIds(
  previous: RankedPhotoGraphNeighbor[],
  next: RankedPhotoGraphNeighbor[],
  addedIds: string[],
) {
  const added = new Set(addedIds);
  const previousBySource = Map.groupBy(
    previous,
    (neighbor) => neighbor.sourceId,
  );
  const nextBySource = Map.groupBy(next, (neighbor) => neighbor.sourceId);
  return [
    ...new Set([
      ...previousBySource.keys(),
      ...nextBySource.keys(),
      ...addedIds,
    ]),
  ].filter(
    (id) =>
      added.has(id) ||
      neighborSignature(previousBySource.get(id) ?? []) !==
        neighborSignature(nextBySource.get(id) ?? []),
  );
}

/** Pure graph generation; static and missing-directed snapshots require full replacement. */
export function planPhotoGraphUploadGraph(
  plan: ReturnType<typeof planPhotoGraphUploadNodes>,
  existingNeighbors: RankedPhotoGraphNeighbor[],
  source: "static" | "database",
  config: PhotoGraphEdgeGenerationConfig,
) {
  const { existingNodes } = plan;
  const incremental =
    source !== "static" &&
    (existingNeighbors.length > 0 || existingNodes.length <= 1);
  const generated = incremental
    ? updateSparsePhotoGraphForAddedNodes(
        structuredClone(existingNodes),
        structuredClone(plan.createdNodes),
        existingNeighbors,
        config,
      )
    : generateSparsePhotoGraph(structuredClone(plan.nodes), config);
  return {
    generatedNodes: generated.nodes,
    neighbors: generated.neighbors,
    sourceIds: incremental
      ? changedNeighborSourceIds(
          existingNeighbors,
          generated.neighbors,
          plan.createdIds,
        )
      : generated.nodes.map((node) => node.id),
  };
}
