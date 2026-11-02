import gallery from "@/public/projects/photo-graph/write-up/gallery.json";
import provenance from "@/public/projects/photo-graph/write-up/sources.json";

// Reuse authored descriptions only for the images whose identity is recorded in
// the article's source manifest. Unknown/new photographs must not inherit a
// description merely because their node ID resembles an older image.
const descriptions = new Map(
  [
    ...gallery.reviewImages,
    gallery.comparison.query,
    ...gallery.comparison.rows.flatMap((row) => row.images),
  ].map((image) => [image.id, image.alt]),
);
const sources = new Map(
  provenance.sources.map((source) => [source.id, new URL(source.url).pathname]),
);

export function getPhotographDescription(image: {
  id: string;
  sourceUrl?: string;
  originalUrl?: string;
}) {
  const source = image.sourceUrl ?? image.originalUrl;
  if (!source) return null;
  try {
    const url = new URL(source, "https://images.dextery.dev");
    return ["https://images.dextery.dev", "https://media.dextery.dev"].includes(
      url.origin,
    ) && url.pathname === sources.get(image.id)
      ? (descriptions.get(image.id) ?? null)
      : null;
  } catch {
    return null;
  }
}
