import { NextRequest, NextResponse } from "next/server";

import { loadGraphWithFallback } from "@/lib/photo-graph/graph-store";
import {
  ADMIN_SESSION_COOKIE_NAME,
  isValidAdminSessionToken,
} from "@/lib/server/admin-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bucketNameForPublicUrls() {
  const explicitBucket = process.env.FIREBASE_STORAGE_BUCKET;
  if (explicitBucket) {
    return explicitBucket;
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  if (!projectId) {
    return null;
  }

  return `${projectId}.firebasestorage.app`;
}

function toPublicStorageUrl(storagePath: string, bucketName: string) {
  const encodedPath = storagePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `https://storage.googleapis.com/${bucketName}/${encodedPath}`;
}

function isAuthorized(request: NextRequest) {
  const token = request.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value;
  return isValidAdminSessionToken(token);
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { nodes, source } = await loadGraphWithFallback();
  const bucketName = bucketNameForPublicUrls();
  const nodesWithPreview = nodes.map((node) => ({
    ...node,
    previewUrl:
      node.url ??
      (bucketName && node.storagePath
        ? toPublicStorageUrl(node.storagePath, bucketName)
        : undefined),
  }));

  return NextResponse.json(
    {
      source,
      nodes: nodesWithPreview,
    },
    {
      headers: {
        "cache-control": "no-store",
      },
    },
  );
}
