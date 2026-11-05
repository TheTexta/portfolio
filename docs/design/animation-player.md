# Shared animation player

`app/components/ui/animation-player.tsx` is the shared shell for looping,
seekable explanatory animations. It uses the write-up navigation's thin
monochrome rail, ticks and hover/focus labels, transposed horizontally.
It does not contain Grailed Plus, image ranking, iframe origins or scene details.

## Interface

```tsx
<AnimationPlayer
  label="Example"
  stages={STAGES}
  ready={assetsAreReady}
  onFrame={renderFrame}
>
  <YourScene />
</AnimationPlayer>
```

- Keep `STAGES` stable (a module constant or memoized array). Each stage has a
  unique `id`, a human-readable `label`, and a positive `durationMs`.
- `onFrame` receives `timeMs`, `durationMs`, overall `progress`, current `stage`,
  `stageProgress`, `cycle`, `playing`, `seeking`, `reducedMotion` and `transition`.
  Normal playback renders the requested time, including when it moves backwards.
  During navigation/reset, `transition` contains `{ id, kind, toTimeMs, progress }`;
  `kind` is `seek` or `reset` and `progress` is already eased from 0 to 1.
  Cache the currently rendered pose when its ID changes, then interpolate from
  that pose to `toTimeMs`. This preserves continuity even when a selection
  interrupts another transition, or the timeline contains long static holds.
  `stage` and `stageProgress` identify the destination during transitions;
  `timeMs` and the rail interpolate continuously. Do not start independent timers.
  Update SVG attributes, canvas, paused CSS animation times, or a validated iframe
  renderer imperatively.
- `children` is the scene, not a 60fps render prop. The player updates its
  progress/range elements through refs and changes React state only for playback
  intent/preferences. It adds no animation dependency.
- `ready` defaults to true. With asynchronous assets, render once ready and gate
  any scene-specific bridge until its receiver is connected.

`lib/animation/timeline.ts` owns the clock. Its small interface provides frame
inspection, activity and motion-preference gates, pause/resume, smooth seek and
disposal. Tests inject a deterministic frame scheduler, exercising the same
interface as the React shell rather than inspecting internal implementation.

## Behaviour and accessibility

The rail fills linearly across the authored stages. Stage-start ticks are placed
by duration rather than equally spaced. Click/tap anywhere to select the nearest
stage start over 450 ms; navigation never stops between stages. A new selection
interrupts from the currently rendered pose, not an earlier stage's static pose.
Autoplay resumes from the destination unless the user has explicitly paused.
After the last stage, a separate 450 ms transition smoothly returns the scene and
rail to the first stage without a fade. Stage durations are unchanged; `cycle`
increments when that return finishes. `seeking` covers both selections and resets.
The play/pause affordance and phase labels appear on hover/focus; touch devices
show the playback affordance without requiring hover. The native range has a
44px hit area, discrete stage indices and an accessible stage label. Arrow keys
select adjacent stages, Home/End choose the first/last stage and Space
pauses/resumes. There are no visible percentages.

Autoplay runs only when ready, the document is visible and at least half the
player intersects the viewport. Offscreen/hidden/BFCache time is not counted;
unfinished selections and resets also freeze. An explicit pause freezes an
in-flight playing transition, while a new selection still transitions when
paused. User pause persists across visibility changes and further selections.
Reduced motion shows the completed state without autoplay and makes manual
seeks immediate. Changing the preference during playback cancels the seek and
shows completion. No per-frame live-region announcements are made.

## Grailed Plus adapter

The hosted scene is authored in the Grailed Plus repository's `src/ui.css` and
`demo/recorded-comparison.ts`. It is synced into the portfolio with
`npm run grailed-plus:sync-demo`, including the stage specification JSON.
`GrailedPlusLiveDemo` forwards the shared clock as protocol-v1 `frame` messages
with `timeMs` and `transition`; the iframe validates origin, parent window,
finite timestamps and transition fields before rendering. Malformed transition
messages are ignored. The scene owns no clock while managed this way. Its small
standalone/legacy-host fallback loops with the same 450 ms return only while visible.

The same source photograph remains fixed. Analysis scans the photographs for
2.7s; recorded confidence-preserving refinement interpolates their positions
over 1.2s; completion draws a check and holds for 3s. The photographs stay fully
visible and stationary throughout completion; the metadata order resets only
during the smooth return. The three selectable starts are 0, 2700 and 3900 ms;
the complete autoplay cycle is 6900 ms plus the 450 ms return. Selecting completion
reveals its finished check, which remains visible as autoplay continues through
that stage. All photographic identities and recorded scores remain unchanged.
The check means refinement completed, not verified matching accuracy.

## Elliot Mairet adapter

The [five-colour extraction example](elliot-palette-animation.md) renders a native
canvas scene from the same `onFrame` interface, without an iframe or child clock.
It uses a recorded real OKLab extraction, cached-pose transitions and settled
manual stage selections. The shared player and Grailed Plus adapter are unchanged.

## Discord Shoot Manager adapter

The [Discord Shoot Manager lifecycle](discord-shoot-lifecycle.md) is a native DOM
adapter with three 4-second stages. It writes pose variables from `onFrame`, uses
the shared seek/reset transitions and keeps illustration copy separate from live
service evidence. It changes neither the clock nor other adapters.

## Verification

```sh
npx vitest run tests/unit/animation-timeline.test.ts tests/unit/grailed-plus-recorded-demo.test.ts
npx playwright test tests/e2e/grailed-plus-demo.spec.ts
```

Tests cover multiple cycles, discrete forward/backward and interrupted selections,
smooth resets, visibility pauses, repeated user pause/resume, reduced motion,
disposal, stage/rail/scene sync, stable photographic nodes, actual intermediate
positions and message validation.
