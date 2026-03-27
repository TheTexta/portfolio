import { loadEnvConfig } from "@next/env";

import {
  buildCanonicalPhotoGraphStoragePath,
  extensionForPhotoGraphStoragePath,
} from "../../lib/photo-graph/config";
import { readDatabaseGraph } from "../../lib/photo-graph/graph-store";
import { upsertPhotoGraphNodes } from "../../lib/photo-graph/database";
import { getServiceRoleSupabase } from "../../lib/server/supabase";

const DEFAULT_SOURCE_BUCKET = "photo-graph";
const DEFAULT_TARGET_BUCKET = "dextery.dev";
const PAGE_SIZE = 1_000;

function inferContentType(objectPath: string) {
  const extension = extensionForPhotoGraphStoragePath(objectPath);

  if (extension === "jpg") {
    return "image/jpeg";
  }

  if (extension === "webp") {
    return "image/webp";
  }

  return "image/png";
}

function readSourceBucket() {
  return process.env.PHOTO_GRAPH_STORAGE_SOURCE_BUCKET ?? DEFAULT_SOURCE_BUCKET;
}

function readTargetBucket() {
  return process.env.SUPABASE_PHOTO_GRAPH_BUCKET ?? DEFAULT_TARGET_BUCKET;
}

async function ensureBucketExists(bucket: string) {
  const supabase = getServiceRoleSupabase();
  const { data, error } = await supabase.storage.listBuckets();

  if (error) {
    throw new Error(`Failed to list storage buckets: ${error.message}`);
  }

  if (data.some((entry) => entry.id === bucket)) {
    return;
  }

  const { error: createError } = await supabase.storage.createBucket(bucket, {
    public: true,
  });

  if (createError) {
    throw new Error(`Failed to create bucket ${bucket}: ${createError.message}`);
  }
}

async function countBucketObjects(bucket: string, prefix: string) {
  const supabase = getServiceRoleSupabase();
  let offset = 0;
  let count = 0;

  for (;;) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, {
      limit: PAGE_SIZE,
      offset,
      sortBy: { column: "name", order: "asc" },
    });

    if (error) {
      throw new Error(
        `Failed to list objects in ${bucket}/${prefix}: ${error.message}`,
      );
    }

    const page = data ?? [];
    count += page.length;

    if (page.length < PAGE_SIZE) {
      return count;
    }

    offset += PAGE_SIZE;
  }
}

async function run() {
  loadEnvConfig(process.cwd());

  const sourceBucket = readSourceBucket();
  const targetBucket = readTargetBucket();
  const nodes = await readDatabaseGraph();

  if (!nodes || nodes.length === 0) {
    throw new Error("No database-backed photo graph nodes found.");
  }

  await ensureBucketExists(targetBucket);

  const supabase = getServiceRoleSupabase();
  let migratedObjects = 0;

  for (const [index, node] of nodes.entries()) {
    if (!node.storagePath) {
      throw new Error(`Node ${node.id} is missing storagePath.`);
    }

    const sourcePath = node.storagePath;
    const targetPath = buildCanonicalPhotoGraphStoragePath(node.id, sourcePath);
    const targetExistsInPlace =
      sourceBucket === targetBucket && sourcePath === targetPath;

    if (!targetExistsInPlace) {
      const { data, error } = await supabase.storage
        .from(sourceBucket)
        .download(sourcePath);

      if (error || !data) {
        throw new Error(
          `Failed to download ${sourceBucket}/${sourcePath}: ${error?.message ?? "Missing object body."}`,
        );
      }

      const body = Buffer.from(await data.arrayBuffer());
      const contentType = data.type || inferContentType(sourcePath);
      const { error: uploadError } = await supabase.storage
        .from(targetBucket)
        .upload(targetPath, body, {
          upsert: true,
          cacheControl: "31536000",
          contentType,
        });

      if (uploadError) {
        throw new Error(
          `Failed to upload ${targetBucket}/${targetPath}: ${uploadError.message}`,
        );
      }
    }

    node.storagePath = targetPath;
    migratedObjects += 1;
    console.log(
      `[${index + 1}/${nodes.length}] ${sourceBucket}/${sourcePath} -> ${targetBucket}/${targetPath}`,
    );
  }

  await upsertPhotoGraphNodes(nodes);

  const targetObjectCount = await countBucketObjects(
    targetBucket,
    "photography-images",
  );

  console.log("Photo Graph storage rename complete.");
  console.log(`  Source bucket: ${sourceBucket}`);
  console.log(`  Target bucket: ${targetBucket}`);
  console.log(`  Nodes updated: ${nodes.length}`);
  console.log(`  Objects copied or confirmed: ${migratedObjects}`);
  console.log(`  Target bucket object count: ${targetObjectCount}`);
}

run().catch((error) => {
  console.error("Photo Graph storage rename failed.");
  console.error(error);
  process.exit(1);
});
