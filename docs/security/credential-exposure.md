# Deployment-snapshot credential exposure

## Findings — 2026-11-02

The public `TheTexta/portfolio` repository tracked these temporary files despite
the later `.tmp` ignore rule:

- `.tmp/coolify-live/supabase.env`
- `.tmp/coolify-live/supabase-compose.yml`
- `.tmp/coolify-live/redis-compose.yml`

The environment file was present in commit `1ed1fe4` dated 2026-03-27 and was
confirmed anonymously readable on the public default branch during this review.
The commit date does not prove when the repository became public.

The files contain populated signing/access credentials, service passwords and
secret-named Compose literals. Treat confidential values as potentially
compromised. Public anonymous API keys are not equivalent to service-role keys
or JWT signing secrets. No values are reproduced here. At this initial review,
none were tested against live services; validity and unauthorized use were not
established. The separately authorized remediation checkpoint below supersedes
that initial validity limitation for the credentials actually rotated.

A bounded exact-match check found no copies of the identified literals in the
remaining 270 tracked text files inspected (files larger than 2 MB and binary
files were excluded). This is not an exhaustive secret scan or a history purge.

## Credential remediation checklist

These are snapshot variable names, not proof of current production configuration.
Aliases below refer to the same underlying credential and must be updated together.
Rotate or revoke confidential values that remain in use; do not restore retired
services just to rotate historical credentials. Check for reuse in active services.

| Credential group                      | Snapshot source / aliases                                                                                                                | Required handling if still used                                                                                                                                                          |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| JWT signing and privileged API access | `SERVICE_PASSWORD_JWT` → `JWT_SECRET`; `SERVICE_SUPABASESERVICE_KEY` → `SUPABASE_SERVICE_KEY` / `SUPABASE_SERVICE_ROLE_KEY`              | Replace signing material and regenerate dependent API keys across all consumers. Coordinate authentication/session impact and service rollout.                                           |
| Anonymous API access                  | `SERVICE_SUPABASEANON_KEY` → `SUPABASE_ANON_KEY` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`                                                       | Anonymous keys are public by design, but must be regenerated/redeployed when their signing secret changes.                                                                               |
| Postgres authentication               | `SERVICE_PASSWORD_POSTGRES` → `POSTGRES_PASSWORD`, `PGPASSWORD`, `DB_PASSWORD`, `PG_META_DB_PASSWORD`                                    | Coordinate actual database-role password changes and all connection consumers; editing an environment variable alone is not sufficient.                                                  |
| Studio/dashboard access               | `SERVICE_PASSWORD_ADMIN` → `DASHBOARD_PASSWORD`                                                                                          | Replace the password and check for reuse.                                                                                                                                                |
| MinIO root/API access                 | `SERVICE_USER_MINIO` / `SERVICE_PASSWORD_MINIO` → `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | Replace the affected MinIO credential pair and update Storage consumers without losing objects. The AWS-named aliases here point to MinIO, not evidence of a Cloudflare R2 key exposure. |
| Analytics                             | `SERVICE_PASSWORD_LOGFLARE` → `LOGFLARE_API_KEY`                                                                                         | Replace the key across dependent analytics services.                                                                                                                                     |
| Pooler application secret             | `SERVICE_PASSWORD_SUPAVISORSECRET` → `SECRET_KEY_BASE`                                                                                   | Follow the pooler's supported secret-rotation procedure and check dependent session/signing behavior.                                                                                    |
| Redis authentication                  | `REDIS_PASSWORD` in the Redis snapshot                                                                                                   | Replace or revoke if still active or reused; coordinate clients.                                                                                                                         |
| Stored-data encryption                | `SERVICE_PASSWORD_VAULTENC` → `VAULT_ENC_KEY`; Compose `DB_ENC_KEY`                                                                      | Preserve protected backups and establish a supported re-encryption plan before changing keys. Blind replacement can make stored data unreadable.                                         |

The snapshot's `DB_ENC_KEY` is an upstream example/default, not a newly discovered
random credential; check whether that default is deployed and plan encryption
remediation accordingly. `SECRET_PASSWORD_REALTIME` is null in the Compose
snapshot and `OPENAI_API_KEY` is empty in the environment snapshot. Neither is an
additional populated credential established by this evidence. Do not infer
exposure of GitHub, Vercel, OpenAI or R2 credentials from these filenames alone.

