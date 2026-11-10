# Dexter Young Portfolio

## Stack

- Next.js
- React
- TypeScript
- Tailwind CSS
- D3.js
- Supabase
- Lucide

## Project structure

- `app/`: Next.js routes, page composition, and UI components.
- `lib/`: reusable domain logic, integrations, and server utilities.
- `scripts/`: operational checks, data migrations, and reproducible analysis.
- `public/`: static project assets and Photo Graph snapshots.
- `docs/`: compatibility audits, design notes, and Photo Graph research.

Run `npm run check` before opening a pull request. It checks tracked repository
paths, then runs lint, TypeScript, and formatting checks in that order.

## Repository safety

Never commit deployment environment files or temporary infrastructure snapshots.
`.gitignore` excludes `.env*`, `*.env`, `*.env.*`, and `.tmp`; ignore rules do not
remove files that Git already tracks. `npm run check:repository` rejects tracked
temporary paths and environment filenames, including forced additions. It runs
as part of `npm run check`, including in CI. The guard reads paths from the Git
index and never prints file contents. It is not a secret-content or history scan;
credentials embedded in otherwise permitted files require separate review.

See [`docs/security/credential-exposure.md`](docs/security/credential-exposure.md)
for the deployment-snapshot exposure, containment limits and recovery gates.

## Automated tests

Use Node.js **22.12+ or 24.x, below 25** (local verification on 22.x). The engine
upper bound keeps Vercel on its configured Node 24 rather than auto-upgrading to
the latest major. The compatible dependency
refresh, security audit scope and TypeScript/ESLint/Node-typing holds are documented
in [`docs/dependency-updates.md`](docs/dependency-updates.md).

- `npm test`: upload recovery/storage tests and transactional SQL tests using an
  isolated in-memory PGlite database, benchmark-scope tests, and offline colour/edge
  validators (numerical CIEDE2000 references and incremental/full equivalence). No
  production services are contacted.
- `npx playwright install chromium` (once), then `npm run test:e2e`: desktop and
  mobile Chromium tests for project navigation, keyboard focus, history, preview
  links, and retrying uploads after a reload.
- `npm run admin:validate-auth`: authorization checks against a local Auth stub.

Browser tests copy the application into a disposable `.tmp/` fixture and run on
port 3107 with test-only Supabase settings, a local Auth stub, and intercepted
Storage requests. They do not load `.env.local` or use production credentials.
If port 3107 is already occupied, use `PORTFOLIO_TEST_PORT=3157 npm run test:e2e`
instead of stopping another session's server. The fixture and browser use the same
override; the suite never reuses an unknown existing server.
GitHub Actions runs checks, tests, Auth validation, and a production build on
pull requests and pushes to `main`. Linux CI wraps the browser suite in
`xvfb-run -a` to retain headed native pointer-lock coverage.

Elliot's write-up reuses the shared animation player for a three-stage
photograph-to-palette example, recorded with the real OKLab extractor. Its
snapshot is local and ordinary builds do not need Elliot's checkout or services.
See [palette animation](docs/design/elliot-palette-animation.md) for provenance,
regeneration and verification commands.

## Search metadata

`lib/site-config.ts` holds the portfolio identity and official profile links.
`lib/seo.ts` defines metadata for the indexable public pages, their preview
images, and their content-update dates. Update a page's `lastModified` date after
significant changes to its content, links, or structured data; sitemap generation
does not change these dates automatically.

Project imagery and dimensions come from the shared project catalog. Public pages
include Open Graph and Twitter previews, JSON-LD, and permission for large Google
image previews. `/sitemap.xml` lists all project posters on the portfolio and each
project page's own poster on its entry.
Page entries come only from the canonical `PUBLIC_PAGES` list. External project
destinations, including the Nepobabies GitHub Pages site, remain ordinary links
and are not sitemap page entries. Regression tests and the HTTP validator check
that every sitemap page URL belongs to `https://dextery.dev`.
Existing project cards expose permanent links while retaining the interactive
browser. Public experience routes are crawlable but retain `noindex, nofollow`
metadata so Google can read their indexing restrictions. Admin and API paths
remain blocked in robots.txt. Legacy public URLs remain crawlable so Google can
observe their permanent redirects or 404 responses.

With a local production server running, validate the HTTP indexing signals:

```bash
npm run build
npm run start
# Run in a second terminal; defaults to http://localhost:3000:
npm run seo:validate
# Check the deployed application after deployment:
npm run seo:validate -- --base-url https://dextery.dev
```

The validator only makes GET requests and exits nonzero on failures. It checks
ordinary and Googlebot user agents, public-page status, titles, descriptions,
canonical URLs, server-rendered content and portfolio links, sitemap URLs/images
and content dates, crawl rules, experience-page noindex metadata, legacy
redirects, and the removed preview's 404. Local pages still declare production
canonical URLs. These smoke checks do not prove that Google can access or index
the site, and do not modify Search Console or hosting settings.

Vercel's project domain settings explicitly redirect `www.dextery.dev` permanently
to `dextery.dev` with HTTP 308, replacing the automatic temporary 307 redirect.
When changing domain settings, verify the redirect preserves both path and query,
for example `https://www.dextery.dev/grailed-plus?view=hero` should point to
`https://dextery.dev/grailed-plus?view=hero`. HTTP requests should also redirect
permanently to HTTPS. Hosting changes are separate from the repository changes.

