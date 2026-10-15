import { assertPhotoGraphR2ImageBasePath } from "@/lib/photo-graph/config";
import {
  buildSupabaseStoragePublicUrl,
  buildSupabaseStorageRenderUrl,
} from "@/lib/supabase/config";

export type PhotoGraphStorageProvider = "supabase" | "r2";

export type PhotoGraphMediaReference = {
  storagePath?: string | null;
  storageProvider?: PhotoGraphStorageProvider | null;
  externalUrl?: string | null;
};

export type PhotoGraphMediaTransform = {
  width: number;
  quality: number;
  resize?: "cover";
};

const R2_KEY = /^photography-images\/[0-9]+\.(?:png|jpg|webp)$/;
const R2_ORIGINAL_ORIGIN = "https://media.dextery.dev/photo-graph/";
const R2_IMAGE_ORIGIN = "https://images.dextery.dev/photo-graph/";

/** Legacy rows and static graph snapshots have no provider and remain Supabase. */
export function photoGraphStorageProvider(
  value: unknown,
): PhotoGraphStorageProvider {
  if (value === null || value === undefined || value === "supabase") {
    return "supabase";
  }
  if (value === "r2") return "r2";
  throw new Error("Unsupported Photo Graph storage provider.");
}

/** Resolve originals and transformed images through one provider-aware seam. */
export function photoGraphMediaUrl(
  reference: PhotoGraphMediaReference,
  transform?: PhotoGraphMediaTransform,
): string | undefined {
  const { storagePath, externalUrl } = reference;
  const provider = photoGraphStorageProvider(reference.storageProvider);

  if (!storagePath) {
    if (provider === "r2")
      throw new Error("R2 Photo Graph image is missing its key.");
    return externalUrl ?? undefined;
  }

  if (provider === "supabase") {
    return transform
      ? buildSupabaseStorageRenderUrl(storagePath, transform)
      : buildSupabaseStoragePublicUrl(storagePath);
  }

  // This path must agree with the published-only Worker route and canonical
  // node-ID key policy; a private staging or legacy pending path fails closed.
  assertPhotoGraphR2ImageBasePath();
  if (!R2_KEY.test(storagePath)) {
    throw new Error("Invalid published Photo Graph R2 image key.");
  }

  const encoded = storagePath.split("/").map(encodeURIComponent).join("/");
  const url = new URL(
    encoded,
    transform ? R2_IMAGE_ORIGIN : R2_ORIGINAL_ORIGIN,
  );
  if (transform) {
    url.searchParams.set("width", String(transform.width));
    url.searchParams.set("quality", String(transform.quality));
    url.searchParams.set("format", "auto");
    if (transform.resize) url.searchParams.set("resize", transform.resize);
  }
  return url.toString();
}
