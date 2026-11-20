import { describe, expect, it } from "vitest";
import { featureFromRgb } from "@/lib/photo-graph/feature-extraction";
import { scaleFromLongSide } from "@/lib/photo-graph/correlation";
import { generateSparsePhotoGraph } from "@/lib/photo-graph/sparse-edge-generation";
import {
  nextPhotoGraphNodeId,
  planPhotoGraphUploadNodes,
  planPhotoGraphUploadGraph,
  type ParsedUploadRegistration,
} from "@/lib/photo-graph/upload-plan";
import type {
  GraphNode,
  PhotoGraphEdgeGenerationConfig,
} from "@/lib/photo-graph/types";

const config: PhotoGraphEdgeGenerationConfig = {
  version: 2,
  model: "mean-lab-cie76",
  neighborsPerNode: 2,
  maxDistance: 200,
};
function node(id: string, rgb: number, longSide = 100): GraphNode {
  return {
    id,
    colour: "#808080",
    scale: 1,
    correlations: {},
    feature: featureFromRgb([rgb, rgb, rgb], longSide),
  };
}
const upload: ParsedUploadRegistration = {
  storagePath: "photography-images/_pending/test.png",
  colour: "#808080",
  feature: featureFromRgb([128, 128, 128], 200),
  dimensions: { width: 200, height: 100, aspectRatio: 2 },
};

describe("pure upload graph planning", () => {
  it("uses reserved identities for mixed-provider destinations without changing inputs", () => {
    const existing = [node("900", 120)];
    const before = structuredClone(existing);
    const r2: ParsedUploadRegistration = {
      ...upload,
      storagePath: "staging/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.png",
      storageProvider: "r2",
      sourceSize: 12,
      sourceSha256: "a".repeat(64),
      contentType: "image/png",
    };
    const plan = planPhotoGraphUploadNodes(
      existing,
      100,
      [upload, r2],
      ["101", "103"],
    );
    expect(nextPhotoGraphNodeId([...existing, node("not-numeric", 1)])).toBe(
      901,
    );
    expect(plan.createdIds).toEqual(["101", "103"]);
    expect(plan.legacyAssets).toEqual([
      { source: upload.storagePath, destination: "photography-images/101.png" },
    ]);
    expect(plan.r2Assets).toEqual([
      {
        source: r2.storagePath,
        nodeId: "103",
        size: 12,
        sha256: "a".repeat(64),
        contentType: "image/png",
      },
    ]);
    expect(plan.createdNodes[0].storageProvider).toBeUndefined();
    expect(plan.createdNodes[1]).toMatchObject({
      storageProvider: "r2",
      storagePath: "photography-images/103.png",
    });
    expect(plan.existingNodes[0].scale).toBe(scaleFromLongSide(100, 200));
    expect(existing).toEqual(before);
  });
  it.each(["static", "missing-directed", "incremental"])(
    "preserves full graph equivalence for %s snapshots, including rescaling",
    (mode) => {
      const previous = generateSparsePhotoGraph(
        [node("1", 100), node("2", 150), node("3", 180)],
        config,
      );
      const plan = planPhotoGraphUploadNodes(
        previous.nodes,
        100,
        [upload],
        ["101"],
      );
      const before = structuredClone(plan);
      const graph = planPhotoGraphUploadGraph(
        plan,
        mode === "incremental" ? previous.neighbors : [],
        mode === "static" ? "static" : "database",
        config,
      );
      const full = generateSparsePhotoGraph(
        structuredClone(plan.nodes),
        config,
      );
      expect(graph.generatedNodes).toEqual(full.nodes);
      expect(graph.neighbors).toEqual(full.neighbors);
      if (mode !== "incremental")
        expect(graph.sourceIds).toEqual(full.nodes.map((node) => node.id));
      else expect(graph.sourceIds).toContain("101");
      expect(plan).toEqual(before);
    },
  );
  it("keeps existing scales when a smaller image is added and replaces changed source neighborhoods only", () => {
    const sparseConfig = { ...config, neighborsPerNode: 1, maxDistance: 5 };
    const previous = generateSparsePhotoGraph(
      [node("1", 0), node("2", 255)],
      sparseConfig,
    );
    const smallUpload = { ...upload, feature: featureFromRgb([1, 1, 1], 50) };
    const plan = planPhotoGraphUploadNodes(
      previous.nodes,
      100,
      [smallUpload],
      ["101"],
    );
    // A directed snapshot can include a source far outside the new node's neighborhood.
    const graph = planPhotoGraphUploadGraph(
      plan,
      [
        {
          sourceId: "1",
          model: config.model,
          feature_version: 1,
          targetId: "2",
          rank: 1,
          distance: 100,
          correlation: 0.1,
        },
      ],
      "database",
      sparseConfig,
    );
    expect(plan.existingNodes.map((node) => node.scale)).toEqual(
      previous.nodes.map((node) => node.scale),
    );
    expect(graph.sourceIds).toContain("1");
    expect(graph.sourceIds).not.toContain("2");
    expect(plan.createdNodes[0].scale).toBe(scaleFromLongSide(50, 100));
  });
});
