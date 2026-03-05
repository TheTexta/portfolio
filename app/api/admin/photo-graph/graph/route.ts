import { NextRequest, NextResponse } from "next/server";

import { loadGraphWithFallback } from "@/lib/photo-graph/graph-store";
import { getFirebaseAdminBucket } from "@/lib/server/firebase-admin";
import {
  ADMIN_SESSION_COOKIE_NAME,
  isValidAdminSessionToken,
} from "@/lib/server/admin-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const PREVIEW_URL_TTL_MS = 60 * 60 * 1000;

function isAuthorized(request: NextRequest) {
  const token = request.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value;
  return isValidAdminSessionToken(token);
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { nodes, source } = await loadGraphWithFallback();
  const bucket = getFirebaseAdminBucket();

  const nodesWithPreview = await Promise.all(
    nodes.map(async (node) => {
      if (!node.storagePath) {
        return {
          ...node,
          previewUrl: node.url,
        };
      }

      try {
        const [previewUrl] = await bucket.file(node.storagePath).getSignedUrl({
          version: "v4",
          action: "read",
          expires: Date.now() + PREVIEW_URL_TTL_MS,
        });

        return {
          ...node,
          previewUrl,
        };
      } catch {
        return {
          ...node,
          previewUrl: node.url,
        };
      }
    }),
  );

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
