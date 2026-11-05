import { sizePhotoGraphNode } from "@/lib/photo-graph/force-graph";
import type { ExamplePhoto, ExamplePosition } from "./example-types";

// 15% of the live graph's typical 220px box and distance/charge scale.
export const MINIATURE_SCALE = 0.15;

export type ExampleViewport = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/** Invert SVG's screen CTM, including viewBox letterboxing and CSS transforms. */
export function exampleScreenPoint(
  point: { x: number; y: number },
  matrix: { a: number; b: number; c: number; d: number; e: number; f: number },
) {
  const determinant = matrix.a * matrix.d - matrix.b * matrix.c;
  if (!Number.isFinite(determinant) || determinant === 0) return null;
  const x = point.x - matrix.e;
  const y = point.y - matrix.f;
  return {
    x: (matrix.d * x - matrix.c * y) / determinant,
    y: (matrix.a * y - matrix.b * x) / determinant,
  };
}

export function exampleNodeBox(photo: ExamplePhoto) {
  return sizePhotoGraphNode({
    aspectRatio: photo.width / photo.height,
    baseSize: 220 * MINIATURE_SCALE,
    w: 0,
    h: 0,
    renderArea: 0,
  });
}

export function exampleViewport(
  nodes: ExamplePhoto[],
  positions: ExamplePosition[],
) {
  const byId = new Map(positions.map((position) => [position.id, position]));
  let left = Infinity;
  let right = -Infinity;
  let top = Infinity;
  let bottom = -Infinity;
  for (const node of nodes) {
    const point = byId.get(node.id);
    if (!point) continue;
    const { w, h } = exampleNodeBox(node);
    left = Math.min(left, point.x - w / 2);
    right = Math.max(right, point.x + w / 2);
    top = Math.min(top, point.y - h / 2);
    bottom = Math.max(bottom, point.y + h / 2);
  }
  if (!Number.isFinite(left))
    return { x: -336, y: -240, width: 672, height: 480 };
  const width = Math.max(320, right - left + 100);
  const height = Math.max(width * 0.72, bottom - top + 100);
  return {
    x: (left + right - width) / 2,
    y: (top + bottom - height) / 2,
    width,
    height,
  };
}
