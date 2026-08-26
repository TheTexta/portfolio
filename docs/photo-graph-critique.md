# Photo Graph Critique and Remediation Roadmap

Date: 2026-08-26

## Verdict

The gallery does not read as generic AI-generated UI. Its square monochrome controls, image-led canvas, compact editorial typography, and lack of decorative cards, gradients, shadows, and rounded chrome are consistent with the portfolio direction.

The graph concept is memorable, but the current relationship layer is too dense to explain itself. On desktop it competes with the photographs; at 375 x 812 it becomes the dominant visual texture. The implementation is technically deliberate, but the product does not yet show that the generated neighbors are perceptually meaningful.

## Evidence Baseline

Run:

```powershell
npm run photo-graph:doctor
npm run photo-graph:validate-edge-generation
npm run photo-graph:analyze
```

Original database baseline:

| Metric                  |                               Value |
| ----------------------- | ----------------------------------: |
| Nodes                   |                                 100 |
| Persisted edges         |                               1,063 |
| Edge density            |                              21.47% |
| Connected components    |                                   7 |
| Isolates                |                                   5 |
| Median degree           |                                  22 |
| Maximum degree          |                                  44 |
| Saved generation config | `sigmaE=58.5`, `minCorrelation=0.9` |

Fresh regeneration with the saved configuration reproduces the persisted edge count and graph metrics. The data is not stale.

Verified production model after remediation:

| Metric                  |                       Value |
| ----------------------- | --------------------------: |
| Nodes                   |                         100 |
| Persisted edges         |                         263 |
| Edge density            |                       5.31% |
| Connected components    |                           1 |
| Isolates                |                           0 |
| Median degree           |                         5.0 |
| Maximum degree          |                          10 |
| Saved generation config | `CIEDE2000`, `k=4`, `max=16` |

CIEDE2000 was selected from the reviewed seven-query benchmark with `precision@4=89%` and pairwise ranking agreement of `82%`. Run `npm run photo-graph:activate-ciede2000` to reproduce the persisted graph and saved configuration.

Runtime checks completed at 1440 x 900 and 375 x 812:

- Loading state is announced and visible.
- A forced graph API 503 displays an error and retry action.
- Retry recovers after the API becomes available.
- The inspect dialog receives focus, traps Tab navigation, closes with Escape, and restores the prior focus context.
- Reduced-motion mode removes CSS transitions and disables animated graph fitting.
- The 375px layout has no document overflow.
- Mobile graph and inspect controls render at 44 x 44px.

## Priority Findings

### P0: Similarity validity is unproven

**What**

`computeFeaturePayload()` reduces an image to one alpha-weighted mean RGB value. `featureFromRgb()` converts that value to CIELAB, and `computeLabCorrelation()` applies CIE76 with a Gaussian mapping.

**Why it matters**

One mean cannot preserve palette distribution, dominant and accent colors, or spatial composition. A half-red/half-blue image and a flat purple image can have similar means while looking unrelated. Changing CIE76 to a newer distance formula cannot recover information already discarded by the mean.

**Recommendation**

Treat the current model as a baseline. Build a labeled set of real portfolio-image neighbor judgments, then compare mean color against a compact perceptual palette or histogram representation. Compare CIE76, CIEDE2000, or Oklab only after holding the feature representation constant.

**Success criterion**

The selected model improves labeled `precision@k` and pairwise ranking agreement without unacceptable upload, storage, or graph-generation cost.

### P1: Connections overwhelm the photographs

**What**

The persisted graph renders 1,063 edges for 100 nodes. Desktop and mobile runtime inspection show large regions of crossing lines, with the mobile view especially dominated by the edge field.

**Why it matters**

The graph implies precision while making individual relationships difficult to follow. Visitors see network texture before they can understand why two photographs are related.

**Recommendation**

Evaluate top-k or hybrid top-k-plus-threshold connectivity. Make hidden connections the mobile default until a sparser policy is validated. On selection, emphasize the chosen node's local neighborhood and suppress unrelated edges.

**Success criterion**

Every non-isolated node has a useful local neighborhood, global density is materially reduced, and a selected relationship can be traced without unrelated crossings dominating it.

### P1: Canvas nodes are not keyboard-accessible

**What**

Photographs are hit regions inside a canvas. They have no DOM role, accessible name, focus target, or keyboard activation path.

