# Repeatable browser baseline (DEL01)

This procedure separates navigation, DOM readiness, graph initialization and
media transfer. It does not claim a universal page-load time, physical-phone
performance, field Core Web Vitals or a demonstrated performance defect.

1. Run the normal checks and build. Start that **production build**, not `next dev`,
   on an unused loopback port: `npm run start -- --port 3167`.
2. Run `node --import tsx scripts/tests/measure-browser-baseline.mts` in another
   terminal. `--base-url`, `--repeats` (3–20; default 5) and `--output` are optional.
   The script refuses non-loopback origins and does not read environment files.
   `--offline-smoke` blocks every non-loopback-origin browser request for testing
   the measurement tool itself and supplies an empty local graph fixture. Request
   interception also disables the browser HTTP cache. Its output is explicitly non-representative and
   must not be published as a performance baseline.
3. Keep the raw ignored `.tmp/browser-baseline.json`. Record the commit and whether
   uncommitted changes exist, OS/architecture, browser/runtime, viewport, device
   scale, power/GPU/browser flags and background workloads alongside any summary.
4. Compare distributions by route, viewport and cache state, not a single best
   result. Report median and range with the number of repetitions. Preserve
   outliers and network failures; investigate rather than silently removing them.

Each iteration creates a fresh context and then reloads within that context.
This distinguishes browser-context state, not guaranteed cold CDN/server caches.
The desktop and narrow viewport are Chromium layout tests at DPR 1, not device
emulation or measurements from Safari, an iPhone or a mobile GPU. No CPU/network
throttle is applied; reduced motion is enabled and recorded.

The homepage sample waits for a project control. The rich-preview sample restores
the Photo Graph hash and waits for its focus region and canvas. Those are named
DOM milestones, **not** proof that every photograph is decoded, the simulation is
settled or every interaction succeeds. FCP, latest observed LCP candidate, raw
layout-shift sum and completed-response body sizes are sampled for two more
seconds. The shift sum is not a field CLS session-window score. In-flight media
and work after the window are excluded. Request failure output stores only
origins, not signed URLs, credentials or member data. HTTP error statuses are
recorded separately from transport failures. Outside offline-smoke mode, a rich
preview sample without an observed successful graph API response fails instead of
silently treating a failed/unconfigured backend as a valid performance baseline.

Use browser traces for a separate question about hidden-preview resource use;
inert/aria-hidden alone does not pause a canvas, video or frame. Change lifecycle
policy only after measurements isolate an actual cost. Do not substitute a local
fixture (or its fake Auth/graph) for public production timing. No benchmark result
is asserted until this procedure is actually run against the intended build.
