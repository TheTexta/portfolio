# Visual/accessibility audit — final

Read-only live audit, 2026-10-27. Scope: `/portfolio`, `/projects/photo-graph`, `/grailed-plus` at **1440×900** and **390×844**. Used independent installed Playwright Chromium pages, not a shared browser. Read repository AGENTS.md/README.md, upstream seo-visual body, Impeccable context/audit guidance. No interview/redesign needed: the subagent brief fixes the existing monochrome editorial/square-edge identity as authority. Existing modified repository documentation remains untouched. No installs, submissions, uploads, production mutations, source/config edits or deployment. Initial partial report persisted before capture; this replaces it.

## Outcome

**Responsive rendering is generally sound; one confirmed keyboard-accessibility defect deserves priority.** All six page/viewports returned HTTP 200 with document widths exactly matching viewport widths, legible primary content and visible H1s. No first-party broken image was observed. Grailed Plus's live demo did not become ready during a separate 9.5-second observation; treat this as an observed embedded-experience limitation, not a proven first-party HTTP/network failure.

## Confirmed findings

### V1 — P1: Several keyboard-focus states have no visible indicator

- **Observed:** Tabbing to the site brand, directory links, Photo Graph query-selector buttons, Grailed feature-index links and some primary action links produces `:focus-visible`, but computed outline is **`none 2px`**, with no box shadow or underline. The focused Q02 query button is visually indistinguishable from its unfocused state; its black/white appearance represents the active query, not keyboard focus. Other controls (e.g. INDEX/CONTACT and portfolio accordion rows) do show outlines, so this is not a browser-wide loss of keyboard modality.
- **Impact:** A keyboard user cannot reliably locate focus when discovering projects or selecting comparison photographs. WCAG 2.4.7 Focus Visible failure on verified controls.
- **Source:** `app/components/ui/editorial.tsx:236-237,305-311`; `app/components/ui/header-directory.tsx:19-20`; `app/projects/photo-graph/model-comparison/photo-graph-model-comparison.tsx:165-170`; `app/components/projects/grailed-plus/grailed-plus-install-page.tsx:404-407`. These combine `outline-none` with focus outline width/color utilities. Live computed style confirms the problem; exact generated CSS cause was not exhaustively traced.
- **Recommendation:** Preserve the existing square, monochrome focus treatment but explicitly restore an outline style on focus (or equivalent consistently visible indicator), not merely width/color. Verify on buttons and links in the production build.
- **Evidence:** `evidence/visual-followup-{desktop,mobile}.json` (brand/queryFocus); `evidence/visual-*-{desktop,mobile}.json` (first nine tab stops); `screenshots/visual-photo-graph-mobile-brand-focus.png`, `screenshots/visual-photo-graph-mobile-query-focus.png`, `screenshots/visual-photo-graph-mobile-keyboard.png`. The query-focus followup is an early-load capture; blank thumbnails there are not classified as broken images.
- **Functional pass alongside defect:** Enter on focused Q02 changes `aria-pressed` to true and the comparison heading to “Dense neutral texture” on both viewports. No trap encountered in the sampled tab sequences.

### V2 — P2: Compact header hit areas fall short of comfortable mobile touch sizing

- **Observed:** Brand, CONTACT, INDEX and INSTALL header links are 28px tall; on mobile INDEX is ~44×28px, CONTACT ~66×28px, INSTALL 73×28px. Header text is 11px. These are usable but noticeably smaller than 44–48px comfortable touch targets.
- **Source:** `app/components/ui/editorial.tsx:236-237,264-273` (`min-h-7` controls / `min-h-8` navigation).
- **Recommendation:** Enlarge transparent hit area vertically while retaining typography, thin rules and square geometry.
- **Standard qualification:** This is a usability recommendation, **not an asserted WCAG 2.5.8 AA failure**: these controls exceed 24px in both dimensions. The 1×1px checkbox in raw control geometry is visually hidden and label-backed; it is not independently counted as a touch-target failure.
- **Evidence:** `evidence/visual-portfolio-mobile.json`, `evidence/visual-photo-graph-mobile.json`, `evidence/visual-grailed-plus-mobile.json`, `initial.controls`.

