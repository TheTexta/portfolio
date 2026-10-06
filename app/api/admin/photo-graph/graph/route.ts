import { NextResponse } from "next/server";

import {
  loadPhotoGraphEdgeGenerationConfig,
  loadPhotoGraphRuntimeControls,
} from "@/lib/photo-graph/database";
import { loadGraphWithFallback } from "@/lib/photo-graph/graph-store";
import { getAdminUser } from "@/lib/server/admin-auth";
import { buildSupabaseStorageRenderUrl } from "@/lib/supabase/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADMIN_PREVIEW_WIDTH = 96;
const ADMIN_PREVIEW_QUALITY = 75;

function buildAdminPreviewUrl(storagePath?: string, url?: string) {
  if (!storagePath) {
    return url;
  }

  try {
    return buildSupabaseStorageRenderUrl(storagePath, {
      width: ADMIN_PREVIEW_WIDTH,
      quality: ADMIN_PREVIEW_QUALITY,
    });
  } catch {
    return url;
  }
}

export async function GET() {
  if (!(await getAdminUser())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [
    { nodes, source, databaseAvailable },
    defaultEdgeGeneration,
    defaultGraphControls,
  ] = await Promise.all([
    loadGraphWithFallback(),
    loadPhotoGraphEdgeGenerationConfig(),
    loadPhotoGraphRuntimeControls(),
  ]);
  const nodesWithPreview = nodes.map((node) => ({
    ...node,
    previewUrl: buildAdminPreviewUrl(node.storagePath, node.url),
  }));

  return NextResponse.json(
    {
      source,
      nodes: nodesWithPreview,
      writesEnabled: databaseAvailable,
      defaultEdgeGeneration,
      defaultGraphControls,
    },
    {
      headers: {
        "cache-control": "no-store",
      },
    },
  );
}