After deployment, submit `/sitemap.xml` in Google Search Console and use URL
Inspection to check `/portfolio`, `/write-ups/photo-graph`, and `/grailed-plus`,
confirm their Google-selected canonicals and rendered content, and request
indexing. Inspect the affected URLs behind any duplicate, unauthorized (401), or
crawled-but-unindexed entries before deciding whether further fixes are needed;
redirect sources and protected endpoints may be intentional exclusions. The
four HTTP/HTTPS and www/non-www homepage variants intentionally redirect to
`https://dextery.dev/portfolio`; “Page with redirect” is expected for those
sources, not a reason to remove their redirects. Inspect/request indexing for
the final canonical page instead. If Search Console reports an old malformed
sitemap URL, compare its last-read date with the live XML and resubmit
`https://dextery.dev/sitemap.xml` so Google can fetch the current version. The
October 6, 2026 coverage export contains aggregate counts without affected URLs,
and its chart ends on September 20, so it cannot identify current URL-level
problems. Search appearance and indexing remain Google's decision. The existing
`/` to `/portfolio` redirect is
preserved; Google's site-name documentation specifies domain-root placement for
`WebSite` markup, so site-name eligibility should be checked against that routing
if the homepage is moved in a future change.

## Navigation

The header identity, portfolio directory link, and Grailed Plus footer return to
a reset `/portfolio` at the top. These home links intentionally use document
navigation so an already-mounted project focus cannot survive a homepage reset.
About, Contact, and Projects anchors close project focus and keep the requested
section in view rather than restoring the old project-rail scroll position.
Section targets do not draw a focus outline on arrival; keyboard focus and the
visible focus indicators on individual links and controls are preserved.

On desktop, horizontal trackpad gestures over the homepage project cards move
the rail directly in either direction, including the trackpad's own momentum.
Autoplay blends back in as scrolling slows from 1.25 times its current animation
speed to that speed, without adding momentum or resetting the card position.
The takeover eases across animation frames so uneven momentum tails do not
repeatedly interrupt it; a fresh swipe still takes control immediately.
Vertical page scrolling stays native. Hover slowdown, keyboard focus pause,
reduced-motion scrolling and the mobile project accordion remain unchanged.
The embedded browser example in the portfolio-design article does not capture
these gestures.

Write-up **Index** links return to the project list; **Back to projects** returns
to that article's focused project. Closing previous/next links cycle through all
seven articles in catalogue order, including write-up-only projects, skipping
projects without an article. Both standalone experiences have a return link
to their article or product page. `tests/e2e/navigation.spec.ts` checks these
round trips, browser history, and rendered internal link/section destinations on
desktop and mobile using local fixtures, not production services.
Grailed Plus install links retain the product page in browser history and reset
their busy state when the browser restores a cached page; tracking is unchanged.

## Project write-ups

The homepage's About section pairs a three-paragraph introduction with a scrollable
write-up disclosure list. Links and short synopses come from catalogue entries with
`writeUpHref`, in catalogue order. Hovering a row or focusing its title reveals the
synopsis without chevron icons. Space toggles the focused synopsis; Enter opens
the article. On touch screens, the first tap reveals the synopsis and a second
tap opens the article. Only one
row expands at a time. The list and project-card popups share the same 280ms easing
through `project-hover-motion.ts`, with no travel under reduced motion. The old
contact-style sweep and animated heading banner are not used by this list.
Edit the introduction
in `app/components/home-page-content.tsx`; the columns stack below 768px. The
stacked write-up list is 256px tall, and mobile Contact spacing separates it from
the next section. Expanded mobile project previews show the stack and short
description from the catalogue beneath their image.
Homepage and shared editorial motion use `app/hooks/use-reduced-motion.ts` so the
server and first client render agree, then follow live browser preference changes.
`tests/e2e/page-hydration.spec.ts` checks the homepage and the original interactive write-ups with
both motion settings on desktop and mobile, plus live preference changes without
a page reload.

Project write-ups use the shared `app/components/projects/project-write-up.tsx`
shell: a centred column using two-thirds of the desktop viewport, capped at 672px
for reading. Prose, figures, captions, and interactive previews share its width and
horizontal inset. Mobile uses the available width with gutters.
At 1024px and above, a sticky left-hand reading rail follows the current section
without changing the centred column. Following ForumMagnum's full-height contents
design, markers are spaced by section length; hovering the margin or focusing a
link reveals the labels. A moving line grows and shrinks to map the visible part
of the article across sections of different lengths.
When that highlighted window overlaps a dot, the dot morphs into a horizontal tick
extending 5px on either side, matching the active line's thickness and colour. It
returns to a dot when the window leaves.
The rail fills the viewport below the live site header, with its track inset 32px
below the header and aligned to the shared 48px desktop page gutter. Its title is
a fixed row;
section spacing and any introductory spacer are measured from article content,
excluding the title frame, project metadata and lead. The MDX pipeline creates
that separate content container automatically, without changing article authoring.
Clicked sections scroll with Framer Motion, or jump instantly under reduced motion.
Smaller screens keep the existing layout.
The list and shareable section anchors are generated automatically from `##` and
`###` MDX headings; no separate outline needs maintaining. Contents links also
work without JavaScript.
Edit prose in the route's `write-up.mdx` file:

