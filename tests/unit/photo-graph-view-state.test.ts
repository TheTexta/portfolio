import { describe, expect, it } from "vitest";
import {
  createRendererData,
  createThreeDRendererData,
  photoGraphForceSettingsKey,
  fitPhotoGraph3DView,
  seedPhotoGraphDepth,
  snapshotPositions,
  type PhotoGraphViewSnapshot,
} from "@/app/components/projects/photo-graph/view-state";
import type { PhotoGraphData } from "@/app/components/projects/photo-graph/types";
import { DEFAULT_PHOTO_GRAPH_RUNTIME_CONTROLS } from "@/lib/photo-graph/graph-controls";
import {
  PHOTO_GRAPH_TEXTURE_BUDGET,
  PHOTO_GRAPH_MAX_TEXTURE_SIDE,
  photoGraphTextureSideLimit,
  photoGraphTextureRequest,
} from "@/app/components/projects/photo-graph/texture-budget";

function graph(): PhotoGraphData {
  return {
    nodes: ["one", "two"].map((id) => ({
      id,
      sourceUrl: "/test.webp",
      baseSize: 100,
      aspectRatio: 1.5,
      hasKnownAspectRatio: true,
      layerNoise: 0,
      w: 150,
      h: 100,
      renderArea: 15000,
    })),
    links: [{ source: "one", target: "two", value: 0.8, baseValue: 0.8 }],
  };
}

describe("Photo Graph renderer isolation", () => {
  it("fits photographs and depth using numeric positions before scene objects update", () => {
    const data = createThreeDRendererData(graph());
    const desktop = fitPhotoGraph3DView(data.nodes, 16 / 9, 75)!;
    const mobile = fitPhotoGraph3DView(data.nodes, 390 / 844, 75)!;
    expect(fitPhotoGraph3DView([], 1, 75)).toBeNull();
    expect(mobile.camera.z).toBeGreaterThanOrEqual(desktop.camera.z);
    for (const node of data.nodes) {
      const distance = mobile.camera.z - node.z!;
      const halfHeight = Math.tan((75 * Math.PI) / 360) * distance;
      const halfWidth = (halfHeight * 390) / 844;
      expect(Math.abs(node.x! - mobile.target.x) + node.w / 2).toBeLessThan(
        halfWidth,
      );
      expect(Math.abs(node.y! - mobile.target.y) + node.h / 2).toBeLessThan(
        halfHeight,
      );
    }
  });
  it("initializes complete XYZ coordinates so d3 does not overwrite depth seeds", () => {
    const source = graph();
    const data = createThreeDRendererData(source);
    expect(
      data.nodes.every((node) =>
        [node.x, node.y, node.z].every(Number.isFinite),
      ),
    ).toBe(true);
    expect(data.nodes[0].z).toBe(seedPhotoGraphDepth(source.nodes[0].id));
    expect(source.nodes[0].z).toBeUndefined();
    expect(createThreeDRendererData(source)).toEqual(data);
  });

  it("invalidates frozen layouts for force changes, not connection visibility", () => {
    const controls = DEFAULT_PHOTO_GRAPH_RUNTIME_CONTROLS;
    const key = photoGraphForceSettingsKey(controls);
    expect(
      photoGraphForceSettingsKey({
        ...controls,
        hideConnections: !controls.hideConnections,
      }),
    ).toBe(key);
    expect(
      photoGraphForceSettingsKey({
        ...controls,
        chargeMult: controls.chargeMult + 0.1,
      }),
    ).not.toBe(key);
    expect(
      photoGraphForceSettingsKey({ ...controls, distMaxMult: 0.5 }),
    ).not.toBe(key);
  });
  it("gives each renderer its own nodes and mutable link endpoints", () => {
    const source = graph();
    source.nodes.forEach(Object.freeze);
    source.links.forEach(Object.freeze);
    const twoD = createRendererData(source);
    const threeD = createRendererData(source);
    threeD.nodes[0].x = 41;
    threeD.nodes[0].z = -100;
    threeD.nodes[0].__threeObj = { private: true };
    threeD.links[0].source = threeD.nodes[0];
    expect(source.nodes[0].x).toBeUndefined();
    expect(twoD.nodes[0].z).toBeUndefined();
    expect(twoD.nodes[0].__threeObj).toBeUndefined();
    expect(source.links[0].source).toBe("one");
    expect(twoD.links[0].source).toBe("one");
    expect(threeD.links[0].baseValue).toBe(0.8);
  });

  it("normalizes resolved endpoints back to IDs without cloning Three objects", () => {
    const source = graph();
    source.links[0].source = source.nodes[0];
    const copy = createRendererData(source);
    expect(copy.links[0].source).toBe("one");
    expect(copy.nodes[0]).not.toBe(source.nodes[0]);
  });

  it("restores numeric positions only for the matching fetched graph", () => {
    const source = graph();
    const runtime = createRendererData(source);
    Object.assign(runtime.nodes[0], {
      x: 20,
      y: -10,
      z: 50,
      vx: 2,
      fz: 50,
      __threeObj: {},
    });
    const snapshot: PhotoGraphViewSnapshot = {
      data: source,
      positions: snapshotPositions(runtime.nodes),
      camera: { x: 1, y: 2, z: 3 },
      target: { x: 0, y: 0, z: 0 },
    };
    const restored = createRendererData(source, snapshot);
    expect(restored.nodes[0]).toMatchObject({ x: 20, y: -10, z: 50 });
    expect(restored.nodes[0].vx).toBeUndefined();
    expect(restored.nodes[0].fz).toBeUndefined();
    expect(restored.nodes[0].__threeObj).toBeUndefined();
    expect(snapshot.positions.size).toBe(1);
    expect(createRendererData(graph(), snapshot).nodes[0].x).toBeUndefined();
  });

  it("seeds finite, deterministic, non-planar depth without changing graph features", () => {
    const depths = Array.from({ length: 103 }, (_, index) =>
      seedPhotoGraphDepth(String(index)),
    );
    expect(
      depths.every(
        (depth) =>
          Number.isFinite(depth) && depth !== 0 && Math.abs(depth) <= 500,
      ),
    ).toBe(true);
    expect(new Set(depths).size).toBe(103);
    expect(seedPhotoGraphDepth("112")).toBe(seedPhotoGraphDepth("112"));
    expect(seedPhotoGraphDepth("")).not.toBe(0);
  });
});

