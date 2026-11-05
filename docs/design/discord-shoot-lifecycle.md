# Discord Shoot Manager lifecycle illustration

Surface: `/write-ups/tvm-discord-bot`. Mode: Read.

## Purpose and evidence boundary

The owner selected a shoot-lifecycle animation rather than an animated recovery
diagram. It appears under **Giving each shoot a lifecycle**; the recovery section
retains its prose, regression assertion and historical CI link without the old chart.

The scene is an illustration, not a Discord recording or a live bot. Campus
interview, Sam, Alex, the location, time and conversation are synthetic. No
credentials, roster records, Discord SDK or service calls are used. The caption
identifies both its synthetic nature and ordinary-participant viewpoint. It does
not claim attendance, adoption or elapsed real-world time.

Behaviour follows `TheTexta/discord-shoot-manager`'s `docs/guides/shoots.md` and
`ui-text.json`, inspected 4 November 2026: an administrator publishes an invitation;
an eligible member reacts to gain access; closing retains readable history while
ordinary participants lose posting access. Direct-invite names appear only in the
private brief. Administrators and production-access holders have distinct archive
permissions, so the illustration does not imply all users lose posting rights.

## Implementation

- `app/components/projects/discord-shoot-manager/shoot-lifecycle.tsx` owns the
  bounded DOM scene and its synthetic content. The surrounding MDX remains server
  rendered. Its CSS module uses existing canvas, ink, muted and surface tokens.
- `lib/discord-shoot-manager/lifecycle.ts` owns three four-second stages and the
  pure pose/renderer functions. A reaction precedes the private-channel reveal;
  that channel later moves into the archive while the same message node remains.
- The unchanged `AnimationPlayer` owns playback, pause, visibility, keyboard
  seeking, reduced motion and the 450 ms loop return. The scene interpolates from
  its actual last pose when navigation/reset interrupts a hold or another seek.
  There are no child timers or per-frame React state updates.
- Each selectable stage starts with a readable settled state. Reduced motion
  renders the final archive and makes manual selection immediate. Without
  JavaScript, the invitation, article's numbered walkthrough and static accessible
  summary remain readable; player controls stay disabled until hydration.
- Below a 480 px scene width, the channel sidebar is omitted rather than shrinking
  the interface. The focused message view, archive state and explanatory sentence
  remain. Frame height stays fixed; all motion is bounded within the specimen.

## Sharing poster

The catalogue uses `public/projects/tvm-discord-bot/shoot-lifecycle.png`, a
1600 × 1000 light-mode capture of the real DOM scene at its archived state. The
header identifies it as an illustrated member view. Its dimensions and alternative
text remain centralized in the catalogue. The legacy chart source/images are
retained but no longer referenced by this article or its sharing image.

To regenerate after an intentional scene change:

```sh
PORTFOLIO_TEST_PORT=3157 node scripts/discord-shoot-manager/capture-poster.mjs
```

Choose an unused local test port. The script runs only the dedicated Playwright
poster test against the existing isolated, environment-free app fixture, then
checks its dimensions and copies the PNG to the public asset. A failed test leaves
the current poster unchanged. It does not start the Discord bot or deploy anything.
The capture uses a 640 × 400 scene at 2.5 device pixels per CSS pixel, with fonts
ready and reduced motion enabled. Artifacts remain in a unique ignored `.tmp/`
directory for inspection. Browser/font version changes may affect raster output;
review the image after regeneration.

## Verification

```sh
npx vitest run tests/unit/shoot-lifecycle.test.ts tests/unit/animation-timeline.test.ts
PORTFOLIO_TEST_PORT=3157 npm run test:e2e -- tests/e2e/shoot-lifecycle.spec.ts tests/e2e/discord-write-up.spec.ts --output=.tmp/playwright-shoot-lifecycle
```

Checks cover stage boundaries, ordering, actual intermediate poses, interrupted
seeks/reset, full loops, offscreen suspension, persistent user pause, keyboard
focus, reduced motion, no-JavaScript content, stable conversation nodes, mobile
widths, both themes, sharing metadata and reproducible poster dimensions. These
are tests of the illustration, not live Discord integration tests.
