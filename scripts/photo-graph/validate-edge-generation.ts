import assert from "node:assert/strict";

import {
  computeLabCorrelation,
  countGraphEdges,
  regenerateLabGraphCorrelations,
} from "../../lib/photo-graph/edge-generation";
import { normalizeSparseEdgeGenerationConfig } from "../../lib/photo-graph/sparse-edge-generation";
import type { GraphNode, PhotoGraphEdgeGenerationConfig } from "../../lib/photo-graph/types";

function createFixtureNodes(): GraphNode[] {
  return [
    {
      id: "1",
      scale: 1,
      colour: "#808080",
      correlations: {},
      feature: {
        rgb: [128, 128, 128],
        lab: [52, 0, 0],
        hue: 0,
        longSide: 1200,
      },
    },
    {
      id: "2",
      scale: 1,
      colour: "#848484",
      correlations: {},
      feature: {
        rgb: [132, 132, 132],
        lab: [54, 1, -1],
        hue: 0,
        longSide: 1180,
      },
    },
    {
      id: "3",
      scale: 1,
      colour: "#b87a5b",
      correlations: {},
      feature: {
        rgb: [184, 122, 91],
        lab: [60, 22, 24],
        hue: 20,
        longSide: 980,
      },
    },
    {
      id: "4",
      scale: 1,
      colour: "#3f698d",
      correlations: {},
      feature: {
        rgb: [63, 105, 141],
        lab: [43, -4, -24],
        hue: 210,
        longSide: 860,
      },
    },
  ];
}

function assertSymmetry(nodes: GraphNode[]) {
  for (const node of nodes) {
    assert.equal(node.correlations[node.id], undefined, "self-edges are invalid");

    for (const [targetId, correlation] of Object.entries(node.correlations)) {
      const target = nodes.find((entry) => entry.id === targetId);
      assert.ok(target, `missing target node ${targetId}`);
      assert.equal(
        target?.correlations[node.id],
        correlation,
        `edge ${node.id} -> ${targetId} must be symmetric`,
      );
    }
  }
}

function run() {
  const broadNodes = regenerateLabGraphCorrelations(createFixtureNodes(), {
    sigmaE: 18,
    minCorrelation: 0.05,
  });
  assertSymmetry(broadNodes);
  assert.ok(countGraphEdges(broadNodes) > 0, "fixture should generate edges");

  const strictNodes = regenerateLabGraphCorrelations(createFixtureNodes(), {
    sigmaE: 18,
    minCorrelation: 0.3,
  });
  assert.ok(
    countGraphEdges(strictNodes) < countGraphEdges(broadNodes),
    "higher minCorrelation should prune edges",
  );

  const nearA = createFixtureNodes()[0].feature;
  const nearB = createFixtureNodes()[2].feature;
  assert.ok(nearA && nearB);

  const narrowCorrelation = computeLabCorrelation(nearA, nearB, {
    sigmaE: 6,
    minCorrelation: 0.1,
  });
  const wideCorrelation = computeLabCorrelation(nearA, nearB, {
    sigmaE: 26,
    minCorrelation: 0.1,
  });
  assert.ok(
    narrowCorrelation < wideCorrelation,
    "lower sigmaE should produce weaker distant correlations",
  );

  const config: PhotoGraphEdgeGenerationConfig = {
    version: 2,
    model: "mean-lab-cie76",
    neighborsPerNode: 4,
    maxDistance: 22.5,
  };
  const roundTripped = normalizeSparseEdgeGenerationConfig(
    JSON.parse(JSON.stringify(config)),
  );
  assert.deepEqual(
    roundTripped,
    config,
    "saved configs should survive JSON round-tripping",
  );

  console.log("Photo graph edge generation validation passed.");
}

run();
