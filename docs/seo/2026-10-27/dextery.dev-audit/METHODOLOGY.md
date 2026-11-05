# Audit methodology

- **Target:** production `https://dextery.dev`, with read-only source inspection
  in the local `portfolio` repository at commit `8c81df1` plus existing local
  documentation changes.
- **Date:** 2026-10-27 local; browser evidence may carry 2026-10-28 UTC timestamps.
- **Business type:** personal software-development / creative-technology portfolio,
  with a photography/data-visualization case study and a browser-extension product
  page. This is not assumed to be a local service business, store, or publisher.
- **Audience assumption:** personal-brand discovery, recruiters, collaborators,
  potential clients, and Grailed Plus users. Search targets and business priorities
  were not supplied, so growth recommendations are conditional on those goals.
- **Workflow:** installed Claude SEO v2.5.0, native OpenCode specialist agents,
  managed Python 3.14 runtime and its installed Chromium. No dependencies installed
  or repaired during the audit.

## Coverage and boundaries

The live sitemap enumerates three indexable HTML pages: `/portfolio`,
`/projects/photo-graph`, and `/grailed-plus`. These three pages are the complete
sitemap scope, not a sample of a claimed 500-page crawl. Public navigation and
representative legacy redirects/experience exclusions are checked separately.
`robots.txt` disallows `/api/` and `/admin`; no authenticated or administrative
crawl was requested. External project sites are not treated as portfolio pages.

Raw server HTML, available rendered/browser observations, HTTP signals, screenshots,
and local source references are distinguished. Source code explains observed
behavior; it does not prove the exact deployed commit. Existing local changes in
`AGENTS.md`, `README.md`, and `docs/photo-graph-r2-migration.md` are not audit edits.

## Evidence and measurement limits

- The managed runtime doctor reports ready, including Chromium.
- Google Search Console, GA4, Google API/CrUX, Matomo, Moz, and Bing credentials
  are not configured for these installed workflows. No sign-in or setup was
  attempted. No historical drift baseline was available.
- Public Google performance checks returned HTTP 429. Three strategy requests
  occurred across two independent worker invocations; the agentic wrapper
  automatically continued from mobile to desktop after its first 429. No further
  calls or alternative-account/backend quota bypass followed reconciliation.
  No valid Lighthouse score or real-user field LCP/INP/CLS dataset was obtained.
- Local browser timing captures are single, unthrottled observations, not mobile
  network/CPU benchmarks. Main-document paint metrics do not establish complete
  canvas/iframe readiness. Encoded resource-byte counts are bounded observations.
- A successful GET with a Googlebot or AI user-agent string proves only the tested
  response, not verified crawler access, actual Google indexing, rankings, traffic,
  or AI citation frequency.
- Optional `llms.txt`, Markdown delivery, discovery files, and WebMCP are not
  treated as requirements for ordinary Google indexing or as guaranteed ranking
  improvements. Word-count and metadata-length heuristics are not Google rules.

## Synthesis and prioritization

Recommendations combine live observations, source attribution, audience intent,
and the portfolio's editorial design constraints. The sequence is observe,
analyze root causes/dependencies, validate brand and measurement assumptions, then
produce an action plan with acceptance checks and monitoring indicators.

Severity describes the evidenced impact: **Critical** requires a demonstrated
indexing blocker or similarly severe defect, not an optional feature omission.
High-priority performance optimization does not imply a proven Core Web Vitals
failure. Numerical readiness ratings, where included, are analyst heuristics,
not Google scores or ranking predictions. Unmeasured categories remain unknown
rather than receiving a fabricated zero or passing value.

No site implementation, deployment, hosting/database/storage/policy change,
indexing submission, outreach, or media mutation was authorized or performed.
Only local report/evidence artifacts are deliverables of this audit.
