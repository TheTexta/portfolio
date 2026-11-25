import { expect, test } from "@playwright/test";

const experience = "/projects/photo-graph/experience";
const payload = {
  nodes: [
    {
      id: "first",
      sourceUrl: "/__photo-graph-loading.svg",
      baseSize: 100,
      aspectRatio: 1.6,
      hasKnownAspectRatio: true,
      layerNoise: 0,
      w: 160,
      h: 100,
      renderArea: 16000,
    },
  ],
  links: [],
};

for (const colorScheme of ["light", "dark"] as const) {
  for (const reducedMotion of ["no-preference", "reduce"] as const) {
    test(`square loading bar and graph reveal: ${colorScheme}, ${reducedMotion}`, async ({
      page,
      context,
    }, info) => {
      let release!: () => void;
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      await context.route("https://**/*", (route) => route.abort());
      await context.route("**/__photo-graph-loading.svg", (route) =>
        route.fulfill({
          contentType: "image/svg+xml",
          body: '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="100"><rect width="160" height="100" fill="#c43b2c"/></svg>',
        }),
      );
      await context.route("**/api/photo-graph/graph", async (route) => {
        await held;
        await route.fulfill({ json: payload });
      });
      try {
        await page.emulateMedia({ colorScheme, reducedMotion });
        await page.goto(experience);
        const graph = page.getByRole("region", {
          name: "Interactive photograph graph",
          exact: true,
        });
        const status = graph.getByRole("status");
        const bar = graph.getByRole("progressbar", {
          name: "Loading photographs",
        });
        await expect(status).toContainText("Loading photographs");
        await expect(bar).toBeVisible();
        await expect(bar).toHaveCSS("border-radius", "0px");
        await expect(bar.locator("span")).toHaveCSS("border-radius", "0px");
        await expect(bar).not.toHaveAttribute("aria-valuenow");
        if (reducedMotion === "reduce") {
          await expect(bar.locator("span")).toHaveCSS("animation-name", "none");
        } else {
          await expect(bar.locator("span")).not.toHaveCSS(
            "animation-name",
            "none",
          );
        }
        const textBounds = (await status.locator("p").boundingBox())!;
        const barBounds = (await bar.boundingBox())!;
        expect(barBounds.y).toBeGreaterThan(textBounds.y + textBounds.height);
        expect(barBounds.width).toBe(192);
        await page.screenshot({
          path: info.outputPath(`loading-${colorScheme}-${reducedMotion}.png`),
        });

        // Observe actual paint frames, rather than assuming an opacity class
        // guarantees a fade or a canvas exists when loading finishes.
        const reveal = status.evaluate(
          (overlay) =>
            new Promise<{ faded: boolean; canvasReady: boolean }>(
              (resolve, reject) => {
                const graph = overlay.parentElement!;
                const start = performance.now();
                let faded = false;
                const sample = () => {
                  if (!overlay.isConnected) {
                    resolve({
                      faded,
                      canvasReady: Boolean(
                        graph.querySelector('[data-graph-mode="2d"] canvas'),
                      ),
                    });
                    return;
                  }
                  const opacity = Number(getComputedStyle(overlay).opacity);
                  faded ||= opacity > 0 && opacity < 1;
                  if (performance.now() - start > 15_000) {
                    reject(new Error("Loading overlay did not finish"));
                    return;
                  }
                  requestAnimationFrame(sample);
                };
                requestAnimationFrame(sample);
              },
            ),
        );
        release();
        const result = await reveal;
        expect(result.canvasReady).toBe(true);
        expect(result.faded).toBe(reducedMotion === "no-preference");
        await expect(bar).toHaveCount(0);
        await expect(graph.locator("canvas").first()).toBeVisible();
        await page.screenshot({
          path: info.outputPath(`graph-${colorScheme}-${reducedMotion}.png`),
        });
      } finally {
        release();
      }
    });
  }
}