- `app/write-ups/photo-graph/write-up.mdx`
- `app/write-ups/elliot-mairet/write-up.mdx`
- `app/write-ups/bur1alrites/write-up.mdx`
- `app/write-ups/grailed-plus/write-up.mdx`
- `app/write-ups/tvm-discord-bot/write-up.mdx`
- `app/write-ups/bot-or-not/write-up.mdx`
- `app/write-ups/portfolio-design/write-up.mdx`

Article URLs are `/write-ups/<project>`. The seven former `/projects/<project>`
article URLs permanently redirect, preserving queries; experience and public-media
paths stay unchanged. Canonicals, structured data, sitemap entries and catalogue
links use the new URLs. The header's `/write-ups/` trail links to the existing About
write-up list through the `/write-ups` redirect. CV source/downloads use the new
canonical article links too.

The catalogue is also the source for write-up-only projects. Entries with
`showInBrowser: false` remain in the About article list, metadata and sitemap, but
are excluded from cards, focus hashes and previous/next preview navigation.
Discord Shoot Manager, Bot or Not and the portfolio-design article use that path; their return links
go to the About write-up list. The homepage category line follows the owner's
latest “Multimedia webworks, browser extensions and interactive image systems”
wording without an added student/availability paragraph beneath it. About uses
the owner's three-paragraph introduction, covering visual-media work, TVM and
Grailed Plus.

The adjacent `page.tsx` owns the shared shell, metadata, and any data passed into
the article. MDX owns the title, introduction, project links, preview placement,
and body. Use one `#` heading followed by `##` sections, paragraphs, links, and
lists. Shared components
are available without imports through the root `mdx-components.tsx`:

```mdx
<header data-write-up-header>

# {props.project.title}

<ProjectMeta>
  <ProjectDetails project={props.project} />
  <nav aria-label={`${props.project.title} project links`}>
    <a href={props.project.liveHref}>Visit site</a>
    <a href={props.project.sourceHref}>View source</a>
  </nav>
</ProjectMeta>

<Lead>{props.project.summary}</Lead>

</header>

<ProjectPreview projectId="elliotmairet" />

## A design decision

Explain the decision here, with **emphasis** or [a reference](/portfolio).

<Figure
  src="/projects/example/detail.webp"
  alt="Describe what the image shows"
  width={1440}
  height={900}
  caption="Explain what this figure demonstrates."
/>

<MediaPlaceholder caption="Add an early sketch here." />
```

`Gallery` displays individual photographs in a responsive grid; `Comparison`
shows a starting photograph and labelled rows of ranked results. Both are server
components, use local image files with real dimensions, and keep captions and
labels as HTML rather than baking them into a contact sheet.

`Figure` uses the existing responsive image/caption component; supply the image's
real dimensions to reserve its space. Captions are props so MDX does not insert
extra paragraph spacing inside them. Page-provided values are available through
`props`, as in Photo Graph's benchmark figures. Only trusted, repository-owned MDX
is compiled at build time; there is no remote MDX execution or CMS.

Write-ups support LaTeX-style mathematics with `remark-math` and `rehype-katex`:
use `$\Delta E_{00}$` inline, or `$$` on separate lines around a display equation.
Escape literal currency dollars as `\$`. Existing contents/body transforms remain
in the remark pipeline; formula headings retain their LaTeX source as plain text
in the contents outline. The `/write-ups` layout imports local KaTeX CSS/fonts,
with horizontally scrollable display equations on narrow screens. Rendering
happens during MDX compilation and includes MathML; no client math runtime or CDN
is needed. The installed `katex` stylesheet version must match the renderer used
by `rehype-katex` (`npm ls katex` should show one deduplicated version). The
`katex` npm override aligns the plugins' transitive versions with the patched
direct dependency; recheck compilation/rendering when updating this override.
This syntax applies to authored MDX, not JavaScript expressions or `.tsx` strings
inside interactive inspectors.

All seven articles follow the owner's Figma frame `36:149` in file
`QccgILPVCw0Uofge2n2i3e`. Every title reuses the homepage's animated
`BorderContainer` and its 36/60/96px responsive scale. At desktop width a one-line
title has a 330px frame with a 584px centre; longer titles grow rather than clip.
`ProjectMeta` places `ProjectDetails` and the project links in a wrapping row
above the introduction. Metadata has screen-reader labels and vertical separators
on larger screens, not a bordered card. On mobile it wraps without separators.
Native article previews retain their interactions and permissions; their footer
shows the project, the view (Homepage or Graph), and a direct-open icon. Downloaded
Figma assets and provenance are local under `public/projects/write-up/` and
`public/projects/elliot-mairet/write-up/`. See `docs/design/project-write-ups.md`
for responsive adaptations and verification.
The portfolio-design article imports the actual animated
`BorderContainer`, `ThemeToggle` and `ProjectBrowser` through its example
components. `ProjectBrowser embedded` keeps focus/navigation interactions local:
it does not change article history, scroll the document or start document-wide
view transitions. The old screenshots remain available for poster/share metadata,
but are not article figures.
The browser's detail layout follows its container width, not the page viewport,
so action links do not squeeze descriptions inside the article.

