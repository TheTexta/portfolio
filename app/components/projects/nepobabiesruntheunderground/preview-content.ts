import path from "node:path";
import { readFile } from "node:fs/promises";

import {
  NEPOBABIES_PREVIEW_BASE_PATH,
  nepobabiesAssetUrl,
  normalizeNepobabiesAssetPath,
  resolveNepobabiesAssetPathFromUrl,
  resolveRelativeNepobabiesAssetPath,
} from "@/lib/nepobabies/assets";

const PROJECT_ROOT = path.join(
  process.cwd(),
  "app/components/projects/nepobabiesruntheunderground",
);
const PREVIEW_BASE_PATH = NEPOBABIES_PREVIEW_BASE_PATH;
const NO_STORE_CACHE_CONTROL = "no-store";
const STATIC_CACHE_CONTROL =
  "public, max-age=2592000, s-maxage=2592000, stale-while-revalidate=604800";
const DEFAULT_IMAGE_QUALITY = 72;
const DEFAULT_IMAGE_WIDTH = 1080;

type ImageOptimizationRule = {
  test: (assetPath: string) => boolean;
  width: number;
  quality: number;
};

const IMAGE_OPTIMIZATION_RULES: ImageOptimizationRule[] = [
  {
    test: (assetPath) =>
      assetPath === "assets/images/background.jpg" ||
      assetPath === "assets/images/layer-5.jpg",
    width: 2048,
    quality: DEFAULT_IMAGE_QUALITY,
  },
  {
    test: (assetPath) => assetPath === "assets/images/overlay.jpg",
    width: 1200,
    quality: DEFAULT_IMAGE_QUALITY,
  },
  {
    test: (assetPath) => assetPath.startsWith("assets/images/blog/"),
    width: 1200,
    quality: DEFAULT_IMAGE_QUALITY,
  },
];

const GIF_VIDEO_REPLACEMENTS: Record<string, string> = {
  "assets/images/me_background.gif": "me-background",
  "assets/images/me_foreground.gif": "me-foreground",
  "assets/images/me_hover.gif": "me-hover",
  "assets/images/nettspend.gif": "nettspend",
};

const CONTENT_TYPES: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".frag": "text/plain; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".mp4": "video/mp4",
  ".json": "application/json; charset=utf-8",
  ".manifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".vert": "text/plain; charset=utf-8",
  ".webm": "video/webm",
  ".webmanifest": "application/manifest+json; charset=utf-8",
};

function resolveProjectFile(segments: string[]) {
  const normalizedSegments = segments.length === 0 ? ["index.html"] : segments;

  if (
    normalizedSegments.some(
      (segment) =>
        segment.length === 0 || segment === "." || segment === "..",
    )
  ) {
    return null;
  }

  const filePath = path.join(PROJECT_ROOT, ...normalizedSegments);
  const relativePath = path.relative(PROJECT_ROOT, filePath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return null;
  }

  return filePath;
}

function resolveLegacyAssetRedirect(segments: string[]) {
  if (segments.length === 0 || segments[0] !== "assets") {
    return null;
  }

  if (
    segments.some(
      (segment) =>
        segment.length === 0 || segment === "." || segment === "..",
    )
  ) {
    return null;
  }

  const normalizedAssetPath = normalizeNepobabiesAssetPath(segments.join("/"));
  if (!normalizedAssetPath) {
    return null;
  }

  return nepobabiesAssetUrl(normalizedAssetPath);
}

function resolvePreviewAssetPath(rawUrl: string, baseAssetPath?: string) {
  const directAssetPath = resolveNepobabiesAssetPathFromUrl(rawUrl);
  if (directAssetPath) {
    return directAssetPath;
  }

  if (baseAssetPath) {
    const relativeAssetPath = resolveRelativeNepobabiesAssetPath(
      baseAssetPath,
      rawUrl,
    );
    if (relativeAssetPath) {
      return relativeAssetPath;
    }
  }

  return null;
}

function buildPreviewAssetUrl(assetPath: string) {
  return nepobabiesAssetUrl(assetPath);
}

function getImageOptimizationOptions(assetPath: string) {
  for (const rule of IMAGE_OPTIMIZATION_RULES) {
    if (rule.test(assetPath)) {
      return {
        width: rule.width,
        quality: rule.quality,
      };
    }
  }

  return {
    width: DEFAULT_IMAGE_WIDTH,
    quality: DEFAULT_IMAGE_QUALITY,
  };
}

function buildOptimizedImageUrl(assetPath: string) {
  const { width, quality } = getImageOptimizationOptions(assetPath);
  const sourceUrl = buildPreviewAssetUrl(assetPath);

  return `/_next/image?url=${encodeURIComponent(sourceUrl)}&w=${width}&q=${quality}`;
}

function isOptimizableImageExtension(extension: string) {
  return extension === ".jpg" || extension === ".jpeg" || extension === ".png";
}

