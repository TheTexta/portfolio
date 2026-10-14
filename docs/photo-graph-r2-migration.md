# Photo Graph media migration to Cloudflare R2

Status: design proposal, 2026-10-14. **No R2 bucket, Worker route, application
switch, database change, or media copy is authorized by this document.** Read
`AGENTS.md` and the current Photo Graph sections of `README.md` before editing.

## Current state and target

Photo Graph currently stores originals in Supabase Storage bucket `dextery.dev`,
renders variants through Supabase's image endpoint and the standalone cache in
`deploy/supabase-image-cache/`, and persists `storage_path` in graph nodes. Admin
uploads retain `_pending/` sources until journaled registration commits. Existing
objects and upload journals must remain usable during a mixed-provider rollout.

The chosen target uses published R2 bucket `dextery-photo-graph`, private staging
bucket `dextery-photo-graph-staging`, and published paths under
`https://images.dextery.dev/photo-graph/` (transforms) and
`https://media.dextery.dev/photo-graph/` (original bytes). The shared Worker
currently lives in `bur1alrites/cloudflare-assets/`; a local-only
`dextery-infrastructure/` private repository contains an unchanged copy but is
**not** its production deploy owner yet. Both proposed R2 buckets were created
empty on 2026-10-14, with public r2.dev access disabled; no Worker bindings,
public routes, bucket CORS, upload credentials, or media migration exist yet.

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
   source bucket/key, intended destination bucket/key, size and checksum in
   browser recovery intent before sending bytes; support partial batches.
2. On registration, reserve the immutable batch ID, owner, payload, and stable
   node IDs in the Postgres journal. Include explicit provider/location in that
   reservation so a retry cannot switch to another object or bucket.
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

## Migration and cutover sequence

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
   alone cannot interpret R2-backed `storage_path` rows.
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

Open decisions before a production cutover: storage/DB restore evidence,
retention period, preview CORS and signing permissions, canonical route/SEO
behavior, image resizing limits, and backfill ownership. Design choices in this
document are not a deployment approval.
