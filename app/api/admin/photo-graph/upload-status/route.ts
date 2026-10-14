import { NextRequest, NextResponse } from "next/server";
import { isPendingPhotoGraphStoragePath } from "@/lib/photo-graph/config";
import { getAdminUser } from "@/lib/server/admin-auth";
import { getServiceRoleSupabase } from "@/lib/server/supabase";
import { getPhotoGraphStorageBucket } from "@/lib/supabase/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!(await getAdminUser()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const paths: unknown = body?.paths;
  if (
    !Array.isArray(paths) ||
    paths.length < 1 ||
    paths.length > 100 ||
    paths.some(
      (path) =>
        typeof path !== "string" || !isPendingPhotoGraphStoragePath(path),
    )
  ) {
    return NextResponse.json(
      { error: "Invalid pending upload paths." },
      { status: 400 },
    );
  }
  try {
    const storage = getServiceRoleSupabase().storage.from(
      getPhotoGraphStorageBucket(),
    );
    const present: string[] = [];
    const missing: string[] = [];
    for (const path of paths as string[]) {
      const { data, error } = await storage.info(path);
      if (!error && data) present.push(path);
      else if (
        error &&
        (("status" in error && error.status === 404) ||
          ("code" in error && error.code === "NoSuchKey"))
      )
        missing.push(path);
      else
        throw new Error(
          "Storage could not confirm upload status. Retry without clearing recovery data.",
        );
    }
    return NextResponse.json(
      { ok: true, present, missing },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      {
        error:
          "Storage could not confirm upload status. Retry without clearing recovery data.",
      },
      { status: 503 },
    );
  }
}
