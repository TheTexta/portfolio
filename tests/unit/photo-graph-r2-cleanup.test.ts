import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  admin: vi.fn(),
  load: vi.fn(),
  referenced: vi.fn(),
  remove: vi.fn(),
  complete: vi.fn(),
  list: vi.fn(),
}));
vi.mock("@/lib/server/admin-auth", () => ({ getAdminUser: mocks.admin }));
vi.mock("@/lib/photo-graph/database", () => ({
  loadPhotoGraphR2CleanupJob: mocks.load,
  photoGraphR2PathIsReferenced: mocks.referenced,
  completePhotoGraphR2CleanupJob: mocks.complete,
  listPendingPhotoGraphR2CleanupJobs: mocks.list,
}));
vi.mock("@/lib/server/photo-graph-r2", () => ({
  removePhotoGraphR2PublishedObject: mocks.remove,
}));

import {
  processPhotoGraphR2CleanupJob,
  retryPhotoGraphR2CleanupJobs,
} from "@/lib/server/photo-graph-r2-cleanup";
import { POST } from "@/app/api/admin/photo-graph/cleanup/route";

const path = "photography-images/127.png";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.admin.mockResolvedValue({ id: "admin" });
  mocks.load.mockResolvedValue({
    id: 3,
    storage_path: path,
    completed_at: null,
  });
  mocks.referenced.mockResolvedValue(false);
  mocks.list.mockResolvedValue([{ id: 3 }]);
});

describe("R2 Photo Graph deletion cleanup", () => {
  it("removes only unreferenced canonical objects and records completion afterward", async () => {
    await processPhotoGraphR2CleanupJob(3);
    expect(mocks.remove).toHaveBeenCalledWith(path);
    expect(mocks.complete).toHaveBeenCalledWith(3);
    expect(mocks.complete.mock.invocationCallOrder[0]).toBeGreaterThan(
      mocks.remove.mock.invocationCallOrder[0],
    );
  });

  it("retains a referenced or invalid target, and never removes an object on failure", async () => {
    mocks.referenced.mockResolvedValueOnce(true);
    await expect(processPhotoGraphR2CleanupJob(3)).rejects.toThrow(
      "still referenced",
    );
    expect(mocks.remove).not.toHaveBeenCalled();
    mocks.load.mockResolvedValueOnce({
      id: 4,
      storage_path: "staging/private.png",
      completed_at: null,
    });
    await expect(processPhotoGraphR2CleanupJob(4)).rejects.toThrow(
      "Invalid R2 cleanup target",
    );
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("leaves failed removals pending so an admin can retry", async () => {
    mocks.remove.mockRejectedValueOnce(new Error("R2 unavailable"));
    expect(await retryPhotoGraphR2CleanupJobs()).toEqual({
      attempted: 1,
      resolved: 0,
      failed: 1,
    });
    expect(mocks.complete).not.toHaveBeenCalled();
    expect(await retryPhotoGraphR2CleanupJobs()).toEqual({
      attempted: 1,
      resolved: 1,
      failed: 0,
    });
  });
  it("authorizes the retry endpoint before listing or deleting objects", async () => {
    mocks.admin.mockResolvedValueOnce(null);
    expect((await POST()).status).toBe(401);
    expect(mocks.list).not.toHaveBeenCalled();
    const response = await POST();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      attempted: 1,
      resolved: 1,
      failed: 0,
    });
  });
});
