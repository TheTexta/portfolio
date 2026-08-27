import { NextRequest, NextResponse } from "next/server";

import {
  loadPhotoGraphEdgeGenerationConfig,
  replacePhotoGraphNeighborSnapshot,
  savePhotoGraphEdgeGenerationConfig,
} from "@/lib/photo-graph/database";
import {
  countGraphEdges,
} from "@/lib/photo-graph/edge-generation";
import {
  generateSparsePhotoGraph,
  parseSparseEdgeGenerationConfig,
} from "@/lib/photo-graph/sparse-edge-generation";
import {
  cloneGraphNodes,
  loadGraphWithFallback,
  writeRuntimeGraph,
} from "@/lib/photo-graph/graph-store";
import type { PhotoGraphEdgeGenerationConfig } from "@/lib/photo-graph/types";
import { PHOTO_GRAPH_SIMILARITY_MODELS } from "@/lib/photo-graph/similarity-models";
import {
  ADMIN_SESSION_COOKIE_NAME,
  isValidAdminSessionToken,
} from "@/lib/server/admin-session";

type SaveEdgeDefaultsPayload = {
  config?: unknown;
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest) {
  const token = request.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value;
  return isValidAdminSessionToken(token);
}

function parseEdgeGenerationConfig(
  value: unknown,
): PhotoGraphEdgeGenerationConfig | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  return parseSparseEdgeGenerationConfig(value);
}

function isMissingNeighborPersistence(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message.includes("replace_photo_graph_neighbor_snapshot") &&
    (error.message.includes("schema cache") ||
      error.message.includes("photo_graph_neighbors"))
  );
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = await loadPhotoGraphEdgeGenerationConfig();
  return NextResponse.json({ config });
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: SaveEdgeDefaultsPayload;

  try {
    payload = (await request.json()) as SaveEdgeDefaultsPayload;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload." },
      { status: 400 },
    );
  }

  const config = parseEdgeGenerationConfig(payload.config);
  if (!config) {
    return NextResponse.json(
      { error: "Invalid photo graph edge generation config." },
      { status: 400 },
    );
  }

  const loaded = await loadGraphWithFallback();
  if (!loaded.databaseAvailable) {
    return NextResponse.json(
      {
        error:
          "Photo graph persistence is unavailable. Restore Supabase connectivity before saving model defaults.",
      },
      { status: 503 },
    );
  }

  const model = PHOTO_GRAPH_SIMILARITY_MODELS.find(
    (entry) => entry.id === config.model,
  );
  const missingColorFeatures = model?.requiresColorV1
    ? loaded.nodes.filter((node) => !node.feature?.colorV1).map((node) => node.id)
    : [];
  if (missingColorFeatures.length > 0) {
    return NextResponse.json(
      {
        error: `Model ${config.model} requires versioned color features. Apply the schema migration and backfill before activation (${missingColorFeatures.length} node(s) missing).`,
      },
      { status: 409 },
    );
  }

  const { nodes, neighbors } = generateSparsePhotoGraph(
    cloneGraphNodes(loaded.nodes),
    config,
  );
  let edgeCount: number;

  if (loaded.source === "static") {
    await writeRuntimeGraph(nodes);
    await savePhotoGraphEdgeGenerationConfig(config);
    edgeCount = countGraphEdges(nodes);
  } else {
    try {
      edgeCount = await replacePhotoGraphNeighborSnapshot(
        nodes.map((node) => node.id),
        neighbors,
        config,
      );
    } catch (error) {
      if (isMissingNeighborPersistence(error)) {
        return NextResponse.json(
          {
            error:
              "Photo graph neighbor persistence is not installed. Apply supabase/photo-graph-schema.sql from a host that can reach the Supabase database, then retry.",
          },
          { status: 503 },
        );
      }

      throw error;
    }
  }

  return NextResponse.json({
    ok: true,
    source: loaded.source,
    config,
    edgeCount,
  });
}
