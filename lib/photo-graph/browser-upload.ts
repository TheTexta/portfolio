import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  PhotoGraphUploadRegistration,
  PhotoGraphUploadResponse,
  PhotoGraphUploadUrlResponse,
} from "./admin-types";
import { PHOTO_GRAPH_CACHE_CONTROL_SECONDS } from "./config";
import {
  clearPhotoGraphUploadRecovery,
  readPhotoGraphUploadRecovery,
  runWithPhotoGraphUploadLock,
  savePhotoGraphUploadRecovery,
  type PhotoGraphUploadRecovery,
} from "./upload-recovery";

export type PhotoGraphUploadProgress = {
  message: string;
  level?: "info" | "success";
  /** Status messages also appear in the log; log-only events leave status alone. */
  logOnly?: boolean;
};

type BrowserUploadDependencies = {
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">;
  locks: LockManager;
  supabase: {
    storage: {
      from: (
        bucket: string,
      ) => Pick<
        ReturnType<SupabaseClient["storage"]["from"]>,
        "uploadToSignedUrl"
      >;
    };
  };
  computeFeatures: (file: File) => Promise<
    PhotoGraphUploadRegistration["feature"] & {
      dimensions: PhotoGraphUploadRegistration["dimensions"];
    }
  >;
  onProgress: (progress: PhotoGraphUploadProgress) => void;
  onRecovery: (batch: PhotoGraphUploadRecovery | null) => void;
};

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      text.trim() || `Request failed with status ${response.status}.`,
    );
  }
}

async function hashFile(file: File) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", await file.arrayBuffer()),
    ),
  )
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function signFile(file: File, sha256: string, storagePath?: string) {
  const response = await fetch("/api/admin/photo-graph/upload-url", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type,
      size: file.size,
      sha256,
      storagePath,
    }),
  });
  const signed = await readJson<PhotoGraphUploadUrlResponse>(response);
  if (!response.ok || !signed.ok)
    throw new Error(
      signed.error ??
        (storagePath
          ? "Unable to resume upload."
          : "Failed to get upload URL."),
    );
  return signed;
}

async function sendFile(
  file: File,
  signed: PhotoGraphUploadUrlResponse,
  supabase: BrowserUploadDependencies["supabase"],
  retryPath?: string,
) {
  const retry = retryPath !== undefined;
  if (signed.storageProvider === "r2") {
    const response = await fetch(signed.signedUrl, {
      method: "PUT",
      headers: signed.headers ?? { "Content-Type": file.type },
      body: file,
    });
    if (!response.ok)
      throw new Error(
        `Direct R2 ${retry ? "retry" : "upload"} failed (${response.status}). Retry to confirm whether the original was received.`,
      );
  } else {
    if (!signed.token) throw new Error("Supabase upload token was missing.");
    const { error } = await supabase.storage
      .from(signed.bucket)
      .uploadToSignedUrl(retryPath ?? signed.objectPath, signed.token, file, {
        cacheControl: PHOTO_GRAPH_CACHE_CONTROL_SECONDS,
        contentType: file.type,
      });
    if (error)
      throw new Error(
        retry
          ? `${error.message}. Retry to confirm whether the original was received.`
          : error.message || `Direct upload failed for ${file.name}.`,
      );
  }
}

