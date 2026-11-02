import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkImageRender,
  checkNeighborSnapshotRpc,
} from "../../scripts/photo-graph/doctor";

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://backend.example.test");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-only-key");
  vi.stubEnv("SUPABASE_PHOTO_GRAPH_BUCKET", "dextery.dev");
  vi.stubEnv("PHOTO_GRAPH_IMAGE_BASE_PATH", "photography-images");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("provider-aware read-only Photo Graph doctor", () => {
  it.each(["r2", null])(
    "checks %s media without retired cache headers or TTL requirements",
    async (provider) => {
      const request = vi.fn(async (url: string, init?: RequestInit) => {
        if (url.includes("/rest/v1/photo_graph_nodes?")) {
          expect(url).toContain("select=storage_path,storage_provider");
          return Response.json([
            {
              storage_path: "photography-images/1.png",
              storage_provider: provider,
            },
          ]);
        }
        expect(new Headers(init?.headers).has("Authorization")).toBe(false);
        expect(new Headers(init?.headers).has("apikey")).toBe(false);
        const root =
          provider === "r2"
            ? "https://media.dextery.dev/photo-graph/"
            : "https://backend.example.test/storage/v1/object/public/dextery.dev/";
        if (init?.method === "HEAD") {
          expect(url).toBe(`${root}photography-images/1.png`);
          return new Response(null, {
            headers: { "content-type": "image/png" },
          });
        }
        expect(url).toContain(
          provider === "r2"
            ? "https://images.dextery.dev/photo-graph/"
            : "/storage/v1/render/image/public/",
        );
        expect(url).toContain("width=96&quality=75");
        return new Response("test-image", {
          headers: {
            "content-type": "image/webp",
            "cache-control": "max-age=3600",
          },
        });
      });
      vi.stubGlobal("fetch", request);
      expect(await checkImageRender()).toMatchObject({ level: "pass" });
      expect(request).toHaveBeenCalledTimes(3);
    },
  );

  it.each([
    { status: 404, type: "image/webp", body: "not found" },
    { status: 200, type: "text/html", body: "not an image" },
    { status: 200, type: "image/webp", body: "" },
  ])(
    "rejects unhealthy transforms: $status $type",
    async ({ status, type, body }) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string, init?: RequestInit) => {
          if (url.includes("/rest/v1/"))
            return Response.json([
              {
                storage_path: "photography-images/1.png",
                storage_provider: "r2",
              },
            ]);
          if (init?.method === "HEAD")
            return new Response(null, {
              headers: { "content-type": "image/png" },
            });
          return new Response(body, {
            status,
            headers: { "content-type": type },
          });
        }),
      );
      expect(await checkImageRender()).toMatchObject({ level: "fail" });
    },
  );

  it("warns when there is no storage-backed sample", async () => {
    const request = vi.fn(async () => Response.json([]));
    vi.stubGlobal("fetch", request);
    expect(await checkImageRender()).toMatchObject({ level: "warn" });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it.each([true, false])(
    "inspects RPC discovery using GET only (available: %s)",
    async (available) => {
      const request = vi.fn(async (url: string, init?: RequestInit) => {
        expect(url).toBe("https://backend.example.test/rest/v1/");
        expect(init?.method ?? "GET").toBe("GET");
        expect(init?.body).toBeUndefined();
        return Response.json({
          paths: available
            ? { "/rpc/replace_photo_graph_neighbor_snapshot": { post: {} } }
            : {},
        });
      });
      vi.stubGlobal("fetch", request);
      expect(await checkNeighborSnapshotRpc()).toMatchObject({
        level: available ? "pass" : "fail",
      });
      expect(request).toHaveBeenCalledTimes(1);
    },
  );
});
