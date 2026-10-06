import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { createHmac } from "node:crypto";
import { once } from "node:events";
import { cp, mkdir, mkdtemp, rm, symlink } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const adminId = "11111111-1111-4111-8111-111111111111";
const memberId = "22222222-2222-4222-8222-222222222222";
const cookieName = "photo_graph_supabase_auth";
const password = "local-test-password";
const projectDir = fileURLToPath(new URL("../../", import.meta.url));
let fixtureDir: string;
const users = [adminId, memberId].map((id, index) => ({
  id,
  email: index === 0 ? "admin@example.test" : "member@example.test",
  aud: "authenticated",
  role: "authenticated",
  app_metadata: { provider: "email" },
  user_metadata: {},
  created_at: "2026-01-01T00:00:00Z",
}));
const tokens = new Map<string, (typeof users)[number]>();
const refreshTokens = new Map<string, (typeof users)[number]>();
let sequence = 0;
let refreshCount = 0;
let authUnavailable = false;

function session(user: (typeof users)[number], expired = false) {
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = expired ? now - 120 : now + 3600;
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  ).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      sub: user.id,
      aud: "authenticated",
      exp: expiresAt,
      iat: now,
      jti: ++sequence,
    }),
  ).toString("base64url");
  const unsigned = `${header}.${payload}`;
  const token = `${unsigned}.${createHmac("sha256", "local-test-key").update(unsigned).digest("base64url")}`;
  const refreshToken = `local-refresh-${sequence}`;
  tokens.set(token, user);
  refreshTokens.set(refreshToken, user);
  return {
    access_token: token,
    refresh_token: refreshToken,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: expiresAt,
    user,
  };
}

function sessionCookie(value: ReturnType<typeof session>) {
  return `${cookieName}=base64-${Buffer.from(JSON.stringify(value)).toString("base64url")}`;
}

async function listen(server: Server) {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return address.port;
}

const authServer = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://localhost");
  const respond = (status: number, body: unknown) => {
    response.writeHead(status, { "content-type": "application/json" });
    response.end(JSON.stringify(body));
  };
  if (authUnavailable) {
    return respond(503, { message: "Auth unavailable" });
  }
  if (url.pathname === "/auth/v1/token") {
    let rawBody = "";
    for await (const chunk of request) rawBody += chunk;
    const body = JSON.parse(rawBody) as Record<string, string>;
    const refreshing = url.searchParams.get("grant_type") === "refresh_token";
    const user = refreshing
      ? refreshTokens.get(body.refresh_token)
      : users.find(
          (entry) => entry.email === body.email && body.password === password,
        );
    if (!user) {
      return respond(400, {
        code: "invalid_credentials",
        message: "Invalid credentials",
      });
    }
    if (refreshing) refreshCount += 1;
    return respond(200, session(user));
  }
  const token = request.headers.authorization?.replace(/^Bearer /, "") ?? "";
  const user = tokens.get(token);
  if (url.pathname === "/auth/v1/user") {
    return user
      ? respond(200, user)
      : respond(401, { code: "bad_jwt", message: "Invalid token" });
  }
  if (url.pathname === "/auth/v1/logout") {
    assert.equal(url.searchParams.get("scope"), "local");
    tokens.delete(token);
    response.writeHead(204);
    return response.end();
  }
  // Never provide Storage or database writes in this fixture.
  respond(404, { message: "Unsupported test endpoint" });
});

let nextProcess: ChildProcess | undefined;
let nextOutput = "";

async function stopNext() {
  if (!nextProcess || nextProcess.exitCode !== null) return;
  const stopped = once(nextProcess, "exit");
  nextProcess.kill("SIGTERM");
  await stopped;
}

async function startNext(authPort: number, allowedIds: string) {
  const reservation = createServer();
  const port = await listen(reservation);
  await new Promise<void>((resolve) => reservation.close(() => resolve()));
  nextOutput = "";
  nextProcess = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "dev",
      "--webpack",
      "--port",
      String(port),
    ],
    {
      cwd: fixtureDir,
      env: {
        ...process.env,
        NODE_ENV: "development",
        NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${authPort}`,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "local-test-anon-key",
        SUPABASE_SERVICE_ROLE_KEY: "local-test-service-key",
        SUPABASE_ADMIN_USER_IDS: allowedIds,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  for (const stream of [nextProcess.stdout, nextProcess.stderr]) {
    stream?.on("data", (data) => {
      nextOutput = (nextOutput + String(data)).slice(-8000);
    });
  }
  const base = `http://localhost:${port}`;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (nextProcess.exitCode !== null) throw new Error(nextOutput);
    try {
      const response = await fetch(`${base}/admin`, {
        signal: AbortSignal.timeout(2000),
      });
      if (response.ok) return base;
    } catch {
      // The development server is still starting or compiling.
    }
    await delay(500);
  }
  throw new Error(`Next.js did not become ready:\n${nextOutput}`);
}

function responseCookies(response: Response) {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}