describe("3D texture admission", () => {
  it("compares actual admitted pixels rather than rounded request tiers", () => {
    expect(photoGraphTextureRequest(500, 1, 349)).toEqual({
      width: 384,
      residentWidth: 349,
    });
    expect(photoGraphTextureRequest(500, 0.625, 349)).toEqual({
      width: 224,
      residentWidth: 218,
    });
  });

  it("can upgrade again after budget downscaling, up to the close-up tier", () => {
    const crowded = photoGraphTextureRequest(
      1200,
      1,
      photoGraphTextureSideLimit(103),
    );
    const closeUp = photoGraphTextureRequest(
      1200,
      1,
      photoGraphTextureSideLimit(3),
    );
    expect(crowded.residentWidth).toBe(349);
    expect(closeUp.residentWidth).toBe(1280);
    expect(closeUp.residentWidth).toBeGreaterThan(crowded.residentWidth);
  });

  it("does not repeatedly upgrade a small original beyond its real dimensions", () => {
    expect(photoGraphTextureRequest(1200, 1.6, 1280, 160)).toEqual({
      width: 160,
      residentWidth: 160,
    });
  });

  it("fits the worst-case square RGBA cost without evicting visible photos", () => {
    for (const count of [1, 3, 45, 100, 103, 300, 1000, 10000]) {
      const side = photoGraphTextureSideLimit(count);
      expect(side).toBeGreaterThan(0);
      expect(side).toBeLessThanOrEqual(PHOTO_GRAPH_MAX_TEXTURE_SIDE);
      expect(count * side * side * 4).toBeLessThanOrEqual(
        PHOTO_GRAPH_TEXTURE_BUDGET,
      );
    }
    expect(photoGraphTextureSideLimit(0)).toBe(PHOTO_GRAPH_MAX_TEXTURE_SIDE);
  });
});
