"use client";

import { useState } from "react";

import { EditorialContainer } from "@/app/components/ui/editorial";

type ModelMetrics = {
  precisionAtK: number;
  pairwiseAgreement: number;
  pairwiseDurationMs: number;
  graphDurationMs: number;
  pairCount: number;
  edgeCount: number;
  density: number;
  components: number;
  isolates: number;
};

type QueryResult = {
  id: string;
  label: string;
  precisionAtK: number;
  pairwiseAgreement: number;
  neighbors: Array<{
    id: string;
    distance: number;
    judgedRelevant: boolean;
  }>;
};

type BenchmarkReport = {
  version: 1;
  generatedAt: string;
  nodeCount: number;
  neighborsPerNode: number;
  judgmentScope: string;
  models: Array<{
    id: string;
    label: string;
    metrics: ModelMetrics;
    queries: QueryResult[];
  }>;
};

type ComparisonProps = {
  report: BenchmarkReport;
  queries: Array<{ id: string; label: string; imageUrl: string }>;
  imageUrls: Record<string, string>;
};

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatDistance(value: number) {
  if (value >= 10) return value.toFixed(1);
  if (value >= 1) return value.toFixed(2);
  return value.toFixed(3);
}

function formatDuration(value: number) {
  return value >= 100 ? `${Math.round(value)} ms` : `${value.toFixed(1)} ms`;
}

function formatBenchmarkDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

