import { afterEach, describe, expect, it, vi } from "vitest";
import {
  photoGraphMediaUrl,
  photoGraphStorageProvider,
} from "@/lib/photo-graph/media-url";

afterEach(() => vi.unstubAllEnvs());

describe("Photo Graph media locations", () => {
  it("leaves legacy Supabase originals and transforms unchanged", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://api.dextery.dev");
    vi.stubEnv("SUPABASE_PHOTO_GRAPH_BUCKET", "dextery.dev");
    const reference = { storagePath: "photography-images/42.png" };
    expect(photoGraphStorageProvider(null)).toBe("supabase");
    expect(photoGraphMediaUrl(reference)).toBe(
      "https://api.dextery.dev/storage/v1/object/public/dextery.dev/photography-images/42.png",
    );
    expect(photoGraphMediaUrl(reference, { width: 96, quality: 75 })).toBe(
      "https://api.dextery.dev/storage/v1/render/image/public/dextery.dev/photography-images/42.png?width=96&quality=75",
    );
    expect(
      photoGraphMediaUrl({ ...reference, storageProvider: "supabase" }),
    ).toBe(photoGraphMediaUrl(reference));
  });

  it("builds R2 originals and project-scoped image variants without credentials", () => {
    const reference = {
      storageProvider: "r2" as const,
      storagePath: "photography-images/42.png",
    };
    expect(photoGraphMediaUrl(reference)).toBe(
      "https://media.dextery.dev/photo-graph/photography-images/42.png",
    );
    const url = new URL(
      photoGraphMediaUrl(reference, {
        width: 560,
        quality: 86,
        resize: "cover",
      })!,
    );
    expect(url.origin + url.pathname).toBe(
      "https://images.dextery.dev/photo-graph/photography-images/42.png",
    );
    expect(Object.fromEntries(url.searchParams)).toEqual({
      width: "560",
      quality: "86",
      format: "auto",
      resize: "cover",
    });
  });

  it("retains external media when there is no storage path", () => {
    expect(
      photoGraphMediaUrl({
        externalUrl: "https://elsewhere.example/photo.png",
      }),
    ).toBe("https://elsewhere.example/photo.png");
    expect(photoGraphMediaUrl({})).toBeUndefined();
  });

  it("never guesses an unknown provider or publishes pending and arbitrary keys", () => {
    expect(() => photoGraphStorageProvider("elsewhere")).toThrow("Unsupported");
    expect(() =>
      photoGraphMediaUrl({
        storageProvider: "r2",
        externalUrl: "https://elsewhere.example/a.png",
      }),
    ).toThrow("missing its key");
    for (const storagePath of [
      "photography-images/_pending/a.png",
      "photography-images/42.html",
      "photography-images/nested/42.png",
      "other/42.png",
      "photography-images/..%2F42.png",
    ]) {
      expect(() =>
        photoGraphMediaUrl({ storageProvider: "r2", storagePath }),
      ).toThrow("Invalid published");
    }
    vi.stubEnv("PHOTO_GRAPH_IMAGE_BASE_PATH", "other");
    expect(() =>
      photoGraphMediaUrl({
        storageProvider: "r2",
        storagePath: "photography-images/42.png",
      }),
    ).toThrow("R2 delivery requires");
  });
});
