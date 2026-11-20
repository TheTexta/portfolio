import { afterEach, describe, expect, it, vi } from "vitest";
import { uploadPhotoGraphFiles } from "@/lib/photo-graph/browser-upload";
import {
  PHOTO_GRAPH_UPLOAD_RECOVERY_KEY as key,
  readPhotoGraphUploadRecovery,
  type PhotoGraphUploadRecovery,
} from "@/lib/photo-graph/upload-recovery";
import { featureFromRgb } from "@/lib/photo-graph/feature-extraction";

const feature = featureFromRgb([128, 128, 128], 100);
const dimensions = { width: 100, height: 100, aspectRatio: 1 };
const file = new File(["original bytes"], "photo.png", { type: "image/png" });
const path = "staging/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.png";
const result = {
  ok: true,
  createdIds: ["101"],
  nodeCount: 1,
  edgeCount: 0,
  edgeGenerationConfig: {
    model: "mean-lab-cie76",
    neighborsPerNode: 2,
    maxDistance: 1,
  },
};

function fixture() {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
  const legacySend = vi.fn().mockResolvedValue({ error: null });
  const deps: Parameters<typeof uploadPhotoGraphFiles>[1] = {
    storage,
    locks: {
      request: vi.fn(async (_name, _options, callback) => callback({})),
    } as unknown as LockManager,
    supabase: { storage: { from: () => ({ uploadToSignedUrl: legacySend }) } },
    computeFeatures: vi.fn().mockResolvedValue({ ...feature, dimensions }),
    onProgress: vi.fn(),
    onRecovery: vi.fn(),
  };
  const signed = {
    ok: true,
    bucket: "test",
    objectPath: path,
    storageProvider: "r2",
    signedUrl: "https://upload.test",
    token: "test-token",
  };
  const requests: { url: string; body: Record<string, unknown> }[] = [];
  const fetcher = vi.fn(async (url: string, init: RequestInit) => {
    if (init.method === "PUT") {
      expect(
        readPhotoGraphUploadRecovery(storage)?.uploads[0].storagePath,
      ).toBe(path);
      expect(
        readPhotoGraphUploadRecovery(storage)?.files?.[path].sha256,
      ).toMatch(/^[a-f0-9]{64}$/);
      return Response.json({});
    }
    const body = JSON.parse(String(init.body));
    requests.push({ url, body });
    if (url.endsWith("upload-url")) return Response.json(signed);
    if (url.endsWith("upload-status"))
      return Response.json({ ok: true, missing: [] });
    expect(readPhotoGraphUploadRecovery(storage)?.phase).not.toBe("uploading");
    return Response.json(result);
  });
  vi.stubGlobal("fetch", fetcher);
  return { deps, storage, signed, requests, fetcher, legacySend };
}
afterEach(() => vi.unstubAllGlobals());

