import { describe, expect, it, vi } from "vitest";

import {
  copyPhotoGraphMediaItem,
  parsePhotoGraphCopyManifest,
  type PhotoGraphCopyItem,
} from "@/scripts/photo-graph/copy-media-to-r2";

const item: PhotoGraphCopyItem = {
  id: 127,
  key: "photography-images/127.png",
  bytes: 8,
  contentType: "image/png",
};
const source = new TextEncoder().encode("png-data");

function fakeFetch(options?: {
  existing?: Uint8Array;
  loseResponse?: boolean;
}) {
  let stored = options?.existing;
  return vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const target = String(url).includes("api.cloudflare.com");
    if (!target) {
      return new Response(source.slice(), {
        headers: { "Content-Type": "image/png" },
      });
    }
    if (init?.method === "PUT") {
      stored = new Uint8Array(init.body as Uint8Array);
      if (options?.loseResponse) throw new Error("Lost response");
      return new Response("ok", { status: 200 });
    }
    return stored
      ? new Response(stored.slice(), {
          headers: {
            "Content-Type": "image/png",
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        })
      : new Response(null, { status: 404 });
  });
}

describe("non-destructive Photo Graph R2 media copy", () => {
  it("rejects pending, foreign, oversize and duplicate manifest entries", () => {
    expect(parsePhotoGraphCopyManifest([item])).toEqual([item]);
    for (const invalid of [
      { ...item, key: "photography-images/_pending/a.png" },
      { ...item, key: "photography-images/127.html" },
      { ...item, bytes: 100_000_001 },
      { ...item, contentType: "text/html" },
    ]) {
      expect(() => parsePhotoGraphCopyManifest([invalid])).toThrow();
    }
    expect(() => parsePhotoGraphCopyManifest([item, item])).toThrow(
      "duplicate",
    );
  });

  it("reads, copies, then reads back exactly matching bytes", async () => {
    const fetcher = fakeFetch();
    const result = await copyPhotoGraphMediaItem(
      item,
      "fake-bearer",
      fetcher as typeof fetch,
    );
    expect(result).toMatchObject({ key: item.key, copied: true });
    expect(
      fetcher.mock.calls.filter(([, init]) => init?.method === "PUT"),
    ).toHaveLength(1);
    expect(fetcher.mock.calls[0][0]).toContain(
      "/storage/v1/object/public/dextery.dev/",
    );
  });

  it("never overwrites existing foreign bytes and skips verified copies", async () => {
    const foreign = fakeFetch({
      existing: new TextEncoder().encode("bad-data"),
    });
    await expect(
      copyPhotoGraphMediaItem(item, "fake-bearer", foreign as typeof fetch),
    ).rejects.toThrow("refusing overwrite");
    expect(foreign.mock.calls.some(([, init]) => init?.method === "PUT")).toBe(
      false,
    );
    const matching = fakeFetch({ existing: source });
    expect(
      await copyPhotoGraphMediaItem(
        item,
        "fake-bearer",
        matching as typeof fetch,
      ),
    ).toMatchObject({ copied: false });
    expect(matching.mock.calls.some(([, init]) => init?.method === "PUT")).toBe(
      false,
    );
  });

  it("verifies an ambiguous response instead of retrying a potentially committed PUT", async () => {
    const fetcher = fakeFetch({ loseResponse: true });
    expect(
      await copyPhotoGraphMediaItem(
        item,
        "fake-bearer",
        fetcher as typeof fetch,
      ),
    ).toMatchObject({ copied: true });
    expect(
      fetcher.mock.calls.filter(([, init]) => init?.method === "PUT"),
    ).toHaveLength(1);
  });
});
