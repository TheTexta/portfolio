# Images — dextery.dev

Audit date: 2026-10-27. Evidence: raw public HTML in `evidence/*-render.json`,
`evidence/image-and-link-inventory.json`, `evidence/images-http-head.json`,
and read-only local asset metadata. Browser evidence from the performance
specialist is integrated below. Image-delivery heuristic: **75/100**, reflecting
good formats/alt/layout reservations but avoidable initial image work; this is
not a Google Images score or Core Web Vitals score.

## Observed scope

| Page                    | Image elements | Unique sources | Missing alt attribute | Empty alt |
| ----------------------- | -------------: | -------------: | --------------------: | --------: |
| `/portfolio`            |              7 |              6 |                     0 |         1 |
| `/projects/photo-graph` |             42 |             17 |                     0 |         7 |
| `/grailed-plus`         |              0 |              0 |                     0 |         0 |

The portfolio's empty-alt image is decorative mobile favicon artwork, initially
transparent before its in-view animation (`home-page-content.tsx:68-83`), not a
framework probe or missing project description. Photo Graph's seven empty-alt query thumbnails sit
inside buttons with adjacent textual query labels; these are not automatically
missing-alt defects. The other 35 comparison-image descriptions express query
labels or ranking IDs; richer descriptions are a possible accessibility/content
improvement, not evidence of an indexing block.

## What works

- Project poster images have descriptive alt text and Next-generated responsive
  `srcset`/`sizes`. `fill` images use sized, positioned/aspect-ratio containers;
  missing HTML width/height attributes here do not establish a layout-shift defect
  (`app/components/projects/project-browser.tsx:125-166,350-387`).
- All 42 Photo Graph comparison images declare width and height. Their surrounding
  CSS also reserves image space.
- Five sitemap poster originals returned HTTP 200. Three sampled Photo Graph R2
  transforms returned HTTP 200 and negotiated AVIF, with `Vary: Accept` and
  `public, max-age=31536000, immutable` caching. Sample transformed sizes were
  100,139, 53,525, and 14,415 bytes. A `.png` pathname does not mean PNG delivery.
- No blanket format migration, original-object renaming, CDN replacement, or
  storage/provider change is warranted from this audit.

## Findings

### High optimization opportunity: reduce initial Photo Graph image work

Photo Graph emits 42 image elements with default eager loading, using 17 unique
transformed URLs. Repeated URLs are cache/shared-resource reuse, not 42 unique
downloads. The shared URL builder uses width 560/quality 86 even for small query
thumbnails (`app/projects/photo-graph/page.tsx:58-68`);
`model-comparison/photo-graph-model-comparison.tsx:175-180,242-247,259-264` has no
native lazy loading or responsive sources.

Independent browser evidence confirms 120 completed image responses and
4,221,724 encoded bytes without scrolling on a 390×844/DPR3 unthrottled Chromium
run: 103 canvas-node images / 2,984,361 bytes and 17 comparison URLs / 1,237,363
bytes. Query thumbnails were 72×80 CSS pixels, fetched at width 560, below the
fold around y=1544. See `findings/performance.md` and
`evidence/performance-browser-results.json`. These are bounded local measurements,
not a field CWV failure, and the measured buckets are not guaranteed savings.

Keep initially visible graph/hero imagery appropriate to the intended experience;
first defer below-fold comparison rows and provide correctly sized thumbnail
candidates. If slower-device measurements support it, consider viewport-aware
canvas activation and bounded/prioritized node loading without weakening the
experience. Preserve existing Worker transforms and stable original paths.

Verification: compare initial image requests/bytes at desktop and mobile without
scrolling, then scroll and change queries to confirm all results still appear.
Falsification: no useful reduction in initial requests/bytes or a visible
interaction regression. Leading indicator: initial image transfer and LCP per
page/viewport. No claim about real-user CWV can be made from markup alone.

### Low: review original poster budgets separately from optimized page delivery

Direct sitemap originals returned: Elliot PNG 2,589,833 bytes; Nepobabies WebP
839,120; Photo Graph WebP 346,282; bur1alrites PNG 320,246; Grailed Plus WebP
46,782. These are original asset sizes, not measured optimized browser payloads.
The portfolio uses `/_next/image` and negotiates configured AVIF/WebP
(`next.config.ts:94-108`). If original social/sitemap asset weight becomes an
operational concern, create smaller derivatives and review visual fidelity; do
not rename originals or claim multi-megabyte page savings without browser proof.

Verification: inspect the actual selected poster URL, format, bytes and sharpness
at representative device pixel ratios before/after. Leading indicator: real
optimized-image bytes, not extension alone.

## Limitations

No image-search rankings, license-badge eligibility, copyright ownership, or
photographic subject descriptions were independently established. No original
was changed. Query-thumbnail alt intent is judged in its labelled-button context.