For another project, create its `write-up.mdx` and import it from a `page.tsx`
using `ProjectWriteUp`, passing `project` into the MDX component. The shell does
not generate a second title or introduction. Keep shared identity/URLs sourced
from `props.project`; a custom introduction can also be authored inside `Lead`.
Add a route to `project-routes.ts` and `writeUpHref` to its entry in
`project-catalog.ts` to expose the **write up** link in the project overview.

`ProjectPreview` renders inside the shared column. Photo Graph uses its existing
interactive canvas with embedded navigation hidden. Other projects use an iframe
in native-interaction mode: controls, internal links, scrolling, and keyboard
navigation stay inside the preview. That mode disables the click-to-launch hook
and sets `referrerPolicy="no-referrer"` so the hosted site's portfolio-navigation
bridge stays inactive. Other sandbox restrictions remain. Overview
previews retain their previous click-to-launch behaviour.
Elliot's overview and write-up previews share the catalog's `previewScale: 0.85`
on desktop and mobile. Scaling changes the iframe's rendering size, not its native
interaction, sandbox, or navigation validation. In the overview, **View source**
precedes **write up**, followed by **Launch experience**.

`/write-ups/photo-graph` is a five-section engineering case study, separate from
`/projects/photo-graph/experience`. It opens with the existing live graph preview,
then explains descriptor/model choices, sparse links, browsing/layout and reliable
archive updates. Two page-local inspectors share a photograph/candidate selection
and neighbour configuration: colour comparison (with optional arithmetic) and
graph rules. Defaults are server-rendered from a frozen example; the rule map
keeps positions fixed while links change. Neither inspector runs a looping
simulation or requires live data. Only the opening graph preview requests the
public graph API. See `docs/design/photo-graph-walkthrough.md`.

The 4 November 2026 worked example freezes the same 100 IDs as the saved feature
catalogue, but re-extracts mean RGB/LAB from original bytes using the upload
Canvas2D policy. All 4,950 pair outputs, sources, settings and checksums are in
`public/projects/photo-graph/worked-example/fixture.json`; the audit matrix stays
out of the client hydration payload. Harbour ranks third in this extraction,
not second as in the separately labelled August benchmark. Deliberately regenerate:

```bash
node --import tsx scripts/photo-graph/freeze-worked-example.ts
```

This reads only public originals and writes local generated assets. It is not a
build step or a production mutation. Keep the ignored original cache for exact
replay; the generated directory's README documents browser/version policy,
source mappings, checksums and explicit refresh behaviour. No Oklab inversion or
article thumbnail supplies the baseline descriptor.

The optional August methodology retains its historical review gallery and modest
25/28 versus 24/28 judged-slot finding. Those counts describe seven reviewed
queries, not current full-archive accuracy. Historical figure provenance remains
in `public/projects/photo-graph/write-up/sources.json` and `gallery.json`. The
legacy comparison assets remain available. To deliberately rebuild those older
presentation assets (not baseline descriptors):

```bash
node scripts/photo-graph/prepare-write-up-media.mjs
```

This command reads public images and writes local assets and gallery data only;
it does not modify the database or remote storage. The source manifest records
both downloaded and prepared-image checksums. Legacy composite files are retained
but no longer displayed. Commit the prepared assets so ordinary
builds and static article content do not require the media service. Interactive
previews still load their projects' public services separately.

`/write-ups/elliot-mairet` is a completed, indexable write-up with canonical/share
metadata, project structured data, and a sitemap entry from `PUBLIC_PAGES`.
Its three WebP screenshots show the public archive, a photograph, and selected-colour
navigation. Source URLs, viewport, capture date, and interaction state are recorded
in `public/projects/elliot-mairet/write-up/sources.json`. No private admin screen or
account data is included. Existing public pages and redirects keep their URLs.

`/write-ups/bur1alrites` is an indexable write-up about Allie's reactive lighting,
the Three.js gallery, and the projector room's grain and bloom. Its rationale was
supplied by Dexter. The interactive preview remains separate from the article's
three public-site screenshots and an off-axis local scene inspection; capture provenance is recorded in
`public/projects/bur1alrites/write-up/sources.json`.
The inspection uses the real Three.js objects, with bloom bypassed and explicit
wireframe/grid/camera guides added in a disposable copy. It is not a Blender
screenshot or a claim about the production presentation.
Its desktop write-up preview uses 80% scale so the article width does not activate
the hosted site's mobile-only tap-to-play layout. On mobile, it retains the site's
native mobile behavior. Only this write-up iframe opts into autoplay and the
`allow-pointer-lock` sandbox permission for the projector room's mouse-look/WASD
controls. Top-level navigation remains sandboxed, and other previews gain neither
permission. No change to the hosted bur1alrites site is required.
Responsive preview scaling uses a hydration-safe media-query subscription, so
resizing switches between desktop room navigation and mobile tap playback.
`tests/e2e/write-up-room.spec.ts` runs headed to exercise real pointer-lock;
display-less Linux CI needs `xvfb-run` for that spec.

## Embedded project previews

Photo Node-Gallery is interactive inside its preview: drag and zoom the graph,
and select a photo to inspect it without leaving the portfolio. Use Launch
experience to open the full gallery. It is exempt from the click-to-open behavior
used by the other previews.

