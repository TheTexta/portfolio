# Local review delivery — 1–2 November 2026

Scope: the supplied internship/readiness review, the owner's later homepage
corrections and UI simplification, and the authorized portfolio dependency refresh.
Existing user changes were preserved. **At the local-review cutoff, nothing was
committed, pushed or deployed; no GitHub profile setting or production data was
changed.** The owner subsequently authorized committing and deploying the
portfolio release on 2 November. Other repositories and the pre-existing untracked
SEO audit remain outside that release; this does not authorize infrastructure or
data mutations.

The finding-by-finding record is
[`portfolio-review-implementation.md`](portfolio-review-implementation.md).

## Completed local work

- Portfolio: revised case studies and metric scope; source/status/contribution
  metadata; sample-data labels; focus, Contact, experience exits and preview
  recovery; keyboard graph exploration with stable related-selection focus;
  benchmark label semantics and routine algorithm validators; headed CI display
  configuration; portfolio-design article with the actual animated frame, theme
  control and project browser instead of screenshot figures. Project details are
  a compact wrapping metadata line. Optional preview controls attach below the
  media: boxed name on the left, one accessible expand/open link on the right,
  without options, reload or retry controls. These controls appear on dedicated
  write-up previews, not project-browser focus previews. Iframes stay mounted on
  native errors; unreliable timeout/HEAD checks no longer flag working frames.
- Per owner steering, TVM and Bot or Not have write-ups but **no project cards**.
  The extra student/availability paragraph is removed. The owner retained the newer
  category **Multimedia webworks, browser extensions and interactive image systems**
  and supplied the About introduction verbatim as three paragraphs. Mobile write-up
  navigation is now 256px tall, Contact has more separation, and expanded project
  previews include the stack and short description from the catalogue.
- The About write-up list uses hover/focus/touch disclosures with catalogue
  synopses instead of the Contact sweep and animated banner. Title links remain
  direct links. The list shares the project cards' 280ms easing and respects
  reduced motion.
- All seven articles use `/write-ups/<project>`, with permanent redirects from
  their old article URLs. Experience/media routes stay unchanged. Canonicals,
  sitemap, header trail, internal links and rebuilt CV hyperlinks follow the new
  namespace. Article titles reuse the animated homepage frame and are centred,
  with a centred link row below; the embedded
  browser's details respond to container width instead of squeezing into a
  desktop grid inside the reading column.
- CV: editable one-page source and software/ML/interactive selections, without
  smaller type or independent-performance claims for overlapping practice data.
- Grailed client: maintained documentation reflects progressive refinement and a
  30-second source-configured budget. Existing generated release artifacts were
  preserved; no store package was rebuilt or released by this documentation pass.
- Gateway: pinned/public-address outbound image boundary, streamed size limit,
  default-deny admin credential and quota, isolated regressions and separate CI.
- Elliot: actual publication-handler adapter tests for denial, MIME validation,
  reservations, partial success and accepted replay. Elliot and bur1alrites now
  have offline regression/static/type workflows.
- Bot or Not: sanitized split audit with input/label hashes, exact alias grouping
  and incompatible-boundary rejection. Historical artifacts remain unchanged.
- Prepared relevance-assessment and performance protocols, a browser-measurement
  tool, signed-out GitHub observations and an unfamiliar-reader acceptance task.

## Verification

### Approved production release — 2 November

