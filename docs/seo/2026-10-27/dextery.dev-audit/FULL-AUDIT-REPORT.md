# SEO audit — dextery.dev

**2026-10-27 · Personal software-development / creative-technology portfolio**

## Executive summary

**The indexing foundation is strong. The useful next work is accessibility,
reliable product proof, lighter Photo Graph loading, and clearer explanation of
existing work—not a generic SEO rewrite.** No confirmed critical indexing blocker
was found across the three canonical public pages.

**Provisional observed SEO readiness: 86/100, covering 90% of the workflow's
weighted rubric.** Performance remains unscored because no valid Lighthouse or
real-user CWV dataset was obtained. This normalized editorial/checklist score is
not a complete health measurement, Google score, ranking prediction or proof of
index inclusion. The high-priority usability findings matter more than this number.

| Finding                                                              | Priority / certainty                                                  | Best next step                                                                     |
| -------------------------------------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Keyboard focus disappears on several shared links and query controls | High, confirmed live                                                  | Restore a visible focus style; retain the monochrome design                        |
| Grailed Plus's demo reaches its unavailable state                    | High investigation, observed repeatedly; cause/persistence unverified | Diagnose the separate demo origin/ready handshake; provide useful fallback proof   |
| Photo Graph performs substantial initial image work                  | High optimization, measured local sample                              | Defer/resize below-fold comparison imagery before considering larger graph changes |
| Benchmark labels omit judged-candidate and aggregate-query scope     | Medium, source and public text confirmed                              | Correct definitions, not historical numbers or the model                           |
| Dexter's precise contribution is less explicit than the work itself  | Medium, content observation                                           | Add short, fact-checked contribution context from the shared catalog               |

Additional medium work: reduce unnecessary font preload/transfer and separately
repair the already-documented legacy graph fallback. The fallback is a source-only
resilience risk, not a reproduced live image outage.

### Quick wins, subject to separate implementation approval

1. Restore explicit visible focus styling on affected controls.
2. Correct P@4 and seven-query-average labels in the existing benchmark readout.
3. Add a concise truthful role/contribution line; do not publish internal `TBD`s.
4. Lazy-load below-fold comparison images while preserving dimensions.
5. Describe Grailed Plus as a Chrome extension in its existing product/snippet copy.

## Scope and confidence

Reviewed live server HTML, browser rendering, public HTTP signals and local source
at commit `8c81df1` plus existing documentation changes. The sitemap contains:

| Canonical page                             | Ordinary / Googlebot / smartphone status | Indexing signals                                                  |
| ------------------------------------------ | ---------------------------------------- | ----------------------------------------------------------------- |
| `https://dextery.dev/portfolio`            | 200 / 200 / 200                          | Self-canonical; meaningful initial HTML; no prohibitive directive |
| `https://dextery.dev/projects/photo-graph` | 200 / 200 / 200                          | Self-canonical; readable case-study/benchmark content             |
| `https://dextery.dev/grailed-plus`         | 200 / 200 / 200                          | Self-canonical; product/feature/install copy outside its demos    |

All three sitemap pages were covered; this is not a claimed 500-page crawl.
Desktop 1440×900 and mobile 390×844 rendering were reviewed; a separate content
capture used an actual 500px viewport. Experiences intentionally retain noindex.
Admin/API paths were excluded from deliberate crawling.

Assumed audiences are recruiters, collaborators, prospective clients and extension
users. No target-query set or business priority was supplied. Conversion-oriented
recommendations are conditional if artistic exploration is the primary goal.

See [METHODOLOGY.md](METHODOLOGY.md) and [EVIDENCE.md](EVIDENCE.md) for measurement
conditions, retained evidence and raw working-artifact location.

## Scorecard

| Rubric category          | Weight | Scoped heuristic | Interpretation                                                      |
| ------------------------ | -----: | ---------------: | ------------------------------------------------------------------- |
| Technical SEO            |    22% |               96 | Public indexing/redirect checks; not actual index coverage          |
| Content Quality          |    23% |               76 | Original evidence; improve contribution and metric definitions      |
| On-Page SEO              |    20% |               87 | Unique metadata, headings and readable HTML; product clarity polish |
| Schema / Structured Data |    10% |               92 | Six blocks parse, references resolve; optional minor refinements    |
| Performance / CWV        |    10% |       Not scored | API 429; bounded unthrottled browser observations only              |
| AI Search Readiness      |    10% |               82 | Qualitative content/entity readiness, supported by access checks    |
| Images                   |     5% |               75 | Good formats/layout/alt baseline; avoidable initial image work      |

