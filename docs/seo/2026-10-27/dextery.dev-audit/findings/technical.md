# Technical SEO audit — dextery.dev

**Final specialist report · 2026-10-27 local / 2026-10-28 UTC HTTP captures**

## Executive finding

**No critical/high technical indexing defect found in the complete three-page public sitemap.** All public canonical pages return 200 and contain usable indexing metadata and primary text in raw HTML for ordinary, Googlebot, and Googlebot Smartphone user agents. **154 bounded offline assertions passed; 0 failed.** A further manually reviewed status/redirect matrix found only low-priority extra redirect hops on HTTP/www entry variants. One conditional Photo Graph fallback risk is present in source, not reproduced as a current live failure.

**Proposed Technical SEO score: 96/100 — heuristic, measured scope only.** This is not a Google/Lighthouse score or a claim of actual index inclusion. Performance, structured-data validity, content quality, full visual/mobile usability and authenticated infrastructure were not scored.

## Scope, method and safety

- Live scope: `https://dextery.dev/portfolio`, `/projects/photo-graph`, `/grailed-plus`; their two intentionally excluded experiences; robots/sitemap; known public redirects, trailing-slash/domain/scheme variants, `?view=hero`, and the linked CV PDF.
- Source: `/Users/dexteryoung/Git Repos/portfolio`. Read AGENTS.md and README.md and preserved the existing changes in AGENTS.md, README.md and docs/photo-graph-r2-migration.md. No repository code/config, deployment, dependencies, indexing service, database, hosting or other remote configuration was changed.
- Used the already-ready managed runtime, `"$HOME/.claude/skills/seo/scripts/claude-seo" run <script>`, for all HTTP captures. Initial public HTML used `render_page.py --mode never`; subsequent captures used `fetch_page.py --no-redirects`. No website JavaScript was executed, no forms submitted, and no `/api/` or `/admin` URL was fetched. Redirect destinations were checked from separately captured explicit public URLs, not followed indiscriminately. The external GitHub Pages redirect destination was not followed.
- Inspected `scripts/seo/validate-indexing.ts` before deciding whether to run `npm run seo:validate -- --base-url https://dextery.dev`. It is GET-only (`:245-251`) but actually fetches three robots-disallowed admin URLs (`:32-34`, `:374-388`). **The exact npm command was not run** to preserve the stronger no-admin-crawl boundary. Evidence-only public capture/offline assertion scripts provided a scoped alternative; they are not represented as the repository command's result.
- Representative full public scope completed: three initial public captures, robots, a managed sitemap-discovery run, and 37 explicit follow-up capture cases. Every case succeeded on its first attempt; no network retry was needed. There was no recursive crawl.

## Category scorecard

Each scored category is the proportion of the listed conceptual checks passing. Overall weighting is shown explicitly. A partial category scores only the named subset, not its unmeasured remainder.

| Category                         | Status                       | Checks behind score                                                                                                                                                                   |      Score | Weight |
| -------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------: | -----: |
| Crawlability                     | Pass                         | robots available/appropriate; validated sitemap discovery; canonical sitemap membership; direct public links; crawlable noindex exclusions — 5/5                                      |        100 |    25% |
| Indexability                     | Pass                         | public 200s; matching canonical; no prohibitive directive; unique title/description; query-variant canonical — 5/5                                                                    |        100 |    25% |
| URL structure/redirects          | Warn                         | clean paths; permanent root/legacy redirects on canonical origin; slash normalization; permanent host/scheme/path/query preservation pass; single-hop entry normalization fails — 4/5 |         80 |    20% |
| Security transport/header subset | Pass                         | HTTPS/TLS; HSTS; no HTTP `src` resources in captured HTML; correct MIME/nosniff; framing/referrer controls — 5/5                                                                      |        100 |    10% |
| Raw HTML / rendering readiness   | Pass, raw only               | primary text/H1; initial metadata; ordinary/Googlebot parity; modest HTML size — 4/4                                                                                                  |        100 |    15% |
| Mobile indexing-signal subset    | Pass, partial                | responsive viewport; smartphone primary-text parity; smartphone metadata/robots parity — 3/3                                                                                          |        100 |     5% |
| Core Web Vitals / performance    | Delegated, not measured here | No duplicate performance measurements                                                                                                                                                 | Not scored |      — |
| Structured data                  | Delegated                    | No duplicate schema validation                                                                                                                                                        | Not scored |      — |
| IndexNow                         | Not measured live            | No implementation found in scoped source search; optional for a small site, not an indexing failure                                                                                   | Not scored |      — |

Weighted calculation: `25 + 25 + (20 × 0.80) + 10 + 15 + 5 = 96`.

## Prioritized findings

### Critical / High

None observed within this public technical scope.

