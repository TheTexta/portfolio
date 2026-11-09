import { describe, expect, it } from "vitest";
import {
  createSphereCollideForce,
  type SphereCollisionNode,
} from "@/lib/photo-graph/sphere-collision";

function node(
  overrides: Partial<SphereCollisionNode> = {},
): SphereCollisionNode {
  return { x: 0, y: 0, z: 0, w: 100, h: 100, ...overrides };
}

describe("3D photograph collision", () => {
  it("separates overlapping photographs along depth, not just XY", () => {
    const nodes = [node(), node({ z: 100 })];
    const force = createSphereCollideForce();
    force.initialize(nodes);
    force(0.5);
    expect(nodes[0].vz).toBeLessThan(0);
    expect(nodes[1].vz).toBeGreaterThan(0);
    expect(nodes[0].vx).toBe(0);
  });

  it("leaves world-space-separated photos alone even when their projections overlap", () => {
    const nodes = [node(), node({ z: 400 })];
    const force = createSphereCollideForce();
    force.initialize(nodes);
    force(1);
    expect(nodes.every((item) => item.vz === undefined)).toBe(true);
  });

  it("respects independently pinned axes during dragging", () => {
    const nodes = [
      node({ fx: 0, fy: 0, fz: 0 }),
      node({ x: 10, y: 10, z: 10 }),
    ];
    const force = createSphereCollideForce();
    force.initialize(nodes);
    force(1);
    expect(nodes[0].vx).toBeUndefined();
    expect(nodes[0].vy).toBeUndefined();
    expect(nodes[0].vz).toBeUndefined();
    expect(nodes[1].vx).toBeGreaterThan(0);
    expect(nodes[1].vy).toBeGreaterThan(0);
    expect(nodes[1].vz).toBeGreaterThan(0);
  });

  it("handles coincident centres, disabled collision, and empty graphs", () => {
    const force = createSphereCollideForce();
    force(1);
    const nodes = [node(), node()];
    force.initialize(nodes);
    force(1);
    expect(Number.isFinite(nodes[0].vx)).toBe(true);
    expect(nodes[0].vx).toBeLessThan(0);
    const disabled = createSphereCollideForce(0, 1, 0);
    const fresh = [node(), node()];
    disabled.initialize(fresh);
    disabled(1);
    expect(fresh[0].vx).toBe(0);
  });
});
