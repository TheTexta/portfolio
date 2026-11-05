# Prioritized action plan — dextery.dev

Audit: 2026-10-27. **Recommendations only: no implementation or deployment is
authorized by this report.** No confirmed critical indexing blocker was found.
High priority below means useful accessibility, product-proof or payload work,
not a proven Google ranking penalty.

## Start here

| ID  | Priority            | Action                                                                          | Evidence / first principle                                                                    | Dependency                                                                                         | Indicative effort                         |
| --- | ------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| A1  | High                | Restore visible keyboard focus on shared links and query buttons                | A control that works with Enter must also reveal where focus is; live outline style is `none` | None                                                                                               | 1–2 h plus regression checks              |
| A2  | High investigation  | Diagnose Grailed Plus demo readiness; retain useful visual proof on failure     | Desktop/mobile captures reach the unavailable state; a separate direct fetch timed out        | Diagnose before choosing an origin/handshake fix; separate approval for service/deployment changes | 30–90 min diagnosis; repair scope unknown |
| A3  | High optimization   | Reduce initial Photo Graph image work, starting with comparison thumbnails      | A no-scroll mobile-viewport run completed 120 image responses / 4.22 MB                       | Measure before/after; thumbnail work before broader graph activation changes                       | 2–4 h initial pass                        |
| A4  | Medium              | Explain Dexter's role and contribution beside existing projects                 | Strong work is visible, but contribution boundaries are less explicit than creator schema     | Owner confirms facts/collaborators/dates                                                           | 1–2 h after fact-checking                 |
| A5  | Medium              | Trim unnecessary font preload/transfer while preserving typography              | Six fonts: 246 KB, 45.4% of observed portfolio mobile transfer                                | Check initially needed faces; compare WOFF2/rendering                                              | 1–3 h                                     |
| A6  | Medium, source-only | Correct the already-documented legacy Photo Graph fallback in a separate repair | Fallback resolves retired Supabase media when that branch is selected                         | Verify provider/path mapping and add isolated fallback test                                        | Scope separately                          |
| A7  | Medium              | Correct benchmark metric labels and scope                                       | P@4 is calculated on judged candidates; active-query cards show seven-query model averages    | Confirm the intended evaluation definition                                                         | 30–60 min plus data/label checks          |

These estimates are planning aids, not commitments. A1/A3/A5 can be independent;
A4 requires owner facts; A2's remedy depends on diagnosis. Do not bundle a media
migration, homepage relocation, shared authorization change, or analytics removal.

## Acceptance checks, failure conditions and indicators

### A1 — Keyboard focus

- **Where:** `app/components/ui/editorial.tsx:236-237,305-311`,
  `app/components/ui/header-directory.tsx:19-20`,
  `app/projects/photo-graph/model-comparison/photo-graph-model-comparison.tsx:165-170`,
  and Grailed feature links.
- **Smallest change:** restore an explicit visible outline style or equivalent
  monochrome indicator, not only outline width/color. Keep square geometry.
- **Accept:** Tab/Shift+Tab reveal focus on each link, primary action and query
  button on all three pages in both themes. Enter/Space retain intended behavior.
- **Failed if:** a focused control still has no distinguishable indicator, focus
  is clipped, or navigation/query selection regresses.
- **Indicator:** sampled keyboard-flow pass rate. This is an accessibility repair,
  not an assertion of a direct ranking signal.

### A2 — Grailed demo proof

- **Where:** `grailed-plus-live-demo.tsx:45-49,225-237,338-395` under
  `app/components/projects/grailed-plus/`;
  origin `https://grailed-plus-demo.dextery.dev/?feature=overview`.
- **Smallest next step:** clean-browser reproduction and origin/ready-message
  diagnostics. Distinguish document availability from iframe handshake and timeout.
  No root cause is established by this audit.
- **Accept:** overview and on-proximity feature demos reach the expected ready
  state across repeated desktop/mobile visits. Locally block the demo origin and
  confirm an authentic static preview/explanation, retry and Store link remain.
- **Failed if:** only a longer timeout hides an unavailable dependency, or a blank
  panel still replaces the promised product proof. Preserve origin/frame validation.
- **Indicator:** demo-ready/timeout/retry rates and Store outbound clicks by state.
  Store clicks are not verified extension installations. New tracking/configuration
  changes need separate approval.

### A3 — Photo Graph payload

- **Where:** `app/projects/photo-graph/page.tsx:58-68`, comparison images at
  `model-comparison/photo-graph-model-comparison.tsx:175-180,242-247,259-264`,
  `app/components/projects/project-case-study-shell.tsx:72-75`, and
  `app/components/projects/photo-graph/usePhotoGraphImages.ts`.
- **Smallest change:** native lazy loading for below-fold comparison imagery;
  suitable thumbnail candidates instead of a shared width-560/quality-86 URL for
  a 72×80 CSS-pixel selector. Preserve dimensions and stable R2 object paths.
- **Then, conditionally:** evaluate graph activation/proximity and bounded node
  loading if slower-device evidence justifies it. The graph is meaningful content;
  do not replace the experience solely to improve a score.
- **Accept:** repeat comparable no-scroll captures with fewer initial image bytes
  and requests; scroll, switch queries, zoom and inspect to verify complete media.
  Follow with at least three throttled runs and compare medians.
