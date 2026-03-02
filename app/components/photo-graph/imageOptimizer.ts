import { CANVAS_IMAGE_QUALITY, CANVAS_IMAGE_WIDTHS } from "@/lib/image-optimization";

type OptimizableNode = {
  w: number;
};

export function pickAllowedWidth(targetWidth: number) {
  if (!Number.isFinite(targetWidth) || targetWidth <= 0) {
    return CANVAS_IMAGE_WIDTHS[0];
  }

  for (const width of CANVAS_IMAGE_WIDTHS) {
    if (width >= targetWidth) {
      return width;
    }
  }

  return CANVAS_IMAGE_WIDTHS[CANVAS_IMAGE_WIDTHS.length - 1];
}

export function getNodeScreenWidth(node: OptimizableNode, zoom: number) {
  return node.w * zoom;
}

export function computeTargetImageWidth(node: OptimizableNode, zoom: number, dpr: number) {
  const desiredWidth = Math.ceil(getNodeScreenWidth(node, zoom) * dpr * 1.2);
  return pickAllowedWidth(desiredWidth);
}

export function shouldUpgradeWidth(currentWidth: number | undefined, nextWidth: number) {
  if (!currentWidth) return true;
  return nextWidth > currentWidth;
}

export function buildOptimizedImageUrl(sourceUrl: string, width: number, quality = CANVAS_IMAGE_QUALITY) {
  return `/_next/image?url=${encodeURIComponent(sourceUrl)}&w=${width}&q=${quality}`;
}
