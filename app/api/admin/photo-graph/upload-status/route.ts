import { NextRequest, NextResponse } from "next/server";
import { isPendingPhotoGraphStoragePath } from "@/lib/photo-graph/config";
import {
  isPhotoGraphR2StagingKey,
  PHOTO_GRAPH_R2_MAX_UPLOAD_BYTES,
  photoGraphR2Extension,
} from "@/lib/photo-graph/r2-paths";
import { getAdminUser } from "@/lib/server/admin-auth";
import { photoGraphR2StagedObjectStatus } from "@/lib/server/photo-graph-r2";
import { getServiceRoleSupabase } from "@/lib/server/supabase";
import { getPhotoGraphStorageBucket } from "@/lib/supabase/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type StatusItem = {
  storagePath: string;
  storageProvider?: "r2";
  sourceSize?: number;
  sourceSha256?: string;
  contentType?: string;
};

function normalizeItems(body: unknown): StatusItem[] | null {
  if (!body || typeof body !== "object") return null;
  const input = body as Record<string, unknown>;
  const items = Array.isArray(input.items)
    ? input.items
    : Array.isArray(input.paths)
      ? input.paths.map((storagePath: unknown) => ({ storagePath }))
      : null;
  if (!items || items.length < 1 || items.length > 100) return null;

  const normalized: StatusItem[] = [];
  for (const raw of items) {
    if (!raw || typeof raw !== "object") return null;
    const item = raw as Record<string, unknown>;
    const storagePath = item.storagePath;
    if (typeof storagePath !== "string") return null;
    if (item.storageProvider === "r2") {
      if (
        !isPhotoGraphR2StagingKey(storagePath) ||
        !Number.isSafeInteger(item.sourceSize) ||
        typeof item.sourceSize !== "number" ||
        item.sourceSize < 1 ||
        item.sourceSize > PHOTO_GRAPH_R2_MAX_UPLOAD_BYTES ||
        typeof item.sourceSha256 !== "string" ||
        !/^[a-f0-9]{64}$/.test(item.sourceSha256) ||
        typeof item.contentType !== "string"
      )
        return null;
      try {
        if (
          !storagePath.endsWith(`.${photoGraphR2Extension(item.contentType)}`)
        )
          return null;
      } catch {
        return null;
      }
      normalized.push(item as StatusItem);
    } else if (
      item.storageProvider === undefined &&
      isPendingPhotoGraphStoragePath(storagePath)
    ) {
      normalized.push({ storagePath });
    } else return null;
  }
  return new Set(normalized.map((item) => item.storagePath)).size ===
    normalized.length
    ? normalized
    : null;
}

export async function POST(request: NextRequest) {
  if (!(await getAdminUser()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const items = normalizeItems(body);
  if (!items) {
    return NextResponse.json(
      { error: "Invalid pending upload paths." },
      { status: 400 },
    );
  }
  try {
    let storage:
      | ReturnType<ReturnType<typeof getServiceRoleSupabase>["storage"]["from"]>
      | undefined;
    const present: string[] = [];
    const missing: string[] = [];
    for (const item of items) {
      if (item.storageProvider === "r2") {
        const head = await photoGraphR2StagedObjectStatus(item.storagePath);
        if (!head) {
          missing.push(item.storagePath);
        } else if (
          head.ContentLength === item.sourceSize &&
          head.ContentType === item.contentType &&
          head.Metadata?.sourcesha256 === item.sourceSha256 &&
          head.Metadata?.expectedsize === String(item.sourceSize)
        ) {
          present.push(item.storagePath);
        } else {
          throw new Error("R2 upload metadata does not match the saved batch.");
        }
        continue;
      }
      storage ??= getServiceRoleSupabase().storage.from(
        getPhotoGraphStorageBucket(),
      );
      const { data, error } = await storage.info(item.storagePath);
      if (!error && data) present.push(item.storagePath);
      else if (
        error &&
        (("status" in error && error.status === 404) ||
          ("code" in error && error.code === "NoSuchKey"))
      )
        missing.push(item.storagePath);
      else throw new Error("Storage could not confirm upload status.");
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
