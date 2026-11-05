# Structured data audit — dextery.dev

Status: final, 2026-10-27. Read-only review; repository AGENTS.md/README.md, upstream agent Markdown body and installed seo-schema skill loaded. Reused supplied render captures; no site refetches, installs, credentials, repository writes or production changes. Only this report and evidence/schema-observed.json were authored. Existing modified AGENTS.md, README.md and docs/photo-graph-r2-migration.md preserved.

## Outcome and heuristic score

**92/100 — strong, truthful baseline; no critical/high/medium structured-data defects found.** This is an expert heuristic, not a Google score, ranking prediction or proof of rich-result eligibility. Breakdown: syntax/delivery 25/25, vocabulary/ranges 22/25, semantic fit 24/25, entity relationships 21/25. Deductions reflect minor dimension typing and anonymous project/list entities, not the absence of ratings or a rich result.

## Detection and per-block validation

All three supplied captures return HTTP 200 and report two syntactically valid JSON-LD blocks each, without structured-data truncation:

| Page                  | Block 1                    | Block 2                                                      | Verdict                                                                |
| --------------------- | -------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------- |
| /portfolio            | Person, WebSite; 811 bytes | CollectionPage, ImageObject, ItemList, ListItem; 1,392 bytes | Both JSON syntax PASS; block 2 has low-priority dimension-range caveat |
| /projects/photo-graph | Person, WebSite; 811 bytes | WebPage, ImageObject, CreativeWork; 1,233 bytes              | Both JSON syntax PASS; block 2 has same caveat                         |
| /grailed-plus         | Person, WebSite; 811 bytes | WebPage, ImageObject, CreativeWork; 1,149 bytes              | Both JSON syntax PASS; block 2 has same caveat                         |

Sources: evidence/{homepage,photo-graph,grailed-plus}-render.json. Complete raw_content was parsed independently with Python HTMLParser and json.loads (all six blocks). Both raw_content and content expose two blocks per page and are identical in these captures; captures identify is_spa=false, so markup is present in initial server HTML. This is not an independent post-hydration browser test. No Microdata detected. Nine property-bearing meta tags per page are Open Graph metadata, not separate Schema.org RDFa entities; no other RDFa attributes were detected.

Exact observed parsed JSON-LD, without changed values, is retained in **evidence/schema-observed.json:3–6**: shared block at line 3, portfolio at line 4, Photo Graph at line 5, Grailed Plus at line 6. The wrapper labels are audit metadata, not production markup. Original script bytes remain in the supplied raw_content captures. Local authoring: **lib/seo.ts:85–158**, identity **lib/site-config.ts:1–12**, serialization/escaping **app/components/structured-data.tsx:7–11**. Site insertion **app/layout.tsx:85**; page insertions **app/portfolio/page.tsx:14**, **app/projects/photo-graph/page.tsx:99–100**, **app/grailed-plus/page.tsx:67–68**.

## Checks and positives

