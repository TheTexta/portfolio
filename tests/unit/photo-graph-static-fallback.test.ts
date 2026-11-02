import { readFile } from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildPhotoGraphPayload } from "@/lib/photo-graph/force-graph";
import {
  ensureGraphStoragePaths,
  loadGraphWithFallback,
  readStaticGraph,
} from "@/lib/photo-graph/graph-store";
import type { GraphNode } from "@/lib/photo-graph/types";

vi.mock("@/lib/photo-graph/database", () => ({
  loadPhotoGraphFromDatabase: vi.fn(async () => null),
  replacePhotoGraphGraph: vi.fn(),
}));

afterEach(() => vi.unstubAllEnvs());

describe("Photo Graph static R2 fallback", () => {
  it("resolves every available snapshot original through R2 without Supabase configuration", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("PHOTO_GRAPH_IMAGE_BASE_PATH", "photography-images");
    const snapshot = JSON.parse(
      await readFile(
        new URL("../../public/portfolioTable.json", import.meta.url),
        "utf8",
      ),
    ) as GraphNode[];
    const result = await loadGraphWithFallback();
    const { nodes } = result;
    expect(snapshot).toHaveLength(57);
    expect(nodes).toHaveLength(45);
    const ids = new Set(nodes.map((node) => node.id));
    expect(ids.has("2")).toBe(false);
    for (const node of nodes) {
      expect(node.storageProvider).toBe("r2");
      expect(node.storagePath).toBe(`photography-images/${node.id}.png`);
      expect(node.url).toBe(
        `https://media.dextery.dev/photo-graph/${node.storagePath}`,
      );
      const original = snapshot.find((entry) => String(entry.id) === node.id)!;
      expect(node.correlations).toEqual(
        Object.fromEntries(
          Object.entries(original.correlations).filter(([id]) => ids.has(id)),
        ),
      );
    }
    expect(result).toMatchObject({
      source: "static",
      databaseAvailable: false,
    });
    const payload = buildPhotoGraphPayload(result.nodes);
    expect(payload.nodes).toHaveLength(45);
    expect(
      payload.nodes.every(
        (node) =>
          node.storageProvider === "r2" &&
          node.sourceUrl?.startsWith("https://media.dextery.dev/photo-graph/"),
      ),
    ).toBe(true);
  });

  it("does not reinterpret provider-less legacy nodes outside the static snapshot", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://api.example.test");
    vi.stubEnv("SUPABASE_PHOTO_GRAPH_BUCKET", "dextery.dev");
    const nodes: GraphNode[] = [
      { id: "1", scale: 1, colour: "#808080", correlations: {} },
    ];
    ensureGraphStoragePaths(nodes);
    expect(nodes[0].storageProvider).toBeUndefined();
    expect(nodes[0].url).toBe(
      "https://api.example.test/storage/v1/object/public/dextery.dev/photography-images/1.png",
    );
  });

  it("keeps the legacy Firebase-to-Supabase importer's explicit destination", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://api.example.test");
    vi.stubEnv("SUPABASE_PHOTO_GRAPH_BUCKET", "dextery.dev");
    const nodes = await readStaticGraph("supabase");
    expect(nodes).toHaveLength(57);
    expect(
      nodes.every(
        (node) =>
          node.storageProvider === undefined &&
          node.url?.startsWith(
            "https://api.example.test/storage/v1/object/public/",
          ),
      ),
    ).toBe(true);
  });
});
