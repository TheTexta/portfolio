import { describe, expect, it, vi } from "vitest";
import {
  cleanupPhotoGraphUploadAssets,
  preparePhotoGraphUploadAssets,
} from "@/lib/server/photo-graph-upload-storage";

function storage() {
  return {
    copy: vi.fn().mockResolvedValue({ data: {}, error: null }),
    info: vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: "Missing" } }),
    remove: vi.fn().mockResolvedValue({ error: null }),
  };
}

describe("recoverable upload assets", () => {
  it("retains every source when a later copy fails", async () => {
    const bucket = storage();
    bucket.copy
      .mockResolvedValueOnce({ data: {}, error: null })
      .mockResolvedValueOnce({ error: { message: "Unavailable" } });
    await expect(
      preparePhotoGraphUploadAssets(bucket as never, [
        { source: "pending/a", destination: "1.png" },
        { source: "pending/b", destination: "2.png" },
      ]),
    ).rejects.toThrow("original upload has been retained");
    expect(bucket.remove).not.toHaveBeenCalled();
  });

  it("reuses a reserved copy after an ambiguous response", async () => {
    const bucket = storage();
    bucket.copy.mockResolvedValue({ error: { message: "Already exists" } });
    bucket.info.mockResolvedValue({ data: { name: "1.png" }, error: null });
    await preparePhotoGraphUploadAssets(bucket as never, [
      { source: "pending/a", destination: "1.png" },
    ]);
    expect(bucket.remove).not.toHaveBeenCalled();
  });

  it("reports cleanup failure without making a committed upload fail", async () => {
    const bucket = storage();
    bucket.remove.mockRejectedValue(new Error("Offline"));
    const log = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(
      await cleanupPhotoGraphUploadAssets(bucket as never, ["pending/a"]),
    ).toMatch(/registered.*temporary/);
    log.mockRestore();
  });
});
