import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { buildPendingPhotoGraphStoragePath } from "@/lib/photo-graph/config";
import {
  ADMIN_SESSION_COOKIE_NAME,
  isValidAdminSessionToken,
} from "@/lib/server/admin-session";
import { getServiceRoleSupabase } from "@/lib/server/supabase";
import { getPhotoGraphStorageBucket } from "@/lib/supabase/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SIGNED_URL_TTL_SECONDS = 2 * 60 * 60;
const ALLOWED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

type UploadUrlRequest = {
  filename?: string;
  contentType?: string;
};

function isAuthorized(request: NextRequest) {
  const token = request.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value;
  return isValidAdminSessionToken(token);
}

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
  if (!isAuthorized(request)) {
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

  const contentType = String(body.contentType ?? "").toLowerCase();

  if (!ALLOWED_MIME_TYPES.has(contentType)) {
    return NextResponse.json(
      { error: `Unsupported content type: ${contentType || "unknown"}` },
      { status: 400 },
    );
  }

  const extension = extensionForUpload(body.filename, contentType);
  const objectPath = buildPendingPhotoGraphStoragePath(
    randomUUID(),
    extension,
  );
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
