# Frozen worked example

`fixture.json` is a new public-original extraction, not recovered August 2026
descriptors. Its 100 archive IDs come from `color-features-v1.json`; its dated
snapshot, original SHA-256 checksums, browser version, raster policy and complete
pairwise measurements are recorded in the fixture itself. No historical Oklab
values or article thumbnails supply the new descriptors.

Deliberately regenerate from the repository root:

```sh
node --import tsx scripts/photo-graph/freeze-worked-example.ts
```

This is not a build step. It requires the installed Playwright Chromium binary.
The script first freezes only source identities for the saved 100 IDs from the
public `https://dextery.dev/api/photo-graph/graph` response. It does not use that
response's descriptors, links or settings. `source-catalogue.json` records the
fetch time, public-response digest and exact ID → original URL/storage path/provider
mapping; its own digest is in the fixture. Existing catalogues are reused unless
the deliberate command includes `--refresh`. Validated URLs must use
`https://media.dextery.dev/photo-graph/photography-images/<id>.<extension>`;
extensions come from public metadata, never filename guesses.

The script reads untransformed public originals, one at a time, with a 60-second
request deadline and 256 MiB per-image limit. Originals are cached only in ignored
`.tmp/photo-graph-worked-example/`. Subsequent runs reuse those bytes. Keep that
cache to reproduce a freeze; each cache entry is bound to its exact source URL
and checksum. Losing it requires downloading the public originals
again and checking their new checksums against this fixture.

Chromium decodes the originals into the same default Canvas2D sRGB analysis
raster as uploads (longest side 1024, no upscale). The shared `measureMeanRgb`
helper opacity-weights encoded RGB before `featureFromRgb` converts the mean to
LAB. The fixture retains unrounded JavaScript numeric values. Sharp only encodes
analysis PNGs and derives presentation thumbnails from those analysis RGBA bytes.

`analysis/112.png`, `analysis/27.png` and `analysis/65.png` retain the complete
lossless analysis rasters. Their central 4×4 RGBA patches in the fixture illustrate
individual pixels, not the pixels used exclusively for the mean. All 100 images
have local presentation thumbnails with their own checksums.

The 4,950 unordered pairs use numeric archive-ID ordering. The 99-entry query
ranking is unrestricted by the graph cutoff. Default nominations and symmetric,
deduplicated edges come from production `generateSparsePhotoGraph` at four
neighbours and maximum CIEDE2000 distance 16. A nomination is directed; an edge
can exist when only the other endpoint nominates the query. These measurements
are not relevance judgments or an evaluation of semantic image similarity.

The final fixture is replaced only after all 100 images and graph calculations
succeed. An interrupted preparation may leave assets but cannot publish a partial
fixture. A new run updates `snapshotAt`; changing Chromium can change raster
bytes, even when the original checksums match.