### T2 — Medium follow-up: retired-media dependency in the static Photo Graph fallback

**Classification: source-only resilience risk; already documented; not a confirmed live indexing defect. Not deducted from the observed-live score.**

- Affected public page: `https://dextery.dev/projects/photo-graph`; related intentionally noindexed experience: `https://dextery.dev/projects/photo-graph/experience`.
- The public page calls `loadGraphWithFallback()` before constructing image URLs (`app/projects/photo-graph/page.tsx:58-67,74-89`). The static path reads `public/portfolioTable.json`, normalizes its legacy nodes and resolves their image paths (`lib/photo-graph/graph-store.ts:244-258,278-294,301-311`). The snapshot's records have no provider field; absent provider explicitly resolves to Supabase, not R2 (`lib/photo-graph/media-url.ts:25-33,50-53`).
- The owner-maintained retention update states that the Supabase originals were deleted and that the old static fallback is no longer a usable media fallback (`README.md:229-238`; also `AGENTS.md:165-174`). This is a conditional problem **when the loader selects the static fallback**, not proof that current production imagery is broken. The current public-page request returned healthy 200 HTML; fallback was not forced and media endpoints were not audited here.
- **Recommendation:** in a separately scoped repair, rebuild/normalize the static snapshot with verified published provider/path references and add an isolated test for fallback output. Do not restore/delete production objects or migrate infrastructure as part of the SEO audit. Until fixed, do not rely on the legacy fallback for media recovery.
- Evidence: source references above; `technical-photo-graph-browser.{html,json}` confirms the healthy current public response, not the fallback's success.

### T1 — Low: extra permanent redirect hops on HTTP/www entry variants

**Classification: confirmed live inefficiency, not a broken redirect or indexing blocker.**

Each arrow below is the captured HTTP response for that URL. All redirects are permanent **308**; final public pages return **200**.

| Entry URL                                        | Observed route                                                                                          | Redirect hops |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------- | ------------: |
| `https://dextery.dev/`                           | → `https://dextery.dev/portfolio` → 200                                                                 |  1 — intended |
| `http://dextery.dev/`                            | → `https://dextery.dev/` → `https://dextery.dev/portfolio` → 200                                        |             2 |
| `https://www.dextery.dev/`                       | → `https://dextery.dev/` → `https://dextery.dev/portfolio` → 200                                        |             2 |
| `http://www.dextery.dev/`                        | → `https://www.dextery.dev/` → `https://dextery.dev/` → `https://dextery.dev/portfolio` → 200           |             3 |
| `https://www.dextery.dev/grailed-plus?view=hero` | → `https://dextery.dev/grailed-plus?view=hero` → 200                                                    |      1 — pass |
| `http://dextery.dev/grailed-plus?view=hero`      | → `https://dextery.dev/grailed-plus?view=hero` → 200                                                    |      1 — pass |
| `http://www.dextery.dev/grailed-plus?view=hero`  | → `https://www.dextery.dev/grailed-plus?view=hero` → `https://dextery.dev/grailed-plus?view=hero` → 200 |             2 |

- The application intentionally redirects `/` to `/portfolio` (`app/page.tsx:1-6`). Official origin is HTTPS non-www (`lib/site-config.ts:1`); current www redirect expectations are documented in `README.md:76-81`. Extra host/scheme steps are observed from live responses; hosting internals were not inspected or inferred from source.
- **Recommendation:** optional hosting-level optimization, with explicit deployment/configuration approval, to collapse applicable noncanonical entry redirects to the final HTTPS non-www destination while preserving path/query and retaining the intentional `/portfolio` homepage. Do not relocate the canonical homepage merely to remove a hop. Existing first-party page links already point to canonical destinations.
- Evidence: `technical-fetch-manifest.json`, plus `technical-{root,http-root,www-root,http-www-root,www-path-query,http-path-query,http-www-path-query,grailed-plus-hero-browser}.json`.

### Optional hardening observation — not an SEO failure

No `Content-Security-Policy` response header was present on the three public responses. Their existing configured header set is in `next.config.ts:33-48`. HSTS, nosniff, SAMEORIGIN and referrer controls are present. If CSP is desired, design and test it separately against inline Next/theme scripts, embeds, analytics and demo origins; do not install a blanket policy during an SEO fix. Missing CSP alone is not evidence of a ranking/indexing problem and received no score penalty.

## Confirmed public-page checks

All three profiles—ordinary, Googlebot and Googlebot Smartphone—returned the same extracted title, description, canonical, robots directives, H1 and normalized main text for each public page. This demonstrates user-agent parity from this audit location, not authenticated Google crawler access.

