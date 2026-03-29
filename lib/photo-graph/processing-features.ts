import {
  featureFromRgb,
  hexToRgb,
  rgbToHex,
} from "@/lib/photo-graph/feature-extraction";
import type { GraphNode } from "@/lib/photo-graph/types";

const FALLBACK_MAX_LONG_SIDE = 1000;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function deriveLongSideFromScale(scale: number, maxLongSide: number) {
  const normalized = clamp((scale - 0.5) / 0.5, 0, 1);
  return Math.max(1, Math.round(maxLongSide * normalized));
}

export function ensureProcessingFeatures(nodes: GraphNode[]) {
  const withFeatureLongSides = nodes
    .map((node) => node.feature?.longSide ?? 0)
    .filter((longSide) => Number.isFinite(longSide) && longSide > 0);

  const inferredMaxLongSide =
    withFeatureLongSides.length > 0
      ? Math.max(...withFeatureLongSides)
      : FALLBACK_MAX_LONG_SIDE;

  for (const node of nodes) {
    if (node.feature) {
      continue;
    }

    const rgb = hexToRgb(node.colour) ?? [128, 128, 128];
    const longSide = deriveLongSideFromScale(node.scale, inferredMaxLongSide);
    node.feature = featureFromRgb(rgb, longSide);
    node.colour = rgbToHex(rgb);
  }

  const normalizedLongSides = nodes
    .map((node) => node.feature?.longSide ?? 0)
    .filter((longSide) => Number.isFinite(longSide) && longSide > 0);

  return normalizedLongSides.length
    ? Math.max(...normalizedLongSides)
    : FALLBACK_MAX_LONG_SIDE;
}
