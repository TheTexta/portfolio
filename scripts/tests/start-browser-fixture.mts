import { spawn } from "node:child_process";
import { createHmac } from "node:crypto";
import { once } from "node:events";
import { cp, mkdir, mkdtemp, rm, symlink } from "node:fs/promises";
import { createServer } from "node:http";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const adminId = "11111111-1111-4111-8111-111111111111";
const user = {
  id: adminId,
  email: "admin@example.test",
  aud: "authenticated",
  role: "authenticated",
  app_metadata: { provider: "email" },
  user_metadata: {},
  created_at: "2026-01-01T00:00:00Z",
};
const header = Buffer.from(
  JSON.stringify({ alg: "HS256", typ: "JWT" }),
).toString("base64url");
const claims = Buffer.from(
  JSON.stringify({
    sub: adminId,
    aud: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 3600,
  }),
).toString("base64url");
const unsigned = `${header}.${claims}`;
const token = `${unsigned}.${createHmac("sha256", "test-only").update(unsigned).digest("base64url")}`;
// No Storage or database writes are implemented. Every backend URL points here.
const auth = createServer(async (request, response) => {
  const path = new URL(request.url ?? "/", "http://localhost").pathname;
  const send = (status: number, body: unknown) => {
    response.writeHead(status, { "content-type": "application/json" });
    response.end(JSON.stringify(body));
  };
  if (path === "/auth/v1/token") {
    let body = "";
    for await (const chunk of request) body += chunk;
    const input = JSON.parse(body);
    if (input.email !== user.email || input.password !== "test-password")
      return send(400, { message: "Invalid credentials" });
    return send(200, {
      access_token: token,
      refresh_token: "test-refresh",
      token_type: "bearer",
      expires_in: 3600,
      user,
    });
  }
  if (
    path === "/auth/v1/user" &&
    request.headers.authorization === `Bearer ${token}`
  )
    return send(200, user);
  return send(404, { message: "Unsupported test-only endpoint" });
});
auth.listen(0, "127.0.0.1");
await once(auth, "listening");
const address = auth.address();
if (!address || typeof address === "string")
  throw new Error("Missing test Auth port");
await mkdir(join(root, ".tmp"), { recursive: true });
const fixture = await mkdtemp(join(root, ".tmp", "browser-tests-"));
for (const path of [
  "app",
  "lib",
  "mdx-components.tsx",
  "next.config.ts",
  "proxy.ts",
  "tsconfig.json",
  "postcss.config.mjs",
  "package.json",
  "package-lock.json",
]) {
  await cp(join(root, path), join(fixture, path), { recursive: true });
}
for (const path of ["node_modules", "public"])
  await symlink(join(root, path), join(fixture, path), "dir");
const child = spawn(
  process.execPath,
  [
    join(root, "node_modules/next/dist/bin/next"),
    "dev",
    "--webpack",
    "--port",
    "3107",
  ],
  {
    cwd: fixture,
    env: {
      ...process.env,
      NODE_ENV: "development",
      NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${address.port}`,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon",
      SUPABASE_SERVICE_ROLE_KEY: "test-service",
      SUPABASE_ADMIN_USER_IDS: adminId,
    },
    stdio: "inherit",
  },
);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => child.kill(signal));
const [code] = await once(child, "exit");
auth.close();
await rm(fixture, { recursive: true, force: true });
process.exitCode = typeof code === "number" ? code : 0;
