import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cp,
  mkdir,
  readFile,
  readdir,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Rebuild the owning repository's demo, then snapshot only public static assets.
// No network, production operations, model/runtime copy, or source-code rewriting.
const root = fileURLToPath(new URL("../../", import.meta.url));
const source = path.resolve(root, process.argv[2] || "../grailed-plus");
const destination = path.join(
  root,
  "public/projects/grailed-plus/recorded-demo",
);
execFileSync(process.execPath, [path.join(source, "scripts/build-demo.mjs")], {
  cwd: source,
  env: { ...process.env, DEMO_BUILD_MODE: "development" },
  stdio: "inherit",
});
await mkdir(destination, { recursive: true });
const previous = await readFile(path.join(destination, "snapshot.json"), "utf8")
  .then(JSON.parse)
  .catch((error) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
const currentAssets = new Set(
  await readdir(path.join(source, "demo-dist/assets")),
);
for (const [name, checksum] of Object.entries(previous?.files || {})) {
  if (
    !/^assets\/[A-Za-z0-9_.-]+\.(js|css)$/.test(name) ||
    currentAssets.has(name.slice(7))
  )
    continue;
  const file = path.join(destination, name);
  const bytes = await readFile(file);
  if (createHash("sha256").update(bytes).digest("hex") !== checksum)
    throw new Error(`Refusing to remove modified generated asset: ${name}`);
  await unlink(file);
}
for (const name of [
  "index.html",
  "photo-credits.html",
  "version.json",
  "assets",
  "photos",
]) {
  await cp(path.join(source, "demo-dist", name), path.join(destination, name), {
    recursive: true,
  });
}
for (const name of [
  "recorded-comparison.json",
  "recorded-comparison-input.json",
  "recorded-comparison-timeline.json",
  "photo-credits.json",
]) {
  await cp(path.join(source, "demo", name), path.join(destination, name));
}
await cp(path.join(source, "LICENSE"), path.join(destination, "LICENSE.txt"));
const files = {};
async function inventory(directory, prefix = "") {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const name = prefix + entry.name;
    if (name === "snapshot.json") continue;
    if (entry.isDirectory())
      await inventory(path.join(directory, entry.name), name + "/");
    else
      files[name] = createHash("sha256")
        .update(await readFile(path.join(directory, entry.name)))
        .digest("hex");
  }
}
await inventory(destination);
await writeFile(
  path.join(destination, "snapshot.json"),
  JSON.stringify(
    {
      source: "grailed-plus/demo",
      note: "Local source build; version.json identifies checkout HEAD, not proof that uncommitted source matches that commit. File hashes identify the actual snapshot.",
      files,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `Synced recorded comparison to ${path.relative(root, destination)}`,
);