- All top-level documents have `"@context":"https://schema.org"` and valid `@graph` containers. Graph containers need not have their own `@type`; all actual entity definitions do. Reference-only `{"@id":...}` objects correctly omit `@type`.
- All URL-valued identifiers, profile links, image links and page links are absolute HTTPS. No dates, fake ratings, offers, placeholder strings or deprecated types are emitted. Catalog TBD fields at project-catalog.ts:67–69, 90–92 are correctly excluded from schema.
- On each page the four named entities are Person, WebSite, ImageObject and page. Every reference resolves to a typed definition across that page's two blocks; zero dangling references. Shared Person/WebSite values agree on all three pages. Repetition across pages is not duplicate-entity corruption because IDs and values remain stable.
- `publisher`/`creator` -> Person, `isPartOf` -> WebSite, `about` -> Person, `mainEntity` -> CreativeWork/ItemList, and image relations -> ImageObject match their expected object ranges. Names, descriptions, captions and job title are strings; sameAs is an array of URL strings; ListItem positions are integers 1–5.
- CollectionPage with an ItemList accurately describes the project collection. ListItem `name`/`url` is valid Schema.org; an `item` object is not mandatory for a generic ItemList. All five names, destinations and ordering match visible captured project text and project-catalog.ts:195–206,229–235. External project URLs are appropriate. This is not a Google-supported portfolio carousel, and missing carousel-specific fields is not a schema error.
- Generic CreativeWork is conservative and appropriate for both projects. Their summaries match captured public copy. Grailed Plus is supported as a browser extension by public install copy and project-catalog.ts:73–100; no need to misclassify it as a physical Product. The owner's portfolio context supports the creator relationship, though identity/profile ownership was not independently authenticated.
- Images correctly describe project posters, not a fabricated headshot or photo-license offer. Same poster content may have page-local ImageObject IDs without conflict. Numeric dimensions match the shared catalog (photo-graph 3306×1859; grailed-plus 1440×820); binary dimensions and image availability were not separately re-fetched in this specialist pass.
- Person.name/jobTitle/sameAs are suitable. The Person.description describes the portfolio rather than a biography; semantically broad, not misleading. WebPage.about pointing to the owner is permissible, with the more specific project supplied by mainEntity.

## Findings and smallest testable recommendations

### SCHEMA-01 — Low: explicit dimension range typing

