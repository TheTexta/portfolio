import { NextRequest, NextResponse } from "next/server";

import {
  loadPhotoGraphRuntimeControls,
  savePhotoGraphRuntimeControls,
} from "@/lib/photo-graph/database";
import { parsePhotoGraphRuntimeControls } from "@/lib/photo-graph/graph-controls";
import { loadGraphWithFallback } from "@/lib/photo-graph/graph-store";
import type { PhotoGraphRuntimeControls } from "@/lib/photo-graph/types";
import { getAdminUser } from "@/lib/server/admin-auth";

type SaveGraphDefaultsPayload = {
  controls?: Partial<Record<keyof PhotoGraphRuntimeControls, unknown>>;
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseGraphControls(value: unknown): PhotoGraphRuntimeControls | null {
  return parsePhotoGraphRuntimeControls(value);
}

export async function GET() {
  if (!(await getAdminUser())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const controls = await loadPhotoGraphRuntimeControls();
  return NextResponse.json({ controls });
}

export async function POST(request: NextRequest) {
  if (!(await getAdminUser())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: SaveGraphDefaultsPayload;

  try {
    payload = (await request.json()) as SaveGraphDefaultsPayload;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload." },
      { status: 400 },
    );
  }

  const controls = parseGraphControls(payload.controls);
  if (!controls) {
    return NextResponse.json(
      { error: "Invalid photo graph runtime controls." },
      { status: 400 },
    );
  }

  const loaded = await loadGraphWithFallback();
  if (!loaded.databaseAvailable) {
    return NextResponse.json(
      {
        error:
          "Photo graph persistence is unavailable. Restore Supabase connectivity before saving graph defaults.",
      },
      { status: 503 },
    );
  }

  await savePhotoGraphRuntimeControls(controls);

  return NextResponse.json({
    ok: true,
    controls,
  });
}
