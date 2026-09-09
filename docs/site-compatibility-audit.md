# Site Compatibility, Hardening, and Maintainability Audit

## Audit verdict

The site is visually distinctive and generally responsive, but it is not fully consistent or hardened across all display sizes.

This audit found **22 actionable issues: 0 critical, 8 high, 10 medium, and 4 low**. Overall quality: **7/10**.

Representative routes were tested at 320×568, 390×844, 768×1024, 844×390, 1440×900, and 2560×1440. The production build passes and `npm audit` reports zero runtime dependency vulnerabilities.

## Anti-pattern verdict

Pass. The site does not look generically AI-generated. The monochrome editorial system, project-specific typography, square geometry, restrained color, and full-bleed rail feel deliberate. There are no gratuitous gradients, glass effects, generic icon-card grids, or decorative metrics.

## High-severity findings

| Issue                                            | Evidence and impact                                                                                                                                                                                                                                                                                                        | Recommendation                                                                                                                                                                |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Grailed Plus header breaks at 320px              | The three right-side controls force the brand off-screen and crop the theme switch. The page's `overflow-clip` hides the problem rather than allowing document overflow. See `app/components/projects/grailed-plus/grailed-plus-install-page.tsx:329` and `app/components/ui/editorial.tsx:226`.                           | Introduce a compact mobile header variant: retain Install, fold Index/theme into a menu, or hide the redundant brand label.                                                   |
| Grailed Plus experience is unusable on phones    | It always renders a 1280px desktop page and scales it to the available width. At 320px the entire interface is approximately 25% scale, leaving unreadable text and tiny controls. See `app/components/projects/grailed-plus/grailed-plus-preview.tsx:14` and `:48`.                                                       | Render the actual responsive product page on narrow screens, or explicitly replace this route with a poster and “Open desktop demo” action below a content-driven breakpoint. |
| Photo Graph controls overlap navigation at 320px | The control panel is up to 288px wide while the experience navigation occupies the top-right corner. The maximize/minimize control overlays the checkbox area. See `app/components/projects/photo-graph/config.ts:37` and `PhotoGraphCanvas.tsx:510`.                                                                      | Give both controls a shared responsive toolbar, or subtract the navigation width from the graph panel on narrow screens.                                                      |
| The graph itself is pointer-only                 | Photograph nodes are painted onto a canvas and only expose `onNodeClick`; there is no keyboard-accessible node list or screen-reader alternative. Users cannot inspect or download photographs without a pointer. This affects WCAG 2.1.1 and 4.1.2. See `PhotoGraphCanvas.tsx:533` and `:569`.                            | Add an accessible synchronized photograph list/grid with focus, selection, and inspect actions. Canvas can remain the visual experience.                                      |
| Theme toggle has no visible keyboard focus       | Keyboard focus lands on a 1×1 transparent checkbox; the visible switch has no `peer-focus-visible` styling. This affects WCAG 2.4.7. See `app/components/ui/theme-toggle.tsx:17`.                                                                                                                                          | Use a real button with `aria-pressed`, or apply a visible focus ring to the label/switch through `:has(:focus-visible)` or Tailwind peer variants.                            |
| Duplicated rail cards have broken semantics      | Ten cards were rendered for a five-project loop. Duplicate articles received `aria-hidden`, but their buttons remained focusable.                                                                                                                                                                                          | Resolved: the rail now renders each project once and uses an end-to-end reversing motion path instead of duplicate cards for an infinite loop.                                |
| Small low-opacity text fails light-mode contrast | Ink at `opacity-55` produces roughly 4.12:1 against the canvas; `opacity-50` is roughly 3.51:1. Numerous 9–12px labels use these values. This affects WCAG 1.4.3. See `app/projects/photo-graph/model-comparison/photo-graph-model-comparison.tsx:97` and `app/components/projects/spotify-nodify/spotify-nodify.tsx:157`. | Use `text-muted` or a dedicated metadata token with at least 4.5:1 contrast instead of element opacity.                                                                       |
| Admin login lacks abuse protection               | Password comparison and signed cookies are implemented well, but there is no visible application-level throttling, lockout, or IP/account rate limiting. See `app/api/admin/photo-graph/login/route.ts:16`.                                                                                                                | Apply rate limiting at the proxy or route layer, log repeated failures, and consider an allowlist or managed identity provider for this private tool.                         |