| Exact public URL                           | Status | Raw title                                                              | Canonical | HTML bytes, decoded | Raw main text characters |
| ------------------------------------------ | -----: | ---------------------------------------------------------------------- | --------- | ------------------: | -----------------------: |
| `https://dextery.dev/portfolio`            |    200 | Dexter Young — Software Developer & Creative Technologist              | Same URL  |              56,141 |                    1,163 |
| `https://dextery.dev/projects/photo-graph` |    200 | Photo Node-Gallery — Dexter Young                                      | Same URL  |             105,572 |                    3,868 |
| `https://dextery.dev/grailed-plus`         |    200 | Grailed Plus — Price Insights, Market Compare, Currency, and Dark Mode | Same URL  |              36,878 |                    1,672 |

- Exactly one nonempty title, meta description and canonical per public page; titles/descriptions differ between pages. No `noindex`, `none`, `unavailable_after` or `X-Robots-Tag` restriction observed on these public pages. Missing explicit `index,follow` is normal, not a failure.
- Each has an H1, `lang="en"`, `width=device-width, initial-scale=1`, and Googlebot `max-image-preview:large`. H1 parser text for Grailed includes the accessibility-only “Plus” and decorative “+”; this is not a duplicate-H1 finding.
- `https://dextery.dev/grailed-plus?view=hero` returns 200 for ordinary/Googlebot and canonicalizes to `https://dextery.dev/grailed-plus` as intended.
- Initial HTML contains the primary text, H1, canonical, title and description; the public pages are not empty client-rendered shells. `"use client"` in `app/components/home-page-content.tsx:1` is **not** itself a CSR-only defect. Metadata originates in `lib/seo.ts:25-82`, exported by `app/portfolio/page.tsx:9`, `app/projects/photo-graph/page.tsx:22` and `app/grailed-plus/page.tsx:53`.
- Both public project pages are directly linked with real `<a href>` destinations in the portfolio's initial HTML: one click from the canonical homepage. All captured same-origin anchor targets on the three public pages resolve to separately captured 200 responses; applicable same-page/public-page fragment IDs exist. This covered **12 distinct same-origin destination URLs including fragments**. The linked `https://dextery.dev/Dexter_Young_CV.pdf` returns 200 `application/pdf` (109,578-byte Content-Length). No external-link crawl or PDF-content audit was performed.
- No `http:` resource `src` values were found in the captured public HTML. This is a raw-source mixed-content check, not a full CSS/runtime subresource audit.

## Robots, sitemap and intentional exclusions

`https://dextery.dev/robots.txt` returned 200 with identical ordinary/Googlebot policy:

```text
User-Agent: *
Allow: /
Disallow: /api/
Disallow: /admin

Sitemap: https://dextery.dev/sitemap.xml
```

- Policy permits all public pages, experiences and tested legacy public URLs. `/api/` and `/admin` remain blocked and were evaluated **from policy only**, never fetched. Robots restrictions are not authentication controls; no change to existing authorization is suggested.
- Managed `sitemap_discovery.py` verified `https://dextery.dev/sitemap.xml` as a 200 XML `urlset`, with no stale/unsafe declaration warning. Alternate common sitemap locations returned 404, which is harmless because a working declared sitemap exists.
- The live sitemap contains **exactly** the three canonical public pages, no redirect sources, admin/API URLs, query variants or experiences. All three `<lastmod>` values are `2026-10-06`, matching `lib/seo.ts:24-48`; five image entries belong to `/portfolio` and one each to the two project pages. XML was independently parsed offline. Asset quality/status belongs to the image specialist; matching dates do not prove that dates are editorially current. Sitemap source: `app/sitemap.ts:6-14`.
- `https://dextery.dev/projects/photo-graph/experience` and `https://dextery.dev/grailed-plus/experience` each return **200 with raw `noindex, nofollow`** for ordinary and Googlebot UAs. They are deliberately crawlable so crawlers can read that restriction; absence from the sitemap is correct. Source: `app/projects/photo-graph/experience/page.tsx:6-9`, `app/grailed-plus/experience/page.tsx:7-10`, `app/robots.ts:5-18`.
- Removed `https://dextery.dev/components/projects/nepobabiesruntheunderground/preview` returns **404** with raw noindex, not a soft-404 200. It is not an indexability defect.
- Trailing-slash variants `/portfolio/`, `/projects/photo-graph/` and `/grailed-plus/` return 308 directly to their non-slash canonical URL.

### Known public legacy URLs — all intended permanent redirects

