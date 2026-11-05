import { expect, test, type Locator, type Page } from "@playwright/test";
import fixture from "../../public/projects/photo-graph/worked-example/fixture.json";

const route = "/write-ups/photo-graph";
const problems = new WeakMap<Page, string[]>();
const inspector = (page: Page, name: string) =>
  page.locator(`[data-demo="${name}"]`);
const comparison = (page: Page) => inspector(page, "comparison");
const rules = (page: Page) => inspector(page, "rules");
const wallPhoto = (page: Page) =>
  page.getByRole("img", {
    name: /^Printed photographs arranged across a bedroom wall/,
  });
const edges = (scope: Locator) =>
  scope
    .locator("line[data-edge-source]")
    .evaluateAll((lines) =>
      lines
        .map(
          (line) =>
            `${line.getAttribute("data-edge-source")}:${line.getAttribute("data-edge-target")}:${line.getAttribute("data-edge-weight")}`,
        )
        .sort(),
    );
const points = (scope: Locator) =>
  scope
    .locator("circle")
    .evaluateAll((circles) =>
      circles.map(
        (circle) => `${circle.getAttribute("cx")}:${circle.getAttribute("cy")}`,
      ),
    );

test.beforeEach(async ({ context, page }) => {
  const errors: string[] = [];
  problems.set(page, errors);
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      /hydration|cannot be a descendant|didn.t match/i.test(message.text())
    )
      errors.push(message.text());
  });
  await context.route("https://**/*", (request) => request.abort());
  await context.route("**/api/photo-graph/graph", (request) =>
    request.fulfill({
      json: {
        nodes: ["112", "75", "27"].map((id, index) => ({
          id,
          sourceUrl: `/projects/photo-graph/worked-example/thumbnails/${id}.webp`,
          baseSize: 120,
          aspectRatio: 1.5,
          hasKnownAspectRatio: true,
          layerNoise: 0,
          w: 150,
          h: 100,
          renderArea: 15000,
          x: index * 180,
          y: 0,
        })),
        links: [
          { source: "112", target: "75", value: 0.63 },
          { source: "112", target: "27", value: 0.033 },
        ],
      },
    }),
  );
});
test.afterEach(async ({ page }) =>
  expect(problems.get(page) ?? []).toEqual([]),
);

test("five engineering sections open with the real graph and exactly two supporting inspectors", async ({
  page,
}) => {
  await page.goto(route);
  const article = page.getByRole("article");
  await expect(article.locator("h2")).toHaveText([
    "Browsing by colour",
    "Defining what “similar” means",
    "Turning similarity into a useful graph",
    "Making the graph usable",
    "Operating the archive and evaluating the result",
  ]);
  const preview = article.getByRole("region", {
    name: "Photo Node-Gallery interactive preview",
    exact: true,
  });
  await expect(preview.locator("canvas")).toBeVisible();
  await expect(article.locator("[data-demo]")).toHaveCount(2);
  await wallPhoto(page).scrollIntoViewIfNeeded();
  await expect(wallPhoto(page)).toHaveJSProperty("complete", true);
  await expect(wallPhoto(page)).not.toHaveJSProperty("naturalWidth", 0);
  expect(
    await article.evaluate(
      (element) =>
        !!(
          element
            .querySelector("[data-write-up-preview]")!
            .compareDocumentPosition(element.querySelector("[data-demo]")!) &
          Node.DOCUMENT_POSITION_FOLLOWING
        ),
    ),
  ).toBe(true);
  await expect(article).not.toContainText(
    /The first figure|expanded default figure|A vector is an ordered/,
  );
});