/** Owns the durable v1 protocol. Errors leave recovery intact; warnings retain it for cleanup replay. */
export async function uploadPhotoGraphFiles(
  files: readonly File[],
  {
    storage,
    locks,
    supabase,
    computeFeatures,
    onProgress,
    onRecovery,
  }: BrowserUploadDependencies,
): Promise<PhotoGraphUploadResponse> {
  return runWithPhotoGraphUploadLock(locks, async () => {
    // Mounted view state can be stale after another tab completes a batch.
    let batch = readPhotoGraphUploadRecovery(storage);
    const persist = (batch: PhotoGraphUploadRecovery) => {
      savePhotoGraphUploadRecovery(storage, batch);
      onRecovery({ ...batch });
    };
    if (!batch) {
      if (!files.length)
        throw new Error(
          "This batch was completed in another tab. Select new files to upload.",
        );
      if (files.length > 100)
        throw new Error("Select at most 100 images per upload batch.");
      batch = {
        uploadId: crypto.randomUUID(),
        uploads: [],
        phase: "uploading",
        files: {},
      };
      savePhotoGraphUploadRecovery(storage, batch);
      onProgress({
        message: `Validated ${files.length} file(s) for upload.`,
        level: "success",
        logOnly: true,
      });
      for (const [index, file] of files.entries()) {
        onProgress({
          message: `Extracting image features (${index + 1}/${files.length}): ${file.name}`,
        });
        const featurePayload = await computeFeatures(file);
        onProgress({
          message: `Feature extraction complete: ${file.name}.`,
          level: "success",
          logOnly: true,
        });
        const sha256 = await hashFile(file);
        onProgress({
          message: `Requesting upload URL (${index + 1}/${files.length}): ${file.name}`,
        });
        const signed = await signFile(file, sha256);
        onProgress({
          message: `Uploading directly to ${signed.storageProvider === "r2" ? "R2" : "Supabase"} (${index + 1}/${files.length}): ${file.name}`,
        });
        batch.uploads.push({
          storagePath: signed.objectPath,
          ...(signed.storageProvider === "r2"
            ? {
                storageProvider: "r2" as const,
                sourceSha256: sha256,
                sourceSize: file.size,
                contentType: file.type,
              }
            : {}),
          feature: {
            rgb: featurePayload.rgb,
            lab: featurePayload.lab,
            hue: featurePayload.hue,
            longSide: featurePayload.longSide,
            colorV1: featurePayload.colorV1,
          },
          dimensions: featurePayload.dimensions,
        });
        batch.files![signed.objectPath] = {
          name: file.name,
          size: file.size,
          sha256,
        };
        // Write ahead of bytes, including when the response is lost.
        persist(batch);
        await sendFile(file, signed, supabase);
        onProgress({
          message: `Direct upload complete: ${file.name} -> ${signed.objectPath}.`,
          level: "success",
          logOnly: true,
        });
      }
    }
    if (!batch.uploads.length)
      throw new Error("No uploaded images to register.");
    if (batch.phase === "uploading") {
      const response = await fetch("/api/admin/photo-graph/upload-status", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          items: batch.uploads.map((upload) => ({
            storagePath: upload.storagePath,
            ...(upload.storageProvider === "r2"
              ? {
                  storageProvider: "r2",
                  sourceSha256: upload.sourceSha256,
                  sourceSize: upload.sourceSize,
                  contentType: upload.contentType,
                }
              : {}),
          })),
        }),
      });
      const status = await readJson<{
        ok: boolean;
        missing: string[];
        error?: string;
      }>(response);
      if (!response.ok || !status.ok)
        throw new Error(status.error ?? "Unable to confirm uploaded images.");
      for (const path of status.missing) {
        const original = batch.files?.[path];
        const file =
          original &&
          files.find(
            (candidate) =>
              candidate.name === original.name &&
              candidate.size === original.size,
          );
        if (!file)
          throw new Error(
            `Reselect the original file ${original?.name ?? path}, then retry registration. Recovery metadata has been retained.`,
          );
        const sha256 = await hashFile(file);
        if (sha256 !== original.sha256)
          throw new Error(
            `The selected ${file.name} differs from the original. Select the original image.`,
          );
        const signed = await signFile(file, sha256, path);
        const entry = batch.uploads.find(
          (upload) => upload.storagePath === path,
        );
        if (
          (signed.storageProvider ?? "supabase") !==
          (entry?.storageProvider ?? "supabase")
        )
          throw new Error(
            "The upload backend changed during recovery. Recovery metadata has been retained.",
          );
        await sendFile(file, signed, supabase, path);
      }
      // Never append to a reserved batch, including after an ambiguous commit.
      batch.phase = "registering";
      persist(batch);
    }
    onProgress({
      message:
        "Registering uploaded files and updating sparse neighborhoods...",
    });
    const response = await fetch("/api/admin/photo-graph/upload", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        uploadId: batch.uploadId,
        uploads: batch.uploads,
      }),
    });
    const result = await readJson<PhotoGraphUploadResponse>(response);
    if (!response.ok || !result.ok)
      throw new Error(result.error ?? "Upload registration failed.");
    if (!result.warning) {
      clearPhotoGraphUploadRecovery(storage, batch.uploadId);
      onRecovery(null);
    }
    return result;
  });
}
