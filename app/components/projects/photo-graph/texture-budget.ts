export const PHOTO_GRAPH_TEXTURE_BUDGET = 48 * 1024 * 1024;
export const PHOTO_GRAPH_MAX_TEXTURE_SIDE = 768;

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
