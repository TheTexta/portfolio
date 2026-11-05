import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import snapshot from "../../public/projects/grailed-plus/recorded-demo/snapshot.json";
import recording from "../../public/projects/grailed-plus/recorded-demo/recorded-comparison.json";

const base = new URL(
  "../../public/projects/grailed-plus/recorded-demo/",
  import.meta.url,
);

it("ships a checksummed, relocatable demo with local photos and their licenses", async () => {
  for (const [name, expected] of Object.entries(snapshot.files)) {
    const bytes = await readFile(new URL(name, base));
    expect(createHash("sha256").update(bytes).digest("hex"), name).toBe(
      expected,
    );
    expect(name).not.toMatch(/\.(onnx|wasm)$/);
  }
  for (const image of recording.images) {
    const bytes = await readFile(new URL("." + image.path, base));
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(image.sha256);
  }
  const html = await readFile(new URL("index.html", base), "utf8");
  expect(html).toMatch(/src="\.\/assets\/index-/);
  expect(html).toMatch(/href="\.\/assets\/index-/);
  const credits = await readFile(new URL("photo-credits.html", base), "utf8");
  expect(credits).toContain("CC BY-SA 3.0");
  expect(credits).toContain('href="./photos/source.webp"');
  expect(await readFile(new URL("LICENSE.txt", base), "utf8")).toContain(
    "MIT License",
  );
});

it("places the recording alongside the write-up's confidence-group explanation", async () => {
  const article = await readFile(
    new URL("../../app/write-ups/grailed-plus/write-up.mdx", import.meta.url),
    "utf8",
  );
  expect(article).toContain("<RecordedComparison />");
  expect(article.indexOf("<RecordedComparison />")).toBeGreaterThan(
    article.indexOf("within confidence groups"),
  );
  expect(article.indexOf("<RecordedComparison />")).toBeLessThan(
    article.indexOf("## Returning results"),
  );
  expect(article).toContain("real MobileCLIP-S1 scores");
  expect(article).toContain("not measured inference latency");
});
