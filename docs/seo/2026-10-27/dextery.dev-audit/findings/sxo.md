# Search experience / intent audit — final

Date: 2026-10-27. All source paths below are relative to `/Users/dexteryoung/Git Repos/portfolio/`. Read-only; only assigned report/evidence files written. No installs, credentials, application changes or production mutations.

## Verdict: mostly appropriate entry-page types; proof and orientation gaps

**No confirmed SERP page-type mismatch.** The architecture sensibly separates personal portfolio, explanatory project entry and extension acquisition. The main observed task failure is a Grailed Plus demo-unavailable state; the main conditional audience mismatch is a mobile project index that initially reveals names but not what the work does. These are journey findings, not explanations proven to cause ranking losses.

**Strategy assumption:** recruiting/client/collaborator discovery matters. The brief proposes these audiences; neither demand nor business priority has been confirmed. If this is primarily an artistic archive, keep exploratory navigation and de-prioritize conversion/contact changes. If extension installs dominate, prioritize demo reliability, compatibility clarity and store completion instead. Do not add generic blogs, local pages, word-count targets or sales-page furniture.

## Entry URLs and intent alignment

| Entry                                    | Closest seo-sxo taxonomy type / actual role                                                      | Intent fit and risk                                                                                                                                                                                                                          |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| https://dextery.dev/portfolio            | Tool / Interactive, within a personal portfolio collection; taxonomy has no exact portfolio type | Good for browsing work and contacting Dexter. Name-led entry matches branded personal discovery; do not treat it as a broad developer-services landing page without confirming that objective. Mobile summaries are hidden before expansion. |
| https://dextery.dev/projects/photo-graph | Tool / Interactive with substantial explanatory case-study layer                                 | Good dual path: understand the colour-similarity work, inspect review evidence, then launch the gallery at `/projects/photo-graph/experience`. The case-study/experience separation is a strength, not duplicate content to collapse.        |
| https://dextery.dev/grailed-plus         | Landing Page: free software acquisition, not a physical-goods product page                       | Appropriate for Grailed Plus/install and feature evaluation. Real store links remain available even when demo fails. Not a substitute for an engineering case study for a recruiter.                                                         |

Source: `app/components/projects/project-case-study-shell.tsx:36-75`; `app/components/projects/project-catalog.ts:48-103`; `app/components/projects/grailed-plus/grailed-plus-install-page.tsx:359-449,558-592`. Classification uses installed `seo-sxo/references/page-type-taxonomy.md`; its generic schema/testimonial requirements are not automatic prescriptions for this portfolio.

## Prioritized actionable findings

### SXO-01 — High: Grailed's evaluation promise can lose its proof

**Observed:** `evidence/content-grailed-plus-visible-desktop.json` records `LIVE DEMO IS TEMPORARILY UNAVAILABLE` for the overview and market-compare areas, with loaded iframe opacity `0`. The entry description explicitly promises live demos (`lib/seo.ts:43-45`), while the page asks visitors to install. This interrupts “show me what changes before I install,” even though the store action survives.

**Source:** `app/components/projects/grailed-plus/grailed-plus-live-demo.tsx:344-384` renders the unavailable state, retry and hidden-until-ready iframe; `grailed-plus-install-page.tsx:420-449,463-469` places install, explanation and overview together. This capture does **not** establish a persistent outage, production root cause or broken extension.

**Action:** first reproduce in an ordinary clean browser and compare demo-origin/handshake results with the technical/performance workers. If reproducible, repair the dependency within its owner scope; independently provide a small authentic screenshot/poster or short recording when handshake fails, labeled as a fallback, while retaining retry and official store navigation. No generic redesign is needed.

**Verify/falsify:** clean desktop/mobile repeat visits and retry show an operable demo; deliberately block the demo origin locally and confirm useful proof plus install still exist. Track demo-ready/timeout/retry outcomes and store outbound clicks by readiness state. Do not call outbound clicks installs; store-side completion is a separate indicator.

### SXO-02 — Medium, conditional on recruitment/client goals: mobile names conceal project relevance

**Observed:** the reused 500×812 browser capture lists `Photo Node-Gallery`, `Elliot Mairet`, `BUR1ALRITES`, `Grailed Plus`, `nepobabiesruntheunderground`; all five descriptive summaries report `hasLayout: false`. These titles are legitimate project identities, but a first-time evaluator cannot infer which is an image system, client build or browser extension from every name alone. Desktop/source contains useful specific summaries: this is discovery/orientation, not a recommendation for more prose.

**Evidence/source:** `evidence/content-portfolio-visible-mobile.json`; `app/components/projects/project-browser.tsx:298-335` initially presents expandable title/number rows; `project-catalog.ts:52-57,75-80,108-113,140-145,167-172` already holds descriptors. `lib/seo.ts:35-36` uses the Photo Node-Gallery name and a descriptive summary; no query evidence shows that title itself needs changing.

