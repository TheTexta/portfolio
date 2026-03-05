import path from "node:path";

export const NEPOBABIES_PREVIEW_BASE_PATH =
  "/components/projects/nepobabiesruntheunderground/preview/";
export const NEPOBABIES_ASSET_ROOT = "assets";
export const NEPOBABIES_STORAGE_PREFIX = "nepobabies/assets";
export const DEFAULT_NEPOBABIES_STORAGE_BUCKET =
  "portfolio-site-firebase-41fab.firebasestorage.app";
export const DEFAULT_NEPOBABIES_ASSET_VERSION = "v20260305-1";

export type NepobabiesAssetManifest = {
  version: string;
  bucket: string;
  baseObjectPrefix: string;
  generatedAt: string;
  byPath: Record<
    string,
    {
      objectPath: string;
      publicUrl: string;
      bytes: number;
      sha256: string;
      contentType: string;
    }
  >;
};

type AssetUrlOptions = {
  version?: string;
  bucket?: string;
};

function stripQueryAndHash(rawUrl: string) {
  const match = rawUrl.match(/^([^?#]*)([?#].*)?$/);

  return {
    pathname: match?.[1] ?? rawUrl,
    suffix: match?.[2] ?? "",
  };
}

function hasProtocolOrExternalPrefix(rawUrl: string) {
  return (
    /^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(rawUrl) ||
    /^(data|blob|mailto|tel):/i.test(rawUrl)
  );
}

function decodeSafely(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function extractAssetPathFromObjectPath(objectPath: string) {
  const normalizedObjectPath = path.posix.normalize(objectPath).replace(/^\/+/, "");

  if (!normalizedObjectPath.startsWith(`${NEPOBABIES_STORAGE_PREFIX}/`)) {
    return null;
  }

  const withoutPrefix = normalizedObjectPath.slice(NEPOBABIES_STORAGE_PREFIX.length + 1);
  const firstSlash = withoutPrefix.indexOf("/");

  if (firstSlash < 0) {
    return null;
  }

  const candidateAssetPath = withoutPrefix.slice(firstSlash + 1);

  return normalizeNepobabiesAssetPath(candidateAssetPath);
}

function decodeFirebaseObjectPath(url: URL) {
  if (url.hostname === "firebasestorage.googleapis.com") {
    const match = url.pathname.match(/^\/v0\/b\/([^/]+)\/o\/(.+)$/);

    if (match) {
      return decodeSafely(match[2]);
    }

    const nameParam = url.searchParams.get("name");
    if (nameParam) {
      return decodeSafely(nameParam);
    }

    return null;
  }

  if (url.hostname === "storage.googleapis.com") {
    const segments = url.pathname.split("/").filter(Boolean);
    if (segments.length < 2) {
      return null;
    }

    return decodeSafely(segments.slice(1).join("/"));
  }

  if (url.hostname.endsWith(".storage.googleapis.com")) {
    const objectPath = url.pathname.replace(/^\/+/, "");
    if (!objectPath) {
      return null;
    }

    return decodeSafely(objectPath);
  }

  return null;
}

export function normalizeNepobabiesAssetPath(rawAssetPath: string) {
  const decoded = decodeSafely(rawAssetPath).replace(/\\/g, "/");
  const withoutLeadingSlash = decoded.replace(/^\/+/, "");
  const normalized = path.posix.normalize(withoutLeadingSlash);

  if (!normalized || normalized === ".") {
    return null;
  }

  if (
    normalized.startsWith("../") ||
    normalized === ".." ||
    path.posix.isAbsolute(normalized)
  ) {
    return null;
  }

  if (!normalized.startsWith(`${NEPOBABIES_ASSET_ROOT}/`)) {
    return null;
  }

  return normalized;
}

export function getNepobabiesStorageBucket() {
  return (
    process.env.NEPOBABIES_STORAGE_BUCKET ??
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ??
    process.env.FIREBASE_STORAGE_BUCKET ??
    DEFAULT_NEPOBABIES_STORAGE_BUCKET
  );
}

export function getNepobabiesAssetVersion() {
  return process.env.NEPOBABIES_ASSET_VERSION ?? DEFAULT_NEPOBABIES_ASSET_VERSION;
}

export function nepobabiesObjectPrefix(version = getNepobabiesAssetVersion()) {
  return `${NEPOBABIES_STORAGE_PREFIX}/${version}`;
}

export function nepobabiesObjectPathForAsset(
  rawAssetPath: string,
  version = getNepobabiesAssetVersion(),
) {
  const assetPath = normalizeNepobabiesAssetPath(rawAssetPath);

  if (!assetPath) {
    throw new Error(`Invalid Nepobabies asset path: ${rawAssetPath}`);
  }

  return `${nepobabiesObjectPrefix(version)}/${assetPath}`;
}

export function nepobabiesPublicUrlForObjectPath(
  objectPath: string,
  bucket = getNepobabiesStorageBucket(),
) {
  return `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(objectPath)}?alt=media`;
}

export function nepobabiesAssetUrl(rawAssetPath: string, options: AssetUrlOptions = {}) {
  const objectPath = nepobabiesObjectPathForAsset(
    rawAssetPath,
    options.version ?? getNepobabiesAssetVersion(),
  );

  return nepobabiesPublicUrlForObjectPath(
    objectPath,
    options.bucket ?? getNepobabiesStorageBucket(),
  );
}

export function resolveNepobabiesAssetPathFromFirebaseUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    const objectPath = decodeFirebaseObjectPath(url);

    if (!objectPath) {
      return null;
    }

    return extractAssetPathFromObjectPath(objectPath);
  } catch {
    return null;
  }
}

export function resolveNepobabiesAssetPathFromUrl(rawUrl: string) {
  const firebasePath = resolveNepobabiesAssetPathFromFirebaseUrl(rawUrl);

  if (firebasePath) {
    return firebasePath;
  }

  if (hasProtocolOrExternalPrefix(rawUrl)) {
    return null;
  }

  const { pathname } = stripQueryAndHash(rawUrl);

  if (!pathname) {
    return null;
  }

  if (pathname.startsWith(NEPOBABIES_PREVIEW_BASE_PATH)) {
    return normalizeNepobabiesAssetPath(pathname.slice(NEPOBABIES_PREVIEW_BASE_PATH.length));
  }

  if (pathname.startsWith("/assets/")) {
    return normalizeNepobabiesAssetPath(pathname.slice(1));
  }

  if (pathname.startsWith("./assets/")) {
    return normalizeNepobabiesAssetPath(pathname.slice(2));
  }

  if (pathname.startsWith("assets/")) {
    return normalizeNepobabiesAssetPath(pathname);
  }

  return null;
}

export function resolveRelativeNepobabiesAssetPath(
  baseAssetPath: string,
  rawUrl: string,
) {
  const directPath = resolveNepobabiesAssetPathFromUrl(rawUrl);
  if (directPath) {
    return directPath;
  }

  if (hasProtocolOrExternalPrefix(rawUrl)) {
    return null;
  }

  const { pathname } = stripQueryAndHash(rawUrl);
  if (!pathname || pathname.startsWith("/")) {
    return null;
  }

  const baseDir = path.posix.dirname(baseAssetPath);
  const candidate = path.posix.normalize(path.posix.join(baseDir, pathname));

  return normalizeNepobabiesAssetPath(candidate);
}
