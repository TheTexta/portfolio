import { NextRequest, NextResponse } from "next/server";

import { loadGraphWithFallback } from "@/lib/photo-graph/graph-store";
import {
  ADMIN_SESSION_COOKIE_NAME,
  isValidAdminSessionToken,
} from "@/lib/server/admin-session";
import { buildSupabaseStorageRenderUrl } from "@/lib/supabase/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADMIN_PREVIEW_WIDTH = 96;
const ADMIN_PREVIEW_QUALITY = 75;

function isAuthorized(request: NextRequest) {
  const token = request.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value;
  return isValidAdminSessionToken(token);
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { nodes, source } = await loadGraphWithFallback();
  const nodesWithPreview = nodes.map((node) => ({
    ...node,
    previewUrl: node.storagePath
      ? buildSupabaseStorageRenderUrl(node.storagePath, {
          width: ADMIN_PREVIEW_WIDTH,
          quality: ADMIN_PREVIEW_QUALITY,
        })
      : node.url,
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
