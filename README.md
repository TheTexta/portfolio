# Dexter Young Portfolio

Source for [dextery.dev](https://dextery.dev/): a portfolio of software,
photography, design and creative-technology projects.

## Features

- Interactive project browser with embedded previews and shared project metadata.
- Seven MDX engineering write-ups, with version-scoped evidence and local
  interactive examples.
- Photo Graph: colour-based photograph browsing in 2D, an optional standalone 3D
  view, keyboard browsing, and authenticated administration with recoverable uploads.
- Grailed Plus product page and recorded comparison demo; downloadable CV variants.

## Run locally

Requires **Node.js >=22.12 and <25** and npm; CI uses Node 22. Dependency versions
and compatibility holds are documented in [dependency updates](docs/dependency-updates.md).

```bash
git clone https://github.com/TheTexta/portfolio.git
cd portfolio
npm ci
npm run dev
```

Open [localhost:3000/portfolio](http://localhost:3000/portfolio).
No environment file is needed for the public-site baseline: Photo Graph falls
back to its checked-in 45-photo snapshot. Its images and externally hosted
previews still require network access; this is not a fully offline archive.

Live catalogue access and `/admin` require your own approved Supabase settings;
see [development and configuration](docs/development.md) and
[Photo Graph administration](docs/photo-graph-admin.md). Never copy production
credentials just to run the UI, or expose privileged keys through `NEXT_PUBLIC_*`.
Spotify Nodify is retired; Spotify credentials are not required.

## Checks

```bash
npm run check
npm test
```

`check` validates tracked paths, ESLint, TypeScript and Prettier. Unit/algorithm
tests use local fixtures, not production services. For a local production server,
run `npm run build`, then `npm start`. Browser-test setup and isolated Auth checks
are in the [development guide](docs/development.md#tests).

## Architecture and design

- Next.js 16 App Router, React 19, TypeScript and Tailwind CSS v4.
- `app/` holds routes and UI; `lib/` holds domain/server logic; `public/` holds
  committed assets. Project identity and routes are shared under
  `app/components/projects/`, rather than repeated per view.
- Monochrome, editorial, square-edged UI; project media provides the colour.
  Shared motion respects reduced-motion preferences.
- Photo Graph separates versioned colour/graph processing from its renderers.
  Supabase supplies metadata/Auth; provider-aware media delivery supports R2 and
  legacy Supabase paths. Privileged operations stay server-side.

## Documentation

- [Development, configuration, tests and deployment](docs/development.md)
- [Write-up authoring and design](docs/design/project-write-ups.md),
  [navigation and previews](docs/design/navigation-and-previews.md),
  [versioned Elliot palette example](docs/design/elliot-palette-animation.md)
- [Photo Graph viewer](docs/design/photo-graph-viewer.md),
  [admin and maintenance safety](docs/photo-graph-admin.md),
  [R2 migration and rollback constraints](docs/photo-graph-r2-migration.md)
- [Search metadata and indexing checks](docs/seo/indexing.md)
- [CV source and build](docs/resume/README.md),
  [application evidence](docs/application-evidence.md)
- [Credential-exposure record and recovery gates](docs/security/credential-exposure.md)