function rewriteImageTag(imgTag: string) {
  const srcAttributeMatch = imgTag.match(/\bsrc\s*=\s*(["'])([^"']*)\1/i);
  if (!srcAttributeMatch) {
    return imgTag;
  }

  const sourceValue = srcAttributeMatch[2];
  const assetPath = resolvePreviewAssetPath(sourceValue);
  if (!assetPath) {
    return imgTag;
  }

  const extension = path.posix.extname(assetPath).toLowerCase();
  const normalizedAssetPath = assetPath.toLowerCase();
  const videoStem = GIF_VIDEO_REPLACEMENTS[normalizedAssetPath];

  if (extension === ".gif" && videoStem) {
    const attributesWithoutSrc = imgTag
      .replace(/^<img\b/i, "")
      .replace(/\/?>$/i, "")
      .replace(/\bsrc\s*=\s*(["']).*?\1/i, "")
      .trim();
    const videoAttributes = attributesWithoutSrc
      ? ` ${attributesWithoutSrc}`
      : "";

    const mediaRoot = `assets/media/optimized/${videoStem}`;
    const posterUrl = buildPreviewAssetUrl(`${mediaRoot}-poster.jpg`);
    const webmUrl = buildPreviewAssetUrl(`${mediaRoot}.webm`);
    const mp4Url = buildPreviewAssetUrl(`${mediaRoot}.mp4`);

    return `<video autoplay loop muted playsinline preload="metadata" poster="${posterUrl}"${videoAttributes}><source src="${webmUrl}" type="video/webm" /><source src="${mp4Url}" type="video/mp4" /></video>`;
  }

  if (!isOptimizableImageExtension(extension)) {
    return imgTag;
  }

  const optimizedUrl = buildOptimizedImageUrl(assetPath);

  return imgTag.replace(
    /\bsrc\s*=\s*(["'])([^"']*)\1/i,
    (_match, quote: string) => `src=${quote}${optimizedUrl}${quote}`,
  );
}

function rewriteHtmlImageTags(source: string) {
  return source.replace(/<img\b[^>]*>/gi, (imgTag) => rewriteImageTag(imgTag));
}

function rewriteHtmlDocument(source: string) {
  const withBaseTag = source.includes("<base ")
    ? source
    : source.replace(
        /<head([^>]*)>/i,
        `<head$1>\n  <base href="${PREVIEW_BASE_PATH}" />`,
      );

  const withRelativeAssetLinks = withBaseTag.replace(
    /(href|src)=(["'])\/assets\//g,
    "$1=$2assets/",
  );

  return rewriteHtmlImageTags(withRelativeAssetLinks);
}

function rewriteCssDocument(source: string) {
  return source.replace(
    /url\(\s*(["']?)([^"')]+)\1\s*\)/gi,
    (match, _quote: string, rawUrl: string) => {
      const assetPath = resolvePreviewAssetPath(rawUrl, "assets/css/styles.css");
      if (!assetPath) {
        return match;
      }

      const extension = path.posix.extname(assetPath).toLowerCase();
      if (!isOptimizableImageExtension(extension)) {
        return match;
      }

      return `url("${buildOptimizedImageUrl(assetPath)}")`;
    },
  );
}

function rewriteJournalJson(source: string) {
  try {
    const parsed = JSON.parse(source) as unknown;
    if (!Array.isArray(parsed)) {
      return source;
    }

    const rewrittenEntries = parsed.map((entry) => {
      if (!entry || typeof entry !== "object") {
        return entry;
      }

      const record = entry as Record<string, unknown>;
      const content = record.content;

      if (typeof content !== "string") {
        return record;
      }

      return {
        ...record,
        content: rewriteHtmlImageTags(content),
      };
    });

    return `${JSON.stringify(rewrittenEntries, null, 2)}\n`;
  } catch {
    return source;
  }
}

function contentTypeForExtension(extension: string) {
  return CONTENT_TYPES[extension] ?? "application/octet-stream";
}

function cacheControlForExtension(extension: string) {
  if (extension === ".html" || extension === ".json") {
    return NO_STORE_CACHE_CONTROL;
  }

  return STATIC_CACHE_CONTROL;
}

function responseHeadersForExtension(extension: string) {
  return {
    "content-type": contentTypeForExtension(extension),
    "cache-control": cacheControlForExtension(extension),
  };
}

export async function servePreviewFile(segments: string[]) {
  const legacyAssetRedirect = resolveLegacyAssetRedirect(segments);
  if (legacyAssetRedirect) {
    return Response.redirect(legacyAssetRedirect, 308);
  }

  const filePath = resolveProjectFile(segments);

  if (!filePath) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const fileBuffer = await readFile(filePath);
    const extension = path.extname(filePath).toLowerCase();

    if (extension === ".html") {
      const rewrittenHtml = rewriteHtmlDocument(fileBuffer.toString("utf-8"));

      return new Response(rewrittenHtml, {
        headers: responseHeadersForExtension(extension),
      });
    }

    if (extension === ".css") {
      const rewrittenCss = rewriteCssDocument(fileBuffer.toString("utf-8"));

      return new Response(rewrittenCss, {
        headers: responseHeadersForExtension(extension),
      });
    }

    if (
      extension === ".json" &&
      path.basename(filePath).toLowerCase() === "journal.json"
    ) {
      const rewrittenJournal = rewriteJournalJson(fileBuffer.toString("utf-8"));

      return new Response(rewrittenJournal, {
        headers: responseHeadersForExtension(extension),
      });
    }

    return new Response(fileBuffer, {
      headers: responseHeadersForExtension(extension),
    });
  } catch (error) {
    const errorWithCode = error as NodeJS.ErrnoException;

    if (errorWithCode.code === "ENOENT") {
      return new Response("Not found", { status: 404 });
    }

    throw error;
  }
}
