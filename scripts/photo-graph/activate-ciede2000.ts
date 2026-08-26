import { loadEnvConfig } from "@next/env";

import {
  replacePhotoGraphEdges,
  replacePhotoGraphNeighborSnapshot,
  savePhotoGraphEdgeGenerationConfig,
} from "../../lib/photo-graph/database";
import { countGraphEdges } from "../../lib/photo-graph/edge-generation";
import {
  cloneGraphNodes,
  loadGraphWithFallback,
} from "../../lib/photo-graph/graph-store";
import {
  CIEDE2000_EDGE_GENERATION_CONFIG,
  generateSparsePhotoGraph,
} from "../../lib/photo-graph/sparse-edge-generation";

function canUseLegacySnapshot(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.message.includes("replace_photo_graph_neighbor_snapshot");
}

async function run() {
  loadEnvConfig(process.cwd());

  const loaded = await loadGraphWithFallback();
  if (!loaded.databaseAvailable || loaded.source !== "database") {
    throw new Error(
      "CIEDE2000 activation requires the database-backed photo graph.",
    );
  }

  const generated = generateSparsePhotoGraph(
    cloneGraphNodes(loaded.nodes),
    CIEDE2000_EDGE_GENERATION_CONFIG,
  );
  const expectedEdgeCount = countGraphEdges(generated.nodes);
  let persistence: "transactional-neighbors" | "legacy-edge-snapshot";
  let edgeCount: number;

  try {
    edgeCount = await replacePhotoGraphNeighborSnapshot(
      generated.nodes.map((node) => node.id),
      generated.neighbors,
      CIEDE2000_EDGE_GENERATION_CONFIG,
    );
    persistence = "transactional-neighbors";
  } catch (error) {
    if (!canUseLegacySnapshot(error)) {
      throw error;
    }

    await replacePhotoGraphEdges(generated.nodes);
    await savePhotoGraphEdgeGenerationConfig(
      CIEDE2000_EDGE_GENERATION_CONFIG,
    );
    edgeCount = countGraphEdges(generated.nodes);
    persistence = "legacy-edge-snapshot";
  }

  if (edgeCount !== expectedEdgeCount) {
    throw new Error(
      `CIEDE2000 persistence returned ${edgeCount} edges; expected ${expectedEdgeCount}.`,
    );
  }

  console.log("Activated CIEDE2000 for the Photo Graph.");
  console.log(`  Nodes: ${generated.nodes.length}`);
  console.log(`  Edges: ${edgeCount}`);
  console.log(`  Neighbors per node: ${CIEDE2000_EDGE_GENERATION_CONFIG.neighborsPerNode}`);
  console.log(`  Maximum Delta E 00: ${CIEDE2000_EDGE_GENERATION_CONFIG.maxDistance}`);
  console.log(`  Persistence: ${persistence}`);
}

run().catch((error) => {
  console.error("CIEDE2000 activation failed.");
  console.error(error);
  process.exit(1);
});