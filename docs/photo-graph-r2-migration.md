# Photo Graph media migration to Cloudflare R2

## Current verification — 2026-11-02

Read-only checks against the public graph API, Cloudflare inventory and Coolify:

- All 103 graph nodes explicitly use `r2`, matching exactly 103 published objects
  in `dextery-photo-graph`, with no missing or unreferenced keys. Every original
  HEAD returned HTTP 200 with image content type, size and ETag matching inventory.
  This is fresh delivery/metadata evidence, not a repeat of the historical
  full-byte SHA-256 comparison against the now-deleted Supabase sources.
- Private `dextery-photo-graph-staging` is empty and has no Worker binding. Both
  buckets have r2.dev disabled and no custom domains; the shared Worker binds
  only the published Photo Graph bucket.
- Sample transforms at 96px/quality 75, 560px/quality 86 (the 76.6 MB original),
  and 1280px/quality 60 returned HTTP 200 WebP. Root, nested and encoded `_pending`
  probes returned 404 on both shared image/media origins.
- Coolify's current estate contains no `supabase-image-cache` service. The
  separately approved October 30 retirement evidence remains in
  `dextery-infrastructure/docs/supabase-image-cache-retirement.md`.

Local follow-up corrections: the static snapshot's 45 available nodes now resolve
through R2, while preserving node IDs, retained relationships and legacy
provider-less database/upload semantics. This snapshot is not the full 103-node
catalogue; all 45 expected keys match current published graph references. The
legacy Firebase importer explicitly keeps its Supabase destination. The doctor
checks provider-qualified original/transform delivery, with
no retired-cache TTL/header assumptions; RPC discovery uses GET OpenAPI inspection
instead of invoking the mutating function. These local corrections require an
approved app deployment before they affect the hosted fallback. No production
configuration or data was changed for this verification.

The local doctor was rerun after correction and still returned HTTP 401 while
reading the sample graph row with the existing local credential. No credential
was printed or changed. Public delivery/inventory checks above passed independently;
this does not claim a fresh authenticated production upload or rollback rehearsal.

Local verification passed: `npm run check`, 105 unit tests, both algorithm
validators, 12 focused desktop/mobile Photo Graph and R2 upload-recovery browser
tests, and an isolated production build without environment files. Independent
source review found no actionable issues. The normal port-3000 development server
was left untouched; nothing was committed, pushed or deployed.

## Owner-approved source retirement — 2026-10-15

The owner explicitly authorized deleting the Photo Graph Supabase rollback
copies and six pending uploads after successful R2 cutover. A new streamed
SHA-256 comparison verified all 102 source originals against R2 before removal.
The Storage API deleted exactly 108 manifest-qualified paths from bucket
`dextery.dev`; read-back found zero remaining objects. Other Supabase bucket
object counts were unchanged. All 103 R2 objects remained accessible and the
103 graph records were preserved; private R2 staging remained empty.

No original or pending recovery copy remains in Supabase Storage. Rollback to Supabase-only delivery
requires reverse-copying every required R2 original, not just node 128. The static
fallback was not corrected by that scoped cleanup; see the local follow-up above.
The old cache was left unchanged at that time, then retired separately on
October 30. No other project's originals were deleted.

## Historical cutover acceptance — 2026-10-15

The initial production cutover migrated 102 referenced originals with full
SHA-256 read-back verification. Additive SQL and all 102 R2 provider references
were verified, alongside image routes, large-original transforms, private-path
denial and Elliot/bur1alrites regressions. A follow-up authenticated R2 upload
added node 128. The legacy doctor's credential workaround was a dated acceptance
observation, not permission to change credentials or restore retired services.
Read `AGENTS.md` and `README.md` before editing. This record authorizes no new
deletion, SQL, deployment or infrastructure change.

## Current state and target

Photo Graph now serves referenced originals from published R2 through the shared
Worker. Supabase retains graph metadata/Auth, not Photo Graph original copies.
Graph nodes persist `storage_path` and provider. Uploads retain temporary sources
until journaled registration commits. Existing upload journals must remain usable
during a mixed-provider rollout; their absence of provider still means Supabase.

