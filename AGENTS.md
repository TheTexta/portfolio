<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project

This repository contains Dexter Young's personal portfolio at `dextery.dev`.

The site presents software, creative technology, photography, design, and other technical/creative work. It includes conventional portfolio pages as well as interactive project experiences such as Photo Graph and Grailed Plus.

The application uses:

* Next.js App Router
* React
* TypeScript
* Tailwind CSS v4
* Framer Motion
* D3.js
* `react-force-graph-2d`
* Supabase Postgres and Storage
* Spotify Web API
* Sharp
* Vercel Analytics and Speed Insights
* Vercel for frontend hosting

The Supabase backend is self-hosted through Coolify.

## Backend / Server Access

The backend server is reachable over Tailscale using the MagicDNS hostname:

`gmkserver.tail077753.ts.net`

SSH using:

```bash
ssh dextery@gmkserver.tail077753.ts.net
```

SSH may require authentication or approval from the human developer.

Only access the server when the task actually requires inspecting or modifying production infrastructure, Coolify, Supabase, Postgres, Storage, image transformation, the image-cache service, networking, Docker, or related backend services.

Do not SSH into the server for ordinary frontend work that can be completed and validated from the repository.

Never store SSH credentials, database passwords, API keys, Supabase service-role keys, Spotify secrets, access tokens, refresh tokens, or other secrets in the repository.

Treat the server and its Supabase installation as production infrastructure. Do not perform destructive operations such as deleting production data, dropping tables, deleting storage buckets, recreating services, removing Docker volumes, changing unrelated Coolify services, or modifying networking unless the human developer explicitly requests it.

Prefer repository-controlled configuration and reproducible scripts over undocumented manual changes to production.

## Next.js

This project uses Next.js 16.

Its APIs and conventions may differ from older Next.js versions. Follow the Next.js instructions at the top of this file and consult the installed documentation under `node_modules/next/dist/docs/` when working with unfamiliar or version-sensitive behavior.

Use the existing App Router architecture.

Be deliberate about Server Component and Client Component boundaries. Do not add `"use client"` unless the component actually requires client-side state, effects, browser APIs, or event handling.

Preserve existing:

* redirects
* metadata
* canonical behavior
* sitemap generation
* robots behavior
* security headers
* remote image configuration

when changing routing or site structure.

## Design System

The design direction is intentional and should remain consistent across the portfolio.

The core aesthetic is:

* monochrome
* editorial
* restrained
* sharp
* functional
* authentic
* unpretentious

The interface uses dense uppercase metadata, fluid display typography, thin rules, compact spacing, solid surfaces, and project media as the primary source of color.

All first-party frames, cards, panels, buttons, form controls, navigation elements, and media containers should remain square.

Do not introduce:

* rounded cards or containers
* pill-shaped UI
* glassmorphism
* backdrop blur as decoration
* decorative gradients
* drop shadows
* unnecessary bright accent colors
* generic dashboard aesthetics
* ornamental UI that competes with project content

Circles should only be used where the existing design system intentionally calls for them, such as native controls, specific interaction handles, or external/avatar imagery.

Prefer extending shared editorial primitives and semantic design tokens over creating page-specific UI conventions.

Reuse existing components before introducing new equivalents.

When restyling an existing feature, preserve its behavior. Do not unintentionally remove authentication, project interactions, embeds, analytics, responsive behavior, accessibility, or fallbacks while changing presentation.

Experimental visual treatments are appropriate inside individual project experiences when they strengthen the project. Keep the surrounding portfolio interface calm and legible.

## Project Content

Project metadata should remain centralized in the existing data/catalog architecture when possible.

Do not duplicate project titles, descriptions, links, technologies, dates, or other metadata across multiple components when an existing shared source can represent it.

The homepage, project browsing interfaces, case studies, and navigation should remain consistent with one another.

Treat public project URLs as persistent unless the task explicitly involves changing routing. Add redirects when replacing existing public routes where appropriate.

