# Elliot Mairet: current MMCQ palette illustration

The example in **Navigating by colour** on `/write-ups/elliot-mairet` uses the
shared [AnimationPlayer](animation-player.md), not an iframe or a second clock.
It adds no dependency or production change to Elliot's application.

## Current snapshot: `mmcq-v1`

`public/projects/elliot-mairet/palette-extraction/mmcq-v1/` contains the versioned
recording and 1200px WebP. Photography is credited to Elliot Mairet and links to
the public photograph page. This reuses the previously approved golden-leaves
original, not a derivative as analysis input.

The 23 November 2026 snapshot pins owning revision
`aef9eb2cc1cde3b9c79e738fd27ed34ddc03c74a`. During deliberate local generation,
the recorder calls the owning application's **actual** `extractImagePalette`
sampler and `analyseImage` production analyser. Executed source files must match
that Git revision byte-for-byte; unrelated application edits are not imported.
The recording includes hashes for the sampler, MMCQ extractor, shared colour
helpers, analyser, input configuration and that revision's package manifests.
Those manifest hashes identify the source revision, not a claim that every
installed dependency or unrelated checkout file is pristine. Runtime versions are
recorded separately: Node `v22.23.4`, Sharp `0.35.5`, libvips `8.18.7` and
exif-reader `2.0.3`.

The original SHA-256 must match the historical record before analysis:
`5b97617812228c5504fca3004f675b84a9c51d652ea6753b484c0223fde37442`.
The current sampler auto-orients, resizes inside 256×256 without enlargement and
excludes alpha at most 200. Here it analyses **43,776 pixels at 256×171**.
The preview and uncompressed RGBA display sample hashes are retained too.

The `mmcq64-vibrant-oklab-v1` model uses two quantisation phases toward up to 64
candidates, then selects up to five supported, perceptually separated, genuine
sampled colours. This original returns, in **production selection order**:

| Swatch    | Full-sample population weight |
| --------- | ----------------------------- |
| `#cea01e` | 0.22635690789473684           |
| `#845811` | 0.29509320175438597           |
| `#381f0b` | 0.1503563596491228            |
| `#7fa1cc` | 0.11355537280701754           |
| `#ae7f0b` | 0.21463815789473684           |

Weights assign the full sample to the nearest selected swatch in OKLab; they are
not exact-RGB frequencies or selection scores. The recorder also checks the
analyser's coordinate mapping and six-decimal stored weights. The illustration
is a local reproduction of production code, **not a read of saved catalogue
data**.

## What the motion illustrates

A separate display sample uses the documented sampling geometry; running the
owning extractor over it must exactly reproduce the actual production sampler's
full output. Every 12×12 block supplies one real pixel, producing 330 display
tiles. Their nearest-selected-swatch OKLab assignments illustrate final groups.
They are not recorded median-cut boxes, selection events or solver iterations;
neither the tile population nor the animation duration measures processing
latency. The visible caption makes this distinction.

- **Sample — 2s:** a gapless mosaic covers the photograph. Shared edges snap to
  canvas pixels, including clamped partial edge blocks at fractional/mobile scales.
- **Group — 2.5s:** sampled tiles move into explanatory final colour groups.
- **Palette — 3s:** groups consolidate into equal-size navigation swatches, in
  selection order rather than population-weight order.
- The shared player adds its smooth 450ms return. The source photograph stays
  fixed; there are no scores, invented fill swatches or completion check marks.

Sample and moving frames use the same pure rectangle calculation. Each tile
retains its clipped source width, height and geometric centre, including the
partial right/bottom blocks; both dimensions interpolate independently toward
the group size and then the final palette point. Beginning motion therefore
does not expand clipped rectangles into full-stride squares.

The three stage anchors remain 0, 2000 and 4500ms. Selecting an anchor shows its
settled pose until the next stage; interrupted transitions capture the actual
current pose. Rendering updates one responsive canvas and the palette, not React
state every frame. Device pixel ratio is capped at two. Visibility, keyboard
controls, stage snapping, user pause and reduced motion remain owned by the player.
The canvas layout effect captures stable DOM elements and disposes the renderer
and resize observer synchronously before ref teardown. Disposed or detached
callbacks are inert, including resize work already queued during navigation.

The layout uses the actual nonempty count (one to five). Short palettes are
centred without placeholder swatches; group spacing and tile size keep even a
one-colour image's full display sample below the photograph and inside the canvas.
Server HTML and JavaScript-disabled browsing show the image and actual palette.
Image decoding gates playback; failure leaves the palette and explanation
visible. Reduced motion shows the final palette without autoplay and allows
immediate stage selection.

## Historical output stays historical

The unversioned `recording.json` and `photograph.webp` remain byte-identical.
They describe the previous 96×64, `kmedoids-oklab-v1` extraction, not current MMCQ:

- Historical JSON SHA-256:
  `bf93b1ae8ab14ffe2ef8aa0577cf78744fb6a87b4a135f20d08b2239a5c6fe52`.
- Historical preview SHA-256:
  `8e5e752d41b0baa69424b5a48458cc863f3f96ea0d33a4ce30be8382dd45add1`.

The current WebP happens to have identical bytes because the preview conversion
is unchanged. The article links the historical recording explicitly and dates
its older site screenshots; neither old swatches nor screenshot provenance have
been relabelled as MMCQ.

## Reproduction and checks

```sh
# Safe backwards-compatible historical check: no source checkout or network:
node scripts/elliot-mairet/freeze-palette.mjs --check

# Deliberate generation: explicitly selected owner checkout, pinned source.
# --download only GETs the already approved public original into ignored .tmp/.
node --experimental-strip-types scripts/elliot-mairet/freeze-palette.mjs \
  "../elliotmairet" --mmcq --download

# Reproduce current output with the recorded runtime, without network or writes:
node --experimental-strip-types scripts/elliot-mairet/freeze-palette.mjs \
  "../elliotmairet" --mmcq --check \
  "--original-path=.tmp/elliot-palette/20261025-DSCF7395.jpg"

npx vitest run tests/unit/elliot-palette-animation.test.ts tests/unit/animation-timeline.test.ts
PORTFOLIO_TEST_PORT=3157 npx playwright test tests/e2e/elliot-palette-animation.spec.ts
```

Generation requires that deliberately selected source checkout and its installed
dependencies. Ordinary builds, unit tests and browser playback use **only the
committed snapshot**: no sibling import, runtime analysis, external image load,
credentials, database access, media migration or storage write. Historical
regeneration is disabled; `--check` protects its known bytes instead.

Unit coverage includes provenance, order independent of weights, historical
immutability, clipped-edge rectangle continuity, pixel-aligned sample geometry,
one/two/five-swatch layouts, bounded dense groups, continuous/interrupted poses,
stage selection and reduced motion. Browser
coverage checks autoplay/reset, keyboard selection, gapless sampling, selection
order, desktop/mobile overflow, image failure and the no-JavaScript fallback.
The navigation regression retains a native observer's callback, explicitly
delivers it after article return-link teardown, and checks playback after going
back, with ordinary and reduced motion.
These are illustration regressions, not visitor usefulness or client-task results.
