import { NextRequest } from "next/server";
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ admin: vi.fn(), info: vi.fn() }));
vi.mock("@/lib/server/admin-auth", () => ({ getAdminUser: mocks.admin }));
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
