/** Geometry-only nodes: the force never reads colour features or graph topology. */
export type RectangleCollisionNode = {
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
  w: number;
  h: number;
};

export type RectangleCollisionForce<T extends RectangleCollisionNode> = {
  (alpha: number): void;
  initialize: (nodes: T[] | ArrayLike<T>) => void;
};

/** The live Photo Graph's axis-aligned rectangle collision rule. */
export function createRectangleCollideForce<T extends RectangleCollisionNode>(
  padding = 0,
  boxScale = 1,
  strength = 2,
  iterations = 1,
): RectangleCollisionForce<T> {
  let nodes: T[] = [];

  const force: RectangleCollisionForce<T> = (alpha) => {
    if (!nodes.length) return;

    for (let iteration = 0; iteration < iterations; iteration += 1) {
      for (let leftIndex = 0; leftIndex < nodes.length; leftIndex += 1) {
        const left = nodes[leftIndex];
        const leftX = left.x ?? 0;
        const leftY = left.y ?? 0;
        const leftHalfWidth = (left.w * boxScale) / 2 + padding;
        const leftHalfHeight = (left.h * boxScale) / 2 + padding;

        for (
          let rightIndex = leftIndex + 1;
          rightIndex < nodes.length;
          rightIndex += 1
        ) {
          const right = nodes[rightIndex];
          const rightX = right.x ?? 0;
          const rightY = right.y ?? 0;
          const rightHalfWidth = (right.w * boxScale) / 2 + padding;
          const rightHalfHeight = (right.h * boxScale) / 2 + padding;
          const deltaX = rightX - leftX;
          const deltaY = rightY - leftY;
          const overlapX = leftHalfWidth + rightHalfWidth - Math.abs(deltaX);
          if (overlapX <= 0) continue;
          const overlapY = leftHalfHeight + rightHalfHeight - Math.abs(deltaY);
          if (overlapY <= 0) continue;

          const pushFactor = strength * alpha;
          if (overlapX < overlapY) {
            const directionX = deltaX === 0 ? 1 : Math.sign(deltaX);
            const pushX = overlapX * pushFactor * directionX;
            if (left.fx == null && right.fx == null) {
              left.vx = (left.vx ?? 0) - pushX * 0.5;
              right.vx = (right.vx ?? 0) + pushX * 0.5;
            } else if (left.fx == null) {
              left.vx = (left.vx ?? 0) - pushX;
            } else if (right.fx == null) {
              right.vx = (right.vx ?? 0) + pushX;
            }
            continue;
          }

          const directionY = deltaY === 0 ? 1 : Math.sign(deltaY);
          const pushY = overlapY * pushFactor * directionY;
          if (left.fy == null && right.fy == null) {
            left.vy = (left.vy ?? 0) - pushY * 0.5;
            right.vy = (right.vy ?? 0) + pushY * 0.5;
          } else if (left.fy == null) {
            left.vy = (left.vy ?? 0) - pushY;
          } else if (right.fy == null) {
            right.vy = (right.vy ?? 0) + pushY;
          }
        }
      }
    }
  };
  force.initialize = (nextNodes) => {
    nodes = Array.from(nextNodes);
  };
  return force;
}