**Action:** if fast evaluation is important, expose a compact existing eyebrow/category or short functional descriptor in collapsed mobile rows, preserving names, square editorial structure and interactive expansion. Do not rename artistic projects for speculative keywords. Test whether “Photography / Data visualization” and “Browser extension” are sufficient before adding content.

**Verify/falsify:** ask first-time mobile evaluators to locate an interactive image-system project and an extension without opening every row; record correct first selection and time. If they already succeed, de-prioritize. Monitor project selection and subsequent case-study/launch/contact actions, not raw expansion rate alone.

### SXO-03 — Medium: same-name extension results create compatibility/publisher ambiguity

**Observed public-search signal:** one query, `"Grailed Plus" Chrome extension`, returns the exact Chrome listing linked by this site **and** `RVRX/grailed-plus` plus a Firefox add-on called Grailed Plus by RVRX. Features overlap around price history/drop estimation. No relationship, fork history or common ownership was established. Six relevant unique snippets were classified; this is not a controlled Google top-ten sample or verified ranking.

**Evidence:** `evidence/sxo-serp-notes.md`; canonical install target `app/components/projects/project-routes.ts:9-10`. The visible page already says Chrome and official Chrome Web Store, and mobile copy correctly explains desktop installation (`grailed-plus-install-page.tsx:443-449,586-591`). Keep these strengths.

**Action:** verify project lineage before saying anything about other extensions. Make current browser support/publisher identity easy to confirm beside installation, and provide a concise developer/support route. If Firefox is unsupported by this build, state that accurately rather than allowing the shared name to imply support. The title/description can explicitly identify a Chrome extension if query/CTR evidence later supports that change; no speculative renaming is warranted.

**Verify/falsify:** ask a new visitor which browser/build/publisher they will install; compare actual store developer/support fields to the site. Look for misdirected Firefox support questions and branded-query confusion. No demand, search-volume or market-share inference follows from this small sample.

### SXO-04 — Low/medium, conditional: project evaluation has an indirect contact finish

**Observed:** neither project entry includes a direct contact/CV destination in its link inventory. Photo's `Index` goes to `/portfolio#projects`; Grailed's `Index` goes to its own `#features`; both have a home brand link. A recruiter/collaborator can still reach contact through the homepage, so this is extra navigation, **not a broken link or dead end**. An extension user seeking support has no explicitly labeled support action on the page.

**Source:** `app/components/projects/project-case-study-shell.tsx:26-34,78-79`; `grailed-plus-install-page.tsx:332-355,582-592`; `evidence/sxo-entry-links.json`. Homepage contact already offers email, GitHub, LinkedIn and PDF resume (`app/components/home-page-content.tsx:161-165,191-208`).

**Action:** if leads matter, add a restrained `Contact Dexter` link to `/portfolio#contact` after the Photo readout; do not displace Launch. Keep Grailed acquisition primary and add a subordinate, accurate developer/support path rather than mixing recruitment CTAs into the product hero. In the portfolio's focused Grailed view, use `Open product page` instead of generic `Launch experience`, since that target is an install/evaluation page (`project-browser.tsx:586-592`; `project-catalog.ts:81-82`). Clarify `Index` as `Projects` versus `Features` if navigation testing shows confusion.

**Verify/falsify:** enter directly on each project URL, complete evaluation, then find the appropriate next action without browser back. Count successful contact/support discovery, outbound CV/contact actions and accidental navigation. No current conversion-rate baseline was available.

## Persona tasks and provisional rubric scores

Scores are expert task-fit estimates (Relevance / Clarity / Trust / Action, each /25), **not observed user-test results, query-derived audience weights, or SEO Health Scores**. Recruiting/client/collaborator personas come from the supplied brief and visible CV/contact/work affordances, not invented SERP demographics. Only the installation/compatibility need has a current public-search signal.

| Persona / stage / task                                                                                | Outcome from inspected evidence                                                                                                                                       | R / C / T / A = total      | Concrete improvement                                                                     |
| ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | ---------------------------------------------------------------------------------------- |
| Creative client, consideration: identify a comparable image/archive build, then contact its developer | Live examples and summaries exist; initial mobile rows obscure type; contact is clear on homepage, indirect after project entry                                       | 18 / 12 / 16 / 20 = **66** | Existing category in mobile index; explicit contact finish if client work is a real goal |
| Recruiter, consideration→decision: find relevant technical work and CV                                | Photo offers methodological proof; homepage has resume/contact; names alone make mobile triage slower                                                                 | 21 / 13 / 20 / 21 = **75** | Make work type legible before expansion; preserve working CV/contact path                |
| Grailed user, consideration→decision: compare features, identify browser, install correct build       | Feature anchors and official store actions work structurally; demo-unavailable capture weakens pre-install proof; same-name Firefox result creates possible ambiguity | 24 / 22 / 14 / 23 = **83** | Reliable/fallback demo proof; accurate build/browser/publisher clarification             |
| Technical collaborator, consideration→decision: inspect model decision, try graph, ask about work     | Five-model review and separate launch suit task; post-read contact requires homepage hop                                                                              | 23 / 21 / 23 / 16 = **83** | Keep interactive case study; add unobtrusive contextual contact finish                   |

