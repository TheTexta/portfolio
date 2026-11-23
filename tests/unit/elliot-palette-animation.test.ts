import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { createAnimationTimeline } from "@/lib/animation/timeline";
import {
  createPaletteRenderer,
  layoutPaletteScene,
  PALETTE_DURATION,
  PALETTE_LAYOUT,
  PALETTE_STAGES,
  paletteSwatchLayout,
  palettePoseAt,
  type PalettePose,
} from "@/lib/elliot-mairet/palette-animation";
import historical from "@/public/projects/elliot-mairet/palette-extraction/recording.json";
import recording from "@/public/projects/elliot-mairet/palette-extraction/mmcq-v1/recording.json";

function fixture() {
  let now = 0;
  let id = 0;
  const requests = new Map<number, (time: number) => void>();
  let pose: PalettePose = palettePoseAt(PALETTE_DURATION);
  const render = createPaletteRenderer((next) => {
    pose = next;
  });
  const timeline = createAnimationTimeline(PALETTE_STAGES, render, {
    now: () => now,
    request: (callback) => {
      requests.set(++id, callback);
      return id;
    },
    cancel: (key) => {
      requests.delete(key);
    },
  });
  return {
    timeline,
    pose: () => pose,
    step(ms: number) {
      now += ms;
      const pending = [...requests.values()];
      requests.clear();
      pending.forEach((callback) => callback(now));
    },
  };
}

