export type BenchmarkJudgment = "positive" | "negative" | "unjudged";

export type BenchmarkDistance = { id: string; distance: number };
export type BenchmarkJudgments = {
  positiveIds: readonly string[];
  negativeIds: readonly string[];
};

export const BENCHMARK_METRIC_DEFINITIONS = {
  precisionAtK:
    "Positive appearances in the first k candidates after filtering the full ranking to explicitly judged positive and negative IDs, divided by k. Not full-archive precision.",
  pairwiseAgreement:
    "Fraction of explicitly positive-versus-negative candidate pairs in which the positive has a strictly smaller distance. Ties are not agreements; no complete human ranking is assumed.",
  neighbors:
    "First displayed entries from the full archive ranking, including unjudged photographs. These are separate from the judged subset used by precisionAtK.",
} as const;

export function benchmarkJudgmentFor(
  id: string,
  judgments: BenchmarkJudgments,
): BenchmarkJudgment {
  const positive = judgments.positiveIds.includes(id);
  const negative = judgments.negativeIds.includes(id);
  if (positive && negative) {
    throw new Error(`Benchmark candidate ${id} has conflicting judgments.`);
  }
  return positive ? "positive" : negative ? "negative" : "unjudged";
}

export function labelBenchmarkNeighbor(
  entry: BenchmarkDistance,
  judgments: BenchmarkJudgments,
) {
  const judgment = benchmarkJudgmentFor(entry.id, judgments);
  return {
    ...entry,
    judgment,
    // Preserve the earlier field name, with null for genuinely unknown labels.
    judgedRelevant: judgment === "unjudged" ? null : judgment === "positive",
  };
}

export function evaluateBenchmarkRanking(
  fullRanking: readonly BenchmarkDistance[],
  judgments: BenchmarkJudgments,
  k: number,
  displayCount: number,
) {
  if (!Number.isInteger(k) || k < 1) {
    throw new Error("Benchmark k must be a positive integer.");
  }
  const judgedIds = [...judgments.positiveIds, ...judgments.negativeIds];
  if (new Set(judgedIds).size !== judgedIds.length) {
    throw new Error("Benchmark judgments must be unique and disjoint.");
  }
  const distances = new Map(
    fullRanking.map((entry) => [entry.id, entry.distance]),
  );
  if (
    judgedIds.some((id) => !Number.isFinite(distances.get(id))) ||
    judgedIds.length < k ||
    judgments.positiveIds.length === 0 ||
    judgments.negativeIds.length === 0
  ) {
    throw new Error(
      "Benchmark ranking must contain every judged candidate and both label classes.",
    );
  }

  const judgedSet = new Set(judgedIds);
  const judgedNeighbors = fullRanking
    .filter((entry) => judgedSet.has(entry.id))
    .slice(0, k)
    .map((entry) => labelBenchmarkNeighbor(entry, judgments));
  const positiveCount = judgedNeighbors.filter(
    (entry) => entry.judgment === "positive",
  ).length;
  let correctlyOrderedPairCount = 0;
  for (const positiveId of judgments.positiveIds) {
    for (const negativeId of judgments.negativeIds) {
      if (distances.get(positiveId)! < distances.get(negativeId)!) {
        correctlyOrderedPairCount += 1;
      }
    }
  }
  const comparisonCount =
    judgments.positiveIds.length * judgments.negativeIds.length;

  return {
    precisionAtK: positiveCount / k,
    judgedPositiveCountAtK: positiveCount,
    judgedSlotCount: k,
    judgedCandidateCount: judgedIds.length,
    pairwiseAgreement: correctlyOrderedPairCount / comparisonCount,
    correctlyOrderedPairCount,
    comparisonCount,
    judgedNeighbors,
    neighbors: fullRanking
      .slice(0, displayCount)
      .map((entry) => labelBenchmarkNeighbor(entry, judgments)),
  };
}