- **Failed if:** initial transfer does not improve materially, missing images or
  layout shifts appear, or activation harms the intended exploration.
- **Indicator:** initial image bytes/requests, ready-to-interact time and measured
  field/lab metrics when available. The 1.24 MB comparison and 2.98 MB canvas
  buckets are measured scope, not guaranteed savings or predicted LCP gains.

### A4 — Contribution and factual clarity

- **Where:** `app/components/projects/project-catalog.ts`,
  `project-case-study-shell.tsx`, `app/components/home-page-content.tsx`,
  and Grailed's existing product introduction.
- **Smallest change:** a brief accurate introduction and per-project role,
  contribution and period from the shared catalog. Keep client/photographer versus
  developer authorship distinct. Never publish `TBD` or invent results.
- **Accept:** a reader can identify who built which parts without inspecting
  schema or leaving for external profiles. Detached copy agrees with metadata.
- **Failed if:** claimed contributions cannot be supported or extra boilerplate
  obscures the work. No arbitrary word-count target or blog programme is needed.
- **Indicator:** successful first-time role/project identification and relevant
  enquiry/CV journeys; search/citation changes remain hypotheses, not promises.

### A5 — Fonts

- **Where:** `app/layout.tsx:16-63,79-82`.
- **Smallest change:** compare WOFF2 equivalents and initial-face preload needs,
  including normal versus italic Red Hat files. Scope less-used faces where useful.
- **Accept:** smaller initial font transfer with matching typography, no new
  invisible text or layout shifts, both themes and viewports checked.
- **Failed if:** typography degrades or layout/paint regressions erase byte savings.
- **Indicator:** font bytes, face requests, CLS and initial rendering under the
  same capture conditions. No measured font-related CLS failure exists today.

### A6 — Fallback resilience, not a current live-media failure

- **Where:** `lib/photo-graph/graph-store.ts:244-294`,
  `lib/photo-graph/media-url.ts:25-53`, `public/portfolioTable.json`.
- **Smallest next step:** isolated test forcing the fallback and confirming
  provider-aware published media paths; rebuild/normalize that snapshot through
  an appropriate reproducible procedure.
- **Accept:** fallback nodes resolve verified published originals and render
  without relying on deleted Supabase copies.
- **Failed if:** fallback still silently defaults legacy objects to Supabase.
- **Indicator:** isolated fallback/media-resolution test. Do not force production
  backend failure, restore/delete objects, or change storage as a diagnostic.

### A7 — Benchmark definitions

- **Where:** `scripts/photo-graph/benchmark-color-models.ts:195-243` and
  `app/projects/photo-graph/model-comparison/photo-graph-model-comparison.tsx:206-210,284-299`.
- **Smallest change:** describe the first four **judged candidates**, rather than
  the first four unrestricted results. Label model percentages as averages across
  seven reviewed queries, or deliberately show correctly labelled per-query values.
  Keep the dated 100-photo benchmark separate from the evolving live archive.
- **Accept:** trace two selected queries to both saved query and model metrics;
  wording explains the denominator and why an aggregate may remain unchanged.
- **Failed if:** a reader could still infer 89% precision over the first four
  currently displayed unrestricted neighbours. The numbers are explainable;
  this audit does not allege fabrication or require changing the model.
- **Indicator:** zero unexplained definition/scope mismatches across seven queries.

## Later / conditional improvements

- **Mobile orientation:** if recruiting/client triage matters, expose the existing
  work category in collapsed rows. Validate with first-time mobile task testing;
  do not rename projects for speculative keywords.
- **Benchmark context:** retain the date and review limitations when correcting A7;
  do not manufacture freshness by replacing historical dates with today's date.
- **Contextual next steps:** a restrained contact/support destination after project
  evaluation may help; existing homepage contact and product installation work.
- **Touch comfort:** enlarge 28px header hit areas without changing the visual
  identity. This is not an asserted 24px WCAG AA minimum failure.
- **Schema polish:** stable project IDs and optional explicit pixel-value typing
  are low-priority. Existing JSON-LD parses and has no dangling references.
- **Redirects:** optionally collapse extra HTTP/www hops during separately approved
  hosting maintenance. Current permanent redirects preserve destinations/query.
- **Authority:** preserve the verified GitHub website field and Elliot development
  credit. Make genuine project evidence easy to cite; no link-count campaign,
  automatic reciprocity, disavow, or profile creation is justified.

## Measurement and release gates

1. When available, obtain an owner-provided Search Console export or approved
   read-only access. Inspect the three canonical URLs and actual selected
   canonicals before treating low visibility as an indexing defect.
2. Establish comparable lab/field performance evidence; the current API calls
   returned 429 and no valid Lighthouse or field CWV score was obtained.
3. Any code implementation is a separate task: normal `npm run check`, appropriate
   tests and production build, then approved deployment and live verification.
   The existing `seo:validate` command also GETs admin paths; decide that scope
   explicitly rather than claiming this audit ran it.
4. Update page-specific `lastModified` only after significant actual content,
   links or structured-data changes, not on every deployment or storage operation.
5. Re-audit after the chosen fixes. Look for visible keyboard focus, reliable demo
   proof, reduced no-scroll Photo Graph transfer, retained image interactions,
   consistent contribution copy, and real Search Console/field evidence if supplied.