Observed weighted contribution is 77.15 points of 90 available; `77.15 / 0.90`
rounds to **86**. Unknown performance is not assigned zero or a fabricated pass.
The GEO score is used for the AI category; the shallow homepage Agent-UX naming
score is not averaged in as proof of task success. Supplemental visual/SXO and
backlink findings are not invented rubric weights or independent ranking scores.

## 1. Technical SEO and discovery

**154 scoped assertions passed; zero failed.** Exactly one title, description and
canonical per public page; ordinary/Googlebot/smartphone metadata and normalized
main text agree. H1, language and responsive viewport signals are present. Raw
pages are not empty JavaScript shells. `use client` is not itself a CSR-only defect.

The sitemap is well-formed XML with three unique canonical URLs and seven image
references to five available posters. No missing intended indexable HTML page or
orphan was identified. All dates are `2026-10-06`; reviewed content history supports
those dates. Do not replace them merely because media storage changed later.

`robots.txt` allows public pages and excludes `/api/` and `/admin`. Both experience
URLs are crawlable with raw `noindex, nofollow`, correctly omitted from the sitemap.
Known legacy public routes permanently redirect; the removed preview returns 404.
HTTPS/security-header checks passed in their reviewed subset.

**Low:** `http://www.dextery.dev/` takes three permanent redirects to `/portfolio`;
HTTP/non-www and HTTPS/www root variants take two. Destinations and query strings
remain correct. Optional consolidation is hosting work requiring separate approval,
not a reason to move the homepage or replace valid 308s with 301s.

**Medium, source-only:** fallback graph loading still normalizes the old static
snapshot to retired Supabase media (`lib/photo-graph/graph-store.ts:244-294`,
`lib/photo-graph/media-url.ts:25-53`). This is already documented. Repair/test it
separately; no storage restore, deletion or provider migration is part of this audit.

Evidence: [technical findings](findings/technical.md),
[sitemap findings](findings/sitemap.md), `evidence/technical-analysis.json`.

## 2. Accessibility and mobile experience

### High — invisible keyboard focus

Live computed focus styles show `outline: ... none 2px`, with no compensating
underline/shadow, on several shared links and Photo Graph query buttons. Query
selection still works with Enter, making the invisible focus location a real
usability defect rather than a disabled control. Verified controls fail the visible
focus requirement; this is not a full-site WCAG certification.

Source: `app/components/ui/editorial.tsx:236-237,305-311`,
`app/components/ui/header-directory.tsx:19-20`,
`app/projects/photo-graph/model-comparison/photo-graph-model-comparison.tsx:165-170`.
Restore a visible outline style, not only width/color, and regression-test links,
actions and buttons across both themes.

All six page/viewports returned 200, primary headings/text were visible, and no
horizontal document overflow or broken first-party image was observed. Desktop
side-card clipping is the intended project rail. Reduced-motion checks were positive
in their sampled scope. Header hit areas are 28px high: comfort can improve, but
this is not asserted to fail the 24px WCAG AA target minimum.

Evidence: [visual findings](findings/visual.md),
`evidence/visual-followup-mobile.json`, and
[focused query screenshot](screenshots/visual-photo-graph-mobile-query-focus.png).

## 3. Product proof and search experience

### High investigation — Grailed Plus demo readiness

Desktop/mobile browser captures reached “Live demo is temporarily unavailable”
after the configured readiness timeout. The separate direct request to
`https://grailed-plus-demo.dextery.dev/?feature=overview` also timed out at 30 seconds.
The first-party page, feature copy, mobile desktop-install explanation and official
Chrome Web Store navigation remained available.

This supports investigating a dependency that weakens “show me before I install.”
It does **not** prove a persistent/global outage, a DNS/CSP/hosting/handshake cause,
or a broken extension. Diagnose before selecting a remedy. Keep origin/frame
validation and a useful authentic static fallback; do not remove tracking or change
infrastructure without approval.

The three entry-page types otherwise fit their purposes: portfolio collection,
explanatory Photo Graph study with a separate experience, and extension acquisition.
No confirmed SERP page-type mismatch was established. Conditional refinements are
category cues in collapsed mobile rows and contextual contact/support links.
A small public search also surfaced same-name Chrome/Firefox/GitHub extension
results; verify lineage before making compatibility or ownership claims.

Evidence: [SXO findings](findings/sxo.md), [visual findings](findings/visual.md),
`evidence/demo-direct-fetch.md`. No actual user conversion or installation rate
was measured; Store clicks are not installations.

