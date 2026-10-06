import { createHash } from "node:crypto";

import { NextResponse } from "next/server";

import { isAdminUser } from "@/lib/server/admin-auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LoginRequestBody = {
  email?: string;
  password?: string;
};

type FailedLoginAttempt = {
  count: number;
  blockedUntil: number;
  lastFailedAt: number;
};

const failedLoginAttempts = new Map<string, FailedLoginAttempt>();
const FAILED_LOGIN_WINDOW_MS = 15 * 60 * 1000;
const FAILED_LOGIN_BLOCK_MS = 60 * 1000;
const FAILED_LOGIN_THRESHOLD = 5;
const FAILED_LOGIN_MAX_ENTRIES = 10_000;

function getClientIdentifier(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const clientAddress =
    forwardedFor?.split(",", 1)[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const userAgent = request.headers.get("user-agent") || "unknown";

  return createHash("sha256")
    .update(`${clientAddress}\n${userAgent}`)
    .digest("hex")
    .slice(0, 32);
}

function cleanupFailedLoginAttempts(now: number) {
  for (const [identifier, attempt] of failedLoginAttempts) {
    if (
      attempt.lastFailedAt + FAILED_LOGIN_WINDOW_MS <= now &&
      attempt.blockedUntil <= now
    ) {
      failedLoginAttempts.delete(identifier);
    }
  }

  while (failedLoginAttempts.size > FAILED_LOGIN_MAX_ENTRIES) {
    let oldestIdentifier: string | undefined;
    let oldestFailedAt = Number.POSITIVE_INFINITY;

    for (const [identifier, attempt] of failedLoginAttempts) {
      if (attempt.lastFailedAt < oldestFailedAt) {
        oldestIdentifier = identifier;
        oldestFailedAt = attempt.lastFailedAt;
      }
    }

    if (oldestIdentifier) {
      failedLoginAttempts.delete(oldestIdentifier);
    }
  }
}

function getRetryAfterSeconds(blockedUntil: number, now: number) {
  return Math.max(1, Math.ceil((blockedUntil - now) / 1000));
}

function tooManyFailedLogins(retryAfter: number) {
  return NextResponse.json(
    {
      error: "Too many failed login attempts. Try again later.",
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter),
      },
    },
  );
}

function recordFailedLogin(identifier: string, now: number) {
  const previous = failedLoginAttempts.get(identifier);
  const attempt =
    previous && previous.lastFailedAt + FAILED_LOGIN_WINDOW_MS > now
      ? previous
      : {
          count: 0,
          blockedUntil: 0,
          lastFailedAt: now,
        };

  attempt.count += 1;
  attempt.lastFailedAt = now;
  if (attempt.count >= FAILED_LOGIN_THRESHOLD) {
    attempt.blockedUntil = now + FAILED_LOGIN_BLOCK_MS;
  }
  failedLoginAttempts.set(identifier, attempt);
  cleanupFailedLoginAttempts(now);

  return attempt;
}

function clearFailedLogins(identifier: string) {
  failedLoginAttempts.delete(identifier);
}

export async function POST(request: Request) {
  const now = Date.now();
  const clientIdentifier = getClientIdentifier(request);
  const previousAttempt = failedLoginAttempts.get(clientIdentifier);

  if (previousAttempt?.blockedUntil && previousAttempt.blockedUntil > now) {
    return tooManyFailedLogins(
      getRetryAfterSeconds(previousAttempt.blockedUntil, now),
    );
  }

  cleanupFailedLoginAttempts(now);

  let body: LoginRequestBody;

  try {
    const payload: unknown = await request.json();
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 },
      );
    }
    body = payload as LoginRequestBody;
  } catch {
    return NextResponse.json(
      {
        error: "Invalid JSON payload.",
      },
      { status: 400 },
    );
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !password || email.length > 254 || password.length > 4096) {
    return NextResponse.json(
      { error: "A valid email and password are required." },
      { status: 400 },
    );
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error && (!error.status || error.status >= 500)) {
    return NextResponse.json(
      { error: "Sign-in is temporarily unavailable. Try again." },
      { status: 503 },
    );
  }

  if (error?.status === 429) {
    return tooManyFailedLogins(60);
  }

  if (error || !isAdminUser(data.user)) {
    // A valid Supabase account alone does not grant admin access.
    if (data.session) {
      await supabase.auth.signOut({ scope: "local" });
    }
    const failedAttempt = recordFailedLogin(clientIdentifier, now);

    if (failedAttempt.blockedUntil > now) {
      return tooManyFailedLogins(
        getRetryAfterSeconds(failedAttempt.blockedUntil, now),
      );
    }

    return NextResponse.json(
      {
        error: "Unable to sign in with this account.",
      },
      { status: 401 },
    );
  }

  clearFailedLogins(clientIdentifier);

  return NextResponse.json({
    ok: true,
  });
}
