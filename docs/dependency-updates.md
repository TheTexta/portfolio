# Portfolio dependency refresh — 1 November 2026

The owner expanded the review implementation to update every compatible portfolio
package after a clean install identified a critical Next.js production advisory.
This does not authorize a release, deployment or unrelated repository refresh.

## Tested target versions

| Group                                      | Installed target           |
| ------------------------------------------ | -------------------------- |
| Next.js / MDX adapter / Next ESLint config | 16.4.3                     |
| React / React DOM                          | 19.3.1                     |
| Framer Motion / Lucide                     | 14.9.0 / 1.66.0            |
| Supabase SSR / JS / CLI                    | 0.12.7 / 2.118.0 / 2.122.0 |
| AWS S3 client and presigner                | 3.1161.0                   |
| Vercel Analytics / Speed Insights          | 2.0.1 / 2.0.0              |
| React Force Graph 2D                       | 1.29.2                     |
| PGlite / Vitest                            | 0.5.14 / 5.0.5             |
| TypeScript / Node typings                  | 6.0.3 / 22.20.5            |
| Prettier / Tailwind formatting plugin      | 3.9.10 / 0.8.1             |
| Tailwind / PostCSS adapter                 | 4.3.3                      |

Other current stable packages remain current; declared ranges now record tested
floors. The lockfile also refreshes compatible transitive packages, including the
Zod security patch. No forced peers, broad incompatible override or
`npm audit fix --force` was used. The existing gaxios override was preserved.

## Compatibility limits and small required adaptations

- **Node 22.12+** is the minimum supported runtime for current Vite/Vitest. Node
  22.18 satisfies the checked engines. Node typings follow the supported 22 line,
  not the latest Node 26 APIs.
- **TypeScript 6.0.3** remains below the lint parser's `<6.1.0` peer ceiling.
  TypeScript 7 is not forced. Next itself supports its newer CLI checker, but
  that does not make the entire lint stack compatible.
- **ESLint 9.39.5** remains the latest compatible release because Next's React,
  import and a11y plugins exclude ESLint 10 in their peers. ESLint 9 is marked
  unsupported upstream; this is an explicit maintenance hold, not a claim that
  the tool is currently supported by its vendor.
- TypeScript 6 needs explicit ambient type inclusion: `node`, `react`,
  `react-dom` and `mdx` are named in `tsconfig.json`. MDX typing is retained;
  diagnostics are not ignored.
- Vitest 5 removed `describe.sequential`; the shared-state SQL suite uses
  `{ concurrent: false }` instead. Its rollback, replay and permission assertions
  remain intact. No database behavior was changed for this migration.

`npm outdated` should therefore list only Node typings, ESLint and TypeScript.
Registry versions were checked on 1 November 2026, not inferred from a previous
repository's dependency record.

## Audit scope

After a clean `npm ci --ignore-scripts`:

- Production audit: **zero findings**, down from one critical Next.js finding.
- Full tree: **17 moderate development-only findings**, no high or critical.
  Every affected installation path is marked development-only in the lockfile.
  These are minimatch glob-processing denial-of-service warnings propagated
  through the lint stack. A forced incompatible minimatch major is not a safe fix.

Package audits are not penetration tests, proof of exploitation or complete
application-security assessments. A separate offline native Sharp check decoded
a synthetic PNG, flattened/resized it to WebP with the expected dimensions and
rejected malformed bytes; the ignored-scripts install does not itself prove
native functionality. SQL tests execute actual PGlite rather than mocked calls.
Analytics server behavior is exercised with its actual
library, fabricated request context and intercepted fetch, never live telemetry.

## Release gate

Run `npm run check`, `npm test`, the desktop/mobile browser suite,
`npm run admin:validate-auth` and a clean production build after the final edits.
Keep browser-emulation results distinct from physical-device or hosted CI runs.
The working tree already contained user changes before this work: do not commit
or deploy it wholesale without a separately reviewed scope.