async function validate() {
  const authPort = await listen(authServer);
  try {
    await mkdir(join(projectDir, ".tmp"), { recursive: true });
    fixtureDir = await mkdtemp(join(projectDir, ".tmp", "admin-auth-"));
    for (const path of [
      "app",
      "lib",
      "next.config.ts",
      "proxy.ts",
      "tsconfig.json",
      "postcss.config.mjs",
      "package.json",
      "package-lock.json",
    ]) {
      await cp(join(projectDir, path), join(fixtureDir, path), {
        recursive: true,
      });
    }
    for (const path of ["node_modules", "public"]) {
      await symlink(join(projectDir, path), join(fixtureDir, path), "dir");
    }
    let base = await startNext(authPort, "");
    const login = (
      email = users[0].email,
      value: unknown = { email, password },
    ) =>
      fetch(`${base}/api/admin/photo-graph/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(value),
      });
    assert.equal((await login()).status, 401);
    console.log("PASS: missing admin allowlist denies sign-in");
    await stopNext();

    base = await startNext(authPort, ` ${adminId}, `);
    const page = await fetch(`${base}/admin`);
    const html = await page.text();
    assert.match(html, /admin-email/);
    assert.match(html, /noindex/);
    // Next dev overrides Proxy's private/no-store header with no-cache.
    assert.match(page.headers.get("cache-control") ?? "", /no-cache|no-store/);
    assert.ok(!html.includes("Manage Photos"));
    for (const body of [
      null,
      [],
      { email: 123, password },
      { email: users[0].email, password: {} },
    ]) {
      assert.equal((await login(users[0].email, body)).status, 400);
    }
    assert.equal(
      (
        await login(users[0].email, {
          email: users[0].email,
          password: "wrong",
        })
      ).status,
      401,
    );
    assert.equal((await login(users[1].email)).status, 401);

    const memberSession = session(users[1]);
    const forgedUserCookie = sessionCookie({
      ...memberSession,
      user: users[0],
    });
    const protectedRoutes = [
      ["graph", "GET"],
      ["graph-preview", "GET"],
      ["edge-defaults", "GET"],
      ["edge-defaults", "POST"],
      ["graph-defaults", "GET"],
      ["graph-defaults", "POST"],
      ["upload-url", "POST"],
      ["upload", "POST"],
      ["delete", "POST"],
      ["apply-correlations", "POST"],
    ];
    for (const cookie of [
      "",
      "photo_graph_admin_session=legacy",
      sessionCookie(memberSession),
      forgedUserCookie,
    ]) {
      for (const [route, method] of protectedRoutes) {
        const response = await fetch(`${base}/api/admin/photo-graph/${route}`, {
          method,
          headers: { cookie },
        });
        assert.equal(
          response.status,
          401,
          `${route} must reject unauthorized sessions`,
        );
      }
    }
    console.log(
      "PASS: every admin API rejects anonymous, legacy, non-admin, and forged-user sessions",
    );

    const signedIn = await login();
    assert.equal(signedIn.status, 200);
    assert.ok(
      signedIn.headers
        .getSetCookie()
        .some(
          (cookie) =>
            cookie.includes("HttpOnly") && cookie.includes("SameSite=strict"),
        ),
    );
    const cookie = responseCookies(signedIn);
    const authorizedPage = await fetch(`${base}/admin`, {
      headers: { cookie },
    });
    assert.match(await authorizedPage.text(), /Manage Photos/);
    const allowed = await fetch(`${base}/api/admin/photo-graph/upload-url`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: "{}",
    });
    assert.equal(allowed.status, 400);
    assert.match(await allowed.text(), /Unsupported content type/);
    console.log(
      "PASS: allowlisted account receives HttpOnly cookies and accesses the panel/API",
    );

    const expired = session(users[0], true);
    const refreshed = await fetch(`${base}/admin`, {
      headers: { cookie: sessionCookie(expired) },
    });
    assert.match(await refreshed.text(), /Manage Photos/);
    assert.equal(refreshCount, 1);
    assert.ok(responseCookies(refreshed).includes(cookieName));
    console.log(
      "PASS: expired session refreshes once and returns updated cookies",
    );

    const revoked = session(users[0]);
    tokens.delete(revoked.access_token);
    const revokedPage = await fetch(`${base}/admin`, {
      headers: { cookie: sessionCookie(revoked) },
    });
    assert.match(await revokedPage.text(), /admin-email/);
    console.log("PASS: Auth-rejected session cannot render admin controls");

    const signedOut = await fetch(`${base}/api/admin/photo-graph/logout`, {
      method: "POST",
      headers: { cookie },
    });
    assert.equal(signedOut.status, 200);
    assert.ok(
      signedOut.headers
        .getSetCookie()
        .some((value) => /Max-Age=0/i.test(value)),
    );
    const afterLogout = await fetch(`${base}/admin`, {
      headers: { cookie: responseCookies(signedOut) },
    });
    assert.match(await afterLogout.text(), /admin-email/);
    console.log(
      "PASS: sign-out clears session cookies and restores the login form",
    );

    authUnavailable = true;
    assert.equal((await login()).status, 503);
    const outagePage = await fetch(`${base}/admin`, {
      headers: { cookie: sessionCookie(session(users[0])) },
    });
    assert.match(await outagePage.text(), /admin-email/);
    console.log(
      "PASS: Auth outage fails closed with recoverable sign-in error",
    );
  } finally {
    await stopNext();
    await new Promise<void>((resolve) => authServer.close(() => resolve()));
    if (fixtureDir) await rm(fixtureDir, { recursive: true, force: true });
  }
}

validate().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
