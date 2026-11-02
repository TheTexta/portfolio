import { describe, expect, it } from "vitest";
import {
  benchmarkJudgmentFor,
  evaluateBenchmarkRanking,
  labelBenchmarkNeighbor,
} from "@/lib/photo-graph/benchmark-metrics";

const judgments = { positiveIds: ["p1", "p2"], negativeIds: ["n1", "n2"] };

describe("Photo Graph benchmark metric scope", () => {
  it("keeps the judged subset separate from actual full-archive neighbours", () => {
    const result = evaluateBenchmarkRanking(
      [
        { id: "unjudged", distance: 0 },
        { id: "n1", distance: 1 },
        { id: "p1", distance: 2 },
        { id: "p2", distance: 3 },
        { id: "n2", distance: 4 },
      ],
      judgments,
      2,
      3,
    );
    expect(result.precisionAtK).toBe(0.5);
    expect(result.judgedPositiveCountAtK).toBe(1);
    expect(result.judgedSlotCount).toBe(2);
    expect(result.judgedCandidateCount).toBe(4);
    expect(result.judgedNeighbors.map((entry) => entry.id)).toEqual([
      "n1",
      "p1",
    ]);
    expect(
      result.neighbors.map((entry) => [
        entry.id,
        entry.judgment,
        entry.judgedRelevant,
      ]),
    ).toEqual([
      ["unjudged", "unjudged", null],
      ["n1", "negative", false],
      ["p1", "positive", true],
    ]);
    // Both positive candidates beat only n2: two correctly ordered pairs of four.
    expect(result.correctlyOrderedPairCount).toBe(2);
    expect(result.comparisonCount).toBe(4);
    expect(result.pairwiseAgreement).toBe(0.5);
    expect(
      JSON.parse(JSON.stringify(result)).neighbors[0].judgedRelevant,
    ).toBeNull();
  });

  it("does not count tied positive/negative distances as correct ordering", () => {
    const result = evaluateBenchmarkRanking(
      [
        { id: "p1", distance: 1 },
        { id: "n1", distance: 1 },
      ],
      { positiveIds: ["p1"], negativeIds: ["n1"] },
      1,
      2,
    );
    expect(result.pairwiseAgreement).toBe(0);
  });

  it("does not turn unjudged photographs into negative labels", () => {
    expect(benchmarkJudgmentFor("other", judgments)).toBe("unjudged");
    expect(
      labelBenchmarkNeighbor({ id: "other", distance: 0 }, judgments),
    ).toEqual({
      id: "other",
      distance: 0,
      judgment: "unjudged",
      judgedRelevant: null,
    });
  });

  it("rejects incomplete or contradictory judgments instead of silently changing the denominator", () => {
    expect(() =>
      evaluateBenchmarkRanking([{ id: "p1", distance: 1 }], judgments, 2, 2),
    ).toThrow("every judged candidate");
    expect(() =>
      evaluateBenchmarkRanking(
        [{ id: "p1", distance: 1 }],
        { positiveIds: ["p1"], negativeIds: ["p1"] },
        1,
        1,
      ),
    ).toThrow("unique and disjoint");
  });
});
