import { loadEnvConfig } from "@next/env";

import {
  cloneGraphNodes,
  ensureGraphStoragePaths,
  ensureProcessingFeatures,
  readDatabaseGraph,
  readStaticGraph,
  writeRuntimeGraph,
} from "../../lib/photo-graph/graph-store";
import { getServiceRoleSupabase } from "../../lib/server/supabase";
import { getPhotoGraphStorageBucket } from "../../lib/supabase/config";
import type { GraphNode } from "../../lib/photo-graph/types";

const DEFAULT_FIREBASE_BUCKET =
  "portfolio-site-firebase-41fab.firebasestorage.app";
const DEFAULT_FIREBASE_GRAPH_OBJECT_PATH = "photo-graph/graph.json";
const IMMUTABLE_CACHE_CONTROL = "31536000";

type MigrationSource = "firebase-runtime" | "static-fallback";

type ObjectFailure = {
  nodeId: string;
  objectPath: string;
  reason: string;
};

function readFirebaseBucket() {
  return (
    process.env.PHOTO_GRAPH_FIREBASE_BUCKET ??
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ??
    process.env.FIREBASE_STORAGE_BUCKET ??
    DEFAULT_FIREBASE_BUCKET
  );
}

function readFirebaseGraphObjectPath() {
  return (
    process.env.PHOTO_GRAPH_SOURCE_GRAPH_OBJECT_PATH ??
    process.env.PHOTO_GRAPH_GRAPH_OBJECT_PATH ??
    DEFAULT_FIREBASE_GRAPH_OBJECT_PATH
  );
}

function buildFirebaseDownloadUrl(
  objectPath: string,
  bucket = readFirebaseBucket(),
) {
  return `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(objectPath)}?alt=media`;
}

function inferContentType(objectPath: string) {
  const lowerPath = objectPath.toLowerCase();

  if (lowerPath.endsWith(".jpg") || lowerPath.endsWith(".jpeg")) {
    return "image/jpeg";
  }

  if (lowerPath.endsWith(".webp")) {
    return "image/webp";
  }

  if (lowerPath.endsWith(".gif")) {
    return "image/gif";
  }

  return "image/png";
}

function normalizeLoadedNodes(raw: unknown): GraphNode[] {
  if (!Array.isArray(raw)) {
    throw new Error("Firebase runtime graph payload is not an array.");
  }

  const nodes = cloneGraphNodes(raw as GraphNode[]);
  ensureGraphStoragePaths(nodes);
  ensureProcessingFeatures(nodes);
  return nodes;
}

function countUniqueEdges(nodes: GraphNode[]) {
  const keys = new Set<string>();

  for (const node of nodes) {
    for (const [targetId, correlation] of Object.entries(node.correlations)) {
      if (
        !Number.isFinite(correlation) ||
        correlation <= 0 ||
        targetId === node.id
      ) {
        continue;
      }

      const leftId = Number(node.id) <= Number(targetId) ? node.id : targetId;
      const rightId = leftId === node.id ? targetId : node.id;
      keys.add(`${leftId}:${rightId}`);
    }
  }

  return keys.size;
}

async function readSourceNodes(): Promise<{
  source: MigrationSource;
  nodes: GraphNode[];
}> {
  const response = await fetch(
    buildFirebaseDownloadUrl(readFirebaseGraphObjectPath()),
    {
      cache: "no-store",
    },
  );

  if (response.ok) {
    return {
      source: "firebase-runtime",
      nodes: normalizeLoadedNodes(await response.json()),
    };
  }

  if (response.status !== 404) {
    throw new Error(
      `Failed to read Firebase runtime graph (${response.status} ${response.statusText}).`,
    );
  }

  const staticNodes = await readStaticGraph();
  const nodes = cloneGraphNodes(staticNodes);
  ensureGraphStoragePaths(nodes);
  ensureProcessingFeatures(nodes);

  return {
    source: "static-fallback",
    nodes,
  };
}

async function uploadNodeObjects(nodes: GraphNode[]) {
  const supabase = getServiceRoleSupabase();
  const bucket = getPhotoGraphStorageBucket();
  const missingObjects: ObjectFailure[] = [];
  const failedUploads: ObjectFailure[] = [];
  let importedObjects = 0;

  for (const [index, node] of nodes.entries()) {
    if (!node.storagePath) {
      continue;
    }

    const sourceUrl = buildFirebaseDownloadUrl(node.storagePath);
    const response = await fetch(sourceUrl, {
      cache: "no-store",
    });

    if (response.status === 404) {
      missingObjects.push({
        nodeId: node.id,
        objectPath: node.storagePath,
        reason: "source object not found",
      });
      console.log(
        `[${index + 1}/${nodes.length}] Missing source object for node ${node.id}: ${node.storagePath}`,
      );
      continue;
    }

    if (!response.ok) {
      failedUploads.push({
        nodeId: node.id,
        objectPath: node.storagePath,
        reason: `source fetch failed (${response.status} ${response.statusText})`,
      });
      console.log(
        `[${index + 1}/${nodes.length}] Failed to fetch node ${node.id}: ${node.storagePath}`,
      );
      continue;
    }

    const body = Buffer.from(await response.arrayBuffer());
    const contentType =
      response.headers.get("content-type") ??
      inferContentType(node.storagePath);
    const { error } = await supabase.storage
      .from(bucket)
      .upload(node.storagePath, body, {
        cacheControl: IMMUTABLE_CACHE_CONTROL,
        contentType,
        upsert: true,
      });

    if (error) {
      failedUploads.push({
        nodeId: node.id,
        objectPath: node.storagePath,
        reason: error.message,
      });
      console.log(
        `[${index + 1}/${nodes.length}] Failed to upload node ${node.id}: ${node.storagePath}`,
      );
      continue;
    }

    importedObjects += 1;
    console.log(`[${index + 1}/${nodes.length}] Uploaded ${node.storagePath}`);
  }

  return {
    importedObjects,
    missingObjects,
    failedUploads,
  };
}

async function run() {
  loadEnvConfig(process.cwd());

  const { source, nodes } = await readSourceNodes();
  const uploadResult = await uploadNodeObjects(nodes);
  const edgeCount = countUniqueEdges(nodes);

  console.log("Verification report:");
  console.log(`  Source: ${source}`);
  console.log(`  Nodes discovered: ${nodes.length}`);
  console.log(`  Objects imported: ${uploadResult.importedObjects}`);
  console.log(`  Unique edges discovered: ${edgeCount}`);
  console.log(`  Missing objects: ${uploadResult.missingObjects.length}`);
  console.log(`  Failed uploads: ${uploadResult.failedUploads.length}`);

  if (
    uploadResult.missingObjects.length > 0 ||
    uploadResult.failedUploads.length > 0
  ) {
    throw new Error(
      "Migration aborted because one or more source objects could not be copied.",
    );
  }

  await writeRuntimeGraph(nodes);
  const importedNodes = await readDatabaseGraph();

  if (!importedNodes || importedNodes.length !== nodes.length) {
    throw new Error(
      `Verification failed after import. Expected ${nodes.length} nodes, found ${importedNodes?.length ?? 0}.`,
    );
  }

  const importedEdgeCount = countUniqueEdges(importedNodes);

  if (importedEdgeCount !== edgeCount) {
    throw new Error(
      `Verification failed after import. Expected ${edgeCount} edges, found ${importedEdgeCount}.`,
    );
  }

  console.log("Supabase graph migration complete.");
}

run().catch((error) => {
  console.error("Firebase to Supabase photo graph migration failed.");
  console.error(error);
  process.exit(1);
});
