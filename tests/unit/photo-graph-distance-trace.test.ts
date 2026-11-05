import { describe, expect, it } from "vitest";
import {
  computePhotoGraphModelDistance,
  deltaE2000,
  traceDeltaE2000,
} from "@/lib/photo-graph/similarity-models";
import type { GraphFeature } from "@/lib/photo-graph/types";

type Lab = [number, number, number];

// Sharma, Wu and Dalal (2005), supplementary CIEDE2000 test data, pairs 1–8.
const references: { left: Lab; right: Lab; expected: number }[] = [
  { left: [50, 2.6772, -79.7751], right: [50, 0, -82.7485], expected: 2.0425 },
  { left: [50, 3.1571, -77.2803], right: [50, 0, -82.7485], expected: 2.8615 },
  { left: [50, 2.8361, -74.02], right: [50, 0, -82.7485], expected: 3.4412 },
  { left: [50, -1.3802, -84.2814], right: [50, 0, -82.7485], expected: 1 },
  { left: [50, -1.1848, -84.8006], right: [50, 0, -82.7485], expected: 1 },
  { left: [50, -0.9009, -85.5211], right: [50, 0, -82.7485], expected: 1 },
  { left: [50, 0, 0], right: [50, -1, 2], expected: 2.3669 },
  { left: [50, -1, 2], right: [50, 0, 0], expected: 2.3669 },
];

function feature(lab: Lab): GraphFeature {
  return { lab, rgb: [0, 0, 0], hue: 0, longSide: 100 };
}

describe("CIEDE2000 diagnostic trace", () => {
  it.each(references)(
    "matches the published distance $expected for $left → $right",
    ({ left, right, expected }) => {
      const trace = traceDeltaE2000(left, right);
      expect(Math.abs(trace.distance - expected)).toBeLessThan(0.00005);
      expect(trace.distance).toBe(deltaE2000(left, right));
      expect(trace.distance).toBe(
        computePhotoGraphModelDistance(
          feature(left),
          feature(right),
          "mean-lab-ciede2000",
        ),
      );
      expect(trace.normalizedL).toBe(trace.deltaL / trace.lightnessScale);
      expect(trace.normalizedChroma).toBe(
        trace.deltaChroma / trace.chromaScale,
      );
      expect(trace.normalizedHue).toBe(trace.deltaHue / trace.hueScale);
      expect(trace.lightnessSquared).toBe(trace.normalizedL ** 2);
      expect(trace.chromaSquared).toBe(trace.normalizedChroma ** 2);
      expect(trace.hueSquared).toBe(trace.normalizedHue ** 2);
      expect(trace.interaction).toBe(
        trace.rotation * trace.normalizedChroma * trace.normalizedHue,
      );
      expect(trace.sum).toBe(
        trace.lightnessSquared +
          trace.chromaSquared +
          trace.hueSquared +
          trace.interaction,
      );
      expect(trace.distance).toBe(Math.sqrt(trace.sum));
      expect(Object.values(trace).every(Number.isFinite)).toBe(true);
    },
  );
  it.each<Lab>([
    [50, 0, 0],
    [40, 20, -30],
  ])("has zero differences for identical LAB (%s, %s, %s)", (l, a, b) => {
    const lab: Lab = [l, a, b];
    const trace = traceDeltaE2000(lab, lab);
    for (const value of [
      trace.deltaL,
      trace.deltaChroma,
      trace.deltaHue,
      trace.normalizedL,
      trace.normalizedChroma,
      trace.normalizedHue,
      trace.lightnessSquared,
      trace.chromaSquared,
      trace.hueSquared,
      trace.interaction,
      trace.sum,
      trace.distance,
    ])
      expect(value === 0).toBe(true);
  });
  it("keeps neutral lightness signed with no chroma or hue contribution", () => {
    const forward = traceDeltaE2000([40, 0, 0], [60, 0, 0]);
    const reverse = traceDeltaE2000([60, 0, 0], [40, 0, 0]);
    expect(forward.deltaL).toBe(20);
    expect(reverse.deltaL).toBe(-20);
    expect(forward.chromaSquared).toBe(0);
    expect(forward.hueSquared).toBe(0);
    expect(forward.distance).toBe(20);
    expect(reverse.distance).toBe(forward.distance);
  });
  it("sets hue difference to zero when either colour has zero chroma", () => {
    for (const { left, right } of references.slice(6)) {
      const trace = traceDeltaE2000(left, right);
      expect(trace.deltaHue).toBe(0);
      expect(trace.hueSquared).toBe(0);
      expect(trace.interaction === 0).toBe(true);
    }
  });
  it("takes the short signed hue path across 360°/0°", () => {
    const left: Lab = [50, 30, -0.1];
    const right: Lab = [50, 30, 0.1];
    const forward = traceDeltaE2000(left, right);
    const reverse = traceDeltaE2000(right, left);
    expect(forward.deltaHue).toBeCloseTo(0.2, 12);
    expect(reverse.deltaHue).toBeCloseTo(-forward.deltaHue, 12);
    expect(forward.distance).toBeLessThan(0.2);
    expect(reverse.distance).toBeCloseTo(forward.distance, 12);
  });
  it("retains a negative interaction rather than treating it as a square", () => {
    const trace = traceDeltaE2000([50, 0, -50], [50, 10, -60]);
    expect(trace.interaction).toBeLessThan(0);
    expect(trace.chromaSquared).toBeGreaterThan(0);
    expect(trace.hueSquared).toBeGreaterThan(0);
    expect(trace.sum).toBeLessThan(
      trace.lightnessSquared + trace.chromaSquared + trace.hueSquared,
    );
  });
});