describe("Elliot's frozen current-model extraction", () => {
  it("keeps both historical fixtures byte-identical and explicitly historical", async () => {
    for (const [filename, expected] of [
      [
        "recording.json",
        "bf93b1ae8ab14ffe2ef8aa0577cf78744fb6a87b4a135f20d08b2239a5c6fe52",
      ],
      [
        "photograph.webp",
        "8e5e752d41b0baa69424b5a48458cc863f3f96ea0d33a4ce30be8382dd45add1",
      ],
    ]) {
      const bytes = await readFile(
        new URL(
          `../../public/projects/elliot-mairet/palette-extraction/${filename}`,
          import.meta.url,
        ),
      );
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(expected);
    }
    expect(historical.analysis.algorithm).toBe("kmedoids-oklab-v1");
    expect(recording.photograph.originalSha256).toBe(
      historical.photograph.originalSha256,
    );
  });

  it("retains the approved original, current production provenance and actual selection order", async () => {
    const frozenRecord = await readFile(
      new URL(
        "../../public/projects/elliot-mairet/palette-extraction/mmcq-v1/recording.json",
        import.meta.url,
      ),
    );
    expect(createHash("sha256").update(frozenRecord).digest("hex")).toBe(
      "06473935c4b5132298a5dfe013176542372bb34b3d24380a0f3cb0e755392dee",
    );
    const bytes = await readFile(
      new URL(
        "../../public/projects/elliot-mairet/palette-extraction/mmcq-v1/photograph.webp",
        import.meta.url,
      ),
    );
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(
      recording.photograph.assetSha256,
    );
    expect(recording.photograph.originalUrl).toMatch(
      /^https:\/\/media\.dextery\.dev\/elliotmairet\/uploads\//,
    );
    expect(recording.photograph.originalSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(recording.snapshot.sourceRevision).toBe(
      "aef9eb2cc1cde3b9c79e738fd27ed34ddc03c74a",
    );
    expect(Object.keys(recording.snapshot.sourcesSha256)).toEqual(
      expect.arrayContaining([
        "lib/palette/analyse-buffer.ts",
        "lib/palette/mmcq-vibrant.js",
        "lib/photographs/analyse-image.ts",
        "lib/photographs/config.ts",
        "package-lock.json",
      ]),
    );
    for (const hash of Object.values(recording.snapshot.sourcesSha256))
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(recording.snapshot.runtime).toMatchObject({
      node: "v22.23.4",
      sharp: "0.35.5",
      vips: "8.18.7",
    });
    expect(recording.analysis).toMatchObject({
      algorithm: "mmcq64-vibrant-oklab-v1",
      quantisationPhases: 2,
      maximumSampleLongestSide: 256,
      sampleWidth: 256,
      sampleHeight: 171,
      opaquePixels: 43776,
      paletteOrder: "production selection order, not population-weight order",
    });
    expect(recording.palette.map(({ hex }) => hex)).toEqual([
      "#cea01e",
      "#845811",
      "#381f0b",
      "#7fa1cc",
      "#ae7f0b",
    ]);
    expect(
      recording.palette.reduce((sum, colour) => sum + colour.weight, 0),
    ).toBeCloseTo(1, 12);
    expect(recording.palette.map(({ weight }) => weight)).not.toEqual(
      recording.palette.map(({ weight }) => weight).toSorted((a, b) => b - a),
    );
    for (const colour of recording.palette)
      expect(colour.storedWeight).toBe(Number(colour.weight.toFixed(6)));
  });

  it("shows a spatial subset of real pixels, not invented sample colours", () => {
    expect(recording.tiles).toHaveLength(330);
    expect(new Set(recording.tiles.map(({ x, y }) => `${x},${y}`)).size).toBe(
      330,
    );
    expect(new Set(recording.tiles.map(({ group }) => group)).size).toBe(5);
    for (const tile of recording.tiles) {
      expect(tile.x % recording.analysis.displayedSampleStride).toBe(0);
      expect(tile.y % recording.analysis.displayedSampleStride).toBe(0);
      expect(tile.x).toBeLessThan(recording.analysis.sampleWidth);
      expect(tile.y).toBeLessThan(recording.analysis.sampleHeight);
      expect(tile.hex).toMatch(/^#[a-f0-9]{6}$/);
      expect(tile.group).toBeGreaterThanOrEqual(0);
      expect(tile.group).toBeLessThan(recording.palette.length);
    }
  });

  for (const count of [1, 2, 5]) {
    it(`centres ${count} actual swatches and fits every explanatory tile without overflow`, () => {
      const fixture = {
        ...recording,
        palette: recording.palette.slice(0, count),
        tiles: recording.tiles.map((tile, index) => ({
          ...tile,
          group: index % count,
        })),
      };
      const { swatches, tiles } = layoutPaletteScene(fixture);
      expect(swatches).toEqual(paletteSwatchLayout(count));
      expect(swatches.x * 2 + swatches.width).toBe(PALETTE_LAYOUT.width);
      expect(swatches.width).toBe(80 + (count - 1) * 120);
      expect(new Set(tiles.map(({ paletteX }) => paletteX)).size).toBe(count);
      expect(tiles).toHaveLength(recording.tiles.length);
      for (const tile of tiles) {
        expect(tile.groupX - tile.groupSize / 2).toBeGreaterThanOrEqual(
          tile.paletteX - swatches.size / 2,
        );
        expect(tile.groupX + tile.groupSize / 2).toBeLessThanOrEqual(
          tile.paletteX + swatches.size / 2,
        );
        expect(tile.groupY - tile.groupSize / 2).toBeGreaterThan(
          PALETTE_LAYOUT.photo.y + PALETTE_LAYOUT.photo.height,
        );
        expect(tile.groupY + tile.groupSize / 2).toBeLessThan(
          PALETTE_LAYOUT.height,
        );
        expect(tile.sourceX).toBeGreaterThanOrEqual(PALETTE_LAYOUT.photo.x);
        expect(tile.sourceX).toBeLessThanOrEqual(
          PALETTE_LAYOUT.photo.x + PALETTE_LAYOUT.photo.width,
        );
        expect(tile.sourceY).toBeGreaterThanOrEqual(PALETTE_LAYOUT.photo.y);
        expect(tile.sourceY).toBeLessThanOrEqual(
          PALETTE_LAYOUT.photo.y + PALETTE_LAYOUT.photo.height,
        );
        expect(tile.groupSize).toBeGreaterThan(0);
      }
    });
  }

  it("rejects empty or oversized palette layouts instead of inventing swatches", () => {
    for (const count of [0, 6, 1.5])
      expect(() => paletteSwatchLayout(count)).toThrow();
  });

  it("progressively samples, groups and settles, then resets smoothly on the shared clock", () => {
    const { timeline, step, pose } = fixture();
    timeline.setActive(true);
    expect(pose()).toEqual({ sample: 0, group: 0, palette: 0 });
    step(425);
    expect(pose()).toEqual({ sample: 0.875, group: 0, palette: 0 });
    step(2475);
    expect(pose()).toEqual({ sample: 1, group: 0.875, palette: 0 });
    step(2300);
    expect(pose()).toEqual({ sample: 1, group: 1, palette: 1 });
    step(2300);
    expect(timeline.getFrame().transition?.kind).toBe("reset");
    expect(pose()).toEqual({ sample: 1, group: 1, palette: 1 });
    step(225);
    expect(pose()).toEqual({ sample: 0.125, group: 0.125, palette: 0.125 });
    step(225);
    expect(pose()).toEqual({ sample: 0, group: 0, palette: 0 });
    expect(timeline.getFrame().cycle).toBe(1);
  });

  it("shows a settled stage when selected, without undoing it as autoplay resumes", () => {
    const { timeline, step, pose } = fixture();
    timeline.setActive(true);
    timeline.toggle();
    timeline.seek(2100);
    step(450);
    expect(pose()).toEqual({ sample: 1, group: 1, palette: 0 });
    expect(timeline.getFrame().timeMs).toBe(2000);
    timeline.toggle();
    step(1000);
    expect(pose()).toEqual({ sample: 1, group: 1, palette: 0 });
    step(1500);
    expect(pose()).toEqual({ sample: 1, group: 1, palette: 0 });
    step(350);
    expect(pose()).toEqual({ sample: 1, group: 1, palette: 0.875 });
  });

  it("starts interrupted reset and stage transitions from the exact current pose", () => {
    const { timeline, step, pose } = fixture();
    timeline.setActive(true);
    step(PALETTE_DURATION);
    step(100);
    const middle = { ...pose() };
    timeline.seek(4500);
    expect(pose()).toEqual(middle);
    step(100);
    const interrupted = { ...pose() };
    timeline.seek(0);
    expect(pose()).toEqual(interrupted);
    step(450);
    expect(pose()).toEqual({ sample: 1, group: 0, palette: 0 });
  });

  it("keeps the final palette static for reduced motion and permits immediate stage selection", () => {
    const { timeline, step, pose } = fixture();
    timeline.setActive(true);
    timeline.setReducedMotion(true);
    step(10_000);
    expect(pose()).toEqual({ sample: 1, group: 1, palette: 1 });
    timeline.seek(2000);
    expect(pose()).toEqual({ sample: 1, group: 1, palette: 0 });
    timeline.seek(0);
    expect(pose()).toEqual({ sample: 1, group: 0, palette: 0 });
  });
});
