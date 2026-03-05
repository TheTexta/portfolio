import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import { loadEnvConfig } from "@next/env";

import {
  NEPOBABIES_PREVIEW_BASE_PATH,
  type NepobabiesAssetManifest,
  getNepobabiesAssetVersion,
  getNepobabiesStorageBucket,
  nepobabiesAssetUrl,
  nepobabiesObjectPathForAsset,
  nepobabiesObjectPrefix,
  resolveNepobabiesAssetPathFromFirebaseUrl,
  resolveRelativeNepobabiesAssetPath,
} from "../../lib/nepobabies/assets";

type Mode = "dry-run" | "upload" | "verify" | "rewrite";

type CliOptions = {
  mode: Mode;
  version: string;
};

type AssetRecord = {
  assetPath: string;
  absolutePath: string;
  objectPath: string;
  publicUrl: string;
  bytes: number;
  sha256: string;
  contentType: string;
  body: Buffer;
};

const PROJECT_ROOT = process.cwd();
const NEPOBABIES_ROOT = path.join(
  PROJECT_ROOT,
  "app/components/projects/nepobabiesruntheunderground",
);
const SOURCE_ASSET_DIR = path.join(NEPOBABIES_ROOT, "assets");
const MANIFEST_PATH = path.join(NEPOBABIES_ROOT, "assets-manifest.json");
const INDEX_HTML_PATH = path.join(NEPOBABIES_ROOT, "index.html");
const ME_HTML_PATH = path.join(NEPOBABIES_ROOT, "me.html");
const JOURNAL_PATH = path.join(NEPOBABIES_ROOT, "journal.json");

const VERSIONED_CACHE_CONTROL = "public,max-age=31536000,immutable";

const TEXT_EXTENSIONS = new Set([
  ".css",
  ".frag",
  ".html",
  ".js",
  ".json",
  ".manifest",
  ".svg",
  ".txt",
  ".vert",
  ".webmanifest",
]);

function contentTypeForExtension(extension: string) {
  switch (extension) {
    case ".css":
      return "text/css; charset=utf-8";
    case ".frag":
      return "text/plain; charset=utf-8";
    case ".gif":
      return "image/gif";
    case ".ico":
      return "image/x-icon";
    case ".jpeg":
    case ".jpg":
      return "image/jpeg";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".manifest":
    case ".webmanifest":
      return "application/manifest+json; charset=utf-8";
    case ".mp4":
      return "video/mp4";
    case ".png":
      return "image/png";
    case ".svg":
      return "image/svg+xml";
    case ".vert":
      return "text/plain; charset=utf-8";
    case ".webm":
      return "video/webm";
    default:
      return "application/octet-stream";
  }
}

function sha256Hex(value: Buffer | string) {
  return createHash("sha256").update(value).digest("hex");
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceAllLiteral(source: string, target: string, replacement: string) {
  if (!target || source.includes(target) === false) {
    return source;
  }

  return source.split(target).join(replacement);
}

function parseMode(value: string): Mode {
  if (value === "dry-run" || value === "upload" || value === "verify" || value === "rewrite") {
    return value;
  }

  throw new Error(`Unsupported mode: ${value}`);
}

function parseArgs(argv: string[]): CliOptions {
  let mode: Mode | null = null;
  let version: string | null = null;

  for (const arg of argv) {
    if (arg.startsWith("--mode=")) {
      mode = parseMode(arg.slice("--mode=".length).trim());
      continue;
    }

    if (arg.startsWith("--version=")) {
      version = arg.slice("--version=".length).trim();
      continue;
    }
  }

  if (!mode) {
    throw new Error("Missing required argument: --mode=dry-run|upload|verify|rewrite");
  }

  if (!version) {
    throw new Error("Missing required argument: --version=vYYYYMMDD-N");
  }

  if (!/^v[0-9A-Za-z._-]+$/.test(version)) {
    throw new Error(`Invalid version format: ${version}`);
  }

  return { mode, version };
}

async function pathExists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function listFilesRecursively(dirPath: string): Promise<string[]> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const absolutePath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        return listFilesRecursively(absolutePath);
      }

      if (entry.isFile()) {
        return [absolutePath];
      }

      return [];
    }),
  );

  return nested.flat();
}