export default function PhotoGraphModelComparison({
  report,
  queries,
  imageUrls,
}: ComparisonProps) {
  const [activeQueryId, setActiveQueryId] = useState(queries[0]?.id ?? "");
  const activeQuery =
    queries.find((query) => query.id === activeQueryId) ?? queries[0];
  const selectedModel = report.models.find(
    (model) => model.id === "mean-lab-ciede2000",
  );
  const highestPrecision = Math.max(
    ...report.models.map((model) => model.metrics.precisionAtK),
  );

  return (
    <EditorialContainer
      as="section"
      id="colour-model-study"
      className="pt-16 pb-16 sm:pt-24 lg:max-w-448 lg:pb-24"
      aria-labelledby="colour-model-study-heading"
    >
      <div className="editorial-rule grid gap-8 border-t py-8 lg:grid-cols-12 lg:gap-6">
        <p className="text-[0.6875rem] font-semibold tracking-[0.2em] uppercase opacity-55 lg:col-span-2">
          Model selection
        </p>
        <div className="lg:col-span-4">
          <h2
            id="colour-model-study-heading"
            className="font-display max-w-xl text-4xl leading-[0.95] font-medium tracking-normal sm:text-5xl"
          >
            Browsing photographs by colour.
          </h2>
        </div>
        <div className="grid gap-5 text-sm leading-6 lg:col-span-6 lg:grid-cols-2">
          <p>
            Photo archives are usually organised by time, place, or subject.
            This experiment asks whether colour can offer another route through
            the work: moving from one photograph to another through light,
            tone, and palette.
          </p>
          <p>
            An initial CIE76 graph was visually dense yet still split natural
            neighbours apart. I tested five models against seven reviewed query
            sets; Mean LAB with CIEDE2000 gave the strongest result using the
            existing image features, so it drives the live graph.
          </p>
        </div>
      </div>

      <dl className="editorial-rule grid border-y sm:grid-cols-3">
        <div className="py-4 sm:pr-4">
          <dt className="text-[0.625rem] tracking-[0.16em] uppercase opacity-55">
            Reviewed set
          </dt>
          <dd className="mt-1 text-sm font-semibold">
            {report.nodeCount} photographs / {queries.length} queries
          </dd>
        </div>
        <div className="border-t border-[rgb(var(--color-rule))] py-4 sm:border-t-0 sm:border-l sm:px-4">
          <dt className="text-[0.625rem] tracking-[0.16em] uppercase opacity-55">
            Selected model
          </dt>
          <dd className="mt-1 text-sm font-semibold">Mean LAB / CIEDE2000</dd>
        </div>
        <div className="border-t border-[rgb(var(--color-rule))] py-4 sm:border-t-0 sm:border-l sm:pl-4">
          <dt className="text-[0.625rem] tracking-[0.16em] uppercase opacity-55">
            Reviewed top four
          </dt>
          <dd className="mt-1 text-sm font-semibold">
            {selectedModel
              ? `${formatPercent(selectedModel.metrics.precisionAtK)} relevant / ${selectedModel.metrics.edgeCount} edges / ${selectedModel.metrics.isolates} isolates`
              : `${report.neighborsPerNode} neighbours per photograph`}
          </dd>
        </div>
      </dl>

      <section
        className="editorial-rule border-b py-6"
        aria-labelledby="query-heading"
      >
          <div className="mb-4 flex items-baseline justify-between gap-4">
            <h3 id="query-heading" className="text-sm font-semibold">
              Select a query photograph
            </h3>
            <p className="text-xs opacity-55">Human-reviewed affinity set</p>
          </div>
          <div className="border-rule bg-canvas grid grid-cols-2 border-t border-l sm:grid-cols-4 xl:grid-cols-[repeat(auto-fit,minmax(15.5rem,1fr))]">
            {queries.map((query, index) => {
              const active = query.id === activeQuery?.id;
              return (
                <button
                  key={query.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setActiveQueryId(query.id)}
                  className={`group border-rule bg-canvas grid min-h-20 cursor-pointer grid-cols-[4.5rem_1fr] items-stretch border-r border-b text-left transition-colors outline-none focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-[rgb(var(--color-focus))] ${
                    active ? "bg-ink text-canvas" : "hover:bg-surface"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- Supabase render URLs are already transformed for this comparison tool. */}
                  <img
                    src={query.imageUrl}
                    alt=""
                    width={144}
                    height={144}
                    className="h-20 w-18 object-cover grayscale transition-[filter] duration-200 group-hover:grayscale-0"
                  />
                  <span className="flex min-w-0 flex-col justify-between p-2.5">
                    <span className="text-[0.625rem] tracking-[0.16em] uppercase opacity-55">
                      Q{String(index + 1).padStart(2, "0")} / ID {query.id}
                    </span>
                    <span className="text-xs leading-4 font-semibold">
                      {query.label}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
      </section>

      <section className="py-8" aria-labelledby="comparison-heading">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[0.6875rem] tracking-[0.18em] uppercase opacity-55">
                Active query / ID {activeQuery?.id}
              </p>
              <h3 id="comparison-heading" className="mt-1 text-2xl font-semibold">
                {activeQuery?.label}
              </h3>
            </div>
            <p className="max-w-xl text-xs leading-5 opacity-60">
              “Relevant” marks a reviewed match. P@4 is the share of the first
              four results judged relevant; pair agreement measures how closely
              a model follows the reviewed ranking. Unmarked results are
              unjudged, not automatically wrong.
            </p>
          </div>

          <div className="grid gap-px bg-[rgb(var(--color-rule))] sm:grid-cols-2 xl:grid-cols-5">
            {report.models.map((model, modelIndex) => {
              const query = model.queries.find(
                (entry) => entry.id === activeQuery?.id,
              );
              const isHighestPrecision =
                model.metrics.precisionAtK === highestPrecision;

              return (
                <article key={model.id} className="bg-canvas min-w-0 p-3">
                  <header className="flex min-h-16 items-start justify-between gap-3">
                    <div>
                      <p className="text-[0.625rem] tracking-[0.18em] uppercase opacity-50">
                        Model {String(modelIndex + 1).padStart(2, "0")}
                      </p>
                      <h4 className="mt-1 max-w-52 text-sm leading-5 font-semibold">
                        {model.label}
                      </h4>
                    </div>
                    {isHighestPrecision && (
                      <span className="border-ink border px-1.5 py-1 text-[0.5625rem] leading-none font-semibold tracking-[0.12em] uppercase">
                        Best reviewed P@4
                      </span>
                    )}
                  </header>

                  <div className="bg-surface relative mt-2 aspect-4/3 overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element -- Supabase render URLs are already transformed for this comparison tool. */}
                    <img
                      src={activeQuery?.imageUrl}
                      alt={`Query ${activeQuery?.id}: ${activeQuery?.label}`}
                      width={560}
                      height={420}
                      className="h-full w-full object-cover"
                    />
                    <span className="bg-ink text-canvas absolute bottom-0 left-0 px-2 py-1 text-[0.625rem] font-semibold tracking-[0.14em] uppercase">
                      Query / {activeQuery?.id}
                    </span>
                  </div>

                  <ol className="mt-px grid grid-cols-2 gap-px bg-[rgb(var(--color-rule))]">
                    {query?.neighbors.map((neighbor, index) => (
                      <li key={neighbor.id} className="bg-canvas">
                        <figure className="bg-surface relative aspect-square overflow-hidden">
                          {/* eslint-disable-next-line @next/next/no-img-element -- Supabase render URLs are already transformed for this comparison tool. */}
                          <img
                            src={imageUrls[neighbor.id]}
                            alt={`Rank ${index + 1}, photo ${neighbor.id}`}
                            width={280}
                            height={280}
                            className="h-full w-full object-cover"
                          />
                          <figcaption className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-[rgb(var(--color-canvas)/0.9)] px-1.5 py-1 text-[0.625rem]">
                            <span className="font-semibold">
                              {index + 1}. ID {neighbor.id}
                            </span>
                            <span className="tabular-nums opacity-65">
                              {formatDistance(neighbor.distance)}
                            </span>
                          </figcaption>
                          {neighbor.judgedRelevant && (
                            <span className="bg-ink text-canvas absolute top-0 right-0 px-1.5 py-1 text-[0.5rem] font-semibold tracking-widest uppercase">
                              Relevant
                            </span>
                          )}
                        </figure>
                      </li>
                    ))}
                  </ol>

                  <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-[rgb(var(--color-rule))] pt-3 text-xs">
                    <div>
                      <dt className="text-[0.5625rem] tracking-[0.14em] uppercase opacity-50">
                        Relevant in top four
                      </dt>
                      <dd className="mt-0.5 text-lg font-semibold">
                        {formatPercent(model.metrics.precisionAtK)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[0.5625rem] tracking-[0.14em] uppercase opacity-50">
                        Ranking agreement
                      </dt>
                      <dd className="mt-0.5 text-lg font-semibold">
                        {formatPercent(model.metrics.pairwiseAgreement)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[0.5625rem] tracking-[0.14em] uppercase opacity-50">
                        Graph
                      </dt>
                      <dd className="mt-0.5 tabular-nums">
                        {model.metrics.edgeCount} edges / {model.metrics.components} component
                        {model.metrics.components === 1 ? "" : "s"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[0.5625rem] tracking-[0.14em] uppercase opacity-50">
                        Build time
                      </dt>
                      <dd className="mt-0.5 tabular-nums">
                        {formatDuration(model.metrics.graphDurationMs)}
                      </dd>
                    </div>
                  </dl>
                </article>
              );
            })}
          </div>
      </section>

      <section
        className="editorial-rule grid gap-4 border-t pt-5 text-xs leading-5 opacity-65 md:grid-cols-2"
        aria-label="Benchmark notes"
      >
        <p>{report.judgmentScope}</p>
        <p className="md:text-right">
          Exact all-pairs benchmark / {report.models[0]?.metrics.pairCount.toLocaleString("en-GB")} pairs / generated {formatBenchmarkDate(report.generatedAt)}
        </p>
      </section>

      <section
        className="editorial-rule mt-12 border-t py-8 sm:mt-16 sm:py-12"
        aria-labelledby="project-readout-heading"
      >
        <div className="grid gap-8 lg:grid-cols-12 lg:gap-6">
          <p className="text-[0.6875rem] font-semibold tracking-[0.2em] uppercase opacity-55 lg:col-span-2">
            Project readout
          </p>
          <div className="lg:col-span-4">
            <h2
              id="project-readout-heading"
              className="font-display max-w-xl text-4xl leading-[0.95] font-medium tracking-normal sm:text-5xl"
            >
              A different way through the archive.
            </h2>
          </div>
          <div className="max-w-2xl text-sm leading-6 lg:col-span-6">
            <p>
              The graph does not try to identify what a photograph depicts.
              Instead, it turns {report.nodeCount} photographs into a field of
              visual neighbours, then tests that field against {queries.length}
              {" "}deliberately different reference images before anyone is
              asked to browse it.
            </p>
          </div>
        </div>

        <ol className="border-rule mt-8 grid border-t border-l sm:mt-12 sm:grid-cols-3">
          <li className="border-rule min-h-40 border-r border-b p-4">
            <p className="text-[0.625rem] tracking-[0.16em] uppercase opacity-55">
              01 / Index
            </p>
            <h3 className="mt-5 text-base font-semibold">Photograph set</h3>
            <p className="mt-2 max-w-xs text-sm leading-6 opacity-65">
              The archive remains image-first. A feature pass records colour
              signals for every photograph, while the original image stays at
              the centre of the experience.
            </p>
          </li>
          <li className="border-rule min-h-40 border-r border-b p-4">
            <p className="text-[0.625rem] tracking-[0.16em] uppercase opacity-55">
              02 / Review
            </p>
            <h3 className="mt-5 text-base font-semibold">Similarity test</h3>
            <p className="mt-2 max-w-xs text-sm leading-6 opacity-65">
              Seven query images define the kind of visual relationship worth
              preserving. Five colour models are checked against those judgments
              instead of assuming numerical closeness matches the eye.
            </p>
          </li>
          <li className="border-rule min-h-40 border-r border-b p-4">
            <p className="text-[0.625rem] tracking-[0.16em] uppercase opacity-55">
              03 / Browse
            </p>
            <h3 className="mt-5 text-base font-semibold">Living graph</h3>
            <p className="mt-2 max-w-xs text-sm leading-6 opacity-65">
              The selected model becomes a force-directed gallery. It makes
              colour clusters and surprising near-neighbours available to browse
              as a field, rather than a fixed list of results.
            </p>
          </li>
        </ol>
      </section>
    </EditorialContainer>
  );
}