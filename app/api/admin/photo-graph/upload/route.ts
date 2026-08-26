import { NextRequest, NextResponse } from "next/server";

import { buildCanonicalPhotoGraphStoragePath } from "@/lib/photo-graph/config";
import { scaleFromLongSide } from "@/lib/photo-graph/correlation";
import {
  countGraphEdges,
} from "@/lib/photo-graph/edge-generation";
import {
  cloneGraphNodes,
  ensureGraphStoragePaths,
  ensureProcessingFeatures,
  loadGraphWithFallback,
  writeRuntimeGraph,
} from "@/lib/photo-graph/graph-store";
import {
  loadPhotoGraphEdgeGenerationConfig,
  loadPhotoGraphNeighbors,
  replacePhotoGraphNeighborSnapshot,
  reservePhotoGraphNodeIds,
  savePhotoGraphEdgeGenerationConfig,
  upsertPhotoGraphNodes,
} from "@/lib/photo-graph/database";
import { featureFromRgb, rgbToHex } from "@/lib/photo-graph/feature-extraction";
import { parsePhotoGraphColorFeatureV1 } from "@/lib/photo-graph/color-features";
import {
  generateSparsePhotoGraph,
  updateSparsePhotoGraphForAddedNodes,
  type RankedPhotoGraphNeighbor,
} from "@/lib/photo-graph/sparse-edge-generation";
import { PHOTO_GRAPH_SIMILARITY_MODELS } from "@/lib/photo-graph/similarity-models";
import {
  ADMIN_SESSION_COOKIE_NAME,
  isValidAdminSessionToken,
} from "@/lib/server/admin-session";
import { getServiceRoleSupabase } from "@/lib/server/supabase";
import { getPhotoGraphStorageBucket } from "@/lib/supabase/config";
import type {
  GraphFeature,
  GraphImageDimensions,
  GraphNode,
} from "@/lib/photo-graph/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UploadRegistration = {
  storagePath?: string;
  feature?: GraphFeature;
  dimensions?: GraphImageDimensions;
  colour?: string;
};

type UploadRegistrationPayload = {
  uploads?: UploadRegistration[];
};

type ParsedUploadRegistration = {
  storagePath: string;
  feature: GraphFeature;
  dimensions: GraphImageDimensions;
  colour: string;
};

function parseNumber(value: unknown) {
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

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function parseFeaturePayload(
  value: unknown,
): ParsedUploadRegistration["feature"] | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = value as Record<string, unknown>;
  const rgbRaw = raw.rgb;

  if (!Array.isArray(rgbRaw) || rgbRaw.length !== 3) {
    return null;
  }

  const rgb = rgbRaw.map((entry) => parseNumber(entry));
  if (rgb.some((entry) => !Number.isFinite(entry))) {
    return null;
  }

  const longSide = parseNumber(raw.longSide);
  if (!Number.isFinite(longSide)) {
    return null;
  }
  const colorV1 = parsePhotoGraphColorFeatureV1(raw.colorV1);
  if (!colorV1) {
    return null;
  }

  const rgbTuple = [
    clamp(rgb[0], 0, 255),
    clamp(rgb[1], 0, 255),
    clamp(rgb[2], 0, 255),
  ] as [number, number, number];

  return {
    ...featureFromRgb(rgbTuple, Math.max(1, Math.round(longSide))),
    colorV1,
  };
}

function parseDimensionsPayload(
  value: unknown,
): ParsedUploadRegistration["dimensions"] | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = value as Record<string, unknown>;
  const width = parseNumber(raw.width);
  const height = parseNumber(raw.height);

  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    return null;
  }

  if (width <= 0 || height <= 0) {
    return null;
  }

  const normalizedWidth = Math.max(1, Math.round(width));
  const normalizedHeight = Math.max(1, Math.round(height));
  const aspectRatio = normalizedWidth / normalizedHeight;

  if (!Number.isFinite(aspectRatio) || aspectRatio <= 0) {
    return null;
  }

  return {
    width: normalizedWidth,
    height: normalizedHeight,
    aspectRatio,
  };
}

function normalizeUploads(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }

  const uploads: ParsedUploadRegistration[] = [];

  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      return null;
    }

    const record = entry as Record<string, unknown>;
    const storagePath = String(record.storagePath ?? "").trim();

    if (!storagePath) {
      return null;
    }

    const feature = parseFeaturePayload(record.feature);
    if (!feature) {
      return null;
    }

    const dimensions = parseDimensionsPayload(record.dimensions);
    if (!dimensions) {
      return null;
    }

    uploads.push({
      storagePath,
      feature,
      dimensions,
      colour: rgbToHex(feature.rgb),
    });
  }

  return uploads;
}

function isAuthorized(request: NextRequest) {
  const token = request.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value;
  return isValidAdminSessionToken(token);
}

function nextNodeId(nodes: GraphNode[]) {
  const maxExistingId = nodes.reduce((currentMax, node) => {
    const parsed = Number(node.id);
    if (!Number.isFinite(parsed)) {
      return currentMax;
    }

    return Math.max(currentMax, parsed);
  }, 0);

  return maxExistingId + 1;
}