## Local containment

- Removed all three snapshots from the Git index with `git rm --cached`, keeping
  the local files intact. They remain ignored locally and must not be force-added.
- Added ignore patterns for suffix-style environment filenames.
- Added `npm run check:repository` to the normal local/CI check. It rejects tracked
  `.tmp` paths and environment filenames, including files added with `git add -f`.
- Preserved unrelated untracked `docs/seo/` work.
- Static checks, all 111 unit tests and both offline algorithm validators passed.
  Disposable alternative-index checks confirmed that forced environment and
  temporary-file additions are rejected without changing the primary Git index.
- Independent read-only review found no actionable issues in the guard and its
  CI integration. GitHub secret scanning and push protection were already enabled;
  their presence did not prevent this exposure.

The owner approved a normal cleanup commit and push on 2026-11-02. That approval
does not authorize production changes, visibility changes or history rewriting.

Local removal does not change GitHub until committed and pushed. A normal removal
commit also does not erase historical commits, caches, forks, clones or artifacts,
and does not revoke credentials. Do not treat repository cleanup as incident closure.

## Authorized remediation checkpoint — 2026-11-03

The owner separately approved live rotation and the coordinated shared-database
maintenance window. Active dashboard, MinIO/Storage, PostgreSQL, Logflare API and
pooler application credentials were rotated. Database changes coordinated all
seven affected login roles and persisted connection settings, preserving grants,
independent credentials, user identities and application configuration.

Applicable old passwords/API keys were rejected and replacements authenticated;
the pooler application secret was verified through runtime configuration rather
than an old/new-cookie HTTP test. Public/API checks and sampled Storage file
digests passed. Detailed preserving procedures, recovery evidence and a detected
Realtime startup-seed correction are retained in the private infrastructure repo.
No credential values or private backup contents are included here.

Persistent encryption keys have **not** been replaced: they require a preserving,
restore-tested re-encryption procedure. Historical signing/API values did not match
the inspected active configuration; that comparison is not universal revocation
proof. These rotations did not require a signing-key cutover or Vercel application
deployment.
History rewriting, force-pushing and repository-visibility changes remain separate
and unapproved. A full restore/off-site recovery test and abuse investigation are
not established by these checks; the incident is not declared closed.

## Separate approval gates

1. **Publish containment:** approve a normal cleanup commit and push to
   `TheTexta/portfolio` on `main`. Verify the current public tree no longer serves
   the files. Historical copies will remain accessible.
2. **Optional visibility containment:** making the repository temporarily private
   requires separate approval. Assess public source links and connected GitHub/
   hosting workflows first. Privacy cannot recall existing copies.
3. **Coordinated credential remediation:** inventory current shared Supabase
   consumers without printing secret values, confirm which exposed values remain
   in use, and plan rotation/revocation with the owner. The shared stack supports
   the portfolio, Elliot, Arnaud and bur1alrites; changing signing material or
   database credentials can affect every site, sessions, workers and admin flows.
   Do not validate suspected keys by attempting privileged application access.
4. **Encryption-key handling:** do not blindly replace Vault, database-encryption
   or pooler encryption keys. First establish what they protect, take verified
   protected backups, and use the appropriate re-encryption/migration procedure.
   Do not delete or recreate persistent volumes as a shortcut.
5. **Historical cleanup:** after coordinated credential revocation, approve a
   history rewrite covering all three paths and any additional verified copies.
   Use an isolated clone, enumerate branches/tags, preserve unrelated work, and
   coordinate the required force-push and collaborator re-clones. Check GitHub
   cached views, pull-request refs, Actions artifacts and forks, and request GitHub
   Support assistance where needed. Rewriting cannot recall independent copies.
6. **Closure:** verify affected applications, authentication, database/storage
   access and admin boundaries after rollout; review relevant access logs for
   abuse without publishing personal data or credentials. Record observations
   and remaining unknowns, not an unsupported claim that no compromise occurred.

Production changes, credential rotation, visibility changes, history rewriting
and force-pushing are not authorized by the local containment work itself.
