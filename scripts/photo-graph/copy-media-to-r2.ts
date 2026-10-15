import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { PHOTO_GRAPH_R2_PUBLISHED_BUCKET } from "../../lib/photo-graph/r2-paths";

const ACCOUNT_ID = "9ccb474d564d74115b71265bb22b16ad";
const SUPABASE_PUBLIC_ORIGIN =
  "https://api.dextery.dev/storage/v1/object/public/dextery.dev/";
const R2_OBJECT_ENDPOINT = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/r2/buckets/${PHOTO_GRAPH_R2_PUBLISHED_BUCKET}/objects/`;
const R2_CACHE_CONTROL = "public, max-age=31536000, immutable";
const MAX_IMAGE_BYTES = 100_000_000;
const CANONICAL_KEY = /^photography-images\/([0-9]+)\.(png|jpg|webp)$/;

export type PhotoGraphCopyItem = {
  id: number;
  key: string;
  bytes: number;
  contentType: string;
};

export function parsePhotoGraphCopyManifest(
  value: unknown,
): PhotoGraphCopyItem[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 10_000) {
    throw new Error("Expected a bounded, nonempty Photo Graph media manifest.");
  }
  const ids = new Set<number>();
  const keys = new Set<string>();
  for (const row of value) {
    if (!row || typeof row !== "object")
      throw new Error("Invalid Photo Graph media row.");
    const item = row as PhotoGraphCopyItem;
    const match =
      typeof item.key === "string" ? CANONICAL_KEY.exec(item.key) : null;
    const mime = match?.[2] === "jpg" ? "image/jpeg" : `image/${match?.[2]}`;
    if (
      !match ||
      !Number.isSafeInteger(item.id) ||
      String(item.id) !== match[1] ||
      !Number.isSafeInteger(item.bytes) ||
      item.bytes < 1 ||
      item.bytes > MAX_IMAGE_BYTES ||
      item.contentType !== mime ||
      ids.has(item.id) ||
      keys.has(item.key)
    ) {
      throw new Error("Invalid or duplicate Photo Graph media manifest entry.");
    }
    ids.add(item.id);
    keys.add(item.key);
  }
  return value as PhotoGraphCopyItem[];
}

function sha256(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

export async function copyPhotoGraphMediaItem(
  item: PhotoGraphCopyItem,
  bearerToken: string,
  fetchImpl: typeof fetch = fetch,
) {
  parsePhotoGraphCopyManifest([item]);
  if (!bearerToken)
    throw new Error("Cloudflare authorization is required for a copy.");
  const encodedKey = item.key.split("/").map(encodeURIComponent).join("/");
  const sourceUrl = SUPABASE_PUBLIC_ORIGIN + encodedKey;
  const targetUrl = R2_OBJECT_ENDPOINT + encodeURIComponent(item.key);
  const authorization = { Authorization: `Bearer ${bearerToken}` };

  const source = await fetchImpl(sourceUrl, { cache: "no-store" });
  if (!source.ok)
    throw new Error(`Supabase source is unavailable (${source.status}).`);
  if (
    source.headers.get("content-type")?.split(";")[0].trim() !==
    item.contentType
  ) {
    throw new Error("Supabase source content type differs from the manifest.");
  }
  const original = new Uint8Array(await source.arrayBuffer());
  if (original.byteLength !== item.bytes) {
    throw new Error("Supabase source size differs from the manifest.");
  }
  const expectedHash = sha256(original);

  async function verifyDestination() {
    const response = await fetchImpl(targetUrl, {
      headers: authorization,
      cache: "no-store",
    });
    if (response.status === 404) return false;
    if (!response.ok)
      throw new Error(`R2 verification read failed (${response.status}).`);
    const body = new Uint8Array(await response.arrayBuffer());
    if (
      body.byteLength !== original.byteLength ||
      sha256(body) !== expectedHash ||
      response.headers.get("content-type")?.split(";")[0].trim() !==
        item.contentType ||
      response.headers.get("cache-control") !== R2_CACHE_CONTROL
    ) {
      throw new Error(
        "An R2 object already exists with different bytes or metadata; refusing overwrite.",
      );
    }
    return true;
  }

  if (await verifyDestination())
    return { key: item.key, sha256: expectedHash, copied: false };

  try {
    const response = await fetchImpl(targetUrl, {
      method: "PUT",
      headers: {
        ...authorization,
        "Content-Type": item.contentType,
        "Cache-Control": R2_CACHE_CONTROL,
      },
      body: original,
    });
    if (!response.ok) throw new Error(`R2 copy failed (${response.status}).`);
  } catch (error) {
    // A lost PUT response may still have committed. Verify instead of retrying
    // into a potentially occupied key (R2 REST ignores If-None-Match on PUT).
    if (!(await verifyDestination())) throw error;
  }
  if (!(await verifyDestination()))
    throw new Error("R2 object did not appear after copy.");
  return { key: item.key, sha256: expectedHash, copied: true };
}

async function main() {
  const args = process.argv.slice(2);
  const index = args.indexOf("--manifest");
  const manifestPath = index >= 0 ? args[index + 1] : undefined;
  const copy = args.includes("--copy");
  const limitIndex = args.indexOf("--limit");
  const limit = limitIndex >= 0 ? Number(args[limitIndex + 1]) : undefined;
  if (
    !manifestPath ||
    (limit !== undefined && (!Number.isSafeInteger(limit) || limit < 1))
  ) {
    throw new Error(
      "Provide --manifest <file>; optional --limit <positive-count> and --copy.",
    );
  }
  const raw = await readFile(manifestPath);
  const items = parsePhotoGraphCopyManifest(JSON.parse(raw.toString("utf8")));
  const selected = items.slice(0, limit);
  const total = selected.reduce((sum, item) => sum + item.bytes, 0);
  console.log(
    `Photo Graph R2 ${copy ? "copy" : "dry run"}: ${selected.length}/${items.length} referenced originals (${total} bytes).`,
  );
  console.log(`Manifest SHA-256: ${sha256(raw)}`);
  if (!copy) return;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token)
    throw new Error(
      "CLOUDFLARE_API_TOKEN is required for --copy; never commit or log it.",
    );
  let created = 0;
  for (const [index, item] of selected.entries()) {
    const result = await copyPhotoGraphMediaItem(item, token);
    if (result.copied) created++;
    console.log(
      `[${index + 1}/${selected.length}] verified ${result.key} SHA-256 ${result.sha256}`,
    );
  }
  console.log(
    `Verified ${selected.length} originals in R2; ${created} copied, ${selected.length - created} already matching. Supabase sources were not changed.`,
  );
}

if (process.argv[1]?.endsWith("/copy-media-to-r2.ts")) {
  main().catch((error) => {
    console.error(
      "Photo Graph copy stopped without changing Supabase objects:",
      error instanceof Error ? error.message : "unknown error",
    );
    process.exitCode = 1;
  });
}