Spotify Nodify has been removed. Its former project URLs and Spotify sign-in
callback redirect to `/portfolio#projects`. Spotify environment variables are no
longer required.

The project browser embeds the Grailed Plus page and three separately hosted
sites. Links clicked inside those previews open their destination as the
top-level page while wheel and touch scrolling remain inside the preview. Grailed
Plus links are read directly because its frame shares this site's origin. The
other sites send clicked URLs with a `dextery-preview-navigation` `postMessage`;
the portfolio checks the sender's frame and origin before navigating. A click
without a reported link opens the project's main site.
Bur1alrites video clicks use the selected video's direct link and open its
video room on the full site.

On `/grailed-plus` and `/write-ups/grailed-plus`, the borderless comparison example
replays recorded real MobileCLIP-S1 results using five photographs and no visible
panel chrome. A shared seekable animation player supplies the horizontal progress
rail, three-stage snapping, smooth selection/reset transitions and pause/resume;
its [interface and reuse guide](docs/design/animation-player.md)
apply to future SVG, canvas and iframe animations. The wrapper separates preloading from visible-only playback and links
the demo's photo credits. The recording is bundled locally; refresh its generated
snapshot from the adjacent extension repository with `npm run grailed-plus:sync-demo`.
See [recorded comparison integration](docs/design/grailed-plus-recorded-demo.md)
for the matching demo build, local origin override and verification commands.

Discord Shoot Manager's article uses the same player for an illustrated
Create / Join / Archive workflow, not a live Discord recording. Its native DOM
scene has no child clock or external requests. The former recovery chart is no
longer used by the article or sharing metadata. A scene capture supplies the new
poster; see [shoot lifecycle animation](docs/design/discord-shoot-lifecycle.md)
for the implementation, capture command and checks.

Deploy matching preview-navigation changes in `bur1alrites`, `elliotmairet`,
and `nepobabiesruntheunderground` to enable destination links in their previews.
Until each site is updated, its preview still opens the project's main site.

External previews do not infer failure from a timeout or separate HEAD request:
a frame can remain usable while images/subresources are still loading, and
cross-origin errors cannot be reliably diagnosed by the parent. Native error
events can show a short status, but never unmount the iframe. A single expand/open
icon always opens the project directly in a new tab, with an accessible action label.
There is no preview options panel, reload or retry control. The optional
`ProjectPreviewControls` strip sits below the media, with a boxed preview name on
the left and a 44px expand/open icon on the right; controls no longer cover the
iframe. Write-up `ProjectPreview` accepts `showControls={false}` to omit it.
Project-browser previews omit the strip by default, including the article's live
browser example; their launch actions stay in the project details. Native interaction
inside case-study previews is preserved.
HTML project previews draw a 24px unscaled gutter beyond their clipped right and
bottom edges, hiding iframe scrollbars without disabling native wheel, touch or
keyboard scrolling. This works for cross-origin sites without changing or
deploying them. The Grailed Plus hero keeps its fixed 1280px iframe viewport;
canvas previews and the narrow-screen static launch panel are unchanged.

Control-enabled embedded Photo Graph views have a keyboard photograph selector, an open
control and connected-photo buttons synchronized with canvas selection. Closing
inspection restores its trigger. Labels currently identify archive IDs and image
orientation; subject descriptions and a real screen-reader assessment remain
follow-up work.

### Optional Photo Graph 3D view

At `/projects/photo-graph/experience`, open graph controls and enable **3D**.
The default remains 2D; homepage, article, and admin previews remain 2D. The view
choice lasts only while that experience is mounted. The standalone experience
retains its compact controls and icon-only return link, without a photograph
browser panel; the keyboard selector described above is currently confined to
control-enabled embedded graphs, not the standalone canvas.

In 3D, photographs are camera-facing rectangles in an XYZ force simulation.
Drag empty space to orbit, scroll/pinch to zoom, and right-drag or use two fingers
to pan. Hold **Shift** during a left-mouse camera drag to pan; release it to resume
orbit without releasing the mouse. This also works when Shift changes mid-drag;
photograph dragging and Ctrl/Meta-started panning retain their native behavior.
Drag photographs to reposition them or select one to open the existing
inspection/download overlay. **Reset**, beside the top-right compact control,
smoothly fits the current graph over 900ms in either 2D or 3D without changing its settings.
The action remains visible when graph controls are closed. Distance
settings use world units in 3D, not screen pixels. Reduced motion disables camera
damping and camera-reset animation, and pre-settles the initial layout; there is
no automatic camera orbit.

Drag a slider's square handle, scroll horizontally over its field with a trackpad,
or use its keyboard controls to adjust it. Horizontal scrolling moves the value
in the swipe direction; vertical scrolling and pinch-to-zoom remain native.
Clicking or dragging the track does not change the value.
Photo Graph control text shares a 12px desktop / 14px mobile scale, medium weight,
and consistent 8px/12px spacing; its minimum control rows remain 32px/44px.

`PhotoGraphCanvas` owns data loading, settings and inspection. Its separate
`PhotoGraph2DRenderer` and lazily imported `PhotoGraph3DRenderer` own independent
mutable graphs and save numeric layout/camera snapshots in memory between mode
switches. Both use the same public payload, links and provider-aware media URLs.
If force settings changed in the other mode, the returning view settles and fits
the updated layout rather than freezing it at the old coordinates.
This adds no persisted coordinates, database settings, feature model, or media
migration. Only the standalone route opts in with `allow3D`.

