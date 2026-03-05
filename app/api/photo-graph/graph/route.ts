import { NextResponse } from "next/server";

import {
  loadGraphWithFallback,
  toPublicGraphNodes,
} from "@/lib/photo-graph/graph-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { nodes } = await loadGraphWithFallback();

  return NextResponse.json(toPublicGraphNodes(nodes), {
    headers: {
      "cache-control": "no-store",
    },
  });
}