Observed on all three ImageObjects: `"width":3306,"height":1859` or `"width":1440,"height":820` (**lib/seo.ts:126–127**, exact evidence lines 4–6). Schema.org [width](https://schema.org/width) and [height](https://schema.org/height), checked for v30.1, specify **Distance or QuantitativeValue**, not plain Number. This is a strict expected-range discrepancy, not malformed JSON and not evidence of a Google indexing/rich-result failure. Consumers may be permissive.

Smallest optional improvement: retain dimensions but encode each as QuantitativeValue with the existing numeric `value` and explicit `unitText: "px"`. Alternatively leave the interoperable current representation if the project's validator accepts it; do not remove truthful imagery or treat this as urgent. Test: parse all page blocks, verify each dimension's typed value/unit, and use Schema Markup Validator for general vocabulary checking. No production markup generated in this read-only task.

### SCHEMA-02 — Low: project entities cannot be referenced by stable ID

Both nested CreativeWorks omit `@id` (**lib/seo.ts:138–146**); portfolio ListItems expose only names and URLs (**149–154**). This is valid, but provides weaker explicit linking between a listed project and its detailed entity. Sharing the page URL does not automatically make the anonymous work the page entity; the separate `#webpage` ID already avoids conflating those concepts.

Smallest optional improvement: add stable page-local `#project` IDs to the two first-party CreativeWorks; optionally attach corresponding ListItem.item references to those IDs. Keep external entries' existing URLs unless their exact entities are known. A named `#projects` ItemList is optional, not required. Test: verify distinct work/page IDs, unchanged list order and URLs, and no dangling newly introduced references. No need for a graph-wide rewrite.

### SCHEMA-03 — Info: site-name routing deserves verification, not an invalid-ID finding

Observed WebSite: `"@id":"https://dextery.dev/#website","url":"https://dextery.dev/","name":"Dexter Young","alternateName":"dextery.dev"` (**lib/seo.ts:85–108**). Markup is emitted on /portfolio, while / redirects there. Google [site-name primary documentation](https://developers.google.com/search/docs/appearance/site-names#technical-guidelines) says WebSite should be on the domain/subdomain root URI, and `url` should be its canonical homepage. **However its troubleshooting explicitly says: “If your page redirects to a page that's visible to Googlebot, the site name will reflect the redirect target.”** Therefore do not conclude that this redirect makes site-name selection impossible, or that internal root-fragment IDs are invalid/unresolvable. Root WebSite.url also remains a valid Schema.org URL even though it redirects.

Smallest action: preserve routing and IDs; verify Google's view of root -> /portfolio and actual site-name selection when owner-approved Search Console access is available. Keep consistent preferred/alternate names. A homepage relocation would be a separate routing decision, not justified by this audit alone. Google's same guide explicitly says the Rich Results Test does **not** support site names; use Schema Markup Validator for vocabulary and URL Inspection for Google's view. No claim of actual Google selection was made here.

### SCHEMA-04 — Info: optional SoftwareApplication specificity, Grailed Plus only

The current CreativeWork is valid. If greater entity specificity is wanted, use SoftwareApplication for Grailed Plus's existing mainEntity (still a CreativeWork subtype), retaining creator/image/URL. Public copy says “Grailed Plus is completely free to use” and “Official Chrome Web Store install”; supported facts include extension name, description, feature list, and Chrome dependency. The catalog identifies Chrome MV3. If modeling an install destination, use the actual maintained official store URL, not a guessed one. Do not claim a particular OS matrix or version without checking it; Chrome is a browser dependency, not an operating system. No need to change Photo Graph from CreativeWork in this pass.

This optional change is **not** a missing-schema defect or promised rich result. Google's [software-app guide](https://developers.google.com/search/docs/appearance/structured-data/software-app#structured-data-type-definitions), checked live, requires name, offers.price and **a genuine review or aggregateRating** for its app rich result; applicationCategory and operatingSystem are recommended. Schema.org itself does not impose that rich-result required-field set. A factually free offer can be modeled only if deliberately pursued, but no ratings/review data are supported by these captures: never invent them to satisfy Google. A valid SoftwareApplication may remain ineligible for that feature.

## Scope, limitations and follow-up

No Google Rich Results Test, hosted Schema Markup Validator submission or Search Console inspection was run. Validation here comprises actual JSON parsing, entity/reference traversal, source/public-copy comparison and manual vocabulary/range checks, with primary documentation checks for image dimensions, site names and software-app requirements. It is not an exhaustive external validator result or a formal JSON-LD expansion run. No broad technical, content or performance conclusions are included. No FAQ/HowTo markup, invented pricing, ratings, licenses, product claims or promotional footer are recommended.

Suggested owner-approved implementation order: optional stable project IDs and explicit pixel typing, then evaluate software specificity only if useful. Re-extract all three pages and compare exact graph values after any change. Do not alter site routing solely to chase a site-name interpretation.

## JSON-compatible summary for orchestrator

```json
{
  "category": "Schema / Structured Data",
  "score": 92,
  "scoreKind": "heuristic",
  "pagesChecked": 3,
  "jsonLdBlocksChecked": 6,
  "syntaxFailures": 0,
  "danglingReferences": 0,
  "findings": [
    {
      "id": "SCHEMA-01",
      "severity": "low",
      "title": "Image dimensions use numeric literals outside strict Distance/QuantitativeValue ranges",
      "source": "lib/seo.ts:126-127"
    },
    {
      "id": "SCHEMA-02",
      "severity": "low",
      "title": "Optional stable project entity IDs and list connections",
      "source": "lib/seo.ts:138-154"
    },
    {
      "id": "SCHEMA-03",
      "severity": "info",
      "title": "Verify site-name redirect handling; root fragment IDs remain valid",
      "source": "lib/seo.ts:85-108"
    },
    {
      "id": "SCHEMA-04",
      "severity": "info",
      "title": "Optional Grailed Plus SoftwareApplication specificity, no supported review/rating evidence",
      "source": "lib/seo.ts:138-146"
    }
  ],
  "externalGoogleValidationRun": false,
  "repositoryChanged": false
}
```

Important distinction: these general Schema.org entities do not require prices, reviews or ratings. Lack of a dedicated Google rich-result type is not a schema validation failure. Root-fragment entity identifiers are not invalid merely because / redirects to /portfolio.
