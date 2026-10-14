import { describe, expect, it } from "vitest";
import {
  readPhotoGraphUploadRecovery,
  savePhotoGraphUploadRecovery,
  clearPhotoGraphUploadRecovery,
  runWithPhotoGraphUploadLock,
} from "@/lib/photo-graph/upload-recovery";

describe("browser upload recovery", () => {
  it("retains the same key and metadata across reloads", () => {
    let raw: string | null = null;
    const storage = {
      getItem: () => raw,
      setItem: (_key: string, value: string) => {
        raw = value;
      },
    };
    const batch = {
      uploadId: "stable-key",
      uploads: [{ storagePath: "pending/a" }],
    };
    savePhotoGraphUploadRecovery(storage, batch as never);
    expect(readPhotoGraphUploadRecovery(storage)).toEqual(batch);
  });
  it("fails closed on corrupt recovery data", () => {
    expect(() => readPhotoGraphUploadRecovery({ getItem: () => "{}" })).toThrow(
      "invalid",
    );
    expect(readPhotoGraphUploadRecovery({ getItem: () => null })).toBeNull();
  });
  it("does not clear another batch's journal", () => {
    let raw: string | null = JSON.stringify({
      uploadId: "other",
      uploads: [{}],
    });
    const storage = {
      getItem: () => raw,
      removeItem: () => {
        raw = null;
      },
    };
    clearPhotoGraphUploadRecovery(storage, "mine");
    expect(raw).not.toBeNull();
    clearPhotoGraphUploadRecovery(storage, "other");
    expect(raw).toBeNull();
  });
  it("rejects a second owner rather than operating on a partial batch", async () => {
    const locks = {
      request: async (
        _name: string,
        _options: unknown,
        callback: (lock: null) => Promise<void>,
      ) => callback(null),
    };
    await expect(
      runWithPhotoGraphUploadLock(locks as unknown as LockManager, async () => {
        throw new Error("must not run");
      }),
    ).rejects.toThrow("Another admin tab");
  });
});
