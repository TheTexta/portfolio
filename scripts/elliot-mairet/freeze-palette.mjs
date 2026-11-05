import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import sharp from "sharp";
import { format } from "prettier";

// Public GETs and local files only. Never uses Supabase, credentials or R2 writes.
const root = fileURLToPath(new URL("../../", import.meta.url));
const args = process.argv.slice(2);
const owner = path.resolve(
  root,
  args.find((arg) => !arg.startsWith("--")) ?? "../elliotmairet",
);
const check = args.includes("--check");
const cache = path.join(root, ".tmp/elliot-palette/20261025-DSCF7395.jpg");
const destination = path.join(
  root,
  "public/projects/elliot-mairet/palette-extraction",
);
const photographUrl = "https://elliotmairet.com/gallery/20261025-DSCF7395.jpg";
const originalUrl =
  "https://media.dextery.dev/elliotmairet/uploads/8255b19e-fa44-4eb3-bc20-33fa85ada9ee.jpg";
const expectedPalette = ["#907050", "#b09050", "#705030", "#d0b070", "#301010"];
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const extractorPath = path.join(owner, "lib/palette/oklab-k-medoids.js");
const analysisPath = path.join(owner, "lib/photographs/analyse-image.ts");
const {
  extractOklabKMedoids,
  rgbToOklab,
  OKLAB_K_MEDOIDS_ALGORITHM,
  OKLAB_K_MEDOIDS_ITERATIONS,
} = await import(pathToFileURL(extractorPath).href);

if (args.includes("--download")) {
  const response = await fetch(originalUrl, {
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`Original returned ${response.status}`);
  if (Number(response.headers.get("content-length")) > 64 * 1024 * 1024)
    throw new Error("Original exceeds the 64MB fixture limit");
  const original = Buffer.from(await response.arrayBuffer());
  if (original.length > 64 * 1024 * 1024)
    throw new Error("Original exceeds the 64MB fixture limit");
  await mkdir(path.dirname(cache), { recursive: true });
  await writeFile(cache, original);
}
const original = await readFile(cache).catch(() => {
  throw new Error(
    "No cached original. Run with --download to GET the public photograph.",
  );
});
// Matches analyseImage(): orientation, 96px longest side, fit inside, alpha > 200.
const { data, info } = await sharp(original)
  .rotate()
  .resize({ width: 96, height: 96, fit: "inside", withoutEnlargement: true })
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const pixels = [];
for (let offset = 0; offset < data.length; offset += info.channels) {
  if (data[offset + 3] > 200)
    pixels.push([...data.subarray(offset, offset + 3)]);
}
const features = extractOklabKMedoids(pixels, 5);
const hex = (rgb) =>
  "#" + rgb.map((channel) => channel.toString(16).padStart(2, "0")).join("");
assert.deepEqual(
  features.map(({ rgb }) => hex(rgb)),
  expectedPalette,
  "The actual extractor must reproduce the five published swatches",
);

// Display one real sample per 4×4 block. Extraction above still uses every pixel.
// Membership follows the extractor's 32-level bins and squared OKLab distance.
const tiles = [];
for (let y = 0; y < info.height; y += 4) {
  for (let x = 0; x < info.width; x += 4) {
    const offset =
      (Math.min(y + 2, info.height - 1) * info.width +
        Math.min(x + 2, info.width - 1)) *
      info.channels;
    if (data[offset + 3] <= 200) continue;
    const rgb = [...data.subarray(offset, offset + 3)];
    const oklab = rgbToOklab(
      rgb.map((channel) => Math.min(255, Math.floor(channel / 32) * 32 + 16)),
    );
    const distances = features.map((feature) =>
      feature.oklab.reduce(
        (sum, value, index) => sum + (value - oklab[index]) ** 2,
        0,
      ),
    );
    tiles.push({
      x,
      y,
      hex: hex(rgb),
      group: distances.indexOf(Math.min(...distances)),
    });
  }
}
const photograph = await sharp(original)
  .rotate()
  .resize({ width: 1200, withoutEnlargement: true })
  .webp({ quality: 88 })
  .toBuffer();
const record = {
  photograph: {
    filename: "20261025-DSCF7395.jpg",
    pageUrl: photographUrl,
    originalUrl,
    originalSha256: hash(original),
    credit: "Photography: Elliot Mairet",
    asset: "/projects/elliot-mairet/palette-extraction/photograph.webp",
    assetSha256: hash(photograph),
    width: 1200,
    height: (await sharp(photograph).metadata()).height,
  },
  analysis: {
    algorithm: OKLAB_K_MEDOIDS_ALGORITHM,
    maximumIterations: OKLAB_K_MEDOIDS_ITERATIONS,
    extractorSha256: hash(await readFile(extractorPath)),
    analysisSourceSha256: hash(await readFile(analysisPath)),
    sharpVersion: sharp.versions.sharp,
    sampleWidth: info.width,
    sampleHeight: info.height,
    sampleSha256: hash(data),
    opaquePixels: pixels.length,
    displayedSampleStride: 4,
    note: "Real extraction; a spatial subset of samples illustrates final cluster membership, not recorded solver iterations or processing latency.",
  },
  palette: features.map(({ rgb, oklab, weight }) => ({
    hex: hex(rgb),
    oklab,
    weight,
  })),
  tiles,
};
const files = {
  "photograph.webp": photograph,
  "recording.json": Buffer.from(
    await format(JSON.stringify(record), { parser: "json" }),
  ),
};
if (!check) await mkdir(destination, { recursive: true });
for (const [name, bytes] of Object.entries(files)) {
  if (check)
    assert.deepEqual(
      await readFile(path.join(destination, name)),
      bytes,
      `Fixture drift: ${name}`,
    );
  else await writeFile(path.join(destination, name), bytes);
}
console.log(
  `${check ? "Verified" : "Recorded"} ${pixels.length} pixels, ${tiles.length} display samples and five production OKLab colours.`,
);
