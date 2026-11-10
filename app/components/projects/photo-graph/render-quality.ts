// Match native screen density for ordinary Retina/mobile viewports without
// allocating unbounded antialiased framebuffers on very large displays.
export const PHOTO_GRAPH_RENDER_PIXEL_BUDGET = 16_000_000;

export function photoGraphRenderPixelRatio(
  width: number,
  height: number,
  devicePixelRatio: number,
) {
  return Math.min(
    devicePixelRatio || 1,
    Math.sqrt(PHOTO_GRAPH_RENDER_PIXEL_BUDGET / Math.max(1, width * height)),
  );
}