function replaceFirebaseUrls(source: string, urlByAssetPath: Record<string, string>) {
  let output = source;

  const firebasePattern =
    /https:\/\/(?:firebasestorage\.googleapis\.com\/v0\/b\/[^"'\s<>)]+|storage\.googleapis\.com\/[^"'\s<>)]+|[^"'\s<>)]+\.storage\.googleapis\.com\/[^"'\s<>)]+)/g;

  output = output.replace(firebasePattern, (match) => {
    const assetPath = resolveNepobabiesAssetPathFromFirebaseUrl(match);
    if (!assetPath) {
      return match;
    }

    return urlByAssetPath[assetPath] ?? match;
  });

  return output;
}

function replaceDirectAssetPaths(source: string, urlByAssetPath: Record<string, string>) {
  let output = source;

  const assetPaths = Object.keys(urlByAssetPath).sort((a, b) => b.length - a.length);

  for (const assetPath of assetPaths) {
    const replacement = urlByAssetPath[assetPath];

    output = replaceAllLiteral(
      output,
      `${NEPOBABIES_PREVIEW_BASE_PATH}${assetPath}`,
      replacement,
    );

    output = replaceAllLiteral(output, `./${assetPath}`, replacement);
    output = replaceAllLiteral(output, `/${assetPath}`, replacement);

    const boundaryPattern = new RegExp(`(?<![A-Za-z0-9_%])${escapeRegex(assetPath)}(?=[?#"'\\s<>)]|$)`, "g");
    output = output.replace(boundaryPattern, replacement);
  }

  return output;
}

function replaceRelativeCssUrls(
  source: string,
  cssAssetPath: string,
  urlByAssetPath: Record<string, string>,
) {
  return source.replace(
    /url\(\s*(["']?)([^"')]+)\1\s*\)/gi,
    (match, _quote: string, rawUrl: string) => {
      const assetPath = resolveRelativeNepobabiesAssetPath(cssAssetPath, rawUrl);
      if (!assetPath) {
        return match;
      }

      const replacement = urlByAssetPath[assetPath];
      if (!replacement) {
        return match;
      }

      return `url("${replacement}")`;
    },
  );
}

function rewriteTextDocument(
  source: string,
  assetPath: string,
  urlByAssetPath: Record<string, string>,
) {
  let output = source;

  output = replaceFirebaseUrls(output, urlByAssetPath);
  output = replaceDirectAssetPaths(output, urlByAssetPath);

  if (assetPath.endsWith(".css")) {
    output = replaceRelativeCssUrls(output, assetPath, urlByAssetPath);
  }

  if (assetPath === "assets/js/blog.js") {
    output = output.replace(
      /fetch\(\s*(["'])journal\.json\1\s*\)/g,
      `fetch("${NEPOBABIES_PREVIEW_BASE_PATH}journal.json")`,
    );
  }

  return output;
}

async function buildAssetRecords(options: {
  version: string;
  bucket: string;
}) {
  const assetDirExists = await pathExists(SOURCE_ASSET_DIR);

  if (!assetDirExists) {
    throw new Error(
      `Source assets directory not found: ${SOURCE_ASSET_DIR}. Run upload/dry-run before deleting local assets, or use manifest-backed modes (verify/rewrite).`,
    );
  }

  const absoluteFiles = (await listFilesRecursively(SOURCE_ASSET_DIR)).sort();

  const assetPaths = absoluteFiles.map((absolutePath) => {
    const relativePath = path.relative(SOURCE_ASSET_DIR, absolutePath).replace(/\\/g, "/");

    return `assets/${relativePath}`;
  });

  const urlByAssetPath: Record<string, string> = {};

  for (const assetPath of assetPaths) {
    urlByAssetPath[assetPath] = nepobabiesAssetUrl(assetPath, {
      version: options.version,
      bucket: options.bucket,
    });
  }

  const records: AssetRecord[] = [];

  for (let index = 0; index < absoluteFiles.length; index += 1) {
    const absolutePath = absoluteFiles[index];
    const assetPath = assetPaths[index];
    const extension = path.extname(assetPath).toLowerCase();
    const contentType = contentTypeForExtension(extension);

    const rawBuffer = await fs.readFile(absolutePath);
    let body = rawBuffer;

    if (TEXT_EXTENSIONS.has(extension)) {
      const transformedText = rewriteTextDocument(rawBuffer.toString("utf-8"), assetPath, urlByAssetPath);
      body = Buffer.from(transformedText, "utf-8");
    }

    records.push({
      assetPath,
      absolutePath,
      objectPath: nepobabiesObjectPathForAsset(assetPath, options.version),
      publicUrl: urlByAssetPath[assetPath],
      bytes: body.byteLength,
      sha256: sha256Hex(body),
      contentType,
      body,
    });
  }

  return records;
}

function toManifest(
  records: AssetRecord[],
  options: {
    version: string;
    bucket: string;
  },
): NepobabiesAssetManifest {
  const byPath: NepobabiesAssetManifest["byPath"] = {};

  for (const record of records) {
    byPath[record.assetPath] = {
      objectPath: record.objectPath,
      publicUrl: record.publicUrl,
      bytes: record.bytes,
      sha256: record.sha256,
      contentType: record.contentType,
    };
  }

  return {
    version: options.version,
    bucket: options.bucket,
    baseObjectPrefix: nepobabiesObjectPrefix(options.version),
    generatedAt: new Date().toISOString(),
    byPath,
  };
}

async function writeManifest(manifest: NepobabiesAssetManifest) {
  const payload = `${JSON.stringify(manifest, null, 2)}\n`;
  await fs.writeFile(MANIFEST_PATH, payload, "utf-8");
}

async function readManifest() {
  if (!(await pathExists(MANIFEST_PATH))) {
    throw new Error(`Manifest not found: ${MANIFEST_PATH}`);
  }

  const raw = await fs.readFile(MANIFEST_PATH, "utf-8");
  const parsed = JSON.parse(raw) as NepobabiesAssetManifest;

  if (!parsed || typeof parsed !== "object" || !parsed.byPath) {
    throw new Error(`Invalid manifest structure in ${MANIFEST_PATH}`);
  }

  return parsed;
}

function summarize(records: AssetRecord[]) {
  const totalBytes = records.reduce((sum, record) => sum + record.bytes, 0);
  const mb = (totalBytes / (1024 * 1024)).toFixed(2);

  console.log(`Assets discovered: ${records.length}`);
  console.log(`Transformed upload payload size: ${mb} MB (${totalBytes} bytes)`);

  const topFive = [...records].sort((a, b) => b.bytes - a.bytes).slice(0, 5);

  console.log("Largest files:");
  for (const file of topFive) {
    console.log(`  - ${file.assetPath} (${file.bytes} bytes)`);
  }
}

async function uploadAssets(records: AssetRecord[]) {
  const { getFirebaseAdminBucket } = await import("../../lib/server/firebase-admin");
  const bucket = getFirebaseAdminBucket();

  for (const [index, record] of records.entries()) {
    const file = bucket.file(record.objectPath);

    await file.save(record.body, {
      resumable: false,
      contentType: record.contentType,
      metadata: {
        cacheControl: VERSIONED_CACHE_CONTROL,
      },
    });

    console.log(`[${index + 1}/${records.length}] Uploaded ${record.assetPath}`);
  }
}

async function verifyManifest(manifest: NepobabiesAssetManifest) {
  const { getFirebaseAdminBucket } = await import("../../lib/server/firebase-admin");
  const bucket = getFirebaseAdminBucket();

  let hashMismatches = 0;
  let sizeMismatches = 0;
  let missingObjects = 0;
  let metadataMismatches = 0;

  const entries = Object.entries(manifest.byPath);

  for (const [index, [assetPath, expected]] of entries.entries()) {
    const file = bucket.file(expected.objectPath);
    const [exists] = await file.exists();

    if (!exists) {
      missingObjects += 1;
      console.log(`[${index + 1}/${entries.length}] Missing object: ${expected.objectPath}`);
      continue;
    }

    const [buffer] = await file.download();
    const remoteSha = sha256Hex(buffer);
    const remoteBytes = buffer.byteLength;

    if (remoteSha !== expected.sha256) {
      hashMismatches += 1;
      console.log(
        `[${index + 1}/${entries.length}] SHA mismatch for ${assetPath} expected=${expected.sha256} actual=${remoteSha}`,
      );
    }

    if (remoteBytes !== expected.bytes) {
      sizeMismatches += 1;
      console.log(
        `[${index + 1}/${entries.length}] Size mismatch for ${assetPath} expected=${expected.bytes} actual=${remoteBytes}`,
      );
    }

    const [metadata] = await file.getMetadata();
    const remoteContentType = metadata.contentType ?? "";
    const remoteCacheControl = metadata.cacheControl ?? "";

    if (
      remoteContentType !== expected.contentType ||
      remoteCacheControl !== VERSIONED_CACHE_CONTROL
    ) {
      metadataMismatches += 1;
      console.log(
        `[${index + 1}/${entries.length}] Metadata mismatch for ${assetPath} contentType=${remoteContentType} cacheControl=${remoteCacheControl}`,
      );
    }

    console.log(`[${index + 1}/${entries.length}] Verified ${assetPath}`);
  }

  const hasErrors =
    hashMismatches > 0 ||
    sizeMismatches > 0 ||
    missingObjects > 0 ||
    metadataMismatches > 0;

  console.log("Verification summary:");
  console.log(`  Missing objects: ${missingObjects}`);
  console.log(`  Size mismatches: ${sizeMismatches}`);
  console.log(`  Hash mismatches: ${hashMismatches}`);
  console.log(`  Metadata mismatches: ${metadataMismatches}`);

  if (hasErrors) {
    throw new Error("Verification failed.");
  }
}

async function rewriteShellFiles(manifest: NepobabiesAssetManifest) {
  const urlByAssetPath: Record<string, string> = {};

  for (const [assetPath, info] of Object.entries(manifest.byPath)) {
    urlByAssetPath[assetPath] = info.publicUrl;
  }

  let updatedFiles = 0;

  for (const filePath of [INDEX_HTML_PATH, ME_HTML_PATH]) {
    const source = await fs.readFile(filePath, "utf-8");
    const rewritten = rewriteTextDocument(source, "assets/dummy.html", urlByAssetPath);

    if (rewritten !== source) {
      await fs.writeFile(filePath, rewritten, "utf-8");
      updatedFiles += 1;
      console.log(`Rewrote asset references in ${path.relative(PROJECT_ROOT, filePath)}`);
    }
  }

  const journalSource = await fs.readFile(JOURNAL_PATH, "utf-8");
  const parsed = JSON.parse(journalSource) as unknown;

  if (Array.isArray(parsed)) {
    const rewrittenEntries = parsed.map((entry) => {
      if (!entry || typeof entry !== "object") {
        return entry;
      }

      const record = entry as Record<string, unknown>;

      if (typeof record.content !== "string") {
        return record;
      }

      return {
        ...record,
        content: rewriteTextDocument(record.content, "assets/dummy.html", urlByAssetPath),
      };
    });

    const serialized = `${JSON.stringify(rewrittenEntries, null, 2)}\n`;

    if (serialized !== journalSource) {
      await fs.writeFile(JOURNAL_PATH, serialized, "utf-8");
      updatedFiles += 1;
      console.log(`Rewrote asset references in ${path.relative(PROJECT_ROOT, JOURNAL_PATH)}`);
    }
  }

  console.log(`Rewrite complete. Updated files: ${updatedFiles}`);
}

async function run() {
  loadEnvConfig(PROJECT_ROOT);

  const cli = parseArgs(process.argv.slice(2));
  const configuredVersion = getNepobabiesAssetVersion();

  if (process.env.NEPOBABIES_ASSET_VERSION && configuredVersion !== cli.version) {
    throw new Error(
      `--version (${cli.version}) must match NEPOBABIES_ASSET_VERSION (${configuredVersion}).`,
    );
  }

  const bucket = getNepobabiesStorageBucket();

  console.log(`Mode: ${cli.mode}`);
  console.log(`Version: ${cli.version}`);
  console.log(`Bucket: ${bucket}`);

  if (cli.mode === "rewrite") {
    const manifest = await readManifest();

    if (manifest.version !== cli.version) {
      throw new Error(
        `Manifest version mismatch. Expected ${cli.version}, found ${manifest.version}.`,
      );
    }

    await rewriteShellFiles(manifest);
    return;
  }

  if (cli.mode === "verify") {
    const manifest = await readManifest();

    if (manifest.version !== cli.version) {
      throw new Error(
        `Manifest version mismatch. Expected ${cli.version}, found ${manifest.version}.`,
      );
    }

    if (manifest.bucket !== bucket) {
      console.warn(
        `Warning: manifest bucket (${manifest.bucket}) does not match configured bucket (${bucket}).`,
      );
    }

    await verifyManifest(manifest);
    console.log("Verification passed.");
    return;
  }

  const records = await buildAssetRecords({
    version: cli.version,
    bucket,
  });

  summarize(records);

  const manifest = toManifest(records, {
    version: cli.version,
    bucket,
  });

  await writeManifest(manifest);
  console.log(`Wrote manifest: ${path.relative(PROJECT_ROOT, MANIFEST_PATH)}`);

  if (cli.mode === "dry-run") {
    console.log("Dry run complete.");
    return;
  }

  await uploadAssets(records);
  console.log("Upload complete.");
}

run().catch((error) => {
  console.error("Nepobabies asset migration failed.");
  console.error(error);
  process.exit(1);
});
