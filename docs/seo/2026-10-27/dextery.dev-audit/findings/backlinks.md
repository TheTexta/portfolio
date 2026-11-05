# Backlink / authority audit — dextery.dev

**Complete bounded audit; 2026-10-27 local date.** Captures: 2026-10-28 01:54 UTC. Initial partial findings were persisted before finalization. No repository/source changes, installs, credential inspection/setup, authenticated/infrastructure access, outreach, submissions, disavow actions, or remote writes.

## Outcome and source coverage

**Backlink Health Score: INSUFFICIENT DATA (0/7 profile-level factors); Not Assessed.** This is missing measurement, not a poor score. No DA, PA, spam score, PageRank, global referring-domain total, or link-velocity estimate is asserted.

| Source / check                             | Status                    | Measured evidence                                                                                                     |
| ------------------------------------------ | ------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Moz, Bing, Keywords Everywhere, DataForSEO | Not Assessed              | Parent supplied Tier 0; no credentialed source used                                                                   |
| Common Crawl domain graph                  | Unavailable within bounds | Source/help inspected; no domain ranking/presence result obtained                                                     |
| Selected public source pages               | Verified sample           | **2 inbound linking pages across 2 source hosts**, among 5 candidates checked; Verify (0.95) for anchor presence only |
| Public branded/domain search               | Inconclusive              | 2 queries; no relevant external linking page discovered in returned results; index coverage/freshness unknown         |

Common Crawl's installed domain lookup streams broad rankings and vertices tables, capped at **500 MiB each**, rather than using an indexed per-domain query. The CLI help was run through the managed launcher, but the table scan was deliberately not started: it exceeds this task's table-download/write boundaries and a partial scan cannot establish absence. Its newest hardcoded release is `cc-main-2026-jan-feb-mar`; the public release page already lists `cc-main-2026-aug-sep-oct`. **Graph presence, rank and authority remain unknown—not zero or “not crawled.”** CC would be domain-level, low-confidence context (0.50), not a backlink inventory. [E2]

## Verified inbound sample

| Source page                   | HTTP | Actual inbound anchor → destination           | rel attribute |
| ----------------------------- | ---: | --------------------------------------------- | ------------- |
| `https://github.com/TheTexta` |  200 | `dextery.dev` → `https://dextery.dev`         | `nofollow me` |
| `https://elliotmairet.com/`   |  200 | `Developed by Dexter` → `https://dextery.dev` | None present  |

These are actual external `<a href>` links in fetched HTML, not outbound links from the portfolio or plain-text mentions. **Two is a sample count/lower bound of observed linking pages, not the site's total backlinks or referring domains.** GitHub is an official self-managed profile; Elliot is a development credit on a portfolio-listed project. Neither is counted as a verified independent editorial endorsement. No ranking value is inferred from GitHub's host reputation or from the absence of a rel attribute. [E1, E3, E4; Verify 0.95]

Other candidates:

- `https://www.linkedin.com/in/dexter-y`: HTTP **999**; **unverifiable access**, not missing/removed. Official path is confirmed locally. [E1, E5, S1]
- `https://bur1alrites.vercel.app/` and `https://thetexta.github.io/nepobabiesruntheunderground/`: HTTP 200; no dextery.dev anchor observed in **raw homepage HTML only**. No prior inbound link was assumed; no browser-rendered inspection was performed. These are not “lost links” or proof of absence from the sites. [E1, E6, E7]

## Remaining profile sections

| Section                  | Conclusion                                                                                                                                      |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Anchor distribution      | **Not Assessed.** Sample has one naked-domain anchor and one name/author-credit anchor; not representative enough for distribution percentages. |
| Referring-domain quality | **Not Assessed.** No domain-quality distribution, independent editorial coverage, geography, or authority metrics available.                    |
| Toxicity / disavow       | **Not Assessed.** No evidence supports a toxic-link or disavow recommendation.                                                                  |
| Top linked pages         | **Not Assessed.** Both sampled links target the root; no site-wide top-page, orphan-page, or linked-404 inventory obtained.                     |
| Competitor gap           | **Not Assessed.** No comparable profile datasets or defined competitor set; no invented gap list.                                               |
| New / lost links         | **Not Assessed.** One point-in-time sample cannot establish acquisition/loss dates or velocity.                                                 |

