# Elliot Mairet: five-colour extraction

The example in **Navigating by colour** on `/write-ups/elliot-mairet` uses the
shared [AnimationPlayer](animation-player.md), not an iframe or a second clock.
It adds no dependency or production change to Elliot's application.

## What is real

`public/projects/elliot-mairet/palette-extraction/` contains a 1200px WebP of the
golden-leaves photograph already shown in the article and `recording.json`.
Photography is credited to Elliot Mairet and links to the public photograph page.
The original is downloaded only for local generation, into ignored `.tmp/`.

The recorder imports `extractOklabKMedoids` from the adjacent Elliot repository.
It matches the upload pipeline's orientation, 96px longest-side resize and
alpha-greater-than-200 filtering, then processes all 6144 pixels of the 96×64
sample. The five weighted medoids must exactly match the published photograph's
five swatches. Source-image, preview, sample and owning-code SHA-256 hashes and
the Sharp version are retained in the recording.

384 spatially sampled pixels illustrate final membership, using the same 32-level
quantization and squared OKLab distance as the extractor. Their positions and
consolidation are explanatory motion, not recorded solver iterations or measured
upload latency. The caption makes that distinction. No runtime image analysis,
marketplace requests, Supabase calls or external image loads are needed.

## Playback

- **Sample — 2s:** a gapless mosaic of actual sample colours covers the photograph.
  Shared tile edges snap to canvas pixels so fractional/mobile scales have no seams.
- **Group — 2.5s:** the sampled tiles move into their five computed colour groups.
- **Palette — 3s:** groups consolidate into the five equal-width navigation swatches.
- The shared player adds its smooth 450ms loop return. The source photograph
  stays fixed; there are no scores, panel chrome or completion check marks.

The three stage anchors are 0, 2000 and 4500ms. Selecting an anchor shows that
stage's settled illustration and holds it until the next stage, preventing
autoplay from undoing the selected pose. Transition IDs capture the actual current
pose so interrupted selection/reset stays continuous. Rendering updates one
bounded, responsive 2D canvas and the five swatches, not React state every frame.
Device pixel ratio is capped at two. Visibility, keyboard controls, stage snapping,
user pause and reduced-motion behaviour remain owned by the shared player.

Server HTML and JavaScript-disabled browsing show the photograph and five-colour
palette. Image decoding gates playback. Reduced motion shows the final palette
without autoplay and permits immediate stage selection. A failed image keeps the
static swatches and an explanatory message, with playback disabled.

## Reproduction and checks

```sh
# Public original GET and local output only; no credentials or infrastructure writes:
node scripts/elliot-mairet/freeze-palette.mjs --download
# Reproduce from the cached original without network or output changes:
node scripts/elliot-mairet/freeze-palette.mjs --check
# An alternative owning checkout can be the first positional argument.
npx vitest run tests/unit/elliot-palette-animation.test.ts tests/unit/animation-timeline.test.ts
PORTFOLIO_TEST_PORT=3157 npx playwright test tests/e2e/elliot-palette-animation.spec.ts
```

Regeneration requires the owning checkout; ordinary builds and tests use only
the committed snapshot. Tests cover provenance, weights, real sample geometry,
continuous/interrupted poses, stage selection, autoplay/reset, reduced motion,
desktop/mobile layouts and the no-JavaScript fallback.
