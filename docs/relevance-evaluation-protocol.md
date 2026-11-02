# Future relevance assessment (ML03, ENG08)

The saved Photo Graph comparison and Grailed's ranking tests establish different
things. Neither is a content-independent buyer/retrieval relevance study. This
protocol prepares that work without fabricating labels or new results.

## Freeze before assessment

Record source revision and dirty state, feature/model hashes and versions,
archive/listing snapshot checksum, query inclusion/exclusion rules, k, candidate
limits, confidence partitions, tie-breaking, timeouts and ranking configuration.
Use development queries to choose parameters. Keep assessment queries and their
aliases out of that choice; do not select a winner and then call its selection
set a holdout. Record near-duplicate definitions, exclusions and remaining risk.

For Grailed, compare metadata-only with metadata-plus-image ranking on the same
dated, permission-appropriate listing snapshots. Label fixture data separately;
neither animated demo scores nor confidence-policy tests measure buyer utility.
Do not scrape protected sources or perform paid queries merely to populate a
portfolio statistic. For Photo Graph, freeze the archive and compared similarity
configurations, including their different distance thresholds.

## Candidate and judgment policy

For each **held-out** query, pool the union of actual full-archive top-k results
from every compared configuration. Deduplicate candidates by stable ID/content
policy. Randomize their presentation deterministically and conceal the supplying
configuration and rank from judges. Save the seed and a private mapping so the
procedure can be reproduced. Do not use only the existing hand-selected positive
and negative subset, then label its metric as full-archive precision.

Write the relevance criterion before annotation (colour relationship versus
subject/product equivalence are not interchangeable). Collect independent judges
where feasible, retaining individual labels, uncertainty and disagreement before
any adjudication. Unknown, negative and positive remain distinct. Never silently
count an unjudged candidate as irrelevant or remove a difficult query afterward.

## Report without changing the denominator

Publish query/candidate counts, judged coverage, per-query positive slots and
denominators, macro averages, differences and disagreement. Name the exact
inclusion policy for unknown judgments. Preserve both full retrieval ranks and
any judged-subset diagnostic. Small-sample uncertainty and selection limitations
remain explicit; do not claim statistical significance from one extra positive
slot. Keep exploratory, selection, independent assessment and historical practice
results separately named and dated.

Latency is a separate measurement: name hardware, browser/runtime, warmup,
repetitions, cache states and timed stages. Report distributions. Graph generation
duration, a configured refinement budget, image download time and interaction
readiness are not interchangeable. The browser procedure is in
`docs/browser-performance-baseline.md`.

## Required final record

- Data manifest with SHA-256 checksums, provenance and permitted retention.
- Frozen development/assessment membership and alias/near-duplicate policy.
- Configuration, candidate-pool seed, label schema, raw judgments and adjudication.
- Reproduction command, per-query results, aggregate counts and limitations.
- An explicit status: `prepared`, `collecting`, or `evaluated` with actual evidence.

Current status: **prepared; no new independent relevance labels or results have
been collected**. Existing historical artifacts are not overwritten.