## Observed limitation requiring separate verification (not a proven root cause)

**Grailed Plus live demonstration remained unavailable in this browser run.** Both sizes initially showed “Connecting to the current extension build”; after 9.5s the hero showed “Live demo is temporarily unavailable” and an accessible retry button. First-party copy, feature links, and Chrome Web Store CTA remained available. Source has an 8s readiness timeout and an explicit fallback: `app/components/projects/grailed-plus/grailed-plus-live-demo.tsx:45-49,225-237,338-379`.

The iframe source is **`https://grailed-plus-demo.dextery.dev/?feature=overview`**, a separate origin. The followup frame list did not show a loaded document URL; a short diagnostic logged no response/error from that origin. This establishes a readiness failure during the run but does **not** prove a DNS, CSP, server or first-party Next.js failure. The only failed requests in the main capture were aborted Google advertising/measurement requests, not image or dextery.dev requests. Do not conflate them. Recommend verifying the demo origin and retaining a useful static visual fallback if unavailable; no live-service change is authorized by this audit.

Evidence: `screenshots/visual-grailed-plus-{desktop,mobile}-settled.png`, `evidence/visual-followup-{desktop,mobile}.json`, `evidence/visual-grailed-embed-diagnostic.json`, raw main-capture request-failure lists.

## Above-fold, navigation and mobile rendering passes

