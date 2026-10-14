import type { SupabaseClient } from "@supabase/supabase-js";

type UploadStorage = ReturnType<SupabaseClient["storage"]["from"]>;

// Never move or delete the source before the database transaction commits.
// The durable reservation owns each destination, so an existing copy is safe
// to reuse after a timeout or a retry of the same immutable batch.
export async function preparePhotoGraphUploadAssets(
  storage: UploadStorage,
  assets: { source: string; destination: string }[],
) {
  for (const { source, destination } of assets) {
    const { error } = await storage.copy(source, destination);
    if (!error) continue;
    const existing = await storage.info(destination);
    if (!existing.error && existing.data) continue;
    throw new Error(
      `Unable to prepare uploaded asset ${source}: ${error.message}. Retry registration; the original upload has been retained.`,
    );
  }
}

export async function cleanupPhotoGraphUploadAssets(
  storage: UploadStorage,
  paths: string[],
) {
  try {
    const { error } = await storage.remove(paths);
    if (error) throw error;
    return undefined;
  } catch (error) {
    console.warn(
      "Committed Photo Graph upload has pending-source cleanup remaining",
      { paths, error },
    );
    return "Photos were registered, but temporary upload copies remain. Retry registration to retry cleanup.";
  }
}
