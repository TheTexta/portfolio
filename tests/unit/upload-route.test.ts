import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { extractPhotoGraphColorFeatureV1 } from "@/lib/photo-graph/color-features";
import { featureFromRgb } from "@/lib/photo-graph/feature-extraction";

const mocks = vi.hoisted(() => ({
  admin: vi.fn(),
  revision: vi.fn(),
  begin: vi.fn(),
  commit: vi.fn(),
  graph: vi.fn(),
  prepare: vi.fn(),
  cleanup: vi.fn(),
}));
vi.mock("@/lib/server/admin-auth", () => ({ getAdminUser: mocks.admin }));
vi.mock("@/lib/server/supabase", () => ({
  getServiceRoleSupabase: () => ({ storage: { from: () => ({}) } }),
}));
vi.mock("@/lib/supabase/config", () => ({
  getPhotoGraphStorageBucket: () => "test-bucket",
}));
vi.mock("@/lib/server/photo-graph-upload-storage", () => ({
  preparePhotoGraphUploadAssets: mocks.prepare,
  cleanupPhotoGraphUploadAssets: mocks.cleanup,
}));
vi.mock("@/lib/photo-graph/database", () => ({
  loadPhotoGraphUploadRevision: mocks.revision,
  beginPhotoGraphUpload: mocks.begin,
  commitPhotoGraphUpload: mocks.commit,
  loadPhotoGraphEdgeGenerationConfig: async () => ({
    model: "mean-lab-cie76",
    neighborsPerNode: 2,
    maxDistance: 1,
  }),
  loadPhotoGraphNeighbors: async () => [],
}));
vi.mock("@/lib/photo-graph/graph-store", () => ({
  loadGraphWithFallback: mocks.graph,
  cloneGraphNodes: (nodes: unknown) => structuredClone(nodes),
  ensureProcessingFeatures: () => 1,
  ensureGraphStoragePaths: () => {},
}));
import { POST } from "@/app/api/admin/photo-graph/upload/route";

const uploadId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const upload = {
  storagePath: `photography-images/_pending/${uploadId}.png`,
  feature: {
    ...featureFromRgb([128, 128, 128], 1),
    colorV1: extractPhotoGraphColorFeatureV1({
      width: 1,
      height: 1,
      data: [128, 128, 128, 255],
    }),
  },
  dimensions: { width: 1, height: 1, aspectRatio: 1 },
};
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
function request(body: unknown) {
  return new NextRequest("http://localhost/api/admin/photo-graph/upload", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.admin.mockResolvedValue({ id: "admin" });
  mocks.revision.mockResolvedValue("revision");
  mocks.graph.mockResolvedValue({
    nodes: [],
    source: "database",
    databaseAvailable: true,
  });
  mocks.begin.mockResolvedValue({ nodeIds: ["101"], result: null });
  mocks.commit.mockResolvedValue(result);
});

describe("upload registration route", () => {
  it("rejects unauthorized requests before using privileged services", async () => {
    mocks.admin.mockResolvedValue(null);
    expect((await POST(request({}))).status).toBe(401);
    expect(mocks.revision).not.toHaveBeenCalled();
  });
  it.each([
    null,
    {},
    { uploads: [upload] },
    {
      uploadId,
      uploads: [{ ...upload, storagePath: "photography-images/1.png" }],
    },
    { uploadId, uploads: [upload, upload] },
    { uploadId, uploads: Array(101).fill(upload) },
  ])(
    "rejects invalid keys, paths, duplicate paths and oversized batches: %j",
    async (body) => {
      expect((await POST(request(body))).status).toBe(400);
      expect(mocks.begin).not.toHaveBeenCalled();
    },
  );
  it("retains sources if the atomic database commit fails", async () => {
    mocks.commit.mockRejectedValue(new Error("Transaction unavailable"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await POST(request({ uploadId, uploads: [upload] }));
    expect(response.status).toBe(503);
    expect((await response.json()).uploadId).toBe(uploadId);
    expect(mocks.prepare).toHaveBeenCalledOnce();
    expect(mocks.cleanup).not.toHaveBeenCalled();
    log.mockRestore();
  });
  it("returns a completed batch without recopying or recommitting", async () => {
    mocks.begin.mockResolvedValue({ nodeIds: ["101"], result });
    expect(
      await (await POST(request({ uploadId, uploads: [upload] }))).json(),
    ).toEqual(result);
    expect(mocks.prepare).not.toHaveBeenCalled();
    expect(mocks.commit).not.toHaveBeenCalled();
    expect(mocks.cleanup).toHaveBeenCalledOnce();
  });
  it("cleans sources only after a successful commit", async () => {
    const response = await POST(request({ uploadId, uploads: [upload] }));
    expect(response.status).toBe(200);
    expect(mocks.commit).toHaveBeenCalledOnce();
    expect(mocks.cleanup.mock.invocationCallOrder[0]).toBeGreaterThan(
      mocks.commit.mock.invocationCallOrder[0],
    );
  });
});