| Page                    | Desktop                                                                                                                                                                         | Mobile                                                                                                                                                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/portfolio`            | H1 visible at y264; Projects begins around y715; CONTACT visible in header. The partially clipped side cards are the intentional horizontal browser, **not document overflow**. | H1 visible at y546, descriptive line around y712; Projects begins around y900, just below the 844px fold. CONTACT remains visible at top; all five project names and contact options are legible in fullpage capture. |
| `/projects/photo-graph` | H1 y116 and LAUNCH EXPERIENCE above fold; graph renders in its bordered container. Five comparison model columns fit.                                                           | H1 y96 and LAUNCH EXPERIENCE above fold; graph fits; labelled query controls use two columns and model comparison cards stack without clipping. Long page (~7996px) is vertical content, not overflow.                |
| `/grailed-plus`         | H1 and ADD TO CHROME / EXPLORE FEATURES visible above fold.                                                                                                                     | H1 and VIEW IN CHROME WEB STORE / EXPLORE FEATURES visible above fold; stacked feature sections remain within 390px. Demo readiness caveat above.                                                                     |

- All three emit `width=device-width, initial-scale=1`; no maximum-scale/user-scalable restriction observed.
- Document scroll widths: desktop 1440, mobile 390 for every route. No observed horizontal document scroll or clipped primary text.
- Main navigation/contact are labelled links; project mobile rows are real buttons; Photo Graph query controls are real labelled buttons with `aria-pressed`. Seven `alt=""` query thumbnails are redundant to their enclosing button's visible labels, not seven missing accessible names.
- Keyboard order reaches project selection and contact. Sample was first nine stops per page, plus focused-query Enter activation, not a complete keyboard certification. No external install/contact/profile links were followed.
- Reduced-motion emulation is recognized. Source respects reduced motion in directory transitions (`header-directory.tsx:23-28`), project browsing (`project-browser.tsx:769`) and graph canvas (`PhotoGraphCanvas.tsx:134,255`); Grailed's smooth scroll/snap is disabled (`globals.css:128-145`). Followup computed scroll behavior was `auto`. Did not measure every graph animation or screen-reader announcement.
- Design integrity pass: consistent monochrome, editorial typography, thin rules, square frames; no redesign recommendation. Performance/theming scores intentionally omitted because they are outside this visual subtask.

## Image evidence for lead auditor (support only; lead owns image conclusions)

**Machine-readable:** `evidence/visual-image-support.json` and six `evidence/visual-{portfolio,photo-graph,grailed-plus}-{desktop,mobile}.json` files. They include initial and after-scroll image `currentSrc`, element/parent rectangles, natural dimensions, `loading`, completion, alt and parent labels. `inViewport` considers both horizontal and vertical overlap. Rectangles are browser CSS px, not inferred from screenshot scaling.

- Portfolio desktop initially visible cards select `/_next/image?...w=750&q=75`; actual rendered rectangles: Photo Graph x−434.6/y783, 746.8×372.4; Elliot x322.2/y783, 606.4×372.4; bur1alrites x938.6/y783, 559.6×372.4. Offscreen Grailed/nepo images have empty currentSrc initially and must **not** be called broken. This carousel clips within its own intended track.
- Portfolio mobile: visible hero artwork is `/favicon.ico`, 256×256 at x67/y196; first expanded Photo Graph poster is below fold at x17/y1013, 356×177, selecting `/_next/image?url=%2Fprojects%2Fposters%2Fphoto-graph.webp&w=384&q=75`. Other collapsed/desktop-only poster nodes have zero geometry and were not considered visible failures. Next `fill` aspect-ratio containers are valid; no absent-width/height finding made.
- Photo Graph: **42 img elements / 17 unique URLs**, all visible-sized completed comparison images loaded in main captures. Images use shared `images.dextery.dev/photo-graph/...?...width=560&quality=86&format=auto&resize=cover`. The live graph itself is canvas, so DOM img counts exclude graph-painted photographs.
- Comparison position examples: first query thumbnail desktop x49/y1488.6, mobile x21/y1543.7, both 72×80. First ranked result desktop x60/y2055.6, 121.5×121.5; mobile x32/y2425.7, 162.5×162.5. Each model also has a large query image immediately above its rank grid; all positions/geometry are in the raw JSON. These images are below the initial fold, with `loading="auto"`; this is evidence for lead review, not a duplicate performance verdict.
- Grailed first-party document has zero img elements; demonstrations are iframe-based, not missing img tags.

## Evidence inventory and limitations

- For each of the three slugs and both devices: `screenshots/visual-{slug}-{device}-fold.png`, `-full.png`, `-keyboard.png`. All six fullpage screenshots and representative fold/focus screenshots were actually inspected.
- Additional settled Grailed and Photo Graph focus screenshots listed above. Independent screenshot captures are not pixel-diff or layout-shift measurements; animation/scroll state can differ between fold and fullpage shots.
- Accessibility snapshots saved as `a11y` in the six page JSON files. No axe install, full contrast scan, screen reader, physical mobile device, touch gesture synthesis, text-zoom test, full project-focus modal traversal, or performance lab run. Touch layout was emulated; actual gestures remain untested.
- Repository references describe locally inspected source; live computed styles/screenshots are the proof of deployed behavior. No source/deployment identity match was asserted.

## Structured handoff

```json
{
  "category": "Visual",
  "status": "complete_with_limitations",
  "viewports": ["1440x900", "390x844"],
  "findings": [
    {
      "id": "V1",
      "priority": "P1",
      "title": "Invisible keyboard focus on several shared links and comparison buttons",
      "confirmed": true,
      "wcag": "2.4.7"
    },
    {
      "id": "V2",
      "priority": "P2",
      "title": "28px header hit areas below comfortable mobile target sizing",
      "confirmed": true,
      "wcagFailureAsserted": false
    }
  ],
  "observations": [
    {
      "id": "V3",
      "title": "Grailed embedded demo did not become ready",
      "rootCauseConfirmed": false
    }
  ],
  "passes": [
    "six HTTP 200 pages",
    "no document horizontal overflow",
    "all H1s visible",
    "main actions available",
    "comparison query activates with Enter",
    "no broken first-party image observed"
  ]
}
```
