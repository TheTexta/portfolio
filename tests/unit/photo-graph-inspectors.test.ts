import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { imageSize } from "image-size";
import { describe, expect, it } from "vitest";
import fixture from "@/public/projects/photo-graph/worked-example/fixture.json";
import ComparisonDemo from "@/app/write-ups/photo-graph/_components/comparison-demo";
import NeighboursDemo from "@/app/write-ups/photo-graph/_components/neighbours-demo";
import { ExampleProvider } from "@/app/write-ups/photo-graph/_components/example-context";
import {
  buildExampleGraph,
  describeCandidate,
  rankExampleCandidates,
  type ExampleDataset,
} from "@/app/write-ups/photo-graph/_components/example-data";
import { settleExampleLayout } from "@/app/write-ups/photo-graph/_components/layout-engine";

const data = fixture as unknown as ExampleDataset;
describe("decision-led Photo Graph inspectors", () => {
  it("ranks alternative queries with the production distance, self-exclusion and deterministic ties", () => {
    expect(rankExampleCandidates(data.nodes, data.queryId)).toEqual(
      data.queryRanking,
    );
    const ranking = rankExampleCandidates(data.nodes, "27");
    expect(ranking).toHaveLength(99);
    expect(ranking.some((row) => row.id === "27")).toBe(false);
    const config = { ...data.config, neighborsPerNode: 99, maxDistance: 100 };
    const graph = buildExampleGraph(data.nodes, config);
    const nominated = graph.nominations.filter((row) => row.sourceId === "27");
    expect(nominated.map((row) => row.targetId)).toEqual(
      ranking.map((row) => row.id),
    );
    const relation = describeCandidate(
      data,
      graph,
      config,
      "112",
      "27",
      ranking,
    );
    expect(relation.forward).toBe(true);
    expect(relation.distance).toBeCloseTo(15.466751538016895, 12);
  });

  it("server-renders two complete inspectors with arithmetic optional and all 100 nodes/252 links", () => {
    const positions = settleExampleLayout(data.nodes, data.defaultGraph.edges);
    const markup = renderToStaticMarkup(
      createElement(
        ExampleProvider,
        { data, positions },
        createElement(ComparisonDemo),
        createElement(NeighboursDemo),
      ),
    );
    expect(markup.match(/data-demo=/g)).toHaveLength(2);
    expect(markup).toContain('data-demo="comparison"');
    expect(markup).toContain('data-demo="rules"');
    expect(markup).toContain('data-photo-id="112"');
    expect(markup).toContain('data-photo-id="75"');
    expect(markup).toContain("5.933");
    expect(markup.match(/data-node-id=/g)).toHaveLength(100);
    expect(markup.match(/data-edge-source=/g)).toHaveLength(252);
    expect(markup).toContain("Inspect the arithmetic");
    expect(markup).not.toMatch(/data-playback|Pause|Replay|NaN/);
  });

  it("keeps five engineering sections, the real graph and two supporting demos", async () => {
    const article = await readFile(
      new URL("../../app/write-ups/photo-graph/write-up.mdx", import.meta.url),
      "utf8",
    );
    expect(article.match(/^## /gm)).toHaveLength(5);
    expect(article.indexOf("<ProjectPreview")).toBeLessThan(
      article.indexOf("<ComparisonDemo"),
    );
    expect(article).toContain("<NeighboursDemo");
    expect(article).not.toMatch(
      /<PhotographDemo|<VectorsDemo|<LayoutDemo|A vector is an ordered|first figure deliberately|expanded default figure/,
    );
    expect(article).toContain("revision mismatch");
    expect(article).toContain("database transaction");
    expect(article).toContain("recovery journal");
    expect(article).toContain("held-out review");
  });

  it("grounds the project in the bedroom photo wall without claiming complementary-colour links are implemented", async () => {
    const article = await readFile(
      new URL("../../app/write-ups/photo-graph/write-up.mdx", import.meta.url),
      "utf8",
    );
    expect(article).toContain("printed photographs on my bedroom wall");
    expect(article).toContain(
      "Complementary colours worked well at the borders",
    );
    expect(article).toContain("The digital version starts with similar-colour");
    expect(article).toContain(
      'src="/projects/photo-graph/write-up/bedroom-wall.webp"',
    );
    expect(article.indexOf("bedroom-wall.webp")).toBeGreaterThan(
      article.indexOf("<ProjectPreview"),
    );
  });

  it("uses the supplied replacement wall photograph without changing its aspect ratio", async () => {
    const directory = new URL(
      "../../public/projects/photo-graph/write-up/",
      import.meta.url,
    );
    const manifest = JSON.parse(
      await readFile(new URL("wall-source.json", directory), "utf8"),
    );
    const bytes = await readFile(new URL(manifest.asset, directory));
    expect(manifest.sourceFilename).toBe("IMG_0708.jpeg");
    expect(manifest.sourceSha256).toBe(
      "e17e344e69bc9d05bc0c989be045abd39e5274f50974edc6c83713e5e1d00ded",
    );
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(
      manifest.assetSha256,
    );
    expect(imageSize(bytes)).toMatchObject({
      width: 2000,
      height: 1500,
      type: "webp",
    });
  });
});