## Supabase

Supabase is used for Photo Graph data and image storage.

The production Photo Graph Storage bucket is:

`dextery.dev`

Preserve compatibility with the existing bucket and existing `storage_path` values unless the task explicitly requires a storage migration.

The primary Photo Graph schema is defined in:

`supabase/photo-graph-schema.sql`

The graph currently includes data structures for:

* nodes
* edges
* generated nearest-neighbor relationships
* color features
* image dimensions
* model/version metadata
* graph settings

Photo Graph database functions and service-role-only operations are part of the data pipeline. Do not weaken their authorization or expose privileged operations to browser code.

Keep privileged Supabase credentials server-side.

Never expose a service-role key, database password, or other privileged credential through a `NEXT_PUBLIC_*` environment variable.

## Photo Graph

Photo Graph is both an interactive user-facing feature and a data-processing pipeline. Changes to it should account for both.

Relevant application and domain logic lives primarily under:

* `lib/photo-graph/`
* `app/admin/photo-graph/`
* `scripts/photo-graph/`
* `supabase/photo-graph-schema.sql`

Do not treat generated graph relationships, color features, storage paths, image dimensions, or model/version metadata as arbitrary data.

Preserve compatibility between:

* database schema
* graph-generation scripts
* runtime graph loading
* admin functionality
* image storage
* color-feature extraction
* edge/neighbor generation

when changing any one of these areas.

Do not manually rewrite generated graph datasets when a repository script exists to perform the operation reproducibly.

### Safe inspection

Before performing Photo Graph infrastructure or data work, prefer:

```bash
npm run photo-graph:doctor
```

The doctor command is intended to inspect the current configuration and should be the first step before reaching for mutating maintenance commands.

### Mutating commands

The following commands can modify production data, schemas, storage, or persisted graph state:

```bash
npm run photo-graph:apply-schema
npm run photo-graph:migrate
npm run photo-graph:rename-storage
npm run photo-graph:backfill-dimensions
npm run photo-graph:backfill-colors
npm run photo-graph:fix-cache-control
npm run photo-graph:activate-ciede2000
```

Do not run mutating Photo Graph commands against production merely as a diagnostic step.

Before running one, confirm:

* the requested task actually requires it
* the target Supabase project is correct
* the database connection points to the intended instance
* the operation will not unintentionally overwrite or destroy existing data

Do not perform migration, storage-renaming, mass-backfill, schema-application, or model-activation operations unless required by the task.

Use non-mutating validation and analysis commands where possible.

## Photo Graph Models

Photo Graph supports versioned image/color feature models and generated neighbor relationships.

When modifying similarity or color-processing logic:

* preserve explicit model/version information
* do not silently reinterpret existing persisted features using a new algorithm
* regenerate dependent neighbor data when required by a model change
* keep persisted data and runtime assumptions in sync
* use the existing validation and benchmark tooling rather than relying only on visual inspection

Relevant commands include:

```bash
npm run photo-graph:analyze
npm run photo-graph:validate-edge-generation
npm run photo-graph:validate-color-models
npm run photo-graph:extract-colors
npm run photo-graph:benchmark-colors
```

When introducing a new model or feature representation, prefer versioning it rather than changing the meaning of previously stored values in place.

## Image Delivery

Photo Graph images are served from Supabase Storage.

Transformed image URLs use Supabase's image-render endpoint rather than relying on Vercel's image transformation pipeline for Photo Graph media.

The self-hosted Supabase image-transform path is fronted by a dedicated NGINX cache defined under:

`deploy/supabase-image-cache/`

The cache is intentionally limited to:

`/storage/v1/render/image/public/`

Do not route unrelated Supabase traffic through the image-cache service.

Preserve cache variation by the complete transform request and negotiated image format. Different widths, qualities, and output formats must not collide in cache.

The cache uses persistent storage and is expected to survive container replacement or restart.