**Why it matters**

Keyboard and screen-reader users can operate the surrounding controls but cannot inspect the primary content. Focus restoration after a pointer-opened dialog correctly returns to the canvas context, but there is no focusable originating node.

**Recommendation**

Provide a synchronized DOM alternative such as a compact photo index or listbox. Keep canvas and DOM selection in sync, and expose each photo's generated neighbors through semantic controls.

**Success criterion**

Every photo can be reached, identified, opened, and related neighbors reviewed using keyboard and screen-reader navigation.

### P2: Edge-generation controls obscure one effective cutoff

**What**

For correlation `c = exp(-(deltaE / sigmaE)^2)` and threshold `c >= minCorrelation`, edge inclusion is equivalent to:

```text
deltaE <= sigmaE * sqrt(-ln(minCorrelation))
```

The saved `58.5 / 0.9` pair has an effective cutoff of about 19.0 Delta E. A very different `15 / 0.2` pair produces almost the same cutoff and the same edge count, while assigning different correlation weights to retained edges.

**Why it matters**

The controls look independent but are coupled for connectivity. Editors can reach nearly identical topology through confusing parameter combinations while still changing force strengths.

**Recommendation**

Expose a perceptual distance cutoff directly. If correlation falloff remains useful for force weighting, present it as a separate layout control rather than part of edge eligibility.

**Success criterion**

Each admin control has one understandable effect, and equivalent topology cannot be reached through opaque parameter combinations.

### P2: Full regeneration will not scale indefinitely

**What**

Each upload compares every node pair and replaces the complete edge table. The current 100-node regeneration is fast, but pair count grows as `n(n - 1) / 2`.

**Why it matters**

The implementation performs unnecessary work when only new or changed features need new pair comparisons. Full delete and insert also increases the failure surface during concurrent uploads.

**Recommendation**

After the similarity representation stabilizes, compute edges incrementally for added nodes and use a transaction or versioned graph swap. Retain full regeneration as an explicit maintenance operation.

**Success criterion**

Uploading one image performs O(n) similarity work, leaves the previous graph readable until commit, and cannot allocate duplicate node IDs during concurrent requests.

## Completed Immediate Fixes

- Added explicit `loading`, `empty`, and `error` graph states with retry.
- Replaced raw white/black canvas classes with the shared `bg-canvas` token.
- Removed the inspect-state blur that violated the no-blur design direction.
- Added dialog semantics, initial focus, Tab containment, Escape closure, and focus restoration.
- Added reduced-motion handling for graph fitting and inspect transitions.
- Added meaningful inspect-image alternative text.
- Raised mobile graph and inspect actions to 44px touch targets.
- Added `photo-graph:analyze` for reproducible graph metrics and parameter sweeps.
- Replaced the production CIE76 threshold graph with CIEDE2000 using four directed neighbors per node and a maximum Delta E 00 of 16.
- Reduced the persisted graph from 1,063 to 263 edges while producing one connected component with no isolates.

## Roadmap

### Stage 1: Measurement

- Create a fixed manifest of representative real portfolio images.
- Label expected neighbors and explicit non-neighbors with the intended meaning of "similar color."
- Add ranking metrics, false-positive examples, graph metrics, and deterministic result output.
- Record extraction browser, source color profile, transparency behavior, and feature version.

### Stage 2: Relationship Design

- Compare threshold, top-k, and hybrid graph policies on the same similarity scores.
- Prototype local-neighborhood emphasis and a mobile connections-off default.
- Add a semantic photo index synchronized with canvas selection.

### Stage 3: Model Selection

- Compare CIE76 and a modern perceptual distance on the current mean feature.
- Compare mean color with a compact palette or histogram in the selected color space.
- Choose the smallest representation that measurably improves the labeled benchmark.
- Version the feature schema and prepare a reversible backfill.

### Stage 4: Persistence and Scale

- Add incremental edge updates for new and changed nodes.
- Make upload ID allocation concurrency-safe.
- Replace full edge deletion with a transactional or versioned graph update.
- Add scale tests for extraction, pair generation, database writes, and client rendering.

## Evidence Gate

No production similarity-model migration should begin until the real-image labels exist. Current graph invariants prove symmetry, threshold behavior, and config serialization; they do not prove perceptual relevance.
