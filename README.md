# Dexter Young Portfolio

## Stack

- Next.js
- React
- TypeScript
- Tailwind CSS
- D3.js
- Supabase
- Lucide

## Project structure

- `app/`: Next.js routes, page composition, and UI components.
- `lib/`: reusable domain logic, integrations, and server utilities.
- `scripts/`: operational checks, data migrations, and reproducible analysis.
- `public/`: static project assets and Photo Graph snapshots.
- `docs/`: compatibility audits, design notes, and Photo Graph research.

Run `npm run check` before opening a pull request. It runs lint, TypeScript,
and formatting checks in that order.

## Automated tests

- `npm test`: upload recovery/storage tests and transactional SQL tests using an
  isolated in-memory PGlite database. No production services are contacted.
- `npx playwright install chromium` (once), then `npm run test:e2e`: desktop and
  mobile Chromium tests for project navigation, keyboard focus, history, preview
  links, and retrying uploads after a reload.
- `npm run admin:validate-auth`: authorization checks against a local Auth stub.

Browser tests copy the application into a disposable `.tmp/` fixture and run on
port 3107 with test-only Supabase settings, a local Auth stub, and intercepted
Storage requests. They do not load `.env.local` or use production credentials.
GitHub Actions runs checks, tests, Auth validation, and a production build on
pull requests and pushes to `main`.

## Search metadata

`lib/site-config.ts` holds the portfolio identity and official profile links.
`lib/seo.ts` defines metadata for the three indexable public pages, their preview
images, and their content-update dates. Update a page's `lastModified` date after
significant changes to its content, links, or structured data; sitemap generation
does not change these dates automatically.

Project imagery and dimensions come from the shared project catalog. Public pages
include Open Graph and Twitter previews, JSON-LD, and permission for large Google
image previews. `/sitemap.xml` lists all project posters on the portfolio and each
project page's own poster on its entry.
Existing project cards expose permanent links while retaining the interactive
browser. Public experience routes are crawlable but retain `noindex, nofollow`
metadata so Google can read their indexing restrictions. Admin and API paths
remain blocked in robots.txt. Legacy public URLs remain crawlable so Google can
observe their permanent redirects or 404 responses.

With a local production server running, validate the HTTP indexing signals:

```bash
npm run build
npm run start
# Run in a second terminal; defaults to http://localhost:3000:
npm run seo:validate
# Check the deployed application after deployment:
npm run seo:validate -- --base-url https://dextery.dev
```

The validator only makes GET requests and exits nonzero on failures. It checks
ordinary and Googlebot user agents, public-page status, titles, descriptions,
canonical URLs, server-rendered content and portfolio links, sitemap URLs/images
and content dates, crawl rules, experience-page noindex metadata, legacy
redirects, and the removed preview's 404. Local pages still declare production
canonical URLs. These smoke checks do not prove that Google can access or index
the site, and do not modify Search Console or hosting settings.

Vercel's project domain settings explicitly redirect `www.dextery.dev` permanently
to `dextery.dev` with HTTP 308, replacing the automatic temporary 307 redirect.
When changing domain settings, verify the redirect preserves both path and query,
for example `https://www.dextery.dev/grailed-plus?view=hero` should point to
`https://dextery.dev/grailed-plus?view=hero`. HTTP requests should also redirect
permanently to HTTPS. Hosting changes are separate from the repository changes.

After deployment, submit `/sitemap.xml` in Google Search Console and use URL
Inspection to check `/portfolio`, `/projects/photo-graph`, and `/grailed-plus`,
confirm their Google-selected canonicals and rendered content, and request
indexing. Inspect the affected URLs behind any duplicate, unauthorized (401), or
crawled-but-unindexed entries before deciding whether further fixes are needed;
redirect sources and protected endpoints may be intentional exclusions. The
October 6, 2026 coverage export contains aggregate counts without affected URLs,
and its chart ends on September 20, so it cannot identify current URL-level
problems. Search appearance and indexing remain Google's decision. The existing
`/` to `/portfolio` redirect is
preserved; Google's site-name documentation specifies domain-root placement for
`WebSite` markup, so site-name eligibility should be checked against that routing
if the homepage is moved in a future change.

## Embedded project previews

Photo Node-Gallery is interactive inside its preview: drag and zoom the graph,
and select a photo to inspect it without leaving the portfolio. Use Launch
experience to open the full gallery. It is exempt from the click-to-open behavior
used by the other previews.

Spotify Nodify has been removed. Its former project URLs and Spotify sign-in
callback redirect to `/portfolio#projects`. Spotify environment variables are no
longer required.