**Reciprocity context:** `/portfolio` raw HTML has five external HTTP(S) anchors (Elliot, bur1alrites, nepobabies, GitHub, LinkedIn). It links to both verified inbound source hosts, so bidirectional relationships exist with **github.com and elliotmairet.com**. The validator flags these; identity linking and genuine project credit explain the context. Reciprocity alone does not establish a manipulative exchange. [E1, E8; Verify 0.95]

The two public searches returned own-domain pages and/or irrelevant matches, not a new verified external linking page. This is not evidence of zero mentions, zero backlinks, or absence from another index/the web. [E2]

## Proportionate authority actions — recommendations only

No critical/high backlink defect is established. The realistic priorities are:

1. **Medium — retain genuine identity and authorship links.** Preserve the verified GitHub website field and Elliot credit. Manually review the official LinkedIn website field when convenient; this audit could not inspect it. Do not assume it is missing. [E3–E5, S1]
2. **Medium — make completed work easy to cite.** Where project repositories are public and maintained, use concise factual README/demo links to the relevant stable portfolio case study, with genuine authorship and working project URLs. Source destinations already exist for Photo Graph, Grailed Plus and external projects. This is an opportunity, not a finding that any repository currently lacks links. [S2, S3]
3. **Medium — prioritize earned, specific references over link counts.** A reproducible Photo Graph methodology/demo or Grailed Plus release/use-case explanation can support relevant developer/design references. Any future collaborator credit should be accurate, permission-based and editorially appropriate—not a blanket reciprocal-link exchange. No outreach was performed. [S1–S3]
4. **Low — use this small sample as a baseline.** Recheck these exact sources after public profile/project changes; only a later comparable capture can establish change. Broader conclusions require an authorized backlink dataset, not more speculation from search non-results. [E1]

## Evidence and checks

Artifact root: `/private/var/folders/bx/htl3m38d3qq52n4zs8z6cyh00000gn/T/opencode/dextery.dev-audit-2026-10-27/`

- **E1:** `evidence/backlinks-public-links.json` — all six page captures' parsed anchor records/statuses (five external candidates plus portfolio).
- **E2:** `evidence/backlinks-research.md` — query strings/results summary, Common Crawl public URL, exact installed source line references and limitations; `evidence/backlinks-capture.py` — reproducible bounded collector.
- **E3–E8:** `evidence/backlinks-github-raw.json`, `backlinks-elliot-raw.json`, `backlinks-linkedin-raw.json`, `backlinks-bur1alrites-raw.json`, `backlinks-nepobabies-raw.json`, `backlinks-portfolio-raw.json` — raw public HTML and fetch metadata.
- Structured findings: `evidence/backlinks-report-data.json` (Backlink Profile category; safe for parent integration, no shared audit-data edit).
- **S1:** `/Users/dexteryoung/Git Repos/portfolio/lib/site-config.ts:1-12` — identity and official profiles.
- **S2:** `/Users/dexteryoung/Git Repos/portfolio/app/components/projects/project-routes.ts:1-18` — stable project/external destinations.
- **S3:** `/Users/dexteryoung/Git Repos/portfolio/README.md:39-55` — documented public-page/identity architecture.

**Validation:** managed `validate_backlink_report.py` ran before partial and final delivery. Final result **REVIEW, 0 errors, 1 warning** for the two reciprocal relationships explicitly reviewed above; saved as `evidence/backlinks-validator.json`. Manual review confirmed inbound/outbound direction, sample-vs-total distinction, exact anchors/rel values, no unsupported removal/toxicity claims, and no numeric score. Code/build tests not run: no source changes.