The chosen target uses published R2 bucket `dextery-photo-graph`, private staging
bucket `dextery-photo-graph-staging`, and published paths under
`https://images.dextery.dev/photo-graph/` (transforms) and
`https://media.dextery.dev/photo-graph/` (original bytes). The shared Worker is
published from the private `TheTexta/dextery-infrastructure` repository;
its Photo Graph published-only route/binding is live. The published R2 bucket
contains 102 checksum-verified migrated originals plus R2-only node 128, while
the private staging bucket remains empty and has restricted PUT CORS. Public r2.dev access is disabled
for both buckets; staging has no Worker binding. Production R2 app credentials
are server-only and scoped to the two Photo Graph buckets.
The browser PUT must send the signed `Content-Type`, `x-amz-checksum-sha256`,
`x-amz-meta-sourcesha256`, and `x-amz-meta-expectedsize` headers: R2 does not
persist user metadata supplied only in presigned URL query parameters. The
staging CORS rule allows those specific headers. A synthetic PUT/copy/read-back
test passed and both synthetic objects were removed with absence verified.
After correcting the site-scoped Production credential, a real authenticated
upload committed node 128. The new published object matched its journal SHA-256
and expected size on read-back, its 560px transform returned HTTP 200, and
private staging was empty. The six pre-existing Supabase pending objects were
subsequently deleted under the source-retirement approval recorded above.

## Media locator seam

Define one Photo Graph media locator that explicitly distinguishes:

- Legacy Supabase objects: bucket `dextery.dev` and existing `storage_path`.
- Published R2 objects: bucket `dextery-photo-graph` and an object key.
- External images, when the existing graph legitimately has an `external_url`
  without a storage path.

The locator's interface should cover raw URL, transformed URL, source selection,
and deletion/cleanup target without asking callers to infer a provider from a URL
or filename. Keep configuration for public origins separate from server-only R2
credentials and upload signing. Existing database rows and journal entries with
no provider indication must continue to mean Supabase; never reinterpret their
`storage_path` as an R2 key. `external_url` is not a substitute for a provider
column or versioned locator: `lib/photo-graph/database.ts` currently ignores it
whenever a row has `storage_path`.

Place the locator seam where multiple call sites already resolve media; avoid
separate provider guesses in the graph, admin, image optimizer, and scripts. Both
Supabase and R2 adapters must be exercised through the same testable interface.
Preserve the current Supabase URL and transformation behavior by default, even
when a future Vercel build contains dual-provider code.

Media consumers to inventory and update together:

- Graph rows, static fallback, and payloads: `lib/photo-graph/database.ts`,
  `lib/photo-graph/graph-store.ts`, `lib/photo-graph/force-graph.ts`,
  `lib/photo-graph/types.ts`, and `public/portfolioTable.json`.
- Canvas/preview/image metadata: `app/components/projects/photo-graph/`,
  `app/write-ups/photo-graph/page.tsx`, `app/api/admin/photo-graph/graph/route.ts`,
  and the admin upload UI.
- Maintenance: `scripts/photo-graph/doctor.ts`, feature extraction, dimensions,
  cache-control repair, and deletion. The existing Supabase bucket-rename script
  is **not** an R2 copier.

The Worker has a separate Photo Graph width/quality allowlist, including the
560px quality-86 editorial cover. Elliot and bur1alrites transform allowances
remain unchanged. Original and 560px cover delivery were verified live.

The live R2 route serves only canonical
`photography-images/<numeric-id>.(png|jpg|webp)` keys; it does not expose
arbitrary files under the bucket prefix. The existing
`PHOTO_GRAPH_IMAGE_BASE_PATH` override can generate different paths, so R2
cutover code **must call** `assertPhotoGraphR2ImageBasePath()` before enabling
new writes or R2 URL generation and fail closed if the configured prefix is
different. This guard does not change legacy Supabase behavior until invoked.
Read-only inventory on 2026-10-14 showed all 102 graph-node paths use this
canonical shape. Of the then-present 108 Storage objects, 102 matched; the other
six were nested `photography-images/_pending/*.png` recovery objects. They were
not published and were deleted only after separate owner review. Any future
pending sources require their own reconciliation/review before deletion. Inspect the
deployed prefix configuration immediately before cutover; a dated snapshot
does not prove future upload paths will still match.

The static fallback and generated color-feature/benchmark JSON files are graph
metadata, not image originals; preserve their node-ID/media resolution rather
than treating them as objects to copy. Do not regenerate graph relationships or
reinterpret model versions as part of moving bytes.

## Upload, registration, and recovery

