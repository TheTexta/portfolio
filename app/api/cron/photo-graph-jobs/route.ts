import { NextRequest, NextResponse } from "next/server";

import { runNextPhotoGraphJob } from "@/lib/photo-graph/job-runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    throw new Error("Missing required env var: CRON_SECRET");
  }

  const header = request.headers.get("authorization");
  if (!header) {
    return false;
  }

  return header === `Bearer ${secret}`;
}

async function handleCron(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const maxComparisons = Math.max(
    1,
    Math.round(Number(process.env.PHOTO_GRAPH_JOB_CHUNK_SIZE ?? "300") || 300),
  );

  const result = await runNextPhotoGraphJob({ maxComparisons });

  return NextResponse.json(result, {
    headers: {
      "cache-control": "no-store",
    },
  });
}

export async function POST(request: NextRequest) {
  return handleCron(request);
}

export async function GET(request: NextRequest) {
  return handleCron(request);
}
