# Navigation and embedded previews

## Shared catalogue and navigation

`app/components/projects/project-catalog.ts` and `project-routes.ts` centralize
project identity, links and ordering. Entries with `showInBrowser: false` remain
in About's write-up list, metadata and sitemap, but not cards, focus hashes or
previous/next preview navigation. Discord Shoot Manager, Bot or Not and the
portfolio-design article use this path.

`use-project-browser-navigation.ts` owns hashes/history, view-transition
cancellation and focus/scroll restoration; `ProjectBrowser` owns rail layout and
presentation. Embedded browsers keep interactions local without changing
document history, scroll or document-wide transitions. Detail layout follows the
container width, not the page viewport.

Header identity, portfolio directory and Grailed Plus footer home links use
document navigation to reset `/portfolio` at the top, clearing mounted project
focus. About/Contact/Projects anchors close focus and retain their target section,
not an old rail scroll position. Arrival targets suppress an outline without
removing keyboard focus or individual controls' visible focus indicators.

Write-up **Index** links return to the list; **Back to projects** returns to that
article's project, or About for write-up-only entries. Closing previous/next links
cycle through all seven articles in catalogue order, skipping entries without an
article. Standalone experiences return to their article/product page.
Grailed Plus install links retain the product page in history and reset their
busy state after browser-cache restoration; tracking remains separate.
The Grailed Plus product page scrolls freely without section snapping. Its opening
description links each feature phrase directly to the corresponding detailed
showcase, without a separate feature-link list.

Desktop horizontal trackpad gestures over homepage cards move the rail directly
in either direction with native trackpad momentum. Autoplay eases back in as
scrolling slows from 1.25× its animation speed to that speed; it adds no momentum
or position reset. A fresh swipe takes control immediately. Vertical page
scrolling, hover slowdown, keyboard-focus pause, reduced-motion scrolling and
mobile accordion behavior remain separate. The embedded article browser does not
capture these gestures.

The [About design guide](homepage-about.md) documents the biography/write-up list.
Shared editorial motion uses `app/hooks/use-reduced-motion.ts`: the server and
first client render agree, then follow live preference changes.

## Preview navigation contract

Photo Graph stays interactive inside its overview: drag/zoom/select without
leaving the page. **Launch experience** opens the full gallery. It is exempt from
other overview previews' click-to-open behavior.

Grailed Plus and three separately hosted sites use HTML previews. In overview
mode, reported clicked links navigate the top-level page while wheel/touch
scrolling stays inside the frame. Grailed Plus links can be read on the same
origin. External sites send URLs via a `dextery-preview-navigation` `postMessage`;
the portfolio must validate both the sender's frame and origin. Unreported clicks
fall back to the project's main site. bur1alrites video links open the selected
video's room.

Changing this contract requires coordinated changes in `bur1alrites`,
`elliotmairet` and `nepobabiesruntheunderground`. Until a hosted site supports it,
the overview still opens that project's main site. Do not bypass sender/origin
checks to work around missing support.

Article previews opt into native interaction: controls, links, scrolling and
keyboard navigation stay inside the preview. This disables click-to-launch and
uses `referrerPolicy="no-referrer"` to keep the hosted portfolio-navigation bridge
inactive. The sandbox remains. Only the bur1alrites write-up explicitly grants
autoplay and `allow-pointer-lock` for mouse-look/WASD; top-level navigation stays
sandboxed and other previews gain neither permission. See the
[write-up guide](project-write-ups.md#boundaries) for per-project scaling/provenance.

## Loading, controls and scrolling

Do not infer iframe failure from a timer or separate HEAD request: the frame may
be usable while subresources load, and cross-origin errors cannot be diagnosed
reliably by the parent. Native error events may show status but must not unmount
the frame. A single accessible expand/open icon opens the project in a new tab.
There is no options, reload or retry panel.

Optional `ProjectPreviewControls` sit below the media: boxed preview name on the
left, 44px open action on the right. `ProjectPreview` accepts
`showControls={false}`; project-browser previews omit the strip by default and
retain launch actions in project details. Native article interaction is preserved.
HTML frames draw an unscaled 24px gutter beyond clipped right/bottom edges to hide
scrollbars without disabling wheel, touch or keyboard scrolling. Grailed Plus's
hero retains its fixed 1280px viewport; canvas and narrow-screen static launch
panels are separate.

Control-enabled Photo Graph views share one native **Browse photographs**
disclosure, photograph selector, explicit Open action and connected-photo buttons
outside the 2D/3D renderers. In the standalone experience its entry appears on
keyboard focus or when graph settings are expanded; the resting canvas has no
additional visible chrome. Selection does not move the standalone camera or open
inspection. Embedded selection retains its existing 2D recentering; previews that
disable graph controls still omit browsing.
Expanded settings and browsing sit beside each other where they fit, or use
separate bounded scroll areas on narrow screens, so neither covers the other's
focused controls.

Inspection uses a native modal dialog. Closing returns to its valid browser
trigger, current selector/entry, or graph region; canvas-origin inspection returns
to the graph rather than unrelated settings. Focus return skips controls clipped
by their scroll area after a resize or rotation. Escape belongs to the native select,
open disclosure or inspector rather than also activating surrounding project
navigation. Known descriptions reuse identity-verified article text; other images
explicitly report unavailable subject descriptions. VoiceOver/Safari and real iOS
assessment remain manual acceptance checks, not claims established by Chromium.

## Recorded examples and checks

- [Animation player](animation-player.md): seekable shared playback, stage snapping,
  selection/reset transitions and pause/resume for DOM/SVG/canvas/iframe scenes.
- [Grailed Plus recording](grailed-plus-recorded-demo.md): bundled real MobileCLIP-S1
  results with five photographs, a sample-data note and photo credits.
  Other sample listings are identified in frame descriptions rather than a
  separate disclaimer banner.
  The demo remains inert until its readiness handshake; refresh deliberately with
  `npm run grailed-plus:sync-demo` from the portfolio repository root, using
  `../grailed-plus` as the default adjacent extension source.
- [Elliot palette animation](elliot-palette-animation.md): recorded real OKLab
  extraction with local provenance and regeneration instructions.
- [Discord lifecycle](discord-shoot-lifecycle.md): illustrated Create/Join/Archive
  workflow, not a live Discord recording; no child clock/external requests.

`tests/e2e/navigation.spec.ts` checks round trips, history and internal/section
destinations on desktop/mobile with local fixtures.
`page-hydration.spec.ts` covers motion settings and live preference changes;
`write-up-room.spec.ts` exercises real headed Chromium pointer lock and responsive
room/mobile playback. See [test setup](../development.md#tests).