Preserve the **current** ordering implemented in
`app/admin/photo-graph-client.tsx`, `app/api/admin/photo-graph/upload/route.ts`,
and `lib/server/photo-graph-upload-storage.ts`. The browser creates a batch ID,
obtains an upload URL and object path, computes the file hash, and saves
localStorage recovery intent **before transferring bytes**. The Postgres
journal reserves immutable registration payload and stable node IDs only when
the browser subsequently requests registration. Do not call a proposed
journal-before-upload flow existing behavior; adopting one would be a separate
protocol change requiring a reservation endpoint, complete immutable payload
before signing, and recovery rules for partial uploads.

1. Authenticate and authorize the upload URL request. Upload originals directly
   to private R2 staging using short-lived signed requests. Persist provider,
   exact source bucket/key, destination **policy**, size and checksum in browser
   recovery intent before sending bytes; support partial batches. Do not claim
   the numeric-ID destination key is known yet: its node ID is reserved only
   at registration.
2. On registration, reserve the immutable batch ID, owner, payload, and stable
   node IDs in the Postgres journal. Include explicit provider/location in that
   reservation so a retry cannot switch to another object or bucket. Derive the
   canonical published key from each reserved node ID and retain the exact
   destination in the same recovery contract; legacy JSONB payloads must keep
   their original shape so already-reserved batches can retry unchanged.
3. Verify original bytes, then prepare the opaque canonical object in the
   published bucket without destroying the staging source. Ensure an ambiguous
   copy result can be retried by checking the exact destination and checksum;
   never accept an unrelated object merely because the key exists.
4. Commit graph nodes, relationships, revision check, and journal result in one
   database transaction. R2 copy plus Postgres commit is **not** atomic; a copy
   failure must leave the journal recoverable and a commit failure must not
   delete its source.
5. Only after confirmed commit, remove the temporary source. Cleanup failure
   is a visible warning and remains retryable with the same batch ID.

Verify R2 staging-to-published copy support, size limits, checksum semantics,
and conditional destination writes with isolated fixtures before relying on
them. Cloudflare documents S3-compatible CopyObject and conditional requests,
but source and destination conditions are **not jointly atomic**. Do not assume
a cross-bucket copy succeeds merely from API compatibility documentation.

For existing browser recovery metadata and incomplete database journals, a
missing provider means **Supabase**. Preserve the stored path, batch ID, owner,
and hash when adding a versioned provider field. Newly signed R2 uploads must
not accidentally be checked or deleted using the Supabase bucket. Recoveries
after reload or a lost response must reuse the original destination and the
same committed result. Retain Supabase `_pending/` objects until their own
registration has completed and cleanup is verified.
The six pending PNG objects found in Supabase on 2026-10-14 had **no database
upload-journal rows** and were later deleted under separate owner approval.
For future pending objects, do not infer ownership from a per-object UUID: it
differs from the batch ID. Browser recovery state may be their only record;
never publish them as a migration shortcut or delete them without review.

Signed R2 uploads that never reach registration will not have a Postgres
reservation under the current ordering; browser recovery intent is their only
client-side record. Inventory and retain partial/abandoned private staging
objects for a separately approved cleanup window; never assume every staged
object has a database journal entry.

The private R2 staging bucket must never be bound to the public Worker. The
Worker must deny `_pending` as a decoded **path segment at any depth** and
other private namespaced keys **before any head, get, or transformation
fetch**, including percent-encoded variants. The existing Supabase shape is
`photography-images/_pending/<uuid>.<extension>`: a root-only
`key.startsWith("_pending/")` test is insufficient. Tests must assert the
Worker never calls the bucket for these requests. A project prefix does not
provide a privacy boundary by itself.

For R2-backed node deletion, the additive schema queues the exact provider and
canonical key in `photo_graph_media_cleanup_jobs` in the same Postgres
transaction that deletes the node. Object deletion follows only after checking
that no R2 node still references the key; failures remain queued and the admin
UI displays a warning with a **Retry R2 Cleanup** action. Legacy Supabase node
deletion remains on its existing path. The later 108-path source retirement was
a separately approved operation, not a side effect of migration or node cleanup.

## Migration and cutover sequence (historical checklist)

The approved read-side phases 1–6 and the subsequent flagged R2 upload deployment
completed on 2026-10-15; post-cutover writes require ongoing
rollback reconciliation. Steps below describe the safe ordering, not a request
to rerun copies, SQL, or Worker publishing.

