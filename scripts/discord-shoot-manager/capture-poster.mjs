import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = fileURLToPath(new URL("../../", import.meta.url));
await mkdir(join(root, ".tmp"), { recursive: true });
const output = await mkdtemp(join(root, ".tmp", "shoot-poster-"));
// Playwright owns an isolated app fixture, with synthetic Auth and no real .env
// files. Only its dedicated poster test runs; no Discord service is contacted.
const result = spawnSync(
  process.execPath,
  [
    join(root, "node_modules/@playwright/test/cli.js"),
    "test",
    "tests/e2e/shoot-lifecycle.spec.ts",
    "--project=desktop",
    "--grep=sharing poster is captured",
    `--output=${output}`,
  ],
  { cwd: root, stdio: "inherit", env: process.env },
);
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
const captures = (await readdir(output, { recursive: true })).filter((path) =>
  path.endsWith("/shoot-lifecycle-poster.png"),
);
if (captures.length !== 1)
  throw new Error("Expected one sharing-poster capture");
const bytes = await readFile(join(output, captures[0]));
const metadata = await sharp(bytes).metadata();
if (metadata.width !== 1600 || metadata.height !== 1000)
  throw new Error("Poster must be a 1600 × 1000 scene capture");
const destination = join(
  root,
  "public/projects/tvm-discord-bot/shoot-lifecycle.png",
);
await mkdir(dirname(destination), { recursive: true });
await sharp(bytes).png({ compressionLevel: 9 }).toFile(destination);
console.log("Updated public/projects/tvm-discord-bot/shoot-lifecycle.png");