When modifying the image-cache deployment, preserve the distinction between:

* raw Storage objects
* transformed image requests
* non-image Supabase traffic

Use:

```bash
npm run photo-graph:doctor
```

after relevant infrastructure changes to verify rendering, caching, image format negotiation, Storage access, and graph infrastructure.

Do not modify the managed Supabase/Coolify stack directly when the standalone cache service can implement the change cleanly.

## Admin

Admin functionality exists under:

`/admin`

The current admin area includes Photo Graph management.

Treat administrative operations as privileged even when their UI lives inside the same Next.js application as the public site.

Do not move secrets or privileged Supabase operations into browser bundles.

Do not rely solely on hiding a control in the interface as an authorization boundary.

When modifying admin workflows, preserve failure handling so a partially completed Storage or database operation does not silently leave inconsistent Photo Graph state.

## Spotify

The site contains Spotify integration and OAuth-related routes.

Keep Spotify client secrets, access tokens, and refresh tokens server-side where applicable.

Do not expose private Spotify credentials through `NEXT_PUBLIC_*` variables.

Preserve existing OAuth redirect behavior and authentication flow when modifying Spotify functionality.

Do not replace the existing integration with hard-coded data merely to avoid handling authentication or API failures.

External API failure states should degrade gracefully rather than breaking unrelated portfolio content.

## Development

Use the existing project scripts.

Primary development commands:

```bash
npm run dev
npm run lint
npm run typecheck
npm run format:check
npm run check
npm run build
```

For normal code changes, run:

```bash
npm run check
```

before considering the work complete.

`npm run check` runs:

1. ESLint
2. TypeScript type checking
3. Prettier validation

Fix issues introduced by your changes.

Do not make unrelated refactors solely to clean up pre-existing warnings or errors unless requested.

Run:

```bash
npm run build
```

when changes could affect:

* production builds
* routing
* metadata or SEO
* server/client boundaries
* API routes
* authentication
* environment variables
* Supabase integration
* Next.js configuration
* image configuration
* deployment behavior

Use the Photo Graph-specific validation commands when modifying the corresponding pipeline.

## Formatting

The repository uses Prettier and `prettier-plugin-tailwindcss`.

Follow the existing formatting rather than manually reordering Tailwind classes.

Use:

```bash
npm run format
```

only when formatting changes are actually required.

Do not generate large unrelated formatting diffs.

## Infrastructure

Infrastructure configuration stored under `deploy/` should be treated as production configuration.

For changes involving Docker, NGINX, Traefik, Coolify, Supabase networking, or cache volumes:

* inspect the existing configuration before editing it
* preserve unrelated services
* avoid destructive Docker operations
* do not delete persistent volumes unless explicitly requested
* keep environment-specific values out of committed files where appropriate
* update documentation when operational behavior changes

Changes to the standalone image cache should not require modifying unrelated Supabase services.

## Security

Do not commit:

* `.env` files containing secrets
* access tokens
* refresh tokens
* API secrets
* Supabase service-role keys
* database passwords
* SSH credentials
* private keys

Browser-visible environment variables must contain only values intentionally safe to expose publicly.

Preserve the existing security headers in `next.config.ts` unless the task specifically requires changing them.

Avoid weakening authentication, database authorization, Storage permissions, OAuth protections, or browser security policies merely to make an implementation easier.

## Documentation

Update `README.md` in the same change whenever a modification changes:

* setup or development instructions
* environment variables
* Photo Graph architecture
* database schema
* Storage architecture
* data migration procedures
* admin workflows
* image delivery or caching
* infrastructure
* deployment procedures
* operational commands

Keep README instructions consistent with the actual implementation.

Do not add README changes for trivial internal implementation details that do not affect how the project is configured, operated, understood, or used.

For experimental ideas, future work, or unfinished concepts, prefer an issue or a clearly identified design note rather than turning the README into a TODO list.