Three.js and `react-force-graph-3d` are downloaded only after activation. The 3D
renderer bounds image concurrency and allocates textures from each photograph's
screen-projected size, with a 3840px longest-side limit (also bounded by the GPU).
Small background photographs do not reduce close-up resolution unless their
combined demand exceeds the 48 MiB retained RGBA budget. Under pressure, texture
dimensions scale proportionally to demand; superseded allocations shrink before
upgrades, and offscreen textures are evicted as needed. It matches native pixel ratio
with a 16-megapixel drawing-buffer budget and native WebGL antialiasing. The
drawing buffer follows viewport and screen-density changes; projected texture
requests use the renderer's actual pixel ratio. Resolution tracking uses actual
uploaded texture dimensions so budget-downscaled photographs can upgrade again
when zoomed, without repeatedly requesting rounded image-size tiers.
3D photograph textures use nearest-neighbour minification/magnification and disable
canvas smoothing during texture preparation; geometry antialiasing, native pixel
ratio and the existing resolution/memory budgets remain unchanged.
The 2D canvas uses normal image smoothing rather than forced pixelated scaling.
Full-resolution originals remain in the inspection overlay.
The larger 1536/1920/2560/3200/3840px request tiers are 3D-only; 2D tiers are
unchanged. Before releasing this app change, publish the matching Photo Graph
allowlist from `dextery-infrastructure/cloudflare-assets/worker.mjs` with separate
deployment approval. Publish the Worker first so new requests do not fall back to
archival originals because the older Worker rejects their widths. Existing
projects' transform allowlists, media routes, and private staging stay unchanged.
Its bounding-sphere collision prevents world-space intersections, not every
screen-space overlap. Disabling 3D aborts texture requests and releases the owned
WebGL context; the graph library disposes attached scene resources. Unsupported
WebGL, initialization/import failure, or context loss restores 2D with a retry
explanation. Switching modes does not refetch the graph.

`tests/e2e/photo-graph-3d.spec.ts` uses intercepted local graph/image fixtures and
real Chromium WebGL, not production services. Crowded-scene coverage zooms a
foreground photograph with 102 background photographs at normal and Retina
density, checks actual uploaded resolution and retained texture memory, then
resets and upgrades again without repeated requests. Additional checks cover GPU
nearest-neighbour samplers, mid-drag Shift changes with and without damping,
cancelled gestures, native touch navigation and responsive control spacing. Run it with
`npm run test:e2e -- tests/e2e/photo-graph-3d.spec.ts`.

## Portfolio evidence and résumé

The visual project browser leads with Grailed Plus. Discord Shoot Manager and Bot or Not remain
directly accessible in the About write-up list rather than appearing as cards.
Contribution, period and status are shared case-study metadata. The Grailed
engineering article lives at `/write-ups/grailed-plus`; `/grailed-plus` remains the
installation/product page. Sample listings are disclosed beside every demo and
in frame descriptions. The demo frame stays inert until its readiness handshake.

The Photo Graph benchmark export separates judged-subset precision from full
archive neighbours. Each neighbour has `judgment: positive | negative | unjudged`
and nullable `judgedRelevant`. Numerators/denominators and pair-ordering semantics
are explicit. To annotate the saved historical report without recomputing its
original experiment, run `npm run photo-graph:annotate-benchmark`; this preserves
scores, timings, rankings and the original generation date. A new experiment uses
`npm run photo-graph:benchmark-colors` and retains its own provenance.

The résumé PDF has editable content and a generator under `docs/resume/`.
Confirmed availability is Summer 2027, with expected graduation June 2028.
See `docs/portfolio-review-implementation.md` for the cross-repository findings
and `docs/portfolio-review-delivery.md` for local verification and the remaining
publication, independent-evidence and owner-action gates. Prepared procedures are
in `docs/application-evidence.md`, `docs/relevance-evaluation-protocol.md` and
`docs/browser-performance-baseline.md`.

## Photo Graph admin

Open `/admin` to sign in and manage Photo Graph uploads, photos, and graph
defaults. Signing in and out keeps you at the same URL. The former
`/admin/photo-graph`, `/admin/photo-graph/login`, and `/admin/photo-graph/upload`
URLs permanently redirect to `/admin`.

Admin sign-in uses Supabase Auth email/password accounts. There is no public
registration flow. To enable access:

1. Create or identify the admin account in your Supabase project's Authentication
   users panel. The account needs a confirmed email and a password.
2. Set `SUPABASE_ADMIN_USER_IDS` on the Next.js application to that user's UUID.
   Use a comma-separated list for multiple admins. This is a server-only allowlist;
   an empty or missing value denies all admin access.
3. Keep `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` pointed at
   that same project, and retain `SUPABASE_SERVICE_ROLE_KEY` for privileged Photo
   Graph data operations. Authentication itself uses the anon key.
4. Redeploy the application and sign in at `/admin` with the account's email and
   password. Remove the old `PHOTO_GRAPH_ADMIN_PASSWORD` and
   `PHOTO_GRAPH_SESSION_SECRET` environment variables; they are no longer used.