## Medium-severity findings

- Control sizing is inconsistent. `Action` defaults to 44px, `ControlButton` defaults to 32px, `ControlLink` defaults to 40px, headers use 28px, and the theme control uses 32px. This is especially noticeable on hybrid touch devices. See `app/components/ui/control.tsx:34`, `control.tsx:93`, and `editorial.tsx:15`.

- Mobile project cards do not fit in the viewport. At 320px, the Grailed card measures about 448px because height is fixed at 256px and width is derived from aspect ratio. Its `sizes="78vw"` hint also understates the actual rendered image width. See `app/globals.css:306` and `app/components/projects/project-browser.tsx:116`.

- Case-study previews enforce a 480px minimum height, which is larger than many landscape phone viewports and consumes excessive mobile space. See `app/components/projects/project-case-study-shell.tsx:89`.

- Closing a project focus view does not restore keyboard focus. The selector expects the button to be a direct child of the article, but it is nested inside the media wrapper. See `app/components/projects/project-browser.tsx:486`.

- Spotify connection is not hardened against rejected authentication, restricted `localStorage`, or repeated clicks. An authentication rejection can become an unhandled promise and there is no connecting state. See `app/components/projects/spotify-nodify/useSpotifySession.ts:104` and `:130`.

- External project iframes have no sandbox policy or useful failure state. A refused, offline, or changed external embed becomes an empty panel. See `app/components/projects/html-project-preview.tsx:20`.

- The Photo Graph case study reads the graph server-side for comparison images, then its live preview fetches the graph again client-side. Comparison thumbnails also use fixed 560px raw images without lazy loading or responsive candidates. See `app/projects/photo-graph/page.tsx:68` and `app/projects/photo-graph/model-comparison/photo-graph-model-comparison.tsx:174`.

- Scrollbars are hidden globally on every element, removing an important affordance from long pages and scrollable admin panels. The Windows detection script is currently unused. See `app/globals.css:57` and `app/layout.tsx:87`.

- Quality gates are not usable. `npm run lint` fails because the Tailwind plugin looks for deleted `src/style.css`. `format:check` examines vendored `.agents` documentation and reports 132 files because no `.prettierignore` exists. See `eslint.config.mjs:13` and `package.json:9`.

- The app does not emit CSP, Permissions-Policy, Referrer-Policy, frame, or nosniff headers itself. Production infrastructure may add these, but they were absent from the built application responses. See `next.config.ts`.

  The application now emits conservative `Permissions-Policy`, `Referrer-Policy`, `X-Content-Type-Options`, and `X-Frame-Options: SAMEORIGIN` headers from Next. CSP remains intentionally omitted: the app uses runtime-configured Supabase image hosts, Spotify authentication, external project iframes, and client-side integrations whose complete script, connection, image, and frame origins cannot be derived safely from this repository without risking a breaking policy. The admin login also has a bounded, process-local failed-login throttle; deployment-level rate limiting remains required for distributed protection.

Lower-priority items include the absence of a skip link on long pages, English-only formatting and root `lang`, inconsistent application of project title treatments between the rail and case-study shell, and no automated responsive/accessibility regression suite.

## Maintainability refactor

The highest-return refactor would be:

1. Merge `ActionButton`/`ActionLink` and the four `Control*` components into one CVA recipe with consistent sizes and polymorphic button/link wrappers. Keep 44px as the public default and make compact density explicit.

2. Split the 1,670-line `app/admin/photo-graph/upload/upload-client.tsx` into:

   - API client and shared response types
   - `usePhotoGraphAdmin` orchestration hook
   - Model, graph-control, upload, photo-management, and activity panels
   - Small field, range, and status primitives

3. Make the project catalog the only project source. Derive `ProjectId` from it and replace the ID-indexed preview renderer with a discriminated `preview` configuration. `previewKind`, `role`, `date`, `outcome`, `links`, and `GrailedPlusFeature` are currently unused or partially duplicated. See `app/components/projects/project-catalog.ts:11`.

4. Decide whether Spotify is published or archived. It is absent from the catalog, has a `null` catalog preview, but still has an indexable case study and sitemap entry with a conflicting project number. See `app/components/projects/project-live-preview.tsx:72` and `app/sitemap.ts:10`.

