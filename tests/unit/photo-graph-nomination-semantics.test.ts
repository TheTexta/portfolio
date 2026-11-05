import { describe, expect, it } from "vitest";
import { generateSparsePhotoGraph } from "@/lib/photo-graph/sparse-edge-generation";
import type {
  GraphNode,
  PhotoGraphSparseEdgeGenerationConfig,
} from "@/lib/photo-graph/types";

// Synthetic boundary cases are tests only, never displayed as photograph data.
const node = (id: string, lightness: number): GraphNode => ({
  id,
  scale: 1,
  colour: "#000000",
  correlations: {},
  feature: { rgb: [0, 0, 0], lab: [lightness, 0, 0], hue: 0, longSide: 1 },
});
const config: PhotoGraphSparseEdgeGenerationConfig = {
  version: 2,
  model: "mean-lab-cie76",
  neighborsPerNode: 4,
  maxDistance: 10,
};

describe("walkthrough nomination semantics match the production generator", () => {
  it("excludes self-matches and resolves exact ties by deterministic numeric ID", () => {
    const result = generateSparsePhotoGraph(
      [node("1", 0), node("10", 5), node("2", 5)],
      { ...config, neighborsPerNode: 1 },
    );
    expect(
      result.neighbors
        .filter((edge) => edge.sourceId === "1")
        .map((edge) => edge.targetId),
    ).toEqual(["2"]);
    expect(
      result.neighbors.every((edge) => edge.sourceId !== edge.targetId),
    ).toBe(true);
  });
  it("counts a nomination at the cutoff but excludes its zero-weight graph edge", () => {
    const result = generateSparsePhotoGraph(
      [node("1", 0), node("2", 10), node("3", 10.001)],
      config,
    );
    const nominations = result.neighbors.filter(
      (edge) => edge.sourceId === "1",
    );
    expect(nominations).toHaveLength(1);
    expect(nominations[0]).toMatchObject({
      targetId: "2",
      distance: 10,
      correlation: 0,
    });
    expect(result.nodes[0].correlations).toEqual({});
    expect(result.nodes[1].correlations["1"]).toBeUndefined();
  });
  it("creates an undirected edge through reverse nomination and counts degree separately", () => {
    const result = generateSparsePhotoGraph(
      [node("1", 0), node("2", 2), node("3", 2.1)],
      { ...config, neighborsPerNode: 1 },
    );
    expect(
      result.neighbors
        .filter((edge) => edge.sourceId === "2")
        .map((edge) => edge.targetId),
    ).toEqual(["3"]);
    expect(result.nodes[1].correlations["1"]).toBe(0.8);
    expect(result.nodes[0].correlations["2"]).toBe(0.8);
    expect(Object.keys(result.nodes[1].correlations)).toHaveLength(2);
    expect(
      result.neighbors.filter((edge) => edge.sourceId === "2"),
    ).toHaveLength(1);
  });
  it("leaves an isolated node isolated instead of forcing a visible relationship", () => {
    const result = generateSparsePhotoGraph(
      [node("1", 0), node("2", 40), node("3", 41)],
      config,
    );
    expect(
      result.neighbors.filter((edge) => edge.sourceId === "1"),
    ).toHaveLength(0);
    expect(result.nodes[0].correlations).toEqual({});
    expect(Object.keys(result.nodes[1].correlations)).toEqual(["3"]);
  });
  it("applies the neighbour limit independently and rescales retained weights with cutoff", () => {
    const run = (maxDistance: number) =>
      generateSparsePhotoGraph(
        Array.from({ length: 8 }, (_, i) => node(String(i + 1), i)),
        { ...config, maxDistance },
      );
    const narrow = run(10);
    const wide = run(20);
    expect(
      narrow.neighbors.filter((edge) => edge.sourceId === "1"),
    ).toHaveLength(4);
    expect(wide.neighbors.filter((edge) => edge.sourceId === "1")).toHaveLength(
      4,
    );
    expect(narrow.nodes[0].correlations["2"]).toBe(0.9);
    expect(wide.nodes[0].correlations["2"]).toBe(0.95);
  });
});
