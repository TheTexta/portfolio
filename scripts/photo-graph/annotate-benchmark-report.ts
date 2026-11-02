import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  BENCHMARK_METRIC_DEFINITIONS,
  labelBenchmarkNeighbor,
} from "../../lib/photo-graph/benchmark-metrics";
import judgments from "./color-benchmark-judgments-v1.json";

// Offline reporting correction only: preserve the historical run, timings,
// distances and rankings. This command never loads environment files or data
// from production, and does not pretend to rerun the historical experiment.
const outputPath = path.join(
  process.cwd(),
  "public/projects/photo-graph/color-model-benchmark-v1.json",
);

type SavedQuery = {
  id: string;
  precisionAtK: number;
  neighbors: { id: string; distance: number; judgedRelevant: boolean | null }[];
};
type SavedModel = { queries: SavedQuery[]; metrics: Record<string, number> };

async function run() {
  const report = JSON.parse(await readFile(outputPath, "utf8")) as {
    neighborsPerNode: number;
    models: SavedModel[];
    [key: string]: unknown;
  };
  const models = report.models.map((model) => {
    const queries = model.queries.map((query) => {
      const judgment = judgments.queries.find((entry) => entry.id === query.id);
      if (!judgment)
        throw new Error(`Missing judgments for query ${query.id}.`);
      const numerator = query.precisionAtK * report.neighborsPerNode;
      if (!Number.isInteger(numerator)) {
        throw new Error(
          `Cannot reconstruct an exact slot count for ${query.id}.`,
        );
      }
      return {
        ...query,
        judgedPositiveCountAtK: numerator,
        judgedSlotCount: report.neighborsPerNode,
        judgedCandidateCount:
          judgment.positiveIds.length + judgment.negativeIds.length,
        neighbors: query.neighbors.map((entry) =>
          labelBenchmarkNeighbor(entry, judgment),
        ),
      };
    });
    return {
      ...model,
      metrics: {
        ...model.metrics,
        judgedPositiveCountAtK: queries.reduce(
          (sum, query) => sum + query.judgedPositiveCountAtK,
          0,
        ),
        judgedSlotCount: queries.reduce(
          (sum, query) => sum + query.judgedSlotCount,
          0,
        ),
      },
      queries,
    };
  });
  await writeFile(
    outputPath,
    `${JSON.stringify({
      ...report,
      reportingSchemaVersion: 2,
      metricDefinitions: BENCHMARK_METRIC_DEFINITIONS,
      reportingCorrection:
        "Offline annotation from the checked-in judgments. Original generatedAt, rankings, scores and timings are preserved; the historical experiment was not rerun. Full judged-subset rankings were not saved in this historical report.",
      models,
    })}\n`,
    "utf8",
  );
  console.log("Annotated the saved benchmark without rerunning measurements.");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