test("default evidence remains readable without JavaScript or backend access", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  const backend: string[] = [];
  page.on("request", (request) => {
    if (/\/api\/photo-graph\/|api\.dextery\.dev/.test(request.url()))
      backend.push(request.url());
  });
  await page.goto(`${baseURL}${route}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Photo Node-Gallery",
  );
  await expect(
    comparison(page).locator('[data-distance="ciede2000"]'),
  ).toHaveText("5.933");
  await expect(rules(page).locator("[data-edge-count]")).toHaveText("252");
  expect((await edges(rules(page))).length).toBe(252);
  await expect(rules(page).locator("[data-node-id]")).toHaveCount(100);
  expect(backend).toEqual([]);
  await context.close();
});

test("photograph and candidate selections update swatches, vectors, differences and graph focus", async ({
  page,
}) => {
  await page.goto(route);
  const demo = comparison(page);
  await expect(demo.getByLabel("Photograph", { exact: true })).toHaveValue(
    "112",
  );
  await expect(demo.getByLabel("Candidate", { exact: true })).toHaveValue("75");
  await demo.getByLabel("Candidate", { exact: true }).selectOption("27");
  await expect(demo.locator('[data-distance="ciede2000"]')).toHaveText(
    "15.467",
  );
  await expect(rules(page).locator('[data-candidate-id="27"]')).toContainText(
    "0.033",
  );
  await demo.getByLabel("Candidate", { exact: true }).selectOption("65");
  await expect(demo.locator('[data-distance="ciede2000"]')).toHaveText(
    "41.038",
  );
  await expect(rules(page).locator('[data-candidate-id="65"]')).toContainText(
    "No link",
  );
  await demo.getByLabel("Photograph", { exact: true }).selectOption("65");
  await expect(demo.getByLabel("Candidate", { exact: true })).toHaveValue(
    "112",
  );
  await expect(demo.getByLabel("Photograph", { exact: true })).toHaveValue(
    "65",
  );
  await expect(rules(page).getByRole("caption")).toContainText(
    "Amber interior",
  );
  await expect(demo.locator('[data-distance="ciede2000"]')).toHaveText(
    "41.038",
  );
  await expect(
    demo.getByLabel("Candidate", { exact: true }).locator('option[value="65"]'),
  ).toHaveCount(0);
});

test("optional arithmetic uses the selected pair and works with the keyboard", async ({
  page,
}) => {
  await page.goto(route);
  const demo = comparison(page);
  await demo.getByLabel("Candidate", { exact: true }).selectOption("27");
  const summary = demo.getByText("Inspect the arithmetic", { exact: true });
  await summary.focus();
  await summary.press("Enter");
  await expect(
    demo.getByRole("columnheader", { name: "Normalised" }),
  ).toBeVisible();
  await expect(demo.locator('[data-distance="cie76"]')).toHaveText("45.203");
  await demo.getByLabel("Candidate", { exact: true }).selectOption("65");
  await expect(demo.locator("details")).toHaveAttribute("open", "");
  await expect(demo.locator('[data-distance="ciede2000"]')).toHaveText(
    "41.038",
  );
  await expect(demo.locator("details")).toContainText(
    "The interaction is signed",
  );
});

test("rules change exact links and weights without moving positions or modifying descriptors", async ({
  page,
}) => {
  await page.goto(route);
  const graph = rules(page);
  const beforePoints = await points(graph);
  const beforeDescriptors = await comparison(page)
    .locator("dl")
    .allTextContents();
  const beforeEdges = await edges(graph);
  expect(beforeEdges).toEqual(
    fixture.defaultGraph.edges
      .map((edge) => `${edge.source}:${edge.target}:${edge.weight}`)
      .sort(),
  );
  const cutoff = graph.getByRole("slider", {
    name: "Colour-difference cutoff",
    exact: true,
  });
  await cutoff.focus();
  await cutoff.press("ArrowLeft");
  await expect(cutoff).toHaveValue("15");
  await expect(graph.locator('[data-candidate-id="27"]')).toContainText(
    "No link",
  );
  expect(await points(graph)).toEqual(beforePoints);
  const limit = graph.getByRole("slider", {
    name: "Neighbours per photograph",
    exact: true,
  });
  await limit.focus();
  await limit.press("Home");
  await cutoff.focus();
  await cutoff.press("Home");
  expect((await edges(graph)).length).toBeLessThan(beforeEdges.length);
  expect(
    Number(await graph.locator("[data-isolate-count]").innerText()),
  ).toBeGreaterThan(0);
  expect(await comparison(page).locator("dl").allTextContents()).toEqual(
    beforeDescriptors,
  );
});

test("both inspectors fit the reading column across mobile widths and themes without autoplay controls", async ({
  page,
}, info) => {
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    await page.goto(route);
    for (const width of info.project.name === "mobile" ? [320, 390] : [1440]) {
      await page.setViewportSize({ width, height: 900 });
      const wall = wallPhoto(page);
      await wall.scrollIntoViewIfNeeded();
      const wallBox = await wall.boundingBox();
      expect(wallBox!.x).toBeGreaterThanOrEqual(0);
      expect(wallBox!.x + wallBox!.width).toBeLessThanOrEqual(width);
      expect(wallBox!.width / wallBox!.height).toBeCloseTo(4 / 3, 2);
      for (const name of ["comparison", "rules"]) {
        const figure = inspector(page, name);
        await figure.scrollIntoViewIfNeeded();
        expect(
          await figure.evaluate((element) => {
            const rect = element.getBoundingClientRect();
            return (
              rect.left >= 0 &&
              rect.right <= innerWidth &&
              document.documentElement.scrollWidth <= innerWidth
            );
          }),
        ).toBe(true);
        await expect(
          figure.getByRole("button", { name: /Pause|Replay|Reset/ }),
        ).toHaveCount(0);
        await figure.screenshot({
          path: `.tmp/playwright-results/photo-graph-${name}-${info.project.name}-${width}-${colorScheme}.png`,
        });
      }
    }
  }
});
