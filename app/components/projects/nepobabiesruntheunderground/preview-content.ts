import path from "node:path";
import { readFile } from "node:fs/promises";

const PROJECT_ROOT = path.join(
  process.cwd(),
  "app/components/projects/nepobabiesruntheunderground",
);
const PREVIEW_BASE_PATH =
  "/components/projects/nepobabiesruntheunderground/preview/";

const CONTENT_TYPES: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".frag": "text/plain; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".manifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".vert": "text/plain; charset=utf-8",
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

function rewriteHtmlDocument(source: string) {
  const withBaseTag = source.includes("<base ")
    ? source
    : source.replace(
        /<head([^>]*)>/i,
        `<head$1>\n  <base href="${PREVIEW_BASE_PATH}" />`,
      );

  return withBaseTag.replace(
    /(href|src)=(["'])\/assets\//g,
    "$1=$2assets/",
  );
}

function contentTypeForExtension(extension: string) {
  return CONTENT_TYPES[extension] ?? "application/octet-stream";
}

export async function servePreviewFile(segments: string[]) {
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
        headers: {
          "content-type": contentTypeForExtension(extension),
        },
      });
    }

    return new Response(fileBuffer, {
      headers: {
        "content-type": contentTypeForExtension(extension),
      },
    });
  } catch (error) {
    const errorWithCode = error as NodeJS.ErrnoException;

    if (errorWithCode.code === "ENOENT") {
      return new Response("Not found", { status: 404 });
    }

    throw error;
  }
}
