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

## Search metadata

`lib/site-config.ts` holds the portfolio identity and official profile links.
`lib/seo.ts` defines metadata for the three indexable public pages, their preview
images, and their content-update dates. Update a page's `lastModified` date after
significant changes to its content, links, or structured data; sitemap generation
does not change these dates automatically.

Project imagery and dimensions come from the shared project catalog. Public pages
include Open Graph and Twitter previews, JSON-LD, and permission for large Google
image previews. `/sitemap.xml` lists the existing project posters on the portfolio.
Existing project cards expose permanent links while retaining the interactive
browser. Existing experience routes retain their indexing restrictions.

After deployment, submit `/sitemap.xml` in Google Search Console and use URL
Inspection to check the public pages and request a recrawl. Search appearance and
indexing remain Google's decision. The existing `/` to `/portfolio` redirect is
preserved; Google's site-name documentation specifies domain-root placement for
`WebSite` markup, so site-name eligibility should be checked against that routing
if the homepage is moved in a future change.

## Embedded project previews

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

This follows Supabase's [server-side Auth setup](https://supabase.com/docs/guides/auth/server-side/creating-a-client).
No Photo Graph schema, Storage policy, or data migration is required.

Run `npm run admin:validate-auth` to verify authorization, login, refresh, and
sign-out against a local Auth stub. It copies the application into a temporary
fixture and starts its own Next.js development server with test-only Supabase
settings. It never accesses production Auth, Storage, or database services and
does not interrupt the regular development server.

## Photo Graph Supabase setup

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

Supabase-hosted Photo Graph images now generate transformed public URLs through `storage.from(bucket).getPublicUrl(path, { transform })`. Supabase Storage handles WebP negotiation automatically for transformed requests, so Photo Graph and admin previews no longer depend on Vercel/Next image transformations.

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
