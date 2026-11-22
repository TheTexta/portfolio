# Search metadata and indexing

## Sources and route policy

`lib/site-config.ts` holds identity and official profile links. `lib/seo.ts`
defines public-page metadata, preview images and content-update dates.
Update a page's `lastModified` after significant changes to content, links or
structured data; sitemap generation does not advance dates automatically.

Project imagery/dimensions come from the shared catalogue. Public pages include
Open Graph/Twitter previews, JSON-LD and permission for large Google image
previews. `/sitemap.xml` includes project posters on the portfolio and each
project's own poster on its page. Page entries come only from `PUBLIC_PAGES`.
External destinations, including Nepobabies' GitHub Pages site, remain ordinary
links, not sitemap pages. Tests and the HTTP validator require every sitemap page
URL to belong to `https://dextery.dev`.

Project cards expose permanent links alongside the interactive browser.
Experience routes remain crawlable with `noindex, nofollow` so crawlers can read
their restrictions. Admin/API paths are blocked in robots.txt. Legacy public
routes remain crawlable so their permanent redirects or 404s can be observed.
The seven former `/projects/<project>` article routes permanently redirect to
`/write-ups/<project>`, preserving queries; experience/media paths stay unchanged.
The `/write-ups` redirect targets the homepage About article list.

## HTTP validation

```bash
npm run build
npm start
```

In a second terminal:

```bash
npm run seo:validate
```

The default target is `http://localhost:3000`. For a separately requested
post-deployment check, use
`npm run seo:validate -- --base-url https://dextery.dev`.

The validator only makes GET requests and exits nonzero on failure. It checks
ordinary/Googlebot agents, page status, titles, descriptions, canonicals,
server-rendered content/links, sitemap URLs/images/dates, crawl rules,
experience-page noindex, legacy redirects and the removed preview's 404.
Local pages intentionally declare production canonicals.

Pages must emit exactly one canonical link inside `<head>` and none elsewhere.
Title checks also use `<head>` so SVG accessibility titles cannot cause false
failures. Only when targeting `https://dextery.dev`, the validator additionally
checks HTTP and `www` redirect chains for the portfolio and Grailed Plus.
It requires permanent HTTPS redirects preserving path/query and ending in
HTTP 200 on the non-`www` canonical. Local checks do not probe these production
redirects. Offline regression tests cover both checks.

These smoke checks do not prove Google access or indexing, and do not change
Search Console or hosting settings.

## Hosting and Search Console

The recorded Vercel domain configuration redirects `www.dextery.dev` to
`dextery.dev` permanently with HTTP 308 rather than the automatic temporary 307.
When separately authorized to change hosting settings, verify path/query
preservation, for example
`https://www.dextery.dev/grailed-plus?view=hero` →
`https://dextery.dev/grailed-plus?view=hero`. HTTP should also permanently
redirect to HTTPS. Repository checks do not configure hosting.

After an approved deployment, submit `https://dextery.dev/sitemap.xml` in Search
Console and inspect priority canonicals such as `/portfolio`,
`/write-ups/photo-graph` and `/grailed-plus`. Use **Test Live URL** to inspect
rendered content/canonical selection and **Request indexing** where appropriate.
The URL Inspection API reports recorded status; it cannot perform those actions.
Do not use Google's restricted JobPosting/BroadcastEvent Indexing API for
ordinary portfolio pages.

Investigate affected URLs before treating duplicate, unauthorized (401) or
crawled-but-unindexed counts as defects. Redirect sources and protected endpoints
may be intentional exclusions. The four HTTP/HTTPS and www/non-www homepage
variants intentionally end at `https://dextery.dev/portfolio`; “Page with
redirect” is expected for their sources. Inspect the final canonical instead.
For an old malformed sitemap report, compare its last-read date with live XML
and resubmit the current sitemap. The October 6, 2026 coverage export has only
aggregate counts and a chart ending September 20; it cannot establish current
URL-level problems.

Read-only Search Console OAuth permits audits, not sitemap submission: submission
requires `https://www.googleapis.com/auth/webmasters`. The recorded
20 November 2026 attempt failed for insufficient scope despite property-owner
permission. Until reauthorized, use the Search Console UI.

Search appearance/indexing remain Google's decision. The `/` → `/portfolio`
redirect is intentional; if homepage routing changes, recheck site-name
eligibility because Google's `WebSite` documentation specifies domain-root
placement. Historical audit evidence is under
[`2026-10-27/dextery.dev-audit/`](2026-10-27/dextery.dev-audit/).
