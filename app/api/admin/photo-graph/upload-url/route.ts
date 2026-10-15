import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import {
  assertPhotoGraphR2ImageBasePath,
  buildPendingPhotoGraphStoragePath,
  isPendingPhotoGraphStoragePath,
} from "@/lib/photo-graph/config";
import {
  isPhotoGraphR2StagingKey,
  PHOTO_GRAPH_R2_MAX_UPLOAD_BYTES,
  PHOTO_GRAPH_R2_STAGING_BUCKET,
  photoGraphR2StagingKey,
  photoGraphWriteProvider,
} from "@/lib/photo-graph/r2-paths";
import { getAdminUser } from "@/lib/server/admin-auth";
import { signPhotoGraphR2Upload } from "@/lib/server/photo-graph-r2";
import { getServiceRoleSupabase } from "@/lib/server/supabase";
import { getPhotoGraphStorageBucket } from "@/lib/supabase/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SIGNED_URL_TTL_SECONDS = 2 * 60 * 60;
const ALLOWED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

type UploadUrlRequest = {
  filename?: string;
  contentType?: string;
  storagePath?: string;
  size?: number;
  sha256?: string;
};

function extensionForUpload(filename: string | undefined, contentType: string) {
  if (contentType === "image/png") return "png";
  if (contentType === "image/jpeg") return "jpg";
  if (contentType === "image/webp") return "webp";

  const extension = filename?.split(".").pop()?.toLowerCase() ?? "";

  if (!extension) return "png";
  if (extension === "jpeg") return "jpg";
  return extension;
}

export async function POST(request: NextRequest) {
  if (!(await getAdminUser())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: UploadUrlRequest;

  try {
    body = (await request.json()) as UploadUrlRequest;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload." },
      { status: 400 },
    );
  }

  const contentType = String(body?.contentType ?? "").toLowerCase();

  if (!ALLOWED_MIME_TYPES.has(contentType)) {
    return NextResponse.json(
      { error: `Unsupported content type: ${contentType || "unknown"}` },
      { status: 400 },
    );
  }

  const extension = extensionForUpload(body.filename, contentType);
  let provider: "supabase" | "r2";
  try {
    // An in-flight batch keeps its original provider across deploys/rollback.
    if (body.storagePath !== undefined) {
      if (typeof body.storagePath !== "string") {
        return NextResponse.json(
          { error: "Invalid pending upload path." },
          { status: 400 },
        );
      }
      if (isPendingPhotoGraphStoragePath(body.storagePath))
        provider = "supabase";
      else if (isPhotoGraphR2StagingKey(body.storagePath)) provider = "r2";
      else
        return NextResponse.json(
          { error: "Invalid pending upload path." },
          { status: 400 },
        );
    } else {
      provider = photoGraphWriteProvider();
    }
  } catch {
    return NextResponse.json(
      { error: "Photo Graph upload provider is not configured." },
      { status: 503 },
    );
  }

  if (provider === "r2") {
    const sha256 =
      typeof body.sha256 === "string" ? body.sha256.toLowerCase() : "";
    if (
      !Number.isSafeInteger(body.size) ||
      !body.size ||
      body.size < 1 ||
      body.size > PHOTO_GRAPH_R2_MAX_UPLOAD_BYTES ||
      !/^[a-f0-9]{64}$/.test(sha256) ||
      (body.storagePath !== undefined &&
        (!isPhotoGraphR2StagingKey(body.storagePath) ||
          !body.storagePath.endsWith(`.${extension}`)))
    ) {
      return NextResponse.json(
        { error: "Invalid R2 upload metadata." },
        { status: 400 },
      );
    }
    const objectPath =
      body.storagePath ?? photoGraphR2StagingKey(randomUUID(), contentType);
    try {
      // New uploads are unsafe until the additive provider schema is live.
      assertPhotoGraphR2ImageBasePath();
      const { error: schemaError } = await getServiceRoleSupabase()
        .from("photo_graph_nodes")
        .select("storage_provider")
        .limit(1);
      if (schemaError)
        throw new Error("Photo Graph R2 database schema is unavailable.");
      const signed = await signPhotoGraphR2Upload({
        key: objectPath,
        contentType,
        size: body.size,
        sha256,
      });
      return NextResponse.json({
        ok: true,
        storageProvider: "r2",
        bucket: PHOTO_GRAPH_R2_STAGING_BUCKET,
        objectPath,
        ...signed,
      });
    } catch {
      return NextResponse.json(
        { error: "R2 upload signing is unavailable." },
        { status: 503 },
      );
    }
  }

  if (
    body.storagePath !== undefined &&
    (typeof body.storagePath !== "string" ||
      !isPendingPhotoGraphStoragePath(body.storagePath) ||
      !body.storagePath.endsWith(`.${extension}`))
  ) {
    return NextResponse.json(
      { error: "Invalid pending upload path." },
      { status: 400 },
    );
  }
  const objectPath =
    body.storagePath ??
    buildPendingPhotoGraphStoragePath(randomUUID(), extension);
  const bucket = getPhotoGraphStorageBucket();
  const supabase = getServiceRoleSupabase();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUploadUrl(objectPath, {
      upsert: false,
    });

  if (error || !data) {
    return NextResponse.json(
      {
        error: error?.message ?? "Failed to create signed upload URL.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    bucket,
    objectPath,
    token: data.token,
    signedUrl: data.signedUrl,
    expiresInSeconds: SIGNED_URL_TTL_SECONDS,
  });
}
