import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import fixture from "@/public/projects/photo-graph/worked-example/fixture.json";
import catalogue from "@/public/projects/photo-graph/color-features-v1.json";
import { featureFromRgb, rgbToLab } from "@/lib/photo-graph/feature-extraction";
import { measureMeanRgb } from "@/lib/photo-graph/mean-rgb";
import {
  computePhotoGraphModelDistance,
  traceDeltaE2000,
} from "@/lib/photo-graph/similarity-models";
import {
  buildExampleGraph,
  describeCandidate,
} from "@/app/write-ups/photo-graph/_components/example-data";
import type { WorkedExample } from "@/app/write-ups/photo-graph/_components/example-types";

const data = fixture as unknown as WorkedExample;
const hash = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
const publicFile = (src: string) => path.join(process.cwd(), "public", src);

describe("one frozen Photo Graph worked example", () => {
  it("declares the exact original-photo ID set, extraction policy and source provenance", async () => {
    expect(data.nodes.map((photo) => photo.id)).toEqual(
      Object.keys(catalogue.nodes).sort((a, b) => Number(a) - Number(b)),
    );
    expect(data.nodes).toHaveLength(100);
    expect(data.queryId).toBe("112");
    expect(data.candidateIds).toEqual(["27", "65"]);
    expect(data.snapshotAt).toMatch(/^2026-11-04T/);
    expect(data.config).toEqual({
      version: 2,
      model: "mean-lab-ciede2000",
      neighborsPerNode: 4,
      maxDistance: 16,
    });
    expect(hash(await readFile(data.dataset.idSource))).toBe(
      data.dataset.idSourceSha256,
    );
    expect(
      hash(await readFile(publicFile(fixture.dataset.sourceCatalogue))),
    ).toBe(fixture.dataset.sourceCatalogueSha256);
    for (const photo of fixture.nodes) {
      expect(photo.rgb).toHaveLength(3);
      expect(photo.lab).toHaveLength(3);
      expect(photo.analysis.sums).toHaveLength(3);
      expect(photo.source.url).toMatch(
        new RegExp(
          `^https://media\\.dextery\\.dev/photo-graph/photography-images/${photo.id}\\.(png|jpg)$`,
        ),
      );
      expect(photo.source.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(photo.analysis.pixelCount).toBe(
        photo.analysis.width * photo.analysis.height,
      );
      expect(
        Math.max(photo.analysis.width, photo.analysis.height),
      ).toBeLessThanOrEqual(1024);
      expect(photo.rgb).toEqual(
        photo.analysis.sums.map((sum) => sum / (photo.analysis.weightSum || 1)),
      );
      expect(photo.lab).toEqual(
        rgbToLab([...photo.rgb] as [number, number, number]).map((value) =>
          expect.closeTo(value, 12),
        ),
      );
      expect(hash(await readFile(publicFile(photo.src)))).toBe(
        photo.assetSha256,
      );
    }
  });
  it("replays exact analysis PNG bytes, means and illustrative patches for all three photographs", async () => {
    for (const id of [data.queryId, ...data.candidateIds]) {
      const photo = data.nodes.find((photo) => photo.id === id)!;
      const png = await readFile(publicFile(photo.analysis.src!));
      expect(hash(png)).toBe(photo.analysis.pngSha256);
      const { data: rgba, info } = await sharp(png)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      expect(info.width).toBe(photo.analysis.width);
      expect(info.height).toBe(photo.analysis.height);
      expect(hash(rgba)).toBe(photo.analysis.rgbaSha256);
      const measured = measureMeanRgb({ data: rgba });
      expect(measured.rgb).toEqual(photo.rgb);
      expect(measured.sums).toEqual(photo.analysis.sums);
      expect(measured.weightSum).toBe(photo.analysis.weightSum);
      const patch = photo.analysis.patch!;
      const actual: number[] = [];
      for (let y = patch.y; y < patch.y + patch.height; y++) {
        const start = (y * info.width + patch.x) * 4;
        actual.push(...rgba.subarray(start, start + patch.width * 4));
      }
      expect(actual).toEqual(patch.rgba);
    }
  });
  it("recomputes all 4,950 pair outputs without using rounded display values", () => {
    const photos = new Map(data.nodes.map((photo) => [photo.id, photo]));
    expect(data.pairs).toHaveLength(4950);
    expect(
      new Set(data.pairs.map((pair) => `${pair.source}:${pair.target}`)).size,
    ).toBe(4950);
    for (const pair of data.pairs) {
      const left = photos.get(pair.source)!;
      const right = photos.get(pair.target)!;
      const feature = (photo: typeof left) =>
        featureFromRgb(photo.rgb, photo.longSide);
      // Transcendental results vary by a few ULPs across JS runtimes.
      expect(pair.cie76).toBeCloseTo(
        computePhotoGraphModelDistance(
          feature(left),
          feature(right),
          "mean-lab-cie76",
        ),
        12,
      );
      expect(pair.ciede2000).toBeCloseTo(
        traceDeltaE2000(left.lab, right.lab).distance,
        12,
      );
    }
  });
  it("reproduces the full candidate ranking and production default topology", () => {
    const ranking = data.pairs
      .filter(
        (pair) => pair.source === data.queryId || pair.target === data.queryId,
      )
      .map((pair) => ({
        id: pair.source === data.queryId ? pair.target : pair.source,
        distance: pair.ciede2000,
      }))
      .sort((a, b) => a.distance - b.distance || Number(a.id) - Number(b.id))
      .map((row, index) => ({ ...row, rank: index + 1 }));
    expect(ranking).toEqual(data.queryRanking);
    expect(data.queryRanking).toHaveLength(99);
    expect(data.queryRanking.some((row) => row.id === data.queryId)).toBe(
      false,
    );
    const graph = buildExampleGraph(data.nodes, data.config);
    expect(graph.nominations).toEqual(
      data.defaultGraph.nominations.map((row) => ({
        ...row,
        distance: expect.closeTo(row.distance, 12),
        correlation: expect.closeTo(row.correlation, 12),
      })),
    );
    expect(graph.edges).toEqual(
      data.defaultGraph.edges.map((edge) => ({
        ...edge,
        weight: expect.closeTo(edge.weight, 12),
      })),
    );
    expect(graph.edges).toHaveLength(252);
    expect(graph.edges.every((edge) => edge.weight > 0)).toBe(true);
    const harbour = describeCandidate(data, graph, data.config, "27");
    const interior = describeCandidate(data, graph, data.config, "65");
    expect(harbour).toMatchObject({
      rank: 3,
      linked: true,
      status: "Selected",
    });
    expect(interior).toMatchObject({
      rank: 60,
      linked: false,
      weight: 0,
      status: "Beyond cutoff",
    });
    expect(harbour.weight).toBeCloseTo(1 - harbour.distance / 16, 12);
  });
  it("regenerates neighbour settings without mutating the stored descriptors or audit outputs", () => {
    const before = JSON.stringify(data);
    const changed = buildExampleGraph(data.nodes, {
      ...data.config,
      neighborsPerNode: 1,
      maxDistance: 1,
    });
    expect(changed.edges.length).toBeLessThan(data.defaultGraph.edges.length);
    expect(JSON.stringify(data)).toBe(before);
  });
});
