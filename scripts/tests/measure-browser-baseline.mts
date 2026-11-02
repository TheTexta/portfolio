import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { platform, release, arch } from "node:os";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    "base-url": { type: "string", default: "http://localhost:3167" },
    repeats: { type: "string", default: "5" },
    output: { type: "string", default: ".tmp/browser-baseline.json" },
    "offline-smoke": { type: "boolean", default: false },
  },
});
const base = new URL(values["base-url"]!);
if (
  !["localhost", "127.0.0.1", "[::1]"].includes(base.hostname) ||
  !["http:", "https:"].includes(base.protocol) ||
  base.username ||
  base.password ||
  base.pathname !== "/" ||
  base.search ||
  base.hash
)
  throw new Error("Use an explicit loopback production-server origin");
const repeats = Number(values.repeats);
if (!Number.isInteger(repeats) || repeats < 3 || repeats > 20)
  throw new Error("--repeats must be an integer from 3 to 20");

const browser = await chromium.launch();
const samples: unknown[] = [];
try {
  for (const viewport of [
    { width: 1366, height: 900 },
    { width: 390, height: 844 },
  ]) {
    for (const path of ["/portfolio", "/portfolio#project-photo-graph"]) {
      for (let iteration = 1; iteration <= repeats; iteration++) {
        const context = await browser.newContext({
          viewport,
          deviceScaleFactor: 1,
          reducedMotion: "reduce",
          colorScheme: "light",
        });
        try {
          if (values["offline-smoke"]) {
            await context.route("**/*", (route) => {
              const url = new URL(route.request().url());
              if (url.origin !== base.origin) return route.abort();
              if (url.pathname === "/api/photo-graph/graph")
                return route.fulfill({ json: { nodes: [], links: [] } });
              return route.continue();
            });
          }
          const page = await context.newPage();
          await page.addInitScript(() => {
            const measurements = { lcpMs: null as number | null, cls: 0 };
            Object.assign(window, { baselineMeasurements: measurements });
            new PerformanceObserver((list) => {
              for (const entry of list.getEntries())
                measurements.lcpMs = entry.startTime;
            }).observe({ type: "largest-contentful-paint", buffered: true });
            new PerformanceObserver((list) => {
              for (const entry of list.getEntries()) {
                const shift = entry as PerformanceEntry & {
                  hadRecentInput: boolean;
                  value: number;
                };
                if (!shift.hadRecentInput) measurements.cls += shift.value;
              }
            }).observe({ type: "layout-shift", buffered: true });
          });
          for (const cacheState of ["fresh-context", "same-context-reload"]) {
            const requests: Promise<{
              resourceType: string;
              bodyBytes: number;
            }>[] = [];
            const failures: string[] = [];
            const graphStatuses: number[] = [];
            const responseErrors: { origin: string; status: number }[] = [];
            const onResponse = (
              response: import("@playwright/test").Response,
            ) => {
              const url = new URL(response.url());
              if (
                url.origin === base.origin &&
                url.pathname === "/api/photo-graph/graph"
              )
                graphStatuses.push(response.status());
              if (response.status() >= 400)
                responseErrors.push({
                  origin: url.origin,
                  status: response.status(),
                });
            };
            const onFinished = (
              request: import("@playwright/test").Request,
            ) => {
              requests.push(
                request.sizes().then(
                  (sizes) => ({
                    resourceType: request.resourceType(),
                    bodyBytes: sizes.responseBodySize,
                  }),
                  () => ({
                    resourceType: request.resourceType(),
                    bodyBytes: 0,
                  }),
                ),
              );
            };
            const onFailed = (request: import("@playwright/test").Request) => {
              // Keep only origins, never signed URLs, query strings or cookies.
              failures.push(new URL(request.url()).origin);
            };
            page.on("requestfinished", onFinished);
            page.on("requestfailed", onFailed);
            page.on("response", onResponse);
            try {
              const response =
                cacheState === "fresh-context"
                  ? await page.goto(new URL(path, base).href, {
                      waitUntil: "domcontentloaded",
                    })
                  : await page.reload({ waitUntil: "domcontentloaded" });
              if (response?.status() !== 200)
                throw new Error(
                  `Unexpected document status ${response?.status()}`,
                );
              await page.locator("main h1").waitFor();
              if (path.includes("#project-")) {
                await page
                  .getByRole("region", {
                    name: "Photo Node-Gallery focus view",
                  })
                  .waitFor();
                await page
                  .locator(".project-focus-preview--current canvas")
                  .waitFor();
              } else {
                await page
                  .locator("[data-project-trigger]:visible")
                  .first()
                  .waitFor();
              }
              const readinessMs = await page.evaluate(() => performance.now());
              // A defined sampling window, not a claim of network or GPU idle.
              await page.waitForTimeout(2000);
              const timing = await page.evaluate(() => {
                const navigation = performance.getEntriesByType(
                  "navigation",
                )[0] as PerformanceNavigationTiming | undefined;
                const measurements = (
                  window as unknown as {
                    baselineMeasurements: { lcpMs: number | null; cls: number };
                  }
                ).baselineMeasurements;
                return {
                  ttfbMs: navigation?.responseStart ?? null,
                  domContentLoadedMs:
                    navigation?.domContentLoadedEventEnd ?? null,
                  fcpMs:
                    performance.getEntriesByName("first-contentful-paint")[0]
                      ?.startTime ?? null,
                  ...measurements,
                };
              });
              const transfers = await Promise.all(requests);
              if (
                !values["offline-smoke"] &&
                path.includes("#project-") &&
                !graphStatuses.includes(200)
              )
                throw new Error(
                  "No successful graph API response in the sample; configure the intended backend before measuring",
                );
              samples.push({
                viewport,
                path,
                iteration,
                cacheState,
                readinessMs,
                ...timing,
                completedRequests: transfers.length,
                completedResponseBodyBytes: transfers.reduce(
                  (sum, request) => sum + request.bodyBytes,
                  0,
                ),
                transfers,
                failedRequestOrigins: [...new Set(failures)],
                graphApiStatuses: graphStatuses,
                responseErrors,
              });
            } finally {
              page.off("requestfinished", onFinished);
              page.off("requestfailed", onFailed);
              page.off("response", onResponse);
            }
          }
        } finally {
          await context.close();
        }
      }
    }
  }
  const output = resolve(values.output!);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(
    output,
    JSON.stringify(
      {
        measuredAt: new Date().toISOString(),
        sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], {
          encoding: "utf8",
        }).trim(),
        workingTreeDirty:
          execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" })
            .length > 0,
        browser: browser.version(),
        runtime: process.version,
        host: { platform: platform(), release: release(), arch: arch() },
        origin: base.origin,
        conditions: {
          server:
            "Caller must use a production build; script does not build or deploy",
          networkThrottling: "none",
          cpuThrottling: "none",
          motion: "reduce",
          deviceScaleFactor: 1,
          physicalDevice: false,
          externalNetworkBlocked: values["offline-smoke"],
          graphData: values["offline-smoke"]
            ? "Empty local fixture, not archive data"
            : "Configured application backend",
          browserCache: values["offline-smoke"]
            ? "HTTP cache disabled by request interception"
            : "Fresh context then same-context reload",
          purpose: values["offline-smoke"]
            ? "Tool smoke test only; not representative performance evidence"
            : "Target build sampling",
          serverAndCdnCache: "uncontrolled",
          samplingWindowAfterReadinessMs: 2000,
          readiness:
            "DOM controls visible; graph canvas present, not all images decoded or graph simulation settled",
          transferScope:
            "Completed requests during each sampling window; excludes in-flight bodies and is not total session transfer",
          clsScope:
            "Observed shift sum in the sampling window, not a field CLS session-window score",
        },
        samples,
      },
      null,
      2,
    ),
  );
  console.log(`Wrote ${samples.length} browser samples to ${output}`);
} finally {
  await browser.close();
}
