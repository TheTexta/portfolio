import { describe, expect, it } from "vitest";
import { getPhotographDescription } from "@/lib/photo-graph/descriptions";

describe("provenance-bound photograph descriptions", () => {
  it("reuses the authored description for the recorded image identity", () => {
    expect(
      getPhotographDescription({
        id: "14",
        sourceUrl:
          "https://images.dextery.dev/photo-graph/photography-images/14.png?width=560",
      }),
    ).toBe("A snow-covered street lined with trees at night.");
  });

  it("does not attach a subject description to a different image or unknown node", () => {
    expect(
      getPhotographDescription({ id: "14", sourceUrl: "/new-image.jpg" }),
    ).toBeNull();
    expect(
      getPhotographDescription({ id: "unknown", sourceUrl: "/new-image.jpg" }),
    ).toBeNull();
    expect(getPhotographDescription({ id: "14" })).toBeNull();
    expect(
      getPhotographDescription({
        id: "14",
        sourceUrl:
          "https://other.example/photo-graph/photography-images/14.png",
      }),
    ).toBeNull();
  });
});
