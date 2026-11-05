# Performance — final bounded audit (2026-10-27 local)

## Outcome

**Performance /100: N/A. Real-user Core Web Vitals: unknown for LCP, INP and CLS.** A numerical heuristic would overstate four single, unthrottled observations, especially with an unfinished iframe and no real-user data. The top measured issue is **Photo Graph's 4.84 MB initial observed payload, including 120 image responses (4.22 MB) without scrolling**. On the primary portfolio, **six font downloads account for 246 KB / 45.4% of the mobile observed payload**.

Public mobile PageSpeed API returned HTTP 429 on the first attempt; stopped all Google performance API requests, with no retries or alternative-backend quota evasion. No PSI Lighthouse build, score or metrics were returned. Credential check reported tier -1 (none configured). Direct CrUX requires a key; none was obtained. **CrUX availability/traffic eligibility is unverified, not proven absent.** No field p75, collection window or INP can be reported. Lighthouse was not installed in this repository; no installation attempted.

## Conditions and evidence

- Live HTTPS GET navigation; all three pages returned 200. Four independent fresh Playwright contexts in a separately launched bundled headless Chromium **156.0.8078.4**, macOS, no shared-browser manipulation.
- Mobile **viewport simulation**: 390×844 CSS px, DPR 3, touch/isMobile enabled; default HeadlessChrome user agent, not an emulated phone CPU. Desktop: 1440×900, DPR 1. Unthrottled CPU/network on auditor's machine. Context request interception disables browser HTTP cache; edge caches remain operative. Portfolio document was Vercel HIT; representative pages MISS.
- One navigation per condition; no scroll or interaction; capture at approximately 7 seconds after DOMContentLoaded. Observations started **2026-10-28 01:48:21–01:48:43 UTC** (2026-10-27 local). DNS/OS/CDN caches can be warm. These exceptionally fast text/paint values are not representative mobile connection benchmarks.
- Non-GET/HEAD/OPTIONS requests blocked to avoid application writes (two Google Ads POST attempts blocked on Grailed Plus). Ordinary GET tracking resources were not blocked. Blocking changes normal analytics behavior; these are diagnostic observations, not pristine end-user runs.
- Managed launcher help/source inspected, then `claude-seo run pagespeed_check.py https://dextery.dev/portfolio --strategy mobile --psi-only --json`. Managed `render_page.py ... --mode auto --json` ran before application-source inspection; returned raw SSR content, 200, no renderer error.
- Network payload counts use CDP `encodedDataLength` for completed responses (encoded transfer including protocol overhead); totals are **observed lower bounds**, not all page lifetime bytes. OOPIF traffic may be omitted. PerformanceObservers run in the main document; cross-origin iframe and canvas content are not equivalent to main-document LCP/CLS coverage.
- Evidence: `evidence/performance-pagespeed-mobile.json`, `performance-render-portfolio.json`, `performance-browser.mjs` (reproducible harness), `performance-browser-results.json` (full measurements), `performance-browser-summary.jsonl`, and four `performance-*.png` screenshots. Paths relative to audit root.

## Measured local browser values (not CrUX or Lighthouse)

| URL / condition                         | Navigation TTFB¹ |    FCP | Observed main-doc LCP | CLS² | Completed resources | Encoded bytes |
| --------------------------------------- | ---------------: | -----: | --------------------: | ---: | ------------------: | ------------: |
| `/portfolio` mobile viewport            |          46.3 ms | 148 ms |                284 ms |    0 |                  23 |       542,611 |
| `/portfolio` desktop                    |          29.6 ms | 112 ms |                140 ms |    0 |                  26 |       563,156 |
| `/projects/photo-graph` mobile viewport |          78.2 ms | 352 ms |                352 ms |    0 |                 151 |     4,839,627 |
| `/grailed-plus` mobile viewport         |          33.2 ms | 208 ms |                208 ms |    0 |                  29 |      ≥677,672 |

¹ Navigation start → responseStart, including network setup; not server execution time. ² Maximum layout-shift session window excluding recent input, observed through the bounded capture only. LCP/CLS values fall in the good numeric bands in this particular local sample, **not a field CWV pass**. No Lighthouse TBT or INP measured. Long Task API: none >50 ms on portfolio or Grailed Plus; one **57 ms** task on Photo Graph. Do not call its 7 ms excess Lighthouse TBT.

