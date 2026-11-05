# Bounded backlink evidence log

Audit label: 2026-10-27 (local). Public captures started 2026-10-28T01:54:25Z (UTC). No authenticated requests, infrastructure MCP, source edits, installs, outreach, submissions, or disavow operations.

## Local scope and identity sources

- Read `/Users/dexteryoung/Git Repos/portfolio/AGENTS.md` and `README.md`.
- Read Markdown body of `/Users/dexteryoung/.claude/agents/seo-backlinks.md`; loaded installed `seo-backlinks` skill. Claude-only frontmatter not followed.
- `portfolio/lib/site-config.ts:1-12`: canonical origin and official GitHub/LinkedIn paths (`TheTexta`, `dexter-y`).
- `portfolio/app/components/projects/project-routes.ts:9-17`: project/store/external destinations. These local outbound URLs were only candidates to check, not proof of inbound links.
- `portfolio/README.md:39-55`: identity source, public pages and permanent links; `:92-95`: documented root redirect. Root redirect was not independently fetched in this bounded backlink task.
- Credentials/tier: parent supplied `backlinks_auth --check` Tier 0. Did not rerun credential discovery or read config, secrets, or .env.

## Common Crawl feasibility

Inspected `/Users/dexteryoung/.claude/skills/seo/scripts/commoncrawl_graph.py` in full; ran:

```sh
"$HOME/.claude/skills/seo/scripts/claude-seo" run commoncrawl_graph.py --help
```

Help exposes positional domain, `--info`, `--release`, `--update`, `--timeout`, `--top-referrers`, `--json`. `--top-referrers` is explicitly a legacy no-op. No bounded indexed per-domain lookup flag is provided.

Relevant source references:

- `commoncrawl_graph.py:48-55`: newest hardcoded known release is `cc-main-2026-jan-feb-mar`.
- `:164-228`: streaming/decompression helper with a **500 MiB compressed-byte cap per table**; timeout is a request timeout, not a total audit deadline; partial/truncated scans can return no matches.
- `:283-321`: domain lookup streams the rankings table, then the vertices table on a miss. It does not perform an indexed domain query.
- `:323-329`: generic absence wording cannot distinguish a completed full scan from a bounded/incomplete scan. Do not repeat it as a domain-absence finding.
- `:353-354`: full lookup writes a shared cache; not started under the artifact-only write boundary.

Fetched only the public explanatory release index, **not graph tables**:

- URL: `https://commoncrawl.org/web-graphs` (public webfetch).
- Observed first listed release: `cc-main-2026-aug-sep-oct`, followed by `cc-main-2026-jul-aug-sep` and rolling three-month releases. This is newer than the script's hardcoded list; do not assume the script automatically selects the current release.
- Official description: graphs include technical links (images, scripts, fonts); domain graph aggregates at pay-level domain using Public Suffix List.
- Result: **domain lookup unavailable within authorized time/table-download bounds**. PageRank, harmonic centrality, ranks, and graph presence are unknown. Neither zero values nor absence from Common Crawl were established.

## Public searches (two queries only)

1. `"dextery.dev" "Dexter"`: returned own-domain URLs `https://dextery.dev/portfolio` and `https://dextery.dev/`, plus unrelated Dexter names/products/repositories. Did not discover a relevant external linking page in returned results.
2. `"dextery.dev" -site:dextery.dev`: returned unrelated pages, including generic domain tools and unrelated development sites. No relevant external linking page discovered in returned results.

This provider returned loose/irrelevant matches despite quotes. Search result freshness and completeness are unspecified. These queries do **not** establish zero branded mentions, zero backlinks, Google/Bing index absence, or absence on the web. No unrelated result was counted as a mention/link.

## Raw public anchor verification

Collection script: `backlinks-capture.py`; managed `render_page.py --mode never --no-extract --json`, six concurrent public pages, 40-second total subprocess deadline per page. Six page-fetch invocations: five candidate external source pages plus one portfolio page for outbound/reciprocal comparison. Raw JSON evidence is retained with response headers omitted. URLs are fetched through the installed renderer's guarded URL-safety client. No browser rendering, login, cookies from a user profile, or platform-specific authenticated API.

Evidence detail: `backlinks-public-links.json` includes parsed anchors and HTTP status for each page; individual `backlinks-*-raw.json` files retain full fetched raw HTML. Verified href matching uses exact hostname `dextery.dev` / `www.dextery.dev` (not plain-text mentions or substring domains).

Verified anchor excerpts (from fetched HTML):

```html
<!-- https://github.com/TheTexta -->
<a
  rel="nofollow me"
  class="Link--primary wb-break-all"
  href="https://dextery.dev"
  >dextery.dev</a
>

<!-- https://elliotmairet.com/ -->
<a class="animated-index-link mt-[1lh] no-underline" href="https://dextery.dev"
  >Developed by Dexter</a
>
```

Portfolio raw HTML contains five external HTTP(S) anchors: Elliot, bur1alrites, nepobabies, GitHub and LinkedIn. This count excludes mailto and internal links and is not an inventory of dynamic interaction/iframe destinations. Both verified inbound hosts are among these five: bidirectional relationships are observed, not inferred toxicity.

## Validator

Ran managed `validate_backlink_report.py --report evidence/backlinks-report-data.json --json` before the partial findings file and again before final delivery. Initial baseline PASS; final result saved to `backlinks-validator.json`. The final expected reciprocal-link warning is reviewed in the findings; no numeric score or removal claim is made.