1. Complete the shared Worker's no-behavior-change ownership handoff to the
   dedicated infrastructure repository under a separate approval. Preserve
   existing Elliot/bur1alrites routes, `media.dextery.dev`, and the legacy
   Elliot `images.dextery.dev` bucket attachment. Do not introduce new bindings
   in this handoff.
2. In separate approved changes, add and test private-path denial, proposed
   Photo Graph delivery prefix, and R2 binding. Confirm image transformation
   limits, format negotiation, range and cache behavior, and public URLs.
3. Deploy dual-provider **reads** while all old rows still resolve to Supabase.
   Introduce explicit provider state additively and verify legacy Graph/admin
   behavior before enabling R2 writes or changing references.
4. Prepare new uploads with provider-qualified, journaled staging/copy/cleanup.
   Test interrupted and repeated requests before switching production writes.
5. Inventory Supabase originals and referenced paths plus pending and orphaned
   objects. Copy to R2 using a separate resumable, dry-run-default migration;
   preserve paths, content types, source metadata, and SHA-256 read-back proof.
   Refuse to overwrite foreign destination objects. Keep a redacted inventory,
   not media contents or credentials, in operational records.
6. With explicit cutover approval: reconcile in-flight uploads, verify every
   referenced destination, switch graph locators and write routing in a staged
   rollout, then test public and admin flows. Supabase originals and pending
   recovery state were retained during the initial rollback window, then retired
   under separate approval. Rolling back to Supabase-only Vercel code requires an
   ordered **data-and-code** rollback: copy and verify _every_ R2-backed graph
   object required by old readers into Supabase (including post-cutover writes),
   restore Supabase-compatible provider/path references, verify old URL reads,
   then promote the previous deployment or write routing. Track writes that
   occur during rollback separately so none are stranded. No previous deployment
   can rely on retained Supabase originals now: every required source needs a
   verified reverse copy before a Supabase-only rollback.
7. Seek separate approval for retiring Supabase storage/cache after URL,
   retention, backup, and recovery checks. Never delete data as a diagnostic.

The pre-migration Supabase catalogue held 108 Photo Graph objects and
about 1.32 GB of metadata-reported bytes on 2026-10-14. This is not a current checksum
manifest, full orphan inventory, or the future cutover total; refresh it before
planning costs and the final reconciliation.

Against the current Cloudflare
[remote-image limits](https://developers.cloudflare.com/images/get-started/limits/),
none of these 108 objects exceeds 100 MB (largest metadata-reported size
~76.6 MB); 23 exceed the separate 20 MB **Images binding input** limit.
The 102 graph nodes with stored dimensions are below 100 MP (up to 7,200px
wide and 6,000px high). Source MIME metadata lists 107 PNG and one JPEG.
Prefer the already-used Worker `cf.image` remote-fetch transformation path,
not an untested Images-binding swap; verify each original and account limits
before relying on metadata or deciding whether a verified delivery derivative
is needed. Preserve full-resolution originals either way.

## Verification gates

- Mixed-provider URLs: originals, widths/qualities/formats, legacy URLs,
  canvases, previews, metadata, static fallback, mobile rendering, and cache
  separation. Legacy Supabase transforms use Kong/Storage/imgproxy directly;
  current published Photo Graph images use the R2 Worker.
- Security: anon/non-admin/wrong-project cannot sign an upload, register a
  batch, mutate graph data, or fetch staging/private objects; service-role
  credentials never enter browser bundles.
- Recovery: duplicate batch, cross-admin retry, wrong hash, expired signing,
  missing or ambiguous status, lost copy/commit response, stale graph revision,
  partial batch, cleanup failure, and reload recovery on **both** providers.
- Migration: count and SHA-256 parity for in-scope objects, verified metadata,
  preserved R2 originals, repeatable dry-run/resume, mixed-state reads, and a
  rollback that handles new writes.
- Existing local suites: `npm run check`, `npm test`, `npm run test:e2e`,
  `npm run admin:validate-auth`, and `npm run build` as appropriate. Extend the
  current isolated PGlite/Vitest/Playwright upload fixtures; do not use production
  credentials in CI or run mutating maintenance scripts as health checks.

The media cutover and separately approved source/cache retirement are complete.
The local fallback/doctor corrections above remain undeployed. A future
Supabase-only rollback still requires an independently approved and verified
reverse-copy of every required original; that rollback exercise was not run as
part of this read-only verification. No additional deletion is authorized.