5. Share API DTOs and runtime validation between routes and clients instead of duplicating types and relying on JSON casts.

## Migration cleanup candidates

- Delete the four `app/components/projects/*/page.tsx` files after moving any required redirects into `next.config.ts`. They currently create accidental public `/components/projects/*` routes in the production build.

- Remove the stale robots entry for `/components/projects/nepobabiesruntheunderground/preview`. See `app/robots.ts:12`.

- Once database stability is confirmed, retire the static `public/portfolioTable.json` fallback, legacy ID-path generation, removed-node blacklist, and related `"static"` branches. Until then, this fallback is valuable resilience rather than dead code. See `lib/photo-graph/graph-store.ts:36` and `:240`.

- Move completed one-time migration commands into `scripts/migrations/` or remove them after recording completion: Firebase migration, storage rename, dimension/color backfills, cache-control repair, and CIEDE2000 activation.

- Review legacy routes using traffic data: `/go/grailed-plus`, `/projects/grailed-plus`, `/grailed-plus/experience`, and the root redirect to `/portfolio`.

- Remove obvious residue: `app/favicon_backup.ico`, the completed Grailed integration plan, and committed screenshot outputs if they are not deliberate visual-regression fixtures.

- `@plausible-analytics/tracker` is now unused by the pending `app/layout.tsx` change. `recharts` is also unused, and `tailwind-scrollbar-hide` is imported but not used as a class. Remove them after confirming intent. The existing layout modification was left untouched during the audit.

## CSS and Tailwind simplification

`globals.css` can be reduced substantially without changing the visual result:

- Keep global theme values, font registration, base body styling, reduced-motion rules, keyframes, and view-transition behavior.

- Delete currently unused CSS: `--animate-hover`, its keyframes, `.link-normalized`, `.media-label`, and `.editorial-marquee-track`.

- Move simple semantic classes into the existing primitives:

  - `editorial-page` → `min-h-dvh bg-canvas text-ink`
  - `editorial-muted` → `text-muted`
  - `editorial-rule` → `border-rule`
  - `editorial-frame` → `border border-rule bg-transparent`
  - Primary/secondary states → the shared action CVA

- Replace the global project-title selector matrix with a `ProjectTitle` CVA component using `treatment` and `context="rail|focus|case-study"` variants.

- Move the project rail's ordinary layout declarations into JSX Tailwind classes and use data variants for visibility. Keep only its relational/input-mode behavior in a colocated CSS module; forcing all `:has()`, view-transition, and pointer media-query logic into arbitrary Tailwind strings would reduce readability.

- Convert the Tailwind v4 theme to CSS-first `@theme` tokens and remove `tailwind.config.js` if no JavaScript-only configuration remains.

- Replace low-opacity text with semantic color tokens. This both simplifies classes and fixes contrast.

- Apply `scrollbar-hide` only to the project rail, then remove the universal scrollbar rules.

A visual-regression baseline at the audited viewport sizes would let this cleanup retain the forward-facing design pixel-for-pixel.

## Recommended order

1. Use `/adapt` for the three confirmed breakpoint failures and oversized mobile cards.
2. Use `/harden` for canvas accessibility, theme focus, Spotify failure states, iframe fallbacks, auth throttling, and security headers.
3. Use `/normalize` and `/extract` to consolidate sizing, controls, title treatments, and project metadata.
4. Use `/optimize` for duplicate graph loading and responsive/lazy comparison images.
5. Repair lint/format gates, then add Playwright viewport and axe checks before performing the CSS migration.

## Positive findings

Foundations worth preserving include:

- Strong brand consistency
- Good semantic headings and labels
- Robust Grailed demo timeout and retry behavior
- Abortable Photo Graph requests
- Reduced-motion handling
- Safe signed admin cookies
- Optimized poster images
- Sensible maximum widths on large displays

## Verification scope

All public routes, shared components, styling layers, and utility routes were inspected. Public and authenticated entry screens were rendered at representative viewports in headless Chrome. The authenticated Photo Graph upload interface was inspected statically because a valid admin session was not available. The internal behavior of externally hosted iframe projects was outside this repository and was not fully audited.
