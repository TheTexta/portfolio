import { NextRequest } from "next/server";
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  admin: vi.fn(),
  info: vi.fn(),
  r2Head: vi.fn(),
}));
vi.mock("@/lib/server/admin-auth", () => ({ getAdminUser: mocks.admin }));
vi.mock("@/lib/server/photo-graph-r2", () => ({
  photoGraphR2StagedObjectStatus: mocks.r2Head,
}));
vi.mock("@/lib/server/supabase", () => ({
  getServiceRoleSupabase: () => ({
    storage: { from: () => ({ info: mocks.info }) },
  }),
}));
vi.mock("@/lib/supabase/config", () => ({
  getPhotoGraphStorageBucket: () => "test",
}));
import { POST } from "@/app/api/admin/photo-graph/upload-status/route";
const path =
  "photography-images/_pending/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.png";
const r2Path = "staging/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.png";
const r2Item = {
  storagePath: r2Path,
  storageProvider: "r2",
  sourceSize: 123,
  sourceSha256: "a".repeat(64),
  contentType: "image/png",
};
const request = (body: unknown) =>
  new NextRequest("http://localhost/api/admin/photo-graph/upload-status", {
    method: "POST",
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.admin.mockResolvedValue({ id: "admin" });
});
it("requires independent admin authorization", async () => {
  mocks.admin.mockResolvedValue(null);
  expect((await POST(request({ paths: [path] }))).status).toBe(401);
  expect(mocks.info).not.toHaveBeenCalled();
});
it.each([
  null,
  {},
  { paths: [] },
  { paths: ["photography-images/1.png"] },
  { paths: Array(101).fill(path) },
])("rejects invalid paths and bounded batches %j", async (body) => {
  expect((await POST(request(body))).status).toBe(400);
  expect(mocks.info).not.toHaveBeenCalled();
});
it("distinguishes absent originals from ambiguous failures", async () => {
  mocks.info.mockResolvedValueOnce({ error: { status: 404 } });
  expect(await (await POST(request({ paths: [path] }))).json()).toEqual({
    ok: true,
    present: [],
    missing: [path],
  });
  mocks.info.mockResolvedValueOnce({ error: { status: 401 } });
  expect((await POST(request({ paths: [path] }))).status).toBe(503);
});
it("confirms an original received despite a lost upload response", async () => {
  mocks.info.mockResolvedValueOnce({ data: { name: path }, error: null });
  expect(await (await POST(request({ paths: [path] }))).json()).toEqual({
    ok: true,
    present: [path],
    missing: [],
  });
});
it("checks the saved provider without rewriting legacy in-flight batches", async () => {
  mocks.info.mockResolvedValueOnce({ data: { name: path }, error: null });
  mocks.r2Head.mockResolvedValueOnce({
    ContentLength: 123,
    ContentType: "image/png",
    Metadata: { sourcesha256: r2Item.sourceSha256, expectedsize: "123" },
  });
  expect(
    await (
      await POST(request({ items: [{ storagePath: path }, r2Item] }))
    ).json(),
  ).toEqual({
    ok: true,
    present: [path, r2Path],
    missing: [],
  });
  expect(mocks.info).toHaveBeenCalledWith(path);
  expect(mocks.r2Head).toHaveBeenCalledWith(r2Path);
});
it("keeps a missing R2 upload recoverable, but refuses unverified or ambiguous objects", async () => {
  mocks.r2Head.mockResolvedValueOnce(null);
  expect(await (await POST(request({ items: [r2Item] }))).json()).toEqual({
    ok: true,
    present: [],
    missing: [r2Path],
  });
  mocks.r2Head.mockResolvedValueOnce({
    ContentLength: 123,
    ContentType: "image/png",
    Metadata: { sourcesha256: "wrong" },
  });
  expect((await POST(request({ items: [r2Item] }))).status).toBe(503);
  mocks.r2Head.mockRejectedValueOnce(new Error("Storage unavailable"));
  expect((await POST(request({ items: [r2Item] }))).status).toBe(503);
  expect(mocks.info).not.toHaveBeenCalled();
});
it("rejects invalid R2 metadata before using privileged clients", async () => {
  expect(
    (await POST(request({ items: [{ ...r2Item, sourceSha256: "wrong" }] })))
      .status,
  ).toBe(400);
  expect(
    (
      await POST(
        request({
          items: [{ ...r2Item, storagePath: "photography-images/1.png" }],
        }),
      )
    ).status,
  ).toBe(400);
  expect(mocks.r2Head).not.toHaveBeenCalled();
});