| Source path on `https://dextery.dev`               | Status | Location                                                                             |
| -------------------------------------------------- | -----: | ------------------------------------------------------------------------------------ |
| `/projects/spotify-nodify`                         |    308 | `/portfolio#projects`                                                                |
| `/projects/spotify-nodify/experience`              |    308 | `/portfolio#projects`                                                                |
| `/components/projects/spotify-nodify`              |    308 | `/portfolio#projects`                                                                |
| `/auth/spotify/callback`                           |    308 | `/portfolio#projects`                                                                |
| `/components/projects/photo-graph`                 |    308 | `/projects/photo-graph`                                                              |
| `/components/projects/grailed-plus`                |    308 | `/grailed-plus`                                                                      |
| `/components/projects/nepobabiesruntheunderground` |    308 | `https://thetexta.github.io/nepobabiesruntheunderground/` — destination not followed |
| `/go/grailed-plus`                                 |    308 | `/grailed-plus`                                                                      |
| `/projects/grailed-plus`                           |    308 | `/grailed-plus`                                                                      |
| `/projects/grailed-plus/experience`                |    308 | `/grailed-plus/experience` — intentional noindex destination                         |

Relevant redirect configuration: `next.config.ts:50-91`. Administrative redirect cases were intentionally omitted from live tests.

## Header and source observations

- All public HTML responses served by Vercel include HSTS `max-age=63072000`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`, and restricted Permissions-Policy. TLS validation succeeded through the normal fetch path; no exploit probes, server-version security claims or hosting-console inspection occurred.
- History API usage was inspected, not assumed malicious: `app/components/ui/smooth-scroll-provider.tsx:13-63` changes history only for user-clicked valid same-page anchors. Project focus navigation listens to `popstate` and restores state (`app/components/projects/project-browser.tsx:801-828,898-965`). No back-button trap was identified in these inspected paths. Runtime/back-navigation behavior was not browser-tested here.
- Installed **Next 16.3.8** is pinned in `package.json:45`. Version-sensitive interpretations use the installed docs: `node_modules/next/dist/docs/01-app/01-getting-started/14-metadata-and-og-images.md:25-39,119-129` for metadata/viewport/streaming, and `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/redirects.md:26-32,43-55` for valid permanent 308 redirects and query preservation. Do not recommend changing 308 to 301 as an SEO fix.

## Limitations and follow-up verification

- Actual Google index coverage, Google-selected canonical, real Googlebot IP/WAF treatment and Search Console URL Inspection were not available/inspected. Successful simulated-UA GETs do not prove Google indexing. No indexing or sitemap submission was made.
- Raw HTML and smartphone-UA parity were compared, **not post-hydration DOM**. Browser rendering could trigger the disallowed API routes and third-party telemetry, so it was not executed in this bounded read-only scope. Browser/mobile layout, touch targets, hidden-content behavior, complete JS resource access, runtime history, interstitials and overflow remain unmeasured here; coordinate with the visual specialist rather than infer a pass from viewport alone.
- No Core Web Vitals or performance measurements and no schema/content-quality validation were duplicated. Image/media-origin checks and the conditional fallback branch were not exercised. No local build, dependency installation, full repository tests or unmodified `seo:validate` run was performed.
- No source evidence of IndexNow was found in the scoped search. Its absence was not treated as a defect for this small site; Google does not use IndexNow.
- Recommendation order: retain the current indexing controls; schedule the known fallback repair separately; consider collapsing redirect chains only when hosting changes are otherwise authorized. Recheck public GET signals after any future release.

## Evidence / handoff artifacts

All paths below are under `/private/var/folders/bx/htl3m38d3qq52n4zs8z6cyh00000gn/T/opencode/dextery.dev-audit-2026-10-27/`:

- `findings/technical.md` — this self-contained final report, replacing the early partial.
- `evidence/technical-analysis.json` — 154 assertions, results, parsed public metadata/main text, internal link targets and sitemap entries.
- `evidence/technical-analysis.log` / `evidence/technical-analyze.py` — concise assertion result and offline reproducibility script.
- `evidence/technical-fetch-manifest.json` / `evidence/technical-fetch-matrix.log` / `evidence/technical-fetch-matrix.py` — 37 explicit follow-up requests, status/Location/UA, attempts and managed-launcher capture script.
- `evidence/technical-{portfolio,photo-graph,grailed-plus}-{browser,googlebot,smartphone}.{html,json}` — full initial raw public HTML and response metadata.
- `evidence/technical-robots.{txt,json}`, `evidence/technical-robots-googlebot.{html,json}`, `evidence/technical-sitemap-discovery.json`, `evidence/technical-sitemap-{browser,googlebot}.{html,json}` — policy and validated sitemap evidence.
- Other `evidence/technical-*.{html,json}` contain named experience/hero/redirect/404/PDF captures. The PDF JSON intentionally truncates decoded content; its response status/MIME/headers remain intact.
- `evidence/technical-findings.json` — JSON-compatible Technical SEO handoff, without writing the parent-owned aggregate report/data files.
