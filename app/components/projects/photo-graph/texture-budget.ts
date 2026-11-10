import { pickAllowedWidth } from "./imageOptimizer";
import { PHOTO_GRAPH_IMAGE_WIDTHS } from "@/lib/image-optimization";

export const PHOTO_GRAPH_TEXTURE_BUDGET = 48 * 1024 * 1024;
export const PHOTO_GRAPH_MAX_TEXTURE_SIDE = 3840;
export const PHOTO_GRAPH_3D_IMAGE_WIDTHS = [
  ...PHOTO_GRAPH_IMAGE_WIDTHS,
  1536,
  1920,
  2560,
  3200,
  3840,
];

type TextureDemand = {
  id: string;
  projectedWidth: number;
  aspectRatio: number;
  sourceMaxWidth?: number;
};

type TextureAllocation = {
  width: number;
  residentWidth: number;
  residentHeight: number;
};

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
  const width = pickAllowedWidth(
    Math.min(projectedWidth, maxWidth),
    PHOTO_GRAPH_3D_IMAGE_WIDTHS,
  );
  return { width, residentWidth: Math.min(width, maxWidth) };
}

export function photoGraphTextureNeedsUpgrade(
  loadedWidth: number | undefined,
  residentWidth: number,
  aspectRatio: number,
) {
  // Provider height rounding and budget fitting each lose at most a row.
  // Compare actual uploaded pixels, allowing those rows' width equivalent so
  // an unchanged tier cannot refetch forever (especially for wide photographs).
  return (
    !loadedWidth || loadedWidth + Math.ceil(2 * aspectRatio) + 1 < residentWidth
  );
}

// Allocate to actual screen demand, not an equal square share per visible node.
// Distant thumbnails must not hold a viewport-filling photograph at thumbnail
// resolution. Only reduce the shared quality scale when total demand exceeds
// the budget; rounded network tiers do not change the admitted GPU dimensions.
export function allocatePhotoGraphTextures(
  demands: TextureDemand[],
  sideLimit = PHOTO_GRAPH_MAX_TEXTURE_SIDE,
): Map<string, TextureAllocation> {
  const requests = demands.map((demand) => {
    const request = photoGraphTextureRequest(
      demand.projectedWidth,
      demand.aspectRatio,
      sideLimit,
      demand.sourceMaxWidth,
    );
    return {
      id: demand.id,
      ...request,
      residentHeight: Math.max(
        1,
        Math.floor(request.residentWidth / demand.aspectRatio),
      ),
    };
  });
  const bytes = requests.reduce(
    (sum, request) => sum + request.residentWidth * request.residentHeight * 4,
    0,
  );
  const scale = Math.min(1, Math.sqrt(PHOTO_GRAPH_TEXTURE_BUDGET / bytes));
  return new Map(
    requests.map((request) => {
      const residentWidth = Math.max(
        1,
        Math.floor(request.residentWidth * scale),
      );
      return [
        request.id,
        {
          width: pickAllowedWidth(residentWidth, PHOTO_GRAPH_3D_IMAGE_WIDTHS),
          residentWidth,
          residentHeight: Math.max(
            1,
            Math.floor(request.residentHeight * scale),
          ),
        },
      ];
    }),
  );
}
