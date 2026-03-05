import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function disabledResponse() {
  return NextResponse.json(
    {
      error: "Cron processing is disabled. Admin uploads now generate edges in-browser.",
    },
    { status: 410 },
  );
}

export async function GET() {
  return disabledResponse();
}

export async function POST() {
  return disabledResponse();
}
