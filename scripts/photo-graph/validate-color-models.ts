import assert from "node:assert/strict";

import {
  extractPhotoGraphColorFeatureV1,
  parsePhotoGraphColorFeatureV1,
} from "../../lib/photo-graph/color-features";
import { featureFromRgb } from "../../lib/photo-graph/feature-extraction";
import {
  CIEDE2000_EDGE_GENERATION_CONFIG,
  DEFAULT_SPARSE_EDGE_GENERATION_CONFIG,
  generateSparsePhotoGraph,
  updateSparsePhotoGraphForAddedNodes,
} from "../../lib/photo-graph/sparse-edge-generation";
import {
  computePhotoGraphModelDistance,
  deltaE2000,
  hellingerDistance,
  paletteEarthMoverDistance,
} from "../../lib/photo-graph/similarity-models";
import type { GraphFeature, GraphNode } from "../../lib/photo-graph/types";

function solidRgba(red: number, green: number, blue: number, count: number) {
  const data = new Uint8ClampedArray(count * 4);
  for (let index = 0; index < count; index += 1) {
    data.set([red, green, blue, 255], index * 4);
  }
  return data;
}

function splitRgba(
  left: [number, number, number],
  right: [number, number, number],
  count: number,
) {
  const data = new Uint8ClampedArray(count * 4);
  for (let index = 0; index < count; index += 1) {
    data.set(index < count / 2 ? [...left, 255] : [...right, 255], index * 4);
  }
  return data;
}

function feature(
  rgb: [number, number, number],
  data: Uint8ClampedArray,
): GraphFeature {
  return {
    ...featureFromRgb(rgb, 100),
    colorV1: extractPhotoGraphColorFeatureV1({
      data,
      width: data.length / 4,
      height: 1,
    }),
  };
}

function node(id: string, graphFeature: GraphFeature): GraphNode {
  return {
    id,
    scale: 1,
    colour: "#808080",
    correlations: {},
    feature: graphFeature,
    url: `https://example.com/${id}.png`,
  };
}

function run() {
  assert.deepEqual(
    DEFAULT_SPARSE_EDGE_GENERATION_CONFIG,
    CIEDE2000_EDGE_GENERATION_CONFIG,
  );
  assert.deepEqual(CIEDE2000_EDGE_GENERATION_CONFIG, {
    version: 2,
    model: "mean-lab-ciede2000",
    neighborsPerNode: 4,
    maxDistance: 16,
  });

  const purple = feature([128, 0, 128], solidRgba(128, 0, 128, 64));
  const split = feature(
    [128, 0, 128],
    splitRgba([255, 0, 0], [0, 0, 255], 64),
  );
  const deterministic = feature(
    [128, 0, 128],
    splitRgba([255, 0, 0], [0, 0, 255], 64),
  );

  assert.deepEqual(split.colorV1, deterministic.colorV1);
  assert.deepEqual(parsePhotoGraphColorFeatureV1(split.colorV1), split.colorV1);
  assert.equal(
    parsePhotoGraphColorFeatureV1({ ...split.colorV1, histogram: [1] }),
    null,
  );
  assert.equal(
    computePhotoGraphModelDistance(purple, split, "mean-lab-cie76"),
    0,
    "equal means must remain indistinguishable to the baseline",
  );
  assert.ok(
    computePhotoGraphModelDistance(purple, split, "oklab-histogram") > 0.1,
    "distribution model must distinguish split colors from flat purple",
  );
  assert.ok(
    computePhotoGraphModelDistance(purple, split, "oklab-palette-emd") > 0.05,
    "palette transport must distinguish split colors from flat purple",
  );

  assert.ok(Math.abs(deltaE2000([50, 2.6772, -79.7751], [50, 0, -82.7485]) - 2.0425) < 0.0001);
  assert.equal(hellingerDistance([0.5, 0.5], [0.5, 0.5]), 0);
  assert.ok(Math.abs(hellingerDistance([1, 0], [0, 1]) - 1) < 1e-12);
  assert.ok(
    paletteEarthMoverDistance(
      split.colorV1?.palette ?? [],
      deterministic.colorV1?.palette ?? [],
    ) < 1e-12,
  );

  const fixtures = [
    node("1", purple),
    node("2", split),
    node("3", feature([255, 0, 0], solidRgba(255, 0, 0, 64))),
    node("4", feature([0, 0, 255], solidRgba(0, 0, 255, 64))),
  ];
  const config = {
    version: 2 as const,
    model: "oklab-histogram" as const,
    neighborsPerNode: 2,
    maxDistance: 1,
  };
  const full = generateSparsePhotoGraph(
    fixtures.map((entry) => ({ ...entry, correlations: {} })),
    config,
  );
  assert.ok(full.neighbors.length <= fixtures.length * config.neighborsPerNode);

  const initial = generateSparsePhotoGraph(
    fixtures.slice(0, 3).map((entry) => ({ ...entry, correlations: {} })),
    config,
  );
  const incremental = updateSparsePhotoGraphForAddedNodes(
    fixtures.slice(0, 3),
    fixtures.slice(3),
    initial.neighbors,
    config,
  );
  assert.deepEqual(incremental.neighbors, full.neighbors);

  console.log("Photo graph color model validation passed.");
}

run();