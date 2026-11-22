# Development

## Requirements and local configuration

Use Node.js `>=22.12.0 <25` and npm with the committed `package-lock.json`.
CI uses Node 22. See [dependency updates](dependency-updates.md) for compatibility
holds and the audit scope.

The [root README](../README.md#run-locally) covers installation and the public-site
baseline. Without Supabase variables, the graph loader uses the checked-in
`public/portfolioTable.json` snapshot and default controls. After filtering
unavailable historical nodes, that is 45 photographs, not a full-catalogue backup.
Originals still resolve through the shared R2 delivery domains. External project
iframes also request their hosted sites; local recorded animations and article
figures do not require another project's checkout or services.

For a backend-enabled environment, create an ignored `.env.local` with values
from the intended development Supabase project:

| Variable                        | Used for                                                                     |
| ------------------------------- | ---------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase API URL; also configures remote image patterns.                     |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser-safe anon key for Supabase Auth.                                     |
| `SUPABASE_SERVICE_ROLE_KEY`     | Server-side graph reads and privileged operations. Never browser-visible.    |
| `SUPABASE_ADMIN_USER_IDS`       | Comma-separated Auth user UUID allowlist. Missing/empty denies admin access. |
| `SUPABASE_PHOTO_GRAPH_BUCKET`   | Optional legacy Storage bucket override; defaults to `dextery.dev`.          |

The public URL, anon key and service-role key must belong to the same project.
Do not point local write-capable administration at production for UI development.
Restart the server after changing settings. Browser-visible `NEXT_PUBLIC_*`
values are bundled at build time.

There is no public registration flow. See [Photo Graph administration](photo-graph-admin.md)
for confirmed-email accounts, required schema, recovery and optional R2 writes.
R2 credentials are not needed for public media reads. Spotify Nodify's former
routes and callback redirect to `/portfolio#projects`; no Spotify variables are
required.

## Repository layout and safety

- `app/`: routes, page composition, shared UI and authored MDX.
- `lib/`: domain logic, integrations and server utilities.
- `scripts/`: validation, analysis and potentially mutating maintenance tools.
- `public/`: committed assets, demo recordings and graph snapshots.
- `supabase/`: Photo Graph schema and incremental migrations.
- `docs/`: design, operational, research and evidence guides.

Never commit deployment environment files or temporary infrastructure snapshots.
`.gitignore` excludes `.env*`, `*.env`, `*.env.*` and `.tmp`; ignore rules do not
remove already tracked files. `npm run check:repository` reads paths from the Git
index and rejects tracked temporary paths/environment filenames, even forced
additions. It never prints file contents and is not a secret-content/history scan.
Credentials in otherwise permitted files still need review. See the
[credential-exposure record](security/credential-exposure.md) for containment and
recovery gates.

## Tests

Run `npm run check` before a pull request. It runs the repository-path guard,
ESLint, TypeScript and Prettier in that order. `npm run format` rewrites files;
avoid unrelated repository-wide formatting diffs.

```bash
npm run check
npm test
npm run admin:validate-auth
npx playwright install chromium
npm run test:e2e
```

- `npm test` runs upload/recovery/storage tests, transactional SQL tests in
  isolated in-memory PGlite, benchmark-scope tests, and offline colour/edge
  validators. These do not contact production services.
- `admin:validate-auth` verifies login, authorization, refresh and sign-out
  against a local Auth stub in a temporary application fixture. It does not use
  production Auth, Storage or database services.
- Playwright covers desktop/mobile navigation, focus, history, write-ups,
  previews, graph rendering and upload reload/retry. Browser fixtures copy the
  application under disposable `.tmp/`, use test-only Supabase settings and a
  local Auth stub, and intercept relevant backend/media requests. They do not
  load `.env.local`.

Browser fixtures default to port 3107 and refuse to reuse an existing server.
If occupied, use `PORTFOLIO_TEST_PORT=3157 npm run test:e2e` rather than stopping
someone else's server. Run browser invocations serially, or give each a distinct
`--output` directory as well as a distinct port to avoid artifact collisions.
The bur1alrites room tests use headed Chromium for real pointer lock; display-less
Linux needs `xvfb-run -a npm run test:e2e`.

[Checks CI](../.github/workflows/check.yml) runs validation, tests, Auth checks and
a production build for pull requests and pushes to `main`. Desktop/mobile browser
projects run in separate jobs after validation, with failure artifacts and bounded
timeouts. The final `check` gate requires validation and both browser jobs.

For a local production build, run `npm run build`, then `npm start`. Search-signal
smoke checks are documented in [indexing](seo/indexing.md#http-validation).
Feature-specific verification lives with the relevant design or pipeline guide.
Neither a build nor a test run authorizes migration, backfill or deployment.

## Frontend deployment

Deployment is a separately approved production action, not a setup step.
The documented Vercel target is `thetextas-projects/portfolio` (`dextery.dev`);
verify the linked project and scope before using CLI commands.

Production variables are managed in Vercel, not copied from stale local files.
`.vercelignore` excludes environment files, `.tmp/` fixtures, documentation caches
and browser artifacts from CLI uploads. The reviewed release sequence is:

1. Inspect upload inputs with `vercel deploy --dry --json`.
2. With authorization, build an unpromoted production deployment using
   `vercel deploy --prod --skip-domain`.
3. Validate that deployment before switching the live domain with
   `vercel promote <deployment-url> --yes`.
4. Retain the previous deployment URL for rollback, accounting for any
   data/media compatibility requirements.

Photo Graph's Supabase originals are not retained: an old Supabase-only app
cannot be made safe merely by promoting its deployment. Follow the
[R2 rollback constraints](photo-graph-r2-migration.md#owner-approved-source-retirement--2026-10-15).
Shared Worker or backend changes need their own approval and verification.
