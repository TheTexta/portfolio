import { describe, expect, it } from "vitest";
import { assertPhotoGraphR2ImageBasePath } from "@/lib/photo-graph/config";

describe("Photo Graph R2 prefix preflight", () => {
  it("accepts the canonical prefix including the existing trailing-slash spelling", () => {
    expect(assertPhotoGraphR2ImageBasePath("photography-images")).toBe(
      "photography-images",
    );
    expect(assertPhotoGraphR2ImageBasePath("photography-images/")).toBe(
      "photography-images",
    );
  });

  it.each([
    "images",
    "photography-images/2026",
    "photography-images//",
    "/photography-images",
    "",
  ])("rejects an R2-incompatible image base path: %s", (configured) => {
    expect(() => assertPhotoGraphR2ImageBasePath(configured)).toThrow(
      "R2 delivery requires PHOTO_GRAPH_IMAGE_BASE_PATH=photography-images",
    );
  });
});
