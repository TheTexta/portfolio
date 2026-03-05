# Grailed Plus Portfolio Integration Plan

## Source Context

- Project: **Grailed Plus (V2)**
- Core goal: restore pricing context on modern `grailed.com` listings

### Current shipped capabilities to highlight

- Price history
- Average price drop
- Next expected drop estimate
- Seller account creation date
- Listing metadata button (opens listing JSON)
- Automatic currency conversion (USD to selected currency with USD tooltip context)
- Site-wide dark mode with customizable primary color

### Planned roadmap to mention

- Depop autocomparison with matching listings
- Price history graph view
- Updated logo and screenshots
- Better hover-based inspect behavior

## Portfolio Integration Scope

1. Add Grailed Plus as a project card in home page project catalog.
2. Provide a full-page project route with expanded content and controls.
3. Use a short autoplay preview loop (`preview.webm`/`preview.mp4`) instead of GIF for quality and size.
4. Add an interactive mock switcher for three extension areas:
   - Pricing
   - Currency
   - Theme
5. Include CTA links:
   - GitHub repo (set your repo URL)
   - Chrome Web Store listing
   - Firefox Add-on listing
6. Include upstream credit line to `RVRX/grailed-plus`.

## File-Level Implementation

- `app/components/projects/project-routes.ts`
  - Add `grailedPlus` route constant.
- `app/components/projects/project-catalog.tsx`
  - Register Grailed Plus project metadata and preview renderer.
- `app/components/projects/project-chrome.ts`
  - Add `grailed-plus` visual chrome variant.
- `app/components/projects/grailed-plus/grailed-plus-preview.tsx`
  - Implement card/full-page preview UI.
  - Implement interactive panel switcher.
  - Add external link buttons and media placeholder guidance.
- `app/components/projects/grailed-plus/page.tsx`
  - Route entry for full-page project view.

## Asset Requirements

Place these files in `public/projects/grailed-plus/`:

1. `preview.webm` (preferred)
2. `preview.mp4` (fallback)
3. `poster.webp` (video poster frame)
4. Optional screenshots for future detailed case-study blocks

## Content To Finalize

1. Set `GITHUB_REPO_URL` in `grailed-plus-preview.tsx`.
2. Capture a 8-15s listing-page demo showing pricing panel + currency + dark mode.
3. Add one concrete outcome metric if available (time saved, decision speed, conversion usage, etc.).
4. Add eventual screenshot updates once logo refresh is complete.

