# Photo Graph engineering write-up

Surface: `/write-ups/photo-graph`. Mode: Read, with optional evidence exploration.

## Editorial direction

The owner-supplied origin is a wall of printed photographs in their bedroom.
Similar colours worked well within groups; complementary colours worked well at
the borders between differently coloured sections. The digital project grew from
wanting to represent those relationships numerically and recreate the arrangement.
Keep that physical motivation in the opening. Complementary-colour grouping is
part of the inspiration, not a claim about the current similarity-based algorithm.
The owner's replacement wall photograph (`IMG_0708.jpeg`) appears with that
origin story, after the live graph. `bedroom-wall.webp` preserves the full 4:3
composition through the shared responsive `Figure`; `wall-source.json` records
the original and prepared checksums separately from generated benchmark assets.

The article is organised around five consequential engineering decisions:

1. Browsing by colour: the experience and authored work, with the actual graph first.
2. Defining similarity: compact mean RGB → LAB descriptors, CIEDE2000 and tested alternatives.
3. Graph construction: sparse nominations, cutoff/weight tradeoffs and the marginal Harbour link.
4. Browsing implementation: precomputation, competing forces, image dimensions and responsive rendering.
5. Archive operations: recoverable uploads, stable batch identity, revision checks and transactional registration.

Keep the portfolio's shared editorial column, typography, themes and square-edged
controls. Main prose explains choices, mechanisms or evidence. Do not narrate the
article's assembly, define elementary vector arithmetic, or present extraction
bookkeeping as the central engineering story. The former six-stage teaching
sequence and looping layout miniature have been removed.

## Two inspectors, one real graph

The opening `ProjectPreview` uses the existing production `PhotoGraphCanvas`
with embedded navigation hidden. It requests the public graph API independently
of the frozen examples. The full experience remains a separate link. No shared
canvas behavior or production pipeline is changed by the article.

The two page-specific inspectors use `ExampleProvider`. It passes through the
server-rendered MDX without moving the prose into a client component:

- **Inspect a colour comparison:** choose any two different photographs from the
  100-photo snapshot. Photographs, average swatches, RGB and LAB values remain
  visible alongside the CIEDE2000 result. Optional arithmetic uses the same
  diagnostic calculation as the scalar function; CIE76 is only an optional
  Euclidean reference. The initial pair is Performance and its nearest candidate,
  photograph 75, rather than presenting weak Harbour as the model's main success.
- **Explore the graph rules:** visible neighbour-count and cutoff sliders run
  the production sparse generator on all 100 descriptors. The static map changes
  links/weights while holding server-settled positions fixed. Counts expose total
  links and isolates; the table distinguishes direct and reverse nominations.
  The photograph/candidate selected above also controls the map's focus and table.

There are no autoplay sequences, pause/replay/reset rows, duplicate candidate
pickers or separate force-layout demo. Changing a query that equals the candidate
swaps the pair, preserving two distinct photographs. All calculations use saved
full-precision descriptors; rounding is display-only. Default results and map
render without JavaScript. Keyboard controls are native selects/range inputs.

## Evidence contract and supporting detail

`public/projects/photo-graph/worked-example/fixture.json` freezes a new extraction
on 2026-11-04. Its 100 IDs come from the saved colour-feature catalogue. Historical
Oklab features are not inverted to invent baseline RGB/LAB. The source catalogue
binds IDs to public original R2 URLs, including photograph 83's actual JPEG path.

The preparation script decodes originals with recorded Chromium and the upload
Canvas2D policy: no upscale, longest side 1024, rounded dimensions, RGBA8. Shared
`measureMeanRgb` accumulates opacity-weighted encoded RGB; `featureFromRgb` converts
that mean to LAB. The three lossless analysis PNGs and all saved weighted sums
remain supporting evidence, not visible tutorial steps. Thumbnails are display-only.
Checksums cover originals, prepared assets and descriptors. The 4,950-pair audit
matrix stays server-side, outside the client hydration payload.

Performance is 112, Harbour is 27 and Amber interior is 65. In this extraction
Harbour ranks third at CIEDE2000 15.466751538016895, with retained weight
0.03332802887394404; the interior ranks 60th at 41.03793273065684. Default links
from Performance go to 75, 24 and 27; the entire snapshot has 252 undirected links.
Harbour illustrates a marginal relationship near cutoff 16.

Keep the August review separate: seven queries, sixteen judged candidates per
query, 25/28 positive top-four judged slots for CIEDE2000 versus 24/28 for CIE76.
Histogram, palette and mean Oklab yielded 23, 20 and 21 respectively. Model-specific
cutoffs differ. The same judgments informed model selection; no held-out evaluation
established general accuracy. The optional methodology retains its historical
seven-image review gallery and source links.

The generator is deliberate, not a build step. Its public README documents cache
replay, browser-version sensitivity and refresh policy. No fixture was regenerated
for this editorial change; originals and publication state remain untouched.

## Operational claims

The article describes implemented upload behavior, not a new infrastructure
rollout. The admin client saves a browser-local journal and checksums, uploads
bytes, then registers a stable batch identity. Database reservation payloads must
match on retry; completed batches return recorded results. Revision checks prevent
stale graph generation from committing. Nodes, affected neighbor rows, settings
and the batch result commit transactionally. Object publication precedes that
commit; source cleanup follows it. Object storage is not part of the SQL
transaction, so recovery/cleanup can remain necessary after a failure.

Code evidence: `lib/photo-graph/upload-recovery.ts`,
`app/api/admin/photo-graph/upload/route.ts`, `supabase/photo-graph-schema.sql`,
`tests/unit/upload-route.test.ts` and `tests/unit/upload-database.test.ts`.
This task changes none of those mechanisms or production settings.

## Verification

Tests retain source/raster checksums, all pair/rank/default-edge outputs, CIEDE2000
diagnostic identity, cutoff equality, deterministic ties, reverse nominations and
isolates. Additional checks cover alternative queries, distinct selections, SSR
defaults, arithmetic disclosures, live-preview separation, map stability under
rule changes, keyboard use, responsive widths, themes and hydration. Pure
server-settling and rectangle-collision checks remain relevant to the static map.

Changes stay local until publication is separately authorised.
