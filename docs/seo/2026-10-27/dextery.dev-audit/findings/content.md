# Content / E-E-A-T & on-page editorial SEO

**Completed 2026-10-27. Content Quality: 76/100. On-Page SEO: 87/100.** These are separate, scope-limited editorial heuristics, not Google scores, ranking predictions, or substitutes for Search Console. No critical/high-severity content defect found. The main opportunity is clearer ownership and more precise presentation of existing evidence—not more pages or longer copy.

## Scope and method

- Audited only the three indexable documents: [portfolio](https://dextery.dev/portfolio), [Photo Node-Gallery](https://dextery.dev/projects/photo-graph), [Grailed Plus](https://dextery.dev/grailed-plus). `/` is the entry to the portfolio; intentional noindexed experience routes were not treated as missing SEO pages.
- Read repository AGENTS.md, README.md, project catalog, public-page sources, identity/metadata configuration and the specific benchmark calculation behind the published claims. Read-only repo/live. Existing modified AGENTS.md, README.md and docs/photo-graph-r2-migration.md remain untouched. Final git status also showed untracked `docs/seo/`, which this worker did not create, inspect or alter; no repository files were written by this worker.
- Used the installed `"$HOME/.claude/skills/seo/scripts/claude-seo" run` launcher for forced Playwright rendering, raw HTML parsing, content heuristics and metadata-template checks. No installs, builds, performance tests, credentials, account access, deployment or production writes. Browser inspection used an isolated context; no Install click or extension installation.
- Meaningful raw HTML and rendered/accessibility content verified on all three documents: HTTP 200, `is_spa=false`, no renderer errors. Additional DOM reads at 1440px and the portfolio small-screen layout at **500px actual innerWidth**; requesting 375px via browser resize yielded 500px, so this is not claimed as a 375px test.
- Only ancillary external checks: the exact linked GitHub profile, LinkedIn profile and Chrome Web Store listing. No broad crawl or reputation/backlink investigation.
- Source references below are relative to `/Users/dexteryoung/Git Repos/portfolio/`; evidence filenames are relative to `../evidence/`.

## Scores and audience fit

| Page                    | Content Quality | On-Page SEO | Assessment                                                                                                                                     |
| ----------------------- | --------------: | ----------: | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `/portfolio`            |              74 |          89 | Distinctive, concise index of real work; recruiter/collaborator ownership and contribution context is mostly inferred.                         |
| `/projects/photo-graph` |              82 |          88 | Strong original experiment, rationale, data and limitations; metric definitions and scope need correction.                                     |
| `/grailed-plus`         |              72 |          84 | Useful install-oriented feature copy and public product proof; creator/support/privacy signposting and search-snippet intent could be clearer. |

Site scores are the rounded equal-page average. On-page scoring considers relevance, headings, rendered/SSR copy, descriptive links and image descriptions; it is **not** a complete technical/schema/performance audit.

### E-E-A-T breakdown: 76/100

| Factor            | Score | Evidence / caveat                                                                                                                                                                |
| ----------------- | ----: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Experience        | 17/20 | Original live work, first-person model-selection account, reviewed images and published extension.                                                                               |
| Expertise         | 20/25 | Five-model comparison, disclosed test scope and real technical implementation; public role boundaries and the benchmark labels weaken clarity.                                   |
| Authoritativeness | 16/25 | GitHub identity/domain corroboration and a live Store listing; no broad external-recognition study conducted. Unmeasured reputation is not evidence of poor reputation.          |
| Trustworthiness   | 23/30 | Named owner, email, résumé, matching external accounts, secure public URLs, explicit benchmark caveats; installer-facing creator/privacy/support context needs easier discovery. |

Weights are the skill's internal 20/25/25/30 model, not Google's. A personal developer portfolio does not need agency testimonials, a public street address, certifications, or an article byline on every project to be credible.

**Who / How / Why:** Who is clear on the portfolio and Photo Graph header; Grailed Plus uses the domain rather than a named maker. How is unusually well demonstrated by Photo Graph, partially by source/live links and the extension demos elsewhere. Why is legitimate discovery of creative/technical work and a useful extension—not search-content volume.

**AI citation readiness: 73/100, heuristic.** Distinct entities, SSR text, useful headings, original benchmark and honest limitations are positive. Ownership ambiguity and the P@4 definition reduce the reliability of an extracted project/result claim. No AI-only rewrite, FAQ expansion or special AI file is recommended.

## Prioritized findings

### CONTENT-01 — Medium — Benchmark labels do not describe the calculation or the active-query scope precisely

**URL:** https://dextery.dev/projects/photo-graph

**Observed:** The legend defines P@4 as “the share of the first four results judged relevant.” The calculation first filters the complete ranking to **judged candidates**, then takes four: `scripts/photo-graph/benchmark-color-models.ts:195–209`. Displayed neighbor images instead come from the **unfiltered full ranking** (`:224–234`). Below each active query, “Relevant in top four” and “Ranking agreement” use **aggregate model metrics across seven queries**, not that query's metrics: `app/projects/photo-graph/model-comparison/photo-graph-model-comparison.tsx:206–210,284–299`; averaging is at `scripts/photo-graph/benchmark-color-models.ts:238–243`.

For default query 14, the selected model displays 89% while its saved query P@4 is 100%; none of its first four displayed neighbors carry the Relevant badge. This is explainable by the different scopes, **not proof of invented results**. The published note correctly says unjudged is not wrong, but does not explain this denominator/scope distinction. Evidence: `content-photo-graph-visible-desktop.json`, `content-photo-graph-raw.html`; data: `public/projects/photo-graph/color-model-benchmark-v1.json:1`.

- **Smallest useful change:** Correct the legend to say “first four judged candidates”; explicitly label the unchanged percentages as averages across seven reviewed queries. Distinguish the dated 100-photo benchmark from the evolving live archive. Alternatively, show query-specific metrics in the active-query cards, with the same judged-set qualification. Do not imply 89% is precision over the first four unrestricted live results.
- **Dependency:** Confirm intended evaluation definition with the project owner; no model change or benchmark rerun is necessary merely to fix labels.
- **Verify / falsify:** Trace two query selections against `queries[].precisionAtK` and `models[].metrics.precisionAtK`; labels must explain which value remains constant and which candidate set is counted. If a different calculation is intended, the current report is insufficient to substantiate it.
- **Indicator:** Zero unexplained metric/legend mismatches in a seven-query editorial check; preserve the generation date and reviewed-set count.

### CONTENT-02 — Medium — Real work is visible, but Dexter's contribution is too often inferred

**URLs:** https://dextery.dev/portfolio and https://dextery.dev/projects/photo-graph; applies to project context on the portfolio, including Grailed Plus.

**Observed:** Visible identity says “Dexter Young,” “Software + multimedia,” and the types of work, while the explicit professional role appears in metadata (`app/components/home-page-content.tsx:170–186`; `lib/site-config.ts:3–7`; `lib/seo.ts:26–30`). Project summaries describe the artifact more than Dexter's responsibility, collaborators, constraints or shipped outcome (`app/components/projects/project-catalog.ts:48–192`). The focused project view shows title/summary/stack/links, not contribution (`app/components/projects/project-browser.tsx:545–594`); Photo Graph's shell likewise shows summary/stack/launch (`project-case-study-shell.tsx:41–68`). Its first-person model-testing account is good evidence, but does not delimit ownership of design, photography and implementation (`photo-graph-model-comparison.tsx:109–120`).

The catalog contains `TBD` role/date/outcome values at `project-catalog.ts:67–69,90–92,121–123`; these **are not public placeholders** and were absent in both default and focused DOM. Existing role/outcome values for Elliot and bur1alrites are also not exposed by those views.

- **Smallest useful change:** One compact visible role statement near the portfolio identity; add an owner-approved contribution line and one concrete shipped/qualitative result to existing project copy or focus details. Photo Graph needs a brief “my part / image ownership / experimental scope” clarification, not a long case study. Use the shared catalog, not duplicated prose. “Published extension” or a working archive can be a valid result; do not invent usage, revenue or client-impact numbers.
- **Dependency:** Owner confirmation of credits, collaboration and actual outcomes; no assumption that all depicted photography or client work belongs to Dexter.
- **Verify / falsify:** A first-time reviewer should identify who built what, what Dexter did, and one supported result without opening a PDF or guessing from a brand name. Existing source links/credits that establish those answers would reduce this finding.
- **Indicator:** Five of five displayed projects have verified contribution context; track existing case-study/source/contact/resume engagement if available, without claiming an SEO causal lift.

### CONTENT-03 — Low — Grailed Plus can surface its existing maker and privacy/support corroboration more directly

**URL:** https://dextery.dev/grailed-plus

**Observed:** The visible page links the domain and official Store but does not name Dexter, offer a direct support/privacy route, or explicitly explain its independent relationship to Grailed. See `app/components/projects/grailed-plus/grailed-plus-install-page.tsx:331–450,558–592`. The public Store does provide a developer website back to dextery.dev, a matching developer email and a developer-disclosed “will not collect or use your data” statement. Thus these signals are **not absent from the product ecosystem**; they are one destination away. No privacy breach or policy violation is alleged.

- **Smallest useful change:** Add a restrained maker/support/privacy line near the existing install reassurance, linking to the existing canonical disclosures; clarify affiliation only using owner-approved facts. No new standalone page is required by this finding.
- **Dependency:** Verify that linked disclosures describe the current extension; the landing-page analytics and the extension's data practices are different scopes. Do not copy the Store's disclosure into a blanket site-wide privacy promise.
- **Verify / falsify:** Follow each link without installing; maker/contact must match the Store and any privacy statement must match current behavior. An already-visible equivalent on this URL would falsify the gap.
- **Indicator:** Maintainer, support and privacy are each discoverable from the product page in one action; periodically check identity/contact consistency with the Store.

### CONTENT-04 — Low — Grailed Plus metadata describes a demo gallery more than the installable product

**URL:** https://dextery.dev/grailed-plus

**Observed:** The title enumerates useful features but omits “Chrome extension”; description leads “Explore live Grailed Plus demos…” (`lib/seo.ts:41–45`). The page itself is an install landing with desktop guidance and an explicit free-use claim (`grailed-plus-install-page.tsx:420–449,568–576`). The Store describes the same extension/features. This is an intent/category opportunity, not an excessive-length or duplicate-metadata failure.

- **Smallest useful change:** In the existing metadata definition, identify the Chrome extension and its primary benefit before the demo invitation; retain brand and salient features. Keep any free-use claim only while accurate. No keyword stuffing or rigid character target.
- **Dependency:** Owner-confirmed product positioning and availability; coordinate the snippet promise with demo verification below.
- **Verify / falsify:** Raw and rendered metadata should agree; a searcher should understand what is installed, where it works and why to click. Search Console query/snippet evidence could show current wording already satisfies the intended intent.
- **Indicator:** Branded/feature-query impressions and CTR, plus landing-to-Store clicks in existing analytics, compared cautiously against baseline and channel mix; no promised ranking gain.

### CONTENT-05 — Low — Comparison-image alternatives identify rank, not the visual evidence

**URL:** https://dextery.dev/projects/photo-graph

**Observed:** Informative neighbor photographs use only `Rank N, photo ID` (`app/projects/photo-graph/model-comparison/photo-graph-model-comparison.tsx:254–273`). This repeats the adjacent rank/ID caption but does not describe subject, tone or palette—the evidence the study asks the visitor to compare. Query images have descriptive labels (`:242–245`); empty alts for query-button thumbnails are appropriate because the adjacent button text identifies the choice (`:174–188`). Portfolio poster descriptions are purposeful (`project-catalog.ts:63–64,86–87,118,150,178–179`); the decorative mobile favicon correctly has empty alt (`home-page-content.tsx:75–79`).

- **Smallest useful change:** For the finite comparison set, attach concise, human-reviewed subject/colour descriptions to image IDs and reuse them in image alternatives, retaining rank context where useful. No keyword-oriented alt expansion; do not convert decorative thumbnails into repetitive announcements.
- **Dependency:** Curated descriptions/permission to describe the photographs. `GraphNode` currently has no descriptive text field (`lib/photo-graph/types.ts:79–89`), so plan a small owned metadata source rather than assuming such captions exist or demanding a database migration.
- **Verify / falsify:** Review with images unavailable or a screen reader: can the visitor understand the kind of visual similarity being compared, not just numeric IDs?
- **Indicator:** All informative comparison images have accurate descriptions; decorative/duplicate thumbnails remain quiet. No image-traffic promise.

## Positive checks and explicit non-findings

- **Distinct metadata:** Each page has a unique, relevant title/description pair matching its topic. Portfolio clearly names Dexter's professional category; Photo Graph describes its actual colour-similarity experiment. Deterministic check: `site_risk=low`, `templated_ratio=0.0`, `shared_cta_phrases={}`, no page flags (`content-metadata-template.json`). No rigid length defect assigned.
- **Sound headings:** Portfolio H1 Dexter Young → H2 Projects/Contact → H3 project names; Photo Graph H1 → H2 study/readout → H3 query/process → H4 model names; Grailed Plus H1 → H2 feature index → H3 features. The stylized Grailed “+” has accessible heading name **Grailed Plus**, not a missing H1. Sources: `home-page-content.tsx:178–180`, `project-browser.tsx:206–218,1003–1005`, `animated-editorial-rule-heading.tsx:43–45`, `photo-graph-model-comparison.tsx:101–106,156–158,202–204,229–231,347–351`, `grailed-plus-install-page.tsx:372–383,489–493,528–530`.
- **Real proof:** Photo Graph explains the problem, tested alternatives, selected model, reviewed-set size, results, date, and editorial/non-exhaustive limits. It does not claim semantic image recognition. Preserve this useful original material (`photo-graph-model-comparison.tsx:109–147,326–360,370–396`). Benchmark numbers are a dated study, not a need for automatic freshness churn.
- **Usable contact/trust:** Portfolio has GitHub, LinkedIn, email and résumé links (`home-page-content.tsx:191–208`). GitHub's raw public profile names Dexter Young/TheTexta and links back to dextery.dev. Store listing reciprocates the domain and matches portfolio contact. LinkedIn returned 999; no login/bypass attempted and no negative inference made (`content-corroboration-summary.json`). These are consistency/published-product signals, not independent endorsement or a full reputation audit.
- **No AI-authorship verdict:** Content is specific and low in boilerplate. Bundled heuristics found zero filler/AI-phrase hits and 3–4% bigram repetition. This cannot prove human authorship. Reuse of catalog summaries across an index and its project context is useful consistency, not evidence of scaled-content abuse.

## Raw, visible and interactive content distinctions

- Portfolio card titles/summaries/stack and destination hrefs are in raw HTML. Desktop summary panels are clipped until hover/focus/touch; a DOM/accessibility text extraction can include these without proving they are initially on screen (`project-browser.tsx:169–180,223–230`). On the 500px small-screen layout, project names/buttons and the expanded poster are visible, **not the summaries**; focus view adds the selected summary, stack and case-study/launch links (`:314–390,545–594`). Focus-only copy was not counted as default-visible or default SSR content.
- Photo Graph's explanatory text, initial comparison results and original benchmark figures are SSR and visible without selecting another query. Canvas graph imagery is not substitute text; query switching changes the comparison images.
- Grailed Plus feature benefits/install reassurance are SSR text outside the cross-origin demos. The demos are iframes and are not treated as top-level page copy. Source: `grailed-plus-install-page.tsx:65–98,385–449,478–576`; `grailed-plus-live-demo.tsx:208–223,371–395`.

### Readability / coverage measurements (diagnostic only)

| Page         | Extracted Latin-word count | Estimated Flesch ease | Estimated average sentence words |
| ------------ | -------------------------: | --------------------: | -------------------------------: |
| Portfolio    |                        105 |                  13.9 |                             21.0 |
| Photo Graph  |                        307 |                  40.7 |                             17.1 |
| Grailed Plus |                        172 |                  57.5 |                             14.3 |

Reproducible approximate syllable/word heuristic: `content-prepare-evidence.cjs`, results `content-text-metrics.json`. Proper names, technology labels, lists and extract order distort these figures, especially the portfolio. `extracted_text` omits headings/contact in places and includes both desktop/mobile reassurance variants on Grailed Plus; raw parser counts are 149/669/241 including more UI/labels. **These are not total visible prose lengths or readability/ranking targets.** The automated under-300-token “thin-content” flags for the index/product page are rejected as page-type-inappropriate. Actual coverage gaps are ownership, method precision and installer trust context—not a failure to reach 500/800 words.

## Verification dependency and limitations

- **Observed demo fallback; persistence unconfirmed:** In the isolated Chrome session the Grailed Plus overview and market-compare embeds displayed “Live demo is temporarily unavailable”; initial bundled render captured connecting/lazy-loading states. Evidence: `content-grailed-plus-visible-desktop.json` versus `content-grailed-plus-render.json`; fallback source `grailed-plus-live-demo.tsx:344–367`. This may reduce visible product proof and makes a demo-led snippet less robust. It is **not** proof the extension fails, a measured performance issue, or a diagnosed persistent production outage. Have the technical owner reproduce in an ordinary clean browser; if persistent, restore the demo or provide a truthful static/current-build fallback. Monitor fallback occurrence with existing checks. No server/config change was made or prescribed from this observation alone.
- No Search Console queries, rankings, conversions, backlink data, customer claims, extension install/permission/privacy behavior, or production database were inspected. No causal traffic diagnosis or external-reputation completeness claim.
- LinkedIn inaccessible to this public fetch; résumé is confirmed as a visible link, not independently authenticated credentials. Public GitHub/Store fields are self-controlled/published disclosures, not proof of all ownership or privacy claims.
- Raw/forced-render HTML, accessibility trees, extracted text, metadata pairs/template results, content heuristic outputs and DOM snapshots are preserved as `evidence/content-*`. Browser's Grailed navigation timed out initially, then the loaded document was successfully inspected; it does not invalidate the saved 200 response/SSR evidence.
