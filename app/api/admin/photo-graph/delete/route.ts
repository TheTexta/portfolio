import { NextRequest, NextResponse } from "next/server";

import { scaleFromLongSide } from "@/lib/photo-graph/correlation";
import {
  cloneGraphNodes,
  ensureProcessingFeatures,
  loadGraphWithFallback,
  writeRuntimeGraph,
} from "@/lib/photo-graph/graph-store";
import {
  deletePhotoGraphNodeRecord,
  upsertPhotoGraphNodes,
} from "@/lib/photo-graph/database";
import {
  ADMIN_SESSION_COOKIE_NAME,
  isValidAdminSessionToken,
} from "@/lib/server/admin-session";
import { getServiceRoleSupabase } from "@/lib/server/supabase";
import { getPhotoGraphStorageBucket } from "@/lib/supabase/config";

type DeletePhotoPayload = {
  nodeId?: string;
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest) {
  const token = request.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value;
  return isValidAdminSessionToken(token);
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: DeletePhotoPayload;

  try {
    payload = (await request.json()) as DeletePhotoPayload;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload." },
      { status: 400 },
    );
  }

  const nodeId = String(payload.nodeId ?? "").trim();

  if (!nodeId) {
    return NextResponse.json({ error: "nodeId is required." }, { status: 400 });
  }

  const loaded = await loadGraphWithFallback();
  if (!loaded.databaseAvailable) {
    return NextResponse.json(
      {
        error:
          "Photo graph persistence is unavailable. Restore Supabase connectivity before deleting photos.",
      },
      { status: 503 },
    );
  }

  const nodes = cloneGraphNodes(loaded.nodes);

  const targetIndex = nodes.findIndex((node) => node.id === nodeId);

  if (targetIndex < 0) {
    return NextResponse.json({ error: "Node not found." }, { status: 404 });
  }

  const [deletedNode] = nodes.splice(targetIndex, 1);

  for (const node of nodes) {
    delete node.correlations[nodeId];
  }

  ensureProcessingFeatures(nodes);

  if (nodes.length > 0) {
    const maxLongSide = Math.max(
      ...nodes.map((node) => node.feature?.longSide ?? 1),
    );

    for (const node of nodes) {
      if (!node.feature) continue;
      node.scale = scaleFromLongSide(node.feature.longSide, maxLongSide);
    }
  }

  if (loaded.source === "static") {
    await writeRuntimeGraph(nodes);
  } else {
    await deletePhotoGraphNodeRecord(nodeId);
    await upsertPhotoGraphNodes(nodes);
  }

  if (deletedNode.storagePath) {
    try {
      const supabase = getServiceRoleSupabase();
      await supabase.storage
        .from(getPhotoGraphStorageBucket())
        .remove([deletedNode.storagePath]);
    } catch {
      // Ignore storage deletion failures so metadata deletion still succeeds.
    }
  }

  return NextResponse.json({
    ok: true,
    deletedId: nodeId,
    nodeCount: nodes.length,
    source: loaded.source,
  });
}