- Portfolio LCP candidates were lazily loaded **Next/Image project posters**: Photo Graph (mobile) and Elliot (desktop), not the heading or a live iframe. No iframes mounted on initial portfolio load. Source: `app/components/projects/project-browser.tsx:156–166,381–387`.
- Photo Graph LCP was its summary paragraph; load event at **3,060.8 ms**, despite LCP 352 ms. Slowest observed graph image took **2,383 ms** (node 101 width 576, quality 60). Quick text LCP masks substantial subsequent graph/image work.
- Grailed Plus main-document LCP candidate was the header link, not finished demo content. An eager iframe was mounted at **y=727.2**, 348×680 CSS px, source `https://grailed-plus-demo.dextery.dev/?feature=overview`; **main-document loadEventEnd remained 0** at capture (~7.1 s). Demo resource/load completeness is unknown; ≥677,672 bytes excludes incomplete/OOPIF traffic. Its 208 ms LCP must not be presented as the whole experience being ready.

## Prioritized findings and testable fixes

### 1. High — Photo Graph eagerly loads both graph and below-fold comparison images

**Measured:** 120 image responses / **4,221,724 encoded bytes** (87.2% of this capture): 103 quality-60 canvas images / **2,984,361 bytes**, plus 17 quality-86 comparison images / **1,237,363 bytes**. Comparison query thumbnails render at **72×80 CSS px** while fetching width **560**; first is below the fold at y≈1544. Largest comparison image response was node 65, **148,401 bytes**. The current canvas requests all 103 graph nodes during this no-scroll run; this is evidence of eager work, not proof that all are invisible inside the graph.

**Attribution:** `app/projects/photo-graph/page.tsx:58–68` creates one width-560/quality-86 URL per node, reused for different thumbnail roles. `.../model-comparison/photo-graph-model-comparison.tsx:175–181,242–248,259–265` uses native img elements with explicit dimensions but **no lazy loading**. `app/components/projects/project-case-study-shell.tsx:72–75` mounts the live canvas immediately; `project-live-preview.tsx:17–20,53–55` uses ssr:false but still renders it immediately. Canvas image dispatch is `photo-graph/usePhotoGraphImages.ts:223–237,313–335`; `utils.ts:18–52` loads via Image(). `queueNodes` launches each requested load without an explicit concurrency queue.

**Testable changes, not implemented:** lazy-load below-fold comparison images while preserving dimensions; generate distinct responsive 144/216/280-ish thumbnail candidates appropriate to actual CSS width×DPR rather than reuse width 560 everywhere. Gate canvas mounting/image fetching on page-section proximity (or an explicit activation poster), then bound image concurrency/prioritize visible nodes while preserving zoom/inspection. Native lazy-loading distance alone may still fetch some below-fold images; measure the actual change.

**Expected impact:** lower initial transferred bytes and concurrent image pressure; particularly useful on slower mobile links. The measured 1.24 MB comparison and 2.98 MB canvas buckets are optimization scope, **not guaranteed savings or predicted LCP gain**. Acceptance: under the same viewport/no-scroll capture, materially fewer images/bytes, same reserved geometry, no missing images on scroll/activation; then repeat at least three throttled runs and compare median LCP/load readiness and long tasks.

### 2. Medium — Primary portfolio preloads a large shared font set

**Measured:** six fonts / **246,122 bytes** on mobile, versus 235,425 script bytes and 34,974 image bytes. Four Red Hat TTFs total **206,112 bytes**, including both italic files; total fonts **45.4%** of initial observed payload. Desktop fonts 246,092 bytes / 43.7%. Zero observed font-associated CLS, so do not claim fonts caused layout shift or a demonstrated slow LCP.

**Attribution:** `app/layout.tsx:16–63,79–82` declares normal/italic local Red Hat Text and Display plus Newsreader and Instrument Serif at root; no explicit preload opt-out. Installed Next font reference `node_modules/next/dist/docs/01-app/03-api-reference/02-components/font.md:184–194` says preload defaults true.

**Testable changes:** compare equivalent WOFF2 local font files and only preload truly initial-viewport faces; consider route-scoping less-used display/italic faces or preload:false without removing the intended typography. Confirm which italic faces are actually needed before changing them. Expected impact is byte reduction/network prioritization, not an already-proven CWV fix. Acceptance: smaller font payload, same appearance, no new CLS/FOIT across both viewports.

