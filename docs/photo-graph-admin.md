# Photo Graph administration and maintenance

Production actions require explicit authorization for the intended target.
Do not run migrations, uploads, backfills, deletes or model activation as
diagnostics. Preserve originals, recovery journals, provider/path identity and
versioned features.

## Sign-in and configuration

`/admin` manages Photo Graph uploads, photos and graph defaults. Sign-in/out keeps
the URL. Former `/admin/photo-graph`, `/admin/photo-graph/login` and
`/admin/photo-graph/upload` routes permanently redirect here.

For an approved environment:

1. Create or identify a Supabase Auth email/password account with confirmed email.
   There is no public registration flow.
2. Set server-only `SUPABASE_ADMIN_USER_IDS` to its UUID, or a comma-separated list
   for multiple administrators. Missing/empty denies everyone.
3. Configure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and
   server-only `SUPABASE_SERVICE_ROLE_KEY` for the same project. Auth uses the
   anon key; privileged graph operations use the service role.
4. Restart locally, or follow the separately approved deployment procedure, then
   sign in with the account's email/password. `PHOTO_GRAPH_ADMIN_PASSWORD` and
   `PHOTO_GRAPH_SESSION_SECRET` are obsolete; the old shared-password sessions
   are not accepted.

Supabase tokens use HttpOnly cookies. `proxy.ts` refreshes them only for admin
pages/APIs. Both the page and each `/api/admin/photo-graph/` data route validate
the current user through Auth and check the allowlist, not merely hidden UI.
Sign-out ends the current session, not other devices. Browser signed-upload
handling is separate from authentication. Reference:
[Supabase server-side Auth](https://supabase.com/docs/guides/auth/server-side/creating-a-client).
The Auth flow itself requires no Storage policy/data migration.

`npm run admin:validate-auth` checks authorization/login/refresh/sign-out using
an isolated local Auth stub, not production. See [development](development.md#tests).

## Required schema

Before enabling recoverable uploads on another instance, review the canonical
[`supabase/photo-graph-schema.sql`](../supabase/photo-graph-schema.sql) and
incremental [migrations](../supabase/migrations/), especially:

- `20261014212606_photo_graph_recoverable_uploads.sql`
- `20261014212629_restrict_photo_graph_upload_rpc_permissions.sql`
- `20261015000937_photo_graph_storage_provider.sql` for provider-qualified media
  and durable R2 deletion jobs.

The first two were recorded as applied to `https://api.dextery.dev` on
14 October 2026; that history is not proof another instance has them.
The journal and registration RPCs must be service-role-only. Explicitly revoke
`PUBLIC`, `anon` and `authenticated`; revoking only `PUBLIC` does not remove
explicit browser-role grants. The upload schema adds recovery without renaming
existing objects/rewriting graph data. Missing registration schema fails safely
without moving/deleting originals.

Schema application is a mutation. Confirm the target, permissions, backup and
reviewed SQL before choosing incremental migrations or the full schema procedure.
The script supports `SUPABASE_DB_URL` (or `DATABASE_URL`/`POSTGRES_URL`) as a full
Postgres URL, or `SUPABASE_DB_URL=<host>:<port>` with `SUPABASE_DB_USER`,
`SUPABASE_DB_PASSWORD` and optional `SUPABASE_DB_NAME`. Inspect
`scripts/photo-graph/database-config.ts` and `apply-supabase-schema.ts` first:
configured remote-server settings can cause an SSH fallback after direct failure.

## Recoverable uploads

The browser saves recovery intent in local storage **before** direct byte upload:
batch UUID, metadata, provider/path and checksum, but no credentials/signed tokens.
`lib/photo-graph/browser-upload.ts` owns that protocol; the admin UI owns feature
extraction/editable state. The upload route authenticates/validates HTTP input;
`lib/server/photo-graph-register-upload.ts` orders publication, commit and cleanup.
`lib/photo-graph/upload-plan.ts` plans destinations, scaling and sparse neighbours
without storage/database I/O.

On registration, the service-role journal reserves immutable metadata and stable
node IDs. Publication retains the temporary source until nodes, relationships,
settings and the completed result commit in one SQL transaction. Revision checks
reject stale graph generation. Retrying the same UUID/payload reuses reserved
assets or returns the committed result, not duplicate nodes; different metadata
or a different admin cannot reuse the key. Object storage is outside that SQL
transaction, so publication and cleanup still need recovery.

**Retry registration** checks originals through the independently authorized
`upload-status` endpoint and resumes received bytes after reload/lost responses.
For a missing original, reselect the file: recovery verifies SHA-256 and signs
the exact pending path without overwriting an existing object. Select never-
attempted images afterward. Do not clear browser storage while registration is
pending. Once registration has started, the upload key/metadata can also be
recovered from the privileged database journal.

Web Locks serialize upload/seal/register/cleanup across tabs. Other tabs receive
storage events and re-read recovery state under the lock; they cannot register a
growing batch or clear another tab's journal. Missing Web Locks/local storage
fails closed. Sealing before first registration keeps retry metadata immutable.

Cleanup only follows confirmed commit. Failures report warnings, retain browser
state and can retry with the same batch. Incomplete journal entries/copied assets
are intentionally retained; there is no automatic age-based abandonment cleanup.
Unregistered staged uploads may have only browser recovery intent, not a database
journal. Do not delete either kind as a diagnostic.

See [R2 configuration and diagnostics](photo-graph-r2-migration.md#application-configuration-and-diagnostics)
for the write-provider flag, bucket-scoped credentials, staging privacy,
**Check R2 Access** and **Retry R2 Cleanup**. Legacy batches keep their original
provider even after a deploy. Missing provider metadata still means Supabase
outside the explicitly migrated static snapshot.

## Inspection and command safety

Start infrastructure investigation with `npm run photo-graph:doctor`. It contacts
the configured services via HTTP GET/HEAD plus a database TCP reachability probe.
It samples provider-qualified original/WebP delivery and discovers RPCs through
PostgREST OpenAPI without invoking a mutating function. It is not a complete
object/checksum inventory. An internal-only database socket is a warning.
A local credential failure does not justify rotating production keys, weakening
RLS or restoring retired services.

| Command suffix after `npm run`    | Effect                                                    |
| --------------------------------- | --------------------------------------------------------- |
| `photo-graph:doctor`              | Non-mutating configured-service inspection.               |
| `photo-graph:apply-schema`        | Applies SQL; may fall back to configured SSH.             |
| `photo-graph:migrate`             | Imports legacy Firebase data into Supabase.               |
| `photo-graph:rename-storage`      | Renames legacy bucket/normalizes paths. Not an R2 copier. |
| `photo-graph:backfill-dimensions` | Persists missing dimensions.                              |
| `photo-graph:fix-cache-control`   | Changes object metadata.                                  |
| `photo-graph:extract-colors`      | Generates local versioned feature files.                  |
| `photo-graph:backfill-colors`     | Extracts and persists features.                           |
| `photo-graph:activate-ciede2000`  | Persists model/settings/neighbour changes.                |

Inspect each script before use; even local-output analysis may read configured
remote originals/data. Confirm the Supabase project, database connection and
operation scope before any mutation. `photo-graph:analyze`,
`photo-graph:validate-edge-generation`, `photo-graph:validate-color-models` and
`photo-graph:benchmark-colors` support model investigation. Keep model/version
meaning explicit and regenerate dependent neighbours deliberately, not by
silently reinterpreting persisted features.

`photo-graph:annotate-benchmark` annotates the saved historical report without
recomputing scores, timings, rankings or its original date; it distinguishes
positive/negative/unjudged results and nullable relevance. A new experiment uses
`photo-graph:benchmark-colors` with its own provenance. The saved seven-query
comparison is not current full-archive accuracy; see the
[walkthrough evidence contract](design/photo-graph-walkthrough.md#evidence-contract-and-supporting-detail).

For storage source-retirement history, reverse-copy requirements and recovery-
only cache source, use the [R2 migration record](photo-graph-r2-migration.md).
The static 45-photo fallback is not a backup, and no Supabase originals remain
in that recorded catalogue. Neither a previous app deployment nor the retained
`deploy/supabase-image-cache/` source replaces a verified media rollback.