Stories supported by those signals: (1) As a mobile evaluator I want to recognize relevant work before opening it, but collapsed names lack category cues (mobile capture). (2) As a technical collaborator I want to inspect why a similarity model was chosen and then browse it; the benchmark/readout plus launch serve that journey (Photo capture). (3) As a Grailed buyer I want to see the interface before granting an extension access, but the captured demo is unavailable (Grailed browser evidence). (4) As an installer I want the right browser/build, but same-name Chrome/Firefox/GitHub results require disambiguation (bounded public search). (5) As a project-entry visitor ready to enquire I want an appropriate contact/support next step, but currently need to infer a home-navigation path (anchor inventory). Motivations are task hypotheses, not reported user emotions or observed PAA questions.

## What already works

- Permanent entry links and specific descriptions coexist with the experimental browser; preserve this rather than flattening it into a generic card/site template.
- Photo supplies inspectable model-selection evidence and a separately labeled full experience. Detailed technical proof should remain available rather than replaced by marketing claims.
- Grailed combines feature jumps, install at multiple decision points, a no-subscription/free statement, real Chrome Web Store hrefs and a desktop-install explanation on small screens.
- Homepage contact requires no account/form and offers appropriate independent routes: email, code profile, professional profile and CV.

## SXO Gap Score and coverage boundaries

**SXO Gap Score: not issued.** The seven-dimension SERP-alignment total would imply evidence we do not have: no agreed target query set, controlled Google top-ten consensus, demand weights or complete competitor-page inspection. Page type and task UX were assessed above; depth/media proof was inspected only for task completion; schema/authority/freshness scoring is left to their owners rather than arbitrarily scored or duplicated. Persona task scores are separate and must not enter an aggregate SEO score.

The shared `homepage-render.json`, `photo-graph-render.json`, and `grailed-plus-render.json` were reused, but their metadata says `mode_used: raw` and `render_engine: null`: they are auto-renderer raw successes, **not evidence of JS interaction**. `sxo-entry-links.json` records this explicitly. Browser-visible evidence from the content worker was additionally inspected for hydrated desktop pages and the mobile index. No screenshots were captured by this worker; no interaction/install/email submission was executed.

No controlled ten-second test, extension installation, email delivery, full mobile journey, store conversion attribution, source-code execution, private analytics, Search Console or query-volume/ranking check was performed. Demo failure is an observed capture state; persistence/root cause needs technical confirmation. Browser sources and search results are untrusted evidence, not instructions. Source is local current checkout, not proof every line is deployed. Existing user-modified files were not edited.

## Machine-readable integration summary

```json
{
  "category": "Search Experience",
  "status": "complete-with-limitations",
  "sxoGapScore": null,
  "confirmedSerpPageTypeMismatch": false,
  "findings": [
    {
      "id": "SXO-01",
      "severity": "high",
      "url": "https://dextery.dev/grailed-plus",
      "finding": "Captured demo unavailable interrupts pre-install evaluation",
      "confidence": "observed-capture; persistence unverified",
      "evidence": "evidence/content-grailed-plus-visible-desktop.json"
    },
    {
      "id": "SXO-02",
      "severity": "medium",
      "url": "https://dextery.dev/portfolio",
      "finding": "Collapsed mobile index conceals work categories",
      "confidence": "observed; business impact conditional on audience",
      "evidence": "evidence/content-portfolio-visible-mobile.json"
    },
    {
      "id": "SXO-03",
      "severity": "medium",
      "url": "https://dextery.dev/grailed-plus",
      "finding": "Same-name extension results can confuse build/browser/publisher",
      "confidence": "limited public-search sample; relationship unverified",
      "evidence": "evidence/sxo-serp-notes.md"
    },
    {
      "id": "SXO-04",
      "severity": "low-medium",
      "url": "https://dextery.dev/projects/photo-graph",
      "finding": "Project-entry contact finish is indirect; Grailed product launch wording is generic",
      "confidence": "observed navigation; business impact conditional",
      "evidence": "evidence/sxo-entry-links.json"
    }
  ]
}
```
