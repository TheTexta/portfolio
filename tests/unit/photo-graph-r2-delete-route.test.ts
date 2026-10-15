import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  admin: vi.fn(),
  graph: vi.fn(),
  queue: vi.fn(),
  legacyDelete: vi.fn(),
  upsert: vi.fn(),
  storage: vi.fn(),
  cleanup: vi.fn(),
}));
vi.mock("@/lib/server/admin-auth", () => ({ getAdminUser: mocks.admin }));
vi.mock("@/lib/photo-graph/graph-store", () => ({
  loadGraphWithFallback: mocks.graph,
  cloneGraphNodes: (nodes: unknown) => structuredClone(nodes),
  ensureProcessingFeatures: () => {},
  writeRuntimeGraph: vi.fn(),
}));
vi.mock("@/lib/photo-graph/database", () => ({
  queuePhotoGraphR2Deletion: mocks.queue,
  deletePhotoGraphNodeRecord: mocks.legacyDelete,
  upsertPhotoGraphNodes: mocks.upsert,
}));
vi.mock("@/lib/server/photo-graph-r2-cleanup", () => ({
  processPhotoGraphR2CleanupJob: mocks.cleanup,
}));
vi.mock("@/lib/server/supabase", () => ({
  getServiceRoleSupabase: () => ({ storage: { from: mocks.storage } }),
}));

import { POST } from "@/app/api/admin/photo-graph/delete/route";

function request() {
  return new NextRequest("http://localhost/api/admin/photo-graph/delete", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ nodeId: "127" }),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.admin.mockResolvedValue({ id: "admin" });
  mocks.queue.mockResolvedValue(4);
  mocks.graph.mockResolvedValue({
    source: "database",
    databaseAvailable: true,
    nodes: [
      {
        id: "1",
        scale: 1,
        colour: "#808080",
        correlations: { "127": 0.4 },
        storagePath: "photography-images/1.png",
      },
      {
        id: "127",
        scale: 1,
        colour: "#808080",
        correlations: { "1": 0.4 },
        storagePath: "photography-images/127.png",
        storageProvider: "r2",
      },
    ],
  });
});

describe("R2 Photo Graph node deletion", () => {
  it("requires admin access before queuing a cleanup", async () => {
    mocks.admin.mockResolvedValue(null);
    expect((await POST(request())).status).toBe(401);
    expect(mocks.queue).not.toHaveBeenCalled();
  });

  it("durably queues R2 cleanup rather than deleting the wrong Supabase object", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(mocks.queue).toHaveBeenCalledWith("127");
    expect(mocks.upsert).toHaveBeenCalledOnce();
    expect(mocks.cleanup).toHaveBeenCalledWith(4);
    expect(mocks.legacyDelete).not.toHaveBeenCalled();
    expect(mocks.storage).not.toHaveBeenCalled();
  });

  it("reports a retryable warning if object cleanup fails after deletion", async () => {
    mocks.cleanup.mockRejectedValueOnce(new Error("R2 unavailable"));
    const response = await POST(request());
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.warning).toContain("queued for cleanup");
    expect(mocks.queue).toHaveBeenCalledOnce();
  });
});
