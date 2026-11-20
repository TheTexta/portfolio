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
  publishR2: vi.fn(),
  cleanupR2: vi.fn(),
  config: vi.fn(),
  neighbors: vi.fn(),
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
vi.mock("@/lib/server/photo-graph-r2", () => ({
  publishPhotoGraphR2Upload: mocks.publishR2,
  removePhotoGraphR2StagedObject: mocks.cleanupR2,
}));
vi.mock("@/lib/photo-graph/database", () => ({
  loadPhotoGraphUploadRevision: mocks.revision,
  beginPhotoGraphUpload: mocks.begin,
  commitPhotoGraphUpload: mocks.commit,
  loadPhotoGraphEdgeGenerationConfig: mocks.config,
  loadPhotoGraphNeighbors: mocks.neighbors,
}));
vi.mock("@/lib/photo-graph/graph-store", () => ({
  loadGraphWithFallback: mocks.graph,
  cloneGraphNodes: (nodes: unknown) => structuredClone(nodes),
  ensureProcessingFeatures: () => 1,
  ensureGraphStoragePaths: () => {},
}));
import { POST } from "@/app/api/admin/photo-graph/upload/route";
import { registerPhotoGraphUpload } from "@/lib/server/photo-graph-register-upload";

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
const r2Upload = {
  ...upload,
  storagePath: `staging/${uploadId}.png`,
  storageProvider: "r2",
  sourceSha256: "a".repeat(64),
  sourceSize: 123,
  contentType: "image/png",
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
  mocks.publishR2.mockResolvedValue("photography-images/101.png");
  mocks.cleanupR2.mockResolvedValue(undefined);
  mocks.config.mockResolvedValue(result.edgeGenerationConfig);
  mocks.neighbors.mockResolvedValue([]);
});

