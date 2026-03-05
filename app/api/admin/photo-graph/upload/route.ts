import { randomUUID } from "node:crypto";
import path from "node:path";

import { NextRequest, NextResponse } from "next/server";

import { scaleFromLongSide } from "@/lib/photo-graph/correlation";
import {
  cloneGraphNodes,
  ensureProcessingFeatures,
  imagePathForLegacyId,
  loadGraphWithFallback,
  photoGraphImageBasePath,
  writeRuntimeGraph,
} from "@/lib/photo-graph/graph-store";
import {
  featureFromRgb,
  rgbToHex,
} from "@/lib/photo-graph/feature-extraction";
import { createPhotoGraphJob } from "@/lib/photo-graph/job-runner";
import { getFirebaseAdminBucket } from "@/lib/server/firebase-admin";
import {
  ADMIN_SESSION_COOKIE_NAME,
  isValidAdminSessionToken,
} from "@/lib/server/admin-session";
import type { GraphFeature, GraphNode } from "@/lib/photo-graph/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

type ParsedUploadFeature = {
  feature: GraphFeature;
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

function parseFeaturePayload(value: unknown): ParsedUploadFeature | null {
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

  return {
    feature: featureFromRgb(rgbTuple, Math.max(1, Math.round(longSide))),
    colour: rgbToHex(rgbTuple),
  };
}

function parseFeatureList(featuresValue: FormDataEntryValue | null, expectedCount: number) {
  if (typeof featuresValue !== "string") {
    return null;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(featuresValue);
  } catch {
    return null;
  }

  if (!Array.isArray(parsed) || parsed.length !== expectedCount) {
    return null;
  }

  const parsedFeatures: ParsedUploadFeature[] = [];

  for (const entry of parsed) {
    const parsedFeature = parseFeaturePayload(entry);
    if (!parsedFeature) {
      return null;
    }

    parsedFeatures.push(parsedFeature);
  }

  return parsedFeatures;
}

function sanitizeFileExtension(file: File) {
  if (file.type === "image/png") return "png";
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/webp") return "webp";

  const extension = path.extname(file.name).replace(".", "").toLowerCase();
  if (!extension) return "png";

  if (extension === "jpeg") return "jpg";
  return extension;
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

  const formData = await request.formData();
  const rawFiles = formData.getAll("files");
  const files = rawFiles.filter((entry): entry is File => entry instanceof File);

  if (!files.length) {
    return NextResponse.json({ error: "No files provided." }, { status: 400 });
  }

  const parsedFeatures = parseFeatureList(formData.get("features"), files.length);
  if (!parsedFeatures) {
    return NextResponse.json(
      { error: "Invalid or missing feature payload." },
      { status: 400 },
    );
  }

  for (const file of files) {
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}` },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        {
          error: `File too large: ${file.name}. Max size is ${Math.floor(
            MAX_FILE_SIZE_BYTES / (1024 * 1024),
          )}MB.`,
        },
        { status: 400 },
      );
    }
  }

  const loaded = await loadGraphWithFallback();
  const nodes = cloneGraphNodes(loaded.nodes);

  const existingMaxLongSide = ensureProcessingFeatures(nodes);
  const imageBasePath = photoGraphImageBasePath().replace(/\/$/, "");

  for (const node of nodes) {
    if (!node.storagePath && !node.url) {
      node.storagePath = imagePathForLegacyId(node.id);
    }
  }

  const bucket = getFirebaseAdminBucket();
  const createdIds: string[] = [];
  const createdNodes: GraphNode[] = [];
  let idCounter = nextNodeId(nodes);

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const featurePayload = parsedFeatures[index];

    const extension = sanitizeFileExtension(file);
    const objectPath = `${imageBasePath}/${randomUUID()}.${extension}`;
    const uploadBuffer = Buffer.from(await file.arrayBuffer());

    await bucket.file(objectPath).save(uploadBuffer, {
      resumable: false,
      metadata: {
        contentType: file.type,
      },
    });

    const id = String(idCounter);
    idCounter += 1;
    createdIds.push(id);

    createdNodes.push({
      id,
      scale: 1,
      colour: featurePayload.colour,
      correlations: {},
      storagePath: objectPath,
      feature: featurePayload.feature,
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
      node.scale = scaleFromLongSide(node.feature.longSide, existingMaxLongSide);
    }
  }

  await writeRuntimeGraph(nodes);
  const jobId = await createPhotoGraphJob(createdIds, nodes.length);

  return NextResponse.json({
    ok: true,
    jobId,
    createdIds,
    source: loaded.source,
    nodeCount: nodes.length,
  });
}