describe("recoverable browser upload", () => {
  it.each(["r2", "supabase"])(
    "writes intent before %s bytes and seals before registration",
    async (provider) => {
      const f = fixture();
      if (provider === "supabase") {
        delete (f.signed as { storageProvider?: string }).storageProvider;
        f.legacySend.mockImplementation(async () => {
          expect(
            readPhotoGraphUploadRecovery(f.storage)?.uploads[0].storagePath,
          ).toBe(path);
          return { error: null };
        });
      }
      expect(await uploadPhotoGraphFiles([file], f.deps)).toEqual(result);
      expect(f.requests.map((r) => r.url)).toEqual([
        "/api/admin/photo-graph/upload-url",
        "/api/admin/photo-graph/upload-status",
        "/api/admin/photo-graph/upload",
      ]);
      expect(f.storage.getItem(key)).toBeNull();
      expect(f.legacySend).toHaveBeenCalledTimes(
        provider === "supabase" ? 1 : 0,
      );
    },
  );
  it("fails before features, signing or bytes if durable storage is unavailable", async () => {
    const f = fixture();
    f.storage.setItem = () => {
      throw new Error("Storage denied");
    };
    await expect(uploadPhotoGraphFiles([file], f.deps)).rejects.toThrow(
      "Storage denied",
    );
    expect(f.deps.computeFeatures).not.toHaveBeenCalled();
    expect(f.fetcher).not.toHaveBeenCalled();
  });
  it.each(["r2", "supabase"])(
    "resumes an ambiguous %s send with the same key, checksum and object",
    async (provider) => {
      const f = fixture();
      if (provider === "supabase") {
        delete (f.signed as { storageProvider?: string }).storageProvider;
        f.legacySend.mockRejectedValueOnce(new Error("Response lost"));
      } else
        f.fetcher
          .mockImplementationOnce(async () => Response.json(f.signed))
          .mockRejectedValueOnce(new Error("Response lost"));
      await expect(uploadPhotoGraphFiles([file], f.deps)).rejects.toThrow(
        "Response lost",
      );
      const saved = readPhotoGraphUploadRecovery(f.storage)!;
      f.fetcher.mockImplementationOnce(async () =>
        Response.json({ ok: true, missing: [path] }),
      );
      await uploadPhotoGraphFiles([file], f.deps);
      const registration = f.requests.find((r) => r.url.endsWith("/upload"))!;
      expect(registration.body.uploadId).toBe(saved.uploadId);
      const signing = f.requests
        .filter((r) => r.url.endsWith("upload-url"))
        .at(-1)!;
      expect(signing.body).toMatchObject({
        storagePath: path,
        sha256: saved.files![path].sha256,
      });
      expect(f.deps.computeFeatures).toHaveBeenCalledTimes(1);
    },
  );
  it("rejects changed bytes and changed providers without clearing recovery", async () => {
    const f = fixture();
    f.fetcher
      .mockImplementationOnce(async () => Response.json(f.signed))
      .mockRejectedValueOnce(new Error("lost"));
    await expect(uploadPhotoGraphFiles([file], f.deps)).rejects.toThrow("lost");
    f.fetcher.mockImplementationOnce(async () =>
      Response.json({ ok: true, missing: [path] }),
    );
    await expect(
      uploadPhotoGraphFiles(
        [new File(["changed bytes!"], file.name, { type: file.type })],
        f.deps,
      ),
    ).rejects.toThrow("differs from the original");
    f.fetcher.mockImplementationOnce(async () =>
      Response.json({ ok: true, missing: [path] }),
    );
    delete (f.signed as { storageProvider?: string }).storageProvider;
    await expect(uploadPhotoGraphFiles([file], f.deps)).rejects.toThrow(
      "backend changed",
    );
    expect(readPhotoGraphUploadRecovery(f.storage)?.phase).toBe("uploading");
    expect(f.legacySend).not.toHaveBeenCalled();
  });
  it("asks for missing originals rather than starting a new batch", async () => {
    const f = fixture();
    f.fetcher
      .mockImplementationOnce(async () => Response.json(f.signed))
      .mockRejectedValueOnce(new Error("lost"));
    await expect(uploadPhotoGraphFiles([file], f.deps)).rejects.toThrow("lost");
    f.fetcher.mockImplementationOnce(async () =>
      Response.json({ ok: true, missing: [path] }),
    );
    await expect(uploadPhotoGraphFiles([], f.deps)).rejects.toThrow(
      "Reselect the original file photo.png",
    );
    expect(f.deps.computeFeatures).toHaveBeenCalledTimes(1);
  });
  it("re-reads legacy v1 metadata under the lock and retains cleanup warnings for replay", async () => {
    const f = fixture();
    const old: PhotoGraphUploadRecovery = {
      uploadId: "same-key",
      uploads: [{ storagePath: path, feature, dimensions }],
    };
    f.deps.locks = {
      request: async (
        _name: unknown,
        _options: unknown,
        callback: (lock: object) => Promise<unknown>,
      ) => {
        f.storage.setItem(key, JSON.stringify(old));
        return callback({});
      },
    } as unknown as LockManager;
    f.fetcher.mockResolvedValueOnce(
      Response.json({ ...result, warning: "Cleanup pending" }),
    );
    expect((await uploadPhotoGraphFiles([file], f.deps)).warning).toBe(
      "Cleanup pending",
    );
    expect(readPhotoGraphUploadRecovery(f.storage)).toEqual(old);
    expect(f.deps.computeFeatures).not.toHaveBeenCalled();
    expect(f.fetcher).toHaveBeenCalledExactlyOnceWith(
      "/api/admin/photo-graph/upload",
      expect.objectContaining({
        body: JSON.stringify({ uploadId: old.uploadId, uploads: old.uploads }),
      }),
    );
  });
  it("seals before an ambiguous registration, then replays without appending new files", async () => {
    const f = fixture();
    const normal = f.fetcher.getMockImplementation()!;
    f.fetcher.mockImplementation(async (url, init) =>
      url.endsWith("/upload")
        ? Response.json({ error: "Commit uncertain" }, { status: 503 })
        : normal(url, init),
    );
    await expect(uploadPhotoGraphFiles([file], f.deps)).rejects.toThrow(
      "Commit uncertain",
    );
    const saved = readPhotoGraphUploadRecovery(f.storage)!;
    expect(saved.phase).toBe("registering");
    f.fetcher.mockImplementation(normal);
    await uploadPhotoGraphFiles([file, file], f.deps);
    expect(f.deps.computeFeatures).toHaveBeenCalledTimes(1);
    expect(f.requests.at(-1)?.body).toEqual({
      uploadId: saved.uploadId,
      uploads: saved.uploads,
    });
  });
});
