# Project write-ups

Scope: all seven `/write-ups/<project>` articles and the shared
`app/components/projects/project-write-up.tsx` shell. Visitor mode: Read.

Article prose lives in each route's `write-up.mdx`. The adjacent `page.tsx`
retains metadata and data handling. MDX also owns the title, lead, project links,
and the position of `ProjectPreview`. Root `mdx-components.tsx` maps these to the
shared article primitives. The shell only supplies site navigation, the reading
column, and closing navigation.

## Direction contract

THESIS: Explain how a project was built through plain text and accompanying
images. Keep a continuous document, with one bounded, genuinely interactive
project preview near the top rather than a full-width hero or dashboard.

OWN-WORLD: Inherit the portfolio's black/white canvas and ink, muted captions,
Red Hat typography, square media, existing site header and animated BorderContainer.
No new palette, decorative system or article-specific motion.

STORY: Open a project's “write up”, read its process, and optionally follow a
normal link to the live project or source. Elliot explains the minimal interface
and distinctive navigation; Photo Graph retains its actual findings and limitations.
bur1alrites explains Allie's reactive lighting brief, the 3D gallery, and the
projector room's grain and bloom without inventing client feedback or metrics.

FIRST VIEWPORT: Existing site header above a centred, left-aligned article.
The centred MDX title uses the homepage's animated frame and shared responsive
text scale. Metadata and project links share a wrapping row below it, followed by
the summary and a column-width interactive preview where the project has one.
Text and inline static media follow. The desktop column uses two-thirds
of the viewport, capped at 672px for reading. Prose, media, and captions share its
horizontal edges. Mobile uses the available width with gutters.

FORM: User-pinned single-column text/media article, adapted from Figma frame
`36:149` in file `QccgILPVCw0Uofge2n2i3e` using existing components and tokens.
seed: none (user-pinned direction; no roll).

FINISH: verify the shared column, responsive media, native previews and accessible
navigation in the browser. Keep the scoped design decisions in this surface brief
and provenance beside every shipping raster; no root design-system rewrite.

## Boundaries

Photo Graph's experience, data, and processing tools are not redesigned. The
write-up uses local static media and the saved August 2026 benchmark, with its
historical dataset and editorial-review caveats stated explicitly. Article HTML
does not need a database read; the client-side graph preview separately loads
the public graph API. Its live data must not be confused with the saved benchmark.
Elliot is a completed, indexable article with project structured data and a sitemap
entry. Its three figures are screenshots of public views, not private admin data;
capture provenance is in `public/projects/elliot-mairet/write-up/sources.json`.
bur1alrites is also indexable and illustrated with three public screenshots and
one explicitly labelled off-axis inspection of its real home scene;
its source manifest is under `public/projects/bur1alrites/write-up/`.
The inspection was rendered in a disposable local copy with neutral materials,
wireframe/grid/camera helpers and no bloom. It does not pretend to be Blender or
an unaltered public-site screenshot. The hosted app and source checkout are unchanged.

Photo Graph's seven review images and two ranked result rows use individual
local photographs. `Gallery` and `Comparison` are server-rendered MDX components,
not embedded contact sheets. They preserve each image's aspect ratio, use the
page's own canvas in light and dark mode, and keep model labels and captions as
selectable HTML. The generated `gallery.json` retains the saved benchmark's order.

HTML previews opt into native interaction, disable the portfolio's click-to-launch
hook, and send no referrer so the hosted site's portfolio-navigation bridge stays
inactive. The iframe sandbox is retained except for bur1alrites' explicitly scoped
pointer-lock permission. Overview previews keep their
previous click-to-launch behaviour and frame/origin validation.
Elliot previews render at 85% on both desktop and mobile, sourced from the shared
project catalog. Native-interaction previews honour that scale without changing
their referrer or sandbox policy. Overview actions place source before write-up.

bur1alrites' write-up uses 80% desktop scale to keep its internal viewport above
the site's 768px desktop-interaction breakpoint; mobile keeps native tap playback.
Only that iframe permits autoplay and pointer-lock for the projector room's
mouse-look and WASD controls. These permissions do not extend to overview or
Elliot previews; top-level navigation remains blocked.

## Implemented system check

The article reuses the existing canvas/ink/muted tokens, Red Hat Text body and
Red Hat Display headings, site header, and theme control. Body text is 16px
with 1.8 line-height; section headings are 24px, and captions are 13px. Desktop
column width is `66.667vw`, capped at 672px for both text and media. Mobile keeps
20px side gutters, increasing to 32px at 640px. Figures retain their aspect ratios
and use image `sizes` matching the shared measure.
Article layout, typography, media, and previews use Tailwind utilities rather than
a separate stylesheet. Prose selectors stay scoped to authored MDX blocks;
`data-write-up-lead` preserves the introduction's spacing, and
`data-write-up-preview` excludes interactive controls from article link decoration.

This is an extension of the incumbent system, not a new visual world. The shared
HTML preview gains an opt-in native-interaction mode while retaining its launch
default. No global palette, typography tokens, or theme rules were changed. The
pre-existing absence of a root `DESIGN.md` is not repaired as a side effect of this
task.

