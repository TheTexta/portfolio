import { NextRequest, NextResponse } from "next/server";

import { MIN_CORRELATION } from "@/lib/photo-graph/correlation";
import {
  cloneGraphNodes,
  loadGraphWithFallback,
  writeRuntimeGraph,
} from "@/lib/photo-graph/graph-store";
import {
  ADMIN_SESSION_COOKIE_NAME,
  isValidAdminSessionToken,
} from "@/lib/server/admin-session";

type CorrelationUpdate = {
  leftId: string;
  rightId: string;
  correlation: number | null;
};

type ApplyCorrelationsPayload = {
  updates?: CorrelationUpdate[];
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest) {
  const token = request.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value;
  return isValidAdminSessionToken(token);
}

function normalizeCorrelation(value: unknown) {
  if (value === null) {
    return null;
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return Math.max(0, Math.min(1, value));
}

function normalizeUpdates(value: unknown) {
  if (!Array.isArray(value)) {
    return null;
  }

  const updates: CorrelationUpdate[] = [];

  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      return null;
    }

    const record = entry as Record<string, unknown>;
    const leftId = String(record.leftId ?? "").trim();
    const rightId = String(record.rightId ?? "").trim();

    if (!leftId || !rightId || leftId === rightId) {
      return null;
    }

    updates.push({
      leftId,
      rightId,
      correlation: normalizeCorrelation(record.correlation),
    });
  }

  return updates;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: ApplyCorrelationsPayload;

  try {
    payload = (await request.json()) as ApplyCorrelationsPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const updates = normalizeUpdates(payload.updates);

  if (!updates || updates.length === 0) {
    return NextResponse.json({ error: "No correlation updates provided." }, { status: 400 });
  }

  if (updates.length > 5000) {
    return NextResponse.json(
      { error: "Too many updates in one request. Max is 5000." },
      { status: 400 },
    );
  }

  const loaded = await loadGraphWithFallback();
  const nodes = cloneGraphNodes(loaded.nodes);
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const touchedNodeIds = new Set<string>();
  let appliedCount = 0;

  for (const update of updates) {
    const left = nodeById.get(update.leftId);
    const right = nodeById.get(update.rightId);

    if (!left || !right) {
      continue;
    }

    if (typeof update.correlation === "number" && update.correlation >= MIN_CORRELATION) {
      left.correlations[right.id] = update.correlation;
      right.correlations[left.id] = update.correlation;
    } else {
      delete left.correlations[right.id];
      delete right.correlations[left.id];
    }

    touchedNodeIds.add(left.id);
    touchedNodeIds.add(right.id);
    appliedCount += 1;
  }

  if (appliedCount > 0) {
    await writeRuntimeGraph(nodes);
  }

  return NextResponse.json({
    ok: true,
    appliedCount,
    touchedNodeCount: touchedNodeIds.size,
    source: loaded.source,
  });
}
