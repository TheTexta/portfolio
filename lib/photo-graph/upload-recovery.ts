import type { PhotoGraphUploadRegistration } from "./admin-types";

export const PHOTO_GRAPH_UPLOAD_RECOVERY_KEY = "photo-graph-upload-recovery-v1";
export const PHOTO_GRAPH_UPLOAD_LOCK = "photo-graph-upload-pipeline";

export type PhotoGraphUploadRecovery = {
  uploadId: string;
  uploads: PhotoGraphUploadRegistration[];
  phase?: "uploading" | "registering";
  files?: Record<string, { name: string; size: number; sha256: string }>;
};

// Contains image metadata only, never signed upload tokens or credentials.
export function readPhotoGraphUploadRecovery(
  storage: Pick<Storage, "getItem">,
) {
  const raw = storage.getItem(PHOTO_GRAPH_UPLOAD_RECOVERY_KEY);
  if (!raw) return null;
  const value = JSON.parse(raw) as PhotoGraphUploadRecovery;
  if (
    !value ||
    typeof value.uploadId !== "string" ||
    !Array.isArray(value.uploads)
  ) {
    throw new Error(
      "Saved upload recovery data is invalid. Preserve it before clearing browser storage.",
    );
  }
  return value.uploads.length ? value : null;
}

export async function runWithPhotoGraphUploadLock<T>(
  locks: LockManager,
  callback: () => Promise<T>,
) {
  return locks.request(
    PHOTO_GRAPH_UPLOAD_LOCK,
    { ifAvailable: true },
    async (lock) => {
      if (!lock)
        throw new Error(
          "Another admin tab is processing uploads. Wait for it to finish, then retry.",
        );
      return callback();
    },
  );
}

export function clearPhotoGraphUploadRecovery(
  storage: Pick<Storage, "getItem" | "removeItem">,
  uploadId: string,
) {
  if (readPhotoGraphUploadRecovery(storage)?.uploadId === uploadId)
    storage.removeItem(PHOTO_GRAPH_UPLOAD_RECOVERY_KEY);
}

export function savePhotoGraphUploadRecovery(
  storage: Pick<Storage, "setItem">,
  batch: PhotoGraphUploadRecovery,
) {
  storage.setItem(PHOTO_GRAPH_UPLOAD_RECOVERY_KEY, JSON.stringify(batch));
}
