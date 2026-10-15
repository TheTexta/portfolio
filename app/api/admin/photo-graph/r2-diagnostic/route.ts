import { NextResponse } from "next/server";

import { getAdminUser } from "@/lib/server/admin-auth";
import { diagnosePhotoGraphR2Access } from "@/lib/server/photo-graph-r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  if (!(await getAdminUser())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await diagnosePhotoGraphR2Access();
    return NextResponse.json(result, {
      status: result.ok ? 200 : 503,
      headers: { "cache-control": "private, no-store" },
    });
  } catch {
    return NextResponse.json(
      { ok: false, stage: "configuration", upstreamStatus: null },
      { status: 503, headers: { "cache-control": "private, no-store" } },
    );
  }
}
