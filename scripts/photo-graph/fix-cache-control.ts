import { loadEnvConfig } from "@next/env";

import {
  PHOTO_GRAPH_CACHE_CONTROL_HEADER,
  photoGraphImageBasePath,
} from "../../lib/photo-graph/config";
import {
  ensureGraphStoragePaths,
  loadGraphWithFallback,
} from "../../lib/photo-graph/graph-store";
import {
  getPhotoGraphStorageBucket,
  getSupabaseServiceRoleKey,
  getSupabaseUrl,
} from "../../lib/supabase/config";

type CopyObjectSuccess = {
  Key?: string;
  error?: string;
  message?: string;
};

function getAuthHeaders() {
  const serviceRoleKey = getSupabaseServiceRoleKey();

  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
  };
}

async function copyObjectToSelfWithUpdatedCacheControl(
  bucket: string,
  objectPath: string,
) {
  const response = await fetch(`${getSupabaseUrl()}/storage/v1/object/copy`, {
    method: "POST",
    headers: {
      ...getAuthHeaders(),
      "content-type": "application/json",
      "x-upsert": "true",
    },
    body: JSON.stringify({
      bucketId: bucket,
      sourceKey: objectPath,
      destinationKey: objectPath,
      metadata: {
        cacheControl: PHOTO_GRAPH_CACHE_CONTROL_HEADER,
      },
      copyMetadata: false,
    }),
  });

  const text = await response.text();
  let body: CopyObjectSuccess | null = null;

  try {
    body = text ? (JSON.parse(text) as CopyObjectSuccess) : null;
  } catch {
    body = null;
  }

  if (!response.ok) {
    throw new Error(
      body?.error ??
        body?.message ??
        text.trim() ??
        `Storage copy failed (${response.status} ${response.statusText}).`,
    );
  }
}

async function run() {
  loadEnvConfig(process.cwd());

  const { nodes, source } = await loadGraphWithFallback();
  ensureGraphStoragePaths(nodes);

  const imageBasePath = `${photoGraphImageBasePath().replace(/\/$/, "")}/`;
  const storagePaths = [
    ...new Set(
      nodes
        .map((node) => node.storagePath?.trim() ?? null)
        .filter(
          (value): value is string =>
            typeof value === "string" &&
            value.length > 0 &&
            value.startsWith(imageBasePath) &&
            !value.includes("/_pending/"),
        ),
    ),
  ].sort((left, right) => left.localeCompare(right));

  if (storagePaths.length === 0) {
    throw new Error("No Photo Graph storage objects were found to update.");
  }

  const bucket = getPhotoGraphStorageBucket();
  let updatedCount = 0;

  for (const [index, storagePath] of storagePaths.entries()) {
    await copyObjectToSelfWithUpdatedCacheControl(bucket, storagePath);
    updatedCount += 1;
    console.log(
      `[${index + 1}/${storagePaths.length}] Updated cache-control for ${bucket}/${storagePath}`,
    );
  }

  console.log("Photo Graph cache-control repair complete.");
  console.log(`  Graph source: ${source}`);
  console.log(`  Bucket: ${bucket}`);
  console.log(`  Objects updated: ${updatedCount}`);
  console.log(`  Cache-Control: ${PHOTO_GRAPH_CACHE_CONTROL_HEADER}`);
}

run().catch((error) => {
  console.error("Photo Graph cache-control repair failed.");
  console.error(error);
  process.exit(1);
});
