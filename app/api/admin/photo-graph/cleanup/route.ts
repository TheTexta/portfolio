import { NextResponse } from "next/server";

import { getAdminUser } from "@/lib/server/admin-auth";
import { retryPhotoGraphR2CleanupJobs } from "@/lib/server/photo-graph-r2-cleanup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  if (!(await getAdminUser())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await retryPhotoGraphR2CleanupJobs();
    return NextResponse.json(
      { ok: result.failed === 0, ...result },
      {
        headers: { "cache-control": "private, no-store" },
      },
    );
  } catch {
    return NextResponse.json(
      { error: "R2 cleanup could not be inspected. Retry later." },
      { status: 503 },
    );
  }
}
