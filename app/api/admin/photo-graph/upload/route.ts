import { NextRequest, NextResponse } from "next/server";

import {
  buildCanonicalPhotoGraphStoragePath,
  isPendingPhotoGraphStoragePath,
} from "@/lib/photo-graph/config";
import { scaleFromLongSide } from "@/lib/photo-graph/correlation";
import {
  cloneGraphNodes,
  ensureGraphStoragePaths,
  ensureProcessingFeatures,
  loadGraphWithFallback,
} from "@/lib/photo-graph/graph-store";
import {
  loadPhotoGraphEdgeGenerationConfig,
  loadPhotoGraphNeighbors,
  beginPhotoGraphUpload,
  commitPhotoGraphUpload,
  loadPhotoGraphUploadRevision,
} from "@/lib/photo-graph/database";
import { featureFromRgb, rgbToHex } from "@/lib/photo-graph/feature-extraction";
import { parsePhotoGraphColorFeatureV1 } from "@/lib/photo-graph/color-features";
import {
  generateSparsePhotoGraph,
  updateSparsePhotoGraphForAddedNodes,
  type RankedPhotoGraphNeighbor,
} from "@/lib/photo-graph/sparse-edge-generation";
import { PHOTO_GRAPH_SIMILARITY_MODELS } from "@/lib/photo-graph/similarity-models";
import { getAdminUser } from "@/lib/server/admin-auth";
import { getServiceRoleSupabase } from "@/lib/server/supabase";
import { getPhotoGraphStorageBucket } from "@/lib/supabase/config";
import {
  cleanupPhotoGraphUploadAssets,
  preparePhotoGraphUploadAssets,
} from "@/lib/server/photo-graph-upload-storage";
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
  uploadId?: string;
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
  if (!Array.isArray(value) || value.length === 0 || value.length > 100) {
    return null;
  }

  const uploads: ParsedUploadRegistration[] = [];

  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      return null;
    }

    const record = entry as Record<string, unknown>;
    const storagePath = String(record.storagePath ?? "").trim();

    if (!isPendingPhotoGraphStoragePath(storagePath)) {
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

  return new Set(uploads.map((upload) => upload.storagePath)).size ===
    uploads.length
    ? uploads
    : null;
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
  const previousBySource = Map.groupBy(
    previous,
    (neighbor) => neighbor.sourceId,
  );
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
  const admin = await getAdminUser();
  if (!admin) {
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

  const uploads = normalizeUploads(payload?.uploads);

  if (!uploads) {
    return NextResponse.json(
      { error: "Invalid or missing upload metadata." },
      { status: 400 },
    );
  }

  if (
    typeof payload.uploadId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      payload.uploadId,
    )
  ) {
    return NextResponse.json(
      { error: "A valid uploadId is required for recoverable registration." },
      { status: 400 },
    );
  }

  try {
    return await registerUpload(payload.uploadId, admin.id, uploads);
  } catch (error) {
    console.error("Recoverable Photo Graph upload failed", {
      uploadId: payload.uploadId,
      error,
    });
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Registration failed. Retry with the same upload key.",
        uploadId: payload.uploadId,
      },
      { status: 503 },
    );
  }
}

async function registerUpload(
  uploadId: string,
  adminId: string,
  uploads: ParsedUploadRegistration[],
) {
  // Read before any graph queries so commit detects changes during generation.
  const revision = await loadPhotoGraphUploadRevision();

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

  const reservation = await beginPhotoGraphUpload(
    uploadId,
    adminId,
    uploads,
    nextNodeId(loaded.nodes) - 1,
  );
  const storage = getServiceRoleSupabase().storage.from(
    getPhotoGraphStorageBucket(),
  );
  const pendingPaths = uploads.map((upload) => upload.storagePath);
  if (reservation.result) {
    const warning = await cleanupPhotoGraphUploadAssets(storage, pendingPaths);
    return NextResponse.json({ ...reservation.result, warning });
  }

  const edgeGenerationConfig = await loadPhotoGraphEdgeGenerationConfig();
  const model = PHOTO_GRAPH_SIMILARITY_MODELS.find(
    (entry) => entry.id === edgeGenerationConfig.model,
  );
  const missingColorFeatures = model?.requiresColorV1
    ? loaded.nodes
        .filter((node) => !node.feature?.colorV1)
        .map((node) => node.id)
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
  const assets: { source: string; destination: string }[] = [];

  for (const [uploadIndex, upload] of uploads.entries()) {
    const id = reservation.nodeIds[uploadIndex];
    createdIds.push(id);
    const canonicalStoragePath = buildCanonicalPhotoGraphStoragePath(
      id,
      upload.storagePath,
    );

    assets.push({
      source: upload.storagePath,
      destination: canonicalStoragePath,
    });

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

  await preparePhotoGraphUploadAssets(storage, assets);

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
  let neighbors: RankedPhotoGraphNeighbor[];
  let sourceIds: string[];

  if (loaded.source === "static") {
    const generated = generateSparsePhotoGraph(
      cloneGraphNodes(nodes),
      edgeGenerationConfig,
    );
    generatedNodes = generated.nodes;
    neighbors = generated.neighbors;
    sourceIds = generatedNodes.map((node) => node.id);
  } else {
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
      : generateSparsePhotoGraph(cloneGraphNodes(nodes), edgeGenerationConfig);
    generatedNodes = generated.nodes;
    sourceIds = hasDirectedSnapshot
      ? changedNeighborSourceIds(
          existingNeighbors,
          generated.neighbors,
          createdIds,
        )
      : generatedNodes.map((node) => node.id);
    neighbors = generated.neighbors;
  }

  const result = await commitPhotoGraphUpload(
    uploadId,
    revision,
    generatedNodes,
    sourceIds,
    neighbors,
    edgeGenerationConfig,
    {
      ok: true,
      createdIds,
      nodeCount: nodes.length,
      edgeGenerationConfig,
    },
  );
  const warning = await cleanupPhotoGraphUploadAssets(storage, pendingPaths);
  return NextResponse.json({ ...result, warning });
}