## 4. Performance and images

**Real-user LCP, INP and CLS remain unknown. No Lighthouse score is available.**
Google performance tooling returned HTTP 429. Across two independent worker
invocations there were three PSI strategy requests in total; the agentic wrapper
automatically issued desktop after its mobile 429. No further requests or account/
backend quota workarounds were made after the failure was known.

The following are single-run, unthrottled Chromium observations, approximately
seven seconds after DOMContentLoaded with no scrolling—not real-phone benchmarks:

| Page / condition              | Completed encoded transfer | Observed main-document LCP | Main limitation                                  |
| ----------------------------- | -------------------------: | -------------------------: | ------------------------------------------------ |
| Portfolio, mobile viewport    |                    0.54 MB |                     284 ms | Fast auditor connection; not field performance   |
| Portfolio, desktop            |                    0.56 MB |                     140 ms | Same limitation                                  |
| Photo Graph, mobile viewport  |                    4.84 MB |                     352 ms | Quick text paint masks later graph/image work    |
| Grailed Plus, mobile viewport |           At least 0.68 MB |                     208 ms | Iframe/load unfinished; not whole-demo readiness |

### High optimization — Photo Graph initial image work

120 completed image responses accounted for **4,221,724 encoded bytes**: 103 canvas
images / 2.98 MB and 17 comparison URLs / 1.24 MB. Query selectors render at 72×80
CSS px below the fold around y=1544, but use width-560/quality-86 URLs. Forty-two
comparison DOM image elements reuse those 17 URLs; they are not 42 separate files.
Canvas images are additional and do not appear as DOM `img` elements.

Start with below-fold lazy loading and suitable thumbnail candidates. Consider
canvas activation/concurrency only after measuring the tradeoff; it is intentional
interactive content, partly visible in the initial viewport. Measured buckets are
optimization scope, not guaranteed savings or predicted LCP improvements.

### Medium — shared font transfer

Six fonts contributed **246,122 bytes**, 45.4% of the primary portfolio mobile
capture. Four Red Hat TTF files account for most of this; root font definitions
preload by default (`app/layout.tsx:16-63`). Compare WOFF2/initial-face needs while
preserving the distinctive typography. No observed font-related CLS failure exists.

### Image baseline is sound

Poster alts are descriptive; Next fill images have valid sized/aspect-ratio
containers and responsive candidates. All five sitemap originals returned 200.
Sampled R2 `.png` paths actually negotiated AVIF with `Vary: Accept` and immutable
caching; file extension alone would give the wrong format diagnosis. Empty query
thumbnail alts are appropriate beside their labelled buttons. Informative ranked
photos could use concise curated visual descriptions instead of rank/ID alone.

Evidence: [performance findings](findings/performance.md),
[image findings](findings/images.md), `evidence/performance-summary.json`,
`evidence/images-http-head.json`, `evidence/visual-image-support.json`.

## 5. Content, trust and on-page metadata

Meaningful SSR content and unique metadata are present on all three pages;
deterministic templating risk is low. Headings are coherent. The work, live examples,
model comparison and limitations are genuine assets. Short portfolio/product pages
are not penalized merely for missing an arbitrary word count.

### Medium — benchmark definitions and aggregate scope

The legend says P@4 is the share of the first four results judged relevant. The
calculation actually filters to **judged candidates first**, then takes four
(`scripts/photo-graph/benchmark-color-models.ts:195-209`). Displayed neighbours
come from the unrestricted ranking. Cards beneath an active query display model
averages across seven queries, not necessarily that query's metrics (`:238-243`;
comparison component `:284-299`).

For query 14, the displayed model average is 89% while saved query P@4 is 100%.
Different candidate/aggregation scopes explain this; fabricated results are not
alleged. Correct labels to explain the denominator and seven-query average, and
identify the historical 100-photo benchmark/date rather than implying live count.
No model change or production data operation is needed just to correct wording.

### Medium — contribution context

Dexter's identity/profiles/schema exist, but visible project summaries chiefly
describe the artifacts. Expose short owner-confirmed role/contribution/outcome
context from the shared catalog. Internal `TBD` role/date/outcome values are **not
currently public placeholder copy**. Do not invent sole authorship, image ownership,
traffic, revenue or client-impact numbers. A working shipped archive or extension
is itself a legitimate result.

