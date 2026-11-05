# Grailed Plus recorded comparison

The `market-compare` specimen on `/grailed-plus` and the example under **Combining
metadata and image similarity** on `/write-ups/grailed-plus` share a photo-only animation owned
by the Grailed Plus repository (`demo/recorded-comparison.ts`, `src/ui.css`). One
source photograph stays fixed while five candidates cycle from production
metadata order into the order derived from recorded real MobileCLIP-S1 ONNX
scores. Confidence groups remain intact. The public iframe downloads neither
the model nor external photos, and does not query marketplaces.

The portfolio wrapper preloads at 600 px. The shared [AnimationPlayer](animation-player.md)
then owns three authored stages: 2.7 seconds of analysis, 1.2 seconds of recorded
reordering and 3 seconds of completion/check. A separate 450 ms return smoothly
restores the initial photograph positions without fading them. The horizontal
navigation rail tracks playback continuously, but clicks and keyboard navigation
select only the three stage starts (0, 2700 and 3900 ms). Selections interpolate
from the current pose over 450 ms, even when interrupting a selection or reset.
The player forwards validated `frame` messages with `timeMs` and transition
metadata; there are no competing child stage timers. Both origins and associated
windows are checked on both sides. Offscreen/hidden players freeze; reduced
motion shows the final order/check and allows immediate stage selection.

Keep the scene borderless and photo-only apart from its analysis/check cues.
The only playback UI is the shared thin rail, hover/focus stage labels and
pause/resume affordance. Its surrounding copy is a small disclosure and link to the demo's
`/projects/grailed-plus/recorded-demo/photo-credits.html` (licensed photographs, original authors, and adaptation
notices). Other feature demos and the overview retain their interactive panel
and illustrative-data disclosures.

The portfolio serves a checksummed snapshot of that build from
`public/projects/grailed-plus/recorded-demo/`. This avoids depending on an
unpublished remote demo release for either article or product-page playback.
It includes the six WebPs, attribution page, MIT code license, full-precision
recording and file-hash inventory; it never includes ONNX/WASM. The wrapper still
validates both origin and window for same-origin messages.

Refresh the generated files with `npm run grailed-plus:sync-demo`, using the
adjacent `../grailed-plus` source repository (or pass its path as the command's
argument). This runs the owning demo build and copies its static output without
rewriting the generated source. Assets and credits use relative URLs so the
same build also works at the hosted demo root. The snapshot hashes identify the
actual files; its checkout revision is not a claim that local changes are committed.

`NEXT_PUBLIC_GRAILED_PLUS_DEMO_ORIGIN` still configures the other interactive
specimens; it does not override this bundled recording. The extension repo's
`npm run demo:record` regenerates the provenance fixture; `npm run
test:demo:browser` checks actual motion, stable image nodes, reduced motion,
visibility, mobile layout and network isolation. Portfolio browser tests exercise
the actual static recording in the article, not a mocked remote animation.
No deployment of either application is authorized by these local changes.
