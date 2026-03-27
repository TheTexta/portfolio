const DEFAULT_IMAGE_BASE_PATH = "photography-images";
const DEFAULT_PHOTO_GRAPH_EXTENSION = "png";
export const PHOTO_GRAPH_CACHE_CONTROL_SECONDS = "31536000";
export const PHOTO_GRAPH_CACHE_CONTROL_HEADER = `max-age=${PHOTO_GRAPH_CACHE_CONTROL_SECONDS}`;

export function photoGraphImageBasePath() {
  return process.env.PHOTO_GRAPH_IMAGE_BASE_PATH ?? DEFAULT_IMAGE_BASE_PATH;
}

export function normalizePhotoGraphStoragePath(path: string) {
  return path.replace(/^\/+/, "");
}

export function normalizePhotoGraphExtension(extension: string | undefined) {
  const normalized = String(extension ?? "")
    .replace(/^\.+/, "")
    .trim()
    .toLowerCase();

  if (!normalized) {
    return DEFAULT_PHOTO_GRAPH_EXTENSION;
  }

  if (normalized === "jpeg") {
    return "jpg";
  }

  if (normalized === "png" || normalized === "jpg" || normalized === "webp") {
    return normalized;
  }

  return DEFAULT_PHOTO_GRAPH_EXTENSION;
}

export function extensionForPhotoGraphStoragePath(path: string | undefined) {
  if (!path) {
    return DEFAULT_PHOTO_GRAPH_EXTENSION;
  }

  const normalizedPath = normalizePhotoGraphStoragePath(path);
  const lastDotIndex = normalizedPath.lastIndexOf(".");

  if (lastDotIndex === -1) {
    return DEFAULT_PHOTO_GRAPH_EXTENSION;
  }

  return normalizePhotoGraphExtension(normalizedPath.slice(lastDotIndex + 1));
}

export function buildCanonicalPhotoGraphStoragePath(
  nodeId: string,
  currentPath?: string,
) {
  const imageBasePath = photoGraphImageBasePath().replace(/\/$/, "");
  const extension = extensionForPhotoGraphStoragePath(currentPath);
  return `${imageBasePath}/${nodeId}.${extension}`;
}

export function buildPendingPhotoGraphStoragePath(
  token: string,
  extension: string,
) {
  const imageBasePath = photoGraphImageBasePath().replace(/\/$/, "");
  return `${imageBasePath}/_pending/${token}.${normalizePhotoGraphExtension(extension)}`;
}

export function imagePathForLegacyId(id: string) {
  return `${photoGraphImageBasePath().replace(/\/$/, "")}/${id}.png`;
}