Lower-priority product clarity: identify Grailed Plus as a Chrome extension in
the existing metadata/intro and make the maintainer/support/privacy disclosures
easy to reach. The Store already provides corroborating disclosures; their absence
on this page is not a privacy-policy violation. Website analytics and extension
data handling are different scopes.

Evidence: [content findings](findings/content.md), `evidence/content-findings.json`.

## 6. Structured data

All six observed JSON-LD blocks parse; references resolve across each page's two
graphs with zero dangling references. Person/WebSite identity, page/image entities,
the portfolio ItemList and conservative CreativeWork project descriptions are
appropriate. No need to add “missing” Person/sameAs markup—it already exists.

Optional low-priority refinements are stable project `@id`s and explicit pixel-value
typing if strict vocabulary validation warrants it. SoftwareApplication specificity
for Grailed Plus is optional; genuine ratings/reviews must never be invented for
rich-result eligibility. Root-fragment IDs are not invalid because `/` redirects.
Google's site-name guidance includes redirect-target handling; verify actual Google
selection before proposing a homepage move. No root relocation is recommended.

Evidence: [schema findings](findings/schema.md), `evidence/schema-observed.json`.
No hosted Rich Results Test/Schema Markup Validator submission was run.

## 7. AI access, citability and authority

Representative ordinary, GPTBot, OAI-SearchBot and ChatGPT-User strings received
identical 200 homepage HTML with no observed challenge. Named navigation/contact
controls exist. These are requests from one audit host, not authenticated provider
crawlers, confirmed indexation or measured AI citations.

One automated focus-control click timed out, but source review confirmed the
intended button-to-focus interaction and existing genuine destination links.
The initial interpretation as a navigation defect was withdrawn; intended complete
flows remain partly untested. This is not used as an additional defect or score
penalty. Missing optional `llms.txt`, Markdown, discovery files and WebMCP are not
Google indexing defects or reasons to change access policy.

Two inbound examples were verified: GitHub's profile website link (`nofollow me`)
and Elliot Mairêt's “Developed by Dexter” credit. **Two is an observed sample, not
total backlinks/referring domains.** Overall authority, DA/PA, toxicity, velocity and
competitor gap remain unassessed. Common Crawl's available helper would require
broad table streaming beyond the agreed bounds; it was not run as a domain scan.
LinkedIn's 999 response is an access limitation, not evidence of a missing profile.

Preserve genuine profile/credit links and make the existing benchmark and project
results easy to cite. No outreach, disavow, manufactured profiles, mention farming,
or paid-link programme follows from this evidence.

Evidence: [GEO findings](findings/geo.md), [agentic findings](findings/agentic.md),
[backlink findings](findings/backlinks.md).

## Verification, omissions and next decision

- **Passed:** 154 scoped public technical assertions; sitemap structure/coverage;
  six JSON-LD syntax/reference checks; six browser page/viewports with no document
  overflow; metadata-template check; sampled query Enter activation; retained
  backlink report validator has zero errors and one contextualized reciprocity warning.
- **Observed problems:** invisible focus, unavailable demo states/direct fetch
  timeout, substantial initial image transfer, imprecise metric labels.
- **Not obtained:** actual Search Console index coverage/canonicals/queries, GA4/
  Matomo traffic/conversions, real-user CrUX CWV/INP, Lighthouse/Agentic score,
  comprehensive backlinks/AI citations or controlled query rankings.
- **Not run:** normal lint/typecheck/build/tests (no implementation change);
  unmodified `npm run seo:validate` because it also GETs robots-disallowed admin
  routes. The 154 assertions are a scoped alternative, not that npm command.
- **Unchanged:** application/configuration, production services, dependencies,
  media objects and existing user edits. Only audit documentation/evidence added.
- **Report archive checked:** scoped Prettier validation passed; all 22 JSON files
  parse, 20 copied JSON evidence values match their working originals, the sitemap
  XML is well-formed and byte-identical to its capture, and score arithmetic/core
  report links plus 11 findings and seven screenshots were verified.
- **Independent consistency review:** no material corrections found; incomplete
  field/indexing evidence and unknown demo root cause remain explicit caveats.

Use [ACTION-PLAN.md](ACTION-PLAN.md) to choose a separately scoped implementation.
A PDF can be generated on request; none was generated or uploaded by this audit.

The next audit should check visible keyboard focus, repeatable demo readiness plus
fallback proof, reduced no-scroll image transfer with intact graph/query behavior,
correctly scoped benchmark labels, explicit verified contributions, and actual
Search Console/field evidence if the owner supplies access or exports.