The migration invalidates the former shared-password sessions. Supabase tokens
are stored in HttpOnly cookies, and Next.js `proxy.ts` refreshes them only for
admin pages and APIs. The page and each `/api/admin/photo-graph/` data route
independently validate the current user with Supabase Auth and check the
allowlist. Sign-out ends the current session without signing out other devices.
The browser's signed-upload client remains separate from authentication.

### Recoverable uploads

Before deploying the recoverable-upload code to another instance, review and
apply both `20261014212606_photo_graph_recoverable_uploads.sql` and
`20261014212629_restrict_photo_graph_upload_rpc_permissions.sql` under
`supabase/migrations/`, or use the updated `supabase/photo-graph-schema.sql`
through the existing schema-application procedure. Both migrations were applied
to `https://api.dextery.dev` through MCP on October 14, 2026. This adds a service-role-only
`photo_graph_uploads` journal and registration RPCs; it does not rename existing
objects or rewrite existing graph data. Until the schema is installed,
registration fails safely without moving or deleting uploaded originals.

Function permissions explicitly revoke `PUBLIC`, `anon`, and `authenticated`:
revoking only `PUBLIC` is insufficient on instances that explicitly grant
execution to browser roles through default privileges. Verification confirmed
that only the service role can access the upload journal and Photo Graph upload
RPCs, with existing graph counts and the graph revision unchanged. The local
doctor currently fails its image-render preflight with `401 Unauthorized` because
the local `.env.local` Supabase keys are stale. The production anon key and public
graph endpoint were verified separately. Do not rotate shared server credentials
or weaken RLS to address a stale local environment file.

Each registration sends an immutable UUID `uploadId` with its image metadata.
The journal reserves stable node IDs, and Storage copies retain the `_pending/`
originals until nodes, relationships, settings, and the completed result commit
in one database transaction. A revision check rejects a graph generated from
stale data. Retrying the same key and metadata reuses reserved assets or returns
the original committed result, rather than creating duplicate nodes. Keys cannot
be reused with different metadata or a different admin account.

The admin browser stores recovery metadata (no credentials or signed tokens) in
local storage **before** each direct upload. **Retry registration** checks pending
originals through an independently authorized `upload-status` endpoint and resumes
received images without uploading again, including after a reload or a lost
Storage response. If an original is missing, reselect its file: recovery verifies
its SHA-256 hash and obtains a new signed URL for that exact pending path without
overwriting an existing object. Images never attempted must be selected afterward.
Do not clear browser storage while registration is pending. An upload key and its
metadata can also be recovered from the service-role-only journal after
registration has started.

Web Locks serialize uploading, sealing, registration and cleanup across admin
tabs. A second tab cannot register a still-growing batch or clear another tab's
journal; it receives storage-event updates and re-reads recovery state while
holding the lock. Uploads fail closed if Web Locks or local storage are unavailable.
The batch is sealed before the first registration request, so retries retain the
same immutable metadata.

Temporary source copies are removed only after commit. Cleanup failures are
reported as warnings, retain browser recovery state, and can be retried with the
same batch. Incomplete journal entries and their copied assets are intentionally
retained for recovery; do not delete them as a diagnostic step. There is no
automatic age-based cleanup of abandoned uploads.

Authentication follows Supabase's [server-side Auth setup](https://supabase.com/docs/guides/auth/server-side/creating-a-client).
The authentication flow itself requires no Storage policy or data migration;
recoverable uploads require the schema migrations described above.

### Frontend deployment

The existing Vercel project is `thetextas-projects/portfolio` (`dextery.dev`).
Production environment variables are managed in Vercel, not copied from stale
local files. `.vercelignore` excludes environment files, `.tmp/` fixtures,
documentation caches and browser-test artifacts from CLI uploads. Inspect upload
inputs with `vercel deploy --dry --json` before deploying. Build with
`vercel deploy --prod --skip-domain`, validate the resulting deployment, then use
`vercel promote <deployment-url> --yes` to switch the live domain. Retain the
previous deployment URL for rollback. The reviewed release uses Next.js 16.4.3,
React 19.3.1 and Sharp 0.35.5; compatibility holds and audit scope are documented
in `docs/dependency-updates.md`.

Run `npm run admin:validate-auth` to verify authorization, login, refresh, and
sign-out against a local Auth stub. It copies the application into a temporary
fixture and starts its own Next.js development server with test-only Supabase
settings. It never accesses production Auth, Storage, or database services and
does not interrupt the regular development server.

## Photo Graph storage and migration

**Retention update — 2026-10-15:** after explicit owner approval and a fresh
SHA-256 comparison of all 102 migrated originals against R2, the 102 redundant
Supabase originals and six unjournaled pending uploads were deleted via the
Storage API, using an exact 108-path manifest. Bucket `dextery.dev` is empty;
all 103 R2 originals and graph nodes remain. Other buckets were untouched.
A Supabase-only rollback now requires copying and verifying **all** needed R2
originals back first. The six deleted pending uploads are no longer recoverable.
The standalone legacy render-cache service was separately retired on 2026-10-30.

