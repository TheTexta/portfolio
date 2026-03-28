import { loadEnvConfig } from "@next/env";
import net from "node:net";

import { MIN_RENDER_CACHE_TTL_SECONDS } from "../../lib/image-optimization";
import { readDatabaseSocket } from "./database-config";
import { buildSupabaseStorageRenderUrl } from "../../lib/supabase/config";

type CheckResult = {
  name: string;
  level: "pass" | "warn" | "fail";
  detail: string;
};

const WEBP_ACCEPT_HEADER = "image/webp,image/*;q=0.8,*/*;q=0.5";
const EDGE_CACHE_HEADER_NAME = "X-Image-Cache-Status";
const WARM_CACHE_STATUS_VALUES = new Set([
  "HIT",
  "STALE",
  "UPDATING",
  "REVALIDATED",
]);

type RenderCheckResponse = {
  response: Response;
  cacheControl: string | null;
  cacheStatus: string | null;
  contentType: string;
  maxAge: number | null;
};

function parseMaxAge(cacheControl: string | null) {
  if (!cacheControl) {
    return null;
  }

  const match = cacheControl.match(/(?:^|,)\s*max-age=(\d+)/i);
  if (!match) {
    return null;
  }

  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function readRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }

  return value;
}

function getAuthHeaders() {
  const key = readRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");

  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
  };
}

function normalizeHeaderValue(value: string | null) {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  return normalized || null;
}

function describeCacheStatus(value: string | null) {
  return value ?? `missing ${EDGE_CACHE_HEADER_NAME}`;
}

function hasWarmCacheStatus(value: string | null) {
  return value !== null && WARM_CACHE_STATUS_VALUES.has(value);
}

async function fetchRenderCheckResponse(url: string) {
  const response = await fetch(url, {
    headers: {
      Accept: WEBP_ACCEPT_HEADER,
    },
  });

  await response.arrayBuffer();

  const cacheControl = response.headers.get("cache-control");

  return {
    response,
    cacheControl,
    cacheStatus: normalizeHeaderValue(
      response.headers.get(EDGE_CACHE_HEADER_NAME),
    ),
    contentType: response.headers.get("content-type") ?? "unknown",
    maxAge: parseMaxAge(cacheControl),
  } satisfies RenderCheckResponse;
}

async function checkBucket() {
  const baseUrl = readRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const bucket = process.env.SUPABASE_PHOTO_GRAPH_BUCKET ?? "dextery.dev";
  const response = await fetch(`${baseUrl}/storage/v1/bucket`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  });

  if (!response.ok) {
    return {
      name: "Storage bucket",
      level: "fail",
      detail: `Bucket list request failed (${response.status} ${response.statusText}).`,
    } satisfies CheckResult;
  }

  const buckets = (await response.json()) as Array<{
    id?: string;
    public?: boolean;
  }>;
  const match = buckets.find((entry) => entry.id === bucket);

  if (!match) {
    return {
      name: "Storage bucket",
      level: "fail",
      detail: `Bucket '${bucket}' does not exist.`,
    } satisfies CheckResult;
  }

  return {
    name: "Storage bucket",
    level: "pass",
    detail: `Bucket '${bucket}' exists${match.public ? " and is public" : ""}.`,
  } satisfies CheckResult;
}

async function checkTable(tableName: string, selectColumn: string) {
  const baseUrl = readRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const response = await fetch(
    `${baseUrl}/rest/v1/${tableName}?select=${encodeURIComponent(selectColumn)}&limit=1`,
    {
      headers: getAuthHeaders(),
      cache: "no-store",
    },
  );

  if (response.ok) {
    return {
      name: `Table ${tableName}`,
      level: "pass",
      detail: `${tableName} is queryable through PostgREST.`,
    } satisfies CheckResult;
  }

  const detail = await response.text();
  return {
    name: `Table ${tableName}`,
    level: "fail",
    detail:
      detail.trim() ||
      `Request failed (${response.status} ${response.statusText}).`,
  } satisfies CheckResult;
}

