import {
  CANVAS_IMAGE_QUALITY,
  PHOTO_GRAPH_IMAGE_WIDTHS,
} from "@/lib/image-optimization";
import { photoGraphMediaUrl } from "@/lib/photo-graph/media-url";

type OptimizableNode = {
  w: number;
};

export function pickAllowedWidth(targetWidth: number) {
  if (!Number.isFinite(targetWidth) || targetWidth <= 0) {
    return PHOTO_GRAPH_IMAGE_WIDTHS[0];
  }

  for (const width of PHOTO_GRAPH_IMAGE_WIDTHS) {
    if (width >= targetWidth) {
      return width;
    }
  }

  return PHOTO_GRAPH_IMAGE_WIDTHS[PHOTO_GRAPH_IMAGE_WIDTHS.length - 1];
}

export function getNodeScreenWidth(node: OptimizableNode, zoom: number) {
  return node.w * zoom;
}

export function computeTargetImageWidth(
  node: OptimizableNode,
  zoom: number,
  dpr: number,
) {
  const desiredWidth = Math.ceil(getNodeScreenWidth(node, zoom) * dpr);
  return pickAllowedWidth(desiredWidth);
}

export function shouldUpgradeWidth(
  currentWidth: number | undefined,
  nextWidth: number,
) {
  if (!currentWidth) return true;
  return nextWidth > currentWidth;
}

export function buildOptimizedImageUrl(
  storagePath: string | undefined,
  sourceUrl: string | undefined,
  width: number,
  quality = CANVAS_IMAGE_QUALITY,
  storageProvider?: "r2",
) {
  if (!storagePath) {
    return sourceUrl ?? null;
  }

  if (storageProvider === "r2") {
    try {
      return (
        photoGraphMediaUrl(
          { storageProvider, storagePath },
          { width, quality },
        ) ?? null
      );
    } catch {
      return null;
    }
  }

  try {
    return (
      photoGraphMediaUrl({ storagePath }, { width, quality }) ??
      sourceUrl ??
      null
    );
  } catch {
    return sourceUrl ?? null;
  }
}

export function buildOptimizedImageCandidates(
  storagePath: string | undefined,
  sourceUrl: string | undefined,
  width: number,
  quality = CANVAS_IMAGE_QUALITY,
  storageProvider?: "r2",
) {
  if (storageProvider === "r2") {
    // Do not fall back to an unverified URL after an invalid/private R2 path.
    try {
      const reference = { storagePath, storageProvider } as const;
      const optimized = photoGraphMediaUrl(reference, { width, quality });
      const original = photoGraphMediaUrl(reference);
      return [optimized, original].filter(
        (value, index, values): value is string =>
          typeof value === "string" &&
          value.length > 0 &&
          values.indexOf(value) === index,
      );
    } catch {
      return [];
    }
  }

  const optimizedUrl = buildOptimizedImageUrl(
    storagePath,
    sourceUrl,
    width,
    quality,
    storageProvider,
  );
  const candidates = [optimizedUrl, sourceUrl].filter(
    (value, index, values): value is string =>
      typeof value === "string" &&
      value.length > 0 &&
      values.indexOf(value) === index,
  );

  return candidates;
}