The project browser embeds the Grailed Plus page and three separately hosted
sites. Links clicked inside those previews open their destination as the
top-level page while wheel and touch scrolling remain inside the preview. Grailed
Plus links are read directly because its frame shares this site's origin. The
other sites send clicked URLs with a `dextery-preview-navigation` `postMessage`;
the portfolio checks the sender's frame and origin before navigating. A click
without a reported link opens the project's main site.
Bur1alrites video clicks use the selected video's direct link and open its
video room on the full site.

Deploy matching preview-navigation changes in `bur1alrites`, `elliotmairet`,
and `nepobabiesruntheunderground` to enable destination links in their previews.
Until each site is updated, its preview still opens the project's main site.

## Photo Graph admin

Open `/admin` to sign in and manage Photo Graph uploads, photos, and graph
defaults. Signing in and out keeps you at the same URL. The former
`/admin/photo-graph`, `/admin/photo-graph/login`, and `/admin/photo-graph/upload`
URLs permanently redirect to `/admin`.

Admin sign-in uses Supabase Auth email/password accounts. There is no public
registration flow. To enable access:

1. Create or identify the admin account in your Supabase project's Authentication
   users panel. The account needs a confirmed email and a password.
2. Set `SUPABASE_ADMIN_USER_IDS` on the Next.js application to that user's UUID.
   Use a comma-separated list for multiple admins. This is a server-only allowlist;
   an empty or missing value denies all admin access.
3. Keep `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` pointed at
   that same project, and retain `SUPABASE_SERVICE_ROLE_KEY` for privileged Photo
   Graph data operations. Authentication itself uses the anon key.
4. Redeploy the application and sign in at `/admin` with the account's email and
   password. Remove the old `PHOTO_GRAPH_ADMIN_PASSWORD` and
   `PHOTO_GRAPH_SESSION_SECRET` environment variables; they are no longer used.

The migration invalidates the former shared-password sessions. Supabase tokens
are stored in HttpOnly cookies, and Next.js `proxy.ts` refreshes them only for
admin pages and APIs. The page and each `/api/admin/photo-graph/` data route
independently validate the current user with Supabase Auth and check the
allowlist. Sign-out ends the current session without signing out other devices.
The browser's signed-upload client remains separate from authentication.

### Recoverable uploads

Before deploying the recoverable-upload code to another instance, review and
apply both `20261014212606_photo_graph_recoverable_uploads.sql` and
`20261014212629_restrict_photo_graph_upload_rpc_permissions.sql` under
`supabase/migrations/`, or use the updated `supabase/photo-graph-schema.sql`
through the existing schema-application procedure. Both migrations were applied
to `https://api.dextery.dev` through MCP on October 14, 2026. This adds a service-role-only
`photo_graph_uploads` journal and registration RPCs; it does not rename existing
objects or rewrite existing graph data. Until the schema is installed,
registration fails safely without moving or deleting uploaded originals.

Function permissions explicitly revoke `PUBLIC`, `anon`, and `authenticated`:
revoking only `PUBLIC` is insufficient on instances that explicitly grant
execution to browser roles through default privileges. Verification confirmed
that only the service role can access the upload journal and Photo Graph upload
RPCs, with existing graph counts and the graph revision unchanged. The local
doctor currently fails its image-render preflight with `401 Unauthorized` because
the local `.env.local` Supabase keys are stale. The production anon key and public
graph endpoint were verified separately. Do not rotate shared server credentials
or weaken RLS to address a stale local environment file.

Each registration sends an immutable UUID `uploadId` with its image metadata.
The journal reserves stable node IDs, and Storage copies retain the `_pending/`
originals until nodes, relationships, settings, and the completed result commit
in one database transaction. A revision check rejects a graph generated from
stale data. Retrying the same key and metadata reuses reserved assets or returns
the original committed result, rather than creating duplicate nodes. Keys cannot
be reused with different metadata or a different admin account.

The admin browser stores recovery metadata (no credentials or signed tokens) in
local storage **before** each direct upload. **Retry registration** checks pending
originals through an independently authorized `upload-status` endpoint and resumes
received images without uploading again, including after a reload or a lost
Storage response. If an original is missing, reselect its file: recovery verifies
its SHA-256 hash and obtains a new signed URL for that exact pending path without
overwriting an existing object. Images never attempted must be selected afterward.
Do not clear browser storage while registration is pending. An upload key and its
metadata can also be recovered from the service-role-only journal after
registration has started.

Web Locks serialize uploading, sealing, registration and cleanup across admin
tabs. A second tab cannot register a still-growing batch or clear another tab's
journal; it receives storage-event updates and re-reads recovery state while
holding the lock. Uploads fail closed if Web Locks or local storage are unavailable.
The batch is sealed before the first registration request, so retries retain the
same immutable metadata.

