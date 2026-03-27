import { loadEnvConfig } from "@next/env";
import { imageSize } from "image-size";

import {
  cloneGraphNodes,
  readDatabaseGraph,
  writeRuntimeGraph,
} from "../../lib/photo-graph/graph-store";
import { buildSupabaseStoragePublicUrl } from "../../lib/supabase/config";
import type {
  GraphImageDimensions,
  GraphNode,
} from "../../lib/photo-graph/types";

type CliOptions = {
  checkOnly: boolean;
};

type InvalidNode = {
  id: string;
  reason: string;
};

const PREVIEW_LIMIT = 10;

function parseArgs(argv: string[]): CliOptions {
  return {
    checkOnly: argv.includes("--check"),
  };
}

function formatInvalidPreview(invalidNodes: InvalidNode[]) {
  return invalidNodes
    .slice(0, PREVIEW_LIMIT)
    .map((entry) => `- ${entry.id}: ${entry.reason}`)
    .join("\n");
}

function isFinitePositive(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isValidDimensions(
  dimensions: GraphImageDimensions | undefined,
): dimensions is GraphImageDimensions {
  if (!dimensions) {
    return false;
  }

  return (
    isFinitePositive(dimensions.width) &&
    isFinitePositive(dimensions.height) &&
    isFinitePositive(dimensions.aspectRatio)
  );
}

function normalizeDimensions(
  width: number,
  height: number,
): GraphImageDimensions {
  const normalizedWidth = Math.max(1, Math.round(width));
  const normalizedHeight = Math.max(1, Math.round(height));

  return {
    width: normalizedWidth,
    height: normalizedHeight,
    aspectRatio: normalizedWidth / normalizedHeight,
  };
}

async function resolveNodeDimensions(node: GraphNode) {
  if (!node.storagePath) {
    throw new Error("missing storagePath");
  }

  const response = await fetch(
    buildSupabaseStoragePublicUrl(node.storagePath),
    {
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(
      `failed to fetch image (${response.status} ${response.statusText})`,
    );
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const probe = imageSize(buffer);

  if (!isFinitePositive(probe.width) || !isFinitePositive(probe.height)) {
    throw new Error("unable to extract width/height");
  }

  return normalizeDimensions(probe.width, probe.height);
}

async function checkCoverage(nodes: GraphNode[]) {
  const invalidNodes: InvalidNode[] = [];

  for (const node of nodes) {
    if (isValidDimensions(node.dimensions)) {
      continue;
    }

    invalidNodes.push({
      id: node.id,
      reason: "missing or invalid dimensions",
    });
  }

  if (invalidNodes.length > 0) {
    throw new Error(
      `Dimension coverage check failed (${invalidNodes.length}/${nodes.length} invalid).\n${formatInvalidPreview(
        invalidNodes,
      )}`,
    );
  }

  console.log(`Dimensions check passed for ${nodes.length} nodes.`);
}

async function backfillDimensions(nodes: GraphNode[]) {
  const invalidNodes: InvalidNode[] = [];
  let updatedCount = 0;

  for (const node of nodes) {
    if (isValidDimensions(node.dimensions)) {
      continue;
    }

    try {
      node.dimensions = await resolveNodeDimensions(node);
      updatedCount += 1;
    } catch (error) {
      invalidNodes.push({
        id: node.id,
        reason: error instanceof Error ? error.message : "unknown failure",
      });
    }
  }

  if (invalidNodes.length > 0) {
    throw new Error(
      `Backfill failed (${invalidNodes.length} unresolved node(s)).\n${formatInvalidPreview(
        invalidNodes,
      )}`,
    );
  }

  await writeRuntimeGraph(nodes);
  console.log(
    `Backfill complete. Updated ${updatedCount} node(s), verified ${nodes.length} total.`,
  );
}

async function run() {
  loadEnvConfig(process.cwd());
  const options = parseArgs(process.argv.slice(2));
  const databaseNodes = await readDatabaseGraph();

  if (!databaseNodes || databaseNodes.length === 0) {
    throw new Error(
      "Database-backed photo graph metadata is unavailable. Cannot backfill dimensions.",
    );
  }

  const nodes = cloneGraphNodes(databaseNodes);

  if (options.checkOnly) {
    await checkCoverage(nodes);
    return;
  }

  await backfillDimensions(nodes);
}

run().catch((error) => {
  console.error("Photo graph dimensions backfill failed.");
  console.error(error);
  process.exit(1);
});
