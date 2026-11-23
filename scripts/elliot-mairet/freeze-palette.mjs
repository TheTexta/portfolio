import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { format } from "prettier";

// Explicit local generation only. No credentials, database calls or remote writes.
const root = fileURLToPath(new URL("../../", import.meta.url));
const args = process.argv.slice(2);
const check = args.includes("--check");
const historicalDirectory = path.join(
  root,
  "public/projects/elliot-mairet/palette-extraction",
);
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const historical = JSON.parse(
  await readFile(path.join(historicalDirectory, "recording.json"), "utf8"),
);

// Backwards-compatible, offline --check: protect the historical bytes without
// depending on a checkout whose production analyser has since changed.
for (const [file, expected] of Object.entries({
  "recording.json":
    "bf93b1ae8ab14ffe2ef8aa0577cf78744fb6a87b4a135f20d08b2239a5c6fe52",
  "photograph.webp":
    "8e5e752d41b0baa69424b5a48458cc863f3f96ea0d33a4ce30be8382dd45add1",
})) {
  assert.equal(
    hash(await readFile(path.join(historicalDirectory, file))),
    expected,
    `Historical fixture changed: ${file}`,
  );
}
if (!args.includes("--mmcq")) {
  assert.ok(
    check && !args.includes("--download"),
    "Historical output is immutable. Use --check, or --mmcq to generate the current version.",
  );
  console.log("Verified byte-identical historical kmedoids-oklab-v1 fixtures.");
  process.exit(0);
}

const ownerArgument = args.find((arg) => !arg.startsWith("--"));
assert.ok(ownerArgument, "Select the owning source checkout explicitly.");
const owner = path.resolve(root, ownerArgument);
const sourceRevision = "aef9eb2cc1cde3b9c79e738fd27ed34ddc03c74a";
const sources = {};
for (const file of [
  "lib/palette/analyse-buffer.ts",
  "lib/palette/mmcq-vibrant.js",
  "lib/palette/oklab-k-medoids.js",
  "lib/palette/k-means.js",
  "lib/photographs/analyse-image.ts",
  "lib/photographs/config.ts",
  "package.json",
  "package-lock.json",
]) {
  const pinned = execFileSync("git", ["show", `${sourceRevision}:${file}`], {
    cwd: owner,
  });
  // Only executed production code must match; unrelated checkout work is allowed.
  if (file.startsWith("lib/"))
    assert.deepEqual(
      await readFile(path.join(owner, file)),
      pinned,
      `Production source differs from pinned revision: ${file}`,
    );
  sources[file] = hash(pinned);
}
const ownerRequire = createRequire(path.join(owner, "package.json"));
const sharp = ownerRequire("sharp");
const { extractImagePalette } = await import(
  pathToFileURL(path.join(owner, "lib/palette/analyse-buffer.ts")).href
);
const { analyseImage } = await import(
  pathToFileURL(path.join(owner, "lib/photographs/analyse-image.ts")).href
);
const {
  extractMmcqVibrantPalette,
  MMCQ_VIBRANT_ALGORITHM,
  MMCQ_SAMPLE_LONGEST_SIDE,
  MMCQ_PASSES,
} = await import(
  pathToFileURL(path.join(owner, "lib/palette/mmcq-vibrant.js")).href
);
const { rgbToOklab } = await import(
  pathToFileURL(path.join(owner, "lib/palette/oklab-k-medoids.js")).href
);
const cache = path.join(root, ".tmp/elliot-palette/20261025-DSCF7395.jpg");
const originalPath =
  args
    .find((arg) => arg.startsWith("--original-path="))
    ?.split("=")
    .slice(1)
    .join("=") ?? cache;
if (args.includes("--download")) {
  assert.equal(
    originalPath,
    cache,
    "--download only writes the ignored cache.",
  );
  assert.ok(!check, "--check never downloads or writes.");
  const response = await fetch(historical.photograph.originalUrl, {
    signal: AbortSignal.timeout(60_000),
  });
  assert.ok(response.ok, `Original returned ${response.status}`);
  assert.ok(
    Number(response.headers.get("content-length")) <= 64 * 1024 * 1024,
    "Original exceeds the 64MB fixture limit",
  );
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.ok(bytes.length <= 64 * 1024 * 1024);
  assert.equal(hash(bytes), historical.photograph.originalSha256);
  await mkdir(path.dirname(cache), { recursive: true });
  await writeFile(cache, bytes);
}
const original = await readFile(originalPath);
assert.equal(
  hash(original),
  historical.photograph.originalSha256,
  "Use only the approved, checksum-verified original photograph.",
);

