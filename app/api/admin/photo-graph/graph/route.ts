import { NextRequest, NextResponse } from "next/server";

import { loadGraphWithFallback } from "@/lib/photo-graph/graph-store";
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

  const { nodes, source } = await loadGraphWithFallback();

  return NextResponse.json(
    {
      source,
      nodes,
    },
    {
      headers: {
        "cache-control": "no-store",
      },
    },
  );
}
