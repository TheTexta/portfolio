import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { createAnimationTimeline } from "@/lib/animation/timeline";
import {
  createPaletteRenderer,
  PALETTE_DURATION,
  PALETTE_STAGES,
  palettePoseAt,
  type PalettePose,
} from "@/lib/elliot-mairet/palette-animation";
import recording from "@/public/projects/elliot-mairet/palette-extraction/recording.json";

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

describe("Elliot's real five-colour extraction", () => {
  it("retains the original photograph, actual extractor provenance and published palette", async () => {
    const bytes = await readFile(
      new URL(
        "../../public/projects/elliot-mairet/palette-extraction/photograph.webp",
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
    expect(recording.analysis.extractorSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(recording.analysis.analysisSourceSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(recording.analysis.algorithm).toBe("kmedoids-oklab-v1");
    expect(recording.analysis).toMatchObject({
      sampleWidth: 96,
      sampleHeight: 64,
      opaquePixels: 6144,
    });
    expect(recording.palette.map(({ hex }) => hex)).toEqual([
      "#907050",
      "#b09050",
      "#705030",
      "#d0b070",
      "#301010",
    ]);
    expect(
      recording.palette.reduce((sum, colour) => sum + colour.weight, 0),
    ).toBeCloseTo(1, 12);
    expect(recording.palette.map(({ weight }) => weight)).toEqual(
      recording.palette.map(({ weight }) => weight).toSorted((a, b) => b - a),
    );
  });

  it("shows a spatial subset of real pixels, not invented sample colours", () => {
    expect(recording.tiles).toHaveLength(384);
    expect(new Set(recording.tiles.map(({ x, y }) => `${x},${y}`)).size).toBe(
      384,
    );
    expect(new Set(recording.tiles.map(({ group }) => group)).size).toBe(5);
    for (const tile of recording.tiles) {
      expect(tile.x % 4).toBe(0);
      expect(tile.y % 4).toBe(0);
      expect(tile.x).toBeLessThan(96);
      expect(tile.y).toBeLessThan(64);
      expect(tile.hex).toMatch(/^#[a-f0-9]{6}$/);
      expect(tile.group).toBeGreaterThanOrEqual(0);
      expect(tile.group).toBeLessThan(5);
    }
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