// Call BOTH owning production entry points, not a port of the current model.
const features = await extractImagePalette(original);
const analysed = await analyseImage(original, "portfolio-frozen-example");
assert.equal(analysed.algorithm, MMCQ_VIBRANT_ALGORITHM);
assert.ok(features.length >= 1 && features.length <= 5);
assert.equal(analysed.palette_size, features.length);
assert.equal(analysed.oklab_features.feature_count, features.length);
const hex = (rgb) =>
  "#" + rgb.map((channel) => channel.toString(16).padStart(2, "0")).join("");
features.forEach((feature, index) => {
  assert.equal(analysed.colours[index].rank, index + 1);
  assert.deepEqual(
    ["red", "green", "blue"].map((channel) => analysed.colours[index][channel]),
    feature.rgb,
  );
  assert.equal(analysed.colours[index].hex, hex(feature.rgb));
  assert.equal(
    analysed.oklab_features.features[index].weight,
    Number(feature.weight.toFixed(6)),
  );
  assert.deepEqual(
    ["oklab_l", "oklab_a", "oklab_b"].map(
      (axis) => analysed.oklab_features.features[index][axis],
    ),
    feature.oklab,
  );
});

// A separate display sample supplies the mosaic. Verify it reproduces the
// production sampler's full output; it is NOT an instrumented MMCQ solver trace.
const { data, info } = await sharp(original)
  .rotate()
  .resize({
    width: MMCQ_SAMPLE_LONGEST_SIDE,
    height: MMCQ_SAMPLE_LONGEST_SIDE,
    fit: "inside",
    withoutEnlargement: true,
  })
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const pixels = [];
for (let offset = 0; offset < data.length; offset += info.channels)
  if (data[offset + 3] > 200)
    pixels.push([...data.subarray(offset, offset + 3)]);
assert.deepEqual(extractMmcqVibrantPalette(pixels, 5), features);
const sampledColours = new Set(pixels.map(hex));
for (const feature of features)
  assert.ok(
    sampledColours.has(hex(feature.rgb)),
    "Swatches must be sampled colours.",
  );
const stride = 12;
const tiles = [];
for (let y = 0; y < info.height; y += stride) {
  for (let x = 0; x < info.width; x += stride) {
    const offset =
      (Math.min(y + stride / 2, info.height - 1) * info.width +
        Math.min(x + stride / 2, info.width - 1)) *
      info.channels;
    if (data[offset + 3] <= 200) continue;
    const rgb = [...data.subarray(offset, offset + 3)];
    const oklab = rgbToOklab(rgb);
    const distances = features.map((feature) =>
      Math.hypot(...feature.oklab.map((value, axis) => value - oklab[axis])),
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
  snapshot: {
    version: "mmcq-v1",
    frozenOn: "2026-11-23",
    sourceRepository: "https://github.com/TheTexta/elliotmairet",
    sourceRevision,
    sourcesSha256: sources,
    runtime: {
      node: process.version,
      sharp: sharp.versions.sharp,
      vips: sharp.versions.vips,
      exifReader: ownerRequire("exif-reader/package.json").version,
    },
  },
  photograph: {
    ...historical.photograph,
    asset: "/projects/elliot-mairet/palette-extraction/mmcq-v1/photograph.webp",
    assetSha256: hash(photograph),
    width: 1200,
    height: (await sharp(photograph).metadata()).height,
  },
  analysis: {
    algorithm: MMCQ_VIBRANT_ALGORITHM,
    quantisationPhases: MMCQ_PASSES,
    maximumSampleLongestSide: MMCQ_SAMPLE_LONGEST_SIDE,
    sampleWidth: info.width,
    sampleHeight: info.height,
    sampleSha256: hash(data),
    opaquePixels: pixels.length,
    displayedSampleStride: stride,
    paletteOrder: "production selection order, not population-weight order",
    note: "Original-file production analysis, reproduced locally. Display samples are assigned to their nearest selected swatch in OKLab; grouping and timing are illustrative, not recorded MMCQ boxes, solver steps or measured latency. This is not a read of saved catalogue data.",
  },
  palette: features.map(({ rgb, oklab, weight }, index) => ({
    hex: hex(rgb),
    oklab,
    weight,
    storedWeight: analysed.colours[index].weight,
  })),
  tiles,
};
const destination = path.join(historicalDirectory, "mmcq-v1");
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
  `${check ? "Verified" : "Recorded"} ${pixels.length} pixels, ${tiles.length} display samples and ${features.length} production MMCQ swatches.`,
);
