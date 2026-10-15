import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  admin: vi.fn(),
  signR2: vi.fn(),
  signSupabase: vi.fn(),
  schema: vi.fn(),
}));

vi.mock("@/lib/server/admin-auth", () => ({ getAdminUser: mocks.admin }));
vi.mock("@/lib/server/photo-graph-r2", () => ({
  signPhotoGraphR2Upload: mocks.signR2,
}));
vi.mock("@/lib/server/supabase", () => ({
  getServiceRoleSupabase: () => ({
    storage: { from: () => ({ createSignedUploadUrl: mocks.signSupabase }) },
    from: () => ({ select: () => ({ limit: mocks.schema }) }),
  }),
}));

import { POST } from "@/app/api/admin/photo-graph/upload-url/route";

const sha256 = "a".repeat(64);

function request(body: unknown) {
  return new NextRequest("http://localhost/api/admin/photo-graph/upload-url", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  mocks.admin.mockResolvedValue({ id: "admin" });
  mocks.signSupabase.mockResolvedValue({
    data: { token: "test-token", signedUrl: "https://supabase.example/upload" },
    error: null,
  });
  mocks.signR2.mockResolvedValue({
    signedUrl: "https://r2.example/upload",
    expiresInSeconds: 3600,
    headers: { "Content-Type": "image/png" },
  });
  mocks.schema.mockResolvedValue({ error: null });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});

describe("Photo Graph upload URL authorization and provider", () => {
  it("rejects unauthenticated users before signing either provider", async () => {
    mocks.admin.mockResolvedValue(null);
    vi.stubEnv("PHOTO_GRAPH_MEDIA_WRITE_PROVIDER", "r2");
    expect(
      (await POST(request({ contentType: "image/png", size: 123, sha256 })))
        .status,
    ).toBe(401);
    expect(mocks.signR2).not.toHaveBeenCalled();
    expect(mocks.signSupabase).not.toHaveBeenCalled();
    expect(mocks.schema).not.toHaveBeenCalled();
  });

  it("leaves existing Supabase signing unchanged without a feature switch", async () => {
    const response = await POST(
      request({ filename: "photo.png", contentType: "image/png" }),
    );
    expect(response.status).toBe(200);
    expect((await response.json()).token).toBe("test-token");
    expect(mocks.signSupabase).toHaveBeenCalledOnce();
    expect(mocks.signR2).not.toHaveBeenCalled();
  });

  it("signs only checked, private R2 staging when explicitly configured", async () => {
    vi.stubEnv("PHOTO_GRAPH_MEDIA_WRITE_PROVIDER", "r2");
    const response = await POST(
      request({
        filename: "photo.png",
        contentType: "image/png",
        size: 123,
        sha256,
      }),
    );
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result).toMatchObject({
      storageProvider: "r2",
      bucket: "dextery-photo-graph-staging",
      headers: { "Content-Type": "image/png" },
    });
    expect(result.objectPath).toMatch(/^staging\/[0-9a-f-]+[.]png$/);
    expect(result).not.toHaveProperty("token");
    expect(mocks.signR2).toHaveBeenCalledWith({
      key: result.objectPath,
      contentType: "image/png",
      size: 123,
      sha256,
    });
    expect(mocks.signSupabase).not.toHaveBeenCalled();
    expect(mocks.schema).toHaveBeenCalledOnce();
  });

  it.each([
    { contentType: "image/png", size: 0, sha256 },
    { contentType: "image/png", size: 123, sha256: "wrong" },
    {
      contentType: "image/png",
      size: 123,
      sha256,
      storagePath: "photography-images/_pending/a.png",
    },
  ])("rejects invalid R2 uploads before signing: %j", async (body) => {
    vi.stubEnv("PHOTO_GRAPH_MEDIA_WRITE_PROVIDER", "r2");
    expect((await POST(request(body))).status).toBe(400);
    expect(mocks.signR2).not.toHaveBeenCalled();
  });
  it("fails closed if the provider schema is not installed", async () => {
    vi.stubEnv("PHOTO_GRAPH_MEDIA_WRITE_PROVIDER", "r2");
    mocks.schema.mockResolvedValueOnce({
      error: { message: "Unknown column" },
    });
    const response = await POST(
      request({ contentType: "image/png", size: 123, sha256 }),
    );
    expect(response.status).toBe(503);
    expect(mocks.signR2).not.toHaveBeenCalled();
  });
  it("resigns existing batches with their original provider across write-mode changes", async () => {
    vi.stubEnv("PHOTO_GRAPH_MEDIA_WRITE_PROVIDER", "r2");
    const legacy = await POST(
      request({
        contentType: "image/png",
        storagePath:
          "photography-images/_pending/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.png",
      }),
    );
    expect(legacy.status).toBe(200);
    expect((await legacy.json()).token).toBe("test-token");
    expect(mocks.signR2).not.toHaveBeenCalled();

    vi.stubEnv("PHOTO_GRAPH_MEDIA_WRITE_PROVIDER", "supabase");
    const r2 = await POST(
      request({
        contentType: "image/png",
        storagePath: "staging/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.png",
        size: 123,
        sha256,
      }),
    );
    expect(r2.status).toBe(200);
    expect((await r2.json()).storageProvider).toBe("r2");
    expect(mocks.signR2).toHaveBeenCalledOnce();
  });
});
