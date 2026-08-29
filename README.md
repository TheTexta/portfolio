# Dexter Young Portfolio

## Stack

- Next.js
- React
- TypeScript
- Tailwind CSS
- D3.js
- Supabase
- Lucide

## Photo Graph Supabase setup

- Apply schema: `npm run photo-graph:apply-schema`
- Migrate Firebase data: `npm run photo-graph:migrate`
- Rename photo graph bucket / normalize storage paths: `npm run photo-graph:rename-storage`
- Backfill dimensions if needed: `npm run photo-graph:backfill-dimensions`
- Check bucket, tables, and DB reachability: `npm run photo-graph:doctor`

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

## TODO

- possibly do subtle (low saturation) gradient (masked) versions of all my favourite images that scroll in random paralaxes in the background
- adding to the above I want to make a full design philosophy for myself.
- auto recentering on zoomout of graph-view-image
- explode effect on zooming in/out of photographview
