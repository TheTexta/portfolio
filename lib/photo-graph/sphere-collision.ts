export type SphereCollisionNode = {
  x?: number;
  y?: number;
  z?: number;
  vx?: number;
  vy?: number;
  vz?: number;
  fx?: number;
  fy?: number;
  fz?: number;
  w: number;
  h: number;
};

// A conservative bounding sphere works for camera-facing rectangles at every
// orbit angle. It prevents world-space intersections, not all screen occlusion.
export function createSphereCollideForce(
  padding = 0,
  scale = 1,
  strength = 2,
  iterations = 1,
) {
  let nodes: SphereCollisionNode[] = [];
  const radius = (node: SphereCollisionNode) =>
    (Math.hypot(node.w, node.h) * scale) / 2 + padding;
  const force = (alpha: number) => {
    for (let iteration = 0; iteration < iterations; iteration += 1) {
      for (let i = 0; i < nodes.length; i += 1) {
        for (let j = i + 1; j < nodes.length; j += 1) {
          const left = nodes[i];
          const right = nodes[j];
          let dx = (right.x ?? 0) - (left.x ?? 0);
          const dy = (right.y ?? 0) - (left.y ?? 0);
          const dz = (right.z ?? 0) - (left.z ?? 0);
          let distance = Math.hypot(dx, dy, dz);
          if (!distance) {
            dx = distance = 0.001;
          }
          const overlap = radius(left) + radius(right) - distance;
          if (overlap <= 0) continue;
          const push = (overlap * Math.min(1, strength * alpha)) / distance;
          for (const [velocity, fixed, delta] of [
            ["vx", "fx", dx],
            ["vy", "fy", dy],
            ["vz", "fz", dz],
          ] as const) {
            const leftFree = left[fixed] == null;
            const rightFree = right[fixed] == null;
            if (leftFree)
              left[velocity] =
                (left[velocity] ?? 0) - delta * push * (rightFree ? 0.5 : 1);
            if (rightFree)
              right[velocity] =
                (right[velocity] ?? 0) + delta * push * (leftFree ? 0.5 : 1);
          }
        }
      }
    }
  };
  force.initialize = (next: SphereCollisionNode[]) => {
    nodes = next;
  };
  return force;
}
