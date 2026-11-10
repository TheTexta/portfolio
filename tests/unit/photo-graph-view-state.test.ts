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
  allocatePhotoGraphTextures,
  photoGraphTextureRequest,
  photoGraphTextureNeedsUpgrade,
} from "@/app/components/projects/photo-graph/texture-budget";
import {
  PHOTO_GRAPH_RENDER_PIXEL_BUDGET,
  photoGraphRenderPixelRatio,
} from "@/app/components/projects/photo-graph/render-quality";
import { pickAllowedWidth } from "@/app/components/projects/photo-graph/imageOptimizer";

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
    const demands = Array.from({ length: 103 }, (_, index) => ({
      id: String(index),
      projectedWidth: 1200,
      aspectRatio: 1,
    }));
    const crowded = allocatePhotoGraphTextures(demands).get("0")!;
    const closeUp = allocatePhotoGraphTextures(
      demands.map((demand, index) => ({
        ...demand,
        projectedWidth: index === 0 ? 1200 : 48,
      })),
    ).get("0")!;
    expect(crowded.residentWidth).toBe(349);
    expect(closeUp.residentWidth).toBe(1280);
    expect(closeUp.residentWidth).toBeGreaterThan(crowded.residentWidth);
  });

  it.each([1, 2, 3])(
    "gives a close-up native pixels with 102 background thumbnails at density %i",
    (density) => {
      const allocations = allocatePhotoGraphTextures([
        { id: "hero", projectedWidth: 1224 * density, aspectRatio: 1.6 },
        ...Array.from({ length: 102 }, (_, index) => ({
          id: String(index),
          projectedWidth: 48 * density,
          aspectRatio: 0.8,
        })),
      ]);
      const hero = allocations.get("hero")!;
      expect(hero.residentWidth).toBeGreaterThanOrEqual(1224 * density);
      expect(hero.residentHeight).toBeGreaterThanOrEqual(765 * density);
      expect(allocations.get("0")!.residentWidth).toBeLessThanOrEqual(
        48 * density,
      );
    },
  );

  it("bounds portrait close-ups by the GPU side limit without changing 2D tiers", () => {
    const hero = allocatePhotoGraphTextures(
      [{ id: "hero", projectedWidth: 2448, aspectRatio: 0.8 }],
      2048,
    ).get("hero")!;
    expect(hero.residentHeight).toBeLessThanOrEqual(2048);
    expect(hero.residentWidth).toBe(1638);
    expect(hero.width).toBe(1920);
    expect(pickAllowedWidth(2448)).toBe(1280);
  });

  it("does not repeatedly upgrade a small original beyond its real dimensions", () => {
    expect(photoGraphTextureRequest(1200, 1.6, 1280, 160)).toEqual({
      width: 160,
      residentWidth: 160,
    });
  });

  it("does not refetch rounded provider heights or budget-fitted textures", () => {
    for (const count of [1, 3, 103]) {
      for (const aspectRatio of [0.625, 1.01, 1.81, 2.27, 3.97, 4.82]) {
        const allocation = allocatePhotoGraphTextures(
          Array.from({ length: count }, (_, index) => ({
            id: String(index),
            projectedWidth: 3200,
            aspectRatio,
          })),
        ).get("0")!;
        const providerHeight = Math.round(allocation.width / aspectRatio);
        const scale = Math.min(
          1,
          allocation.residentWidth / allocation.width,
          allocation.residentHeight / providerHeight,
        );
        const actualWidth = Math.floor(allocation.width * scale);
        expect(
          photoGraphTextureNeedsUpgrade(
            actualWidth,
            allocation.residentWidth,
            aspectRatio,
          ),
        ).toBe(false);
        expect(
          photoGraphTextureNeedsUpgrade(
            Math.floor(actualWidth / 2),
            allocation.residentWidth,
            aspectRatio,
          ),
        ).toBe(true);
      }
    }
    expect(photoGraphTextureNeedsUpgrade(undefined, 1, 1)).toBe(true);
  });

  it("fits total RGBA demand without evicting visible photos", () => {
    for (const count of [1, 3, 45, 100, 103, 300, 1000, 10000]) {
      const allocations = allocatePhotoGraphTextures(
        Array.from({ length: count }, (_, index) => ({
          id: String(index),
          projectedWidth: 10000,
          aspectRatio: [0.625, 1, 1.6, 4][index % 4],
        })),
      );
      let bytes = 0;
      for (const { residentWidth, residentHeight } of allocations.values()) {
        expect(residentWidth).toBeGreaterThan(0);
        expect(residentHeight).toBeGreaterThan(0);
        expect(Math.max(residentWidth, residentHeight)).toBeLessThanOrEqual(
          PHOTO_GRAPH_MAX_TEXTURE_SIDE,
        );
        bytes += residentWidth * residentHeight * 4;
      }
      expect(bytes).toBeLessThanOrEqual(PHOTO_GRAPH_TEXTURE_BUDGET);
    }
    expect(allocatePhotoGraphTextures([]).size).toBe(0);
  });
});

describe("3D drawing-buffer resolution", () => {
  it("matches native Retina and mobile density instead of capping at 1.5", () => {
    expect(photoGraphRenderPixelRatio(1440, 900, 2)).toBe(2);
    expect(photoGraphRenderPixelRatio(390, 844, 3)).toBe(3);
    expect(photoGraphRenderPixelRatio(1280, 720, 1)).toBe(1);
  });

  it("bounds very large framebuffers without changing small viewport density", () => {
    const ratio = photoGraphRenderPixelRatio(3840, 2160, 3);
    expect(ratio).toBeLessThan(3);
    expect(3840 * 2160 * ratio ** 2).toBeLessThanOrEqual(
      PHOTO_GRAPH_RENDER_PIXEL_BUDGET + 1,
    );
    expect(photoGraphRenderPixelRatio(0, 0, 0)).toBe(1);
  });
});
