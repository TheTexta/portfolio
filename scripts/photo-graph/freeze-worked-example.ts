/** Deliberate local freeze: node --import tsx scripts/photo-graph/freeze-worked-example.ts
 * Reads only public originals; no environment loading, database or remote writes.
 * Reuses originals in ignored .tmp/photo-graph-worked-example/ on subsequent runs.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";
import sharp from "sharp";
import { format } from "prettier";
import { featureFromRgb } from "../../lib/photo-graph/feature-extraction";
import { measureMeanRgb } from "../../lib/photo-graph/mean-rgb";
import { computePhotoGraphModelDistance } from "../../lib/photo-graph/similarity-models";
import { generateSparsePhotoGraph } from "../../lib/photo-graph/sparse-edge-generation";
import type {
  GraphNode,
  PhotoGraphSparseEdgeGenerationConfig,
} from "../../lib/photo-graph/types";

const idSource = "public/projects/photo-graph/color-features-v1.json";
const output = "public/projects/photo-graph/worked-example";
const publicRoot = "/projects/photo-graph/worked-example";
const cache = ".tmp/photo-graph-worked-example";
const runningIds = ["112", "27", "65"];
const cataloguePath = path.join(output, "source-catalogue.json");
const catalogueUrl = "https://dextery.dev/api/photo-graph/graph";
type SourceIdentity = {
  id: string;
  sourceUrl: string;
  storagePath: string;
  storageProvider: string;
};
type SourceCatalogue = {
  version: 1;
  fetchedAt: string;
  url: string;
  responseSha256: string;
  nodes: SourceIdentity[];
};
const config: PhotoGraphSparseEdgeGenerationConfig = {
  version: 2,
  model: "mean-lab-ciede2000",
  neighborsPerNode: 4,
  maxDistance: 16,
};
const hash = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");

async function boundedGet(url: string, limit: number) {
  const response = await fetch(url, {
    redirect: "error",
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  const reader = response.body!.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) {
      await reader.cancel();
      throw new Error(`${url} exceeds the ${limit}-byte bound`);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

function validateIdentities(catalogue: SourceCatalogue, ids: string[]) {
  if (
    catalogue.version !== 1 ||
    catalogue.url !== catalogueUrl ||
    !Number.isFinite(Date.parse(catalogue.fetchedAt)) ||
    !/^[a-f0-9]{64}$/.test(catalogue.responseSha256) ||
    catalogue.nodes.length !== ids.length
  )
    throw new Error("Invalid frozen source catalogue");
  for (const [index, node] of catalogue.nodes.entries()) {
    const url = new URL(node.sourceUrl);
    if (
      node.id !== ids[index] ||
      node.storageProvider !== "r2" ||
      url.origin !== "https://media.dextery.dev" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !new RegExp(
        `^/photo-graph/photography-images/${node.id}\\.(png|jpe?g)$`,
      ).test(url.pathname) ||
      node.storagePath !== url.pathname.slice("/photo-graph/".length)
    )
      throw new Error(`Invalid source identity for ${node.id}`);
  }
}

async function sourceCatalogue(ids: string[]) {
  if (!process.argv.includes("--refresh")) {
    try {
      const bytes = await readFile(cataloguePath);
      const catalogue: SourceCatalogue = JSON.parse(bytes.toString());
      validateIdentities(catalogue, ids);
      return { catalogue, bytes };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  const response = await boundedGet(catalogueUrl, 8 * 1024 * 1024);
  const publicNodes = JSON.parse(response.toString()).nodes as SourceIdentity[];
  const catalogue: SourceCatalogue = {
    version: 1,
    fetchedAt: new Date().toISOString(),
    url: catalogueUrl,
    responseSha256: hash(response),
    nodes: ids.map((id) => {
      const matches = publicNodes.filter((node) => String(node.id) === id);
      if (matches.length !== 1)
        throw new Error(`Expected one public source identity for ${id}`);
      const node = matches[0];
      return {
        id,
        sourceUrl: node.sourceUrl,
        storagePath: node.storagePath,
        storageProvider: node.storageProvider,
      };
    }),
  };
  validateIdentities(catalogue, ids);
  const bytes = Buffer.from(
    await format(JSON.stringify(catalogue), { parser: "json" }),
  );
  await writeFile(cataloguePath, bytes);
  return { catalogue, bytes };
}

function imageMime(bytes: Buffer) {
  if (
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return "image/png";
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
    return "image/jpeg";
  throw new Error("Expected original PNG or JPEG bytes");
}

async function original(identity: SourceIdentity) {
  const url = identity.sourceUrl;
  const file = path.join(cache, path.basename(identity.storagePath));
  const bindingPath = `${file}.json`;
  try {
    const bytes = await readFile(file);
    try {
      const binding = JSON.parse(await readFile(bindingPath, "utf8"));
      if (binding.url !== url || binding.sha256 !== hash(bytes))
        throw new Error(`Cache binding mismatch for ${identity.id}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      throw new Error(
        `Unbound cache entry for ${identity.id}; recover its original URL/checksum binding or deliberately remove this one cached file and download it again.`,
      );
    }
    return { url, bytes, mime: imageMime(bytes) };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const bytes = await boundedGet(url, 256 * 1024 * 1024);
  const mime = imageMime(bytes);
  await writeFile(`${file}.partial`, bytes);
  await rename(`${file}.partial`, file);
  await writeFile(bindingPath, JSON.stringify({ url, sha256: hash(bytes) }));
  return { url, bytes, mime };
}

async function run() {
  const sourceBytes = await readFile(idSource);
  const ids = Object.keys(JSON.parse(sourceBytes.toString()).nodes).sort(
    (a, b) => Number(a) - Number(b),
  );
  if (
    ids.length !== 100 ||
    ids.some((id) => !/^\d+$/.test(id)) ||
    runningIds.some((id) => !ids.includes(id))
  ) {
    throw new Error(
      "Expected exactly 100 numeric archive IDs including 112, 27 and 65",
    );
  }
  const gallery = JSON.parse(
    await readFile("public/projects/photo-graph/write-up/gallery.json", "utf8"),
  );
  const descriptions = new Map<string, string>();
  for (const image of [
    ...gallery.reviewImages,
    ...gallery.comparison.rows.flatMap(
      (row: { images: { id: string; alt: string }[] }) => row.images,
    ),
  ]) {
    descriptions.set(image.id, image.alt);
  }
  const labels: Record<string, string> = {
    "112": "Performance",
    "27": "Harbour",
    "65": "Amber interior",
  };
  await mkdir(cache, { recursive: true });
  await mkdir(path.join(output, "thumbnails"), { recursive: true });
  await mkdir(path.join(output, "analysis"), { recursive: true });
  const frozenSources = await sourceCatalogue(ids);
  const snapshotAt = new Date().toISOString();
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    // Intercepted same-origin bytes avoid image re-fetching and tainted canvases.
    // No browser requests reach any remote host.
    let imageBytes: Buffer = Buffer.alloc(0);
    let imageContentType = "image/png";
    await page.route("**/*", async (route) => {
      if (route.request().url() === "https://photo-graph-freeze.invalid/") {
        await route.fulfill({
          contentType: "text/html",
          body: "<!doctype html><title>Local raster extraction</title>",
        });
      } else if (
        route
          .request()
          .url()
          .startsWith("https://photo-graph-freeze.invalid/original/")
      ) {
        await route.fulfill({
          contentType: imageContentType,
          body: imageBytes,
        });
      } else await route.abort();
    });
    await page.goto("https://photo-graph-freeze.invalid/");
    const nodes = [];
    for (const id of ids) {
      const identity = frozenSources.catalogue.nodes.find(
        (node) => node.id === id,
      )!;
      const source = await original(identity);
      imageBytes = source.bytes;
      imageContentType = source.mime;
      const raster = await page.evaluate(async (id) => {
        const image = new Image();
        image.src = `/original/${id}`;
        await image.decode();
        const sourceWidth = image.naturalWidth;
        const sourceHeight = image.naturalHeight;
        if (!sourceWidth || !sourceHeight)
          throw new Error("Invalid source dimensions");
        const longSide = Math.max(sourceWidth, sourceHeight);
        const ratio = longSide > 1024 ? 1024 / longSide : 1;
        const width = Math.max(1, Math.round(sourceWidth * ratio));
        const height = Math.max(1, Math.round(sourceHeight * ratio));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) throw new Error("No Canvas2D context");
        context.drawImage(image, 0, 0, width, height);
        const pixels = context.getImageData(0, 0, width, height);
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () =>
            resolve((reader.result as string).split(",")[1]);
          reader.onerror = () => reject(new Error("RGBA serialization failed"));
          reader.readAsDataURL(new Blob([pixels.data.buffer]));
        });
        return {
          sourceWidth,
          sourceHeight,
          width,
          height,
          longSide,
          base64,
          context: context.getContextAttributes(),
          colorSpace: pixels.colorSpace,
        };
      }, id);
      const rgba = Buffer.from(raster.base64, "base64");
      if (
        rgba.length !== raster.width * raster.height * 4 ||
        raster.colorSpace !== "srgb"
      ) {
        throw new Error(`Invalid RGBA8 sRGB raster for ${id}`);
      }
      const measured = measureMeanRgb({ data: rgba });
      const feature = featureFromRgb(measured.rgb, raster.longSide);
      const raw = {
        width: raster.width,
        height: raster.height,
        channels: 4 as const,
      };
      const thumbnail = await sharp(rgba, { raw })
        .resize({
          width: runningIds.includes(id) ? 560 : 160,
          withoutEnlargement: true,
        })
        .webp({ quality: 88 })
        .toBuffer({ resolveWithObject: true });
      await writeFile(
        path.join(output, "thumbnails", `${id}.webp`),
        thumbnail.data,
      );
      let detail: {
        src?: string;
        pngSha256?: string;
        patch?: {
          x: number;
          y: number;
          width: number;
          height: number;
          rgba: number[];
        };
      } = {};
      if (runningIds.includes(id)) {
        const png = await sharp(rgba, { raw }).png().toBuffer();
        await writeFile(path.join(output, "analysis", `${id}.png`), png);
        const x = Math.floor((raster.width - 4) / 2);
        const y = Math.floor((raster.height - 4) / 2);
        const patch = [];
        for (let row = 0; row < 4; row++) {
          const start = ((y + row) * raster.width + x) * 4;
          patch.push(...rgba.subarray(start, start + 16));
        }
        detail = {
          src: `${publicRoot}/analysis/${id}.png`,
          pngSha256: hash(png),
          patch: { x, y, width: 4, height: 4, rgba: patch },
        };
      }
      nodes.push({
        id,
        label: labels[id] ?? `Photograph ${id}`,
        alt: descriptions.get(id) ?? `Photograph ${id}.`,
        src: `${publicRoot}/thumbnails/${id}.webp`,
        width: thumbnail.info.width,
        height: thumbnail.info.height,
        assetSha256: hash(thumbnail.data),
        source: {
          url: source.url,
          sha256: hash(source.bytes),
          bytes: source.bytes.length,
          width: raster.sourceWidth,
          height: raster.sourceHeight,
          storagePath: identity.storagePath,
          storageProvider: identity.storageProvider,
          contentType: source.mime,
        },
        analysis: {
          width: raster.width,
          height: raster.height,
          pixelCount: raster.width * raster.height,
          weightSum: measured.weightSum,
          sums: measured.sums,
          rgbaSha256: hash(rgba),
          ...detail,
        },
        ...feature,
      });
      console.log(
        `Frozen ${nodes.length}/100: ${id} (${raster.width}×${raster.height})`,
      );
    }
    const pairs = [];
    for (let left = 0; left < nodes.length; left++) {
      for (let right = left + 1; right < nodes.length; right++) {
        pairs.push({
          source: nodes[left].id,
          target: nodes[right].id,
          cie76: computePhotoGraphModelDistance(
            nodes[left],
            nodes[right],
            "mean-lab-cie76",
          ),
          ciede2000: computePhotoGraphModelDistance(
            nodes[left],
            nodes[right],
            "mean-lab-ciede2000",
          ),
        });
      }
    }
    const query = nodes.find((node) => node.id === "112")!;
    const queryRanking = nodes
      .filter((node) => node.id !== query.id)
      .map((node) => ({
        id: node.id,
        distance: computePhotoGraphModelDistance(query, node, config.model),
      }))
      .sort((a, b) => a.distance - b.distance || Number(a.id) - Number(b.id))
      .map((node, index) => ({ ...node, rank: index + 1 }));
    const graphNodes: GraphNode[] = nodes.map((node) => ({
      id: node.id,
      url: node.src,
      colour: "",
      scale: 1,
      correlations: {},
      feature: {
        rgb: node.rgb,
        lab: node.lab,
        hue: node.hue,
        longSide: node.longSide,
      },
    }));
    const generated = generateSparsePhotoGraph(graphNodes, config);
    const edges = generated.nodes.flatMap((node) =>
      Object.entries(node.correlations)
        .filter(([target]) => Number(node.id) < Number(target))
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([target, weight]) => ({ source: node.id, target, weight })),
    );
    if (
      nodes.length !== 100 ||
      pairs.length !== 4950 ||
      queryRanking.length !== 99
    )
      throw new Error("Incomplete freeze");
    const fixture = {
      version: 1,
      snapshotAt,
      queryId: "112",
      candidateIds: ["27", "65"],
      dataset: {
        idSource,
        idSourceSha256: hash(sourceBytes),
        sourceCatalogue: `${publicRoot}/source-catalogue.json`,
        sourceCatalogueSha256: hash(frozenSources.bytes),
        sourceCatalogueFetchedAt: frozenSources.catalogue.fetchedAt,
        sourceCatalogueUrl: catalogueUrl,
        publicResponseSha256: frozenSources.catalogue.responseSha256,
        description:
          "New public-original extraction for the 100 archive IDs in the saved August 2026 feature catalogue; not historical August descriptors or the evolving live catalogue.",
      },
      extraction: {
        chromiumVersion: browser.version(),
        decoder:
          "Chromium HTMLImageElement.decode() of verified original PNG/JPEG bytes",
        sourceCache: cache,
        originalRequestPolicy:
          "Sequential public GET, no query, no redirects, 60 second timeout, 256 MiB maximum; reuse URL/checksum-bound cached originals",
        canvas:
          "Default Canvas2D sRGB with willReadFrequently:true; transparent initial canvas; drawImage; default imageSmoothingEnabled:true and imageSmoothingQuality:low",
        resize:
          "Longest side at most 1024; no upscale; max(1, Math.round(sourceDimension * ratio)); browser default image orientation/color management",
        raster:
          "getImageData RGBA8, unpremultiplied encoded sRGB channels; row-major RGBA bytes",
        alpha:
          "weight = A/255; skip alpha <= 0; weightSum = sum(weight); sums = sum(encoded channel * weight); RGB = sums/(weightSum || 1); no background compositing, no linear-light averaging",
        descriptor:
          "measureMeanRgb then featureFromRgb; LAB = rgbToLab(mean encoded RGB), D65; longSide is original decoded longest side",
        analysisPng:
          "Lossless PNG encoded with Sharp directly from Chromium analysis RGBA; never used as extraction input",
        thumbnails:
          "Sharp WebP quality 88 from the same analysis RGBA; width up to 560 for 112/27/65, up to 160 otherwise; aspect retained, no upscale",
        patch:
          "Central 4x4 analysis pixels; zero-based top-left x,y; row-major RGBA; illustrative patch only, full raster supplies mean",
        reproducibility:
          "Cache preserves original bytes; rerunning uses installed Chromium and records a new snapshotAt. Browser version changes can change raster results.",
      },
      config,
      nodes,
      pairs,
      queryRanking,
      defaultGraph: { nominations: generated.neighbors, edges },
    };
    const temporary = path.join(cache, "fixture.json.partial");
    await writeFile(
      temporary,
      await format(JSON.stringify(fixture), { parser: "json" }),
    );
    await rename(temporary, path.join(output, "fixture.json"));
    console.log(
      JSON.stringify(
        {
          snapshotAt,
          nodes: nodes.length,
          pairs: pairs.length,
          edges: edges.length,
          candidates: queryRanking.filter((entry) =>
            ["27", "65"].includes(entry.id),
          ),
          queryNominations: generated.neighbors.filter(
            (entry) => entry.sourceId === "112",
          ),
          queryEdges: edges.filter(
            (edge) => edge.source === "112" || edge.target === "112",
          ),
        },
        null,
        2,
      ),
    );
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
