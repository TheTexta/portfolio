import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  featureFromRgb,
  hexToRgb,
  rgbToHex,
} from "@/lib/photo-graph/feature-extraction";
import { getFirebaseAdminBucket } from "@/lib/server/firebase-admin";
import type {
  GraphLoadSource,
  GraphNode,
  PublicGraphNode,
} from "@/lib/photo-graph/types";

const FALLBACK_MAX_LONG_SIDE = 1000;
const DEFAULT_GRAPH_OBJECT_PATH = "photo-graph/graph.json";
const DEFAULT_IMAGE_BASE_PATH = "photography-images";

type NormalizedGraphResult = {
  nodes: GraphNode[];
  source: GraphLoadSource;
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

function deriveLongSideFromScale(scale: number, maxLongSide: number) {
  const normalized = clamp((scale - 0.5) / 0.5, 0, 1);
  return Math.max(1, Math.round(maxLongSide * normalized));
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

function runtimeGraphPath() {
  return process.env.PHOTO_GRAPH_GRAPH_OBJECT_PATH ?? DEFAULT_GRAPH_OBJECT_PATH;
}

export function photoGraphImageBasePath() {
  return process.env.PHOTO_GRAPH_IMAGE_BASE_PATH ?? DEFAULT_IMAGE_BASE_PATH;
}

export async function readStaticGraph() {
  const staticGraphPath = path.join(process.cwd(), "public", "portfolioTable.json");
  const buffer = await readFile(staticGraphPath);
  const raw = JSON.parse(buffer.toString("utf-8"));

  return normalizeGraphData(raw, "static", photoGraphImageBasePath()).nodes;
}

export async function readRuntimeGraph() {
  try {
    const bucket = getFirebaseAdminBucket();
    const graphFile = bucket.file(runtimeGraphPath());
    const [exists] = await graphFile.exists();

    if (!exists) {
      return null;
    }

    const [buffer] = await graphFile.download();
    const raw = JSON.parse(buffer.toString("utf-8"));
    return normalizeGraphData(raw, "runtime", photoGraphImageBasePath()).nodes;
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes("Missing required env var") ||
        error.message.includes("No default Firebase app"))
    ) {
      return null;
    }

    throw error;
  }
}

export async function loadGraphWithFallback() {
  const runtimeNodes = await readRuntimeGraph();

  if (runtimeNodes) {
    return {
      source: "runtime" as GraphLoadSource,
      nodes: runtimeNodes,
    };
  }

  return {
    source: "static" as GraphLoadSource,
    nodes: await readStaticGraph(),
  };
}

export async function writeRuntimeGraph(nodes: GraphNode[]) {
  const bucket = getFirebaseAdminBucket();
  const graphFile = bucket.file(runtimeGraphPath());
  const payload = JSON.stringify(nodes, null, 2);

  await graphFile.save(payload, {
    resumable: false,
    contentType: "application/json; charset=utf-8",
    metadata: {
      cacheControl: "no-store",
    },
  });
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

    return cloned;
  });
}

export function ensureProcessingFeatures(nodes: GraphNode[]) {
  const withFeatureLongSides = nodes
    .map((node) => node.feature?.longSide ?? 0)
    .filter((longSide) => Number.isFinite(longSide) && longSide > 0);

  const inferredMaxLongSide =
    withFeatureLongSides.length > 0
      ? Math.max(...withFeatureLongSides)
      : FALLBACK_MAX_LONG_SIDE;

  for (const node of nodes) {
    if (node.feature) {
      continue;
    }

    const rgb = hexToRgb(node.colour) ?? [128, 128, 128];
    const longSide = deriveLongSideFromScale(node.scale, inferredMaxLongSide);
    node.feature = featureFromRgb(rgb, longSide);
    node.colour = rgbToHex(rgb);
  }

  const normalizedLongSides = nodes
    .map((node) => node.feature?.longSide ?? 0)
    .filter((longSide) => Number.isFinite(longSide) && longSide > 0);

  return normalizedLongSides.length
    ? Math.max(...normalizedLongSides)
    : FALLBACK_MAX_LONG_SIDE;
}

export function toPublicGraphNodes(nodes: GraphNode[]): PublicGraphNode[] {
  return nodes.map((node) => ({
    id: node.id,
    scale: node.scale,
    colour: node.colour,
    correlations: node.correlations,
    storagePath: node.storagePath,
    url: node.url,
  }));
}

export function imagePathForLegacyId(id: string) {
  return `${photoGraphImageBasePath().replace(/\/$/, "")}/${id}.png`;
}
