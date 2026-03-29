import {
  CANVAS_IMAGE_QUALITY,
  PHOTO_GRAPH_IMAGE_WIDTHS,
} from "@/lib/image-optimization";
import { buildSupabaseStorageRenderUrl } from "@/lib/supabase/config";

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
) {
  if (!storagePath) {
    return sourceUrl ?? null;
  }

  try {
    return buildSupabaseStorageRenderUrl(storagePath, {
      width,
      quality,
    });
  } catch {
    return sourceUrl ?? null;
  }
}

export function buildOptimizedImageCandidates(
  storagePath: string | undefined,
  sourceUrl: string | undefined,
  width: number,
  quality = CANVAS_IMAGE_QUALITY,
) {
  const optimizedUrl = buildOptimizedImageUrl(
    storagePath,
    sourceUrl,
    width,
    quality,
  );
  const candidates = [optimizedUrl, sourceUrl].filter(
    (value, index, values): value is string =>
      typeof value === "string" &&
      value.length > 0 &&
      values.indexOf(value) === index,
  );

  return candidates;
}