### 3. Medium / incomplete — Grailed Plus eager iframe and third-party overhead need a proper readiness run

**Measured:** Google Ads gtag script **158,325 encoded bytes**, Resource Timing duration **476.7 ms**; total completed scripts **404,481 bytes**. An eager demo iframe begins near the bottom of the initial viewport; load remains unfinished after 7 s. No >50 ms main-document tasks observed. The missing frame completion is a bounded-test limitation, not established production outage or proof that gtag caused it.

**Attribution:** `app/grailed-plus/page.tsx:70–86` preconnects the demo origin and loads Ads with afterInteractive. `app/components/projects/grailed-plus/grailed-plus-install-page.tsx:453–471` requests eager demo loading; `grailed-plus-live-demo.tsx:338–395` reserves min-height and conditionally mounts iframe with eager/lazy behavior and readiness opacity. Preserve these dimensions and origin/message/sandbox checks.

**Testable next steps:** measure frame response/ready-message timing and timeout rate in a longer isolated run, including OOPIF bytes. A/B an on-proximity/click-to-load preview and owner-approved later Ads loading/consent strategy; do not remove analytics or change business tracking unilaterally. Expected impact unknown until full frame and throttled evidence exists.

### 4. Low / conditional — Portfolio's actual LCP posters inherit lazy loading

Next/Image defaults lazy; measured mobile poster requested width 1200 at DPR3, displayed 356×177 CSS px, **34,974 bytes**, and completed ~273 ms. This sample is fast; **not a measured LCP failure**. If repeat throttled tests identify poster discovery delay, apply eager/high priority to the specific initial visible poster only. Do not preload every project poster; LCP varies by viewport and rail position. Installed Next docs: image.md:265–305 (preload semantics, avoid combination with loading/fetchPriority, priority deprecated in v16); sizes guidance :199–229. Source refs above.

## What evidence does not support

- No demonstrated INP problem, render-blocking bottleneck, server TTFB problem or CLS failure. Main document TTFB was low; Photo Graph is force-dynamic (`app/projects/photo-graph/page.tsx:20,82–85`) but this run does not justify caching/architecture changes.
- Framer Motion is present (`home-page-content.tsx:4–9,47–63`; `use-project-rail-motion.ts:127,207–219` transforms/requestAnimationFrame), but no measured portfolio long tasks or shifts identify it as a bottleneck. Do not attribute hashed JS chunks to motion without bundle/trace attribution.
- ssr:false/dynamic is code splitting, **not** automatic viewport deferral. Installed Next `01-app/02-guides/lazy-loading.md:41–54,62–72` explicitly contrasts immediate dynamic mounting with conditional on-demand loading.
- Field data absence is an access/quota limitation here, not an insufficient-traffic finding. All-user CWV status remains unknown.

## Scope preservation

No code/config edits, builds, quality checks, dependency installs, deployment, infrastructure inspection, credentials, or application mutations. Existing modifications to AGENTS.md, README.md and docs/photo-graph-r2-migration.md remain untouched. Only assigned findings/evidence artifacts were written. Own browser/context closed.

## JSON-compatible category summary for orchestrator

```json
{
  "category": "Performance",
  "score": null,
  "score_status": "N/A: PSI 429; only single unthrottled browser observations",
  "field_cwv": { "lcp": "unknown", "inp": "unknown", "cls": "unknown" },
  "psi": { "status": 429, "retried": false, "lighthouse_version": null },
  "method": "isolated installed Playwright Chromium 156.0.8078.4; no CPU/network throttling",
  "top_issue": "Photo Graph: 120 initial observed image responses, 4221724 encoded bytes; 4839627 total observed bytes",
  "primary_issue": "Portfolio mobile: six fonts, 246122 encoded bytes, 45.4% of observed transfer",
  "evidence": "evidence/performance-browser-results.json",
  "limitations": [
    "No real-user CrUX",
    "No INP",
    "No Lighthouse/TBT/score",
    "One run per condition",
    "7-second bounded observation",
    "Grailed iframe unfinished/OOPIF traffic partial",
    "Non-GET writes blocked"
  ]
}
```
