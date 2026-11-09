import { pickAllowedWidth } from "./imageOptimizer";

export const PHOTO_GRAPH_TEXTURE_BUDGET = 48 * 1024 * 1024;
export const PHOTO_GRAPH_MAX_TEXTURE_SIDE = 1280;

// Each visible photograph gets a conservative RGBA share. This bounds unknown
// aspect ratios too, without repeatedly evicting and fetching visible images.
export function photoGraphTextureSideLimit(visibleCount: number) {
  return Math.max(
    1,
    Math.floor(
      Math.min(
        PHOTO_GRAPH_MAX_TEXTURE_SIDE,
        Math.sqrt(PHOTO_GRAPH_TEXTURE_BUDGET / (4 * Math.max(1, visibleCount))),
      ),
    ),
  );
}

// Network widths are discrete tiers, but GPU admission may resize between them.
// Compare against the admitted width, not the requested tier, to avoid both
// missed upgrades after downscaling and endless requests at a budget boundary.
export function photoGraphTextureRequest(
  projectedWidth: number,
  aspectRatio: number,
  sideLimit: number,
  sourceMaxWidth = Infinity,
) {
  const maxWidth = Math.max(
    1,
    Math.floor(Math.min(sideLimit * Math.min(1, aspectRatio), sourceMaxWidth)),
  );
  const width = pickAllowedWidth(Math.min(projectedWidth, maxWidth));
  return { width, residentWidth: Math.min(width, maxWidth) };
}
