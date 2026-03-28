import { NextResponse } from "next/server";

import { buildPhotoGraphPayload } from "@/lib/photo-graph/force-graph";
import { loadGraphWithFallback } from "@/lib/photo-graph/graph-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { nodes } = await loadGraphWithFallback();

  return NextResponse.json(buildPhotoGraphPayload(nodes), {
    headers: {
      "cache-control": "no-store",
    },
  });
}
