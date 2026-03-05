import { randomUUID } from "node:crypto";
import path from "node:path";

import { NextRequest, NextResponse } from "next/server";

import { photoGraphImageBasePath } from "@/lib/photo-graph/graph-store";
import { getFirebaseAdminBucket } from "@/lib/server/firebase-admin";
import {
  ADMIN_SESSION_COOKIE_NAME,
  isValidAdminSessionToken,
} from "@/lib/server/admin-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SIGNED_URL_TTL_MS = 15 * 60 * 1000;
const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

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

  const extension = filename
    ? path.extname(filename).replace(".", "").toLowerCase()
    : "";

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
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const contentType = String(body.contentType ?? "").toLowerCase();

  if (!ALLOWED_MIME_TYPES.has(contentType)) {
    return NextResponse.json(
      { error: `Unsupported content type: ${contentType || "unknown"}` },
      { status: 400 },
    );
  }

  const extension = extensionForUpload(body.filename, contentType);
  const objectPath = `${photoGraphImageBasePath().replace(/\/$/, "")}/${randomUUID()}.${extension}`;

  const file = getFirebaseAdminBucket().file(objectPath);

  const [uploadUrl] = await file.getSignedUrl({
    version: "v4",
    action: "write",
    expires: Date.now() + SIGNED_URL_TTL_MS,
    contentType,
  });

  return NextResponse.json({
    ok: true,
    objectPath,
    uploadUrl,
    requiredHeaders: {
      "content-type": contentType,
    },
    expiresInSeconds: Math.floor(SIGNED_URL_TTL_MS / 1000),
  });
}
