import { createHmac, timingSafeEqual } from "node:crypto";

import type { NextResponse } from "next/server";

export const ADMIN_SESSION_COOKIE_NAME = "photo_graph_admin_session";
export const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 12;

type SessionPayload = {
  iat: number;
  exp: number;
};

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf-8").toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf-8");
}

function getSessionSecret() {
  const secret = process.env.PHOTO_GRAPH_SESSION_SECRET;
  if (!secret) {
    throw new Error("Missing required env var: PHOTO_GRAPH_SESSION_SECRET");
  }

  return secret;
}

function signPayload(payloadPart: string) {
  return createHmac("sha256", getSessionSecret())
    .update(payloadPart)
    .digest("base64url");
}

function parseSessionPayload(value: string): SessionPayload | null {
  try {
    const decoded = base64UrlDecode(value);
    const parsed = JSON.parse(decoded) as Partial<SessionPayload>;

    if (
      typeof parsed.iat !== "number" ||
      typeof parsed.exp !== "number" ||
      !Number.isFinite(parsed.iat) ||
      !Number.isFinite(parsed.exp)
    ) {
      return null;
    }

    return {
      iat: Math.floor(parsed.iat),
      exp: Math.floor(parsed.exp),
    };
  } catch {
    return null;
  }
}

export function createAdminSessionToken() {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    iat: nowSeconds,
    exp: nowSeconds + ADMIN_SESSION_TTL_SECONDS,
  };

  const payloadPart = base64UrlEncode(JSON.stringify(payload));
  const signaturePart = signPayload(payloadPart);

  return `${payloadPart}.${signaturePart}`;
}

export function isValidAdminSessionToken(token: string | undefined) {
  if (!token) {
    return false;
  }

  const [payloadPart, signaturePart] = token.split(".");
  if (!payloadPart || !signaturePart) {
    return false;
  }

  let expectedSignature: string;

  try {
    expectedSignature = signPayload(payloadPart);
  } catch {
    return false;
  }
  const providedBuffer = Buffer.from(signaturePart, "utf-8");
  const expectedBuffer = Buffer.from(expectedSignature, "utf-8");

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  if (!timingSafeEqual(providedBuffer, expectedBuffer)) {
    return false;
  }

  const payload = parseSessionPayload(payloadPart);
  if (!payload) {
    return false;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  return payload.exp > nowSeconds;
}

export function isValidAdminPassword(password: string) {
  const expectedPassword = process.env.PHOTO_GRAPH_ADMIN_PASSWORD;

  if (!expectedPassword) {
    throw new Error("Missing required env var: PHOTO_GRAPH_ADMIN_PASSWORD");
  }

  const provided = Buffer.from(password, "utf-8");
  const expected = Buffer.from(expectedPassword, "utf-8");

  if (provided.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(provided, expected);
}

export function setAdminSessionCookie(response: NextResponse, token: string) {
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE_NAME,
    value: token,
    maxAge: ADMIN_SESSION_TTL_SECONDS,
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

export function clearAdminSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE_NAME,
    value: "",
    maxAge: 0,
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}