function neighborSignature(neighbors: RankedPhotoGraphNeighbor[]) {
  return [...neighbors]
    .sort((left, right) => left.rank - right.rank)
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
  const addedIdSet = new Set(addedIds);
  const previousBySource = Map.groupBy(previous, (neighbor) => neighbor.sourceId);
  const nextBySource = Map.groupBy(next, (neighbor) => neighbor.sourceId);
  const sourceIds = new Set([
    ...previousBySource.keys(),
    ...nextBySource.keys(),
    ...addedIds,
  ]);
  return [...sourceIds].filter(
    (sourceId) =>
      addedIdSet.has(sourceId) ||
      neighborSignature(previousBySource.get(sourceId) ?? []) !==
        neighborSignature(nextBySource.get(sourceId) ?? []),
  );
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: UploadRegistrationPayload;

  try {
    payload = (await request.json()) as UploadRegistrationPayload;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload." },
      { status: 400 },
    );
  }

  const uploads = normalizeUploads(payload.uploads);

  if (!uploads) {
    return NextResponse.json(
      { error: "Invalid or missing upload metadata." },
      { status: 400 },
    );
  }

  const loaded = await loadGraphWithFallback();
  if (!loaded.databaseAvailable) {
    return NextResponse.json(
      {
        error:
          "Photo graph persistence is unavailable. Restore Supabase connectivity before uploading new photos.",
      },
      { status: 503 },
    );
  }

  const edgeGenerationConfig = await loadPhotoGraphEdgeGenerationConfig();
  const model = PHOTO_GRAPH_SIMILARITY_MODELS.find(
    (entry) => entry.id === edgeGenerationConfig.model,
  );
  const missingColorFeatures = model?.requiresColorV1
    ? loaded.nodes.filter((node) => !node.feature?.colorV1).map((node) => node.id)
    : [];
  if (missingColorFeatures.length > 0) {
    return NextResponse.json(
      {
        error: `The active ${edgeGenerationConfig.model} model requires versioned color features. Apply the schema migration and backfill before uploading (${missingColorFeatures.length} existing node(s) missing).`,
      },
      { status: 409 },
    );
  }

  const existingNodes = cloneGraphNodes(loaded.nodes);
  const nodes = [...existingNodes];

  const existingMaxLongSide = ensureProcessingFeatures(nodes);
  ensureGraphStoragePaths(nodes);

  const createdIds: string[] = [];
  const createdNodes: GraphNode[] = [];
  const databaseReservedIds =
    loaded.source === "database"
      ? await reservePhotoGraphNodeIds(uploads.length)
      : null;
  let staticIdCounter = nextNodeId(nodes);
  const bucket = getPhotoGraphStorageBucket();
  const supabase = getServiceRoleSupabase();

  for (const [uploadIndex, upload] of uploads.entries()) {
    const id = databaseReservedIds?.[uploadIndex] ?? String(staticIdCounter);
    staticIdCounter += 1;
    createdIds.push(id);
    const canonicalStoragePath = buildCanonicalPhotoGraphStoragePath(
      id,
      upload.storagePath,
    );

    if (upload.storagePath !== canonicalStoragePath) {
      const { error } = await supabase.storage
        .from(bucket)
        .move(upload.storagePath, canonicalStoragePath);

      if (error) {
        return NextResponse.json(
          {
            error: `Failed to finalize uploaded asset ${upload.storagePath}: ${error.message}`,
          },
          { status: 500 },
        );
      }
    }

    createdNodes.push({
      id,
      scale: 1,
      colour: upload.colour,
      correlations: {},
      storagePath: canonicalStoragePath,
      feature: upload.feature,
      dimensions: upload.dimensions,
    });
  }

  nodes.push(...createdNodes);

  const newMaxLongSide = Math.max(
    existingMaxLongSide,
    ...createdNodes.map((node) => node.feature?.longSide ?? 1),
  );

  if (newMaxLongSide > existingMaxLongSide) {
    for (const node of nodes) {
      if (!node.feature) continue;
      node.scale = scaleFromLongSide(node.feature.longSide, newMaxLongSide);
    }
  } else {
    for (const node of createdNodes) {
      if (!node.feature) continue;
      node.scale = scaleFromLongSide(
        node.feature.longSide,
        existingMaxLongSide,
      );
    }
  }

  let generatedNodes: GraphNode[];
  let edgeCount: number;

  if (loaded.source === "static") {
    const generated = generateSparsePhotoGraph(
      cloneGraphNodes(nodes),
      edgeGenerationConfig,
    );
    generatedNodes = generated.nodes;
    await writeRuntimeGraph(generatedNodes);
    await savePhotoGraphEdgeGenerationConfig(edgeGenerationConfig);
    edgeCount = countGraphEdges(generatedNodes);
  } else {
    await upsertPhotoGraphNodes(nodes);
    const existingNeighbors = await loadPhotoGraphNeighbors(
      edgeGenerationConfig.model,
    );
    const hasDirectedSnapshot =
      existingNeighbors.length > 0 || existingNodes.length <= 1;
    const generated = hasDirectedSnapshot
      ? updateSparsePhotoGraphForAddedNodes(
          existingNodes,
          createdNodes,
          existingNeighbors,
          edgeGenerationConfig,
        )
      : generateSparsePhotoGraph(
          cloneGraphNodes(nodes),
          edgeGenerationConfig,
        );
    generatedNodes = generated.nodes;
    const sourceIds = hasDirectedSnapshot
      ? changedNeighborSourceIds(
          existingNeighbors,
          generated.neighbors,
          createdIds,
        )
      : generatedNodes.map((node) => node.id);
    edgeCount = await replacePhotoGraphNeighborSnapshot(
      sourceIds,
      generated.neighbors,
      edgeGenerationConfig,
    );
  }

  return NextResponse.json({
    ok: true,
    createdIds,
    source: loaded.source,
    nodeCount: nodes.length,
    edgeCount,
    edgeGenerationConfig,
  });
}
