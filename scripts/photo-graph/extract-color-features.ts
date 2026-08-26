import { loadEnvConfig } from "@next/env";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp, { type OverlayOptions } from "sharp";

import { extractPhotoGraphColorFeatureV1 } from "../../lib/photo-graph/color-features";
import { upsertPhotoGraphNodes } from "../../lib/photo-graph/database";
import { loadGraphWithFallback } from "../../lib/photo-graph/graph-store";
import { buildSupabaseStorageRenderUrl } from "../../lib/supabase/config";
import type {
  GraphNode,
  PhotoGraphColorFeatureV1,
} from "../../lib/photo-graph/types";

const OUTPUT_PATH = path.join(
  process.cwd(),
  "public",
  "projects",
  "photo-graph",
  "color-features-v1.json",
);
const CONTACT_SHEET_PATH = path.join(
  process.cwd(),
  "test-results",
  "photo-graph",
  "color-contact-sheet.png",
);
const EXTRACTION_WIDTH = 512;
const CONTACT_THUMBNAIL_SIZE = 112;
const CONTACT_COLUMNS = 10;

type FeatureCatalog = {
  version: 1;
  generatedAt: string;
  source: "database" | "static";
  nodes: Record<string, PhotoGraphColorFeatureV1>;
};

function sourceUrl(node: GraphNode, width = EXTRACTION_WIDTH) {
  if (node.storagePath) {
    return buildSupabaseStorageRenderUrl(node.storagePath, {
      width,
      quality: 85,
    });
  }
  if (node.url) {
    return node.url;
  }
  throw new Error(`Node ${node.id} has no image source.`);
}

async function fetchBuffer(url: string) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Image request failed (${response.status}) for ${url}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function extractNodeFeature(node: GraphNode) {
  const input = await fetchBuffer(sourceUrl(node));
  const { data, info } = await sharp(input)
    .rotate()
    .resize({
      width: EXTRACTION_WIDTH,
      height: EXTRACTION_WIDTH,
      fit: "inside",
      withoutEnlargement: true,
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  return extractPhotoGraphColorFeatureV1({
    data,
    width: info.width,
    height: info.height,
  });
}

function labelSvg(id: string) {
  const escaped = id.replace(/[&<>"']/g, "");
  return Buffer.from(
    `<svg width="${CONTACT_THUMBNAIL_SIZE}" height="18" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#111111"/><text x="5" y="13" fill="#f4f4f0" font-family="Arial, sans-serif" font-size="11">${escaped}</text></svg>`,
  );
}

async function buildContactSheet(nodes: GraphNode[]) {
  const rows = Math.ceil(nodes.length / CONTACT_COLUMNS);
  const tileHeight = CONTACT_THUMBNAIL_SIZE + 18;
  const composites: OverlayOptions[] = [];

  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    const thumbnail = await sharp(await fetchBuffer(sourceUrl(node, 180)))
      .rotate()
      .resize(CONTACT_THUMBNAIL_SIZE, CONTACT_THUMBNAIL_SIZE, {
        fit: "cover",
        position: "attention",
      })
      .png()
      .toBuffer();
    const left = (index % CONTACT_COLUMNS) * CONTACT_THUMBNAIL_SIZE;
    const top = Math.floor(index / CONTACT_COLUMNS) * tileHeight;
    composites.push({ input: thumbnail, left, top });
    composites.push({
      input: labelSvg(node.id),
      left,
      top: top + CONTACT_THUMBNAIL_SIZE,
    });
  }

  await mkdir(path.dirname(CONTACT_SHEET_PATH), { recursive: true });
  await sharp({
    create: {
      width: CONTACT_COLUMNS * CONTACT_THUMBNAIL_SIZE,
      height: rows * tileHeight,
      channels: 4,
      background: "#e8e8e3",
    },
  })
    .composite(composites)
    .png()
    .toFile(CONTACT_SHEET_PATH);
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T, index: number) => Promise<R>,
) {
  const results = new Array<R>(values.length);
  let nextIndex = 0;

  async function worker() {
    for (;;) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= values.length) {
        return;
      }
      results[index] = await mapper(values[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, worker),
  );
  return results;
}

async function run() {
  loadEnvConfig(process.cwd());
  const shouldPersist = process.argv.includes("--persist");
  const loaded = await loadGraphWithFallback();
  const nodes = [...loaded.nodes].sort((left, right) => Number(left.id) - Number(right.id));
  const features = await mapWithConcurrency(nodes, 4, async (node, index) => {
    const feature = await extractNodeFeature(node);
    process.stdout.write(`\rExtracted ${index + 1}/${nodes.length} images`);
    return feature;
  });
  process.stdout.write("\n");

  const catalog: FeatureCatalog = {
    version: 1,
    generatedAt: new Date().toISOString(),
    source: loaded.source,
    nodes: Object.fromEntries(nodes.map((node, index) => [node.id, features[index]])),
  };

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(catalog)}\n`, "utf8");
  await buildContactSheet(nodes);

  if (shouldPersist) {
    if (!loaded.databaseAvailable) {
      throw new Error("Database persistence is unavailable.");
    }
    for (let index = 0; index < nodes.length; index += 1) {
      const feature = nodes[index].feature;
      if (!feature) {
        continue;
      }
      feature.colorV1 = features[index];
    }
    await upsertPhotoGraphNodes(nodes);
  }

  console.log(`Wrote ${nodes.length} versioned features to ${OUTPUT_PATH}.`);
  console.log(`Wrote contact sheet to ${CONTACT_SHEET_PATH}.`);
  console.log(shouldPersist ? "Persisted features to Supabase." : "Database unchanged; pass --persist after applying the schema migration.");
}

run().catch((error) => {
  console.error("Photo graph color extraction failed.");
  console.error(error);
  process.exit(1);
});