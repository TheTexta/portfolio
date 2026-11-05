# Agent readiness — final (2026-10-27 local / 2026-10-28 UTC)

## Summary

Public reading and contact discovery work well. No tested AI-token request was blocked or challenged; the accessibility tree has named navigation and controls. Source review confirms project-details buttons deliberately open a focus view that already contains genuine destination links. One automated activation timed out, but no broken intended navigation task was established; it is a testing limitation, not a confirmed site defect.

- **Lighthouse Agentic Browsing: not measured**, mobile and desktop. Exactly **two PSI requests** were issued by this worker's single managed `--strategy both` invocation: mobile, then desktop; both returned HTTP 429 quota exceeded. The wrapper automatically continued to desktop after the mobile 429; its source has one `requests.get` per strategy and no retry loop (`lighthouse_agentic.py:328-352,403-409`). No further Google API calls were made by this worker, and none will be made after the known 429. No Lighthouse version, fraction, per-audit result or counted-audit path was obtained. Standard accessibility is not substituted for this metric.
- **Agent-UX heuristic: 100/100, complete, homepage only.** Managed check: 196 tree nodes, 18 interactive nodes, 10 buttons, 7 links, zero unnamed interactive nodes; zero unlabelled inputs. This shallow score does not measure successful tasks; intended focus-view-to-destination completion remains untested. No defensible whole-site agent-success score is assigned.
- **Confirmed critical access/name failures: none in the tested scope.** Real verified-agent/WAF behaviour and all interactive paths remain untested.

## Tested access and policy

`GET https://dextery.dev/portfolio` with ordinary audit UA, `GPTBot/1.2`, `OAI-SearchBot/1.3` and `ChatGPT-User/1.0`: **200 HTML for all four**, identical 56,141 bytes and SHA-256, title/project/contact present, no challenge text or `cf-mitigated` header. Evidence: `agentic-ua-parity.json`. These are unverified strings from one audit host, not authenticated crawler requests, Google indexing evidence, or AI visibility evidence.

- **Training:** wildcard robots policy allows public pages for GPTBot/ClaudeBot and other matching tokens; no separate training restriction or Content-Signal declared. This is the existing choice, not an error; do not change it without owner approval.
- **Search:** OAI-SearchBot, Claude-SearchBot and PerplexityBot fall through to the same public allow rule. Only representative OAI-SearchBot HTTP parity was tested here.
- **User-triggered:** ChatGPT-User, Claude-User and other tokens fall through to wildcard public allow. Representative ChatGPT-User GET succeeded. Robots is a preference, not authorization.

`/robots.txt`: **200**, `User-agent: *`, `Allow: /`, disallows `/api/` and `/admin`, declares sitemap. Source: `app/robots.ts:7-18`; retained technical evidence `technical-robots.txt`. No blocked endpoint was requested deliberately. Isolated browser probes locally aborted `/api/**` and `/admin**`; therefore Photo Graph preview error/retry state in that browser is **not a production failure**. WAF settings/logs, signed identity and live admin authorization were not inspected.

## Navigation and reading positives

Reused `homepage-render.json`, `photo-graph-render.json`, `grailed-plus-render.json` and `image-and-link-inventory.json`: all three indexable public URLs return **200** and contain readable public content and permanent hrefs. Managed homepage checker found 168 words without JavaScript and no empty-app-shell marker.

Isolated Playwright/CDP accessibility trees (`agentic-accessibility-trees.json`) show:

- `/portfolio`: named Site navigation, Dexter Young/Projects/Contact headings; explicit GitHub, LinkedIn, email and resume links; named project focus/details buttons. Contact resolves to `mailto:dextery777@gmail.com`; no email was sent.
- `/projects/photo-graph`: named navigation, Index/portfolio return links, Launch experience link, readable study headings, and seven query-photo buttons with distinct descriptive names.
- `/grailed-plus`: named navigation, Grailed Plus heading, named feature anchors, portfolio return links, and Add to Chrome/Install links to the official Chrome Web Store. No install action was taken.

Source support: `app/components/home-page-content.tsx:191-205`; `app/components/projects/project-case-study-shell.tsx:25-54`; `app/components/projects/grailed-plus/grailed-plus-install-page.tsx:327-425`.

Source-confirmed focus-view destinations already exist (`project-browser.tsx:567-593`, catalog and routes):

- Photo Node-Gallery: **Open case study** → `/projects/photo-graph`; **Launch experience** → `/projects/photo-graph/experience`.
- Grailed Plus: **Launch experience** → `/grailed-plus`.
- Elliot Mairet: **Launch experience** → `https://elliotmairet.com/`; **View source** → `https://github.com/TheTexta/elliotmairet`.
- bur1alrites: **Launch experience** → `https://bur1alrites.vercel.app/`.
- nepobabiesruntheunderground: **Launch experience** → `https://thetexta.github.io/nepobabiesruntheunderground/`.

