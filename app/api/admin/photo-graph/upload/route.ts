import { NextRequest, NextResponse } from "next/server";

import { buildCanonicalPhotoGraphStoragePath } from "@/lib/photo-graph/config";
import { scaleFromLongSide } from "@/lib/photo-graph/correlation";
import {
  cloneGraphNodes,
  ensureGraphStoragePaths,
  ensureProcessingFeatures,
  loadGraphWithFallback,
  writeRuntimeGraph,
} from "@/lib/photo-graph/graph-store";
import { upsertPhotoGraphNodes } from "@/lib/photo-graph/database";
import { featureFromRgb, rgbToHex } from "@/lib/photo-graph/feature-extraction";
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

  const rgbTuple = [
    clamp(rgb[0], 0, 255),
    clamp(rgb[1], 0, 255),
    clamp(rgb[2], 0, 255),
  ] as [number, number, number];

  return featureFromRgb(rgbTuple, Math.max(1, Math.round(longSide)));
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
  const nodes = cloneGraphNodes(loaded.nodes);

  const existingMaxLongSide = ensureProcessingFeatures(nodes);
  ensureGraphStoragePaths(nodes);

  const createdIds: string[] = [];
  const createdNodes: GraphNode[] = [];
  let idCounter = nextNodeId(nodes);
  const bucket = getPhotoGraphStorageBucket();
  const supabase = getServiceRoleSupabase();

  for (const upload of uploads) {
    const id = String(idCounter);
    idCounter += 1;
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

  if (loaded.source === "static") {
    await writeRuntimeGraph(nodes);
  } else {
    await upsertPhotoGraphNodes(nodes);
  }

  return NextResponse.json({
    ok: true,
    createdIds,
    source: loaded.source,
    nodeCount: nodes.length,
  });
}
