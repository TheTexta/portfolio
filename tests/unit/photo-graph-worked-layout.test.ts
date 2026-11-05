import { describe, expect, it } from "vitest";
import {
  exampleLinkDistance,
  runExampleLayout,
  settleExampleLayout,
} from "@/app/write-ups/photo-graph/_components/layout-engine";
import { exampleScreenPoint } from "@/app/write-ups/photo-graph/_components/layout-geometry";
import type {
  ExampleEdge,
  ExamplePhoto,
} from "@/app/write-ups/photo-graph/_components/example-types";
import { computePhotoGraphLinkStrength } from "@/lib/photo-graph/force-graph";
import {
  createRectangleCollideForce,
  type RectangleCollisionNode,
} from "@/lib/photo-graph/rectangle-collision";

// Deliberately synthetic test descriptors, not a replacement production fixture.
function photo(id: string): ExamplePhoto {
  return {
    id,
    label:
      (
        {
          "112": "Performance",
          "27": "Harbour",
          "65": "Amber interior",
        } as Record<string, string>
      )[id] ?? `Photograph ${id}`,
    alt: `Synthetic photograph ${id}`,
    src: `/projects/photo-graph/write-up/photographs/${id}.webp`,
    width: 120,
    height: 80,
    rgb: [10, 20, 30],
    lab: [40, 5, 6],
    hue: 30,
    longSide: 120,
    source: {
      url: "https://example.invalid/test",
      sha256: "test-only",
      bytes: 100,
    },
    analysis: {
      width: 2,
      height: 2,
      pixelCount: 4,
      weightSum: 4,
      sums: [40, 80, 120],
      rgbaSha256: "test-only",
    },
  };
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

const nodes = deepFreeze([photo("112"), photo("27"), photo("65")]);
const edges: ExampleEdge[] = deepFreeze([
  { source: "112", target: "27", weight: 0.9 },
  { source: "27", target: "65", weight: 0.6 },
]);

describe("worked-example layout", () => {
  it("settles deterministically with finite positions and never mutates descriptors", () => {
    const before = JSON.stringify({ nodes, edges });
    const first = settleExampleLayout(nodes, edges);
    expect(first).toEqual(settleExampleLayout(nodes, edges));
    expect(first.map((point) => point.id)).toEqual(
      nodes.map((node) => node.id),
    );
    expect(
      first.every(
        (point) => Number.isFinite(point.x) && Number.isFinite(point.y),
      ),
    ).toBe(true);
    expect(JSON.stringify({ nodes, edges })).toBe(before);
    expect(new Set(first.map(({ x, y }) => `${x},${y}`)).size).toBe(3);
  });

  it("handles empty and disconnected graphs without invented edges", () => {
    expect(settleExampleLayout([], [])).toEqual([]);
    const positions = settleExampleLayout(nodes, []);
    expect(positions).toHaveLength(3);
    expect(
      positions.every(({ x, y }) => Number.isFinite(x) && Number.isFinite(y)),
    ).toBe(true);
    expect(edges).toHaveLength(2);
  });

  it("uses the live weight-to-distance and weight-to-strength relationships", () => {
    const strong = { source: "112", target: "27", value: 0.9 };
    const weak = { ...strong, value: 0.2 };
    expect(exampleLinkDistance(strong)).toBeLessThan(exampleLinkDistance(weak));
    expect(computePhotoGraphLinkStrength(strong)).toBeGreaterThan(
      computePhotoGraphLinkStrength(weak),
    );
    expect(exampleLinkDistance(strong, 2)).toBeCloseTo(
      exampleLinkDistance(strong) * 2,
    );
    expect(
      exampleLinkDistance({
        source: { id: "112", w: 80, h: 20 },
        target: { id: "27", w: 80, h: 20 },
        value: 1,
      }),
    ).toBeCloseTo(57.6);
  });

  it("keeps layout-only spacing isolated from input edges, features and initial positions", () => {
    const positions = deepFreeze(settleExampleLayout(nodes, edges));
    const before = JSON.stringify({ nodes, edges, positions });
    const close = runExampleLayout(
      nodes,
      edges,
      positions,
      0.5,
      () => {},
      () => {},
    );
    close.stop();
    const wide = runExampleLayout(
      nodes,
      edges,
      positions,
      2,
      () => {},
      () => {},
    );
    wide.stop();
    expect(JSON.stringify({ nodes, edges, positions })).toBe(before);
  });

  it("stops pending simulation callbacks without delivering an end callback", async () => {
    let ticks = 0;
    let ended = false;
    const engine = runExampleLayout(
      nodes,
      edges,
      settleExampleLayout(nodes, edges),
      1,
      () => {
        ticks += 1;
      },
      () => {
        ended = true;
      },
    );
    engine.stop();
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(ticks).toBe(0);
    expect(ended).toBe(false);
  });
});

describe("SVG pointer geometry", () => {
  it("maps CSS-scaled, offset and letterboxed screen points to SVG layout units without mutation", () => {
    const matrix = deepFreeze({ a: 0.5, b: 0, c: 0, d: 0.5, e: 100, f: 40 });
    const screen = deepFreeze({ x: 110, y: 55 });
    expect(exampleScreenPoint(screen, matrix)).toEqual({ x: 20, y: 30 });
    expect(screen).toEqual({ x: 110, y: 55 });
    expect(matrix.e).toBe(100);
  });

  it("inverts rotation/skew rather than assuming screen and SVG axes are aligned", () => {
    expect(
      exampleScreenPoint(
        { x: 34, y: 68 },
        { a: 0, b: 2, c: -3, d: 0, e: 40, f: 60 },
      ),
    ).toEqual({ x: 4, y: 2 });
    expect(
      exampleScreenPoint(
        { x: 1, y: 2 },
        { a: 0, b: 0, c: 0, d: 0, e: 0, f: 0 },
      ),
    ).toBeNull();
  });
});

describe("shared exact rectangle-collision behavior", () => {
  it("shares the minimum-overlap impulse equally between unpinned nodes", () => {
    const left: RectangleCollisionNode = { x: 0, y: 0, w: 10, h: 20 };
    const right: RectangleCollisionNode = { x: 8, y: 0, w: 10, h: 20 };
    const force = createRectangleCollideForce();
    force.initialize([left, right]);
    force(0.5);
    expect(left.vx).toBe(-1);
    expect(right.vx).toBe(1);
    expect(left.vy).toBeUndefined();
  });

  it("preserves pinned fx/fy and gives the entire push to the unpinned node", () => {
    const pinned: RectangleCollisionNode = {
      x: 0,
      y: 0,
      fx: 0,
      fy: 0,
      w: 10,
      h: 20,
    };
    const free: RectangleCollisionNode = { x: 8, y: 0, w: 10, h: 20 };
    const force = createRectangleCollideForce();
    force.initialize([pinned, free]);
    force(0.5);
    expect(pinned).toEqual({ x: 0, y: 0, fx: 0, fy: 0, w: 10, h: 20 });
    expect(free.vx).toBe(2);
  });

  it("uses the y axis on ties, honors y pins, and leaves non-overlap untouched", () => {
    const pinned: RectangleCollisionNode = {
      x: 0,
      y: 0,
      fx: 0,
      fy: 0,
      w: 10,
      h: 10,
    };
    const free: RectangleCollisionNode = { x: 0, y: 0, w: 10, h: 10 };
    const far: RectangleCollisionNode = { x: 100, y: 100, w: 10, h: 10 };
    const force = createRectangleCollideForce();
    force.initialize([pinned, free, far]);
    force(0.5);
    expect(free.vy).toBe(10);
    expect(free.vx).toBeUndefined();
    expect(pinned.vy).toBeUndefined();
    expect(far.vx).toBeUndefined();
    expect(far.vy).toBeUndefined();
  });
});
