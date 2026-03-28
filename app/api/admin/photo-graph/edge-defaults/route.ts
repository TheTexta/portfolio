import { NextRequest, NextResponse } from "next/server";

import {
  loadPhotoGraphEdgeGenerationConfig,
  replacePhotoGraphEdges,
  savePhotoGraphEdgeGenerationConfig,
} from "@/lib/photo-graph/database";
import {
  countGraphEdges,
  parseLabEdgeGenerationParams,
  regenerateLabGraphCorrelations,
} from "@/lib/photo-graph/edge-generation";
import {
  cloneGraphNodes,
  loadGraphWithFallback,
  writeRuntimeGraph,
} from "@/lib/photo-graph/graph-store";
import type { PhotoGraphEdgeGenerationConfig } from "@/lib/photo-graph/types";
import {
  ADMIN_SESSION_COOKIE_NAME,
  isValidAdminSessionToken,
} from "@/lib/server/admin-session";

type SaveEdgeDefaultsPayload = {
  config?: {
    mode?: string;
    params?: {
      sigmaE?: unknown;
      minCorrelation?: unknown;
    };
  };
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

  const record = value as NonNullable<SaveEdgeDefaultsPayload["config"]>;
  if (record.mode !== "lab") {
    return null;
  }

  const params = parseLabEdgeGenerationParams(record.params);
  if (!params) {
    return null;
  }

  return {
    mode: "lab",
    params,
  };
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
          "Photo graph persistence is unavailable. Restore Supabase connectivity before saving LAB defaults.",
      },
      { status: 503 },
    );
  }

  const nodes = regenerateLabGraphCorrelations(
    cloneGraphNodes(loaded.nodes),
    config.params,
  );

  if (loaded.source === "static") {
    await writeRuntimeGraph(nodes);
  } else {
    await replacePhotoGraphEdges(nodes);
  }

  await savePhotoGraphEdgeGenerationConfig(config);

  return NextResponse.json({
    ok: true,
    source: loaded.source,
    config,
    edgeCount: countGraphEdges(nodes),
  });
}
