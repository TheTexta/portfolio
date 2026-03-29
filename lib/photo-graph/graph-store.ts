import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  hexToRgb,
} from "@/lib/photo-graph/feature-extraction";
import {
  imagePathForLegacyId,
  photoGraphImageBasePath,
} from "@/lib/photo-graph/config";
import {
  loadPhotoGraphFromDatabase,
  replacePhotoGraphGraph,
} from "@/lib/photo-graph/database";
import { isRecoverablePhotoGraphDatabaseError } from "@/lib/photo-graph/database-errors";
import { buildSupabaseStoragePublicUrl } from "@/lib/supabase/config";
import type {
  GraphImageDimensions,
  GraphLoadSource,
  GraphNode,
  PublicGraphNode,
} from "@/lib/photo-graph/types";

export { ensureProcessingFeatures } from "@/lib/photo-graph/processing-features";

type NormalizedGraphResult = {
  nodes: GraphNode[];
  source: GraphLoadSource;
};

type GraphLoadResult = NormalizedGraphResult & {
  databaseAvailable: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function parseNumber(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function normalizeCorrelations(value: unknown) {
  if (!isRecord(value)) {
    return {} as Record<string, number>;
  }

  const correlations: Record<string, number> = {};

  for (const [targetId, rawValue] of Object.entries(value)) {
    const parsed = parseNumber(rawValue, Number.NaN);
    if (!Number.isFinite(parsed)) {
      continue;
    }

    correlations[String(targetId)] = clamp(parsed, 0, 1);
  }

  return correlations;
}

function normalizeFeature(value: unknown) {
  if (!isRecord(value)) {
    return undefined;
  }

  const rgbRaw = value.rgb;
  const labRaw = value.lab;

  if (!Array.isArray(rgbRaw) || rgbRaw.length !== 3) {
    return undefined;
  }

  if (!Array.isArray(labRaw) || labRaw.length !== 3) {
    return undefined;
  }

  const rgbTuple = rgbRaw.map((entry) => parseNumber(entry, Number.NaN));
  const labTuple = labRaw.map((entry) => parseNumber(entry, Number.NaN));
  const hue = parseNumber(value.hue, Number.NaN);
  const longSide = parseNumber(value.longSide, Number.NaN);

  if (
    rgbTuple.some((entry) => !Number.isFinite(entry)) ||
    labTuple.some((entry) => !Number.isFinite(entry)) ||
    !Number.isFinite(hue) ||
    !Number.isFinite(longSide)
  ) {
    return undefined;
  }

  return {
    rgb: [rgbTuple[0], rgbTuple[1], rgbTuple[2]] as [number, number, number],
    lab: [labTuple[0], labTuple[1], labTuple[2]] as [number, number, number],
    hue,
    longSide: Math.max(1, Math.round(longSide)),
  };
}

function normalizeDimensions(value: unknown) {
  if (!isRecord(value)) {
    return undefined;
  }

  const width = parseNumber(value.width, Number.NaN);
  const height = parseNumber(value.height, Number.NaN);

  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    return undefined;
  }

  if (width <= 0 || height <= 0) {
    return undefined;
  }

  const normalizedWidth = Math.max(1, Math.round(width));
  const normalizedHeight = Math.max(1, Math.round(height));
  const normalizedAspectRatio = normalizedWidth / normalizedHeight;

  return {
    width: normalizedWidth,
    height: normalizedHeight,
    aspectRatio: normalizedAspectRatio,
  } as GraphImageDimensions;
}

function normalizeNode(
  rawNode: unknown,
  index: number,
  imageBasePath: string,
): GraphNode {
  const fallbackId = String(index + 1);

  if (!isRecord(rawNode)) {
    return {
      id: fallbackId,
      scale: 1,
      colour: "#808080",
      correlations: {},
      storagePath: `${imageBasePath}/${fallbackId}.png`,
    };
  }

  const id = String(rawNode.id ?? fallbackId);
  const scale = clamp(parseNumber(rawNode.scale, 1), 0.5, 1);

  const parsedColour =
    typeof rawNode.colour === "string" && hexToRgb(rawNode.colour)
      ? rawNode.colour
      : "#808080";

  const correlations = normalizeCorrelations(rawNode.correlations);
  const feature = normalizeFeature(rawNode.feature);
  const dimensions = normalizeDimensions(rawNode.dimensions);

  const storagePath =
    typeof rawNode.storagePath === "string" && rawNode.storagePath
      ? rawNode.storagePath
      : undefined;

  const url = typeof rawNode.url === "string" ? rawNode.url : undefined;

  return {
    id,
    scale,
    colour: parsedColour,
    correlations,
    feature,
    dimensions,
    storagePath,
    url,
  };
}

function normalizeGraphData(
  rawData: unknown,
  source: GraphLoadSource,
  imageBasePath: string,
): NormalizedGraphResult {
  const rawNodes = Array.isArray(rawData) ? rawData : [];
  const nodes = rawNodes.map((rawNode, index) =>
    normalizeNode(rawNode, index, imageBasePath),
  );

  return { nodes, source };
}

export { imagePathForLegacyId, photoGraphImageBasePath };

export async function readStaticGraph() {
  const staticGraphPath = path.join(
    process.cwd(),
    "public",
    "portfolioTable.json",
  );
  const buffer = await readFile(staticGraphPath);
  const raw = JSON.parse(buffer.toString("utf-8"));
  const nodes = normalizeGraphData(
    raw,
    "static",
    photoGraphImageBasePath(),
  ).nodes;
  ensureGraphStoragePaths(nodes);
  return nodes;
}

export async function readDatabaseGraph() {
  try {
    return await loadPhotoGraphFromDatabase();
  } catch (error) {
    if (
      isRecoverablePhotoGraphDatabaseError(error, [
        "photo_graph_nodes",
        "photo_graph_edges",
      ])
    ) {
      return null;
    }

    throw error;
  }
}

export async function loadGraphWithFallback(): Promise<GraphLoadResult> {
  const databaseNodes = await readDatabaseGraph();
  const databaseAvailable = databaseNodes !== null;

  if (databaseNodes && databaseNodes.length > 0) {
    return {
      source: "database" as GraphLoadSource,
      nodes: databaseNodes,
      databaseAvailable,
    };
  }

  return {
    source: "static" as GraphLoadSource,
    nodes: await readStaticGraph(),
    databaseAvailable,
  };
}

export async function writeRuntimeGraph(nodes: GraphNode[]) {
  await replacePhotoGraphGraph(nodes);
}

export function ensureGraphStoragePaths(nodes: GraphNode[]) {
  for (const node of nodes) {
    if (!node.storagePath && !node.url) {
      node.storagePath = imagePathForLegacyId(node.id);
    }

    if (!node.url && node.storagePath) {
      node.url = buildSupabaseStoragePublicUrl(node.storagePath);
    }
  }
}

export function cloneGraphNodes(nodes: GraphNode[]): GraphNode[] {
  return nodes.map((node) => {
    const cloned: GraphNode = {
      ...node,
      correlations: { ...node.correlations },
    };

    if (node.feature) {
      cloned.feature = {
        rgb: [...node.feature.rgb] as [number, number, number],
        lab: [...node.feature.lab] as [number, number, number],
        hue: node.feature.hue,
        longSide: node.feature.longSide,
      };
    }

    if (node.dimensions) {
      cloned.dimensions = { ...node.dimensions };
    }

    return cloned;
  });
}

export function toPublicGraphNodes(nodes: GraphNode[]): PublicGraphNode[] {
  return nodes.map((node) => ({
    id: node.id,
    scale: node.scale,
    colour: node.colour,
    correlations: node.correlations,
    storagePath: node.storagePath,
    dimensions: node.dimensions ? { ...node.dimensions } : undefined,
    url: node.url,
  }));
}