Temporary source copies are removed only after commit. Cleanup failures are
reported as warnings, retain browser recovery state, and can be retried with the
same batch. Incomplete journal entries and their copied assets are intentionally
retained for recovery; do not delete them as a diagnostic step. There is no
automatic age-based cleanup of abandoned uploads.

Authentication follows Supabase's [server-side Auth setup](https://supabase.com/docs/guides/auth/server-side/creating-a-client).
The authentication flow itself requires no Storage policy or data migration;
recoverable uploads require the schema migrations described above.

### Frontend deployment

The existing Vercel project is `thetextas-projects/portfolio` (`dextery.dev`).
Production environment variables are managed in Vercel, not copied from stale
local files. `.vercelignore` excludes environment files, `.tmp/` fixtures,
documentation caches and browser-test artifacts from CLI uploads. Inspect upload
inputs with `vercel deploy --dry --json` before deploying. Build with
`vercel deploy --prod --skip-domain`, validate the resulting deployment, then use
`vercel promote <deployment-url> --yes` to switch the live domain. Retain the
previous deployment URL for rollback. This release uses patch updates Next.js
16.3.8 and Sharp 0.35.5 to resolve the production dependency audit advisories.

Run `npm run admin:validate-auth` to verify authorization, login, refresh, and
sign-out against a local Auth stub. It copies the application into a temporary
fixture and starts its own Next.js development server with test-only Supabase
settings. It never accesses production Auth, Storage, or database services and
does not interrupt the regular development server.

## Photo Graph storage and migration

Photo Graph metadata/Auth remain in Supabase. On 2026-10-15 all 102 referenced
originals (1,250,719,633 source bytes) were copied and SHA-256 read-back
verified in private published R2 bucket `dextery-photo-graph`. All 102 graph
rows now use the R2 provider and the shared image/media Worker's `/photo-graph/`
routes. **Supabase originals and six unregistered `_pending/` objects remain
untouched** for rollback and browser recovery. The Supabase render cache stays
available for legacy uploads and rollback. See
[`docs/photo-graph-r2-migration.md`](./docs/photo-graph-r2-migration.md).

The 2026-10-15 additive migration
`supabase/migrations/20261015000937_photo_graph_storage_provider.sql` adds
provider-qualified rows and a durable R2 deletion journal. R2 uploads are
selected only when server-side `PHOTO_GRAPH_MEDIA_WRITE_PROVIDER=r2`; the
`PHOTO_GRAPH_R2_S3_ENDPOINT`, `PHOTO_GRAPH_R2_ACCESS_KEY_ID`, and
`PHOTO_GRAPH_R2_SECRET_ACCESS_KEY` settings must point to an Object Read & Write
credential scoped **only** to `dextery-photo-graph` and private
`dextery-photo-graph-staging`. Never put credentials in `NEXT_PUBLIC_*`.
Unfinished legacy Supabase batches keep their original provider across deploys.
The admin **Retry R2 Cleanup** action retries queued, unreferenced R2 deletes.
For a rollout check when a production key is non-readable, an authenticated
administrator can use **Check R2 Access** under Manage Photos (or POST to
`/api/admin/photo-graph/r2-diagnostic`). It reports
only the failed stage/status after checking a published canary and attempting
one private staging PUT/HEAD/DELETE; it never registers a graph node or exposes
credentials. Inspect private staging if it reports `cleanupPending: true`.

The private staging bucket allows PUT CORS only from dextery.dev,
www.dextery.dev, and localhost:3000 for signed content-type, checksum, and
source-metadata headers; it is not bound to the public Worker. A synthetic
signed PUT, published copy, SHA-256 read-back, and cleanup passed. To reconcile
originals without deleting Supabase data, run
`npm run photo-graph:copy:r2 -- --manifest <file>` for a dry run; add `--copy`
only after confirming the target and manifest. The copier requires a Cloudflare
token in its process environment and refuses differing R2 objects.

For rollback **before any new R2 uploads**, verify all 102 retained Supabase
originals and switch just those matching graph rows back to provider `supabase`
in a guarded transaction, then disable R2 writes and restore the previous app
deployment if needed. **After new R2 uploads**, first copy and verify every
R2-only original back to Supabase and reconcile pending batches; only then
switch providers or restore Supabase-only code. Never delete the six existing
pending uploads or retained originals as part of rollback.

| Command                                   | Purpose                                                         | Mutates data |
| ----------------------------------------- | --------------------------------------------------------------- | ------------ |
| `npm run photo-graph:doctor`              | Check storage, tables, RPCs, image rendering, and reachability. | No           |
| `npm run photo-graph:apply-schema`        | Apply the Photo Graph database schema.                          | Yes          |
| `npm run photo-graph:migrate`             | Migrate legacy Firebase data.                                   | Yes          |
| `npm run photo-graph:rename-storage`      | Rename the bucket and normalize storage paths.                  | Yes          |
| `npm run photo-graph:backfill-dimensions` | Populate missing image dimensions.                              | Yes          |
| `npm run photo-graph:extract-colors`      | Generate the versioned color-feature catalog.                   | Local files  |
| `npm run photo-graph:backfill-colors`     | Generate and persist color features.                            | Yes          |

