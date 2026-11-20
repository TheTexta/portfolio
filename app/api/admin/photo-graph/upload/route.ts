import { NextRequest, NextResponse } from "next/server";

import { isPendingPhotoGraphStoragePath } from "@/lib/photo-graph/config";
import {
  isPhotoGraphR2StagingKey,
  PHOTO_GRAPH_R2_MAX_UPLOAD_BYTES,
  photoGraphR2Extension,
} from "@/lib/photo-graph/r2-paths";
import { featureFromRgb, rgbToHex } from "@/lib/photo-graph/feature-extraction";
import { parsePhotoGraphColorFeatureV1 } from "@/lib/photo-graph/color-features";
import { getAdminUser } from "@/lib/server/admin-auth";
import { registerPhotoGraphUpload } from "@/lib/server/photo-graph-register-upload";
import type { ParsedUploadRegistration } from "@/lib/photo-graph/upload-plan";
import type {
  GraphFeature,
  GraphImageDimensions,
} from "@/lib/photo-graph/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UploadRegistration = {
  storagePath?: string;
  storageProvider?: "r2";
  sourceSha256?: string;
  sourceSize?: number;
  contentType?: string;
  feature?: GraphFeature;
  dimensions?: GraphImageDimensions;
  colour?: string;
};

type UploadRegistrationPayload = {
  uploadId?: string;
  uploads?: UploadRegistration[];
};

type ParsedUploadBase = {
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

    const isR2 = record.storageProvider === "r2";
    if (
      isR2
        ? !isPhotoGraphR2StagingKey(storagePath) ||
          !Number.isSafeInteger(record.sourceSize) ||
          typeof record.sourceSize !== "number" ||
          record.sourceSize < 1 ||
          record.sourceSize > PHOTO_GRAPH_R2_MAX_UPLOAD_BYTES ||
          typeof record.sourceSha256 !== "string" ||
          !/^[a-f0-9]{64}$/.test(record.sourceSha256) ||
          typeof record.contentType !== "string"
        : record.storageProvider !== undefined ||
          !isPendingPhotoGraphStoragePath(storagePath)
    )
      return null;
    if (isR2) {
      try {
        if (
          !storagePath.endsWith(
            `.${photoGraphR2Extension(record.contentType as string)}`,
          )
        )
          return null;
      } catch {
        return null;
      }
    }

    const feature = parseFeaturePayload(record.feature);
    if (!feature) {
      return null;
    }

    const dimensions = parseDimensionsPayload(record.dimensions);
    if (!dimensions) {
      return null;
    }

    const parsed: ParsedUploadBase = {
      storagePath,
      feature,
      dimensions,
      colour: rgbToHex(feature.rgb),
    };
    if (isR2) {
      uploads.push({
        ...parsed,
        storageProvider: "r2",
        sourceSha256: record.sourceSha256 as string,
        sourceSize: record.sourceSize as number,
        contentType: record.contentType as string,
      });
    } else uploads.push(parsed);
  }

  return new Set(uploads.map((upload) => upload.storagePath)).size ===
    uploads.length
    ? uploads
    : null;
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
    const result = await registerPhotoGraphUpload(
      payload.uploadId,
      admin.id,
      uploads,
    );
    if (result.kind === "registered") return NextResponse.json(result.result);
    return NextResponse.json(
      { error: result.error },
      { status: result.kind === "unavailable" ? 503 : 409 },
    );
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
