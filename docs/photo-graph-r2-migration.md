# Photo Graph media migration to Cloudflare R2

Status: 2026-10-15 production cutover of the 102 referenced photos to R2
delivery; the server-side R2 upload flag is enabled in the follow-up app
deployment. **This document does not authorize deletion of existing Supabase
objects or pending recovery uploads.** Read
`AGENTS.md` and the current Photo Graph sections of `README.md` before editing.

The published R2 bucket contains 102 checksum-verified copies. The six
Supabase pending objects remain untouched. Additive SQL is live; 102/102
database rows have provider `r2`, and live Worker original HEAD matches the
manifest for all 102. The new image route, original bytes, transformations
(including the 76 MB source), nested `_pending` denial, and Elliot/bur1alrites
regressions passed. The canonical local doctor passes when supplied with the
current shared Supabase service-role credential in process memory; the stale
key in the local portfolio environment was not overwritten. This document
does not authorize removal of legacy objects.

## Current state and target

Photo Graph now serves referenced originals from published R2 through the shared
Worker. The original Supabase Storage objects remain in bucket `dextery.dev`;
the standalone cache in `deploy/supabase-image-cache/` remains for legacy and
rollback image requests. Graph nodes persist `storage_path` and provider. Admin
uploads retain `_pending/` sources until journaled registration commits. Existing
objects and upload journals must remain usable during a mixed-provider rollout.

The chosen target uses published R2 bucket `dextery-photo-graph`, private staging
bucket `dextery-photo-graph-staging`, and published paths under
`https://images.dextery.dev/photo-graph/` (transforms) and
`https://media.dextery.dev/photo-graph/` (original bytes). The shared Worker is
published from the private `TheTexta/dextery-infrastructure` repository;
its Photo Graph published-only route/binding is live. The published R2 bucket
contains 102 checksum-verified originals, while the private staging bucket
remains empty and has restricted PUT CORS. Public r2.dev access is disabled
for both buckets; staging has no Worker binding. Production R2 app credentials
are server-only and scoped to the two Photo Graph buckets.
The browser PUT must send the signed `Content-Type`, `x-amz-checksum-sha256`,
`x-amz-meta-sourcesha256`, and `x-amz-meta-expectedsize` headers: R2 does not
persist user metadata supplied only in presigned URL query parameters. The
staging CORS rule allows those specific headers. A synthetic PUT/copy/read-back
test passed and both synthetic objects were removed with absence verified.

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
  `app/projects/photo-graph/page.tsx`, `app/api/admin/photo-graph/graph/route.ts`,
  and the admin upload UI.
- Maintenance: `scripts/photo-graph/doctor.ts`, feature extraction, dimensions,
  cache-control repair, and deletion. The existing Supabase bucket-rename script
  is **not** an R2 copier.

The Worker has a separate Photo Graph width/quality allowlist, including the
560px quality-86 editorial cover. Elliot and bur1alrites transform allowances
remain unchanged. Original and 560px cover delivery were verified live.

The proposed R2 route serves only canonical
`photography-images/<numeric-id>.(png|jpg|webp)` keys; it does not expose
arbitrary files under the bucket prefix. The existing
`PHOTO_GRAPH_IMAGE_BASE_PATH` override can generate different paths, so R2
cutover code **must call** `assertPhotoGraphR2ImageBasePath()` before enabling
new writes or R2 URL generation and fail closed if the configured prefix is
different. This guard does not change legacy Supabase behavior until invoked.
Read-only inventory on 2026-10-14 showed all 102 graph-node paths use this
canonical shape. Of 108 Storage objects, 102 match; the other six are nested
`photography-images/_pending/*.png` recovery objects. Preserve those pending
sources until their owning upload batches are reconciled or independently
reviewed, even if their browser recovery state is no longer available. Do not
put them in the published R2 bucket as public objects. Re-run this inventory and inspect the
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
The six pending PNG objects found in the live Supabase bucket on 2026-10-14
have **no database upload-journal rows**. Do not infer ownership from their
per-object UUID: it differs from the batch ID. They may rely on a browser's
local recovery state, so leave them in Supabase for separate review and never
copy them to the public R2 bucket as a migration shortcut.

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
deletion remains on its existing path. No cleanup command deletes the retained
Supabase originals or the six pending recovery objects during this migration.

## Migration and cutover sequence (historical checklist)

The approved read-side phases 1–6 completed on 2026-10-15. The flagged
production R2 upload deployment follows; post-cutover writes require ongoing
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
   rollout, then test public and admin flows. Preserve original Supabase objects,
   pending recovery state, and the old render cache through a defined rollback
   window. Rolling back to an older Supabase-only Vercel deployment requires an
   ordered **data-and-code** rollback: copy and verify _every_ R2-backed graph
   object required by old readers into Supabase (including post-cutover writes),
   restore Supabase-compatible provider/path references, verify old URL reads,
   then promote the previous deployment or write routing. Track writes that
   occur during rollback separately so none are stranded. A previous deployment
   still reads the 102 retained originals by their unchanged Supabase paths,
   but cannot read new R2-only uploads until those sources are copied back.
7. Seek separate approval for retiring Supabase storage/cache after URL,
   retention, backup, and recovery checks. Never delete data as a diagnostic.

The currently observed Supabase catalogue holds 108 Photo Graph objects and
about 1.32 GB of metadata-reported bytes (2026-10-14). This is not a checksum
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
  separation. The Supabase NGINX render cache remains valid for old objects.
- Security: anon/non-admin/wrong-project cannot sign an upload, register a
  batch, mutate graph data, or fetch staging/private objects; service-role
  credentials never enter browser bundles.
- Recovery: duplicate batch, cross-admin retry, wrong hash, expired signing,
  missing or ambiguous status, lost copy/commit response, stale graph revision,
  partial batch, cleanup failure, and reload recovery on **both** providers.
- Migration: count and SHA-256 parity for in-scope objects, verified metadata,
  untouched originals, repeatable dry-run/resume, mixed-state reads, and a
  rollback that handles new writes.
- Existing local suites: `npm run check`, `npm test`, `npm run test:e2e`,
  `npm run admin:validate-auth`, and `npm run build` as appropriate. Extend the
  current isolated PGlite/Vitest/Playwright upload fixtures; do not use production
  credentials in CI or run mutating maintenance scripts as health checks.

Remaining operational work: establish a retention period for the retained
Supabase originals and six pending objects, verify a real authenticated
production R2 upload through the scoped app credential, and exercise the
post-new-upload rollback copy. The existing originals must not be retired as
part of this deployment.
