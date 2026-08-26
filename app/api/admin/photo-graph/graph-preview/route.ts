import { NextRequest, NextResponse } from "next/server";

import { loadPhotoGraphEdgeGenerationConfig } from "@/lib/photo-graph/database";
import {
  countGraphEdges,
} from "@/lib/photo-graph/edge-generation";
import { buildPhotoGraphPayload } from "@/lib/photo-graph/force-graph";
import {
  cloneGraphNodes,
  loadGraphWithFallback,
} from "@/lib/photo-graph/graph-store";
import {
  generateSparsePhotoGraph,
  parseSparseEdgeGenerationConfigFromSearchParams,
} from "@/lib/photo-graph/sparse-edge-generation";
import {
  ADMIN_SESSION_COOKIE_NAME,
  isValidAdminSessionToken,
} from "@/lib/server/admin-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest) {
  const token = request.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value;
  return isValidAdminSessionToken(token);
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const source = request.nextUrl.searchParams.get("source") ?? "generated";
  if (source !== "generated" && source !== "persisted") {
    return NextResponse.json(
      { error: "source must be 'generated' or 'persisted'." },
      { status: 400 },
    );
  }

  const requestedConfig = parseSparseEdgeGenerationConfigFromSearchParams(
    request.nextUrl.searchParams,
  );
  if (
    request.nextUrl.searchParams.has("model") ||
    request.nextUrl.searchParams.has("neighborsPerNode") ||
    request.nextUrl.searchParams.has("maxDistance")
  ) {
    if (!requestedConfig) {
      return NextResponse.json(
        { error: "Invalid sparse edge generation parameters." },
        { status: 400 },
      );
    }
  }

  const [{ nodes }, savedConfig] = await Promise.all([
    loadGraphWithFallback(),
    loadPhotoGraphEdgeGenerationConfig(),
  ]);

  if (source === "persisted") {
    return NextResponse.json(
      {
        ...buildPhotoGraphPayload(nodes),
        generation: {
          source: "persisted",
          config: savedConfig,
          edgeCount: countGraphEdges(nodes),
        },
      },
      {
        headers: {
          "cache-control": "no-store",
        },
      },
    );
  }

  const config = requestedConfig ?? savedConfig;
  const { nodes: generatedNodes } = generateSparsePhotoGraph(
    cloneGraphNodes(nodes),
    config,
  );

  return NextResponse.json(
    {
      ...buildPhotoGraphPayload(generatedNodes),
      generation: {
        source: "generated",
        config,
        edgeCount: countGraphEdges(generatedNodes),
      },
    },
    {
      headers: {
        "cache-control": "no-store",
      },
    },
  );
}
