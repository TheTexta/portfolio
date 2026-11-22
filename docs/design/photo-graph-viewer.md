# Photo Graph viewer

## Interaction

At `/projects/photo-graph/experience`, open graph controls and enable **3D**.
The default remains 2D; homepage, article and admin previews remain 2D. The mode
choice lasts only while the experience is mounted. The standalone route retains
compact controls and an icon-only return link, not a photograph-browser panel.
The embedded keyboard selector is described in
[navigation and previews](navigation-and-previews.md#loading-controls-and-scrolling).

In 3D, photographs are camera-facing rectangles in an XYZ force simulation:

- Drag empty space to orbit, scroll/pinch to zoom, and right-drag or use two
  fingers to pan.
- Hold **Shift** during a left-mouse camera drag to pan; releasing Shift resumes
  orbit without releasing the mouse. Mid-drag changes are supported without
  changing photograph dragging or Ctrl/Meta-started panning.
- Drag photographs to reposition them; select one for inspection/download.
- **Reset**, beside the top-right compact control, fits the current graph over
  900ms in either mode without changing settings. It remains visible with graph
  controls closed.

Distance settings use world units in 3D, not screen pixels. Reduced motion
disables camera damping/reset animation and pre-settles the initial layout;
there is no automatic orbit. Bounding-sphere collision prevents world-space
intersections, not every screen-space overlap.

Sliders support square-handle dragging, horizontal trackpad scrolling over the
field and keyboard input. Horizontal motion changes the value in the swipe
direction; vertical scrolling/pinch remain native. Track clicks/drags do not
change the value. Control text uses 12px desktop/14px mobile, medium weight,
8px/12px spacing and minimum 32px/44px control rows.

## Renderer boundaries

`PhotoGraphCanvas` owns loading, settings and inspection. `PhotoGraph2DRenderer`
and lazily imported `PhotoGraph3DRenderer` own independent mutable graphs and
save numeric camera/layout snapshots in memory across mode switches. Both use
the same payload, links and provider-aware media URLs. If force settings changed
in the other mode, the returning renderer settles/fits the changed layout rather
than freezing old coordinates.

Only the standalone route opts in with `allow3D`; no persisted coordinates,
database settings, feature model or media migration are added. Three.js and
`react-force-graph-3d` load only on activation. Switching modes does not refetch
the graph. Disabling 3D aborts texture requests/releases its WebGL context;
the graph library disposes attached scene resources. Unsupported WebGL,
initialization/import failure or context loss restores 2D with a retry explanation.

## Rendering budgets and image delivery

These are implementation limits, not measured performance claims:

- Bounded image concurrency; screen-projected texture demand, limited to a
  3840px longest side and the GPU's limit.
- 48 MiB retained RGBA texture budget. Small background photographs do not reduce
  close-up resolution unless combined demand exceeds it. Under pressure,
  dimensions scale proportionally; superseded textures shrink before upgrades
  and offscreen allocations are evicted.
- Native pixel ratio within a 16-megapixel drawing-buffer budget and native
  WebGL antialiasing. Viewport/density changes resize the buffer; texture requests
  use its actual pixel ratio.
- Resolution tracking uses uploaded dimensions so downscaled textures can
  upgrade after zooming without repeatedly requesting rounded image tiers.
- 3D photograph textures use nearest-neighbour minification/magnification and
  disabled canvas smoothing during preparation. Geometry antialiasing and memory
  limits remain; 2D uses normal smoothing. Inspection retains original resolution.

The 1536/1920/2560/3200/3840px request tiers are 3D-only. Before releasing an app
change depending on them, verify the matching Photo Graph allowlist in
`dextery-infrastructure/cloudflare-assets/worker.mjs`. If publishing is needed,
obtain separate deployment approval and publish the Worker first; an older
allowlist can reject widths and cause fallback to archival originals. Do not
change other projects' transform allowances, routes or private staging.
See [media migration](../photo-graph-r2-migration.md) for delivery and rollback.

## Checks

```bash
npm run test:e2e -- tests/e2e/photo-graph-3d.spec.ts
```

The suite uses intercepted local graph/image fixtures and real Chromium WebGL,
not production services. Crowded-scene cases zoom a foreground photograph with
102 background photographs at normal/Retina density, check uploaded resolution
and retained texture memory, then reset/upgrade without repeated requests.
Other cases cover nearest-neighbour GPU samplers, mid-drag Shift changes
with/without damping, cancelled gestures, touch navigation and responsive controls.
See [test setup](../development.md#tests).
