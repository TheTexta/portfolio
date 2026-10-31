# Project write-ups

Scope: `/projects/photo-graph`, `/projects/elliot-mairet`, `/projects/bur1alrites`, and the shared
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
Red Hat typography, square media, and existing site header. No new palette,
decorative frame, or article-specific motion.

STORY: Open a project's “write up”, read its process, and optionally follow a
normal link to the live project or source. Elliot explains the minimal interface
and distinctive navigation; Photo Graph retains its actual findings and limitations.
bur1alrites explains Allie's reactive lighting brief, the 3D gallery, and the
projector room's grain and bloom without inventing client feedback or metrics.

FIRST VIEWPORT: Existing site header above a centred, left-aligned article.
MDX title, summary, and small project links lead into a column-width interactive
preview, followed by text and inline static media. The desktop column uses two-thirds
of the viewport, capped at 672px for reading. Prose, media, and captions share its
horizontal edges. Mobile uses the available width with gutters.

FORM: User-pinned single-column text/media article, implemented code-first.
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
