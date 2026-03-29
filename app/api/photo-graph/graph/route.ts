import { NextResponse } from "next/server";

import { loadPhotoGraphRuntimeControls } from "@/lib/photo-graph/database";
import { buildPhotoGraphPayload } from "@/lib/photo-graph/force-graph";
import { loadGraphWithFallback } from "@/lib/photo-graph/graph-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const [{ nodes }, defaultGraphControls] = await Promise.all([
    loadGraphWithFallback(),
    loadPhotoGraphRuntimeControls(),
  ]);

  return NextResponse.json(
    {
      ...buildPhotoGraphPayload(nodes),
      defaultGraphControls,
    },
    {
      headers: {
        "cache-control": "no-store",
      },
    },
  );
}