`ActionLink` renders genuine external anchors or internal Next links without replacing their role (`app/components/ui/editorial.tsx:71-104`). Their presence is source-confirmed; this worker did not reach the focus view during its runtime interaction attempt.

## Limited observation / testing limitation — no confirmed navigation defect

Source `app/components/projects/project-browser.tsx:169-202` deliberately uses `<motion.a href=… role="button">`, pointer-event gating and click/keyboard handlers that prevent default navigation **to open the focus view**. Its button role is consistent with that intended action, not evidence of a broken navigation link. A separate poster button explicitly named `Show … in focus view` invokes the same focus action (`:142-154`); focus view supplies the genuine links listed above and keyboard/close handlers (`:428-451,494-502`).

A single Playwright click on `View Photo Node-Gallery details` timed out after 5 seconds with pointer interception and instability. Raw failure evidence is preserved in `agentic-interaction-limit.json`. That establishes only failure of this automated attempt against a hover/animated control. The intended poster-button path, hover-then-activation path, keyboard path and subsequent destination-link activation were not exercised, so it does **not** establish a broken user task or justify a Medium finding. The previous P2/Medium classification is withdrawn.

**Best small next step:** no source change is supported by this evidence. If further testing is separately authorized, validate the intended `Show … in focus view` → `Open case study`/`Launch experience` flow and its keyboard equivalent before proposing a fix. No additional requests or browser tests were made during this source-only correction. Optional discovery protocols remain unnecessary for that task.

## Optional capabilities — informational only

Managed `agentic-check.json` records:

| Endpoint or request                       | Observed result                                          |
| ----------------------------------------- | -------------------------------------------------------- |
| `/`                                       | follows redirect to `/portfolio`, 200                    |
| `/llms.txt`, `/llms-full.txt`             | 404 HTML                                                 |
| `/index.md`                               | 404 HTML                                                 |
| `Accept: text/markdown` on root           | final 200 HTML; no `Vary: Accept`, no Markdown alternate |
| `/.well-known/ai-catalog.json`            | 404 HTML; no catalog signal                              |
| `/.well-known/api-catalog`                | 404 HTML                                                 |
| `/.well-known/oauth-protected-resource`   | 404 HTML                                                 |
| `/.well-known/oauth-authorization-server` | 404 HTML                                                 |
| `/.well-known/agent-card.json`            | 404 HTML                                                 |
| `/.well-known/ucp`                        | 404 HTML                                                 |
| `/claude-seo-404-probe-927ffd3a`          | real 404; not a catch-all 200                            |

Homepage static scan: no forms, WebMCP call sites or modelContext entry point in eight same-origin scripts. Runtime registered-tool inventory was not measured. No need is established for WebMCP, an API/agent catalog, OAuth discovery or commerce profiles on this portfolio. llms.txt/Markdown could be added if a concrete consumer needs them; their absence is not an SEO defect or ranking prerequisite.

Standards context from installed references, **last checked 2026-09-23**, not independently refreshed: WebMCP is a Community Group draft/proposal; Content-Signal is a vendor policy with draft-related vocabulary; ARD/ai-catalog is a community discovery proposal rather than a general web requirement; Web Bot Auth is an IETF draft and was not tested here. Do not inherit unsupported vendor assertions from raw checker text or promise rankings/citations/traffic gains.

## Limits and evidence

Read-only audit; no repo edits, installs, policy changes, deployments or production mutations. Repo AGENTS/README and upstream agent Markdown body read. Original user changes untouched. Only owned report/evidence files written.

No mobile/viewport or screenshot audit (visual owner), citability/brand assessment (GEO owner), exhaustive keyboard/focus-trap testing, verified-agent access logs, signed-request tests or external link destination validation. Browser contexts were independent of shared Chrome. Discovery probing covered root/homepage, not every possible alternate Markdown URL. Managed-tool raw output is evidence, not an authoritative current vendor-policy source.

Core evidence: `agentic-lighthouse.json`, `agentic-check.json`, `agentic-ux.json`, `agentic-ua-parity.json`, `agentic-accessibility-trees.json`, `agentic-interaction-limit.json`, and reproducible `agentic-browser.cjs` in `evidence/`.

Structured findings for parent integration (AI Search Readiness): **none confirmed**. Retain the interaction attempt only as a testing limitation, not a scored defect.

```json
[]
```