Run mutating commands only after confirming the target Supabase project and
database connection variables. `photo-graph:doctor` is the safe first check.

Legacy Supabase-backed Photo Graph images generate transformed public URLs through `storage.from(bucket).getPublicUrl(path, { transform })`. Supabase Storage handles WebP negotiation for those legacy requests; R2-backed images instead use the shared image Worker. Neither path depends on Vercel/Next image transformations.

`photo-graph:apply-schema` accepts either a full `postgres://` connection string in `SUPABASE_DB_URL` (or `DATABASE_URL` / `POSTGRES_URL`) or a split self-hosted setup using `SUPABASE_DB_URL=<host>:<port>`, `SUPABASE_DB_USER`, `SUPABASE_DB_PASSWORD`, and optional `SUPABASE_DB_NAME`.
If your Coolify Postgres container is internal-only, `photo-graph:doctor` will warn about the DB socket instead of failing, as long as the Storage bucket, graph tables, and cached image render route are already in place.

## Self-hosted render cache

Self-hosted Supabase image transforms need a real edge cache in front of `/storage/v1/render/image/public/` if you want hard refreshes to reuse generated images. The repo includes a deployment bundle in [deploy/supabase-image-cache](./deploy/supabase-image-cache) for a standalone NGINX cache plus a higher-priority Traefik router.

The cache uses a bounded 10 GB named Docker volume. Hot files are also served from the host's Linux page cache, keeping large image bodies out of application memory.

Files:

- [docker-compose.yml](./deploy/supabase-image-cache/docker-compose.yml) defines the standalone `supabase-image-cache` service, persistent volume, external networks, and higher-priority Traefik route.
- [nginx.conf.template](./deploy/supabase-image-cache/nginx.conf.template) proxies to internal Kong and caches successful transforms by full request URI plus a normalized output-format bucket from `Accept`.

Deployment notes:

1. Set `SUPABASE_PUBLIC_HOST` to the existing public Supabase hostname, `SUPABASE_KONG_UPSTREAM` to the internal Kong URL, and `SUPABASE_INTERNAL_NETWORK` to the Docker network shared by the Supabase stack.
2. If you need to discover the internal network name on the server, use `docker network ls` and find the network attached to the Supabase containers.
3. Deploy the cache as its own Compose stack instead of patching the managed Supabase service directly. The named `supabase-image-cache-data` volume preserves cached transforms across container replacements and restarts.
4. Keep the router priority above the normal Supabase router so only `/storage/v1/render/image/public/` is intercepted. All other Supabase traffic should continue to hit the existing service directly.
5. Coolify may rewrite the live `traefik.docker.network` label to the stack network during deployment. That live rewrite is expected and does not mean the stack is misconfigured.

Verification:

1. Request the same render URL twice and inspect `X-Image-Cache-Status`. A cold path should move from `MISS` to `HIT`, while an already-warm path may return `HIT` on both requests.
2. Request the same image at two different widths and confirm both variants render correctly. The NGINX cache key includes the full request URI, so width and quality variants stay independent.
3. Run `npm run photo-graph:doctor`. The doctor now fails unless the render endpoint returns WebP, a one-week-plus cache TTL, and a warm-cache signal through `X-Image-Cache-Status`.
4. Repeat the same render request with and without `image/webp` support in `Accept` and confirm the cache keeps those variants isolated.
5. Restart the service and confirm the same request still returns `HIT`, proving the cache survived on the named volume.

NGINX caches successful public transformed-image responses for seven days even when an older Storage deployment returns `no-cache`. The cache is limited to the transformed public route, so raw objects and video requests continue to use Supabase directly.

Troubleshooting:

- If the doctor reports a missing `X-Image-Cache-Status`, Traefik is still sending render requests to Supabase directly instead of the cache sidecar.
- If the second request stays `MISS`, inspect the NGINX logs and confirm `/var/cache/nginx` is writable and backed by the named volume.
- If the sidecar returns `502`, `SUPABASE_KONG_UPSTREAM` or `SUPABASE_INTERNAL_NETWORK` is wrong.
- Raw object URLs should still revalidate normally with `304 Not Modified`; only transformed render URLs are being cached at the edge.

## Development notes

Open design and interaction ideas belong in the issue tracker or a dated design
note under `docs/`, rather than an undated README TODO list. This keeps setup
information stable and makes unfinished ideas easier to prioritize.
