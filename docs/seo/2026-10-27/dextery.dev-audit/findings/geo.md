# GEO / AI search readiness — final, 2026-10-27

**Heuristic readiness: 82/100.** Strong original project evidence and server-delivered content; the main opportunity is making Dexter's specific contribution as explicit to readers as it already is in schema. No critical/high GEO content blocker observed. This is a personal developer/creative-technologist portfolio, not an agency lead-generation site.

## Scope and evidence

Read repo AGENTS/README, upstream agent body, installed `seo-geo` skill and its Google-guidance reference. Reused `evidence/{homepage,photo-graph,grailed-plus}-render.json` for live raw HTML, boilerplate-stripped text, response headers, and structured data. Additional structured findings/search record: `evidence/geo-summary.json` (JSON-compatible material for the orchestrator's **AI Search Readiness** category).

No source/repo edits, dependencies, auth setup, indexing requests, deploys or remote mutations. AI crawler policies, llms.txt, RSL, accessibility trees, WebMCP and discovery endpoints are **delegated to the agentic specialist**, not re-requested. They carry no independent penalty here. Score covers observed content delivery, not verified bot/WAF access or indexing.

## Positives, with evidence

- **Identity and official profiles already exist.** Homepage H1 is “Dexter Young”; contact section links GitHub `TheTexta`, LinkedIn `dexter-y`, email and CV (`app/components/home-page-content.tsx:170-208`). `lib/site-config.ts:3-11` centralizes name, professional role and official profile URLs. All three live pages include Person/WebSite JSON-LD; each project uses a CreativeWork creator reference to that Person (`lib/seo.ts:88-109,130-145`). Do **not** recommend adding missing Person/sameAs markup: it is present. Linked profiles are first-party identity assertions, not independent authority proof.
- **Useful content without JavaScript execution.** All three return 200 in raw-fetch mode with `is_spa: false`. Project descriptions, feature prose, model-comparison metrics and benchmark limitations are present in raw HTML. Interactivity enhances a readable baseline rather than being the only explanation.
- **Original, scoped evidence is a genuine differentiator.** Photo Node-Gallery explains why five models were compared against seven reviewed queries and which model was selected. It defines P@4/ranking agreement and expressly says unmarked matches are unjudged, not wrong (`app/projects/photo-graph/model-comparison/photo-graph-model-comparison.tsx:109-119,206-210`). Its editorial-judgment limitation and 26 Aug 2026 benchmark date are visible (`:326-335`). This is more useful than adding generic “innovative solutions” agency copy.
- **Readable hierarchy and relevant media.** Homepage H1→Projects H2→five H3 titles; Photo Graph H1→H2→H3/H4 model hierarchy; Grailed Plus H1→H2→feature H3s. Real imagery, interactive comparison and live product demos support the claims. ImageObject schema includes captions/dimensions (`lib/seo.ts:121-128`).
- **No observed on-page snippet suppression.** Each page has `author: Dexter Young`, Googlebot `max-image-preview:large`, and no observed `noindex`, `nosnippet`, restrictive `max-snippet`, `data-nosnippet` or restrictive X-Robots-Tag in the supplied HTML/headers. Source: `app/layout.tsx:65-70`. These are favorable on-page signals, **not proof** of Google indexing, snippet eligibility as determined by Google, or AI-feature inclusion.

Extraction caveat: the homepage's boilerplate-stripped text omits its H1/contact even though both are in raw HTML. Photo Graph's extracted order begins with Model 01 metrics although raw HTML includes title/summary. Do not mistake extraction behavior for missing identity or missing SSR.

## Prioritized findings

### GEO-01 — Medium: explain the creator's contribution in visible project context

**Evidence:** Homepage identifies Dexter and the kinds of work, but does not provide a complete short professional introduction (`app/components/home-page-content.tsx:170-186`). Project shell shows category, summary and stack, not role (`app/components/projects/project-case-study-shell.tsx:41-68`). Photo Graph and Grailed Plus catalog roles/dates/outcomes remain internal `TBD` (`app/components/projects/project-catalog.ts:67-69,90-92`); these placeholders were **not observed as public copy**. Creator identity is present in the site header, metadata and schema, so this is not anonymous authorship.

**Impact:** a recruiter, collaborator or extracted passage can understand what a project does without learning what Dexter personally designed/built, when, or whether collaborators supplied the photography/content. Especially useful for distinguishing photographer/client identity from website developer identity.

**Minimal fix:** owner-approved one-sentence introduction plus brief project “Role / contribution / period” text drawn from the existing catalog. Verify contribution boundaries and image authorship first; do not invent solo ownership, results or credentials. **Effort:** 1–2 hours after owner fact-checking.

### GEO-02 — Low: make Grailed Plus's first definition self-contained

**Evidence:** Hero introduces “A sharper layer for Grailed” and “Market context, local currency, and a native-feeling dark mode” (`app/components/projects/grailed-plus/grailed-plus-install-page.tsx:365-392`). Feature descriptions are concrete (`:65-98`), and desktop Chrome installation/store links establish product type, but readers must combine several fragments to identify product, platform and creator.

**Minimal fix:** near the existing hero, use a natural sentence such as: “Grailed Plus is a Chrome extension by Dexter Young that adds cross-market comparison, price context, currency conversion and dark mode to Grailed.” Confirm authorship before using it; do not claim affiliation with Grailed. Keep shopper-focused benefits and the Store install action. **Effort:** 15–30 minutes. This is ordinary clarity, not a special AI phrase requirement.

### GEO-03 — Low: attach the benchmark snapshot scope to quotable counts

**Evidence:** “Reviewed set” correctly reports 100 photographs and seven queries; notes date the benchmark to 26 Aug 2026. Later standalone prose says “it turns 100 photographs into a field of visual neighbours” (`app/projects/photo-graph/model-comparison/photo-graph-model-comparison.tsx:124-147,326-335,354-360`; `public/projects/photo-graph/color-model-benchmark-v1.json:1`). Page loads the static benchmark separately from graph nodes (`app/projects/photo-graph/page.tsx:74-95`).

**Impact:** a detached passage may present the historical evaluated set as a current archive size, or present editorial benchmark metrics as general image-search accuracy. No current live count or runtime-model agreement was independently verified here; no claim that the benchmark is false.

**Minimal fix:** call it the “100-photo benchmark set, evaluated 26 Aug 2026” in that paragraph; identify metric scope beside results. Optional link to the existing public benchmark JSON for reproducibility. Preserve historical dates; do not refresh dates to manufacture freshness. **Effort:** 30–60 minutes.

## Score breakdown

| Dimension                  |     Points | Basis                                                                                                        |
| -------------------------- | ---------: | ------------------------------------------------------------------------------------------------------------ |
| Citability                 |      18/25 | Strong technical passages; standalone ownership/product/snapshot context could improve                       |
| Structural readability     |      18/20 | Logical headings, short prose, lists and definition lists                                                    |
| Multimodal content         |      14/15 | Relevant original media, demos and comparison; no need to add video for a checklist                          |
| Authority/entity signals   |      12/20 | Consistent name/profiles/schema, but limited visible contribution context; external corroboration unverified |
| Technical content delivery |      20/20 | Observed raw HTML and preview controls only; bot access/indexing excluded                                    |
| **Total**                  | **82/100** | Editorial heuristic, not a Google/provider metric or prediction                                              |

## Bounded brand corroboration and platform limitations

Two public branded searches only; queries/results are recorded in `evidence/geo-summary.json`:

1. `"dextery.dev" "Dexter"` returned unrelated Dexter-TV results; domain/exact-query handling was unhelpful. **Not evidence of absent indexing or brand presence.**
2. `"TheTexta" "Dexter Young"` surfaced the first-party `/portfolio` page with the correct developer title and contact-profile snippet. No independent corroboration was established by that result.

GitHub and LinkedIn are linked on-site, but reciprocal profile claims were not independently inspected. Wikipedia/Wikidata, Reddit and YouTube presence are **not established**, not “missing.” No notability-page creation, forum mention farming or generic brand campaign is justified by this audit.

| Platform                   | Qualitative readiness; actual visibility not measured                                                                           |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Google AI Overviews        | Readable first-party evidence and no observed snippet suppression; indexing, selection and any account-level exclusions unknown |
| Google AI Mode             | Same baseline; cannot infer citations from classic rankings or from this score                                                  |
| ChatGPT Search             | Raw HTML is usable; OAI-SearchBot/WAF findings delegated; citation selection unmeasured                                         |
| Claude search / Perplexity | Raw HTML is usable; provider-specific crawler access delegated; citations unmeasured                                            |
| Bing Copilot               | Content/entity baseline is sound; Bing indexing and citations unmeasured                                                        |

No per-platform numeric scores or actual AI citation rate/rank/traffic claims: no provider measurement tools or relevant authenticated analytics were available. Training crawler rules do not establish search citability. llms.txt/WebMCP are not Google indexing or AI-citation requirements.

## Smallest next steps, verification and leading indicator

1. **Visible intro** matching the existing name/role/profile schema; owner-approved facts only (30–45 min).
2. **Contribution context** on existing projects, without exposing TBDs or duplicating catalog truth (1–2 h).
3. **Single-sentence Grailed Plus definition**, preserving the real user/install journey (15–30 min).
4. **Benchmark snapshot attribution**, optionally linking the existing report (30–60 min).
5. **Verify official profile consistency** during the owner's next normal profile review: same name/domain and truthful project links; only correct discrepancies found, no new profiles required (15–30 min). Independent corroboration remains an evidence gap, not a proven defect.

Dependencies: owner confirmation of roles/collaborators, dates and ownership; no new service, tracking setup or external mutation needed for the content work. Existing Person/CreativeWork/ImageObject relationships are sufficient for this scope; no extra AI schema is required.

Verification after any separately approved implementation: raw GET of the three pages, compare plain text with schema/profile facts, check benchmark wording, then existing `npm run seo:validate` plus normal repo checks. Not run here because source was unchanged and this was a bounded read-only specialist pass. **Leading indicator:** all three pages contain an accurate human-readable person→role→project relationship, and a detached benchmark passage retains date/corpus/limitation. This is verifiable content completeness, not a promise of citation gains.

Do not add FAQ/blog filler, fixed 130–170-word chunks, question headings purely for AI, fabricated impact statistics, artificial “updated” dates, or agency boilerplate. Existing portfolio-specific original work is the asset to clarify.
