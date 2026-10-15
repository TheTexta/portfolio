import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isPhotoGraphR2StagingKey,
  photoGraphR2PublishedKey,
  photoGraphR2StagingKey,
  photoGraphWriteProvider,
} from "@/lib/photo-graph/r2-paths";

afterEach(() => vi.unstubAllEnvs());

const uuid = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("Photo Graph R2 path and write-mode contract", () => {
  it("keeps Supabase writes by default and rejects unknown modes", () => {
    expect(photoGraphWriteProvider()).toBe("supabase");
    expect(photoGraphWriteProvider("r2")).toBe("r2");
    expect(() => photoGraphWriteProvider("unknown")).toThrow("Invalid");
  });

  it("creates private staging keys and publishes only canonical node IDs", () => {
    const staged = photoGraphR2StagingKey(uuid, "image/png");
    expect(staged).toBe(`staging/${uuid}.png`);
    expect(isPhotoGraphR2StagingKey(staged)).toBe(true);
    expect(photoGraphR2PublishedKey("127", staged)).toBe(
      "photography-images/127.png",
    );
    expect(photoGraphR2StagingKey(uuid, "image/jpeg")).toMatch(/\.jpg$/);
    expect(photoGraphR2StagingKey(uuid, "image/webp")).toMatch(/\.webp$/);
  });

  it("rejects unexpected source keys, extensions, and configured image bases", () => {
    expect(isPhotoGraphR2StagingKey("photography-images/_pending/a.png")).toBe(
      false,
    );
    expect(isPhotoGraphR2StagingKey("staging/../private.png")).toBe(false);
    expect(() => photoGraphR2StagingKey(uuid, "text/html")).toThrow(
      "Unsupported",
    );
    expect(() =>
      photoGraphR2PublishedKey("../5", `staging/${uuid}.png`),
    ).toThrow("Invalid");
    vi.stubEnv("PHOTO_GRAPH_IMAGE_BASE_PATH", "other");
    expect(() => photoGraphR2PublishedKey("5", `staging/${uuid}.png`)).toThrow(
      "R2 delivery requires",
    );
  });
});