Text selection uses the site's ink as its background and canvas as its foreground,
inverting with the theme. This treatment is defined site-wide in `app/globals.css`,
not as an article-only override.

The contact panel's difference-blend sweep stays white in light mode and uses the
site's off-white ink in dark mode, matching the panel's lettering and frame.

Shared motion preferences use a server-consistent `useSyncExternalStore` snapshot
before adopting the browser setting. This prevents reduced-motion hydration errors
in headings, borders, and homepage navigation without suppressing warnings. Reduced
motion also sets decorative line/image transitions to zero duration.

## Shared frame typography and current content

The homepage name, all seven article titles and the live frame example share
`BORDER_CONTAINER_TEXT_SCALE_CLASS`: 36px below 640px, 60px from 640px, and 96px
from 1024px. The shared article title uses the reference's 0.7705 line-height,
−0.04586em tracking, 20px vertical/16px horizontal text padding, 48px outer vertical padding and a
330px minimum desktop frame height. At the 672px reading measure its centre is
584px wide; the corner rows are at least 60px. Longer titles wrap between words
and grow, keeping the hyphenated Node-Gallery name intact.
Below 640px the outer padding is 32px, the minimum frame is 272px, and the side
extensions shrink to keep the title readable. The homepage and live example keep
their existing frame geometry while sharing the same text-size ramp.

The TVM case study now links to `TheTexta/discord-shoot-manager`; the TVM
installation keeps its identity and the case-study URL stays stable. Historical
source/CI links remain pinned to the reviewed revision under the new repository
name. Grailed Plus's introduction and contribution metadata describe the owner's
product work without fork framing or an unverified code-percentage claim; this
does not alter source-repository licensing or historical attribution records.

## Figma implementation

The owner requested this template for **all seven write-up pages**, not just the
mobile homepage named in the file URL. Direct website requests still return a
CloudFront 403, but the official Figma MCP connection successfully returned the
complete article, focused header/preview/footer context and full-size screenshot
on 2026-11-02. No export, sharing change or canvas edit was needed.

The shared shell keeps the global site header, 672px reading measure, 80px top
and 112px bottom padding. `ProjectMeta` places metadata on the left and links on
the right when they fit, wrapping for long project-specific values and on mobile.
The lead follows by 16px. Metadata separators are the unmodified downloaded Figma
SVG, rotated at its native 20 × 1px size; they are hidden below 640px to avoid
orphan rules in wrapped metadata.

Article previews start 40px below the header. Their media has the reference's
672:371.5 ratio, with a 256px minimum mobile height so native controls remain
usable. The border belongs to the media, not the controls. The 48px controls row
shows the project and `Homepage` (or `Graph` for Photo Graph), a short separator,
and the unmodified 24px direct-open SVG. The icon retains its accessible name,
keyboard operation and safe new-tab relationship. Homepage previews are unchanged.
The icon's 48px square hit area fills the row while its artwork stays 24px.
Static/write-up-only projects keep their actual content and live component
examples rather than receiving invented interactive previews.

The three Elliot images use the downloaded reference PNGs in their original
1440 × 1000 geometry. Existing WebP captures remain available; the source manifest
records both provenances. Shared SVG provenance is in
`public/projects/write-up/sources.json`. Runtime code uses no temporary Figma URLs.
Black SVGs invert with the existing dark theme without editing the assets.

The closing navigation has a top rule, 64px separation from the final content,
48px vertical padding, and previous/next article links on opposite sides. It
cycles in catalogue order across every article, including write-up-only entries,
and skips projects with no article. The existing Back to projects link is retained
below this row as a secondary return path. Stable routes, project links, About
copy, live examples, iframe sandbox/origin checks and reduced motion are preserved.

Local verification on 2026-11-02:

- `npm run check`: lint, typecheck and formatting passed.
- `npm test`: all 107 unit tests and both offline algorithm validators passed.
- An isolated, environment-free production build passed, retaining all seven
  static article routes. The owner's port-3000 development server was preserved.
- Both headed bur1alrites preview tests passed, including real pointer lock,
  keyboard room controls, live resize and mobile playback through local fixtures.
- Browser assertions cover the 320/390/640/768/1024/1440px title-size/overflow
  matrix, exact Elliot frame/media/icon geometry, local image loading, all seven
  previous/next destinations, keyboard focus, stable URLs and native previews.
  The final selected run had 91 passes, one existing mobile skip, and two desktop
  artifact-teardown errors caused by sharing the output directory with the
  parallel headed run. Both affected cases passed on an isolated rerun with
  `--output=.tmp/write-up-figma-recheck`. Run browser invocations serially or give
  each a separate `--output`; separate ports alone do not isolate artifacts.
- Independent source review found no material regressions. Rendered review
  accepted the reference adaptation after viewing the full reference and Elliot
  article, all seven desktop/mobile headers, footer, controls, 320px Photo Graph,
  and desktop/mobile dark captures. Preview interiors were intercepted during
  those captures; they are not evidence of live remote-site availability.
- The mechanical design detector and `git diff --check` reported no findings.

Section return targets suppress the browser's blue focus outline without removing
keyboard focus or the visible indicators on individual links and controls. Static
checks and 17 targeted navigation cases passed; one existing mobile case was skipped.

This records local verification, not a production deployment.
