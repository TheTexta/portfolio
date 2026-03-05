import { NextResponse } from "next/server";

import {
  createAdminSessionToken,
  isValidAdminPassword,
  setAdminSessionCookie,
} from "@/lib/server/admin-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LoginRequestBody = {
  password?: string;
};

export async function POST(request: Request) {
  let body: LoginRequestBody;

  try {
    body = (await request.json()) as LoginRequestBody;
  } catch {
    return NextResponse.json(
      {
        error: "Invalid JSON payload.",
      },
      { status: 400 },
    );
  }

  const password = body.password ?? "";

  if (!password || !isValidAdminPassword(password)) {
    return NextResponse.json(
      {
        error: "Invalid password.",
      },
      { status: 401 },
    );
  }

  const response = NextResponse.json({
    ok: true,
  });

  setAdminSessionCookie(response, createAdminSessionToken());
  return response;
}