async function readSampleStoragePath() {
  const baseUrl = readRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const response = await fetch(
    `${baseUrl}/rest/v1/photo_graph_nodes?select=storage_path&storage_path=not.is.null&limit=1`,
    {
      headers: getAuthHeaders(),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(
      `Failed to read sample photo graph asset (${response.status} ${response.statusText}).`,
    );
  }

  const rows = (await response.json()) as Array<{
    storage_path?: string | null;
  }>;

  return rows[0]?.storage_path ?? null;
}

async function checkImageRender() {
  const storagePath = await readSampleStoragePath();

  if (!storagePath) {
    return {
      name: "Image render endpoint",
      level: "warn",
      detail:
        "No storage-backed photo graph node was found to test image rendering.",
    } satisfies CheckResult;
  }

  const renderUrl = buildSupabaseStorageRenderUrl(storagePath, {
    width: 96,
    quality: 75,
  });
  const firstResponse = await fetchRenderCheckResponse(renderUrl);

  if (!firstResponse.response.ok) {
    return {
      name: "Image render endpoint",
      level: "fail",
      detail: `Supabase image render failed for ${storagePath} (${firstResponse.response.status} ${firstResponse.response.statusText}).`,
    } satisfies CheckResult;
  }

  if (!firstResponse.contentType.startsWith("image/")) {
    return {
      name: "Image render endpoint",
      level: "fail",
      detail: `Supabase image render returned non-image content type '${firstResponse.contentType}'.`,
    } satisfies CheckResult;
  }

  if (!firstResponse.contentType.startsWith("image/webp")) {
    return {
      name: "Image render endpoint",
      level: "fail",
      detail: `Supabase image render did not negotiate WebP for ${storagePath} (received '${firstResponse.contentType}').`,
    } satisfies CheckResult;
  }

  if (
    firstResponse.maxAge === null ||
    firstResponse.maxAge < MIN_RENDER_CACHE_TTL_SECONDS
  ) {
    return {
      name: "Image render endpoint",
      level: "fail",
      detail: `Supabase image render cache TTL is below one week (${firstResponse.cacheControl ?? "missing cache-control"}).`,
    } satisfies CheckResult;
  }

  const secondResponse = await fetchRenderCheckResponse(renderUrl);

  if (!secondResponse.response.ok) {
    return {
      name: "Image render endpoint",
      level: "fail",
      detail: `Supabase image render cache warm-up retry failed for ${storagePath} (${secondResponse.response.status} ${secondResponse.response.statusText}).`,
    } satisfies CheckResult;
  }

  if (!firstResponse.cacheStatus || !secondResponse.cacheStatus) {
    return {
      name: "Image render endpoint",
      level: "fail",
      detail: `Supabase image render is missing ${EDGE_CACHE_HEADER_NAME}. First response: ${describeCacheStatus(firstResponse.cacheStatus)}. Second response: ${describeCacheStatus(secondResponse.cacheStatus)}.`,
    } satisfies CheckResult;
  }

  if (!hasWarmCacheStatus(secondResponse.cacheStatus)) {
    return {
      name: "Image render endpoint",
      level: "fail",
      detail: `Supabase image render edge cache did not warm for ${storagePath}. First response was ${firstResponse.cacheStatus}; second response was ${secondResponse.cacheStatus}.`,
    } satisfies CheckResult;
  }

  return {
    name: "Image render endpoint",
    level: "pass",
    detail: `Supabase image render returned ${firstResponse.contentType} for ${storagePath} with cache-control '${firstResponse.cacheControl}' and ${EDGE_CACHE_HEADER_NAME} ${firstResponse.cacheStatus} -> ${secondResponse.cacheStatus}.`,
  } satisfies CheckResult;
}

async function checkDatabaseSocket() {
  const socketConfig = readDatabaseSocket();

  if (!socketConfig) {
    return {
      name: "Database socket",
      level: "warn",
      detail:
        "No database connection details configured. This is fine if the schema has already been applied from inside the database container.",
    } satisfies CheckResult;
  }

  const result = await new Promise<CheckResult>((resolve) => {
    const socket = new net.Socket();

    const finish = (level: CheckResult["level"], detail: string) => {
      socket.destroy();
      resolve({
        name: "Database socket",
        level,
        detail,
      });
    };

    socket.setTimeout(3_000);
    socket.once("connect", () => {
      finish("pass", `Connected to ${socketConfig.host}:${socketConfig.port}.`);
    });
    socket.once("timeout", () => {
      finish(
        "warn",
        `Timed out connecting to ${socketConfig.host}:${socketConfig.port}.`,
      );
    });
    socket.once("error", (error) => {
      finish(
        "warn",
        `Failed to connect to ${socketConfig.host}:${socketConfig.port}: ${error.message}. This is expected when Postgres is internal-only and schema changes are applied from inside the Coolify host.`,
      );
    });

    socket.connect(socketConfig.port, socketConfig.host);
  });

  return result;
}

async function run() {
  loadEnvConfig(process.cwd());

  const results = await Promise.all([
    checkBucket(),
    checkTable("photo_graph_nodes", "id"),
    checkTable("photo_graph_edges", "left_node_id"),
    checkTable("photo_graph_settings", "key"),
    checkImageRender(),
    checkDatabaseSocket(),
  ]);

  for (const result of results) {
    console.log(
      `${result.level.toUpperCase()} ${result.name}: ${result.detail}`,
    );
  }

  if (results.some((result) => result.level === "fail")) {
    process.exit(1);
  }

  console.log("Photo Graph Supabase setup is ready.");
}

run().catch((error) => {
  console.error("Photo Graph Supabase doctor failed.");
  console.error(error);
  process.exit(1);
});