- Release commits: `0eb2406` (portfolio review, write-ups/UI and R2 fallback), then
  `bd3ec8e` (bound the Node engine range to preserve Vercel's configured Node 24).
  Commits are local; no Git push or hosted CI run was performed.
- Deployed a clean archive of `bd3ec8e` to the existing
  `thetextas-projects/portfolio` project, without local environment files or the
  pre-existing untracked SEO audit. The upload dry run covered 285 files and
  matched the committed tree. Production environment variables were not changed.
- Accepted deployment: `dpl_CXWMm6L5TDPZYvpH2eGxETnQvigK`,
  `https://portfolio-ihjgc95l8-thetextas-projects.vercel.app`, promoted to
  `https://dextery.dev`. CLI inspection of the custom domain resolved to this
  READY deployment. Hosted logs confirmed Node 24 and Next.js 16.4.3.
- The first candidate selected Node 26 from the unbounded engine minimum. It was
  never promoted. The replacement was built and checked before promotion; no
  deployment-protection bypass was created or protection setting changed.
- Previous production retained for rollback:
  `https://portfolio-9ne5xr5a1-thetextas-projects.vercel.app`
  (`dpl_F713Z9eMEXUGgf2Um2mYNmxEXFGw`, source `af8f1cc`).
- Release checks: lint/types/format, 105 unit tests, both algorithm validators,
  all seven local Auth scenario groups, and production dependency audit (zero
  findings) passed. The fresh full browser run returned **128 passed, 3 intentional
  skips and 1 native pointer-lock failure**. A retry hit another project's occupied
  port; the unchanged headed test then passed from the committed release on an
  isolated ephemeral port. No assertion was removed or relaxed. The earlier full
  129-pass run below remains historical, not a claim about this later rerun.
- Hosted acceptance: all 72 browser/Googlebot route, redirect, canonical, robots
  and sitemap checks passed. The public graph returned 103 R2 nodes; sample image
  transforms returned non-empty WebP. `/admin` returned its public sign-in page,
  while anonymous `/api/admin/photo-graph/graph` returned 401. No live signed-in
  upload, mutation or rollback rehearsal was performed.
- Live Chromium checks covered all seven centred article titles and icon-free
  About navigation: desktop hover, mobile first-tap preview/second-tap navigation,
  the 256px mobile list and no horizontal overflow. No page errors were captured;
  Vercel's checked 10-minute runtime-error window returned no clusters. These are
  smoke observations, not an ongoing monitoring guarantee or physical-device test.
- A concurrent title-size edit in
  `app/components/projects/project-write-up.tsx` appeared after the release was
  frozen. It was preserved, not committed or deployed. Other repositories and
  the old untracked SEO audit were also left untouched.

### Original local review checks

| Check                                     | Local result                                                                                             |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Portfolio clean lockfile install          | Passed, scripts disabled; separate native Sharp smoke passed                                             |
| Portfolio lint/types/format               | Passed                                                                                                   |
| Portfolio unit suite                      | 105 passed, including R2 fallback/doctor, shared hover motion, PGlite and intercepted Analytics tracking |
| Colour/edge numerical validators          | Both passed                                                                                              |
| Full desktop/mobile browser suite         | 129 passed, 3 intentional viewport-specific skips                                                        |
| Live component/header/control regressions | Included in the desktop/mobile suite; supersede the old screenshot-figure assertions                     |
| Local Auth validation                     | All seven scenario groups passed, including refresh and fail-closed outage                               |
| Isolated clean production build           | Next 16.4.3 Turbopack passed; no environment files or production credentials copied                      |
| HTTP SEO/route checks                     | 72 passed; includes all new article canonicals and the eight added redirects under both profiles         |
| Mechanical UI detector                    | No findings on the final homepage, browser, shared article/preview components and write-up targets       |
| Rebuilt CV hyperlinks                     | Three one-page PDFs, each with six canonical write-up links and no legacy project links                  |
| Browser baseline tooling                  | 24 network-blocked smoke samples; explicitly **not representative performance evidence**                 |
| Gateway                                   | 50 offline tests passed, independently rerun                                                             |
| Elliot                                    | Upload/publication 45; palette 4; similarity 13; images 28; admin 39; text 58 passed                     |
| bur1alrites                               | 92 tests, lint, isolated typecheck and webpack build passed                                              |
| Bot or Not                                | 52 tests passed, two live tests skipped; split-audit report reproduced                                   |

Chromium desktop and narrow/mobile emulation are not physical-device or Safari
results. The native pointer-lock assertions remain in the headed test. A local
pass and the `xvfb-run -a` workflow edit are not a completed hosted Linux CI run.
Local Vercel analytics-script 404/MIME errors are expected from standalone Next;
actual Analytics server tracking was tested with synthetic context and intercepted
fetch, not live telemetry.

The original browser pass found stale assertions/accordion assumptions and a
mobile wheel-emulation mismatch; these were corrected without removing native
pointer-lock or transaction/recovery assertions. Isolated-build setup initially
failed on an external dependency symlink and an omitted custom declaration
folder; a real clean install with the declaration folder passed. Those harness
failures are not counted as successful application checks.

The 2 November UI follow-up was also inspected at 320px/390px mobile and 1440px
desktop widths. Elliot’s embedded detail column now measures 576px rather than
being squeezed beside desktop actions. Its real frame loads, and only its dedicated
write-up preview has the bottom controls; browser focus views retain their separate
launch actions. The mobile scroll-spy regression was
refined after a captured stack showed Motion restoring the exact current scroll
position during auto-height measurement; actual document movement is still
rejected. Route moves required regenerating stale Next route validators with
`next typegen`. These are local render/source checks, not physical-device claims.

The final title-fit regressions cover all seven articles at 320px, 390px and
1440px. Accordion hover/focus/touch coverage includes normal motion, while the
shared motion helper is also checked with reduced motion. A host restart interrupted
one verification attempt; it was rerun, and the temporary production-build
dependencies were cleanly reinstalled with scripts disabled before the final build.

After that full run, the owner requested removal of accordion chevrons. The separate
buttons are gone: title rows reveal on hover/keyboard focus, Space toggles the
synopsis, and touch uses a first tap to reveal and a second to navigate. Static
checks and four targeted desktop/mobile browser cases passed for this refinement.

## Security and compatibility

Production package audit: **zero findings**. Full tree: **17 moderate findings,
all development-only lint paths**, with no high/critical findings. ESLint 9,
TypeScript 6 and Node 22 typings remain intentional compatibility holds; see
[`dependency-updates.md`](dependency-updates.md). An audit is not a security
certification. Optional Sharp WASM helper packages are reported as extraneous by
`npm ls` despite clean `npm ci`; no invalid peer was reported and native Sharp
execution passed. No forced override or broad cleanup was used.

## Explicit remaining gates

- **Publication:** the portfolio commits and deployment are recorded above.
  Git pushes, actual hosted green/failing-contract CI evidence, other-repository
  releases and a real signed-in production admin-flow check remain pending.
- **Service operations:** actual gateway proxy/egress policy and intended host
  coverage, separately provisioned admin credential, and isolated rollout. Docker
  daemon was unavailable for the local container smoke. No production endpoint
  was probed or administrative action invoked.
- **Independent evidence:** new labels/data and a frozen ML/relevance assessment,
  an actual release-labelled extension recording, and a synthetic Discord-server
  demonstration. Historical practice scores were not numerically reproduced.
- **Accessibility:** subject descriptions are available only for the existing
  provenance-matching article photographs, not the full archive. Real screen-reader,
  physical iOS/Safari and broader device verification remain unperformed.
- **Personal review:** bio/pin edits, permission-cleared systems-language examples,
  actual client/collaboration feedback and an unfamiliar reader's observations.

These gates are not silently marked complete or filled with invented metrics.
