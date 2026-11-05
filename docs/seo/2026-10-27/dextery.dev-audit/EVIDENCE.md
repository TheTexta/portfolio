# Evidence archive

This repository archive contains all eleven final specialist/lead findings,
curated structured evidence and seven representative screenshots. The main report
and action plan refer to these retained files for their substantive conclusions.
`evidence/performance-summary.json` is a compact transcription of measured browser
results with conditions/limitations; it intentionally omits advertising request
query strings and full resource logs.

Larger raw HTML, browser traces/snapshots, external-page responses, reproducibility
helpers and additional screenshots remain outside the repository at:

```text
/private/var/folders/bx/htl3m38d3qq52n4zs8z6cyh00000gn/T/opencode/dextery.dev-audit-2026-10-27/
```

Specialist reports retain filenames from that original working directory. A file
they name that is absent from this curated archive should be read there, not
mistaken for a checked-in attachment. That temporary directory may be cleaned up;
the retained summaries support the reported outcomes, but are not a complete
replay archive. Approximately 13 MB of working evidence and 6.6 MB of screenshots
were collected before curation.

## Retained checks

- `technical-analysis.json`: 154 scoped assertions, 0 failures, parsed metadata,
  internal destinations and sitemap signals.
- `technical-fetch-manifest.json`: explicit public status/redirect/UA cases.
- `technical-robots.txt`, `technical-sitemap.xml`,
  `sitemap-analysis.json`: policy, XML and coverage analysis. The original working
  capture was named `technical-sitemap-browser.html`; this archive uses the correct
  XML extension and retains its captured content.
- `schema-observed.json`: exact parsed JSON-LD graph values from captured public
  HTML; `content-findings.json`: content findings/scores and source attribution.
- `content-metadata-*.json`: exact metadata pairs and low-templating-risk check.
- `images-http-head.json`, `image-and-link-inventory.json`,
  `visual-image-support.json`: public asset responses and source/browser geometry.
- `performance-summary.json`: bounded browser measurements, not a Lighthouse score.
- `visual-followup-{desktop,mobile}.json`: focus computed styles, functional query
  activation and settled demo text.
- `demo-direct-fetch.md`: independent timed-out direct request to the demo origin.
- `agentic-ua-parity.json`: representative UA parity, not verified bot identities.
- `agentic-interaction-limit.json`: one failed automation attempt retained as a
  testing limitation; the initial navigation-defect interpretation was withdrawn.
- `geo-summary.json`, `sxo-entry-links.json`, `sxo-serp-notes.md`: qualitative
  content/intent and bounded public-search evidence, not ranking measurements.
- `backlinks-report-data.json`, `backlinks-research.md`,
  `backlinks-validator.json`: two verified inbound examples, profile-level
  measurement limits and reviewed reciprocity warning.
- `content-corroboration-summary.json`: public profile/Store consistency checks,
  not an authenticated ownership or privacy-behavior audit.

Public source references are relative to the repository root and refer to the
inspected checkout. They explain current captures but do not prove deployment
commit identity. No private analytics exports, login cookies, credentials,
authenticated response bodies or database records are part of the archive.

Archived Markdown/JSON is formatted with the repository's Prettier configuration;
structured values are unchanged. Specialist evidence line numbers refer to the
original working copies, not the reformatted archive. Exact raw-response bytes
remain in the temporary working directory; this archive is curated evidence.
