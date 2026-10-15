import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildOptimizedImageCandidates,
  pickAllowedWidth,
} from "@/app/components/projects/photo-graph/imageOptimizer";

afterEach(() => vi.unstubAllEnvs());

describe("Photo Graph image candidates", () => {
  it("preserves legacy optimized-then-raw Supabase URLs", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://api.dextery.dev");
    const original =
      "https://api.dextery.dev/storage/v1/object/public/dextery.dev/photography-images/1.png";
    expect(
      buildOptimizedImageCandidates("photography-images/1.png", original, 128),
    ).toEqual([
      "https://api.dextery.dev/storage/v1/render/image/public/dextery.dev/photography-images/1.png?width=128&quality=60",
      original,
    ]);
  });

  it("uses only validated R2 transformations and original bytes", () => {
    const original =
      "https://media.dextery.dev/photo-graph/photography-images/2.webp";
    const candidates = buildOptimizedImageCandidates(
      "photography-images/2.webp",
      "https://unexpected.example/unsafe.png",
      128,
      undefined,
      "r2",
    );
    expect(candidates).toEqual([
      "https://images.dextery.dev/photo-graph/photography-images/2.webp?width=128&quality=60&format=auto",
      original,
    ]);
    expect(pickAllowedWidth(129)).toBe(144);
  });

  it("never falls back to an unverified URL for a private R2 path", () => {
    expect(
      buildOptimizedImageCandidates(
        "photography-images/_pending/a.png",
        "https://elsewhere.example/a.png",
        128,
        undefined,
        "r2",
      ),
    ).toEqual([]);
  });
});
