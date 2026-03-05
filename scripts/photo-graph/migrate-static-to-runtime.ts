import { loadEnvConfig } from "@next/env";

import {
  cloneGraphNodes,
  ensureProcessingFeatures,
  imagePathForLegacyId,
  readStaticGraph,
  writeRuntimeGraph,
} from "../../lib/photo-graph/graph-store";

loadEnvConfig(process.cwd());

async function migrate() {
  const staticNodes = await readStaticGraph();
  const mutableNodes = cloneGraphNodes(staticNodes);

  for (const node of mutableNodes) {
    if (!node.storagePath && !node.url) {
      node.storagePath = imagePathForLegacyId(node.id);
    }
  }

  ensureProcessingFeatures(mutableNodes);
  await writeRuntimeGraph(mutableNodes);

  console.log(
    `Migrated ${mutableNodes.length} nodes to runtime graph metadata (photo-graph/graph.json).`,
  );
}

migrate().catch((error) => {
  console.error("Photo graph migration failed.");
  console.error(error);
  process.exit(1);
});
