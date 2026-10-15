import { afterEach, describe, expect, it, vi } from "vitest";
import { buildPhotoGraphPayload } from "@/lib/photo-graph/force-graph";
import { photoGraphMediaUrl } from "@/lib/photo-graph/media-url";
import type { GraphNode } from "@/lib/photo-graph/types";

afterEach(() => vi.unstubAllEnvs());

describe("public Photo Graph mixed-provider payload", () => {
  it("adds only a compact R2 discriminator and keeps legacy links intact", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://api.dextery.dev");
    const legacy: GraphNode = {
      id: "1",
      scale: 1,
      colour: "#808080",
      correlations: { "2": 0.7 },
      storagePath: "photography-images/1.png",
      url: photoGraphMediaUrl({ storagePath: "photography-images/1.png" }),
    };
    const r2: GraphNode = {
      id: "2",
      scale: 1,
      colour: "#808080",
      correlations: { "1": 0.7 },
      storagePath: "photography-images/2.webp",
      storageProvider: "r2",
      url: photoGraphMediaUrl({
        storagePath: "photography-images/2.webp",
        storageProvider: "r2",
      }),
    };

    const payload = buildPhotoGraphPayload([legacy, r2]);
    const legacyNode = payload.nodes.find((node) => node.id === "1");
    const r2Node = payload.nodes.find((node) => node.id === "2");
    expect(legacyNode?.sourceUrl).toContain(
      "/storage/v1/object/public/dextery.dev/photography-images/1.png",
    );
    expect(legacyNode).not.toHaveProperty("storageProvider");
    expect(r2Node).toMatchObject({
      storageProvider: "r2",
      storagePath: "photography-images/2.webp",
      sourceUrl:
        "https://media.dextery.dev/photo-graph/photography-images/2.webp",
    });
    expect(payload.links).toHaveLength(1);
  });
});