Photo Graph metadata/Auth remain in Supabase. On 2026-10-15 all 102 referenced
originals (1,250,719,633 source bytes) were copied and SHA-256 read-back
verified in private published R2 bucket `dextery-photo-graph`. Those 102 graph
rows use the R2 provider and the shared image/media Worker's `/photo-graph/`
routes; the first live R2 upload subsequently added node 128, bringing the current
catalogue to 103 originals. See
[`docs/photo-graph-r2-migration.md`](./docs/photo-graph-r2-migration.md).

The 2026-10-15 additive migration
`supabase/migrations/20261015000937_photo_graph_storage_provider.sql` adds
provider-qualified rows and a durable R2 deletion journal. R2 uploads are
selected only when server-side `PHOTO_GRAPH_MEDIA_WRITE_PROVIDER=r2`; the
`PHOTO_GRAPH_R2_S3_ENDPOINT`, `PHOTO_GRAPH_R2_ACCESS_KEY_ID`, and
`PHOTO_GRAPH_R2_SECRET_ACCESS_KEY` settings must point to an Object Read & Write
credential scoped **only** to `dextery-photo-graph` and private
`dextery-photo-graph-staging`. Never put credentials in `NEXT_PUBLIC_*`.
Unfinished legacy Supabase batches keep their original provider across deploys.
The admin **Retry R2 Cleanup** action retries queued, unreferenced R2 deletes.
For a rollout check when a production key is non-readable, an authenticated
administrator can use **Check R2 Access** under Manage Photos (or POST to
`/api/admin/photo-graph/r2-diagnostic`). It reports
only the failed stage/status after checking a published canary and attempting
one private staging PUT/HEAD/DELETE; it never registers a graph node or exposes
credentials. Inspect private staging if it reports `cleanupPending: true`.

The private staging bucket allows PUT CORS only from dextery.dev,
www.dextery.dev, and localhost:3000 for signed content-type, checksum, and
source-metadata headers; it is not bound to the public Worker. A synthetic
signed PUT, published copy, SHA-256 read-back, and cleanup passed.
The first authenticated Production R2 upload then committed node 128; its
published bytes matched the journal's SHA-256 and size, its image transform
returned HTTP 200, and private staging remained empty. No current originals have
Supabase source copies. The historical migration copier remains available via
`npm run photo-graph:copy:r2 -- --manifest <file>` for a dry run; add `--copy`
only after confirming the target and manifest. The copier requires a Cloudflare
token in its process environment and refuses differing R2 objects.

For a separately approved Supabase-only rollback, first reverse-copy and verify
every required R2 original and reconcile in-flight batches; only then switch
provider references or restore Supabase-only code. Retain R2 originals throughout.
The static fallback is an older 45-photo subset, not a full-catalogue backup. It
resolves its available originals through R2 without changing relationships or
reinterpreting provider-less legacy database rows and upload journals.

| Command                                   | Purpose                                                         | Mutates data |
| ----------------------------------------- | --------------------------------------------------------------- | ------------ |
| `npm run photo-graph:doctor`              | Check storage, tables, RPCs, image rendering, and reachability. | No           |
| `npm run photo-graph:apply-schema`        | Apply the Photo Graph database schema.                          | Yes          |
| `npm run photo-graph:migrate`             | Migrate legacy Firebase data.                                   | Yes          |
| `npm run photo-graph:rename-storage`      | Rename the bucket and normalize storage paths.                  | Yes          |
| `npm run photo-graph:backfill-dimensions` | Populate missing image dimensions.                              | Yes          |
| `npm run photo-graph:extract-colors`      | Generate the versioned color-feature catalog.                   | Local files  |
| `npm run photo-graph:backfill-colors`     | Generate and persist color features.                            | Yes          |

Run mutating commands only after confirming the target Supabase project and
database connection variables. `photo-graph:doctor` is the safe first check.

Legacy Supabase-backed Photo Graph images generate transformed public URLs through `storage.from(bucket).getPublicUrl(path, { transform })`. Supabase Storage handles WebP negotiation for those legacy requests; R2-backed images instead use the shared image Worker. Neither path depends on Vercel/Next image transformations.

`photo-graph:apply-schema` accepts either a full `postgres://` connection string in `SUPABASE_DB_URL` (or `DATABASE_URL` / `POSTGRES_URL`) or a split self-hosted setup using `SUPABASE_DB_URL=<host>:<port>`, `SUPABASE_DB_USER`, `SUPABASE_DB_PASSWORD`, and optional `SUPABASE_DB_NAME`.
If your Coolify Postgres container is internal-only, `photo-graph:doctor` warns about the DB socket rather than treating that socket check as a failure.

The doctor checks backend availability and a provider-qualified original plus
WebP transform. It uses only HTTP GET/HEAD and a database TCP reachability probe;
RPC discovery reads PostgREST's OpenAPI schema without invoking a mutating
function. No retired-cache header or one-week TTL is required. It is a sample
health check, not a full object/checksum inventory. A local credential failure
does not justify changing production credentials or restoring old services.

Recovery-only source under `deploy/supabase-image-cache/` is not part of current
delivery. Historical retirement evidence and separately approved recovery
procedures remain in
`dextery-infrastructure/docs/supabase-image-cache-retirement.md`.

## Development notes

Open design and interaction ideas belong in the issue tracker or a dated design
note under `docs/`, rather than an undated README TODO list. This keeps setup
information stable and makes unfinished ideas easier to prioritize.
