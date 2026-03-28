import { clamp01 } from "@/lib/photo-graph/feature-extraction";

export function scaleFromLongSide(longSidePx: number, maxLongSidePx: number) {
  const ratio = maxLongSidePx <= 0 ? 1 : clamp01(longSidePx / maxLongSidePx);
  return 0.5 + 0.5 * ratio;
}
