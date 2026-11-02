import { loadEnvConfig } from "@next/env";
import net from "node:net";
import { pathToFileURL } from "node:url";

import { readDatabaseSocket } from "./database-config";
import {
  photoGraphMediaUrl,
  photoGraphStorageProvider,
} from "../../lib/photo-graph/media-url";

type CheckResult = {
  name: string;
  level: "pass" | "warn" | "fail";
  detail: string;
};

const WEBP_ACCEPT_HEADER = "image/webp,image/*;q=0.8,*/*;q=0.5";

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

export async function checkNeighborSnapshotRpc() {
  const baseUrl = readRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const response = await fetch(`${baseUrl}/rest/v1/`, {
    headers: {
      ...getAuthHeaders(),
      Accept: "application/openapi+json",
    },
    cache: "no-store",
  });

  const schema = (await response.json().catch(() => null)) as {
    paths?: Record<string, { post?: unknown }>;
  } | null;

  if (!response.ok) {
    return {
      name: "Neighbor snapshot RPC",
      level: "fail",
      detail: `PostgREST schema inspection failed (${response.status} ${response.statusText}); no RPC was invoked.`,
    } satisfies CheckResult;
  }

  if (schema?.paths?.["/rpc/replace_photo_graph_neighbor_snapshot"]?.post) {
    return {
      name: "Neighbor snapshot RPC",
      level: "pass",
      detail:
        "replace_photo_graph_neighbor_snapshot is advertised by PostgREST; the mutating RPC was not invoked.",
    } satisfies CheckResult;
  }

  return {
    name: "Neighbor snapshot RPC",
    level: "fail",
    detail:
      "replace_photo_graph_neighbor_snapshot is absent from the PostgREST schema. Inspect schema visibility and applied migrations before making changes.",
  } satisfies CheckResult;
}

async function readSampleMediaReference() {
  const baseUrl = readRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const response = await fetch(
    `${baseUrl}/rest/v1/photo_graph_nodes?select=storage_path,storage_provider&storage_path=not.is.null&order=id.asc&limit=1`,
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
    storage_provider?: string | null;
  }>;

  const row = rows[0];
  return row?.storage_path
    ? {
        storagePath: row.storage_path,
        storageProvider: photoGraphStorageProvider(row.storage_provider),
      }
    : null;
}

export async function checkImageRender() {
  const reference = await readSampleMediaReference();

  if (!reference) {
    return {
      name: "Published image delivery",
      level: "warn",
      detail:
        "No storage-backed photo graph node was found to test image rendering.",
    } satisfies CheckResult;
  }

  const originalUrl = photoGraphMediaUrl(reference)!;
  const renderUrl = photoGraphMediaUrl(reference, {
    width: 96,
    quality: 75,
  })!;
  // Public media requests deliberately carry no Supabase credentials.
  const [original, rendered] = await Promise.all([
    fetch(originalUrl, { method: "HEAD" }),
    fetch(renderUrl, { headers: { Accept: WEBP_ACCEPT_HEADER } }),
  ]);
  const bytes = await rendered.arrayBuffer();
  const originalType = original.headers.get("content-type") ?? "unknown";
  const renderedType = rendered.headers.get("content-type") ?? "unknown";
  const healthy =
    original.ok &&
    originalType.startsWith("image/") &&
    rendered.ok &&
    renderedType.startsWith("image/webp") &&
    bytes.byteLength > 0;

  return {
    name: "Published image delivery",
    level: healthy ? "pass" : "fail",
    detail: `${reference.storageProvider} ${reference.storagePath}: original HTTP ${original.status} (${originalType}); transform HTTP ${rendered.status} (${renderedType}, ${bytes.byteLength} bytes).`,
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
    checkTable("photo_graph_neighbors", "source_node_id"),
    checkTable("photo_graph_settings", "key"),
    checkNeighborSnapshotRpc(),
    checkImageRender(),
    checkDatabaseSocket(),
  ]);

  for (const result of results) {
    console.log(
      `${result.level.toUpperCase()} ${result.name}: ${result.detail}`,
    );
  }

  if (results.some((result) => result.level === "fail")) {
    process.exitCode = 1;
    return;
  }

  console.log("Photo Graph backend and provider-aware media checks passed.");
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  run().catch((error) => {
    console.error("Photo Graph doctor failed.");
    console.error(error);
    process.exitCode = 1;
  });
}
