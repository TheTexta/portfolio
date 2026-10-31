import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

// Local asset preparation only. Reads published images over HTTPS; never uses
// credentials, contacts the database, or writes to remote storage.
const root = new URL("../../", import.meta.url);
const reportPath = "public/projects/photo-graph/color-model-benchmark-v1.json";
const report = JSON.parse(await readFile(new URL(reportPath, root), "utf8"));
const output = new URL("public/projects/photo-graph/write-up/", root);
const queryId = "112";
const modelIds = ["mean-oklab", "mean-lab-ciede2000"];
const models = modelIds.map((id) =>
  report.models.find((model) => model.id === id),
);
const rows = models.map((model) =>
  model.queries.find((query) => query.id === queryId).neighbors.slice(0, 4),
);
const ids = [
  ...new Set([
    ...report.queryIds,
    ...rows.flatMap((neighbors) => neighbors.map((neighbor) => neighbor.id)),
  ]),
];
const sources = [];
for (const id of ids) {
  const url = new URL(
    `photography-images/${id}.png`,
    "https://images.dextery.dev/photo-graph/",
  );
  url.search = new URLSearchParams({
    width: "560",
    quality: "86",
    format: "auto",
  }).toString();
  const response = await fetch(url, {
    headers: { Accept: "image/webp" },
    signal: AbortSignal.timeout(30_000),
  });
  if (
    !response.ok ||
    !response.headers.get("content-type")?.startsWith("image/")
  )
    throw new Error(
      `Cannot read published photo ${id}: HTTP ${response.status}`,
    );
  const bytes = Buffer.from(await response.arrayBuffer());
  await sharp(bytes).metadata();
  sources.push({
    id,
    url: url.toString(),
    sha256: createHash("sha256").update(bytes).digest("hex"),
    bytes,
  });
}
const descriptions = {
  14: "A snow-covered street lined with trees at night.",
  46: "Dense texture across a wall of perforated metal panels.",
  49: "A high-contrast scene with magenta light and layered lettering.",
  57: "A black-and-white view down a narrow alley.",
  65: "An amber-lit interior with carved wood and a row of statues.",
  69: "Dense green woodland around a clearing.",
  112: "People at a performance under blue and magenta lights.",
  75: "A crowd facing a stage under blue light.",
  27: "Sailboats in a harbour at blue hour.",
  105: "Steps and vegetation overlooking a sheltered inlet.",
  13: "A stark black-and-white image of people and bicycles.",
  24: "Snow-covered mountains beneath a dark sky.",
  32: "A crowd beneath bright violet stage lighting.",
};

await mkdir(new URL("photographs/", output), { recursive: true });
const photos = new Map();
for (const source of sources) {
  if (!descriptions[source.id])
    throw new Error(`Add reviewed alt text for photograph ${source.id}.`);
  const file = `photographs/${source.id}.webp`;
  const bytes = await sharp(source.bytes).webp({ quality: 88 }).toBuffer();
  const { width, height } = await sharp(bytes).metadata();
  await writeFile(new URL(file, output), bytes);
  source.asset = file;
  source.assetSha256 = createHash("sha256").update(bytes).digest("hex");
  photos.set(source.id, {
    id: source.id,
    src: `/projects/photo-graph/write-up/${file}`,
    width,
    height,
    alt: descriptions[source.id],
  });
}

const gallery = {
  reviewImages: report.queryIds.map((id) => ({
    ...photos.get(id),
    label: models[0].queries.find((query) => query.id === id).label,
  })),
  comparison: {
    query: { ...photos.get(queryId), label: "Starting photograph" },
    rows: models.map((model, index) => ({
      label: model.label,
      images: rows[index].map((neighbor) => photos.get(neighbor.id)),
    })),
  },
};
await writeFile(
  new URL("gallery.json", output),
  `${JSON.stringify(gallery, null, 2)}\n`,
);
await writeFile(
  new URL("sources.json", output),
  `${JSON.stringify(
    {
      benchmark: reportPath,
      benchmarkGeneratedAt: report.generatedAt,
      preparationScript: "scripts/photo-graph/prepare-write-up-media.mjs",
      note: "Individual published photographs for responsive article galleries, not generated imagery. Article rendering uses local files only. Legacy composite files are retained but no longer displayed.",
      galleries: {
        review: { queryIds: report.queryIds },
        comparison: {
          queryId,
          rows: models.map((model, index) => ({
            model: model.id,
            neighbourIds: rows[index].map((neighbor) => neighbor.id),
          })),
        },
      },
      sources: sources.map(({ id, url, sha256, asset, assetSha256 }) => ({
        id,
        url,
        sha256,
        asset,
        assetSha256,
      })),
    },
    null,
    2,
  )}\n`,
);
console.log(
  `Prepared ${photos.size} photographs and gallery data in ${fileURLToPath(output)}`,
);