describe("upload registration route", () => {
  it("coordinates revision, reservation, publication, commit and cleanup in order without a request", async () => {
    const response = await registerPhotoGraphUpload(uploadId, "admin", [
      { ...r2Upload, storageProvider: "r2", colour: "#808080" },
    ]);
    expect(response).toEqual({
      kind: "registered",
      result: { ...result, warning: undefined },
    });
    const order = [
      mocks.revision,
      mocks.graph,
      mocks.begin,
      mocks.publishR2,
      mocks.neighbors,
      mocks.commit,
      mocks.cleanupR2,
    ].map((mock) => mock.mock.invocationCallOrder[0]);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(mocks.begin).toHaveBeenCalledWith(
      uploadId,
      "admin",
      expect.any(Array),
      0,
    );
    expect(mocks.commit.mock.calls[0].slice(0, 2)).toEqual([
      uploadId,
      "revision",
    ]);
  });
  it("reports unavailable persistence before reserving or publishing", async () => {
    mocks.graph.mockResolvedValueOnce({
      nodes: [],
      source: "static",
      databaseAvailable: false,
    });
    expect(await registerPhotoGraphUpload(uploadId, "admin", [])).toMatchObject(
      { kind: "unavailable" },
    );
    expect(mocks.begin).not.toHaveBeenCalled();
    expect(mocks.publishR2).not.toHaveBeenCalled();
  });
  it("reports missing model features without publishing or cleaning reserved sources", async () => {
    mocks.config.mockResolvedValueOnce({
      ...result.edgeGenerationConfig,
      model: "oklab-histogram",
    });
    mocks.graph.mockResolvedValueOnce({
      nodes: [{ id: "1", correlations: {} }],
      source: "database",
      databaseAvailable: true,
    });
    const response = await registerPhotoGraphUpload(uploadId, "admin", [
      { ...upload, colour: "#808080" },
    ]);
    expect(response).toMatchObject({
      kind: "missing-features",
      error: expect.stringContaining("1 existing node(s) missing"),
    });
    expect(mocks.begin).toHaveBeenCalledOnce();
    expect(mocks.prepare).not.toHaveBeenCalled();
    expect(mocks.cleanup).not.toHaveBeenCalled();
    expect(mocks.commit).not.toHaveBeenCalled();
  });
  it("does not read directed neighbors when replacing the static snapshot", async () => {
    mocks.graph.mockResolvedValueOnce({
      nodes: [],
      source: "static",
      databaseAvailable: true,
    });
    await registerPhotoGraphUpload(uploadId, "admin", [
      { ...upload, colour: "#808080" },
    ]);
    expect(mocks.neighbors).not.toHaveBeenCalled();
    expect(mocks.commit.mock.calls[0][3]).toEqual(["101"]);
  });
  it("does not commit or clean up if R2 publication fails", async () => {
    mocks.publishR2.mockRejectedValue(new Error("Publish unavailable"));
    await expect(
      registerPhotoGraphUpload(uploadId, "admin", [
        { ...r2Upload, storageProvider: "r2", colour: "#808080" },
      ]),
    ).rejects.toThrow("Publish unavailable");
    expect(mocks.commit).not.toHaveBeenCalled();
    expect(mocks.cleanupR2).not.toHaveBeenCalled();
  });
  it("retains a successful result with a warning when cleanup fails, and only cleans on replay", async () => {
    mocks.cleanupR2.mockRejectedValueOnce(new Error("Cleanup unavailable"));
    const uploads = [
      { ...r2Upload, storageProvider: "r2" as const, colour: "#808080" },
    ];
    const response = await registerPhotoGraphUpload(uploadId, "admin", uploads);
    expect(response.kind).toBe("registered");
    if (response.kind !== "registered")
      throw new Error("Expected registration");
    expect(response.result).toMatchObject({
      ...result,
      warning: expect.stringContaining("cleanup remains"),
    });
    mocks.begin.mockResolvedValueOnce({ nodeIds: ["101"], result });
    expect(await registerPhotoGraphUpload(uploadId, "admin", uploads)).toEqual({
      kind: "registered",
      result: { ...result, warning: undefined },
    });
    expect(mocks.publishR2).toHaveBeenCalledOnce();
    expect(mocks.commit).toHaveBeenCalledOnce();
    expect(mocks.cleanupR2).toHaveBeenCalledTimes(2);
  });
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
  it("publishes an R2 original before commit and cleans staging afterward", async () => {
    const response = await POST(request({ uploadId, uploads: [r2Upload] }));
    expect(response.status).toBe(200);
    expect(mocks.prepare).not.toHaveBeenCalled();
    expect(mocks.publishR2).toHaveBeenCalledWith({
      source: r2Upload.storagePath,
      nodeId: "101",
      contentType: "image/png",
      size: 123,
      sha256: r2Upload.sourceSha256,
    });
    expect(mocks.commit.mock.calls[0][2][0]).toMatchObject({
      storageProvider: "r2",
      storagePath: "photography-images/101.png",
    });
    expect(mocks.cleanupR2).toHaveBeenCalledWith(r2Upload.storagePath);
    expect(mocks.cleanupR2.mock.invocationCallOrder[0]).toBeGreaterThan(
      mocks.commit.mock.invocationCallOrder[0],
    );
  });
  it("keeps R2 staging after commit failure and retries cleanup after an ambiguous response", async () => {
    mocks.commit.mockRejectedValueOnce(new Error("Transaction unavailable"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(
      (await POST(request({ uploadId, uploads: [r2Upload] }))).status,
    ).toBe(503);
    expect(mocks.cleanupR2).not.toHaveBeenCalled();
    mocks.begin.mockResolvedValueOnce({ nodeIds: ["101"], result });
    expect(
      (await POST(request({ uploadId, uploads: [r2Upload] }))).status,
    ).toBe(200);
    expect(mocks.cleanupR2).toHaveBeenCalledWith(r2Upload.storagePath);
    expect(mocks.publishR2).toHaveBeenCalledTimes(1);
    log.mockRestore();
  });
  it("rejects incomplete or mismatched R2 metadata before reserving an upload", async () => {
    for (const changes of [
      { sourceSha256: "bad" },
      { sourceSize: 0 },
      { storagePath: upload.storagePath },
      { contentType: "image/jpeg" },
    ]) {
      expect(
        (
          await POST(
            request({ uploadId, uploads: [{ ...r2Upload, ...changes }] }),
          )
        ).status,
      ).toBe(400);
    }
    expect(mocks.begin).not.toHaveBeenCalled();
  });
});
